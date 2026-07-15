// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl.tsx";

afterEach(cleanup);

const OPTIONS = [
  { value: "plain", label: "Plain" },
  { value: "elevation", label: "Elevation" },
  { value: "surface", label: "Surface" },
] as const;

describe("SegmentedControl", () => {
  it("marks the selected option as checked", () => {
    render(
      <SegmentedControl options={OPTIONS} value="elevation" onChange={() => {}} />,
    );
    expect(screen.getByRole("radio", { name: "Elevation" })).toHaveProperty(
      "ariaChecked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Plain" })).toHaveProperty(
      "ariaChecked",
      "false",
    );
  });

  it("calls onChange with the clicked option's value", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={OPTIONS} value="plain" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Surface" }));
    expect(onChange).toHaveBeenCalledWith("surface");
  });

  it("renders a labelled radiogroup", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="plain"
        onChange={() => {}}
        label="Colour mode"
      />,
    );
    expect(screen.getByRole("radiogroup", { name: "Colour mode" })).toBeTruthy();
  });
});
