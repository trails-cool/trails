// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProfileStats } from "./ProfileStats.tsx";

afterEach(cleanup);

describe("ProfileStats", () => {
  it("renders nothing when there are no activities", () => {
    const { container } = render(
      <ProfileStats stats={{ count: 0, distance: 0, elevationGain: 0, duration: 0, last4Weeks: 0 }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders formatted totals", () => {
    const { container, getByText } = render(
      <ProfileStats
        stats={{ count: 42, distance: 123_400, elevationGain: 5120, duration: 9000, last4Weeks: 3 }}
      />,
    );
    // Values come from the formatters (i18n-independent).
    expect(getByText("42")).toBeTruthy();
    expect(getByText("123 km")).toBeTruthy(); // >= 100 km → integer
    expect(getByText("↑ 5120 m")).toBeTruthy();
    expect(getByText("2h 30m")).toBeTruthy();
    // last-4-weeks line present when > 0
    expect(container.querySelector("p")).not.toBeNull();
  });

  it("omits the last-4-weeks line when zero", () => {
    const { container } = render(
      <ProfileStats stats={{ count: 5, distance: 1000, elevationGain: 0, duration: 0, last4Weeks: 0 }} />,
    );
    expect(container.querySelector("p")).toBeNull();
  });
});
