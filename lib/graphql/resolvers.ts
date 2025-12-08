/**
 * GraphQL Resolvers for Arkiv Mentorship Data
 * 
 * Resolvers translate GraphQL queries to Arkiv JSON-RPC queries.
 * Reusable tool for any Arkiv-based application.
 */

import { listAsks, listAsksForWallet } from '@/lib/arkiv/asks';
import { listOffers, listOffersForWallet } from '@/lib/arkiv/offers';
import { getProfileByWallet, listUserProfiles } from '@/lib/arkiv/profile';
import { listSessionsForWallet } from '@/lib/arkiv/sessions';
import { transformAsk, transformOffer, transformProfile, transformSession, createSkillRef } from './transformers';

/**
 * Build network overview with skills, asks, and offers
 */
async function buildNetworkOverview(args: any) {
  const {
    skill: skillFilter,
    limitSkills = 100,
    limitAsks = 500,
    limitOffers = 500,
    includeExpired = false,
  } = args;

  // Fetch asks and offers
  const [asks, offers] = await Promise.all([
    listAsks({ limit: limitAsks, includeExpired, skill: skillFilter }),
    listOffers({ limit: limitOffers, includeExpired, skill: skillFilter }),
  ]);

  // Group by skill
  const skillMap = new Map<string, { asks: any[]; offers: any[] }>();

  asks.forEach(ask => {
    if (!ask.skill) return;
    const skillName = ask.skill.toLowerCase().trim();
    if (!skillMap.has(skillName)) {
      skillMap.set(skillName, { asks: [], offers: [] });
    }
    skillMap.get(skillName)!.asks.push(ask);
  });

  offers.forEach(offer => {
    if (!offer.skill) return;
    const skillName = offer.skill.toLowerCase().trim();
    if (!skillMap.has(skillName)) {
      skillMap.set(skillName, { asks: [], offers: [] });
    }
    skillMap.get(skillName)!.offers.push(offer);
  });

  // Build skill refs
  const skillRefs = Array.from(skillMap.entries())
    .slice(0, limitSkills)
    .map(([skillName, data]) => createSkillRef(skillName, data.asks, data.offers));

  return { skillRefs };
}

export const resolvers = {
  Query: {
    networkOverview: async (_: any, args: any) => {
      try {
        return buildNetworkOverview(args);
      } catch (error) {
        console.error('Error building network overview:', error);
        return { skillRefs: [] };
      }
    },

    profile: async (_: any, { wallet }: { wallet: string }) => {
      try {
        const profile = await getProfileByWallet(wallet);
        return profile ? transformProfile(profile) : null;
      } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
    },

    profiles: async (_: any, args: any) => {
      const { skill, seniority, limit = 100 } = args;
      try {
        const profiles = await listUserProfiles({ skill, seniority });
        return profiles.slice(0, limit).map(transformProfile);
      } catch (error) {
        console.error('Error fetching profiles:', error);
        return [];
      }
    },

    asks: async (_: any, args: any) => {
      const { skill, wallet, includeExpired = false, limit = 100 } = args;
      
      try {
        let asks;
        if (wallet) {
          asks = await listAsksForWallet(wallet);
        } else {
          asks = await listAsks({ skill, includeExpired, limit });
        }

        return asks.map(transformAsk);
      } catch (error) {
        console.error('Error fetching asks:', error);
        return [];
      }
    },

    ask: async (_: any, { key }: { key: string }) => {
      const asks = await listAsks({ limit: 1000, includeExpired: true });
      const ask = asks.find(a => a.key === key);
      return ask ? transformAsk(ask) : null;
    },

    offers: async (_: any, args: any) => {
      const { skill, wallet, includeExpired = false, limit = 100 } = args;
      
      try {
        let offers;
        if (wallet) {
          offers = await listOffersForWallet(wallet);
        } else {
          offers = await listOffers({ skill, includeExpired, limit });
        }

        return offers.map(transformOffer);
      } catch (error) {
        console.error('Error fetching offers:', error);
        return [];
      }
    },

    offer: async (_: any, { key }: { key: string }) => {
      const offers = await listOffers({ limit: 1000, includeExpired: true });
      const offer = offers.find(o => o.key === key);
      return offer ? transformOffer(offer) : null;
    },

    skills: async (_: any, args: any) => {
      const { search, limit = 100 } = args;
      try {
        const overview = await buildNetworkOverview({ limitSkills: limit });
        
        let skillRefs = overview.skillRefs;
        
        if (search) {
          const searchLower = search.toLowerCase();
          skillRefs = skillRefs.filter(sr => sr.name.includes(searchLower));
        }
        
        return skillRefs;
      } catch (error) {
        console.error('Error fetching skills:', error);
        return [];
      }
    },

    skill: async (_: any, { name }: { name: string }) => {
      const overview = await buildNetworkOverview({ limitSkills: 1000 });
      const skillRef = overview.skillRefs.find(sr => sr.name === name.toLowerCase().trim());
      return skillRef || null;
    },

    meOverview: async (_: any, args: any) => {
      const { 
        wallet, 
        limitAsks = 50, 
        limitOffers = 50, 
        limitSessions = 50 
      } = args;

      try {
        // Fetch all data in parallel
        const [profile, asks, offers, sessions] = await Promise.all([
          getProfileByWallet(wallet).catch(() => null),
          listAsksForWallet(wallet).catch(() => []),
          listOffersForWallet(wallet).catch(() => []),
          listSessionsForWallet(wallet).catch(() => []),
        ]);

        return {
          profile: profile ? transformProfile(profile) : null,
          asks: asks.slice(0, limitAsks).map(transformAsk),
          offers: offers.slice(0, limitOffers).map(transformOffer),
          sessions: sessions.slice(0, limitSessions).map(transformSession),
        };
      } catch (error) {
        console.error('Error fetching meOverview:', error);
        return {
          profile: null,
          asks: [],
          offers: [],
          sessions: [],
        };
      }
    },
  },

  SkillRef: {
    asks: async (parent: any, args: any) => {
      const { includeExpired = false, limit = 100 } = args;
      const asks = await listAsks({ 
        skill: parent.name, 
        includeExpired, 
        limit 
      });
      return asks.map(transformAsk);
    },

    offers: async (parent: any, args: any) => {
      const { includeExpired = false, limit = 100 } = args;
      const offers = await listOffers({ 
        skill: parent.name, 
        includeExpired, 
        limit 
      });
      return offers.map(transformOffer);
    },

    profiles: async (parent: any, args: any) => {
      const { limit = 100 } = args;
      const profiles = await listUserProfiles({ skill: parent.name });
      return profiles.slice(0, limit).map(transformProfile);
    },
  },

  Profile: {
    asks: async (parent: any, args: any) => {
      const { limit = 100 } = args;
      const asks = await listAsksForWallet(parent.wallet);
      return asks.slice(0, limit).map(transformAsk);
    },

    offers: async (parent: any, args: any) => {
      const { limit = 100 } = args;
      const offers = await listOffersForWallet(parent.wallet);
      return offers.slice(0, limit).map(transformOffer);
    },
  },

  Ask: {
    profile: async (parent: any) => {
      const profile = await getProfileByWallet(parent.wallet);
      return profile ? transformProfile(profile) : null;
    },
  },

  Offer: {
    profile: async (parent: any) => {
      const profile = await getProfileByWallet(parent.wallet);
      return profile ? transformProfile(profile) : null;
    },
  },
};

