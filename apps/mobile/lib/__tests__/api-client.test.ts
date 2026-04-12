import { ApiError, NetworkError } from "../api-client";

describe("ApiError", () => {
  it("has status, code, and message", () => {
    const err = new ApiError(404, "NOT_FOUND", "Route not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Route not found");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("NetworkError", () => {
  it("has default message", () => {
    const err = new NetworkError();
    expect(err.message).toBe("Network request failed");
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts custom message", () => {
    const err = new NetworkError("Timeout");
    expect(err.message).toBe("Timeout");
  });
});
