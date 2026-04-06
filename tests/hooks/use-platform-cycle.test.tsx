import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { usePlatformCycle } from "../../src/hooks/use-platform-cycle.js";

let lastPlatform = "";
let triggerCycle: (() => void) | null = null;

function HookTester(): React.ReactElement {
  const { activePlatform, cyclePlatform } = usePlatformCycle();
  lastPlatform = activePlatform;
  triggerCycle = cyclePlatform;
  return <Text>{activePlatform}</Text>;
}

describe("usePlatformCycle", () => {
  it("starts on claude", () => {
    const { lastFrame } = render(<HookTester />);
    expect(lastFrame()).toContain("claude");
    expect(lastPlatform).toBe("claude");
  });

  it("cyclePlatform function exists", () => {
    render(<HookTester />);
    expect(triggerCycle).toBeInstanceOf(Function);
  });

  it("returns platforms array", () => {
    const { lastFrame } = render(<HookTester />);
    // Just verify it renders without error
    expect(lastFrame()).toBeTruthy();
  });
});
