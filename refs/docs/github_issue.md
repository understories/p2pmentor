# **Arkiv-Native Feedback → GitHub Issue Sync Architecture**

**Version:** 2.0  
**Status:** Ready for Implementation (Updated with TPM Decisions)  
**Owner:** p2pmentor Engineering  
**Scope:** December 2025 Beta  
**Last Updated:** Based on TPM implementation decisions

---

# 1. Purpose

Enable seamless integration between the **Arkiv-native feedback system** and **GitHub Issues**, following best practices for consumer apps and FOSS development.
The system must:

* Preserve **user data sovereignty** (Arkiv as system of record)
* Avoid **centralized databases**
* Respect **privacy**, with user-controlled publication
* Support **developer workflows** (labels, triage, linking between systems)
* Fit **Arkiv-native trust-minimized principles**

---

# 2. High-Level Requirements

### Functional Requirements

1. Capture all user feedback as **Arkiv entities** (existing system).
2. Allow builders to sync selected feedback items into **GitHub Issues**.
3. **Manual sync only in beta** (automated sync deferred).
4. Write back the GitHub Issue URL and metadata into the original Arkiv entity.
5. Display GitHub issue state in the `/admin/feedback` interface.
6. Show synced status to users on `/me/issues` (if consent given).

### Non-Functional Requirements

* Zero centralized database.
* Zero leakage of sensitive user information.
* Minimal backend logic (serverless acceptable).
* Resilient to GitHub API rate limits and failures.
* All transformations deterministic and diffable.
* **Immutable audit trail** for sync attempts (stored in Arkiv).

---

# 3. Architecture Summary

```
[User]
   ↓ (feedback form with publish_consent checkbox)
[Arkiv Feedback Entity]
   ↓ (admin review)
[p2pmentor Backend → GitHub API]
   ↓
[GitHub Issue Created]
   ↓
[Arkiv Entity Updated with GitHub Metadata]
   ↓
[p2pmentor Admin UI displays linked issue]
   ↓
[User sees "Synced to GitHub" badge if consent given]
```

---

# 4. Arkiv Feedback Entity Schema

Extend the existing feedback entity with GitHub sync metadata:

## 4.1 Schema Extension

**Attributes (queryable):**
```typescript
{
  // Existing attributes...
  publish_consent: "true" | "false",  // Default: "false" (opt-in)
  github_synced: "true" | "false",   // Whether synced to GitHub
  github_issue_number: string | null, // GitHub issue number
  last_sync_status: "success" | "failed" | null,  // Last sync attempt status
  last_sync_at: string | null,       // ISO timestamp of last sync attempt
}
```

**Payload (non-queryable):**
```typescript
{
  // Existing payload...
  github_issue_url: string | null,   // Full GitHub issue URL
  last_sync_error: string | null,    // Short error message if sync failed
}
```

### Schema Notes

* `publish_consent` must be collected during feedback submission (default: `false` - opt-in).
* Only feedback with `publish_consent = true` can be synced.
* Entities remain fully sovereign and user-owned.
* **Sync status fields** provide immutable audit trail (arkiv-native pattern).

### Arkiv-Native Pattern

Following existing patterns in the codebase:
- **Attributes** for queryable fields (can filter by `github_synced`, `publish_consent`)
- **Payload** for non-queryable metadata (URLs, error messages)
- **Immutable entities**: Sync status stored as attributes, not mutated
- **Wallet normalization**: All wallet addresses stored in lowercase

**Reference:** `docs/ENGINEERING_GUIDELINES.md` Section 14 - Arkiv-Native Patterns

---

# 5. GitHub Integration

## 5.1 Authentication

**Beta: GitHub Personal Access Token (PAT) in environment variables**

```typescript
// lib/config.ts
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
export const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
export const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;
// Optional: staging repo
export const GITHUB_REPO_NAME_STAGING = process.env.GITHUB_REPO_NAME_STAGING;
```

