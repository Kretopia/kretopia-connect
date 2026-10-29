import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EPKDraftField } from "../EPKDraftTopics";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
const data = { profile: { full_name: "Maya", role: "Designer" }, credits: [], awards: [], pressLinks: [], industryStats: [], reviews: [] };
describe("EPK reviewed AI drafts", () => {
  it("does not apply an AI draft until the user accepts it", async () => {
    invoke.mockResolvedValue({ data: { content: "Reviewed biography" }, error: null });
    const change = vi.fn();
    render(<EPKDraftField label="Bio" value="Original biography" onChange={change} data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft Bio with AI" }));
    await waitFor(() => expect(screen.getByLabelText("Bio AI draft")).toHaveValue("Reviewed biography"));
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Bio AI draft"), { target: { value: "My edited biography" } });
    fireEvent.click(screen.getByRole("button", { name: "Use draft" }));
    expect(change).toHaveBeenCalledWith("My edited biography");
  });
  it("keeps existing text when the provider refuses or errors, without retrying", async () => {
    invoke.mockReset().mockResolvedValue({ data: { error: "Access denied" }, error: null });
    const change = vi.fn();
    render(<EPKDraftField label="Bio" value="Original biography" onChange={change} data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Draft Bio with AI" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Access denied"));
    expect(change).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});