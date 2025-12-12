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
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { BetaBanner } from '@/components/BetaBanner';
import { ThemeToggle } from '@/components/ThemeToggle';
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

type Match = {
  ask: Ask;
  offer: Offer;
  askProfile?: UserProfile;
  offerProfile?: UserProfile;
  skillMatch: string;
};

export default function TopicDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [skill, setSkill] = useState<Skill | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [gatherings, setGatherings] = useState<VirtualGathering[]>([]);
  const [communitySessions, setCommunitySessions] = useState<Session[]>([]);
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [skillsMap, setSkillsMap] = useState<Record<string, Skill>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userWallet, setUserWallet] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rsvping, setRsvping] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    duration: '60',
  });

  useEffect(() => {
    // Get user wallet first
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setUserWallet(address);
    }
  }, []);

  useEffect(() => {
    if (slug) {
      loadTopicData();
    }
  }, [slug, userWallet]);

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
      const [asksRes, offersRes, gatheringsRes, sessionsRes] = await Promise.all([
        fetch('/api/asks').then(r => r.json()),
        fetch('/api/offers').then(r => r.json()),
        fetch(`/api/virtual-gatherings?community=${encodeURIComponent(skillEntity.slug)}${userWallet ? `&wallet=${encodeURIComponent(userWallet)}` : ''}`).then(r => r.json()),
        fetch(`/api/sessions?skill=${encodeURIComponent(skillEntity.name_canonical)}&status=scheduled`).then(r => r.json()).catch(() => ({ ok: false, sessions: [] })),
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
      }

      // Load sessions for this community (skill-based sessions)
      if (sessionsRes.ok && sessionsRes.sessions) {
        // Filter to upcoming sessions only
        const now = Date.now();
        const upcoming = sessionsRes.sessions.filter((s: Session) => {
          const sessionTime = new Date(s.sessionDate).getTime();
          return sessionTime > now;
        });
        setCommunitySessions(upcoming);
      }

      // Also load sessions linked to virtual gatherings for this community
      if (gatheringsRes.ok && gatheringsRes.gatherings && gatheringsRes.gatherings.length > 0) {
        const gatheringKeys = gatheringsRes.gatherings.map((g: VirtualGathering) => g.key);
        // Query all virtual_gathering_rsvp sessions and filter by gatheringKey
        try {
          const gatheringSessionsRes = await fetch(`/api/sessions?skill=virtual_gathering_rsvp&status=scheduled`).then(r => r.json()).catch(() => ({ ok: false, sessions: [] }));
          
          if (gatheringSessionsRes.ok && gatheringSessionsRes.sessions) {
            // Filter sessions that match gathering keys for this community
            const allGatheringSessions: Session[] = gatheringSessionsRes.sessions.filter((s: Session) => {
              const notes = s.notes || '';
              // Check if session notes contains gatheringKey for any of our gatherings
              return gatheringKeys.some((key: string) => 
                notes.includes(`virtual_gathering_rsvp:${key}`) || notes.includes(key)
              );
            });

            // Combine with skill-based sessions
            setCommunitySessions(prev => {
              const combined = [...prev, ...allGatheringSessions];
              // Deduplicate by key
              const unique = new Map<string, Session>();
              combined.forEach(s => unique.set(s.key, s));
              return Array.from(unique.values()).sort((a, b) => 
                new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()
              );
            });
          }
        } catch (err) {
          console.warn('Error loading gathering sessions:', err);
        }
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

      // Update RSVP status
      setRsvpStatus(prev => ({ ...prev, [gatheringKey]: true }));
      // Reload gatherings to get updated RSVP count
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
        <ThemeToggle />
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
      <ThemeToggle />
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
              {userWallet && (
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
                const hoursUntil = Math.floor((sessionDateTime - now) / (1000 * 60 * 60));
                const minutesUntil = Math.floor(((sessionDateTime - now) % (1000 * 60 * 60)) / (1000 * 60));

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
                        {session.notes && session.notes.includes('virtual_gathering_rsvp:') && (
                          <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                            Community gathering
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
                        {session.duration && ` • ${session.duration} min`}
                      </p>
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
                      <ViewOnArkivLink entityKey={session.key} className="text-xs" />
                    </div>
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
          />
        )}

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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Time *
                      </label>
                      <input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        required
                      />
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
      </div>
    </div>
  );
}
