import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type SheetProps = Record<string, unknown> & { open: boolean; onOpenChange: (open: boolean) => void };
const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email?: string; user_metadata?: Record<string, unknown> }, loading: false },
  studioCall: null as null | Record<string, unknown>,
  sheet: null as null | SheetProps,
  row: null as unknown,
  mint: vi.fn(),
  mintMeeting: vi.fn(),
  redeem: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign((...a: unknown[]) => state.toast(...a), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/contexts/VideoCallContext", () => ({
  useVideoCall: () => ({ studioCall: state.studioCall }),
  CALL_BUSY_TITLE: "You're already in a call",
  CALL_BUSY_DESCRIPTION: "Leave it before starting another.",
}));
// The one call, replaced by something that records what the pages hand it.
vi.mock("@/components/project/VideoCallSheet", () => ({
  VideoCallSheet: (props: SheetProps) => {
    state.sheet = props;
    return <div data-testid="call-sheet" data-open={String(props.open)} />;
  },
}));
vi.mock("@/lib/callCredentials", () => ({
  mintMeetingCredentials: (...a: unknown[]) => state.mintMeeting(...a),
  redeemGuestLink: (...a: unknown[]) => state.redeem(...a),
}));
vi.mock("@/lib/guestInviteToken", () => ({ mintGuestInviteToken: (...args: unknown[]) => state.mint(...args) }));
vi.mock("@/lib/acceptInvitation", () => ({ acceptInvitation: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  for (const name of ["select", "eq", "ilike", "or", "order", "limit"]) builder[name] = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: state.row });
  builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, count: 0, error: null });
  return { supabase: { from: () => builder, rpc: () => Promise.resolve({ data: null }), functions: { invoke: vi.fn() } } };
});

import CallPage from "@/pages/CallPage";
import GuestCall from "@/pages/GuestCall";
import JoinWithCode from "@/pages/JoinWithCode";
import AcceptInvite from "@/pages/AcceptInvite";
import PersonalRoom from "@/pages/PersonalRoom";

const renderAt = (url: string, path: string, element: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="/auth" element={<div>auth page</div>} />
        <Route path="/" element={<div>home page</div>} />
        <Route path="/guest/:token" element={<div>guest workspace</div>} />
      </Routes>
    </MemoryRouter>,
  );

const signedIn = { id: "u1", email: "ada@example.com", user_metadata: { full_name: "Ada Lovelace" } };

beforeEach(() => {
  window.sessionStorage.clear();
  state.auth = { user: null, loading: false };
  state.row = null;
  state.mint.mockReset();
  state.studioCall = null;
  state.sheet = null;
  state.toast.mockReset();
  state.mintMeeting.mockReset().mockResolvedValue({ roomUrl: "https://example.test/room", token: "daily-token", title: "Friday casting call", isHost: false });
  state.redeem.mockReset().mockResolvedValue({ roomUrl: "https://example.test/guest-room", token: "guest-token", title: "Live call", isHost: false });
});

const typeName = (name: string) => {
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: /^(Continue|Join call)$/ }));
};

