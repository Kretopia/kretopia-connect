import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-helmet-async", () => ({ Helmet: () => null }));
vi.mock("@/components/PageTransition", () => ({ PageTransition: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/features/FeaturePageHeader", () => ({ FeaturePageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/scene/MagazineWall", () => ({ MagazineWall: () => <div>magazine</div> }));
vi.mock("@/components/scene/PodcastPlayer", () => ({ PodcastPlayer: () => <div>podcast</div> }));

import Spotlight from "../Spotlight";

describe("Spotlight page: the title is said once", () => {
  it("has the page heading and no repeated 'Everything in Spotlight' panel title", () => {
    render(
      <MemoryRouter>
        <Spotlight />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Spotlight" })).toBeInTheDocument();
    expect(screen.queryByText(/Everything in/i)).toBeNull();
    expect(screen.queryByRole("region", { name: /Everything in Spotlight/i })).toBeNull();
    expect(screen.getByText("magazine")).toBeInTheDocument();
  });
});
