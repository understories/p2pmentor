/**
 * Arkiv write helpers
 *
 * All p2pmentor entity writes go through these, so every entity gets the same
 * namespace, schema version, typing, lifetime and creation flags (see ./schema.ts).
 */

import { jsonToPayload } from '@arkiv-network/sdk';
import type { Hex } from 'viem';
import { entityAttributes, flagsFor, lifetimeFor, type AttrRecord } from './schema';
import { getEntityByKey } from './read';

/** Minimal wallet client surface used here (server private-key or browser wallet client) */
type ArkivWriter = {
  createEntity: (data: any, txParams?: any) => Promise<{ entityKey: Hex; txHash: Hex }>;
  patchEntity: (data: any, txParams?: any) => Promise<{ entityKey: Hex; txHash: Hex }>;
};

export type CreateArkivEntityParams = {
  /** Entity type (`type` attribute); also selects default lifetime and flags */
  type: string;
  /** Attributes with snake_case names (short, queryable scalars only) */
  attributes?: AttrRecord;
  /** JSON-serializable payload (long text, arrays, nested data) */
  payload?: unknown;
  /** Product-specific lifetime in seconds; defaults to the type's lifetime */
  lifetimeSeconds?: number | null;
};

/**
 * Create a p2pmentor entity.
 *
 * @returns `{ entityKey, txHash }`
 */
export async function createArkivEntity(
  walletClient: ArkivWriter,
  { type, attributes = {}, payload = {}, lifetimeSeconds }: CreateArkivEntityParams
): Promise<{ entityKey: Hex; txHash: Hex }> {
  const flags = flagsFor(type);
  const result = await walletClient.createEntity({
    payload: jsonToPayload(payload as any),
    contentType: 'application/json',
    attributes: entityAttributes(type, attributes),
    expires: lifetimeFor(type, lifetimeSeconds),
    ...(flags ? { flags } : {}),
  });
  return { entityKey: result.entityKey, txHash: result.txHash };
}

export type ReplaceArkivEntityParams = {
  entityKey: string;
  type: string;
  attributes?: AttrRecord;
  payload?: unknown;
};

/**
 * Replace an entity's attributes and payload (full-replace semantics).
 *
 * Arkiv 0.8 has no `updateEntity`; this patches with `set` for the new attributes and
 * `unset` for attributes that are no longer present. Expiry, owner and flags are not
 * changed by a patch. Patches are last-writer-wins.
 *
 * @returns `{ entityKey, txHash }`
 */
export async function replaceArkivEntity(
  walletClient: ArkivWriter,
  { entityKey, type, attributes = {}, payload = {} }: ReplaceArkivEntityParams
): Promise<{ entityKey: Hex; txHash: Hex }> {
  const set = entityAttributes(type, attributes);
  const current = await getEntityByKey(entityKey);
  const currentNames = Object.keys(current?.attributes || {}).filter((n) => !n.startsWith('$'));
  const unset = currentNames.filter((n) => !(n in set));

  const result = await walletClient.patchEntity({
    entityKey: entityKey as Hex,
    set,
    ...(unset.length > 0 ? { unset } : {}),
    payload: jsonToPayload(payload as any),
    contentType: 'application/json',
  });
  return { entityKey: result.entityKey, txHash: result.txHash };
}
