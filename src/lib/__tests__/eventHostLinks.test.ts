import { describe, expect, it } from "vitest";
import { hostContactLinks } from "@/lib/eventHostLinks";

describe("the host's public channels", () => {
  it("turns a handle into the platform's link, not into a host name", () => {
    expect(hostContactLinks({ instagram_url: "@mayasantos" })).toEqual([{ label: "Instagram", url: "https://instagram.com/mayasantos" }]);
    expect(hostContactLinks({ instagram_url: "mayasantos" })).toEqual([{ label: "Instagram", url: "https://instagram.com/mayasantos" }]);
  });

  it("keeps a full address, and adds https to a bare domain", () => {
    expect(hostContactLinks({ website_url: "https://maya.example/work" })).toEqual([{ label: "Website", url: "https://maya.example/work" }]);
    expect(hostContactLinks({ website_url: "maya.example" })).toEqual([{ label: "Website", url: "https://maya.example/" }]);
    expect(hostContactLinks({ linkedin_url: "linkedin.com/in/maya" })).toEqual([{ label: "LinkedIn", url: "https://linkedin.com/in/maya" }]);
  });

  it("exposes only http(s) links the host shared: never a script, a phone number or an email", () => {
    expect(hostContactLinks({ website_url: "javascript:alert(1)", instagram_url: "tel:+33123456789" })).toEqual([]);
    expect(hostContactLinks({ website_url: "mailto:maya@example.com" })).toEqual([]);
    expect(hostContactLinks({ spotify_url: "two words" })).toEqual([]);
    expect(hostContactLinks(null)).toEqual([]);
    expect(hostContactLinks({})).toEqual([]);
  });
});
