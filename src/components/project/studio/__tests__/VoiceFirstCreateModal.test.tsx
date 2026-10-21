import { render, screen, fireEvent, waitFor, cleanup, within, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { VoiceFirstCreateModal } from "../VoiceFirstCreateModal";
import { scaffoldProjectDefaults } from "@/lib/scaffoldProject";

/**
 * Regression coverage for New Room's accessibility contract (NEW_ROOM_UX_AUDIT.md
 * §7): this is a hand-rolled full-screen overlay, not a Radix Dialog, so none
 * of focus trap / focus return / aria-labelledby come for free -- these tests
 * guard the behavior added to close that gap, plus the core prompt-mode
 * structure (starter intents, input mode entry points) the rest of the flow
 * depends on.
 *
 * Also covers the Kreto embodied-presence state mapping approved in
 * KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md: idle/attentive/listening/processing/
 * caution/proposal_ready/error, each tied to a real trigger, never a fake
 * one. `KretoCharacter` itself is mocked to a thin `data-state` stub -- its
 * own rendering (the real character image, sr-only text per state) is
 * already covered by KretoCharacter.test.tsx; what this file verifies is
 * that the *right* state gets computed and passed down for the *real*
 * condition in this modal.
 */

const mocks = vi.hoisted(() => ({
  invoke: vi.fn((_name?: string, _options?: { body?: Record<string, unknown> }): Promise<{ data: unknown; error: unknown }> => Promise.resolve({
    data: {
      project: { title: "Test Project", summary: "A test brief." },
      deliverables: [{ title: "First task", description: "" }],
    },
    error: null,
  })),
  projectsInsert: vi.fn((_row?: unknown) => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: "new-project-id" }, error: null }) }),
  })),
  tasksInsert: vi.fn((_rows?: unknown) => Promise.resolve({ data: null, error: null as { message: string } | null })),
  toast: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    from: (table: string) => {
      if (table === "projects") return { insert: mocks.projectsInsert };
      if (table === "project_tasks") return { insert: mocks.tasksInsert };
      if (table === "profiles") {
        // FeatureAITutorial's useFirstTimeUser() queries this -- an
        // established, non-new profile keeps the tutorial's auto-open
        // behavior out of these tests' way (they only assert the trigger
        // renders, not the auto-open-for-new-users path) and avoids a
        // swallowed-but-noisy console error from an incomplete mock chain.
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({
                data: { created_at: "2020-01-01T00:00:00Z", xp: 999 },
                error: null,
              }),
            }),
          }),
        };
      }
      return { insert: vi.fn(() => Promise.resolve({ data: null, error: null })) };
    },
    // analytics.ts's trackEvent() calls this when no explicit userId is
    // passed -- without it, every event fired during these tests (e.g. the
    // real new_room_opened call on mount) logs a swallowed-but-noisy error.
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "test-user-id" } }, error: null }) },
    // Cover image upload (CEO hotfix: required before Create) -- a fixed
    // public URL is enough here, the actual storage path isn't asserted.
    storage: {
      from: () => ({
        upload: vi.fn(() => Promise.resolve({ data: {}, error: null })),
        getPublicUrl: () => ({ data: { publicUrl: "https://example.com/cover.jpg" } }),
      }),
    },
  },
}));

