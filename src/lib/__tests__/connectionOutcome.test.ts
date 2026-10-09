import { describe, expect, it } from "vitest";
import { connectionStateWith, type ConnectionsClient } from "../connectionOutcome";

const client = (rows: Array<{ status: string | null }> | null, error: { message: string } | null = null) => {
  let filter = "";
  const c: ConnectionsClient = {
    from: () => {
      const q: any = {
        select: () => q,
        or: async (f: string) => {
          filter = f;
          return { data: rows, error };
        },
      };
      return q;
    },
  };
  return { c, filter: () => filter };
};

describe("connectionStateWith", () => {
  it("asks for both directions between the two people", async () => {
    const { c, filter } = client([]);
    await connectionStateWith(c, "me", "you");
    expect(filter()).toBe("and(user_id.eq.me,connected_user_id.eq.you),and(user_id.eq.you,connected_user_id.eq.me)");
  });

  it("accepted wins over pending; pending when only a request exists; none otherwise", async () => {
    expect(await connectionStateWith(client([{ status: "pending" }, { status: "accepted" }]).c, "a", "b")).toBe("accepted");
    expect(await connectionStateWith(client([{ status: "pending" }]).c, "a", "b")).toBe("pending");
    expect(await connectionStateWith(client([]).c, "a", "b")).toBe("none");
    expect(await connectionStateWith(client(null).c, "a", "b")).toBe("none");
    expect(await connectionStateWith(client([{ status: "declined" }]).c, "a", "b")).toBe("none");
  });

  it("never claims a connection it could not read", async () => {
    expect(await connectionStateWith(client(null, { message: "boom" }).c, "a", "b")).toBe("none");
  });
});
