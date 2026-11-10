import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventAttendeeStack } from "../EventAttendeeStack";

const four = [
  { id: "1", name: "Ari" },
  { id: "2", name: "Bea" },
  { id: "3", name: "Cam" },
  { id: "4", name: "Dee" },
];

describe("EventAttendeeStack", () => {
  it("draws round avatars and a +N, and says the count once", () => {
    render(<EventAttendeeStack visible totalCount={6} attendees={four} />);

    expect(screen.getAllByText(/^[ABC]$/)).toHaveLength(3); // three circles, not four
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(screen.getAllByText(/6 going/)).toHaveLength(1);
    expect(screen.getByRole("group", { name: "6 going: Ari, Bea, Cam and 3 more" })).toBeInTheDocument();
  });

  it("announces the overflow in text, not only in a drawing", () => {
    render(<EventAttendeeStack visible totalCount={6} attendees={four} onOpen={() => undefined} />);

    // The accessible label is plain text: the count, who, how many more, and what pressing does.
    expect(screen.getByRole("button", { name: /6 going: Ari, Bea, Cam and 3 more\. View everyone going\./ })).toBeInTheDocument();
    // The "+3" is decoration for the eye: it is hidden from assistive technology so it is not read twice.
    expect(screen.getByText("+3").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("is a button that opens the list, and hands focus back to a ref it was given", () => {
    const onOpen = vi.fn();
    const ref = createRef<HTMLButtonElement>();
    render(<EventAttendeeStack ref={ref} visible totalCount={2} attendees={four.slice(0, 2)} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveAttribute("aria-haspopup", "dialog");
  });

  it("is not a button when nothing opens", () => {
    render(<EventAttendeeStack visible totalCount={2} attendees={four.slice(0, 2)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("2 going")).toBeInTheDocument();
  });

  it("does not reveal avatars when the host hides the guest list", () => {
    const { container } = render(<EventAttendeeStack visible={false} totalCount={4} attendees={[{ id: "1", name: "Ari" }]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("draws nothing for an empty event", () => {
    const { container } = render(<EventAttendeeStack visible totalCount={0} attendees={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