vi.mock("@/lib/scaffoldProject", () => ({
  scaffoldProjectDefaults: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test-user-id" }, session: null, loading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

// extractBriefDocument.ts pulls in pdfjs-dist at module scope, which needs
// DOMMatrix -- a real browser Canvas API jsdom doesn't provide. None of these
// tests touch file upload, so a lightweight mock avoids that environment gap
// entirely rather than polyfilling a Canvas API the suite doesn't need.
vi.mock("@/lib/extractBriefDocument", () => ({
  compressImage: vi.fn(async () => ({ base64: "", mime: "image/jpeg" })),
}));

// Only useNavigate is overridden (to capture its call args, notably the
// route `state` the Studio success acknowledgement depends on) -- everything
// else, including MemoryRouter and real route matching, is untouched.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

// KretoCharacter's own rendering (the real character image, sr-only
// announcements per state) is covered by its own test suite -- this file
// only needs to know which `state` VoiceFirstCreateModal computed and
// passed down for a given real condition, so a thin stub keeps these
// tests fast and decoupled.
vi.mock("@/components/brand/KretoCharacter", () => ({
  KretoCharacter: ({ state, size }: { state?: string; size?: number }) => (
    <div data-testid="kreto-presence" data-state={state} data-size={size} />
  ),
}));

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  state: "recording" | "inactive" = "recording";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown) {
    MockMediaRecorder.instances.push(this);
  }
  start() {}
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["fake-audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

function stubMicPermission(behavior: "grant" | "deny") {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia:
        behavior === "grant"
          ? vi.fn(() => Promise.resolve({ getTracks: () => [{ stop: vi.fn() }] }))
          : vi.fn(() => Promise.reject(new Error("Permission denied"))),
    },
    configurable: true,
  });
}

function renderModal(props: Partial<React.ComponentProps<typeof VoiceFirstCreateModal>> = {}) {
  const onOpenChange = vi.fn();
  const onCreated = vi.fn();
  const utils = render(
    <MemoryRouter>
      <VoiceFirstCreateModal open onOpenChange={onOpenChange} onCreated={onCreated} {...props} />
    </MemoryRouter>,
  );
  return { ...utils, onOpenChange, onCreated };
}

