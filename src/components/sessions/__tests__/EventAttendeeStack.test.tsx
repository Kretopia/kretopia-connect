import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventAttendeeStack } from "../EventAttendeeStack";

describe("EventAttendeeStack", () => {
  it("shows a compact avatar stack with the accurate overflow count", () => {
    render(
      <EventAttendeeStack
        visible
        totalCount={6}
        attendees={[
          { id: "1", name: "Ari" },
          { id: "2", name: "Bea" },
          { id: "3", name: "Cam" },
          { id: "4", name: "Dee" },
        ]}
      />,
    );

    expect(screen.getByRole("group", { name: "6 attendees going" })).toBeInTheDocument();
    expect(screen.getByLabelText("3 more attendees")).toHaveTextContent("+3");
    expect(screen.getAllByText(/^[ABC]$/)).toHaveLength(3);
  });

  it("does not reveal avatars when the host hides the guest list", () => {
    const { container } = render(<EventAttendeeStack visible={false} totalCount={4} attendees={[{ id: "1", name: "Ari" }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
