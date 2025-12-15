import { http, HttpResponse } from "msw";

/**
 * MSW handlers for E2E test mocking
 *
 * Mocks external HTTP/GraphQL endpoints to keep tests deterministic
 * and free-tier friendly (no real API calls).
 */

// Mock GraphQL endpoint responses
export const handlers = [
  // Mock Arkiv GraphQL endpoint
  http.post("/api/graphql", async ({ request }) => {
    const body = await request.json();
    const { query, variables } = body as { query: string; variables?: Record<string, any> };

    // Mock networkOverview query
    if (query.includes("networkOverview")) {
      return HttpResponse.json({
        data: {
          networkOverview: {
            skillRefs: [
              {
                id: "skill:typescript",
                name: "typescript",
                asks: [
                  {
                    id: "ask:1",
                    wallet: "0x1234567890123456789012345678901234567890",
                    skill: "typescript",
                    status: "open",
                    createdAt: "2024-01-01T00:00:00Z",
                  },
                ],
                offers: [
                  {
                    id: "offer:1",
                    wallet: "0x0987654321098765432109876543210987654321",
                    skill: "typescript",
                    isPaid: false,
                    status: "active",
                    createdAt: "2024-01-01T00:00:00Z",
                  },
                ],
              },
            ],
          },
        },
      });
    }

    // Mock profile query
    if (query.includes("profile")) {
      return HttpResponse.json({
        data: {
          profile: {
            id: "profile:test",
            wallet: variables?.wallet || "0x1234567890123456789012345678901234567890",
            displayName: "Test User",
            username: "testuser",
            bio: "Test bio",
            skills: [],
            asks: [],
            offers: [],
          },
        },
      });
    }

    // Default: return empty response
    return HttpResponse.json({
      data: {},
    });
  }),

  // Mock any other external HTTP APIs if needed
  // Example: http.get("/api/external-service", () => HttpResponse.json({ ... }))
];
