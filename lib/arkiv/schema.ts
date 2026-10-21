/**
 * Arkiv on-chain schema for p2pmentor
 *
 * Every entity p2pmentor writes follows these rules (see docs/betadocs/arkiv/data-model.md):
 *
 * - Namespace: `project` = 'p2pmentor' and `type` = entity type on every entity;
 *   every query filters on `project` (see `arkivSelect` in ./read.ts).
 * - Version: `schema_version` = i32(SCHEMA_VERSION) on every entity.
 * - Names: lowercase snake_case (`[a-z][a-z0-9_]*`, max 32 bytes). Tiramisu rejects
 *   uppercase attribute names.
 * - Values: attributes hold short, queryable scalars only (max 128 bytes per string).
 *   Long text, arrays and nested data go in the JSON payload. Values are never truncated:
 *   writing an over-long value throws.
 * - Types are derived from the attribute name AND value, identically on write and query
 *   (see `typedValue`), so a value written by `entityAttributes` always matches the same
 *   value passed to `eqAttr`:
 *     - wallet-like names (`wallet`, `*_wallet`, `*_by`) with a valid address -> addr
 *     - timestamp names (`*_at`) with a parseable date/epoch-ms -> u64 epoch milliseconds
 *     - everything else -> str
 *
 * Entity lifetimes and creation flags are chosen per entity type (`lifetimeFor`, `flagsFor`).
 */

import {
  addr,
  i32,
  str,
  u64,
  type AttributeInputs,
  type ArkivValue,
} from '@arkiv-network/sdk/attr';
import { eq } from '@arkiv-network/sdk/query';
import { ExpirationTime } from '@arkiv-network/sdk';
import type { CreationFlags, Expiry } from '@arkiv-network/sdk/entity';
import { isAddress } from 'viem';

export const PROJECT = 'p2pmentor';
export const SCHEMA_VERSION = 1;

/** Max UTF-8 bytes of a string attribute value (protocol limit) */
export const MAX_ATTR_STRING_BYTES = 128;
/** Max user attributes on create (32 cells minus payload and content type) */
export const MAX_USER_ATTRIBUTES = 30;

const NAME_RE = /^[a-z][a-z0-9_]*$/;
const MAX_NAME_BYTES = 32;

/** Plain JS value accepted for an attribute; typed by `typedValue` */
export type AttrValue = string | number | boolean | Date;

/** Attribute record as written by app code (snake_case names, plain values) */
export type AttrRecord = Record<string, AttrValue | null | undefined>;

export function isWalletAttrName(name: string): boolean {
  return name === 'wallet' || name.endsWith('_wallet') || name.endsWith('_by');
}

export function isTimestampAttrName(name: string): boolean {
  return name.endsWith('_at');
}

/**
 * Validate an attribute name against the Tiramisu grammar.
 * @throws Error if the name is not lowercase snake_case or is too long
 */
export function assertAttrName(name: string): void {
  if (!NAME_RE.test(name) || name.length > MAX_NAME_BYTES) {
    throw new Error(
      `[arkiv/schema] Invalid attribute name "${name}": must match ${NAME_RE} and be at most ${MAX_NAME_BYTES} chars`
    );
  }
}

function toEpochMs(value: AttrValue): number | null {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    if (/^\d+$/.test(value)) return Number(value);
    const ms = Date.parse(value);
    return Number.isFinite(ms) && ms >= 0 ? ms : null;
  }
  return null;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Convert a plain value to a typed Arkiv value, based on the attribute name and value.
 *
 * Used for both writes and query predicates so both sides always agree.
 *
 * @throws Error if a string value exceeds MAX_ATTR_STRING_BYTES (never truncates)
 */
export function typedValue(name: string, value: AttrValue): ArkivValue {
  if (isWalletAttrName(name) && typeof value === 'string' && isAddress(value, { strict: false })) {
    return addr(value.toLowerCase() as `0x${string}`);
  }

  if (isTimestampAttrName(name)) {
    const ms = toEpochMs(value);
    if (ms !== null) return u64(BigInt(ms));
  }

  const s = value instanceof Date ? value.toISOString() : String(value);
  if (utf8Bytes(s) > MAX_ATTR_STRING_BYTES) {
    throw new Error(
      `[arkiv/schema] Attribute "${name}" is ${utf8Bytes(s)} bytes; max is ${MAX_ATTR_STRING_BYTES}. ` +
        'Store long values in the JSON payload instead of attributes.'
    );
  }
  return str(s);
}