describe("/meet/:meetingId", () => {
  const open = () => renderAt("/meet/m1?t=tok", "/meet/:meetingId", <CallPage />);

  it("opens on the sign-in-or-guest choice, and fetches nothing before it is made", () => {
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    expect(state.mintMeeting).not.toHaveBeenCalled();
    expect(screen.queryByTestId("call-sheet")).toBeNull();
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fm1%3Ft%3Dtok");
  });

  it("asks a guest for a name, puts it into their access, then starts the one call with it", async () => {
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByTestId("guest-name-step")).toBeInTheDocument();
    expect(state.mintMeeting).not.toHaveBeenCalled();
    typeName("Ada Guest");
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(state.mintMeeting).toHaveBeenCalledWith("m1", "tok", "Ada Guest");
    expect(state.sheet).toMatchObject({
      open: true,
      projectName: "Friday casting call",
      roomUrl: "https://example.test/room",
      token: "daily-token",
      userName: "Ada Guest",
      callId: null,
      isHost: false,
      admitKnockers: false,
      lobbyCta: "Knock to join",
      sourceId: "meet:m1",
    });
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
  });

  it("does not ask a signed-in person anything: it starts the call under their own name", async () => {
    state.auth = { user: signedIn, loading: false };
    open();
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
    expect(screen.queryByTestId("guest-name-step")).toBeNull();
    expect(state.mintMeeting).toHaveBeenCalledWith("m1", "tok", "Ada Lovelace");
    expect(state.sheet?.userName).toBe("Ada Lovelace");
  });

  it("gives the host the host's controls, and the host's own button", async () => {
    state.auth = { user: signedIn, loading: false };
    state.mintMeeting.mockResolvedValue({ roomUrl: "https://example.test/room", token: "t", title: "Standup", isHost: true });
    open();
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(state.sheet).toMatchObject({ isHost: true, admitKnockers: true, lobbyCta: "Start call" });
  });

  it("offers a guest who hits a closed meeting a way to sign in, not a dead end", async () => {
    state.mintMeeting.mockRejectedValue(new Error("This meeting is for members."));
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    typeName("Ada Guest");
    expect(await screen.findByText("This meeting is for members.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fm1%3Ft%3Dtok");
    expect(state.sheet).toBeNull();
  });

  it("tells the user, and does not fetch anything, when another call is already live", async () => {
    state.auth = { user: signedIn, loading: false };
    state.studioCall = { roomUrl: "https://example.test/other", projectName: "Other", userName: "Ada", sourceId: null };
    open();
    expect(await screen.findByText(/already in a call/)).toBeInTheDocument();
    expect(state.toast).toHaveBeenCalledWith("You're already in a call", expect.anything());
    expect(state.mintMeeting).not.toHaveBeenCalled();
    expect(state.sheet).toBeNull();
  });

  it("takes over its own call when the page is opened again while it is live, without fetching access again", async () => {
    state.auth = { user: signedIn, loading: false };
    state.studioCall = { roomUrl: "https://example.test/room", token: "daily-token", projectName: "Friday casting call", userName: "Ada Lovelace", isHost: false, sourceId: "meet:m1" };
    open();
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(state.mintMeeting).not.toHaveBeenCalled();
    expect(state.sheet).toMatchObject({ open: true, roomUrl: "https://example.test/room", token: "daily-token", sourceId: "meet:m1", userName: "Ada Lovelace" });
    expect(state.toast).not.toHaveBeenCalled();
  });

  it("when the call closes says so, and Rejoin fetches access again", async () => {
    state.auth = { user: signedIn, loading: false };
    open();
    await waitFor(() => expect(state.sheet).not.toBeNull());
    act(() => state.sheet!.onOpenChange(false));
    expect(await screen.findByText("You're not in the call")).toBeInTheDocument();
    expect(screen.queryByTestId("call-sheet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rejoin" }));
    await waitFor(() => expect(state.mintMeeting).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("call-sheet")).toBeInTheDocument());
  });

  it("owns no call of its own: no frame, no toolbar", async () => {
    state.auth = { user: signedIn, loading: false };
    const { container } = open();
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(container.querySelector("iframe, [role=toolbar], .k-call-header, .k-call-footer")).toBeNull();
  });
});