// Cover image is required before Create (CEO hotfix) -- every test that
// reaches the review screen and needs to actually confirm creation must
// drive this real input first, same as a user would.
async function uploadCoverImage() {
  const input = screen.getByLabelText("Upload a cover image");
  const file = new File(["fake-image"], "cover.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText("Tap to change");
}

describe("VoiceFirstCreateModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockMediaRecorder.instances.length = 0;
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    stubMicPermission("grant");
    // The real draft-persistence feature (VoiceFirstCreateModal.tsx's own
    // `new_room_draft:<userId>` sessionStorage key) survives across tests in
    // this file since every test shares the same mocked user id and jsdom
    // doesn't reset storage between tests on its own -- without this, a
    // test that reaches "review" leaves a draft that the next renderModal()
    // rehydrates instead of starting fresh at "prompt".
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders nothing when closed", () => {
    render(
      <MemoryRouter>
        <VoiceFirstCreateModal open={false} onOpenChange={vi.fn()} onCreated={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByText("What are you making?")).not.toBeInTheDocument();
  });

  it("renders the prompt-mode heading, trust line and how-it-works tutorial trigger when open", () => {
    renderModal();
    // The accent word ("making?") is its own <span>, so the heading's text
    // is split across nodes -- match on the heading element's combined
    // textContent instead of a single exact string.
    expect(screen.getByRole("heading", { name: "What are you making?" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing becomes a Project until you confirm the draft/)).toBeInTheDocument();
    // The bespoke <details> "How this works" was replaced by the same
    // shared FeatureAITutorial trigger every other overhauled feature page
    // uses -- "Examples to get you started" starter chips were removed
    // outright, not replaced.
    expect(screen.getByText("How this works")).toBeInTheDocument();
    expect(screen.queryByText("Examples to get you started")).not.toBeInTheDocument();
  });

  it("exposes a real dialog role labelled by the visible New Room title, not a duplicated static string", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(labelledBy).toBe("new-room-title");
    const labelEl = document.getElementById(labelledBy!);
    expect(labelEl).not.toBeNull();
    expect(labelEl).toHaveTextContent("New Room");
  });

  it("closes on Escape", () => {
    const { onOpenChange } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when the close button is clicked", () => {
    const { onOpenChange } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves initial focus to the close button", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("the Kreto composer is the primary entry point, always visible with no mode toggle needed", () => {
    renderModal();
    // Text entry is not hidden behind a "type it instead" click, and voice
    // is a secondary icon inside the same bar rather than a separate screen.
    expect(screen.getByLabelText("Describe your project to Kreto")).toBeInTheDocument();
    expect(screen.getByLabelText("Describe it by voice instead")).toBeInTheDocument();
    expect(screen.queryByText("Or type it instead")).not.toBeInTheDocument();
  });

  it("creates exactly one project even if Create is double-clicked", async () => {
    renderModal();
    const input = screen.getByLabelText("Describe your project to Kreto");
    fireEvent.change(input, { target: { value: "A real editorial shoot brief for testing." } });
    fireEvent.click(screen.getByLabelText("Send to Kreto"));

    await screen.findByText("Kreto structured your project — review and edit", {}, { timeout: 3000 });
    // The "Money involved?" gate is required -- both Create buttons stay
    // disabled until it's answered, same as in the real app.
    fireEvent.click(screen.getByText("No — personal/passion"));
    await uploadCoverImage();

    const createButton = screen.getByText("Create All & Open");

    // Two rapid clicks simulate the double-click/double-tap race a plain
    // `creating` state boolean can't fully close (state updates lag a
    // render behind the click handler) -- the synchronous creatingRef
    // guard in createProject() is what this test actually verifies.
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    await waitFor(() => expect(mocks.projectsInsert).toHaveBeenCalled());
    expect(mocks.projectsInsert).toHaveBeenCalledTimes(1);
  });

  it("gives the final confirm action the app's canonical primary-CTA treatment, not a plain small button", async () => {
    // Regression guard: this button used to be a bare size="sm" Button --
    // visually the smallest control in the footer despite being the most
    // consequential action. It must render via CtaButton (same component
    // StudioCreateHero's "Open a New Room" uses) so it actually reads as
    // the primary action next to "Start over"/"Create N selected".
    renderModal();
    fireEvent.change(screen.getByLabelText("Describe your project to Kreto"), {
      target: { value: "A real editorial shoot brief for testing." },
    });
    fireEvent.click(screen.getByLabelText("Send to Kreto"));
    await screen.findByText("Kreto structured your project — review and edit");
    fireEvent.click(screen.getByText("No — personal/passion"));

    const confirmButton = screen.getByText("Create All & Open").closest("button");
    expect(confirmButton).toHaveClass("cta-solid", "bg-primary", "shadow-md");
  });

  describe("Kreto embodied presence — state mapping", () => {
    it("is idle when New Room first opens, with nothing typed or focused", () => {
      renderModal();
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "idle");
    });

    it("is attentive only while the composer is genuinely focused, and drops back to idle on blur", () => {
      renderModal();
      const input = screen.getByLabelText("Describe your project to Kreto");
      fireEvent.focus(input);
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "attentive");
      fireEvent.blur(input);
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "idle");
    });

    it("is listening only once the browser mic stream actually resolves, never on click alone", async () => {
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await screen.findByLabelText("Stop recording");
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "listening");
      // Let the recording round-trip finish so no act() warning leaks out.
      fireEvent.click(screen.getByLabelText("Stop recording"));
      await screen.findByText("Kreto structured your project — review and edit");
    });

    it("Cancel discards the recording instead of sending it to extract-brief", async () => {
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await screen.findByLabelText("Stop recording");
      fireEvent.click(screen.getByRole("button", { name: "Cancel — discard this recording" }));
      // Back to the blank prompt screen, not thinking/review -- and the AI
      // was never called with whatever was (or wasn't) captured.
      await screen.findByRole("heading", { name: "What are you making?" });
      expect(mocks.invoke).not.toHaveBeenCalled();
    });

    it("never enters listening when mic permission is denied", async () => {
      stubMicPermission("deny");
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
      expect(screen.queryByLabelText("Stop recording")).not.toBeInTheDocument();
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "idle");
    });

    it("is processing only while the real extract-brief request is in flight", async () => {
      renderModal();
      const input = screen.getByLabelText("Describe your project to Kreto");
      fireEvent.change(input, { target: { value: "A real editorial shoot brief for testing." } });
      fireEvent.click(screen.getByLabelText("Send to Kreto"));
      // Synchronous: setMode("thinking") runs in the click handler itself,
      // before the mocked network promise has a chance to resolve.
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "processing");
      // Let the in-flight request settle before the test ends, so its state
      // update doesn't land outside of this test's act() scope.
      await screen.findByText("Kreto structured your project — review and edit");
    });

    it("is proposal_ready with no caution banner for a clean, confidently-typed draft", async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText("Describe your project to Kreto"), {
        target: { value: "A real editorial shoot brief for testing." },
      });
      fireEvent.click(screen.getByLabelText("Send to Kreto"));
      await screen.findByText("Kreto structured your project — review and edit");
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "proposal_ready");
      expect(screen.queryByText("Worth a look before you continue")).not.toBeInTheDocument();
    });

    it("is caution, with real explanatory text, when the project type can't be confidently inferred", async () => {
      renderModal();
      const input = screen.getByLabelText("Describe your project to Kreto");
      // No workspace type keyword matches this -- inferWorkspaceType falls
      // back to "general", the real, honest "uncertain" signal.
      fireEvent.change(input, { target: { value: "zzz completely unclassifiable nonsense zzz" } });
      fireEvent.click(screen.getByLabelText("Send to Kreto"));
      await screen.findByText("Kreto structured your project — review and edit");
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "caution");
      expect(screen.getByText(/wasn't confident about the project type/i)).toBeInTheDocument();
    });

    it("is caution when extraction failed and the draft degraded to raw text, but still lets the user proceed", async () => {
      mocks.invoke.mockRejectedValueOnce(new Error("extract-brief unavailable"));
      renderModal();
      const input = screen.getByLabelText("Describe your project to Kreto");
      fireEvent.change(input, { target: { value: "A brief Kreto will fail to expand." } });
      fireEvent.click(screen.getByLabelText("Send to Kreto"));
      await screen.findByText("Kreto structured your project — review and edit");
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "caution");
      expect(screen.getByText(/couldn't structure this one/i)).toBeInTheDocument();
    });

    it("shows a calm error state on a real failed link extraction, preserves the input, and retry returns to the link form", async () => {
      mocks.invoke.mockRejectedValueOnce(new Error("Sheet not shared"));
      renderModal();
      fireEvent.click(screen.getByText("Paste a Google Sheet"));
      const linkInput = screen.getByPlaceholderText(/docs\.google\.com/i);
      fireEvent.change(linkInput, { target: { value: "https://docs.google.com/spreadsheets/d/abc" } });
      fireEvent.click(screen.getByText("Continue"));

      await screen.findByText("Kreto couldn't finish that draft.");
      expect(screen.getByTestId("kreto-presence")).toHaveAttribute("data-state", "error");
      // Never claims the Studio was created, and there's a way forward.
      expect(screen.queryByText("Studio room ready")).not.toBeInTheDocument();

      fireEvent.click(screen.getByText("Try again"));
      expect(screen.getByPlaceholderText(/docs\.google\.com/i)).toHaveValue(
        "https://docs.google.com/spreadsheets/d/abc",
      );
    });

    it("shows the room-ready celebration, then navigates to the new Studio with a real, non-spoofable success flag in route state, not a query param", async () => {
      renderModal();
      fireEvent.change(screen.getByLabelText("Describe your project to Kreto"), {
        target: { value: "A real editorial shoot brief for testing." },
      });
      fireEvent.click(screen.getByLabelText("Send to Kreto"));
      await screen.findByText("Kreto structured your project — review and edit");
      fireEvent.click(screen.getByText("No — personal/passion"));
      await uploadCoverImage();
      fireEvent.click(screen.getByText("Create All & Open"));

      // NewRoomLaunchScreen (the "your room is live" celebration) shows
      // first -- navigation only fires once the user actually leaves it.
      const openRoomButton = await screen.findByText("Open the Room");
      expect(mocks.navigate).not.toHaveBeenCalled();

      // Regression: the covering review-screen dialog (still mounted
      // intentionally, so onCreated()/onOpenChange(false) firing from a
      // caller doesn't unmount NewRoomLaunchScreen along with it) used to
      // stay rendered at z-[60], visually covering this z-50 celebration
      // Dialog in a real browser even though both existed in the DOM.
      // Role-based queries can't catch this: Radix Dialog marks background
      // content aria-hidden once open, which getByRole already excludes
      // regardless of this bug, so the assertion has to be text-based
      // (which, unlike role queries, does not filter by aria-hidden) to
      // actually distinguish the covering dialog being gone from merely
      // being accessibility-hidden behind the celebration.
      expect(screen.queryByText("Create All & Open")).not.toBeInTheDocument();
      expect(screen.queryByText("New Room")).not.toBeInTheDocument();

      fireEvent.click(openRoomButton);

      await waitFor(() => expect(mocks.navigate).toHaveBeenCalled(), { timeout: 1000 });
      const [to, opts] = mocks.navigate.mock.calls[0];
      expect(to).toBe("/desk/new-project-id");
      expect(opts).toEqual({ state: { kretoJustCreated: true } });
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A project from free text: what the person gave, what Kreto suggested, what is missing; a draft that cannot be
// trusted blindly; and nothing created without the person pressing Create.
// ---------------------------------------------------------------------------------------------------------------

const REVIEW = "Kreto structured your project — review and edit";
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const answer = (data: unknown) => ({ data, error: null });

function typeBrief(text: string) {
  fireEvent.change(screen.getByLabelText("Describe your project to Kreto"), { target: { value: text } });
  fireEvent.click(screen.getByLabelText("Send to Kreto"));
}
async function reviewOf(text: string) {
  typeBrief(text);
  await screen.findByText(REVIEW);
}
const panel = () => screen.getByRole("region", { name: "Where this draft comes from" });
const group = (name: string) => within(panel()).getByRole("list", { name });
const hasGroup = (name: string) => within(panel()).queryByRole("list", { name }) !== null;
async function createRoom() {
  fireEvent.click(screen.getByText("No — personal/passion"));
  await uploadCoverImage();
  fireEvent.click(screen.getByText("Create All & Open"));
  await waitFor(() => expect(mocks.projectsInsert).toHaveBeenCalled());
}

describe("a project from free text", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockMediaRecorder.instances.length = 0;
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    stubMicPermission("grant");
    sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("what the person gave, what Kreto suggested, what is missing", () => {
    it("sorts a draft into the three groups, crediting the person only with what their own words say", async () => {
      renderModal();
      await reviewOf("A brand shoot for a client, budget $800.");
      expect(group("From you")).toHaveTextContent("Budget: $800");
      expect(group("From you")).toHaveTextContent("Money involved: Yes");
      expect(group("Suggested by Kreto")).toHaveTextContent("Project name");
      expect(group("Suggested by Kreto")).toHaveTextContent("The vision");
      expect(group("Suggested by Kreto")).toHaveTextContent("Starter tasks: 1 drafted");
      expect(group("Still missing")).toHaveTextContent("Target date");
      expect(group("Still missing")).toHaveTextContent("Cover image (required)");
      expect(group("From you")).not.toHaveTextContent("Project name");
    });

    it("does not read a budget out of what the model wrote: an amount the person never typed is not filled in", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "Swim shoot", summary: "A polished $5k production." }, deliverables: [{ title: "Book the model" }] }));
      renderModal();
      await reviewOf("A swimwear shoot next month");
      expect(screen.getByPlaceholderText("e.g. $2,000")).toHaveValue("");
      expect(group("Still missing")).toHaveTextContent("Budget");
      expect(within(panel()).queryByText(/^Budget: /)).toBeNull();
    });

    it("keeps an amount from a recording a suggestion, because there is no typed text to check it against", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "Reel", summary: "A reel with a $2,000 budget." }, deliverables: [{ title: "Shoot" }] }));
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await screen.findByLabelText("Stop recording");
      fireEvent.click(screen.getByLabelText("Stop recording"));
      await screen.findByText(REVIEW);
      expect(screen.getByPlaceholderText("e.g. $2,000")).toHaveValue("$2,000");
      expect(group("Suggested by Kreto")).toHaveTextContent("Budget: $2,000");
      expect(hasGroup("From you") ? group("From you").textContent : "").not.toMatch(/Budget/);
      expect(screen.getByText("Kreto's guess from what you said.")).toBeTruthy();
    });

    it("moves a value to 'From you' once the person writes it, and a suggested date stays a suggestion until then", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "Carnival", summary: "Two days." }, deliverables: [{ title: "Lock venue", due_date: inDays(40) }] }));
      renderModal();
      await reviewOf("A beach carnival");
      expect(group("Suggested by Kreto")).toHaveTextContent("Target date");
      expect(group("Suggested by Kreto")).toHaveTextContent("Project name");

      fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "My carnival" } });
      fireEvent.change(screen.getByLabelText("The vision"), { target: { value: "My own words." } });
      fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, { target: { value: inDays(60) } });
      expect(group("From you")).toHaveTextContent("Project name");
      expect(group("From you")).toHaveTextContent("The vision");
      expect(group("From you")).toHaveTextContent("Target date");
      expect(group("Suggested by Kreto")).not.toHaveTextContent("Target date");
    });

    it("treats the person's own text as theirs when Kreto could not structure it, and says so", async () => {
      mocks.invoke.mockRejectedValueOnce(new Error("gateway down"));
      renderModal();
      await reviewOf("A podcast about swimming, weekly.");
      expect(group("From you")).toHaveTextContent("Project name");
      expect(group("From you")).toHaveTextContent("The vision");
      expect(hasGroup("Suggested by Kreto") ? group("Suggested by Kreto").textContent : "").not.toMatch(/Project name/);
      expect(screen.getByText(/Kreto couldn't structure this one/)).toBeTruthy();
    });

    it("remembers where values came from across a refresh", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "Carnival", summary: "Two days." }, deliverables: [{ title: "Lock venue", due_date: inDays(40) }] }));
      const first = renderModal();
      await reviewOf("A beach carnival");
      expect(group("Suggested by Kreto")).toHaveTextContent("Target date");
      first.unmount();

      renderModal();
      await screen.findByText(REVIEW);
      expect(group("Suggested by Kreto")).toHaveTextContent("Target date");
      expect(group("Suggested by Kreto")).toHaveTextContent("Project name");
    });

    it("does not turn a draft saved by an older version into the person's own values", async () => {
      sessionStorage.setItem("new_room_draft:test-user-id", JSON.stringify({
        ts: Date.now(), brief: { project: { title: "Old draft", summary: "s" } }, selected: [], workspaceType: "general",
        paymentsInvolved: true, deadline: "2027-01-15", budget: "$900",
      }));
      renderModal();
      await screen.findByText(REVIEW);
      expect(group("Suggested by Kreto")).toHaveTextContent("Target date");
      expect(group("Suggested by Kreto")).toHaveTextContent("Budget: $900");
      expect(group("Suggested by Kreto")).toHaveTextContent("Money involved: Yes");
    });
  });

  describe("an answer that cannot be trusted", () => {
    it.each([
      ["a project whose title is not text", { project: { title: 42, summary: "x" }, deliverables: [] }],
      ["a string", "not even json"],
      ["nothing", null],
      ["a project that is a list", { project: ["a"], deliverables: [] }],
    ])("falls back to the person's own words for %s, without an error and without losing the text", async (_name, data) => {
      mocks.invoke.mockResolvedValueOnce(answer(data));
      renderModal();
      await reviewOf("A weekly podcast about swimming.");
      expect(screen.getByLabelText("Project name")).toHaveValue("A weekly podcast about swimming.");
      expect(screen.getByLabelText("The vision")).toHaveValue("A weekly podcast about swimming.");
      expect(screen.queryByText("Kreto couldn't finish that draft.")).toBeNull();
    });

    it("keeps the tasks it can read, leaves out the rest and says how many", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "P", summary: "s" }, deliverables: [{ title: "Good task" }, { title: "" }, 5, { title: "good task" }] }));
      renderModal();
      await reviewOf("Something to make");
      expect(screen.getByLabelText("Task 1")).toHaveValue("Good task");
      expect(screen.queryByLabelText("Task 2")).toBeNull();
      expect(screen.getByText("3 drafted tasks were left out: no readable title, or a repeat.")).toBeTruthy();
    });

    it("shows a recording or a file Kreto could not use as an error with a way forward, never as an empty draft", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: {}, deliverables: [] }));
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await screen.findByLabelText("Stop recording");
      fireEvent.click(screen.getByLabelText("Stop recording"));
      expect(await screen.findByText("Kreto couldn't finish that draft.")).toBeTruthy();
      expect(screen.getByRole("alert")).toHaveTextContent("Kreto couldn't catch what you said.");
      expect(screen.queryByText(REVIEW)).toBeNull();
    });

    it("leaves out due dates the model cannot know (past, not a date), keeps the future ones and shows what will be saved", async () => {
      const soon = inDays(30);
      mocks.invoke.mockResolvedValueOnce(answer({
        project: { title: "P", summary: "s" },
        deliverables: [{ title: "Old news", due_date: "2020-01-01" }, { title: "Words", due_date: "next Friday" }, { title: "Soon", due_date: soon }],
      }));
      renderModal();
      await reviewOf("A launch");
      expect(screen.getAllByText(/^Suggested due date:/)).toHaveLength(1);
      expect(screen.getByDisplayValue(soon)).toBeTruthy();
      expect(screen.getByText(/2 suggested due dates were left out/)).toBeTruthy();

      await createRoom();
      await waitFor(() => expect(mocks.tasksInsert).toHaveBeenCalled());
      const rows = mocks.tasksInsert.mock.calls[0][0] as Array<{ title: string; due_date: string | null }>;
      expect(rows.map((r) => [r.title, r.due_date])).toEqual([["Old news", null], ["Words", null], ["Soon", `${soon}T00:00:00.000Z`]]);
    });

    it("never carries what the model adds beyond the fields the project supports", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "P", summary: "s", status: "published", role: "admin" }, deliverables: [{ title: "T", assignee: "x" }], permissions: { all: "owner" } }));
      renderModal();
      await reviewOf("A thing");
      await createRoom();
      const project = mocks.projectsInsert.mock.calls[0][0] as Record<string, unknown>;
      expect(project.status).toBe("active");
      expect(project.created_by).toBe("test-user-id");
      expect(JSON.stringify(project)).not.toMatch(/published|admin|permissions/);
    });
  });

  describe("editing and confirming", () => {
    it("creates nothing until the person presses Create, and Create waits for the money answer and the cover", async () => {
      renderModal();
      await reviewOf("A thing to make");
      expect(mocks.projectsInsert).not.toHaveBeenCalled();
      expect(screen.getByText("Create All & Open").closest("button")).toBeDisabled();
      await uploadCoverImage();
      expect(screen.getByText("Create All & Open").closest("button")).toBeDisabled();
      fireEvent.click(screen.getByText("No — personal/passion"));
      expect(screen.getByText("Create All & Open").closest("button")).toBeEnabled();
      expect(mocks.projectsInsert).not.toHaveBeenCalled();
    });

    it("creates the task wording the person edited, and no task they emptied", async () => {
      mocks.invoke.mockResolvedValueOnce(answer({ project: { title: "P", summary: "s" }, deliverables: [{ title: "Draft one" }, { title: "Draft two" }] }));
      renderModal();
      await reviewOf("Something");
      fireEvent.change(screen.getByLabelText("Task 1"), { target: { value: "  My own wording " } });
      fireEvent.change(screen.getByLabelText("Task 2"), { target: { value: "   " } });
      await createRoom();
      await waitFor(() => expect(mocks.tasksInsert).toHaveBeenCalled());
      const rows = mocks.tasksInsert.mock.calls[0][0] as Array<{ title: string }>;
      expect(rows.map((r) => r.title)).toEqual(["My own wording"]);
    });

    it("says so when the starter tasks could not be saved, and lets the room keep its default tasks", async () => {
      mocks.tasksInsert.mockResolvedValueOnce({ data: null, error: { message: "row-level security" } });
      renderModal();
      await reviewOf("Something");
      await createRoom();
      await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Studio room ready, without your starter tasks" })));
      expect(vi.mocked(scaffoldProjectDefaults)).toHaveBeenCalledWith(expect.objectContaining({ skipTasks: false }));
    });

    it("keeps the draft's tasks out of the defaults when they were saved", async () => {
      renderModal();
      await reviewOf("Something");
      await createRoom();
      await waitFor(() => expect(vi.mocked(scaffoldProjectDefaults)).toHaveBeenCalled());
      expect(vi.mocked(scaffoldProjectDefaults)).toHaveBeenCalledWith(expect.objectContaining({ skipTasks: true }));
      expect(mocks.toast).toHaveBeenCalledWith({ title: "Studio room ready" });
    });
  });

  describe("errors and double submissions", () => {
    it("asks Kreto once however the brief is sent twice (Enter held down, a double tap)", async () => {
      renderModal();
      const input = screen.getByLabelText("Describe your project to Kreto");
      fireEvent.change(input, { target: { value: "A brand film" } });
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.click(screen.getByLabelText("Send to Kreto"));
      });
      await screen.findByText(REVIEW);
      expect(mocks.invoke).toHaveBeenCalledTimes(1);
    });

    it("drops an answer that arrives after New Room was closed, instead of opening a draft nobody asked for", async () => {
      let resolve: (v: unknown) => void = () => undefined;
      mocks.invoke.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
      const onOpenChange = vi.fn();
      const ui = (open: boolean) => (
        <MemoryRouter>
          <VoiceFirstCreateModal open={open} onOpenChange={onOpenChange} onCreated={vi.fn()} />
        </MemoryRouter>
      );
      const { rerender } = render(ui(true));
      typeBrief("A brand film");
      // Closed while the request is really in flight, not before it was sent.
      await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
      rerender(ui(false));
      await act(async () => { resolve(answer({ project: { title: "Late", summary: "s" }, deliverables: [] })); });
      rerender(ui(true));
      expect(await screen.findByRole("heading", { name: "What are you making?" })).toBeTruthy();
      expect(screen.queryByText(REVIEW)).toBeNull();
      expect(screen.queryByDisplayValue("Late")).toBeNull();
    });

    it("keeps a failed recording and sends the same one again, so nothing has to be recorded twice", async () => {
      mocks.invoke.mockRejectedValueOnce(new Error("offline"));
      renderModal();
      fireEvent.click(screen.getByLabelText("Describe it by voice instead"));
      await screen.findByLabelText("Stop recording");
      fireEvent.click(screen.getByLabelText("Stop recording"));
      await screen.findByText("Kreto couldn't finish that draft.");

      fireEvent.click(screen.getByRole("button", { name: "Send the recording again" }));
      await screen.findByText(REVIEW);
      expect(mocks.invoke).toHaveBeenCalledTimes(2);
      const [first, second] = mocks.invoke.mock.calls.map((c) => c[1]?.body?.data_base64);
      expect(first).not.toBe("");
      expect(second).toBe(first);
    });

    it("keeps what was typed when Kreto fails, and goes on with it", async () => {
      mocks.invoke.mockRejectedValueOnce(new Error("gateway down"));
      renderModal();
      await reviewOf("A weekly swimming podcast");
      expect(screen.getByLabelText("Project name")).toHaveValue("A weekly swimming podcast");
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Kreto couldn't expand that" }));
    });

    it("limits how much can be sent in one brief", () => {
      renderModal();
      expect(screen.getByLabelText("Describe your project to Kreto")).toHaveAttribute("maxLength", "4000");
    });
  });
});