/**
 * Build the attributes for an entity write.
 *
 * Adds `project`, `type` and `schema_version`, validates names and the attribute count,
 * and types every value. `null`/`undefined`/'' values are omitted (absent, not empty).
 *
 * @param type - Entity type (e.g. 'ask', 'user_profile')
 * @param attrs - Attributes with snake_case names and plain values
 * @throws Error on invalid names, over-long values or too many attributes
 */
export function entityAttributes(type: string, attrs: AttrRecord = {}): AttributeInputs {
  const out: Record<string, ArkivValue> = {
    project: str(PROJECT),
    type: str(type),
    schema_version: i32(SCHEMA_VERSION),
  };

  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === '') continue;
    if (name === 'project' || name === 'type' || name === 'schema_version') continue;
    assertAttrName(name);
    out[name] = typedValue(name, value);
  }

  const count = Object.keys(out).length;
  if (count > MAX_USER_ATTRIBUTES) {
    throw new Error(
      `[arkiv/schema] Entity "${type}" has ${count} attributes; max is ${MAX_USER_ATTRIBUTES}. ` +
        'Move non-queried fields to the payload.'
    );
  }

  return out;
}

/**
 * Equality predicate with the same typing rules as `entityAttributes`.
 * Use this instead of `eq` from the SDK for all app attributes.
 */
export function eqAttr(name: string, value: AttrValue) {
  assertAttrName(name);
  return eq(name, typedValue(name, value));
}

// ---------------------------------------------------------------------------
// Lifetimes and creation flags
// ---------------------------------------------------------------------------

const DAY = 24 * 60 * 60;

/**
 * Default lifetime (seconds) per entity type.
 *
 * Long-lived types are kept alive by renewal, not by huge lifetimes:
 * Arkiv's `permanent()` is not a durability promise.
 */
const LIFETIME_SECONDS: Record<string, number> = {
  // Durable identity and curated content: 365 days, renewed
  user_profile: 365 * DAY,
  skill: 365 * DAY,
  auth_identity: 365 * DAY,
  passkey_identity: 365 * DAY,
  learner_quest: 365 * DAY,
  quest_definition: 365 * DAY,
  beta_code: 365 * DAY,
  badge: 365 * DAY,
  proof_of_skill_badge: 365 * DAY,
  assessment_result: 365 * DAY,
  learner_quest_assessment_result: 365 * DAY,
  quest_completion: 365 * DAY,
  revocation: 365 * DAY,
  tx_event: 365 * DAY,

  // Activity: 180 days
  ask: 180 * DAY,
  offer: 180 * DAY,
  availability: 180 * DAY,
  session: 180 * DAY,
  learning_follow: 180 * DAY,
  garden_note: 180 * DAY,
  virtual_gathering: 180 * DAY,
  notification_preference: 180 * DAY,

  // Operational: 90 days
  notification: 90 * DAY,
  admin_notification: 90 * DAY,
  app_feedback: 90 * DAY,
  onboarding_event: 90 * DAY,
};

/** Fallback lifetime for types not listed above */
const DEFAULT_LIFETIME_SECONDS = 180 * DAY;

/**
 * Types whose attributes and payload never change after create.
 * Corrections are new entities (e.g. a revocation), never patches.
 */
const READONLY_TYPES = new Set<string>([
  'revocation',
  'assessment_result',
  'learner_quest_assessment_result',
  'quest_completion_skill_link',
  'quest_telemetry',
  'quest_step_progress',
  'learner_quest_progress',
  'meta_learning_artifact',
  'tx_event',
  'onboarding_event',
  'app_feedback',
  'review_mode_grant',
  'beta_code_usage',
  'quest_completion',
]);

export function lifetimeSecondsFor(type: string): number {
  return LIFETIME_SECONDS[type] ?? DEFAULT_LIFETIME_SECONDS;
}

/**
 * Entity expiry for a type.
 *
 * @param type - Entity type
 * @param seconds - Optional product-specific lifetime (e.g. a user-chosen TTL).
 *   Overrides the type default when it is a positive number.
 */
export function lifetimeFor(type: string, seconds?: number | null): Expiry {
  const s =
    typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
      ? Math.floor(seconds)
      : lifetimeSecondsFor(type);
  return ExpirationTime.fromSeconds(s);
}

/**
 * Creation flags for a type. `*_revocation` markers and `*_txhash` records
 * (append-only links from an entity to its transaction) are always readonly.
 */
export function flagsFor(type: string): CreationFlags | undefined {
  const readonly =
    READONLY_TYPES.has(type) || type.endsWith('_txhash') || type.endsWith('_revocation');
  return readonly ? { readonly: true } : undefined;
}
