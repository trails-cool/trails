// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { StatRow } from "./StatRow.tsx";

afterEach(cleanup);

describe("StatRow", () => {
  it("renders nothing for an empty item list", () => {
    const { container } = render(<StatRow items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders each item's value and label, in order", () => {
    const { container } = render(
      <StatRow
        items={[
          { label: "Distance", value: "30.0 km" },
          { label: "Time", value: "1h 0m" },
          { label: "Avg speed", value: "30.0 km/h" },
        ]}
      />,
    );
    const labels = [...container.querySelectorAll("dt")].map((el) => el.textContent);
    const values = [...container.querySelectorAll("dd")].map((el) => el.textContent);
    expect(labels).toEqual(["Distance", "Time", "Avg speed"]);
    expect(values).toEqual(["30.0 km", "1h 0m", "30.0 km/h"]);
  });
});
