// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Button } from "./Button.tsx";

afterEach(cleanup);

describe("Button", () => {
  it("renders its children and defaults to type=button", () => {
    render(<Button>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toHaveProperty("type", "button");
  });

  it("applies the primary variant token classes by default", () => {
    render(<Button>Go</Button>);
    const btn = screen.getByRole("button", { name: "Go" });
    expect(btn.className).toContain("bg-accent");
    expect(btn.className).toContain("text-text-inv");
  });

  it("switches variant and size classes", () => {
    render(
      <Button variant="ghost" size="sm">
        Cancel
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Cancel" });
    expect(btn.className).toContain("text-text-md");
    expect(btn.className).toContain("h-7");
    expect(btn.className).not.toContain("bg-accent");
  });

  it("merges a caller className without dropping base classes", () => {
    render(<Button className="w-full">Wide</Button>);
    const btn = screen.getByRole("button", { name: "Wide" });
    expect(btn.className).toContain("w-full");
    expect(btn.className).toContain("rounded-md");
  });

  it("fires onClick and blocks it when disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Tap</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Tap" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} disabled>
        Tap
      </Button>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tap" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
