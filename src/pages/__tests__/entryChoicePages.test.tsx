import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const state = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email?: string; user_metadata?: Record<string, unknown> }, loading: false },
  call: {} as Record<string, unknown>,
  row: null as unknown,
  mint: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("@/components/SEO", () => ({ SEO: () => null }));
vi.mock("@/contexts/VideoCallContext", () => ({ useVideoCall: () => state.call }));
vi.mock("@/components/calls/CallPreflightGate", () => ({ CallPreflightGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/calls/Greenroom", () => ({ Greenroom: () => <div>greenroom lobby</div> }));
vi.mock("@/components/calls/CallMediaControls", () => ({ CallBrand: () => null, CallMediaControls: () => null }));
vi.mock("@/components/project/VideoCallSheet", () => ({ VideoCallSheet: () => null }));
vi.mock("@/lib/dailyFrame", () => ({ createDailyFrameAsync: vi.fn(), teardownDailyCall: vi.fn() }));
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
  state.call = {
    phase: "lobby",
    error: null,
    title: "Friday casting call",
    isHost: false,
    guestName: "",
    setGuestName: vi.fn(),
    openMeeting: vi.fn(),
    joinLive: vi.fn(),
    reset: vi.fn(),
  };
});

describe("/meet/:meetingId", () => {
  const open = () => renderAt("/meet/m1?t=tok", "/meet/:meetingId", <CallPage />);

  it("opens on the sign-in-or-guest choice, with the lobby behind it", () => {
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    expect(screen.getByText("Friday casting call")).toBeInTheDocument();
    expect(screen.queryByText("greenroom lobby")).toBeNull();
    expect(screen.getByTestId("entry-sign-in")).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fm1%3Ft%3Dtok");
  });

  it("goes on to the lobby once the guest option is taken, without asking again", () => {
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByText("greenroom lobby")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
  });

  it("does not ask a signed-in person", () => {
    state.auth = { user: signedIn, loading: false };
    open();
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
    expect(screen.getByText("greenroom lobby")).toBeInTheDocument();
  });

  it("offers a guest who hits a closed meeting a way to sign in, not a dead end", () => {
    state.call = { ...state.call, phase: "error", error: "This meeting is for members." };
    open();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByText("This meeting is for members.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?redirect=%2Fmeet%2Fm1%3Ft%3Dtok");
  });
});

describe("/call/:token", () => {
  const open = () => renderAt("/call/abc", "/call/:token", <GuestCall />);

  it("asks before the name step, and the name step follows the guest option", () => {
    open();
    expect(screen.getByTestId("guest-entry-choice")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    fireEvent.click(screen.getByTestId("entry-guest"));
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });

  it("starts a signed-in person at the name step with their name filled in", () => {
    state.auth = { user: signedIn, loading: false };
    open();
    expect(screen.queryByTestId("guest-entry-choice")).toBeNull();
    expect(screen.getByPlaceholderText("Your name")).toHaveValue("Ada Lovelace");
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
