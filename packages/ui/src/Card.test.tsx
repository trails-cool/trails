// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Card } from "./Card.tsx";

afterEach(cleanup);

describe("Card", () => {
  it("renders a subtle surface by default", () => {
    render(<Card>body</Card>);
    const card = screen.getByText("body");
    expect(card.className).toContain("bg-bg-subtle");
    expect(card.className).not.toContain("shadow-sm");
  });

  it("renders a raised surface with a shadow when raised", () => {
    render(<Card raised>panel</Card>);
    const card = screen.getByText("panel");
    expect(card.className).toContain("bg-bg-raised");
    expect(card.className).toContain("shadow-sm");
  });
});
