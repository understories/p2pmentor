/**
 * Canonical entity upsert helper
 *
 * Creates an entity, or replaces an existing entity's attributes and payload
 * (Arkiv 0.8 `patchEntity`). Built on ./write.ts, so every write follows the
 * p2pmentor schema (./schema.ts).
 */

import { getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { addSignerMetadata } from './signer-metadata';
import type { AttrRecord } from './schema';
import { createArkivEntity, replaceArkivEntity } from './write';

/**
 * Upsert an entity (create or update)
 *
 * If `key` is provided, replaces that entity's attributes and payload (patchEntity).
 * Otherwise creates a new entity.
 *
 * @param params - Upsert parameters
 * @param params.type - Entity type (e.g., 'user_profile', 'notification_preference')
 * @param params.key - Optional entity key. If provided, updates; otherwise creates.
 * @param params.attributes - Attributes (snake_case names; `type` is added automatically)
 * @param params.payload - JSON-serializable payload
 * @param params.lifetimeSeconds - Optional lifetime override for creates (seconds)
 * @param params.privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function arkivUpsertEntity({
  type,
  key,
  attributes,
  payload,
  lifetimeSeconds,
  privateKey,
}: {
  type: string;
  key?: string;
  attributes: AttrRecord;
  payload: unknown;
  lifetimeSeconds?: number;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);

  // Add signer metadata to attributes (U1.x.2: Central Signer Metadata)
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await handleTransactionWithTimeout(async () => {
    if (key) {
      return await replaceArkivEntity(walletClient, {
        entityKey: key,
        type,
        attributes: attributesWithSigner,
        payload,
      });
    }
    return await createArkivEntity(walletClient, {
      type,
      attributes: attributesWithSigner,
      payload,
      lifetimeSeconds,
    });
  });

  return { key: result.entityKey, txHash: result.txHash };
}
