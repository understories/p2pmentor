import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server setup for E2E tests
 *
 * This server intercepts HTTP requests during E2E tests and returns
 * mocked responses instead of hitting real APIs.
 */

export const server = setupServer(...handlers);
