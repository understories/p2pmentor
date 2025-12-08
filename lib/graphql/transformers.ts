/**
 * Transformers: Arkiv Entities → GraphQL Types
 * 
 * Converts Arkiv entity structures to GraphQL response format.
 */

import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Session } from '@/lib/arkiv/sessions';

/**
 * Transform Arkiv Ask to GraphQL Ask
 */
export function transformAsk(ask: Ask): any {
  const createdAt = new Date(ask.createdAt).getTime();
  const expiresAt = ask.ttlSeconds 
    ? createdAt + (ask.ttlSeconds * 1000)
    : null;

  return {
    id: `ask:${ask.key}`,
    key: ask.key,
    wallet: ask.wallet,
    skill: ask.skill,
    message: ask.message,
    status: ask.status,
    createdAt: ask.createdAt,
    expiresAt: expiresAt ? BigInt(expiresAt) : null,
    ttlSeconds: ask.ttlSeconds,
    txHash: ask.txHash || null,
  };
}

/**
 * Transform Arkiv Offer to GraphQL Offer
 */
export function transformOffer(offer: Offer): any {
  const createdAt = new Date(offer.createdAt).getTime();
  const expiresAt = offer.ttlSeconds 
    ? createdAt + (offer.ttlSeconds * 1000)
    : null;

  return {
    id: `offer:${offer.key}`,
    key: offer.key,
    wallet: offer.wallet,
    skill: offer.skill,
    message: offer.message,
    availabilityWindow: offer.availabilityWindow,
    isPaid: offer.isPaid,
    cost: offer.cost || null,
    paymentAddress: offer.paymentAddress || null,
    status: offer.status,
    createdAt: offer.createdAt,
    expiresAt: expiresAt ? BigInt(expiresAt) : null,
    ttlSeconds: offer.ttlSeconds,
    txHash: offer.txHash || null,
  };
}

/**
 * Transform Arkiv Profile to GraphQL Profile
 */
export function transformProfile(profile: UserProfile): any {
  const skills = profile.skillsArray || 
    (profile.skills ? profile.skills.split(',').map(s => s.trim()).filter(Boolean) : []);
  
  const createdAt = profile.createdAt 
    ? new Date(profile.createdAt).getTime()
    : null;

  return {
    id: profile.wallet,
    wallet: profile.wallet,
    displayName: profile.displayName,
    username: profile.username || null,
    bio: profile.bio || null,
    bioShort: profile.bioShort || null,
    bioLong: profile.bioLong || null,
    timezone: profile.timezone,
    seniority: profile.seniority || null,
    skills: skills,
    availabilityWindow: profile.availabilityWindow || null,
    createdAt: createdAt ? BigInt(createdAt) : null,
  };
}

/**
 * Transform Arkiv Session to GraphQL Session
 */
export function transformSession(session: Session): any {
  // Parse sessionDate to extract date and time
  const sessionDate = new Date(session.sessionDate);
  const date = sessionDate.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = sessionDate.toTimeString().split(' ')[0].slice(0, 5); // HH:MM
  const duration = session.duration ? `${session.duration} minutes` : '60 minutes';

  return {
    id: `session:${session.key}`,
    key: session.key,
    mentorWallet: session.mentorWallet,
    learnerWallet: session.learnerWallet,
    skill: session.skill,
    date,
    time,
    duration,
    notes: session.notes || null,
    status: session.status,
    mentorConfirmed: session.mentorConfirmed || false,
    learnerConfirmed: session.learnerConfirmed || false,
    createdAt: session.createdAt,
    txHash: session.txHash || null,
  };
}

/**
 * Transform to SkillRef format
 */
export function createSkillRef(skillName: string, asks: Ask[] = [], offers: Offer[] = []): any {
  return {
    id: `skill:${skillName.toLowerCase().trim()}`,
    name: skillName.toLowerCase().trim(),
    asks: asks.map(transformAsk),
    offers: offers.map(transformOffer),
    profiles: [], // Will be populated by resolver if needed
  };
}

