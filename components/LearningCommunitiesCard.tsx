'use client';

/**
 * Learning Communities Card
 * 
 * Displays skills the user is following and allows following new skills.
 * Includes meeting creation functionality for each skill.
 * Minimal beta implementation.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { LearningFollow } from '@/lib/arkiv/learningFollow';
import type { Skill } from '@/lib/arkiv/skill';
import type { Offer } from '@/lib/arkiv/offers';
import type { UserProfile } from '@/lib/arkiv/profile';
import { SkillSelector } from './SkillSelector';
import { RequestMeetingModal } from './RequestMeetingModal';

interface LearningCommunitiesCardProps {
  wallet: string;
}

export function LearningCommunitiesCard({ wallet }: LearningCommunitiesCardProps) {
  const [follows, setFollows] = useState<LearningFollow[]>([]);
  const [skills, setSkills] = useState<Record<string, Skill>>({});
  const [loading, setLoading] = useState(true);
  const [showFollowForm, setShowFollowForm] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Meeting creation state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [selectedSkillForMeeting, setSelectedSkillForMeeting] = useState<Skill | null>(null);
  const [offersForSkill, setOffersForSkill] = useState<Offer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferProfile, setSelectedOfferProfile] = useState<UserProfile | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (wallet) {
      loadFollows();
      // Load user profile for RequestMeetingModal
      import('@/lib/arkiv/profile').then(({ getProfileByWallet }) => {
        getProfileByWallet(wallet).then(setUserProfile).catch(() => null);
      });
    }
  }, [wallet]);

  const loadFollows = async () => {
    try {
      setLoading(true);
      const { listLearningFollows } = await import('@/lib/arkiv/learningFollow');
      const { listSkills } = await import('@/lib/arkiv/skill');
      
      const [followsList, allSkills] = await Promise.all([
        listLearningFollows({ profile_wallet: wallet, active: true }),
        listSkills({ status: 'active' }),
      ]);

      setFollows(followsList);
      
      // Build skills map for quick lookup
      const skillsMap: Record<string, Skill> = {};
      allSkills.forEach(skill => {
        skillsMap[skill.key] = skill;
      });
      setSkills(skillsMap);
    } catch (error) {
      console.error('Error loading learning communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!selectedSkillId || !wallet) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/learning-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'follow',
          profile_wallet: wallet,
          skill_id: selectedSkillId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSelectedSkillId('');
        setShowFollowForm(false);
        await loadFollows(); // Reload follows
      } else {
        alert(data.error || 'Failed to follow skill');
      }
    } catch (error: any) {
      console.error('Error following skill:', error);
      alert('Failed to follow skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnfollow = async (skillId: string) => {
    if (!wallet || !skillId) return;

    if (!confirm('Unfollow this learning community?')) {
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/learning-follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unfollow',
          profile_wallet: wallet,
          skill_id: skillId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        await loadFollows(); // Reload follows
      } else {
        alert(data.error || 'Failed to unfollow skill');
      }
    } catch (error: any) {
      console.error('Error unfollowing skill:', error);
      alert('Failed to unfollow skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateMeeting = async (skill: Skill) => {
    if (!wallet) {
      alert('Please connect your wallet first');
      return;
    }

    setSelectedSkillForMeeting(skill);
    setLoadingOffers(true);
    setShowMeetingModal(true);

    try {
      // Fetch offers for this skill
      const { listOffers } = await import('@/lib/arkiv/offers');
      const offers = await listOffers({ skill: skill.name_canonical, limit: 20 });
      setOffersForSkill(offers);
    } catch (error) {
      console.error('Error loading offers:', error);
      alert('Failed to load offers for this skill');
      setShowMeetingModal(false);
    } finally {
      setLoadingOffers(false);
    }
  };

  const handleSelectOffer = async (offer: Offer) => {
    try {
      // Load profile for the offer creator
      const { getProfileByWallet } = await import('@/lib/arkiv/profile');
      const profile = await getProfileByWallet(offer.wallet);
      setSelectedOfferProfile(profile);
      setSelectedOffer(offer);
    } catch (error) {
      console.error('Error loading offer profile:', error);
      alert('Failed to load mentor profile');
    }
  };

  const handleMeetingSuccess = () => {
    setShowMeetingModal(false);
    setSelectedOffer(null);
    setSelectedOfferProfile(null);
    setSelectedSkillForMeeting(null);
    setOffersForSkill([]);
  };

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading learning communities...</div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          🌱 Your Learning Communities
        </h3>
        {!showFollowForm && (
          <button
            onClick={() => setShowFollowForm(true)}
            className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
          >
            + Follow
          </button>
        )}
      </div>

      {showFollowForm && (
        <div className="mb-3 p-3 bg-white dark:bg-gray-800 rounded border border-emerald-200 dark:border-emerald-700">
          <SkillSelector
            value={selectedSkillId}
            onChange={(skillId) => setSelectedSkillId(skillId)}
            placeholder="Select a skill to follow..."
            className="mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleFollow}
              disabled={!selectedSkillId || submitting}
              className="flex-1 px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Following...' : 'Follow'}
            </button>
            <button
              onClick={() => {
                setShowFollowForm(false);
                setSelectedSkillId('');
              }}
              className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {follows.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          You're not following any learning topics yet. Follow a skill to see activity in your feed.
        </div>
      ) : (
        <div className="space-y-2">
          {follows.slice(0, 5).map((follow) => {
            const skill = skills[follow.skill_id];
            return (
              <div
                key={follow.key}
                className="flex items-center justify-between p-2 rounded bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {skill ? skill.name_canonical : `Skill ${follow.skill_id.slice(0, 8)}...`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => skill && handleCreateMeeting(skill)}
                    disabled={submitting || loadingOffers}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Create Meeting"
                  >
                    📅 Meeting
                  </button>
                  <Link
                    href={skill ? `/topic/${skill.slug}` : `/network?skill_id=${follow.skill_id}`}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    View →
                  </Link>
                  <button
                    onClick={() => handleUnfollow(follow.skill_id)}
                    disabled={submitting}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
                    title="Unfollow"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          {follows.length > 5 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
              +{follows.length - 5} more
            </div>
          )}
        </div>
      )}

      {/* Meeting Creation Modal */}
      {showMeetingModal && selectedSkillForMeeting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Create Meeting - {selectedSkillForMeeting.name_canonical}
                </h3>
                <button
                  onClick={() => {
                    setShowMeetingModal(false);
                    setSelectedOffer(null);
                    setSelectedOfferProfile(null);
                    setSelectedSkillForMeeting(null);
                    setOffersForSkill([]);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>

              {loadingOffers ? (
                <div className="text-center py-8">
                  <div className="text-gray-600 dark:text-gray-400">Loading offers...</div>
                </div>
              ) : offersForSkill.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No active offers found for this skill.
                  </p>
                  <Link
                    href="/offers"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Browse all offers →
                  </Link>
                </div>
              ) : selectedOffer && selectedOfferProfile ? (
                <RequestMeetingModal
                  isOpen={true}
                  onClose={() => {
                    setSelectedOffer(null);
                    setSelectedOfferProfile(null);
                  }}
                  profile={selectedOfferProfile}
                  userWallet={wallet}
                  userProfile={userProfile}
                  offer={selectedOffer}
                  mode="request"
                  onSuccess={handleMeetingSuccess}
                />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Select a mentor to request a meeting:
                  </p>
                  {offersForSkill.map((offer) => (
                    <button
                      key={offer.key}
                      onClick={() => handleSelectOffer(offer)}
                      className="w-full p-4 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {offer.wallet.slice(0, 6)}...{offer.wallet.slice(-4)}
                          </div>
                          {offer.message && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {offer.message.slice(0, 100)}
                              {offer.message.length > 100 ? '...' : ''}
                            </div>
                          )}
                        </div>
                        {offer.isPaid && (
                          <span className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
                            Paid
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