**Required scopes:**
* `repo:issues` - Create and manage issues

**Architecture note:** Design to allow swapping to GitHub App authentication later without breaking changes.

---

## 5.2 Issue Creation Payload

**Endpoint:**
```
POST https://api.github.com/repos/:owner/:repo/issues
```

**Headers:**
```
Authorization: token {GITHUB_TOKEN}
Accept: application/vnd.github.v3+json
```

**Payload:**
```json
{
  "title": "Feedback: {short_summary}",
  "body": "{markdown_body}",
  "labels": [
    "source/arkiv",
    "feedback",
    "page::{page}",
    "type::{issue_or_feedback}",
    ...custom_labels
  ]
}
```

### 5.3 Issue Body Format (Markdown)

**Structure:**
```markdown
### Feedback Summary

{short_summary}

### Context

- **Arkiv Feedback ID:** `{entity_key}`
- **Arkiv Tx:** `{tx_hash}` ([View on Arkiv Explorer]({arkiv_tx_url}))
- **Page:** `{page}`
- **Wallet (masked):** `{wallet_masked}` (format: `0x1234…abcd`)
- **Rating:** `{rating}` (if provided)
- **Date:** `{created_at}`

### User Message (excerpt)

> {message_excerpt}

_(truncated, full payload on [Arkiv Explorer]({arkiv_entity_url}))_

### Links

- [Arkiv Explorer Entity]({arkiv_entity_url})
- [Arkiv Transaction]({arkiv_tx_url})
```

**Message Excerpt Rules:**
- Hard cap: **500 characters**
- Append `(truncated)` if longer
- Link to Arkiv Explorer for full context

**Arkiv Explorer URLs:**
- **Transaction:** `https://explorer.mendoza.hoodi.arkiv.network/tx/{txHash}`
- **Entity:** `https://explorer.mendoza.hoodi.arkiv.network/entity/{entityKey}` (verify URL format with Arkiv docs)

**Reference:** Existing patterns in codebase:
- `app/network/page.tsx` - Transaction links
- `app/me/issues/page.tsx` - Transaction links
- `app/admin/feedback/page.tsx` - Transaction links

---

## 5.4 Labels

**Base Labels (always applied):**
- `source/arkiv` - Indicates synced from Arkiv
- `feedback` - General feedback category
- `page::{page}` - Page where feedback was given (e.g., `page::/network`, `page::/me`)
- `type::{type}` - Either `type::issue` or `type::feedback`

**Custom Labels:**
- Admins can add extra labels during sync (e.g., `priority/high`, `component/frontend`)
- No auto-assignment based on content in beta (no NLP/severity inference)

**Label Format:**
- Use forward slash for categories: `category/value`
- Use double colon for page/type: `page::/network`, `type::issue`

---

# 6. Sync Models

## 6.1 Manual Sync (Beta Implementation)

**UI Flow:**
1. Admin selects feedback row in `/admin/feedback`
2. Click "Sync to GitHub" button
3. Modal displays:
   - Sanitized issue payload preview
   - Custom labels input (optional)
   - Option to "Link to existing issue" (by number)
4. On confirm:
   - POST → GitHub API
   - Create `app_feedback_github_sync` entity (arkiv-native) with sync metadata
   - Update original feedback entity with GitHub metadata
   - Show success/error in UI

**Button States:**
- **Disabled if:**
  - `publish_consent = false`
  - Already synced (`github_synced = true`)
- **Enabled if:**
  - `publish_consent = true`
  - `github_synced = false` or admin wants to resync

**Advantages:**
- Complete control
- Zero noise on GitHub
- Easy to implement
- Transparent to admins

---

## 6.2 Automatic Sync (Future - Deferred)

**Feature Flag:**
```typescript
export const GITHUB_AUTO_SYNC_ENABLED = process.env.GITHUB_AUTO_SYNC_ENABLED === 'true';
```

