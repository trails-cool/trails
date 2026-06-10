import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

describe("Jest + React Native Testing Library", () => {
  it("renders a component", async () => {
    // await is a no-op on RNTL v13 but required on v14, where render()
    // returns a Promise
    await render(<Text testID="hello">Hello</Text>);
    expect(screen.getByTestId("hello")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });
});
