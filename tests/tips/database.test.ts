import { describe, it, expect } from "vitest";
import { techniques, getTechniqueById } from "../../src/tips/database.js";

describe("Technique Database", () => {
  it("contains 30 techniques", () => {
    expect(techniques).toHaveLength(30);
  });

  it("every technique has required fields including kind", () => {
    for (const t of techniques) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(["High", "Medium"]).toContain(t.impact);
      expect(["monitor", "tip"]).toContain(t.kind);
      expect(t.platforms).toBeDefined();
      expect(Array.isArray(t.platforms)).toBe(true);
    }
  });

  it("every technique has a unique id", () => {
    const ids = techniques.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every technique has fix text", () => {
    for (const t of techniques) {
      expect(t.fix, `${t.id} is missing fix text`).toBeTruthy();
    }
  });

  it("looks up by id", () => {
    const t = getTechniqueById("clear-context");
    expect(t).toBeDefined();
    expect(t!.title).toContain("Clear");
  });
});
