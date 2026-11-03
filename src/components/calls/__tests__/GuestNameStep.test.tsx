import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { GuestNameStep } from "../GuestNameStep";

const renderStep = (props: Partial<React.ComponentProps<typeof GuestNameStep>> = {}) => {
  const onSubmit = vi.fn();
  render(<MemoryRouter><GuestNameStep title="Join this meeting" hint="This is the name the others will see." cta="Continue" onSubmit={onSubmit} {...props} /></MemoryRouter>);
  return { onSubmit };
};
const field = () => screen.getByLabelText("Your name") as HTMLInputElement;
const submitButton = () => screen.getByRole("button", { name: "Continue" });

describe("GuestNameStep", () => {
  it("asks for a name and nothing else, and says what it is for", () => {
    renderStep();
    expect(screen.getByRole("heading", { level: 1, name: "Join this meeting" })).toBeInTheDocument();
    expect(screen.getByText("This is the name the others will see.")).toBeInTheDocument();
    expect(field()).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.activeElement).toBe(field());
  });

  it("does not go on without a name, not even a blank one", () => {
    const { onSubmit } = renderStep();
    expect(submitButton()).toBeDisabled();
    fireEvent.change(field(), { target: { value: "   " } });
    expect(submitButton()).toBeDisabled();
    fireEvent.submit(field().closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("goes on with the name trimmed, by the button or by Enter", () => {
    const { onSubmit } = renderStep();
    fireEvent.change(field(), { target: { value: "  Ada Guest  " } });
    fireEvent.click(submitButton());
    expect(onSubmit).toHaveBeenCalledWith("Ada Guest");
    fireEvent.submit(field().closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("starts from a known name, which can still be changed", () => {
    renderStep({ initialName: "Ada Lovelace" });
    expect(field().value).toBe("Ada Lovelace");
    expect(submitButton()).toBeEnabled();
  });

  it("does not submit twice while the access is being fetched", () => {
    const { onSubmit } = renderStep({ initialName: "Ada", busy: true });
    expect(submitButton()).toBeDisabled();
    fireEvent.submit(field().closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("limits the name's length", () => {
    renderStep();
    expect(field().maxLength).toBe(60);
  });
});
