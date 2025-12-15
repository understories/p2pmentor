/**
 * Mock viem transport for E2E testing (placeholder)
 *
 * For E2E tests, MSW intercepts HTTP requests at the network layer,
 * so viem transport mocking may not be necessary. This file documents
 * the approach if direct RPC mocking is needed in the future.
 *
 * When NEXT_PUBLIC_E2E_MOCKS=true, MSW handlers in e2e/mocks/handlers.ts
 * will intercept HTTP requests to RPC endpoints and return mock responses.
 *
 * If direct viem transport mocking is needed, use viem's `custom()` transport
 * with a mock provider object that implements the EIP-1193 interface.
 */

/**
 * Check if E2E mocks should be enabled
 */
export function shouldUseMockTransport(): boolean {
  return process.env.NEXT_PUBLIC_E2E_MOCKS === "true";
}

/**
 * Example: Create a mock EIP-1193 provider for viem custom transport
 *
 * This is a placeholder - implement if direct RPC mocking is needed.
 * Most E2E scenarios can rely on MSW HTTP interception instead.
 */
export function createMockProvider() {
  return {
    request: async ({ method, params }: { method: string; params?: any[] }) => {
      // Mock common RPC methods
      switch (method) {
        case "eth_chainId":
          return "0x1";
        case "eth_blockNumber":
          return "0x123456";
        case "eth_getBalance":
          return "0x1000000000000000000";
        case "eth_accounts":
        case "eth_requestAccounts":
          return ["0x1234567890123456789012345678901234567890"];
        default:
          console.warn(`[MockProvider] Unhandled RPC method: ${method}`);
          return null;
      }
    },
  };
}
