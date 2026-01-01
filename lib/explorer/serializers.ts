/**
 * Public entity serializers
 * 
 * Whitelist-based serializers that only expose public fields.
 * Private fields (email, phone, contactLinks, etc.) are explicitly excluded.
 * 
 * This is a privacy firewall - if a field is not explicitly allowed,
 * it will not be exposed via the explorer API.
 */

import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
import type { PublicProfile, PublicAsk, PublicOffer, PublicSkill } from './types';

/**
 * Serialize a user profile to public format
 * 
 * Only includes public fields:
 * - displayName, username, bioShort, skills, timezone, wallet
 * 
 * Explicitly excludes:
 * - email, phone, contactLinks (private-by-default)
 * - private notes, session details, notifications
 * - access grants, internal metadata
 */
export function serializePublicProfile(profile: UserProfile): PublicProfile {
  return {
    key: profile.key,
    type: 'profile',
    wallet: profile.wallet,
    displayName: profile.displayName,
    username: profile.username,
    bioShort: profile.bioShort,
    skillsArray: profile.skillsArray,
    timezone: profile.timezone,
    createdAt: profile.createdAt,
    txHash: profile.txHash,
    // Explicitly exclude: email, phone, contactLinks, bio, bioLong,
    // profileImage, identity_seed, exploringStatement, languages,
    // seniority, domainsOfInterest, mentorRoles, learnerRoles,
    // availabilityWindow, sessionsCompleted, sessionsGiven, sessionsReceived,
    // avgRating, npsScore, topSkillsUsage, peerTestimonials, trustEdges,
    // communityAffiliations, reputationScore, lastActiveTimestamp
  };
}

/**
 * Serialize an ask to public format
 * 
 * All fields are public by design (asks are meant to be discoverable).
 */
export function serializePublicAsk(ask: Ask): PublicAsk {
  return {
    key: ask.key,
    type: 'ask',
    wallet: ask.wallet,
    skill: ask.skill,
    skill_id: ask.skill_id,
    skill_label: ask.skill_label,
    message: ask.message,
    status: ask.status,
    createdAt: ask.createdAt,
    txHash: ask.txHash,
  };
}

/**
 * Serialize an offer to public format
 * 
 * All fields are public by design (offers are meant to be discoverable).
 */
export function serializePublicOffer(offer: Offer): PublicOffer {
  return {
    key: offer.key,
    type: 'offer',
    wallet: offer.wallet,
    skill: offer.skill,
    skill_id: offer.skill_id,
    skill_label: offer.skill_label,
    message: offer.message,
    availabilityWindow: offer.availabilityWindow,
    status: offer.status,
    isPaid: offer.isPaid,
    cost: offer.cost,
    paymentAddress: offer.paymentAddress,
    createdAt: offer.createdAt,
    txHash: offer.txHash,
  };
}

/**
 * Serialize a skill to public format
 * 
 * All fields are public by design (skills are meant to be discoverable).
 */
export function serializePublicSkill(skill: Skill): PublicSkill {
  return {
    key: skill.key,
    type: 'skill',
    name_canonical: skill.name_canonical,
    slug: skill.slug,
    description: skill.description,
    status: skill.status,
    createdAt: skill.createdAt,
    txHash: skill.txHash,
  };
}

