/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "./Button.tsx";
import { Input } from "./Input.tsx";
import { Card } from "./Card.tsx";

afterEach(cleanup);

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeDefined();
  });

  it("applies primary variant by default", () => {
    render(<Button>Test</Button>);
    expect(screen.getByRole("button").className).toContain("bg-blue-600");
  });

  it("applies secondary variant", () => {
    render(<Button variant="secondary">Test</Button>);
    expect(screen.getByRole("button").className).toContain("bg-gray-100");
  });

  it("applies ghost variant", () => {
    render(<Button variant="ghost">Test</Button>);
    expect(screen.getByRole("button").className).toContain("text-gray-700");
  });

  it("applies size classes", () => {
    render(<Button size="lg">Test</Button>);
    expect(screen.getByRole("button").className).toContain("px-6");
  });

  it("forwards disabled prop", () => {
    render(<Button disabled>Test</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("Input", () => {
  it("renders with label", () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText("Email")).toBeDefined();
  });

  it("generates id from label", () => {
    render(<Input label="First Name" />);
    expect(screen.getByLabelText("First Name").id).toBe("first-name");
  });

  it("uses provided id over generated one", () => {
    render(<Input label="Email" id="custom-id" />);
    expect(screen.getByLabelText("Email").id).toBe("custom-id");
  });

  it("shows error message", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByText("Required")).toBeDefined();
  });

  it("applies error border class", () => {
    render(<Input label="Email" error="Required" />);
    expect(screen.getByLabelText("Email").className).toContain("border-red-500");
  });

  it("renders without label", () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeDefined();
  });
});

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("applies additional className", () => {
    const { container } = render(<Card className="mt-4">Content</Card>);
    expect(container.firstElementChild?.className).toContain("mt-4");
  });
});
