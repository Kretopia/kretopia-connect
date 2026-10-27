import { describe, expect, it } from "vitest";
import { rollup } from "rollup";
import { vendorChunk } from "../../../plugins/vendor-chunks";

describe("vendor startup dependencies", () => {
  it("keeps React's shared interop helper with React, outside its consumers", () => {
    expect(vendorChunk("\0commonjsHelpers.js")).toBe("react-vendor");
    expect(vendorChunk("/node_modules/react/index.js")).toBe("react-vendor");
    expect(vendorChunk("/node_modules/react-i18next/dist/index.js")).toBe("i18n-vendor");
    expect(vendorChunk("/node_modules/framer-motion/dist/index.js")).toBe("motion-vendor");
  });

  it("emits a foundational React chunk without a dependency on i18n", async () => {
    const helper = "\0commonjsHelpers.js";
    const react = "/node_modules/react/index.js";
    const i18n = "/node_modules/react-i18next/index.js";
    const modules: Record<string, string> = {
      entry: `import { context } from '${i18n}'; console.log(context);`,
      [helper]: "export function unwrap(value) { return value.default || value; }",
      [react]: `import { unwrap } from '${helper}'; export const React = unwrap({default: {createContext: () => ({})}});`,
      [i18n]: `import { React } from '${react}'; import { unwrap } from '${helper}'; export const context = React.createContext(unwrap({}));`,
    };
    const bundle = await rollup({
      input: "entry",
      plugins: [{ name: "startup-fixture", resolveId: id => id in modules ? id : null, load: id => modules[id] }],
    });
    try {
      const { output } = await bundle.generate({ format: "es", manualChunks: vendorChunk });
      const reactOutput = output.find(chunk => chunk.type === "chunk" && chunk.name === "react-vendor");
      expect(reactOutput?.type).toBe("chunk");
      if (reactOutput?.type !== "chunk") throw new Error("Missing React chunk");
      expect(reactOutput.imports).toEqual([]);
      expect(Object.keys(reactOutput.modules)).toContain(helper);
      const consumer = output.find(chunk => chunk.type === "chunk" && chunk.name === "i18n-vendor");
      if (consumer?.type !== "chunk") throw new Error("Missing i18n chunk");
      expect(consumer.imports).toContain(reactOutput.fileName);
    } finally {
      await bundle.close();
    }
  });
});