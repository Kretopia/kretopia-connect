import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { StudioCreatedAcknowledgement } from "../StudioCreatedAcknowledgement";

/**
 * KRETO_NEW_ROOM_STATE_MAPPING_AUDIT.md's approved success design: the
 * acknowledgement is real route `state` (not a query param -- never
 * bookmarkable, shareable or hand-typeable), server-confirmed by
 * construction (only VoiceFirstCreateModal's real createProject() success
 * path ever sets it), and shown exactly once.
 */

// A tiny probe so a test can assert on the *current* location.state after
// StudioCreatedAcknowledgement's own effect has replaced it.
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-state">{JSON.stringify(location.state)}</span>;
}

function renderAt(initialState: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/desk/proj-1", state: initialState }]}>
      <Routes>
        <Route
          path="/desk/:projectId"
          element={
            <>
              <StudioCreatedAcknowledgement />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("StudioCreatedAcknowledgement", () => {
  it("shows nothing on an ordinary visit with no creation flag", () => {
    renderAt(null);
    expect(screen.queryByText("Your Studio is ready.")).not.toBeInTheDocument();
  });

  it("shows the acknowledgement when arriving with a real kretoJustCreated flag", () => {
    renderAt({ kretoJustCreated: true });
    expect(screen.getByText("Your Studio is ready.")).toBeInTheDocument();
    expect(screen.getByText(/Kreto set up a starting structure/)).toBeInTheDocument();
  });

  it("announces itself as a live region rather than relying on visual appearance alone", () => {
    renderAt({ kretoJustCreated: true });
    expect(screen.getByRole("status")).toHaveTextContent("Your Studio is ready.");
  });

  it("strips the flag from route state immediately, so a refresh of this same entry never re-shows it", () => {
    renderAt({ kretoJustCreated: true });
    expect(screen.getByText("Your Studio is ready.")).toBeInTheDocument();
    // The probe reflects the *current* location.state, which the
    // component's own effect replaces with {} right after mount.
    expect(screen.getByTestId("location-state")).toHaveTextContent("{}");
  });

  it("is dismissible", () => {
    renderAt({ kretoJustCreated: true });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(screen.queryByText("Your Studio is ready.")).not.toBeInTheDocument();
  });

  it("never shows for a flag that isn't the exact real value (not a boolean true)", () => {
    renderAt({ kretoJustCreated: "true" });
    expect(screen.queryByText("Your Studio is ready.")).not.toBeInTheDocument();
  });
});
