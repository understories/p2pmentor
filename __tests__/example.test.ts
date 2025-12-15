/// <reference types="vitest" />

describe("Example Test Suite", () => {
  it("adds numbers", () => {
    expect(1 + 1).toBe(2);
  });

  it("checks strings", () => {
    expect("p2pmentor").toContain("mentor");
  });
});
// Example test file - shows how to write tests
// Put your tests in __tests__/ or name them *.test.ts

import { describe, it, expect } from "vitest";

describe("Example Test Suite", () => {
  it("should pass a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should work with strings", () => {
    const greeting = "Hello, p2pmentor!";
    expect(greeting).toContain("p2pmentor");
  });

  it("should work with arrays", () => {
    const skills = ["TypeScript", "React", "Solidity"];
    expect(skills).toHaveLength(3);
    expect(skills).toContain("React");
  });

  it("should work with objects", () => {
    const profile = {
      wallet: "0x1234...",
      displayName: "Alice",
      skills: ["GraphQL", "Next.js"],
    };

    expect(profile).toHaveProperty("wallet");
    expect(profile.skills).toContain("GraphQL");
  });
});

// Example: Testing a utility function
// Uncomment and adapt when you have utils to test

// import { formatWalletAddress } from "@/lib/utils";
//
// describe("formatWalletAddress", () => {
//   it("should truncate long addresses", () => {
//     const full = "0x1234567890abcdef1234567890abcdef12345678";
//     expect(formatWalletAddress(full)).toBe("0x1234...5678");
//   });
// });
