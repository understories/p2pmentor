# Testing the Network Page

This document explains how to test the network page with diverse test data.

## Quick Test Method

### Step 1: Seed Test Data

Use the test seeding API endpoint to create diverse asks and offers:

```bash
# Make sure dev server is running (pnpm dev)
# Then in another terminal:
curl -X POST http://localhost:3000/api/seed-test
```

Or use a browser/Postman to POST to `http://localhost:3000/api/seed-test`

### Step 2: View Network Page

1. Navigate to `http://localhost:3000/network`
2. You should see:
   - **Stats**: Counts of asks, offers, and matches
   - **Matches Section**: Shows matched ask/offer pairs
   - **Asks Section**: All learning requests
   - **Offers Section**: All teaching offers

### Step 3: Test Filtering

1. **Filter by Skill**: Type "React" in the skill filter - should show only React-related items
2. **View Modes**: 
   - Select "Matches" to see only matched pairs
   - Select "Asks Only" to see only learning requests
   - Select "Offers Only" to see only teaching offers
   - Select "All" to see everything

## Expected Test Data

After seeding, you should have:

### Asks (Learning Requests):
- React
- TypeScript
- Solidity
- Rust
- Next.js

### Offers (Teaching Offers):
- React
- TypeScript
- Solidity
- Rust
- Python
- JavaScript

### Expected Matches:
- ✅ React ask ↔ React offer
- ✅ TypeScript ask ↔ TypeScript offer
- ✅ Solidity ask ↔ Solidity offer
- ✅ Rust ask ↔ Rust offer
- ❌ Next.js ask (no matching offer)
- ❌ Python offer (no matching ask)
- ❌ JavaScript offer (no matching ask)

## Manual Testing Checklist

- [x] Network page loads without errors
- [x] Stats show correct counts
- [x] Matches section displays matched pairs
- [x] Each match shows ask and offer side-by-side
- [x] Skill filter works correctly
- [x] View mode filter works (All/Matches/Asks/Offers)
- [x] Time remaining shows correctly for asks/offers
- [x] Profile names display when available
- [x] Arkiv explorer links work
- [ ] Page is responsive on mobile (pending mobile device testing)

## Troubleshooting

### No matches showing?
- Check that asks and offers have matching skills (case-insensitive)
- Verify data was created successfully (check browser console for errors)
- Refresh the page to reload data

### Empty network page?
- Make sure test data was seeded: `curl -X POST http://localhost:3000/api/seed-test`
- Check browser console for API errors
- Verify ARKIV_PRIVATE_KEY is set in .env

### Matches not appearing?
- Matching is case-insensitive and uses partial matching
- "React" should match "react", "REACT", etc.
- Check that both asks and offers exist with similar skill names

