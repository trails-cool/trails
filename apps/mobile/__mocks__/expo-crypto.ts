export const CryptoDigestAlgorithm = { SHA256: "SHA-256" } as const;
export const CryptoEncoding = { BASE64: "base64" } as const;

export const getRandomBytes = jest.fn((size: number) => new Uint8Array(size));
export const digestStringAsync = jest.fn(async () => "mock-digest");
