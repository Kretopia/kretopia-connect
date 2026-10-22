import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NearbyInline } from "@/components/discover/NearbyInline";

const { mapEngineEvaluated } = vi.hoisted(() => ({ mapEngineEvaluated: vi.fn() }));

// The factory runs when the engine is first imported, so it records exactly when its code would be fetched.
vi.mock("mapbox-gl", () => {
  mapEngineEvaluated();
  class Map {
    addControl() {}
    on() {}
    remove() {}
    flyTo() {}
  }
  class Marker {
    setLngLat() {
      return this;
    }
    setPopup() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class Popup {
    setHTML() {
      return this;
    }
  }
  class NavigationControl {}
  return { default: { accessToken: "", Map, Marker, Popup, NavigationControl } };
});
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn().mockResolvedValue({ data: [] }), from: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

// Taken before any test clears the mock: importing the component must not pull the engine in.
const evaluatedOnImport = mapEngineEvaluated.mock.calls.length;

function renderNearby() {
  return render(
    <MemoryRouter>
      <NearbyInline />
    </MemoryRouter>,
  );
}

describe("NearbyInline map loading", () => {
  beforeEach(() => {
    mapEngineEvaluated.mockClear();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 48.85, longitude: 2.35 } } as GeolocationPosition),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("does not fetch the map engine while there is no location", () => {
    renderNearby();
    expect(screen.getByText("Use my location")).toBeInTheDocument();
    expect(evaluatedOnImport).toBe(0);
    expect(mapEngineEvaluated).not.toHaveBeenCalled();
  });

  it("fetches it once the person shares a location, then shows the map", async () => {
    renderNearby();
    fireEvent.click(screen.getByRole("button", { name: /use my location/i }));
    expect(await screen.findByText(/creators nearby/i)).toBeInTheDocument();
    expect(mapEngineEvaluated).toHaveBeenCalledTimes(1);
  });

  it("keeps the map out of the Discover chunk: it is only ever imported dynamically", () => {
    const source = readFileSync(resolve(__dirname, "../NearbyInline.tsx"), "utf8");
    expect(source).not.toMatch(/^import (?!type)[^;]*from\s+["']@\/components\/nearby\/NearbyCreatorsMap["']/m);
    expect(source).not.toMatch(/^import (?!type)[^;]*from\s+["']mapbox-gl["']/m);
    expect(source).toMatch(/import\("@\/components\/nearby\/NearbyCreatorsMap"\)/);
  });
});
