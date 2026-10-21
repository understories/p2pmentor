# Arkiv Data Model

This is the on-chain schema for every entity p2pmentor writes on the Arkiv Tiramisu testnet (SDK 0.8.1). The rules are enforced in code by [`lib/arkiv/schema.ts`](../../../../lib/arkiv/schema.ts), and every write goes through [`lib/arkiv/write.ts`](../../../../lib/arkiv/write.ts). Per-entity attribute and payload details are in [entities/](../entities/).

## Rules

| Rule        | Spec                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespace   | Every entity has `project = 'p2pmentor'` and `type = <entity type>`. Every query starts from `arkivSelect(type)`, which filters on both.                                                                             |
| Environment | `space_id` separates environments and cohorts (`beta-launch`, `local-dev`, `nsapril26`, …).                                                                                                                          |
| Version     | `schema_version = i32(1)` on every entity. Bump it when an entity's attribute or payload shape changes incompatibly.                                                                                                 |
| Names       | Lowercase `snake_case` (`[a-z][a-z0-9_]*`, ≤ 32 chars). Tiramisu rejects uppercase. Reserved words (`key`, `str`, `and`, …) are not allowed.                                                                         |
| Types       | Derived from name and value, identically on write (`entityAttributes`) and query (`eqAttr`): wallet-like names (`wallet`, `*_wallet`, `*_by`) holding an address → `addr`; `*_at` → `u64` epoch ms; otherwise `str`. |
| Reading     | `getAttr(entity, name)` returns strings: addresses lowercase, `*_at` as ISO-8601.                                                                                                                                    |
| Attributes  | Only short, queryable scalars: ids, keys, wallets, statuses, slugs, timestamps. Max 128 bytes per string and 30 per entity. **Writes throw rather than truncate.**                                                   |
| Payload     | JSON (`application/json`) holding long text (bios, descriptions, titles, reasons, notes), URLs, arrays and nested data. Payloads are public, so never store secrets or private data there.                           |
| Trust       | Server-signed types are read with `.createdBy(SERVER_SIGNER_ADDRESS)`: beta access, beta code usage, review grants, `*_revocation`, admin notifications, learner quests, quest definitions.                          |
| Updates     | `replaceArkivEntity` (`patchEntity` with `set`/`unset`) replaces attributes and payload. Patches do not change expiry, owner or flags, and are last-writer-wins.                                                     |
| Flags       | Append-only types are created `readonly`: they can never be patched, so corrections are new entities. All `*_txhash` and `*_revocation` types are readonly.                                                          |
| Lifetimes   | Chosen per type (below). No entity is `permanent()`. Product-specific lifetimes (user TTLs, grant expiry, gathering time) are passed explicitly. Long-lived types are kept alive by renewal (planned cron).          |

## Entity types

Generated from the types written in `lib/arkiv/` and the lifetimes and flags in `lib/arkiv/schema.ts`. Revocation markers (`<type>_revocation`) are created dynamically: 180 days, readonly.

| Type                              | Default lifetime | Flags    | Tx-hash companion                        |
| --------------------------------- | ---------------- | -------- | ---------------------------------------- |
| `admin_notification`              | 90 days          | mutable  | `admin_notification_txhash`              |
| `admin_response`                  | 180 days         | mutable  | `admin_response_txhash`                  |
| `app_feedback`                    | 90 days          | readonly | `app_feedback_txhash`                    |
| `app_feedback_resolution`         | 180 days         | mutable  |                                          |
| `ask`                             | 180 days         | mutable  | `ask_txhash`                             |
| `auth_identity`                   | 365 days         | mutable  |                                          |
| `availability`                    | 180 days         | mutable  | `availability_txhash`                    |
| `availability_deletion`           | 180 days         | mutable  |                                          |
| `beta_access`                     | 180 days         | mutable  | `beta_access_txhash`                     |
| `beta_code_usage`                 | 180 days         | readonly | `beta_code_usage_txhash`                 |
| `client_perf_metric`              | 180 days         | mutable  | `client_perf_metric_txhash`              |
| `dx_metric`                       | 180 days         | mutable  | `dx_metric_txhash`                       |
| `garden_note`                     | 180 days         | mutable  | `garden_note_txhash`                     |
| `github_issue_link`               | 180 days         | mutable  | `github_issue_link_txhash`               |
| `learner_quest`                   | 365 days         | mutable  | `learner_quest_txhash`                   |
| `learner_quest_assessment_result` | 365 days         | readonly | `learner_quest_assessment_result_txhash` |
| `learner_quest_progress`          | 180 days         | readonly | `learner_quest_progress_txhash`          |
| `learning_follow`                 | 180 days         | mutable  | `learning_follow_txhash`                 |
| `lite_ask`                        | 180 days         | mutable  | `lite_ask_txhash`                        |
| `lite_offer`                      | 180 days         | mutable  | `lite_offer_txhash`                      |
| `meta_learning_artifact`          | 180 days         | readonly | `meta_learning_artifact_txhash`          |
| `metric_aggregate`                | 180 days         | mutable  | `metric_aggregate_txhash`                |
| `navigation_metric`               | 180 days         | mutable  | `navigation_metric_txhash`               |
| `notification`                    | 90 days          | mutable  | `notification_txhash`                    |
| `notification_preference`         | 180 days         | mutable  |                                          |
| `offer`                           | 180 days         | mutable  | `offer_txhash`                           |
| `onboarding_event`                | 90 days          | readonly | `onboarding_event_txhash`                |
| `perf_snapshot`                   | 180 days         | mutable  | `perf_snapshot_txhash`                   |
| `proof_of_skill_badge`            | 365 days         | mutable  | `proof_of_skill_badge_txhash`            |
| `quest_completion_skill_link`     | 180 days         | readonly | `quest_completion_skill_link_txhash`     |
| `quest_definition`                | 365 days         | mutable  | `quest_definition_txhash`                |
| `quest_reflection`                | 180 days         | mutable  | `quest_reflection_txhash`                |
| `quest_step_progress`             | 180 days         | readonly | `quest_step_progress_txhash`             |
| `quest_telemetry`                 | 180 days         | readonly | `quest_telemetry_txhash`                 |
| `retention_cohort`                | 180 days         | mutable  | `retention_cohort_txhash`                |
| `review_mode_grant`               | 180 days         | readonly |                                          |
| `session`                         | 180 days         | mutable  | `session_txhash`                         |
| `session_confirmation`            | 180 days         | mutable  |                                          |
| `session_feedback`                | 180 days         | mutable  | `session_feedback_txhash`                |
| `session_jitsi`                   | 180 days         | mutable  |                                          |
| `session_payment_submission`      | 180 days         | mutable  |                                          |
| `session_payment_validation`      | 180 days         | mutable  |                                          |
| `session_rejection`               | 180 days         | mutable  |                                          |
| `skill`                           | 365 days         | mutable  | `skill_txhash`                           |
| `tx_event`                        | 365 days         | readonly |                                          |
| `user_profile`                    | 365 days         | mutable  |                                          |
| `virtual_gathering`               | 180 days         | mutable  | `virtual_gathering_txhash`               |
