// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Select } from "./Select.tsx";

afterEach(cleanup);

function options() {
  return (
    <>
      <option value="fastbike">Fast bike</option>
      <option value="trekking">Trekking</option>
    </>
  );
}

describe("Select", () => {
  it("renders options and reflects the value", () => {
    render(
      <Select value="trekking" onChange={() => {}} aria-label="Profile">
        {options()}
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "Profile" });
    expect((select as HTMLSelectElement).value).toBe("trekking");
    expect(select.className).toContain("border-border");
  });

  it("fires onChange with the selected value", () => {
    const onChange = vi.fn();
    render(
      <Select value="fastbike" onChange={onChange} aria-label="Profile">
        {options()}
      </Select>,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Profile" }), {
      target: { value: "trekking" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("applies the compact size classes", () => {
    render(
      <Select size="sm" aria-label="Profile">
        {options()}
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Profile" }).className).toContain(
      "h-7",
    );
  });
});
