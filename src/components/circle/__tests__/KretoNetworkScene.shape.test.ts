import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// KretoNetworkScene builds a real WebGL mascot (Three.js), which jsdom cannot execute (no WebGL context, so the
// component's own try/catch takes the "failed" fallback path instead of running any of the scene-building code).
// The one real perf lever here -- every ball of the mascot's body, and every connection marker, is the identical
// unit sphere (1, 40, 28) scaled per use -- is pinned at the source level instead: one shared geometry, reused by
// every mesh `ball()` creates, rather than a fresh 40x28-segment SphereGeometry allocated per mesh (up to ~26 per
// mount: ~18 body parts plus up to 8 connection markers).
const source = readFileSync(resolve(__dirname, "../KretoNetworkScene.tsx"), "utf8");

describe("KretoNetworkScene: one shared sphere geometry for every ball", () => {
  it("allocates the sphere geometry exactly once per mount", () => {
    const allocations = source.match(/new THREE\.SphereGeometry\(/g) ?? [];
    expect(allocations).toHaveLength(1);
  });

  it("every ball() mesh is built from that one shared geometry, not a fresh one", () => {
    const shared = source.match(/const sphereGeometry = new THREE\.SphereGeometry\(1, 40, 28\);/);
    expect(shared).not.toBeNull();
    const ballBody = source.match(/const ball = \([^)]*\) => \{([^}]*)\};/)?.[1] ?? "";
    expect(ballBody).toContain("new THREE.Mesh(sphereGeometry, material)");
    expect(ballBody).not.toContain("new THREE.SphereGeometry");
  });

  it("the shared geometry still appears before every ball() call, so it exists when the first mesh is built", () => {
    const declaredAt = source.indexOf("const sphereGeometry = new THREE.SphereGeometry(");
    const firstCallAt = source.indexOf("ball(robot,");
    expect(declaredAt).toBeGreaterThan(-1);
    expect(firstCallAt).toBeGreaterThan(declaredAt);
  });
});
