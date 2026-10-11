import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const mode = vi.hoisted(() => ({ isBusiness: false, loading: false }));
vi.mock("@/hooks/useAccountTone", () => ({ useAccountTone: () => mode }));
vi.mock("@/pages/WorkHomeSkeleton", () => ({ WorkHomeSkeleton: () => <div>Checking mode</div> }));
vi.mock("@/pages/BrandWorkHome", () => ({ BrandWorkHome: () => <div>Company workspace</div> }));
vi.mock("@/pages/CreatorWorkHome", () => ({ CreatorWorkHome: () => <div>Creator workspace</div> }));
import WorkHome from "../WorkHome";

describe("Studio account routing", () => {
  it("updates Company and Creator Studio when mode changes without remounting the route", () => {
    const { rerender } = render(<WorkHome />);
    expect(screen.getByText("Creator workspace")).toBeInTheDocument();
    mode.isBusiness = true;
    rerender(<WorkHome />);
    expect(screen.getByText("Company workspace")).toBeInTheDocument();
    mode.isBusiness = false;
    rerender(<WorkHome />);
    expect(screen.getByText("Creator workspace")).toBeInTheDocument();
  });
});