import { describe, expect, it } from "vitest";
import { getPluginRegistry } from "../src/lib/plugins.js";

describe("plugin registry (apps/web)", () => {
  it("registers all five v1 plugins", () => {
    const reg = getPluginRegistry();
    const names = reg.list().map((p) => p.name).sort();
    expect(names).toEqual([
      "@learning-platform/plugin-auth",
      "@learning-platform/plugin-catalog",
      "@learning-platform/plugin-credentials",
      "@learning-platform/plugin-learning",
      "@learning-platform/plugin-localization",
    ]);
  });

  it("returns the same registry on repeated calls", () => {
    expect(getPluginRegistry()).toBe(getPluginRegistry());
  });
});
