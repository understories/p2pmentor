/**
 * Topic Detail Page
 * 
 * Displays a dedicated page for a specific skill/topic.
 * Shows all asks, offers, and matches for that skill.
 * 
 * Route: /topic/[slug]
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { SkillCluster } from '@/components/network/SkillCluster';
import type { Ask } from '@/lib/arkiv/asks';
import type { Offer } from '@/lib/arkiv/offers';
import type { Skill } from '@/lib/arkiv/skill';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { VirtualGathering } from '@/lib/arkiv/virtualGathering';
import type { Session } from '@/lib/arkiv/sessions';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { formatSessionTitle } from '@/lib/sessions/display';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { GardenBoard } from '@/components/garden/GardenBoard';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { buildBuilderModeParams, appendBuilderModeParams } from '@/lib/utils/builderMode';
import { SkillSelector } from '@/components/SkillSelector';
import { askColors, askEmojis, offerColors, offerEmojis } from '@/lib/colors';
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor';
import { createDefaultWeeklyAvailability, formatAvailabilityForDisplay, listAvailabilityForWallet, type WeeklyAvailability } from '@/lib/arkiv/availability';
import { ArkivQueryTester } from '@/components/arkiv/ArkivQueryTester';
import { RequestMeetingModal } from '@/components/RequestMeetingModal';

type Match = {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
};

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  
  const [skill, setSkill] = useState<Skill | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gatherings, setGatherings] = useState<VirtualGathering[]>([]);
  const [communitySessions, setCommunitySessions] = useState<Session[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, boolean>>({});
  const [sessionRsvpStatus, setSessionRsvpStatus] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [communityProfiles, setCommunityProfiles] = useState<UserProfile[]>([]);
  const [loadingCommunityProfiles, setLoadingCommunityProfiles] = useState(false);
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [rsvpWallets, setRsvpWallets] = useState<Record<string, string[]>>({}); // gatheringKey -> array of wallet addresses
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rsvping, setRsvping] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [submittingFollow, setSubmittingFollow] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: '60',
  });
  const [showCreateAskForm, setShowCreateAskForm] = useState(false);
  const [showCreateOfferForm, setShowCreateOfferForm] = useState(false);
  const [submittingAsk, setSubmittingAsk] = useState(false);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [askError, setAskError] = useState('');
  const [offerError, setOfferError] = useState('');
  const [askSuccess, setAskSuccess] = useState('');
  const [offerSuccess, setOfferSuccess] = useState('');
  const [showAdvancedOptionsAsk, setShowAdvancedOptionsAsk] = useState(false);
  const [showAdvancedOptionsOffer, setShowAdvancedOptionsOffer] = useState(false);
  const [newAsk, setNewAsk] = useState({ 
    skill: '',
    skill_id: '',
    message: '',
    ttlHours: '24',
    customTtlHours: '',
  });
  const [newOffer, setNewOffer] = useState({ 
    skill: '',
    skill_id: '',
    message: '', 
    availabilityWindow: '',
    availabilityKey: '',
    availabilityType: 'structured' as 'saved' | 'structured',
    structuredAvailability: null as WeeklyAvailability | null,
    isPaid: false,
    cost: '',
    paymentAddress: '',
    ttlHours: '168',
    customTtlHours: '',
  });
  const [userAvailability, setUserAvailability] = useState<WeeklyAvailability | null>(null);
  const [savedAvailabilityBlocks, setSavedAvailabilityBlocks] = useState<Array<{ key: string; name: string }>>([]);
  const arkivBuilderMode = useArkivBuilderMode();
  // Request Meeting Modal state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingMode, setMeetingMode] = useState<'request' | 'offer'>('request');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedAsk, setSelectedAsk] = useState<Ask | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Get user wallet and profile first
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setUserWallet(address);
      if (address) {
        getProfileByWallet(address.toLowerCase().trim())
          .then(setUserProfile)
          .catch(() => null);
      }
    }
  }, []);

  useEffect(() => {
    if (slug) {
      loadTopicData();
    }
  }, [slug, userWallet]);

  // Load membership status when skill and userWallet are available
  useEffect(() => {
    if (skill?.key && userWallet) {
      loadMembershipStatus();
    }
  }, [skill?.key, userWallet]);

  // Load community profiles when skill is available
  useEffect(() => {
    if (skill) {
      loadCommunityProfiles();
    }
  }, [skill]);

  const loadMembershipStatus = async () => {
    if (!skill?.key || !userWallet) return;

    try {
      // listLearningFollows handles soft-delete pattern (returns most recent entity per profile+skill)
      // If active: true is passed, it only returns follows where most recent entity is active
      const follows = await listLearningFollows({
        profile_wallet: userWallet.toLowerCase(),
        skill_id: skill.key,
        active: true
      });
      setIsJoined(follows.length > 0);
    } catch (error) {
      console.error('Error loading membership status:', error);
      setIsJoined(false);
    }
  };

  const loadCommunityProfiles = async () => {
    if (!skill) return;

    try {
      setLoadingCommunityProfiles(true);
      const builderParams = buildBuilderModeParams(arkivBuilderMode);
      const params = new URLSearchParams();
      params.set('skill', skill.name_canonical);
      if (arkivBuilderMode) {
        params.set('builderMode', 'true');
        params.set('spaceIds', 'beta-launch,local-dev,local-dev-seed');
      }
      const url = `/api/profiles?${params.toString()}${builderParams ? `&${builderParams.slice(1)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.ok && data.profiles) {
        // Filter by skill_id if available (more accurate than name matching)
        let filtered = data.profiles;
        if (skill.key) {
          filtered = data.profiles.filter((profile: UserProfile) => {
            // Check skill_ids array (preferred, beta)
            const skillIds = (profile as any).skill_ids || [];
            if (skillIds.includes(skill.key)) {
              return true;
            }
            // Check skillsArray (legacy) - match by name
            if (profile.skillsArray && Array.isArray(profile.skillsArray)) {
              return profile.skillsArray.some(skillName => 
                skillName.toLowerCase().trim() === skill.name_canonical.toLowerCase().trim()
              );
            }
            // Check skills string (legacy)
            if (profile.skills) {
              const skillsList = profile.skills.toLowerCase().split(',').map((s: string) => s.trim());
              return skillsList.includes(skill.name_canonical.toLowerCase().trim());
            }
            return false;
          });
        }
        setCommunityProfiles(filtered);
      }
    } catch (err) {
      console.error('Error loading community profiles:', err);
      setCommunityProfiles([]);
    } finally {
      setLoadingCommunityProfiles(false);
    }
  };

  const loadTopicData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all skills for mapping skill_id to name_canonical
      const { listSkills, normalizeSkillSlug } = await import('@/lib/arkiv/skill');
      const skills = await listSkills({ status: 'active', limit: 200 });
      const skillsMap: Record<string, Skill> = {};
      skills.forEach(skill => {
        skillsMap[skill.key] = skill;
      });
      setSkillsMap(skillsMap);

      // Load skill by slug (Arkiv-native: query skill entity)
      let skillEntity: Skill | null = null;
      const skillRes = await fetch(`/api/skills?slug=${encodeURIComponent(slug)}&limit=1`);
      const skillData = await skillRes.json();
      
      if (skillData.ok && skillData.skills && skillData.skills.length > 0) {
        skillEntity = skillData.skills[0];
      } else {
        // Skill not found by exact slug - try to find by normalized slug matching
        // This handles cases where slug normalization might differ or slug is missing
        const normalizedSlug = normalizeSkillSlug(slug);
        
        // Find skill where slug matches (normalized) or name_canonical normalizes to this slug
        skillEntity = skills.find(s => {
          if (!s.slug && !s.name_canonical) return false;
          const skillNormalizedSlug = s.slug ? normalizeSkillSlug(s.slug) : normalizeSkillSlug(s.name_canonical);
          return skillNormalizedSlug === normalizedSlug || 
                 s.slug === slug || 
                 normalizeSkillSlug(s.name_canonical) === normalizedSlug;
        }) || null;
        
        // If still not found, but skill exists on explore page (meaning it's in Arkiv),
        // ensure skill entity exists using the slug to derive name_canonical
        // This is Arkiv-native: create the skill entity if it doesn't exist
        if (!skillEntity) {
          try {
            // Derive name_canonical from slug (reverse normalization)
            // Convert "solidity" -> "Solidity", "spanish-conversation" -> "Spanish Conversation"
            const derivedName = slug
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            // Ensure skill entity exists (will create if needed, returns existing if found)
            // Uses server-side signing wallet (Arkiv-native)
            const { ensureSkillEntity } = await import('@/lib/arkiv/skill-helpers');
            const ensuredSkill = await ensureSkillEntity(derivedName);
            
            if (ensuredSkill) {
              // Re-query by slug after creation/ensuring
              const retryRes = await fetch(`/api/skills?slug=${encodeURIComponent(ensuredSkill.slug)}&limit=1`);
              const retryData = await retryRes.json();
              if (retryData.ok && retryData.skills && retryData.skills.length > 0) {
                skillEntity = retryData.skills[0];
              } else {
                // If slug still doesn't match, try to find by key in our loaded skills
                const foundByKey = skills.find(s => s.key === ensuredSkill.key);
                if (foundByKey) {
                  skillEntity = foundByKey;
                } else {
                  // Last resort: query all skills again to find the newly created one
                  const allSkillsRetry = await listSkills({ status: 'active', limit: 200 });
                  const foundByKeyRetry = allSkillsRetry.find(s => s.key === ensuredSkill.key);
                  if (foundByKeyRetry) {
                    skillEntity = foundByKeyRetry;
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[topic] Error ensuring skill entity:', err);
          }
        }
      }
      
      if (!skillEntity) {
        setError('Topic not found');
        setLoading(false);
        return;
      }

      setSkill(skillEntity);

      // Load asks, offers, virtual gatherings, and sessions for this community
      const builderParams = buildBuilderModeParams(arkivBuilderMode);
      const gatheringsParams = `?community=${encodeURIComponent(skillEntity.slug)}${userWallet ? `&wallet=${encodeURIComponent(userWallet)}` : ''}`;
      const sessionsParams = `?skill=${encodeURIComponent(skillEntity.name_canonical)}&status=scheduled`;
      const [asksRes, offersRes, gatheringsRes, sessionsRes] = await Promise.all([
        fetch(`/api/asks${builderParams}`).then(r => r.json()),
        fetch(`/api/offers${builderParams}`).then(r => r.json()),
        fetch(`/api/virtual-gatherings${appendBuilderModeParams(arkivBuilderMode, gatheringsParams)}`).then(r => r.json()),
        fetch(`/api/sessions${appendBuilderModeParams(arkivBuilderMode, sessionsParams)}`).then(r => r.json()).catch(() => ({ ok: false, sessions: [] })),
      ]);

      // Filter by skill_id
      const skillAsks = (asksRes.ok ? asksRes.asks || [] : []).filter(
        (ask: Ask) => ask.skill_id === skillEntity.key
      );
      const skillOffers = (offersRes.ok ? offersRes.offers || [] : []).filter(
        (offer: Offer) => offer.skill_id === skillEntity.key
      );

      setAsks(skillAsks);
      setOffers(skillOffers);

      // Load virtual gatherings for this community
      if (gatheringsRes.ok && gatheringsRes.gatherings) {
        setGatherings(gatheringsRes.gatherings);
        if (gatheringsRes.rsvpStatus) {
          setRsvpStatus(gatheringsRes.rsvpStatus);
        }
        
        // Fetch RSVP wallets for each gathering
        const rsvpWalletsMap: Record<string, string[]> = {};
        const rsvpPromises = gatheringsRes.gatherings.map(async (gathering: VirtualGathering) => {
          try {
            const rsvpRes = await fetch(`/api/virtual-gatherings?gatheringKey=${encodeURIComponent(gathering.key)}`);
            const rsvpData = await rsvpRes.json();
            if (rsvpData.ok && rsvpData.rsvpWallets) {
              rsvpWalletsMap[gathering.key] = rsvpData.rsvpWallets;
            }
          } catch (err) {
            console.warn(`Error fetching RSVPs for gathering ${gathering.key}:`, err);
          }
        });
        await Promise.all(rsvpPromises);
        setRsvpWallets(rsvpWalletsMap);
        
        // Load profiles for all RSVP wallets
        const allRsvpWallets = new Set<string>();
        Object.values(rsvpWalletsMap).forEach(wallets => {
          wallets.forEach(wallet => allRsvpWallets.add(wallet));
        });
        
        const rsvpProfilePromises = Array.from(allRsvpWallets).map(async (wallet) => {
          try {
            const profile = await getProfileByWallet(wallet);
            return { wallet, profile };
          } catch {
            return { wallet, profile: null };
          }
        });
        
        const rsvpProfileResults = await Promise.all(rsvpProfilePromises);
        const updatedProfiles = { ...profiles };
        rsvpProfileResults.forEach(({ wallet, profile }) => {
          if (profile) {
            updatedProfiles[wallet.toLowerCase()] = profile;
          }
        });
        setProfiles(updatedProfiles);
      }

      // Load sessions for this community (skill-based sessions)
      let skillBasedSessions: Session[] = [];
      if (sessionsRes.ok && sessionsRes.sessions) {
        // Filter to upcoming sessions only (that haven't ended yet)
        const now = Date.now();
        skillBasedSessions = sessionsRes.sessions.filter((s: Session) => {
          const sessionTime = new Date(s.sessionDate).getTime();
          const duration = (s.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
          const buffer = 60 * 60 * 1000; // 1 hour buffer
          const sessionEnd = sessionTime + duration + buffer;
          return now < sessionEnd && s.status !== 'completed' && s.status !== 'declined' && s.status !== 'cancelled';
        });
      }

      // Also load sessions linked to virtual gatherings for this community
      // Arkiv-native approach: Group RSVP sessions by gatheringKey to avoid duplicates
      // Each gathering has multiple RSVP sessions (one per person), but we only want to display the gathering once
      let gatheringSessions: Session[] = [];
      if (gatheringsRes.ok && gatheringsRes.gatherings && gatheringsRes.gatherings.length > 0) {
        const gatheringKeys = gatheringsRes.gatherings.map((g: VirtualGathering) => g.key);
        // Query all virtual_gathering_rsvp sessions and filter by gatheringKey
          try {
          const gatheringSessionsParams = `?skill=virtual_gathering_rsvp&status=scheduled`;
          const gatheringSessionsRes = await fetch(`/api/sessions${appendBuilderModeParams(arkivBuilderMode, gatheringSessionsParams)}`).then(r => r.json()).catch(() => ({ ok: false, sessions: [] }));
          
          if (gatheringSessionsRes.ok && gatheringSessionsRes.sessions) {
            // Filter sessions that match gathering keys for this community
            const allGatheringSessions = gatheringSessionsRes.sessions.filter((s: Session) => {
              const notes = s.notes || '';
              const gatheringKey = (s as any).gatheringKey;
              // Check if session notes contains gatheringKey for any of our gatherings
              return gatheringKeys.some((key: string) => 
                gatheringKey === key ||
                notes.includes(`virtual_gathering_rsvp:${key}`) || 
                notes.includes(key)
              );
            });
            
            // Arkiv-native deduplication: Group by gatheringKey and keep only one session per gathering
            // This ensures each gathering is displayed only once, even though there are multiple RSVP sessions
            const sessionsByGathering = new Map<string, Session>();
            allGatheringSessions.forEach((s: Session) => {
              const notes = s.notes || '';
              const gatheringKey = (s as any).gatheringKey || 
                notes.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1] ||
                (notes.includes('virtual_gathering_rsvp:') ? gatheringKeys.find((k: string) => notes.includes(k)) : null);
              
              if (gatheringKey && !sessionsByGathering.has(gatheringKey)) {
                // Keep the first session for each gathering (they all have the same gathering info)
                sessionsByGathering.set(gatheringKey, s);
              }
            });
            
            gatheringSessions = Array.from(sessionsByGathering.values());
          }
        } catch (err) {
          console.warn('Error loading gathering sessions:', err);
        }
      }

      // Combine and deduplicate all sessions by key (single state update)
      const allSessions = [...skillBasedSessions, ...gatheringSessions];
      const uniqueSessions = new Map<string, Session>();
      allSessions.forEach(s => uniqueSessions.set(s.key, s));
      const sortedSessions = Array.from(uniqueSessions.values()).sort((a, b) => 
        new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
      );
      setCommunitySessions(sortedSessions);

      // Check RSVP status for community sessions (if user wallet is available)
      if (userWallet && gatheringSessions.length > 0) {
        const { hasRsvpdToGathering } = await import('@/lib/arkiv/virtualGathering');
        const gatheringKeys = gatheringsRes.ok && gatheringsRes.gatherings 
          ? gatheringsRes.gatherings.map((g: VirtualGathering) => g.key)
          : [];
        
        const sessionRsvpChecks = gatheringSessions.map(async (s: Session) => {
          // Extract gatheringKey from session attributes or notes
          const gatheringKey = (s as any).gatheringKey || 
            (s.notes?.match(/virtual_gathering_rsvp:([^\s,]+)/)?.[1]) ||
            (s.notes?.includes('virtual_gathering_rsvp:') ? gatheringKeys.find((k: string) => s.notes?.includes(k)) : null);
          
          if (gatheringKey) {
            // Get the gathering to get its spaceId for accurate filtering
            const gathering = gatheringsRes.ok && gatheringsRes.gatherings 
              ? gatheringsRes.gatherings.find((g: VirtualGathering) => g.key === gatheringKey)
              : null;
            const spaceId = gathering?.spaceId;
            const hasRsvpd = await hasRsvpdToGathering(gatheringKey, userWallet, spaceId);
            return { sessionKey: s.key, gatheringKey, hasRsvpd };
          }
          return null;
        });
        
        const rsvpResults = await Promise.all(sessionRsvpChecks);
        const sessionRsvpMap: Record<string, boolean> = {};
        rsvpResults.forEach(result => {
          if (result) {
            sessionRsvpMap[result.sessionKey] = result.hasRsvpd;
          }
        });
        setSessionRsvpStatus(sessionRsvpMap);
      }

      // Load profiles for all unique wallets (asks, offers, sessions, gatherings)
      const allWallets = new Set<string>();
      skillAsks.forEach((ask: Ask) => allWallets.add(ask.wallet));
      skillOffers.forEach((offer: Offer) => allWallets.add(offer.wallet));
      communitySessions.forEach((session: Session) => {
        allWallets.add(session.mentorWallet);
        allWallets.add(session.learnerWallet);
      });
      if (gatheringsRes.ok && gatheringsRes.gatherings) {
        gatheringsRes.gatherings.forEach((g: VirtualGathering) => allWallets.add(g.organizerWallet));
      }

      const profilePromises = Array.from(allWallets).map(async (wallet) => {
        try {
          const profile = await getProfileByWallet(wallet);
          return { wallet, profile };
        } catch {
          return { wallet, profile: null };
        }
      });

      const profileResults = await Promise.all(profilePromises);
      const profilesMap: Record<string, UserProfile> = {};
      profileResults.forEach(({ wallet, profile }) => {
        if (profile) {
          profilesMap[wallet] = profile;
        }
      });
      setProfiles(profilesMap);

      // Compute matches
      const matchesList: Match[] = [];
      skillAsks.forEach((ask: Ask) => {
        skillOffers.forEach((offer: Offer) => {
          // Match if they have the same skill_id
          if (ask.skill_id === offer.skill_id && ask.skill_id === skillEntity.key) {
            matchesList.push({
              ask,
              offer,
              askProfile: profilesMap[ask.wallet],
              offerProfile: profilesMap[offer.wallet],
              skillMatch: skillEntity.name_canonical,
            });
          }
        });
      });

      // Sort by creation date (newest first)
      matchesList.sort((a, b) => {
        const aTime = new Date(a.ask.createdAt).getTime();
        const bTime = new Date(b.ask.createdAt).getTime();
        return bTime - aTime;
      });

      setMatches(matchesList);
    } catch (err: any) {
      console.error('Error loading topic data:', err);
      setError(err.message || 'Failed to load topic');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (gatheringKey: string) => {
    if (!userWallet) {
      alert('Please connect your wallet first');
      return;
    }

    setRsvping(gatheringKey);
    try {
      const res = await fetch('/api/virtual-gatherings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rsvp',
          gatheringKey,
          wallet: userWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to RSVP');
      }

      // Update RSVP status for both gatherings and sessions
      setRsvpStatus(prev => ({ ...prev, [gatheringKey]: true }));
      
      // Update session RSVP status for any sessions linked to this gathering
      const updatedSessionRsvp: Record<string, boolean> = {};
      communitySessions.forEach(s => {
        const sessionGatheringKey = (s as any).gatheringKey || 
          (s.notes?.match(/virtual_gathering_rsvp:([^\s]+)/)?.[1]) ||
          (s.notes?.includes('virtual_gathering_rsvp:') ? gatherings.find(g => s.notes?.includes(g.key))?.key : null);
        if (sessionGatheringKey === gatheringKey) {
          updatedSessionRsvp[s.key] = true;
        }
      });
      setSessionRsvpStatus(prev => ({ ...prev, ...updatedSessionRsvp }));
      
      // Wait for Arkiv to index the new RSVP entity before reloading
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reload gatherings to get updated RSVP count and wallets list
      loadTopicData();
    } catch (err: any) {
      console.error('Error RSVPing to gathering:', err);
      alert(err.message || 'Failed to RSVP');
    } finally {
      setRsvping(null);
    }
  };

  const formatSessionDate = (sessionDate: string): { date: string; time: string; isPast: boolean; isToday: boolean } => {
    const date = new Date(sessionDate);
    const now = new Date();
    const isPast = date < now;
    const isToday = date.toDateString() === now.toDateString();
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      isPast,
      isToday,
    };
  };

  const loadUserAvailability = async (wallet: string) => {
    try {
      const res = await fetch(`/api/availability?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (data.ok && data.availabilities && data.availabilities.length > 0) {
        // Use the first availability's timeBlocks as default
        const firstAvail = data.availabilities[0];
        if (firstAvail.timeBlocks) {
          setUserAvailability(firstAvail.timeBlocks);
        }
      } else {
        // No saved availability, create default
        const profile = await getProfileByWallet(wallet).catch(() => null);
        const timezone = profile?.timezone || 'UTC';
        setUserAvailability(createDefaultWeeklyAvailability(timezone));
      }
      
      // Load saved availability blocks for dropdown
      if (data.ok && data.availabilities) {
        const formatted = data.availabilities.map((avail: any) => ({
          key: avail.key,
          name: avail.name || `Availability ${avail.key.slice(0, 8)}`,
        }));
        setSavedAvailabilityBlocks(formatted);
      }
    } catch (err) {
      console.error('Error loading availability:', err);
      // Fallback to default
      setUserAvailability(createDefaultWeeklyAvailability('UTC'));
    }
  };

  const handleCreateAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsk.skill_id || !newAsk.message.trim() || !userWallet) {
      setAskError('Please enter a message');
      return;
    }

    setSubmittingAsk(true);
    setAskError('');
    setAskSuccess('');

    try {
      const ttlValue = newAsk.ttlHours === 'custom' ? newAsk.customTtlHours : newAsk.ttlHours;
      const ttlHours = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHours) || ttlHours <= 0 ? 86400 : Math.floor(ttlHours * 3600);

      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet: userWallet,
          skill: newAsk.skill.trim(),
          skill_id: newAsk.skill_id,
          skill_label: newAsk.skill.trim(),
          message: newAsk.message.trim(),
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setAskSuccess('Ask created successfully!');
        setNewAsk({ skill: skill?.name_canonical || '', skill_id: skill?.key || '', message: '', ttlHours: '24', customTtlHours: '' });
        setShowAdvancedOptionsAsk(false);
        setShowCreateAskForm(false);
        // Wait for Arkiv indexing then reload
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadTopicData();
      } else {
        setAskError(data.error || 'Failed to create ask');
      }
    } catch (err: any) {
      console.error('Error creating ask:', err);
      setAskError(err.message || 'Failed to create ask');
    } finally {
      setSubmittingAsk(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.skill_id || !newOffer.message.trim() || !userWallet) {
      setOfferError('Please enter a message');
      return;
    }

    if (newOffer.availabilityType === 'saved') {
      if (!newOffer.availabilityKey.trim()) {
        setOfferError('Please select a saved availability');
        return;
      }
    } else if (newOffer.availabilityType === 'structured') {
      if (!newOffer.structuredAvailability) {
        setOfferError('Please configure your structured availability');
        return;
      }
    }

    if (newOffer.isPaid) {
      if (!newOffer.cost.trim() || !newOffer.paymentAddress.trim()) {
        setOfferError('Cost and payment address are required for paid offers');
        return;
      }
    }

    setSubmittingOffer(true);
    setOfferError('');
    setOfferSuccess('');

    try {
      const ttlValue = newOffer.ttlHours === 'custom' ? newOffer.customTtlHours : newOffer.ttlHours;
      const ttlHours = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHours) || ttlHours <= 0 ? 604800 : Math.floor(ttlHours * 3600);

      let availabilityWindowValue: string | WeeklyAvailability = '';
      if (newOffer.availabilityType === 'saved') {
        availabilityWindowValue = '';
      } else if (newOffer.availabilityType === 'structured') {
        availabilityWindowValue = newOffer.structuredAvailability!;
      }

      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOffer',
          wallet: userWallet,
          skill: newOffer.skill.trim(),
          skill_id: newOffer.skill_id,
          skill_label: newOffer.skill.trim(),
          message: newOffer.message.trim(),
          availabilityWindow: availabilityWindowValue,
          availabilityKey: newOffer.availabilityType === 'saved' ? newOffer.availabilityKey : undefined,
          isPaid: newOffer.isPaid,
          cost: newOffer.isPaid ? newOffer.cost.trim() : undefined,
          paymentAddress: newOffer.isPaid ? newOffer.paymentAddress.trim() : undefined,
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setOfferSuccess('Offer created successfully!');
        setNewOffer({ 
          skill: skill?.name_canonical || '', 
          skill_id: skill?.key || '', 
          message: '', 
          availabilityWindow: '', 
          availabilityKey: '', 
          availabilityType: 'structured', 
          structuredAvailability: null, 
          isPaid: false, 
          cost: '', 
          paymentAddress: '', 
          ttlHours: '168', 
          customTtlHours: '' 
        });
        setShowAdvancedOptionsOffer(false);
        setShowCreateOfferForm(false);
        // Wait for Arkiv indexing then reload
        await new Promise(resolve => setTimeout(resolve, 1500));
        await loadTopicData();
      } else {
        setOfferError(data.error || 'Failed to create offer');
      }
    } catch (err: any) {
      console.error('Error creating offer:', err);
      setOfferError(err.message || 'Failed to create offer');
    } finally {
      setSubmittingOffer(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <LoadingSpinner text="Loading topic..." className="py-12" />
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <EmptyState
            title="Topic not found"
            description={error || 'The requested topic could not be found.'}
          />
        </div>
      </div>
    );
  }

  const totalCount = asks.length + offers.length + matches.length + gatherings.length + communitySessions.length;
  
  // Filter upcoming gatherings (not past)
  const upcomingGatherings = gatherings.filter(g => {
    const sessionTime = new Date(g.sessionDate).getTime();
    return sessionTime > Date.now();
  }).sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <PageHeader
          title={skill.name_canonical}
          description={skill.description || `Explore learning and teaching opportunities for ${skill.name_canonical}`}
        />

        {/* Skill Metadata */}
        <div className="mb-6 p-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {totalCount === 0 
                  ? 'No activity yet' 
                  : `${totalCount} ${totalCount === 1 ? 'item' : 'items'} (${asks.length} asks, ${offers.length} offers, ${matches.length} matches)`
                }
              </p>
            </div>
            <div className="flex items-center gap-3">
              {userWallet && skill?.key && (
                <>
                  <ArkivQueryTooltip
                    query={[
                      `POST /api/learning-follow { action: '${isJoined ? 'unfollow' : 'follow'}', ... }`,
                      isJoined
                        ? `Creates: type='learning_follow' entity (active=false)`
                        : `Creates: type='learning_follow' entity (active=true)`,
                      `Attributes: profile_wallet='${userWallet.toLowerCase().slice(0, 8)}...', skill_id='${skill.key.slice(0, 12)}...', active=${!isJoined}`,
                      `Payload: Full learning follow data`,
                      `TTL: 1 year (31536000 seconds)`
                    ]}
                    label={isJoined ? 'Leave Community' : 'Join Community'}
                  >
                    <button
                      onClick={async () => {
                        if (!userWallet || !skill?.key || submittingFollow) return;

                        const action = isJoined ? 'unfollow' : 'follow';
                        setSubmittingFollow(true);
                        try {
                          const res = await fetch('/api/learning-follow', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action,
                              profile_wallet: userWallet,
                              skill_id: skill.key,
                            }),
                          });

                          const data = await res.json();
                          if (data.ok) {
                            // Wait for Arkiv to index the new entity (especially important for joins)
                            await new Promise(resolve => setTimeout(resolve, 1500));
                            await loadMembershipStatus();
                          } else {
                            alert(data.error || `Failed to ${isJoined ? 'leave' : 'join'} community`);
                          }
                        } catch (error: any) {
                          console.error(`Error ${isJoined ? 'leaving' : 'joining'} community:`, error);
                          alert(`Failed to ${isJoined ? 'leave' : 'join'} community`);
                        } finally {
                          setSubmittingFollow(false);
                        }
                      }}
                      disabled={submittingFollow}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isJoined
                          ? 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      {submittingFollow
                        ? (isJoined ? 'Leaving...' : 'Joining...')
                        : (isJoined ? 'Leave Community' : 'Join Community')
                      }
                    </button>
                  </ArkivQueryTooltip>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    📅 Schedule Meeting
                  </button>
                  {!showCreateAskForm && !showCreateOfferForm && (
                    <>
                      <button
                        onClick={() => {
                          setShowCreateAskForm(true);
                          setShowCreateOfferForm(false);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${askColors.button}`}
                      >
                        {askEmojis.default} Create Ask
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateOfferForm(true);
                          setShowCreateAskForm(false);
                        }}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${offerColors.button}`}
                      >
                        {offerEmojis.default} Create Offer
                      </button>
                    </>
                  )}
                </>
              )}
              {!userWallet && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  📅 Schedule Meeting
                </button>
              )}
              <Link
                href="/network"
                className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                View all topics →
              </Link>
            </div>
          </div>
        </div>

        {/* Create Ask Form */}
        {showCreateAskForm && userWallet && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create New Ask for {skill.name_canonical}</h2>
              <button
                onClick={() => {
                  setShowCreateAskForm(false);
                  setNewAsk({ skill: skill.name_canonical, skill_id: skill.key, message: '', ttlHours: '24', customTtlHours: '' });
                  setShowAdvancedOptionsAsk(false);
                  setAskError('');
                  setAskSuccess('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            {askError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
                {askError}
              </div>
            )}
            {askSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-sm">
                {askSuccess}
              </div>
            )}
            <form onSubmit={handleCreateAsk} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you want to learn *
                </label>
                <SkillSelector
                  value={newAsk.skill_id}
                  onChange={(skillId, skillName) => setNewAsk({ ...newAsk, skill_id: skillId, skill: skillName })}
                  placeholder="Search for a skill..."
                  allowCreate={true}
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Pre-filled with current topic: {skill.name_canonical}
                </p>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newAsk.message}
                  onChange={(e) => setNewAsk({ ...newAsk, message: e.target.value })}
                  placeholder="Describe what you want to learn..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptionsAsk(!showAdvancedOptionsAsk)}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdvancedOptionsAsk ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Options
                </button>
              </div>
              {showAdvancedOptionsAsk && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="ttlHours" className="block text-sm font-medium mb-2">
                      Expiration Duration (optional)
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="ttlHours"
                        value={newAsk.ttlHours === 'custom' ? 'custom' : newAsk.ttlHours}
                        onChange={(e) => setNewAsk({ ...newAsk, ttlHours: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="0.5">30 minutes</option>
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours (1 day) - Recommended</option>
                        <option value="48">48 hours (2 days)</option>
                        <option value="168">1 week</option>
                        <option value="custom">Custom (hours)</option>
                      </select>
                      {newAsk.ttlHours === 'custom' && (
                        <input
                          type="number"
                          min="0.5"
                          max="8760"
                          step="0.5"
                          placeholder="Hours"
                          value={newAsk.customTtlHours}
                          onChange={(e) => setNewAsk({ ...newAsk, customTtlHours: e.target.value })}
                          className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long should this ask remain active? Default: 24 hours
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submittingAsk}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingAsk ? 'Creating...' : 'Create Ask'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateAskForm(false);
                    setNewAsk({ skill: skill.name_canonical, skill_id: skill.key, message: '', ttlHours: '24', customTtlHours: '' });
                    setShowAdvancedOptionsAsk(false);
                    setAskError('');
                    setAskSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Create Offer Form */}
        {showCreateOfferForm && userWallet && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create New Offer for {skill.name_canonical}</h2>
              <button
                onClick={() => {
                  setShowCreateOfferForm(false);
                  setNewOffer({ 
                    skill: skill.name_canonical, 
                    skill_id: skill.key, 
                    message: '', 
                    availabilityWindow: '', 
                    availabilityKey: '', 
                    availabilityType: 'structured', 
                    structuredAvailability: null, 
                    isPaid: false, 
                    cost: '', 
                    paymentAddress: '', 
                    ttlHours: '168', 
                    customTtlHours: '' 
                  });
                  setShowAdvancedOptionsOffer(false);
                  setOfferError('');
                  setOfferSuccess('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            {offerError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
                {offerError}
              </div>
            )}
            {offerSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-sm">
                {offerSuccess}
              </div>
            )}
            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you can teach *
                </label>
                <SkillSelector
                  value={newOffer.skill_id}
                  onChange={(skillId, skillName) => setNewOffer({ ...newOffer, skill_id: skillId, skill: skillName })}
                  placeholder="Search for a skill..."
                  allowCreate={true}
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Pre-filled with current topic: {skill.name_canonical}
                </p>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newOffer.message}
                  onChange={(e) => setNewOffer({ ...newOffer, message: e.target.value })}
                  placeholder="Describe what you can teach..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Availability *
                </label>
                <div className="mb-3">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="availabilityType"
                        checked={newOffer.availabilityType === 'saved'}
                        onChange={() => setNewOffer({ ...newOffer, availabilityType: 'saved', structuredAvailability: null })}
                        className="mr-2"
                      />
                      <span>Use saved availability</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="availabilityType"
                        checked={newOffer.availabilityType === 'structured'}
                        onChange={() => setNewOffer({ ...newOffer, availabilityType: 'structured', availabilityKey: '' })}
                        className="mr-2"
                      />
                      <span>Create structured availability</span>
                    </label>
                  </div>
                </div>
                {newOffer.availabilityType === 'saved' ? (
                  <div>
                    {savedAvailabilityBlocks.length === 0 ? (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          No saved availability blocks found. <Link href="/me/availability" className="underline">Create one here</Link> or create structured availability below.
                        </p>
                      </div>
                    ) : (
                      <select
                        id="availabilityKey"
                        value={newOffer.availabilityKey}
                        onChange={(e) => setNewOffer({ ...newOffer, availabilityKey: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required={newOffer.availabilityType === 'saved'}
                      >
                        <option value="">Select saved availability...</option>
                        {savedAvailabilityBlocks.map((avail) => (
                          <option key={avail.key} value={avail.key}>
                            {avail.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div>
                    <WeeklyAvailabilityEditor
                      value={newOffer.structuredAvailability || userAvailability}
                      onChange={(availability) => setNewOffer({ ...newOffer, structuredAvailability: availability })}
                      className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Payment Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      checked={!newOffer.isPaid}
                      onChange={() => setNewOffer({ ...newOffer, isPaid: false, cost: '', paymentAddress: '' })}
                      className="mr-2"
                    />
                    <span>Free</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="paymentType"
                      checked={newOffer.isPaid}
                      onChange={() => setNewOffer({ ...newOffer, isPaid: true })}
                      className="mr-2"
                    />
                    <span>Paid</span>
                  </label>
                </div>
              </div>
              {newOffer.isPaid && (
                <>
                  <div>
                    <label htmlFor="cost" className="block text-sm font-medium mb-2">
                      Cost *
                    </label>
                    <input
                      id="cost"
                      type="text"
                      value={newOffer.cost}
                      onChange={(e) => setNewOffer({ ...newOffer, cost: e.target.value })}
                      placeholder="e.g., 0.1 ETH, $50, 100 USDC"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required={newOffer.isPaid}
                    />
                  </div>
                  <div>
                    <label htmlFor="paymentAddress" className="block text-sm font-medium mb-2">
                      Payment Address *
                    </label>
                    <input
                      id="paymentAddress"
                      type="text"
                      value={newOffer.paymentAddress}
                      onChange={(e) => setNewOffer({ ...newOffer, paymentAddress: e.target.value })}
                      placeholder="0x..."
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      required={newOffer.isPaid}
                    />
                  </div>
                </>
              )}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOptionsOffer(!showAdvancedOptionsOffer)}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdvancedOptionsOffer ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced Options
                </button>
              </div>
              {showAdvancedOptionsOffer && (
                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label htmlFor="ttlHours" className="block text-sm font-medium mb-2">
                      Expiration Duration (optional)
                    </label>
                    <div className="flex gap-2">
                      <select
                        id="ttlHours"
                        value={newOffer.ttlHours === 'custom' ? 'custom' : newOffer.ttlHours}
                        onChange={(e) => setNewOffer({ ...newOffer, ttlHours: e.target.value })}
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="1">1 hour</option>
                        <option value="2">2 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours (1 day)</option>
                        <option value="48">48 hours (2 days)</option>
                        <option value="168">1 week - Recommended</option>
                        <option value="720">1 month (30 days)</option>
                        <option value="custom">Custom (hours)</option>
                      </select>
                      {newOffer.ttlHours === 'custom' && (
                        <input
                          type="number"
                          min="1"
                          max="8760"
                          step="1"
                          placeholder="Hours"
                          value={newOffer.customTtlHours}
                          onChange={(e) => setNewOffer({ ...newOffer, customTtlHours: e.target.value })}
                          className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      How long should this offer remain active? Default: 1 week
                    </p>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submittingOffer}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingOffer ? 'Creating...' : 'Create Offer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateOfferForm(false);
                    setNewOffer({ 
                      skill: skill.name_canonical, 
                      skill_id: skill.key, 
                      message: '', 
                      availabilityWindow: '', 
                      availabilityKey: '', 
                      availabilityType: 'structured', 
                      structuredAvailability: null, 
                      isPaid: false, 
                      cost: '', 
                      paymentAddress: '', 
                      ttlHours: '168', 
                      customTtlHours: '' 
                    });
                    setShowAdvancedOptionsOffer(false);
                    setOfferError('');
                    setOfferSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Upcoming Community Sessions - Display actual session entities */}
        {communitySessions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              🌐 Upcoming Community Sessions
            </h2>
            <div className="space-y-4">
              {communitySessions.map((session) => {
                const isMentor = userWallet?.toLowerCase() === session.mentorWallet.toLowerCase();
                const isLearner = userWallet?.toLowerCase() === session.learnerWallet.toLowerCase();
                const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
                const otherProfile = profiles[otherWallet.toLowerCase()];
                const sessionTime = formatSessionDate(session.sessionDate);
                const sessionDateTime = new Date(session.sessionDate).getTime();
                const now = Date.now();
                const remaining = sessionDateTime - now;
                const daysUntil = Math.floor(remaining / (1000 * 60 * 60 * 24));
                const hoursUntil = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutesUntil = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

                // Extract gatheringKey from session (for community sessions)
                const gatheringKey = (session as any).gatheringKey || 
                  (session.notes?.match(/virtual_gathering_rsvp:([^\s]+)/)?.[1]) ||
                  (session.notes?.includes('virtual_gathering_rsvp:') ? gatherings.find(g => session.notes?.includes(g.key))?.key : null);
                
                // Check if this is a community gathering session and if user has RSVP'd
                const isCommunityGathering = gatheringKey && (session.skill === 'virtual_gathering_rsvp' || session.notes?.includes('virtual_gathering_rsvp:'));
                const hasUserRsvpd = gatheringKey ? (sessionRsvpStatus[session.key] || (isMentor && isLearner)) : false;
                const gathering = gatheringKey ? gatherings.find(g => g.key === gatheringKey) : null;

                // Get RSVP wallets for this gathering
                const gatheringRsvpWallets = gatheringKey ? (rsvpWallets[gatheringKey] || []) : [];
                const rsvpProfiles = gatheringRsvpWallets
                  .map(wallet => profiles[wallet.toLowerCase()])
                  .filter(Boolean) as UserProfile[];

                return (
                  <div
                    key={session.key}
                    className="p-6 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                          {formatSessionTitle(session, skillsMap)}
                        </h3>
                        {(isMentor || isLearner) && otherWallet !== userWallet?.toLowerCase() && (
                          <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                            {isMentor ? '👨‍🏫 As Mentor' : '👨‍🎓 As Learner'} with {otherProfile?.displayName || otherWallet.slice(0, 8) + '...'}
                          </p>
                        )}
                        {isCommunityGathering && (
                          <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                            Community gathering
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {daysUntil > 0
                          ? `${daysUntil}d ${hoursUntil}h ${minutesUntil}m left`
                          : hoursUntil > 0
                          ? `${hoursUntil}h ${minutesUntil}m left`
                          : `${minutesUntil}m left`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Date:</strong> {sessionTime.date} at {sessionTime.time}
                        {session.duration && ` • ${session.duration} min`}
                        {gathering && gathering.rsvpCount !== undefined && ` • ${gathering.rsvpCount} ${gathering.rsvpCount === 1 ? 'RSVP' : 'RSVPs'}`}
                      </p>
                      <div className="flex gap-2 items-center">
                        {session.videoJoinUrl && (
                          <a
                            href={session.videoJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                          >
                            🎥 Join
                          </a>
                        )}
                        {isCommunityGathering && gatheringKey && !hasUserRsvpd && userWallet && (
                          <button
                            onClick={() => handleRSVP(gatheringKey)}
                            disabled={rsvping === gatheringKey}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
                          >
                            {rsvping === gatheringKey ? 'RSVPing...' : 'RSVP'}
                          </button>
                        )}
                        {isCommunityGathering && hasUserRsvpd && (
                          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm font-medium">
                            ✓ RSVP'd
                          </span>
                        )}
                        <ViewOnArkivLink entityKey={session.key} className="text-xs" />
                      </div>
                    </div>
                    {/* RSVP'd Profiles List */}
                    {isCommunityGathering && gatheringRsvpWallets.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                          {gatheringRsvpWallets.length} {gatheringRsvpWallets.length === 1 ? 'profile has' : 'profiles have'} RSVP'd:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rsvpProfiles.map((profile) => (
                            <Link
                              key={profile.wallet}
                              href={`/profiles/${profile.wallet}`}
                              className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                            >
                              {profile.displayName || profile.username || profile.wallet.slice(0, 8) + '...'}
                            </Link>
                          ))}
                          {/* Show wallets without profiles */}
                          {gatheringRsvpWallets
                            .filter(wallet => !profiles[wallet.toLowerCase()])
                            .map((wallet) => (
                              <span
                                key={wallet}
                                className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200"
                              >
                                {wallet.slice(0, 8)}...{wallet.slice(-4)}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Virtual Gatherings (meetings that can be RSVP'd) - exclude ones user already RSVP'd to */}
        {upcomingGatherings.filter(g => {
          // Exclude gatherings that user has already RSVP'd to (they'll show as sessions above)
          if (!userWallet) return true;
          return !communitySessions.some(s => s.gatheringKey === g.key);
        }).length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              🌐 Schedule a Community Meeting
            </h2>
            <div className="space-y-4">
              {upcomingGatherings.filter(g => {
                // Exclude gatherings that user has already RSVP'd to
                if (!userWallet) return true;
                return !communitySessions.some(s => s.gatheringKey === g.key);
              }).map((gathering) => {
                const organizerProfile = profiles[gathering.organizerWallet.toLowerCase()];
                const organizerName = organizerProfile?.displayName || gathering.organizerWallet.slice(0, 8) + '...';
                const hasRsvpd = rsvpStatus[gathering.key] || false;
                const sessionTime = formatSessionDate(gathering.sessionDate);
                const sessionDateTime = new Date(gathering.sessionDate).getTime();
                const now = Date.now();
                const hoursUntil = Math.floor((sessionDateTime - now) / (1000 * 60 * 60));
                const minutesUntil = Math.floor(((sessionDateTime - now) % (1000 * 60 * 60)) / (1000 * 60));

                // Get RSVP wallets for this gathering
                const gatheringRsvpWallets = rsvpWallets[gathering.key] || [];
                const rsvpProfiles = gatheringRsvpWallets
                  .map(wallet => profiles[wallet.toLowerCase()])
                  .filter(Boolean) as UserProfile[];

                return (
                  <div
                    key={gathering.key}
                    className="p-6 border rounded-lg bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                          {gathering.title}
                        </h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                          Organized by {organizerName}
                        </p>
                        {gathering.description && (
                          <p className="text-sm text-blue-600 dark:text-blue-300 mt-2">
                            {gathering.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                        {hoursUntil > 0 ? `In ${hoursUntil}h ${minutesUntil}m` : `In ${minutesUntil}m`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <strong>Date:</strong> {sessionTime.date} at {sessionTime.time}
                        {gathering.duration && ` • ${gathering.duration} min`}
                        {gathering.rsvpCount !== undefined && ` • ${gathering.rsvpCount} ${gathering.rsvpCount === 1 ? 'RSVP' : 'RSVPs'}`}
                      </p>
                      <div className="flex gap-2">
                        {gathering.videoJoinUrl && (
                          <a
                            href={gathering.videoJoinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                          >
                            🎥 Join
                          </a>
                        )}
                        {!hasRsvpd && userWallet && (
                          <button
                            onClick={() => handleRSVP(gathering.key)}
                            disabled={rsvping === gathering.key}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors text-sm"
                          >
                            {rsvping === gathering.key ? 'RSVPing...' : 'RSVP'}
                          </button>
                        )}
                        {hasRsvpd && (
                          <span className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-lg text-sm font-medium">
                            ✓ RSVP'd
                          </span>
                        )}
                        <ViewOnArkivLink entityKey={gathering.key} className="text-xs" />
                      </div>
                    </div>
                    {/* RSVP'd Profiles List */}
                    {gatheringRsvpWallets.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-700">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
                          {gatheringRsvpWallets.length} {gatheringRsvpWallets.length === 1 ? 'profile has' : 'profiles have'} RSVP'd:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rsvpProfiles.map((profile) => (
                            <Link
                              key={profile.wallet}
                              href={`/profiles/${profile.wallet}`}
                              className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                            >
                              {profile.displayName || profile.username || profile.wallet.slice(0, 8) + '...'}
                            </Link>
                          ))}
                          {/* Show wallets without profiles */}
                          {gatheringRsvpWallets
                            .filter(wallet => !profiles[wallet.toLowerCase()])
                            .map((wallet) => (
                              <span
                                key={wallet}
                                className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200"
                              >
                                {wallet.slice(0, 8)}...{wallet.slice(-4)}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        {totalCount === 0 ? (
          <EmptyState
            title={`No activity for ${skill.name_canonical} yet`}
            description="Be the first to post an ask or offer for this topic!"
          />
        ) : (
          <SkillCluster
            skill={skill.name_canonical}
            asks={asks}
            offers={offers}
            matches={matches}
            profiles={profiles}
            userWallet={userWallet}
            onRequestMeetingFromOffer={async (offer, profile) => {
              setSelectedOffer(offer);
              setSelectedAsk(null);
              setSelectedProfile(profile);
              setMeetingMode('request');
              setTimeout(() => setShowMeetingModal(true), 0);
            }}
            onOfferToHelpFromAsk={async (ask, profile) => {
              setSelectedAsk(ask);
              setSelectedOffer(null);
              setSelectedProfile(profile);
              setMeetingMode('offer');
              setTimeout(() => setShowMeetingModal(true), 0);
            }}
            arkivBuilderMode={arkivBuilderMode}
          />
        )}

        {/* Community Profiles */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              👥 Community Members
            </h2>
            {arkivBuilderMode && (
              <ArkivQueryTooltip
                query={[
                  `loadCommunityProfiles()`,
                  `Queries: GET /api/profiles?skill='${skill.name_canonical}'`,
                  `   → type='user_profile', skills contains '${skill.name_canonical}'`,
                  `Client-side filter:`,
                  `   → skill_ids.includes('${skill.key}') OR`,
                  `   → skillsArray.includes('${skill.name_canonical}') OR`,
                  `   → skills string contains '${skill.name_canonical}'`,
                  `Returns: ${communityProfiles.length} profiles in this community`
                ]}
                label="Community Profiles"
              >
                <span className="text-xs text-gray-500 dark:text-gray-400">ℹ️</span>
              </ArkivQueryTooltip>
            )}
          </div>
          {loadingCommunityProfiles ? (
            <LoadingSpinner text="Loading community members..." className="py-8" />
          ) : communityProfiles.length === 0 ? (
            <EmptyState
              title="No community members yet"
              description={`Be the first to join the ${skill.name_canonical} community!`}
              icon={
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {communityProfiles.map((profile) => (
                <div
                  key={profile.key}
                  className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                  onClick={() => router.push(`/profiles/${profile.wallet}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 mb-1">
                        {profile.displayName || 'Anonymous'}
                      </h3>
                      {profile.username && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
                      )}
                    </div>
                    {profile.profileImage && (
                      <img
                        src={profile.profileImage}
                        alt={profile.displayName}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    )}
                  </div>

                  {profile.bioShort && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-2">
                      {profile.bioShort}
                    </p>
                  )}

                  {profile.skillsArray && profile.skillsArray.length > 0 && (
                    <div className="mb-3">
                      <div className="flex flex-wrap gap-1">
                        {profile.skillsArray.slice(0, 3).map((skillName, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded"
                          >
                            {skillName}
                          </span>
                        ))}
                        {profile.skillsArray.length > 3 && (
                          <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                            +{profile.skillsArray.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {profile.seniority && (
                      <div>
                        <strong>Level:</strong> {profile.seniority}
                      </div>
                    )}
                    {profile.timezone && (
                      <div>
                        <strong>Timezone:</strong> {profile.timezone}
                      </div>
                    )}
                    {profile.availabilityWindow && (
                      <div>
                        <strong>Available:</strong> {formatAvailabilityForDisplay(profile.availabilityWindow)}
                      </div>
                    )}
                    <div>
                      <strong>Wallet:</strong> {profile.wallet.slice(0, 6)}...{profile.wallet.slice(-4)}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/profiles/${profile.wallet}`);
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Profile →
                    </button>
                    {arkivBuilderMode && profile.key && (
                      <div className="flex items-center gap-2">
                        <ViewOnArkivLink
                          entityKey={profile.key}
                          txHash={profile.txHash}
                          label="View Profile on Arkiv"
                          className="text-xs"
                        />
                        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                          {profile.key.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule Meeting Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Schedule Meeting - {skill.name_canonical}
                  </h3>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setFormData({ title: '', description: '', date: '', time: '', duration: '60' });
                    }}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    ×
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!userWallet) {
                      alert('Please connect your wallet first');
                      return;
                    }

                    if (!formData.title || !formData.date || !formData.time) {
                      alert('Please fill in title, date, and time');
                      return;
                    }

                    setSubmitting(true);
                    try {
                      // Combine date and time into ISO timestamp
                      const sessionDate = new Date(`${formData.date}T${formData.time}:00`).toISOString();

                      // Create virtual gathering (immediately generates Jitsi link)
                      const res = await fetch('/api/virtual-gatherings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'create',
                          organizerWallet: userWallet,
                          community: skill.slug, // Use skill slug as community identifier
                          title: formData.title,
                          description: formData.description,
                          sessionDate,
                          duration: parseInt(formData.duration, 10),
                        }),
                      });

                      const data = await res.json();
                      if (!res.ok) {
                        throw new Error(data.error || 'Failed to create meeting');
                      }

                      alert('Meeting scheduled! Jitsi room is ready.');
                      setShowScheduleModal(false);
                      setFormData({ title: '', description: '', date: '', time: '', duration: '60' });
                      // Reload topic data to show new meeting
                      loadTopicData();
                    } catch (err: any) {
                      console.error('Error scheduling meeting:', err);
                      alert(err.message || 'Failed to schedule meeting');
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="e.g., Spanish Conversation Practice"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      rows={3}
                      placeholder="Optional description..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Time * (15-min intervals)
                      </label>
                      <input
                        type="time"
                        id="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        step="900"
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Times are rounded to 15-minute intervals
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      min="15"
                      max="240"
                      step="15"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Scheduling...' : 'Schedule Meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowScheduleModal(false);
                        setFormData({ title: '', description: '', date: '', time: '', duration: '60' });
                      }}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Arkiv Query Tester - Show only for Arkiv topic */}
        {skill && skill.name_canonical.toLowerCase() === 'arkiv' && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              🔍 Arkiv Query Tester
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Test Arkiv queries for all entity types. Useful for learning how to query Arkiv entities and finding them on Arkiv Explorer.
            </p>
            <ArkivQueryTester compact={true} />
          </div>
        )}

        {/* Garden Board - Filter by skill name tag */}
        {skill && (
          <GardenBoard
            tags={[skill.name_canonical]}
            title={`${skill.name_canonical} Garden Board`}
            description={`Notes and discussions about ${skill.name_canonical}`}
            userWallet={userWallet}
            userProfile={userProfile}
            skillName={skill.name_canonical}
          />
        )}

        {/* Request Meeting Modal */}
        {selectedProfile && (
          <RequestMeetingModal
            isOpen={showMeetingModal}
            onClose={() => {
              setShowMeetingModal(false);
              setSelectedOffer(null);
              setSelectedAsk(null);
              setSelectedProfile(null);
              setMeetingMode('request');
            }}
            profile={selectedProfile}
            userWallet={userWallet}
            userProfile={userProfile}
            offer={selectedOffer}
            ask={selectedAsk}
            mode={meetingMode}
            onSuccess={() => {
              console.log('Meeting requested successfully');
              setSelectedOffer(null);
              setSelectedAsk(null);
              setSelectedProfile(null);
              setMeetingMode('request');
            }}
          />
        )}
      </div>
    </div>
  );
}
