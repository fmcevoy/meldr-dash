import { describe, it, expect } from "vitest";
import { itemsPerPage } from "../../src/hooks/use-tips.js";

describe("itemsPerPage", () => {
  it("returns default 3 when height is undefined", () => {
    expect(itemsPerPage(undefined)).toBe(3);
  });

  it("returns default 3 when height is too small", () => {
    expect(itemsPerPage(3)).toBe(3);
    expect(itemsPerPage(0)).toBe(3);
  });

  it("small panels (<=10): 1 line per item, no fix text", () => {
    // height 6: 6-3 = 3 items (fix omitted)
    expect(itemsPerPage(6)).toBe(3);
    // height 10: 10-3 = 7 items
    expect(itemsPerPage(10)).toBe(7);
  });

  it("large panels (>10): 2 lines per item (title + fix)", () => {
    // height 11: (11-3)/2 = 4 items
    expect(itemsPerPage(11)).toBe(4);
    // height 20: (20-3)/2 = 8 items
    expect(itemsPerPage(20)).toBe(8);
  });

  it("returns at least 1 for minimal height", () => {
    expect(itemsPerPage(4)).toBe(1);
    expect(itemsPerPage(5)).toBe(2);
  });
});
