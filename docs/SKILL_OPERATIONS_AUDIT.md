# Skill Operations Audit

## Overview
This document audits all skill operations in the codebase to ensure consistency with M1 acceptance criteria and proper Arkiv integration.

## Key Finding: Skill Entity = Topic = Learning Community
- **There is no separate "topic" entity**
- Each Skill entity automatically becomes a topic/learning community
- Topic pages (`/topic/[slug]`) display Skill entities
- Every skill should have a slug for topic page access

## Skill Creation Operations

### 1. `/api/skills` POST Route (`app/api/skills/route.ts`)
**Status**: ✅ Fixed with retry logic
- Creates Skill entity via `createSkill()`
- Always generates slug via `normalizeSkillSlug()`
- **Issue Fixed**: Added retry logic with exponential backoff (5 retries, 1s-16s delays)
- **Issue Fixed**: Returns pending status if skill created but not yet queryable
- Returns skill entity with key, slug, name_canonical

### 2. `ensureSkillEntity()` Helper (`lib/arkiv/skill-helpers.ts`)
**Status**: ✅ Uses API route (inherits retry logic)
- Calls `/api/skills` POST route
- Handles alreadyExists case
- Returns skill entity or null

### 3. `SkillSelector` Component (`components/SkillSelector.tsx`)
**Status**: ✅ Fixed to handle pending case
- Creates skill via `/api/skills` POST
- **Issue Fixed**: Now handles `pending` status and waits before reloading
- Reloads skills list after creation
- Selects newly created skill

### 4. `SkillsStep` Onboarding Component (`components/onboarding/SkillsStep.tsx`)
**Status**: ⚠️ Does NOT create Skill entities
- Only adds skill names to profile's `skillsArray`
- Does NOT create Skill entities on Arkiv
- **Gap**: Skills added during onboarding are not Skill entities
- **Impact**: These skills won't have topic pages until Skill entities are created

## Skill Query Operations

### 1. `/api/skills` GET Route
**Status**: ✅ Working
- Lists all skills with optional filters (status, slug, limit)
- Uses `listSkills()` from `lib/arkiv/skill.ts`

### 2. `/api/skills/explore` Route
**Status**: ✅ Working
- Lists all skills with profile counts
- Counts profiles by checking skill_ids, skillsArray, and skills string

### 3. Topic Page (`app/topic/[slug]/page.tsx`)
**Status**: ✅ Working
- Looks up skill by slug
- Displays skill as topic/learning community
- Shows asks, offers, gatherings, sessions for that skill

## Skill-to-Profile Operations

### 1. Adding Skill to Profile (`app/me/skills/page.tsx`)
**Status**: ✅ Working
- Uses `SkillSelector` to select/create skill
- Adds `skill_id` to profile's `skill_ids` array
- Updates profile entity (immutable - creates new entity)

### 2. Removing Skill from Profile
**Status**: ✅ Working
- Removes `skill_id` from profile's `skill_ids` array
- Updates profile entity

## Transaction Handling Pattern

### Current Pattern (from betadocs and codebase)
1. **Create entity** via `handleTransactionWithTimeout()`
2. **Handle receipt timeout** - transaction may be submitted but receipt not yet available
3. **Retry with delays** when fetching newly created entities (Arkiv indexing delay)
4. **Return pending status** if entity created but not yet queryable

### Applied to Skill Creation
- ✅ `createSkill()` uses `handleTransactionWithTimeout()`
- ✅ API route retries fetching with exponential backoff
- ✅ Returns pending status if skill not yet queryable
- ✅ Client components handle pending status

## M1 Acceptance Criteria Compliance

### Scenario: Adding a new skill (from `docs/beta_ac.md`)
- ✅ Skill entity created on Arkiv
- ✅ Profile updated with skill reference
- ✅ Duplicate skills prevented
- ✅ Entity appears on Mendoza Explorer

### Gap Identified
- ⚠️ Onboarding `SkillsStep` doesn't create Skill entities
- ⚠️ Skills added during onboarding are just strings in profile
- ⚠️ These skills won't have topic pages until Skill entities are created

## Recommendations

1. ✅ **Fixed**: Add retry logic to skill creation API (DONE)
2. ✅ **Fixed**: Handle pending status in SkillSelector (DONE)
3. ⚠️ **Consider**: Update SkillsStep to create Skill entities (or ensure they're created later)
4. ✅ **Verified**: Skill creation always creates slug (topic page access)
5. ✅ **Verified**: All new skills via `createSkill()` become topics automatically

## Testing Checklist

- [ ] Create skill via SkillSelector - should work with retry
- [ ] Create skill via skills page - should work with retry
- [ ] Create skill during onboarding - currently doesn't create entity (needs fix)
- [ ] Navigate to topic page for newly created skill - should work after indexing
- [ ] Verify skill appears in explore page - should work after indexing
- [ ] Verify skill can be added to profile - should work

