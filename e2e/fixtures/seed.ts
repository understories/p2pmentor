/**
 * Deterministic seed data for E2E tests
 *
 * Creates minimal test data for predictable E2E test scenarios.
 * Guarded behind E2E_SEED=true env var (no secrets).
 *
 * This is a placeholder - actual seeding would call Arkiv API routes
 * or use existing seed scripts with E2E-specific data.
 */

export const E2E_TEST_DATA = {
  profiles: [
    {
      wallet: "0x1234567890123456789012345678901234567890",
      displayName: "Test Mentor",
      username: "testmentor",
      skills: ["typescript", "react"],
    },
    {
      wallet: "0x0987654321098765432109876543210987654321",
      displayName: "Test Learner",
      username: "testlearner",
      skills: [],
    },
  ],
  asks: [
    {
      id: "ask:1",
      wallet: "0x0987654321098765432109876543210987654321",
      skill: "typescript",
      status: "open",
    },
  ],
  offers: [
    {
      id: "offer:1",
      wallet: "0x1234567890123456789012345678901234567890",
      skill: "typescript",
      isPaid: false,
      status: "active",
    },
  ],
};

/**
 * Seed E2E test data (placeholder)
 *
 * In a real implementation, this would:
 * 1. Call API routes to create entities via Arkiv
 * 2. Wait for entities to be indexed
 * 3. Return created entity IDs for use in tests
 *
 * For now, this is just a data structure that MSW handlers use.
 */
export async function seedE2EData(): Promise<void> {
  if (process.env.E2E_SEED !== "true") {
    console.log("[E2E] Skipping seed (E2E_SEED not set to 'true')");
    return;
  }

  console.log("[E2E] Seeding test data...");
  // TODO: Implement actual seeding via API routes
  console.log("[E2E] Seed data structure ready:", E2E_TEST_DATA);
}
