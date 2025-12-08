// Mentorship Subgraph Mappings
// 
// Handles Arkiv entity creation events and indexes them for GraphQL queries.
// 
// Reference: docs/graph_indexing_plan.md
// 
// Architecture Note:
// - Arkiv events contain: entityKey, spaceKey, creator, expiresAt
// - Entity attributes (type, wallet, skill, etc.) are stored separately
// - We index events here, then query Arkiv indexer to enrich with attributes
// - Alternative: Subgraph could call Arkiv indexer API to fetch full entity data

import { BigInt, ethereum } from "@graphprotocol/graph-ts";
import { EntityCreated, EntityStored } from "../generated/ArkivContract/ArkivContract";
import { 
  Profile, 
  Ask, 
  Offer, 
  SkillRef, 
  Session, 
  Feedback 
} from "../generated/schema";

/**
 * Handle EntityCreated event
 * 
 * This event is emitted when an entity is created on Arkiv.
 * We get: entityKey, spaceKey, creator, expiresAt
 * 
 * To get full entity data (type, wallet, skill, etc.), we need to:
 * 1. Query Arkiv indexer by entityKey
 * 2. Parse attributes from the entity
 * 3. Create appropriate subgraph entity (Profile, Ask, Offer, etc.)
 * 
 * For now, we create a minimal entity record. Full implementation would
 * need to call Arkiv indexer API or read entity data from contract storage.
 */
export function handleEntityCreated(event: EntityCreated): void {
  const entityKey = event.params.entityKey.toHexString();
  const spaceKey = event.params.spaceKey.toHexString();
  const creator = event.params.creator.toHexString();
  const expiresAt = event.params.expiresAt;

  // TODO: Query Arkiv indexer to get entity attributes
  // For now, we'll need to implement a way to fetch entity data
  // Options:
  // 1. Call Arkiv indexer API from mapping (if supported)
  // 2. Read entity data from contract storage (if exposed)
  // 3. Index minimal data here, enrich in GraphQL resolver
  
  // Placeholder: We'd parse entity type from attributes and create appropriate entity
  // This requires fetching entity from Arkiv indexer first
  
  // Example structure (not yet functional):
  // const entityData = fetchEntityFromArkiv(entityKey);
  // const entityType = entityData.attributes.find(a => a.key === 'type')?.value;
  // 
  // if (entityType === 'ask') {
  //   createAskEntity(entityKey, entityData, creator, expiresAt);
  // } else if (entityType === 'offer') {
  //   createOfferEntity(entityKey, entityData, creator, expiresAt);
  // } else if (entityType === 'user_profile') {
  //   createProfileEntity(entityKey, entityData, creator, expiresAt);
  // }
}

/**
 * Handle EntityStored event
 * 
 * This event may be emitted when entity data is stored/updated.
 * Similar to EntityCreated, we need to enrich with data from indexer.
 */
export function handleEntityStored(event: EntityStored): void {
  const entityKey = event.params.entityKey.toHexString();
  const spaceKey = event.params.spaceKey.toHexString();
  const expiresAt = event.params.expiresAt;

  // TODO: Similar to handleEntityCreated
  // Update existing entity or create if doesn't exist
}

/**
 * Helper: Create Ask entity from Arkiv entity data
 */
function createAskEntity(
  entityKey: string,
  entityData: any, // Would be typed based on Arkiv entity structure
  creator: string,
  expiresAt: BigInt
): void {
  // Parse attributes
  const wallet = getAttribute(entityData, 'wallet');
  const skill = getAttribute(entityData, 'skill');
  const status = getAttribute(entityData, 'status');
  const createdAt = getAttribute(entityData, 'createdAt');
  
  // Create or update Ask entity
  let ask = Ask.load(entityKey);
  if (!ask) {
    ask = new Ask(entityKey);
  }
  
  ask.id = entityKey;
  ask.wallet = wallet;
  ask.status = status;
  ask.createdAt = BigInt.fromString(createdAt);
  ask.expiresAt = expiresAt;
  
  // Link to Profile and SkillRef
  // ask.profile = Profile.load(wallet).id;
  // ask.skill = SkillRef.load(normalizeSkill(skill)).id;
  
  ask.save();
}

/**
 * Helper: Get attribute value from entity data
 */
function getAttribute(entityData: any, key: string): string {
  // Would parse from entityData.attributes array
  // For now, placeholder
  return "";
}

/**
 * Helper: Normalize skill name (lowercase)
 */
function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim();
}