**Design (not implemented in beta):**
- Cron job runs every 60s (if enabled)
- Query Arkiv for: `type = "app_feedback"`, `publish_consent = "true"`, `github_synced = "false"`, `feedbackType = "issue"`
- For each result: Create GitHub issue, update Arkiv entity
- Log success/failure to Arkiv

**Requires:**
- Background worker (serverless cron or small Node service)
- Rate limiting handling
- Error recovery

---

# 7. Privacy and Consent Management

## 7.1 Consent Collection

**User Feedback Form:**
- Add checkbox: "Allow this feedback to be synced to public GitHub issues"
- Default: **unchecked** (opt-in)
- Label: `publish_consent` stored as attribute: `"true"` or `"false"`

**Reference:** `components/AppFeedbackModal.tsx` - Add consent checkbox

---

## 7.2 Consent Revocation

**If consent revoked after GitHub issue created:**

1. **Do NOT delete** the GitHub issue (preserves engineering history)
2. **Edit and anonymize** the issue body:
   - Overwrite with: "User content removed due to consent being revoked. Technical metadata retained."
   - Remove all user text, wallet hints, page params that could re-identify
   - Keep technical metadata (Arkiv IDs, transaction hashes - already public)
3. **Add label:** `privacy/consent-revoked`
4. **No state change:** Issue open/closed state remains engineering decision

**Implementation:**
- Query for feedback with `publish_consent = "false"` and `github_synced = "true"`
- PATCH GitHub issue to anonymize body
- Add `privacy/consent-revoked` label

---

# 8. Admin UI Changes

## 8.1 Add GitHub Column

**Display:**
- **If synced:** GitHub icon (🔗) linking to issue, tooltip with issue number
- **If not synced:** "Not synced" badge (gray)
- **If sync failed:** "Sync Failed" badge (red) with retry button

**Column Header:** "GitHub"

---

## 8.2 Add "Sync to GitHub" Action

**Button in Actions column:**
- **Text:** "Sync to GitHub" (if not synced) or "Resync" (if synced)
- **Modal:** Preview issue payload, custom labels input, link to existing option
- **Disabled if:** `publish_consent = false` or sync in progress

**Sync Modal Fields:**
- Issue title (editable)
- Issue body preview (read-only, markdown)
- Custom labels input (comma-separated)
- "Link to existing issue" checkbox + issue number input
- Confirm/Cancel buttons

---

## 8.3 Error Handling UI

**On GitHub API failure:**
- Show error banner in admin UI: "Sync failed: {error_message}"
- Display "Retry" button
- **No automatic retry** in beta (manual retry only)
- Update `last_sync_status = "failed"` and `last_sync_error` in Arkiv entity

---

# 9. Backend Implementation Plan

## 9.1 Endpoints

### POST `/api/github/create-issue`

**Input:**
```json
{
  "feedbackKey": "string",
  "linkToExisting": boolean,  // Optional: link to existing issue
  "existingIssueNumber": number,  // Required if linkToExisting = true
  "customLabels": string[]  // Optional: additional labels
}
```

**Flow:**
1. Fetch feedback entity from Arkiv
2. Validate `publish_consent = "true"`
3. Build GitHub Issue payload (markdown body, labels)
4. POST → GitHub API
5. Create `app_feedback_github_sync` entity (arkiv-native) with:
   - `type: "app_feedback_github_sync"`
   - `feedbackKey: {feedbackKey}`
   - `githubIssueNumber: {number}`
   - `githubIssueUrl: {url}`
   - `syncedAt: {timestamp}`
   - `status: "success" | "failed"`
   - `error: {string | null}`
6. Update original feedback entity attributes:
   - `github_synced: "true"`
   - `github_issue_number: "{number}"`
   - `last_sync_status: "success"`
   - `last_sync_at: {timestamp}`
7. Update payload:
   - `github_issue_url: {url}`
8. Return issue URL and number

**Error Handling:**
- If GitHub API fails: Update `last_sync_status = "failed"` and `last_sync_error`
- Return error response to UI
- **Do NOT** create sync entity on failure (only on success)

