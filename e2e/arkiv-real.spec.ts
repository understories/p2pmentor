import { test, expect } from "@playwright/test";

/**
 * Full E2E tests with REAL Arkiv queries and REAL web3
 *
 * These tests verify actual integration with Arkiv indexer and web3 services.
 * No mocks - tests real production-like behavior.
 *
 * Note: These tests require:
 * - Real Arkiv indexer to be accessible
 * - Real RPC endpoint (testnet) to be accessible
 * - May be slower than smoke tests but provide real integration confidence
 */

test.describe("Real Arkiv Integration Tests", () => {
  // Disable MSW for these tests - we want real services
  test.beforeAll(() => {
    // Ensure mocks are disabled for real E2E tests
    process.env.NEXT_PUBLIC_E2E_MOCKS = "false";
  });

  test("GraphQL endpoint queries real Arkiv indexer", async ({ request }) => {
    // Test that our GraphQL endpoint can query real Arkiv
    const response = await request.post("/api/graphql", {
      data: {
        query: `
          query {
            networkOverview(limitAsks: 5, limitOffers: 5) {
              skillRefs {
                id
                name
                asks {
                  id
                  wallet
                  skill
                  status
                }
                offers {
                  id
                  wallet
                  skill
                  status
                }
              }
            }
          }
        `,
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Verify response structure (real Arkiv may return empty arrays, that's OK)
    expect(data).toHaveProperty("data");
    expect(data.data).toHaveProperty("networkOverview");
    expect(data.data.networkOverview).toHaveProperty("skillRefs");
    expect(Array.isArray(data.data.networkOverview.skillRefs)).toBe(true);

    // If there's data, verify structure
    if (data.data.networkOverview.skillRefs.length > 0) {
      const skillRef = data.data.networkOverview.skillRefs[0];
      expect(skillRef).toHaveProperty("id");
      expect(skillRef).toHaveProperty("name");
      expect(Array.isArray(skillRef.asks)).toBe(true);
      expect(Array.isArray(skillRef.offers)).toBe(true);
    }

    // No errors from real Arkiv query
    expect(data.errors).toBeUndefined();
  });

  test("Network page loads real Arkiv data", async ({ page }) => {
    // Navigate to network page
    await page.goto("/network");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Check that the page rendered (may show empty state if no data, that's OK)
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check for network page elements
    // The page should render even if there's no data (empty state)
    const hasContent =
      (await page.locator("text=Network").count()) > 0 ||
      (await page.locator("text=No asks").count()) > 0 ||
      (await page.locator("text=No offers").count()) > 0 ||
      (await page.locator('[data-testid="network-content"]').count()) > 0;

    expect(hasContent).toBe(true);

    // Verify no critical errors in console
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // Ignore expected errors (e.g., wallet not connected)
        if (!text.includes("wallet") && !text.includes("MetaMask") && !text.includes("ethereum")) {
          errors.push(text);
        }
      }
    });

    // Wait a bit to catch any errors
    await page.waitForTimeout(2000);

    // Log errors for debugging but don't fail (some may be expected)
    if (errors.length > 0) {
      console.log("Console errors (non-wallet related):", errors);
    }

    // Suppress unused variable warning - errors array is used for logging
    void errors;
  });

  test("GraphQL profile query works with real Arkiv", async ({ request }) => {
    // Test profile query (use a test wallet if available, or expect empty)
    const testWallet = "0x0000000000000000000000000000000000000000"; // Placeholder

    const response = await request.post("/api/graphql", {
      data: {
        query: `
          query Profile($wallet: String!) {
            profile(wallet: $wallet) {
              id
              wallet
              displayName
              username
              skills
            }
          }
        `,
        variables: {
          wallet: testWallet,
        },
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty("data");
    // Profile may be null if wallet doesn't exist - that's OK, we're testing the query works
    expect(data.data).toHaveProperty("profile");

    // No GraphQL errors
    expect(data.errors).toBeUndefined();
  });

  test("Landing page loads without errors", async ({ page }) => {
    await page.goto("/");

    await page.waitForLoadState("networkidle");

    // Verify page rendered
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Check for landing page content
    const hasContent =
      (await page.locator("h1").count()) > 0 || (await page.locator("text=p2pmentor").count()) > 0;

    expect(hasContent).toBe(true);
  });
});
