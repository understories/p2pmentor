/**
 * Arkiv read helpers
 *
 * - `arkivSelect()` starts every query: selects the fields app code reads and scopes
 *   to the p2pmentor namespace (`project` attribute).
 * - `fetchAll()` pages through results (the node returns at most 200 per page),
 *   pinned to a single block so pages stay consistent.
 * - `getAttr()` / `attrsToRecord()` read typed attributes back as plain strings
 *   (addresses lowercase, `*_at` timestamps as ISO-8601), matching what the app wrote.
 * - `parsePayload()` decodes a JSON payload.
 */

import { NoEntityFoundError } from '@arkiv-network/sdk';
import { MAX_LIMIT, type SelectQueryBuilder } from '@arkiv-network/sdk/query';
import type { Hex } from 'viem';
import { getPublicClient } from './client';
import { PROJECT, eqAttr, isTimestampAttrName } from './schema';

/**
 * Fields selected by app queries.
 * Select only what is read: every field is fetched over the network.
 */
export const ENTITY_FIELDS = {
  key: true,
  owner: true,
  creator: true,
  createdAt: true,
  expiresAt: true,
  contentType: true,
  attributes: true,
  payload: true,
} as const;

/** Entity shape returned by `arkivSelect()` queries and `getEntityByKey()` */
export type ArkivEntity = {
  key: Hex;
  owner?: Hex;
  creator?: Hex;
  createdAt?: bigint;
  expiresAt?: bigint;
  contentType?: string;
  attributes?: Readonly<Record<string, { type: string; value: unknown }>>;
  payload?: Uint8Array;
};

type PublicClient = ReturnType<typeof getPublicClient>;

/**
 * Start a query over p2pmentor entities.
 *
 * @param type - Optional entity type filter (adds `type = <type>`)
 * @param client - Optional public client (defaults to `getPublicClient()`)
 */
export function arkivSelect(type?: string, client: PublicClient = getPublicClient()) {
  const builder = client.select(ENTITY_FIELDS).where(eqAttr('project', PROJECT));
  return type ? builder.where(eqAttr('type', type)) : builder;
}

/**
 * Fetch up to `max` results, paging through the node's 200-per-page limit.
 * All pages are read at the same block (pinned before the first page).
 *
 * @param builder - Query builder (do not call `.limit()` on it; pass `max` instead)
 * @param max - Maximum number of entities to return (default 200)
 * @returns `{ entities }`, newest-created first (node order)
 */
export async function fetchAll<T>(
  builder: SelectQueryBuilder<T>,
  max: number = MAX_LIMIT,
  client: PublicClient = getPublicClient()
): Promise<{ entities: T[] }> {
  const pageSize = Math.min(MAX_LIMIT, Math.max(1, max));
  if (max <= MAX_LIMIT) {
    const page = await builder.limit(pageSize).fetch();
    return { entities: page.entities.slice(0, max) };
  }

  const block = await client.getBlockNumber();
  let page = await builder.atBlock(block).limit(pageSize).fetch();
  const entities: T[] = [...page.entities];
  while (entities.length < max && page.hasNextPage()) {
    page = await page.next();
    entities.push(...page.entities);
  }
  return { entities: entities.slice(0, max) };
}

/**
 * Get an entity by key, or null if it does not exist (or has expired).
 */
export async function getEntityByKey(
  key: string,
  client: PublicClient = getPublicClient()
): Promise<ArkivEntity | null> {
  try {
    return (await client.getEntity(key as Hex)) as ArkivEntity;
  } catch (error) {
    if (error instanceof NoEntityFoundError) return null;
    throw error;
  }
}

/**
 * Convert a typed attribute value to the plain string the app wrote.
 */
export function attrValueToString(name: string, attr: { type: string; value: unknown }): string {
  const { type, value } = attr;
  if (value === null || value === undefined) return '';
  if (type === 'addr') return String(value).toLowerCase();
  if (type === 'u64' && isTimestampAttrName(name)) {
    const ms = Number(value as bigint);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : String(value);
  }
  if (typeof value === 'bigint') return value.toString();
  return String(value);
}

/**
 * Read an attribute as a string ('' when absent).
 */
export function getAttr(entity: { attributes?: unknown } | null | undefined, name: string): string {
  const attrs = entity?.attributes as Record<string, { type: string; value: unknown }> | undefined;
  const attr = attrs?.[name];
  if (!attr || typeof attr !== 'object') return '';
  return attrValueToString(name, attr);
}

/**
 * Read all attributes as a plain name -> string record.
 */
export function attrsToRecord(entity: { attributes?: unknown } | null | undefined): Record<string, string> {
  const attrs = (entity?.attributes || {}) as Record<string, { type: string; value: unknown }>;
  const out: Record<string, string> = {};
  for (const [name, attr] of Object.entries(attrs)) {
    if (attr && typeof attr === 'object') out[name] = attrValueToString(name, attr);
  }
  return out;
}

/**
 * Decode a JSON payload. Returns `fallback` (default `{}`) when absent or invalid.
 */
export function parsePayload<T = any>(
  entity: { payload?: unknown } | null | undefined,
  fallback: T = {} as T
): T {
  const payload = entity?.payload;
  if (!payload) return fallback;
  try {
    const text =
      ArrayBuffer.isView(payload)
        ? new TextDecoder().decode(payload as Uint8Array)
        : typeof payload === 'string'
          ? payload
          : JSON.stringify(payload);
    return text ? (JSON.parse(text) as T) : fallback;
  } catch {
    return fallback;
  }
}