describe("/call/:token", () => {
  const open = () => renderAt("/call/abc", "/call/:token", <GuestCall />);

  it("asks before the name step, and the name step follows the guest option", () => {
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).toBeNull();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("starts a signed-in person at the name step with their name filled in", () => {
    state.auth = { user: signedIn, loading: false };
    open();
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
    expect(screen.getByLabelText("Your name")).toHaveValue("Ada Lovelace");
  });

  it("redeems the link for the typed name, then starts the one call with it", async () => {
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    typeName("Grace Hopper");
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(state.redeem).toHaveBeenCalledWith("abc", "Grace Hopper");
    expect(state.sheet).toMatchObject({ open: true, roomUrl: "https://example.test/guest-room", token: "guest-token", userName: "Grace Hopper", lobbyCta: "Join call", sourceId: "guest:abc" });
  });

  it("says plainly when the link cannot be used, and lets the person try again", async () => {
    state.redeem.mockRejectedValueOnce(new Error("Link expired"));
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    typeName("Grace Hopper");
    expect(await screen.findByText("Link expired")).toBeInTheDocument();
    expect(state.sheet).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("after the call: you left, and it is safe to close the tab", async () => {
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    typeName("Grace Hopper");
    await waitFor(() => expect(state.sheet).not.toBeNull());
    act(() => state.sheet!.onOpenChange(false));
    expect(await screen.findByText("You left the call")).toBeInTheDocument();
    expect(screen.getByText("It's safe to close this tab.")).toBeInTheDocument();
  });

  it("does not redeem anything, and says so, when another call is already live", async () => {
    state.studioCall = { roomUrl: "https://example.test/other", projectName: "Other", userName: "Ada", sourceId: null };
    state.auth = { user: signedIn, loading: false };
    open();
    expect(await screen.findByText(/already in a call/)).toBeInTheDocument();
    expect(state.toast).toHaveBeenCalledWith("You're already in a call", expect.anything());
    expect(state.redeem).not.toHaveBeenCalled();
  });

  it("owns no call of its own: no frame, no toolbar, no second row of controls", async () => {
    const { container } = open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    typeName("Grace Hopper");
    await waitFor(() => expect(state.sheet).not.toBeNull());
    expect(container.querySelector("iframe, [role=toolbar], .k-call-header, .k-call-footer, .k-call-controls")).toBeNull();
  });
});

describe("/join/:code", () => {
  const open = (code = "abc123") => renderAt(`/join/${code}`, "/join/:code", <JoinWithCode />);

  it("shows the choice instead of redirecting straight to sign-in, and keeps the code for this session", () => {
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    expect(screen.queryByText("auth page")).toBeNull();
    expect(window.sessionStorage.getItem("invite_code")).toBe("ABC123");
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth");
  });

  it("lets a guest look around, with the invite code still held for a later sign-up", () => {
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByText("home page")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("invite_code")).toBe("ABC123");
  });

  it("stores a partner code as a partner code", () => {
    open("creativett");
    expect(window.sessionStorage.getItem("partner_code")).toBe("CREATIVETT");
    expect(window.sessionStorage.getItem("invite_code")).toBeNull();
  });

  it("sends a signed-in person on to /auth as before", async () => {
    state.auth = { user: signedIn, loading: false };
    open();
    await waitFor(() => expect(screen.getByText("auth page")).toBeInTheDocument());
  });
});

describe("/accept-invite/:projectId", () => {
  const open = (query = "?email=ada%40example.com&t=sec") => renderAt(`/accept-invite/p1${query}`, "/accept-invite/:projectId", <AcceptInvite />);

  it("asks first, and mints no guest preview until the guest option is taken", async () => {
    state.mint.mockResolvedValue("guest-token");
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    await Promise.resolve();
    expect(state.mint).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("entry-guest"));
    await waitFor(() => expect(screen.getByText("guest workspace")).toBeInTheDocument());
    expect(state.mint).toHaveBeenCalledWith(expect.anything(), "p1", "ada@example.com", "sec");
  });

  it("explains a guest preview that cannot be opened and offers sign-in, rather than sending the guest away silently", async () => {
    state.mint.mockResolvedValue(null);
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    await waitFor(() => expect(screen.getByText("We couldn't open a guest preview")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toContain("/auth?redirect=");
  });

  it("keeps sending an in-app invitation (no email in the link) to sign-in, since only that account can open it", async () => {
    open("");
    await waitFor(() => expect(screen.getByText("auth page")).toBeInTheDocument());
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
  });
});

describe("/:handle/room", () => {
  const open = () => renderAt("/@grace/room", "/:handle/room", <PersonalRoom />);

  it("asks before the knock form, then shows the form to a guest", async () => {
    state.row = { user_id: "owner", full_name: "Grace Hopper", avatar_url: null, username: "grace" };
    open();
    await waitFor(() => expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument());
    expect(screen.queryByPlaceholderText(/name/i)).toBeNull();
    fireEvent.click(screen.getByTestId("entry-guest"));
    await waitFor(() => expect(screen.getAllByPlaceholderText(/name/i).length).toBeGreaterThan(0));
  });
});
