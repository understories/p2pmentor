/**
 * Public entity serializers
 * 
 * Serializers that expose ALL data stored on Arkiv.
 * The explorer demonstrates transparency by showing everything stored on-chain.
 * 
 * Note: Email addresses are NOT stored on Arkiv, so they are not included.
 * All other fields stored on Arkiv are included here.
 */

import type { UserProfile } from '@/lib/arkiv/profile';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
import type { PublicProfile, PublicAsk, PublicOffer, PublicSkill } from './types';

/**
 * Serialize a user profile to public format
 * 
 * Includes ALL fields stored on Arkiv to demonstrate transparency.
 * All data shown here is verifiable via transaction hashes.
 * 
 * Note: Email addresses are NOT stored on Arkiv, so they are not included.
 */
export function serializePublicProfile(profile: UserProfile): PublicProfile {
  return {
    key: profile.key,
    type: 'profile',
    wallet: profile.wallet,
    displayName: profile.displayName,
    username: profile.username,
    profileImage: profile.profileImage,
    identity_seed: profile.identity_seed,
    exploringStatement: profile.exploringStatement,
    bio: profile.bio,
    bioShort: profile.bioShort,
    bioLong: profile.bioLong,
    skills: profile.skills,
    skillsArray: profile.skillsArray,
    skillExpertise: profile.skillExpertise,
    timezone: profile.timezone,
    languages: profile.languages,
    contactLinks: profile.contactLinks, // Stored on Arkiv, so we show it
    seniority: profile.seniority,
    domainsOfInterest: profile.domainsOfInterest,
    mentorRoles: profile.mentorRoles,
    learnerRoles: profile.learnerRoles,
    availabilityWindow: profile.availabilityWindow,
    sessionsCompleted: profile.sessionsCompleted,
    sessionsGiven: profile.sessionsGiven,
    sessionsReceived: profile.sessionsReceived,
    npsScore: profile.npsScore,
    topSkillsUsage: profile.topSkillsUsage,
    peerTestimonials: profile.peerTestimonials,
    trustEdges: profile.trustEdges,
    communityAffiliations: profile.communityAffiliations,
    reputationScore: profile.reputationScore,
    lastActiveTimestamp: profile.lastActiveTimestamp,
    createdAt: profile.createdAt,
    txHash: profile.txHash,
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
    spaceId: skill.spaceId,
    createdAt: skill.createdAt,
    txHash: skill.txHash,
  };
}

