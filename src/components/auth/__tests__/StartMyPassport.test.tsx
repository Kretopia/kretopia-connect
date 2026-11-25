import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** /start is the one direct way to create a Passport: account options first, the destination kept, a member straight to their Passport. */
const auth = vi.hoisted(() => ({ user: null as null | { id: string }, loading: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));

import { StartMyPassport } from "../StartMyPassport";

function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; }
const open = (url: string) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/start" element={<StartMyPassport />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);
const target = () => new URL(`https://x.test${screen.getByTestId("where").textContent}`);

beforeEach(() => { auth.user = null; auth.loading = false; });

describe("/start", () => {
  it("a signed-out visitor goes straight to the sign-up page on the account options, bound for their Passport", () => {
    open("/start");
    const url = target();
    expect(url.pathname).toBe("/auth");
    expect(url.searchParams.get("tab")).toBe("signup");
    expect(url.searchParams.get("mode")).toBe("classic");
    expect(url.searchParams.get("next")).toBe("/profile");
    expect(url.searchParams.get("src")).toBe("start");
  });

  it("keeps where the visitor was heading, an invitation and the entry they came from", () => {
    open("/start?next=%2Fcosign%2Ftok_1&invite=ABC123&src=passport_directory");
    const url = target();
    expect(url.searchParams.get("next")).toBe("/cosign/tok_1");
    expect(url.searchParams.get("invite")).toBe("ABC123");
    expect(url.searchParams.get("src")).toBe("passport_directory");
  });

  it("never sends the visitor outside the app", () => {
    const first = open("/start?next=https%3A%2F%2Fevil.example");
    expect(target().searchParams.get("next")).toBe("/profile");
    first.unmount();
    open("/start?next=%2F%2Fevil.example");
    expect(target().searchParams.get("next")).toBe("/profile");
  });

  it("a member goes straight to their Passport", () => {
    auth.user = { id: "u1" };
    open("/start");
    expect(screen.getByTestId("where")).toHaveTextContent("/profile");
  });

  it("while the session loads, nothing is decided", () => {
    auth.loading = true;
    open("/start");
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });
});
