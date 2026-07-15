// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { IconButton } from "./IconButton.tsx";

afterEach(cleanup);

const Icon = () => <svg data-testid="icon" aria-hidden />;

describe("IconButton", () => {
  it("exposes its label as the accessible name and title", () => {
    render(
      <IconButton label="Undo">
        <Icon />
      </IconButton>,
    );
    const btn = screen.getByRole("button", { name: "Undo" });
    expect(btn).toHaveProperty("title", "Undo");
  });

  it("keeps an explicit title over the label", () => {
    render(
      <IconButton label="Undo" title="Undo (⌘Z)">
        <Icon />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty(
      "title",
      "Undo (⌘Z)",
    );
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Redo" onClick={onClick} disabled>
        <Icon />
      </IconButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
