// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Badge } from "./Badge.tsx";

afterEach(cleanup);

describe("Badge", () => {
  it("renders neutral tone by default", () => {
    render(<Badge>New</Badge>);
    const badge = screen.getByText("New");
    expect(badge.className).toContain("bg-bg-subtle");
    expect(badge.className).toContain("text-text-md");
  });

  it("applies the stop tone for overnight markers", () => {
    render(<Badge tone="stop">NIGHT</Badge>);
    const badge = screen.getByText("NIGHT");
    expect(badge.className).toContain("bg-stop-bg");
    expect(badge.className).toContain("text-stop");
  });
});
