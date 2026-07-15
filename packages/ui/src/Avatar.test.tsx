// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Avatar } from "./Avatar.tsx";

afterEach(cleanup);

describe("Avatar", () => {
  it("shows the uppercased first initial and the name as accessible label", () => {
    render(<Avatar name="ulle" />);
    const el = screen.getByLabelText("ulle");
    expect(el.textContent).toBe("U");
  });

  it("applies a per-user color as the background", () => {
    render(<Avatar name="Mara" color="rgb(74, 107, 64)" />);
    const el = screen.getByLabelText("Mara");
    expect(el.style.backgroundColor).toBe("rgb(74, 107, 64)");
    expect(el.className).not.toContain("bg-accent");
  });

  it("falls back to the accent token when no color is given", () => {
    render(<Avatar name="Sam" />);
    expect(screen.getByLabelText("Sam").className).toContain("bg-accent");
  });

  it("renders a placeholder initial for a blank name", () => {
    render(<Avatar name="  " />);
    expect(screen.getByText("?").textContent).toBe("?");
  });
});