---

### POST `/api/github/anonymize-issue`

**Input:**
```json
{
  "feedbackKey": "string"
}
```

**Flow:**
1. Fetch feedback entity
2. Get `github_issue_number`
3. PATCH GitHub issue to anonymize body
4. Add `privacy/consent-revoked` label
5. Update feedback entity: `publish_consent = "false"` (if not already)

**Used for:** Consent revocation workflow

---

### GET `/api/github/status/:number`

**Optional:** Fetch GitHub issue state for dashboard

**Returns:**
```json
{
  "ok": true,
  "issue": {
    "number": number,
    "state": "open" | "closed",
    "title": string,
    "url": string
  }
}
```

---

## 9.2 Arkiv Entity Updates

**Pattern:** Follow existing arkiv-native patterns

**Sync Status Entity (New):**
```typescript
// Create separate entity for sync tracking (arkiv-native immutability)
{
  type: "app_feedback_github_sync",
  attributes: [
    { key: "type", value: "app_feedback_github_sync" },
    { key: "feedbackKey", value: feedbackKey },
    { key: "githubIssueNumber", value: String(issueNumber) },
    { key: "status", value: "success" | "failed" },
    { key: "syncedAt", value: ISO_timestamp },
    { key: "spaceId", value: "local-dev" },
  ],
  payload: {
    githubIssueUrl: url,
    error: errorMessage | null,
  }
}
```

**Reference:** Similar to `app_feedback_resolution` pattern in `lib/arkiv/appFeedback.ts`

---

# 10. User Visibility

## 10.1 User Issues Page (`/me/issues`)

**Display:**
- **Badge:** "Synced to GitHub" (if `github_synced = true` and `publish_consent = true`)
- **GitHub link:** Show issue number and link (if consent given)
- **Label:** Clearly marked as "Public GitHub issue"

**UI:**
```tsx
{issue.github_synced && issue.publish_consent && (
  <div className="mt-2">
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
      🔗 Synced to GitHub
    </span>
    <a
      href={issue.github_issue_url}
      target="_blank"
      rel="noopener noreferrer"
      className="ml-2 text-blue-600 hover:underline"
    >
      Issue #{issue.github_issue_number}
    </a>
  </div>
)}
```

**Privacy:** Only show if `publish_consent = true` (user gave consent)

---

# 11. Failure Modes & Recovery

## 11.1 GitHub API Failure

**Behavior:**
- Backend returns error to UI
- Arkiv entity updated with `last_sync_status = "failed"` and `last_sync_error`
- UI shows error banner with "Retry" button
- **No automatic retry** in beta

**Error Types:**
- Rate limiting: Show "Rate limited, please wait" message
- Network error: Show "Network error, please retry"
- Authentication error: Show "GitHub authentication failed" (admin action required)

---

## 11.2 Arkiv Update Failure

**Scenario:** GitHub issue created, but Arkiv entity update fails

**Recovery:**
- Provide admin tool: "Repair Link" using issue number
- Manually update Arkiv entity with GitHub metadata
- Or: Query `app_feedback_github_sync` entities to find orphaned links

---

## 11.3 Consent Revocation After Sync

**Scenario:** User revokes consent after issue created

**Handling:**
- Run anonymization workflow (Section 7.2)
- Update GitHub issue body
- Add `privacy/consent-revoked` label
- Update Arkiv entity: `publish_consent = "false"`

---

# 12. Implementation Checklist

## Phase 1: Schema & Backend

- [ ] Extend `AppFeedback` type with GitHub fields
- [ ] Add `publish_consent` to `createAppFeedback` function
- [ ] Add GitHub config to `lib/config.ts`
- [ ] Implement `POST /api/github/create-issue`
- [ ] Implement `app_feedback_github_sync` entity creation
- [ ] Add sync status tracking to feedback entity
- [ ] Implement error handling and status updates

