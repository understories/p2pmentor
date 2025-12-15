import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

process.env.NEXT_PUBLIC_ARKIV_API_URL = "https://test.arkiv.network";
// Test setup file - runs before each test file
// Add global mocks and configuration here

import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with Testing Library matchers
// This gives you nice assertions like toBeInTheDocument()
expect.extend(matchers);

// Cleanup after each test (unmount React components)
afterEach(() => {
  cleanup();
});

// Mock Next.js router (commonly needed)
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock environment variables that might be needed
process.env.NEXT_PUBLIC_ARKIV_API_URL = "https://test.arkiv.network";
