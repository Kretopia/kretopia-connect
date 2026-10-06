import { describe, expect, it } from "vitest";
import { acceptInvitation } from "../acceptInvitation";

const withInvoke = (result: any) => ({ functions: { invoke: async () => result } });

describe("acceptInvitation (server-side claim)", () => {
  it("reports success and already-a-member from the server", async () => {
    expect(await acceptInvitation(withInvoke({ data: { status: "accepted" }, error: null }), "p1")).toEqual({
      ok: true,
      status: "accepted",
    });
    expect(await acceptInvitation(withInvoke({ data: { status: "already_member" }, error: null }), "p1")).toEqual({
      ok: true,
      status: "already_member",
    });
  });

  it("asks the server for exactly this project", async () => {
    const calls: any[] = [];
    const client = { functions: { invoke: async (name: string, opts: any) => (calls.push([name, opts]), { data: { status: "accepted" }, error: null }) } };
    await acceptInvitation(client, "p1");
    expect(calls).toEqual([["accept-project-invitation", { body: { projectId: "p1" } }]]);
  });

  it("surfaces the server's reason from a non-2xx answer", async () => {
    const error = {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => ({ code: "email_not_confirmed", error: "Confirm your email address first." }) },
    };
    expect(await acceptInvitation(withInvoke({ data: null, error }), "p1")).toEqual({
      ok: false,
      code: "email_not_confirmed",
      message: "Confirm your email address first.",
    });
  });

  it("says 'unavailable' (so the caller can fall back) when the service can't be reached", async () => {
    const down = { message: "Failed to send a request to the Edge Function" };
    expect(await acceptInvitation(withInvoke({ data: null, error: down }), "p1")).toMatchObject({
      ok: false,
      code: "unavailable",
    });
    const throwing = {
      functions: {
        invoke: async () => {
          throw new Error("offline");
        },
      },
    };
    expect(await acceptInvitation(throwing, "p1")).toMatchObject({ ok: false, code: "unavailable", message: "offline" });
  });

  it("does not report success for an unexpected answer", async () => {
    expect(await acceptInvitation(withInvoke({ data: { status: "???" }, error: null }), "p1")).toMatchObject({ ok: false });
  });
});
