// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Input } from "./Input.tsx";

afterEach(cleanup);

describe("Input", () => {
  it("defaults to type=text and forwards placeholder", () => {
    render(<Input placeholder="Route name" />);
    const input = screen.getByPlaceholderText("Route name");
    expect(input).toHaveProperty("type", "text");
    expect(input.className).toContain("border-border");
  });

  it("is controllable and forwards value changes", () => {
    const values: string[] = [];
    render(
      <Input value="" onChange={(e) => values.push(e.currentTarget.value)} />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Alps" },
    });
    expect(values).toEqual(["Alps"]);
  });
});
