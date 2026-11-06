import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

let availability = "ready";
const invoke = vi.fn();
const me = { id: "me" };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: me }) }));
vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ availability, isSubscribed: true, loading: false, subscribe: vi.fn(), unsubscribe: vi.fn() }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock("@/components/profile/PushNotificationsInfo", () => ({ PushNotificationsInfo: () => null }));

import { NotificationSettings } from "../NotificationSettings";

const renderIt = () => render(<MemoryRouter><NotificationSettings /></MemoryRouter>);

describe("NotificationSettings: send yourself a test", () => {
  beforeEach(() => {
    availability = "ready";
    invoke.mockReset();
  });

  it("offers the test where notifications can be used, and says what an accepted test does not prove", async () => {
    invoke.mockResolvedValue({ data: { success: true, sent: 1, total: 1, removed: 0 }, error: null });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Send a test notification" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/not the same as your device showing it/);
    expect(invoke).toHaveBeenCalledWith("send-push-notification", expect.objectContaining({ body: expect.objectContaining({ userId: "me" }) }));
  });

  it("pauses the button after a send, so a second tap cannot stack tests", async () => {
    invoke.mockResolvedValue({ data: { success: true, sent: 1, total: 1 }, error: null });
    renderIt();
    const button = screen.getByRole("button", { name: "Send a test notification" });
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(button).toBeDisabled();
  });

  it("reports a failure in words, not as a success", async () => {
    invoke.mockResolvedValue({ data: { success: false, message: "No subscriptions" }, error: null });
    renderIt();
    fireEvent.click(screen.getByRole("button", { name: "Send a test notification" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/No device is registered/);
  });

  it("is not offered where notifications cannot be used at all", () => {
    availability = "install";
    renderIt();
    expect(screen.queryByRole("button", { name: "Send a test notification" })).not.toBeInTheDocument();
  });
});
