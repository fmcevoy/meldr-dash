import { describe, it, expect } from "vitest";
import { deriveCwdKey } from "../../src/adapters/parse-session.js";

describe("deriveCwdKey", () => {
  it("converts standard Unix absolute path", () => {
    expect(deriveCwdKey("/Users/bob/project")).toBe("-Users-bob-project");
  });

  it("strips trailing slash", () => {
    expect(deriveCwdKey("/Users/bob/project/")).toBe("-Users-bob-project");
  });

  it("strips multiple trailing slashes", () => {
    expect(deriveCwdKey("/path///")).toBe("-path");
  });

  it("handles root path", () => {
    expect(deriveCwdKey("/")).toBe("");
  });

  it("preserves underscores and dots", () => {
    expect(deriveCwdKey("/Users/bob/my_project.v2")).toBe("-Users-bob-my_project.v2");
  });

  it("trailing slash and no trailing slash produce same key", () => {
    expect(deriveCwdKey("/a/b/c")).toBe(deriveCwdKey("/a/b/c/"));
  });
});