## Phase 2: UI - Consent Collection

- [ ] Add `publish_consent` checkbox to `AppFeedbackModal`
- [ ] Update feedback form to include consent
- [ ] Store consent in Arkiv entity attributes

## Phase 3: UI - Admin Sync

- [ ] Add "GitHub" column to admin feedback table
- [ ] Add "Sync to GitHub" button to actions
- [ ] Implement sync modal with preview
- [ ] Add custom labels input
- [ ] Add "Link to existing issue" option
- [ ] Display sync status and errors
- [ ] Add retry functionality

## Phase 4: UI - User Visibility

- [ ] Add "Synced to GitHub" badge to `/me/issues`
- [ ] Show GitHub issue link (if consent given)
- [ ] Update issue card styling

## Phase 5: Consent Revocation

- [ ] Implement `POST /api/github/anonymize-issue`
- [ ] Add consent revocation workflow
- [ ] Test anonymization

## Phase 6: Testing & Documentation

- [ ] Test sync flow end-to-end
- [ ] Test error handling
- [ ] Test consent revocation
- [ ] Update documentation
- [ ] Add logging and monitoring

---

# 13. Future Extensions (Post-Beta)

* **Back-sync issue status** (open/closed) into Arkiv entities
* **Automated sync** via cron (if `GITHUB_AUTO_SYNC_ENABLED = true`)
* **Auto-tag GitHub issues** with session ID (if feedback tied to session)
* **AI-based auto-labelling** (severity, component, priority)
* **Public-facing roadmap dashboard** fed by GitHub Issues
* **GitHub App authentication** (replace PAT)
* **Multiple repo support** (per-issue repo selection)

---

# 14. Summary

This design enables:

* Fully decentralized feedback storage (Arkiv)
* Fully modern FOSS development workflow (GitHub)
* Zero centralized databases
* User-controlled publication (opt-in consent)
* Immutable audit trail (arkiv-native sync entities)
* Clean API boundaries
* Minimal backend footprint
* Clear upgrade paths

**Key Decisions:**
- Opt-in consent (default: `false`)
- Manual sync only in beta
- Markdown issue body format
- Immutable sync tracking entities
- Anonymization on consent revocation (not deletion)
- User visibility with consent check

Meets December beta requirements and prepares for scale.

---

# 15. Arkiv Explorer URL Research

**Transaction URLs (verified in codebase):**
- Pattern: `https://explorer.mendoza.hoodi.arkiv.network/tx/{txHash}`
- Used in: `app/network/page.tsx`, `app/me/issues/page.tsx`, `app/admin/feedback/page.tsx`

**Entity URLs (to verify):**
- Expected pattern: `https://explorer.mendoza.hoodi.arkiv.network/entity/{entityKey}`
- **Action:** Verify with Arkiv documentation or explorer UI

**Reference Implementation:**
- See existing transaction link patterns throughout codebase
- Follow same pattern for entity links

---

# 16. Codebase Patterns to Reuse

**Existing Patterns:**
1. **Transaction hash storage:** `*_txhash` entities (e.g., `app_feedback_txhash`)
2. **Status tracking:** Separate entities for status (e.g., `app_feedback_resolution`)
3. **Config management:** `lib/config.ts` for environment variables
4. **Error handling:** `lib/arkiv/transaction-utils.ts` for timeout handling
5. **Wallet normalization:** `.toLowerCase()` in all wallet storage

**Pattern to Follow for GitHub Sync:**
- Create `app_feedback_github_sync` entity (similar to `app_feedback_resolution`)
- Store sync metadata as attributes (queryable)
- Store URLs/errors in payload (non-queryable)
- Follow immutability principle (no mutation of original entity)

**Reference Files:**
- `lib/arkiv/appFeedback.ts` - Feedback entity patterns
- `lib/arkiv/adminResponse.ts` - Response entity patterns
- `docs/ENGINEERING_GUIDELINES.md` - Arkiv-native patterns
