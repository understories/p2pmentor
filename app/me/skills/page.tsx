/**
 * Skills management page
 * 
 * Add, view, and edit skills using Arkiv profile entities.
 * Skills are stored as references to Skill entities (skill_id) in the profile.
 * Each profile update creates a new immutable profile entity on Arkiv.
 * 
 * Follows the same pattern as asks/offers pages.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { BackButton } from '@/components/BackButton';
import { SkillSelector } from '@/components/SkillSelector';
import { connectWallet } from '@/lib/auth/metamask';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Skill } from '@/lib/arkiv/skill';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';
import { normalizeSkillSlug } from '@/lib/arkiv/skill';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import 'viem/window'; // Adds window.ethereum type definition

export default function SkillsPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedSkillName, setSelectedSkillName] = useState('');
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);
  const [submittingFollow, setSubmittingFollow] = useState<string | null>(null);
  const [isTypingSkill, setIsTypingSkill] = useState(false); // Track if user is typing in SkillSelector
  const [creatingSkill, setCreatingSkill] = useState<string | null>(null); // Track skill being created
  const [newSkillPlanted, setNewSkillPlanted] = useState<string | null>(null); // Track newly planted skill name
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadData(address);
    }
  }, [router]);

  const loadData = async (wallet: string) => {
    try {
      setLoading(true);
      
      // Load profile, all skills, and followed skills in parallel
      const [profileData, skillsRes, follows] = await Promise.all([
        getProfileByWallet(wallet).catch(() => null),
        fetch('/api/skills?status=active&limit=200').then(r => r.json()),
        listLearningFollows({ profile_wallet: wallet, active: true }).catch(() => []),
      ]);

      setProfile(profileData);
      
      if (skillsRes.ok && skillsRes.skills) {
        setAllSkills(skillsRes.skills);
      }

      setFollowedSkills(follows.map(f => f.skill_id));
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getUserSkillIds = (): string[] => {
    if (!profile) return [];
    // Check for skill_ids array (new) or fall back to skillsArray (legacy)
    const skillIds = (profile as any).skill_ids || [];
    // If no skill_ids, try to match skillsArray to skill entities
    if (skillIds.length === 0 && profile.skillsArray) {
      return profile.skillsArray
        .map(skillName => {
          const skill = allSkills.find(s => s.name_canonical.toLowerCase() === skillName.toLowerCase());
          return skill?.key;
        })
        .filter(Boolean) as string[];
    }
    return skillIds;
  };

  const getUserSkills = (): Skill[] => {
    const skillIds = getUserSkillIds();
    return allSkills.filter(skill => skillIds.includes(skill.key));
  };

  const handleAddSkill = async () => {
    if (!selectedSkillId || !selectedSkillName || !profile || !walletAddress) return;

    const currentSkillIds = getUserSkillIds();
    
    // Check if skill_id already exists
    if (currentSkillIds.includes(selectedSkillId)) {
      setError('Skill already added');
      setSelectedSkillId('');
      setSelectedSkillName('');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    setLastTxHash(null);

    try {
      // Add skill_id to array, and skill name to skillsArray for backward compatibility
      const updatedSkillIds = [...currentSkillIds, selectedSkillId];
      const currentSkills = profile.skillsArray || [];
      const updatedSkills = [...currentSkills, selectedSkillName];
      
      // Always use server-side API route with global Arkiv signing wallet
      // The user's wallet is only used as the 'wallet' attribute on entities, not for signing
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet: walletAddress,
          displayName: profile.displayName,
          username: profile.username,
          profileImage: profile.profileImage,
          bio: profile.bio,
          bioShort: profile.bioShort,
          bioLong: profile.bioLong,
          skills: updatedSkills.join(', '),
          skillsArray: updatedSkills,
          skill_ids: updatedSkillIds,
          timezone: profile.timezone,
          languages: profile.languages,
          contactLinks: profile.contactLinks,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Check if transaction is pending
      if (data.pending) {
        setSuccess('Skill update submitted! Transaction is being processed. Please refresh in a moment.');
        setSelectedSkillId('');
        setSelectedSkillName('');
        setNewSkillPlanted(null); // Clear planted message
        setTimeout(() => loadData(walletAddress), 2000);
      } else {
        if (newSkillPlanted) {
          setSuccess(`Skill "${newSkillPlanted}" planted and added to your profile!`);
        } else {
          setSuccess('Skill added!');
        }
        setSelectedSkillId('');
        setSelectedSkillName('');
        setNewSkillPlanted(null); // Clear planted message
        if (data.txHash) setLastTxHash(data.txHash);
        await loadData(walletAddress);
      }
    } catch (err: any) {
      console.error('Error adding skill:', err);
      setError(err.message || 'Failed to add skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!profile || !walletAddress) return;

    const skill = allSkills.find(s => s.key === skillId);
    if (!skill) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    setLastTxHash(null);

    try {
      const currentSkillIds = getUserSkillIds();
      const updatedSkillIds = currentSkillIds.filter(id => id !== skillId);
      
      const currentSkills = profile.skillsArray || [];
      const updatedSkills = currentSkills.filter(s => s.toLowerCase() !== skill.name_canonical.toLowerCase());
      
      // Always use server-side API route with global Arkiv signing wallet
      // The user's wallet is only used as the 'wallet' attribute on entities, not for signing
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet: walletAddress,
          displayName: profile.displayName,
          username: profile.username,
          profileImage: profile.profileImage,
          bio: profile.bio,
          bioShort: profile.bioShort,
          bioLong: profile.bioLong,
          skills: updatedSkills.join(', '),
          skillsArray: updatedSkills,
          skill_ids: updatedSkillIds,
          timezone: profile.timezone,
          languages: profile.languages,
          contactLinks: profile.contactLinks,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.pending) {
        setSuccess('Skill removal submitted! Transaction is being processed. Please refresh in a moment.');
        // Clear form state after removal
        setSelectedSkillId('');
        setSelectedSkillName('');
        setNewSkillPlanted(null);
        setTimeout(() => loadData(walletAddress), 2000);
      } else {
        setSuccess('Skill removed!');
        if (data.txHash) setLastTxHash(data.txHash);
        // Clear form state after removal
        setSelectedSkillId('');
        setSelectedSkillName('');
        setNewSkillPlanted(null);
        await loadData(walletAddress);
      }
    } catch (err: any) {
      console.error('Error removing skill:', err);
      setError(err.message || 'Failed to remove skill');
      // Clear form state even on error to allow retry
      setSelectedSkillId('');
      setSelectedSkillName('');
      setNewSkillPlanted(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `loadData("${walletAddress || '...'}")`,
                `Queries:`,
                `1. getProfileByWallet("${walletAddress?.toLowerCase() || '...'}")`,
                `   → type='user_profile', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                `2. GET /api/skills?status=active&limit=200`,
                `   → type='skill', status='active'`,
                `3. listLearningFollows({ profile_wallet: "${walletAddress?.toLowerCase() || '...'}", active: true })`,
                `   → type='learning_follow', profile_wallet='${walletAddress?.toLowerCase() || '...'}'`
              ]}
              label="Loading Skills"
            >
              <p>Loading skills...</p>
            </ArkivQueryTooltip>
          ) : (
            <p>Loading skills...</p>
          )}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <h1 className="text-3xl font-semibold mb-6">Skills</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please create a profile first before managing skills.
          </p>
          <a
            href="/me/profile"
            className="mt-4 inline-block px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
          >
            Create Profile
          </a>
        </div>
      </div>
    );
  }

  const userSkills = getUserSkills();
  const userSkillIds = getUserSkillIds();

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <BackButton href="/me" />
          <Link
            href="/me/availability"
            className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 border border-green-300 dark:border-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            Availability &gt;
          </Link>
        </div>
        <h1 className="text-3xl font-semibold mb-6">Skills</h1>

        {/* Integral Profile View - Tab Navigation */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4" aria-label="Profile sections">
            <Link
              href="/me/profile"
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              Core Identity
            </Link>
            <Link
              href="/me/skills"
              className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 transition-colors"
            >
              Skills
            </Link>
            <Link
              href="/me/availability"
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              Availability
            </Link>
          </nav>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
            {success}
            {lastTxHash && (
              <div className="mt-2 pt-2 border-t border-green-300 dark:border-green-700">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                  Transaction Hash:
                </p>
                <a
                  href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 dark:text-green-400 hover:underline font-mono break-all"
                >
                  {lastTxHash.slice(0, 20)}...
                </a>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  <a
                    href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    View in Arkiv Explorer →
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Add Skill Form */}
        <div className="mb-6 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 relative z-10 overflow-visible">
          <h2 className="text-lg font-medium mb-4">Add Skill</h2>
          <div className="space-y-3 relative overflow-visible">
            {arkivBuilderMode && isTypingSkill ? (
              <ArkivQueryTooltip
                query={[
                  `SkillSelector Component`,
                  `Queries: GET /api/skills?status=active&limit=100`,
                  `→ type='skill', status='active'`,
                  `Returns: Skill[] (all active skills)`,
                  ``,
                  `On Selection:`,
                  `→ Stores: skill_id='${selectedSkillId || '...'}', skill='${selectedSkillName || '...'}'`,
                  `→ skill_id: Skill entity key (preferred for beta)`,
                  `→ skill: Skill name (legacy, backward compatibility)`,
                  ``,
                  `On Add Skill Button Click:`,
                  `→ POST /api/profile { action: 'updateProfile', ... }`,
                  `→ Creates: type='user_profile' entity`,
                  `→ Attributes: wallet, displayName, skills, skill_ids, ...`,
                  `→ Payload: Full profile data with updated skill_ids array`,
                  `→ TTL: 1 year (31536000 seconds)`
                ]}
                label="Skill Selector"
              >
                <div>
                  <SkillSelector
                    value={selectedSkillId}
                    onChange={(skillId, skillName) => {
                      setSelectedSkillId(skillId);
                      setSelectedSkillName(skillName);
                      setIsTypingSkill(false); // Hide tooltip when skill selected
                    }}
                    onFocus={() => setIsTypingSkill(true)} // Show tooltip when user starts typing
                    onCreatingSkill={(skillName) => {
                      setCreatingSkill(skillName);
                      setError('');
                      setSuccess('');
                    }}
                    onSkillCreated={(skillName, skillId, pending, txHash, isNewSkill) => {
                      setCreatingSkill(null);
                      
                      // If this is a newly created skill, automatically add it to profile
                      if (isNewSkill && skillId && skillName) {
                        setNewSkillPlanted(skillName);
                        setSelectedSkillId(skillId);
                        setSelectedSkillName(skillName);
                        
                        // Automatically add to profile after a brief moment to show "planted" message
                        setTimeout(() => {
                          handleAddSkill();
                        }, 500);
                      } else {
                        // Existing skill selected - just show success
                        if (pending) {
                          setSuccess(`Skill "${skillName}" created! It may take a moment to appear.`);
                          if (txHash) setLastTxHash(txHash);
                          setTimeout(() => {
                            loadData(walletAddress!);
                          }, 2000);
                        } else {
                          setSuccess(`Skill "${skillName}" created successfully!`);
                          if (txHash) setLastTxHash(txHash);
                          loadData(walletAddress!);
                        }
                      }
                    }}
                    placeholder="Search for a skill..."
                    allowCreate={true}
                    className="mb-2"
                  />
                </div>
              </ArkivQueryTooltip>
            ) : (
              <SkillSelector
                value={selectedSkillId}
                onChange={(skillId, skillName) => {
                  setSelectedSkillId(skillId);
                  setSelectedSkillName(skillName);
                  setIsTypingSkill(false); // Hide tooltip when skill selected
                }}
                onFocus={() => setIsTypingSkill(true)} // Show tooltip when user starts typing
                onCreatingSkill={(skillName) => {
                  setCreatingSkill(skillName);
                  setError('');
                  setSuccess('');
                }}
                onSkillCreated={(skillName, skillId, pending, txHash, isNewSkill) => {
                  setCreatingSkill(null);
                  
                  // If this is a newly created skill, automatically add it to profile
                  if (isNewSkill && skillId && skillName) {
                    setNewSkillPlanted(skillName);
                    setSelectedSkillId(skillId);
                    setSelectedSkillName(skillName);
                    
                    // Automatically add to profile after a brief moment to show "planted" message
                    setTimeout(() => {
                      handleAddSkill();
                    }, 500);
                  } else {
                    // Existing skill selected - just show success
                    if (pending) {
                      setSuccess(`Skill "${skillName}" created! It may take a moment to appear.`);
                      if (txHash) setLastTxHash(txHash);
                      setTimeout(() => {
                        loadData(walletAddress!);
                      }, 2000);
                    } else {
                      setSuccess(`Skill "${skillName}" created successfully!`);
                      if (txHash) setLastTxHash(txHash);
                      loadData(walletAddress!);
                    }
                  }
                }}
                placeholder="Search for a skill..."
                allowCreate={true}
                className="mb-2"
              />
            )}
            {creatingSkill && (
              <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="animate-pulse">⏳</span> Creating skill "{creatingSkill}"...
                </p>
              </div>
            )}
            {newSkillPlanted && !submitting && (
              <div className="mb-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <span className="animate-bounce">🌱</span> You've planted a brand new skill in the garden! "{newSkillPlanted}" Click add skill to add it to your profile.
                </p>
              </div>
            )}
            {newSkillPlanted && submitting && (
              <div className="mb-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  <span className="animate-pulse">✨</span> Adding "{newSkillPlanted}" to your profile...
                </p>
              </div>
            )}
            <button
              onClick={handleAddSkill}
              disabled={submitting || !selectedSkillId}
              className="w-full px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Skill'}
            </button>
          </div>
        </div>

        {/* Your Skills List */}
        <div className="mb-6 relative z-0">
          <h2 className="text-lg font-medium mb-4">
            Your Skills ({userSkills.length})
          </h2>
          
          {userSkills.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
              No skills added yet. Add your first skill above!
            </p>
          ) : (
            <div className="space-y-3">
              {userSkills.map((skill) => {
                const isJoined = followedSkills.includes(skill.key);
                const isSubmittingFollow = submittingFollow === skill.key;
                const skillSlug = skill.slug || normalizeSkillSlug(skill.name_canonical);
                const topicLink = skillSlug ? `/topic/${skillSlug}` : null;

                return (
                  <div
                    key={skill.key}
                    className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {skill.name_canonical}
                          </span>
                          {arkivBuilderMode && skill.key && (
                            <ViewOnArkivLink
                              entityKey={skill.key}
                              txHash={skill.txHash}
                              label="View Skill Entity"
                              className="text-xs"
                            />
                          )}
                          {!arkivBuilderMode && skill.txHash && (
                            <a
                              href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${skill.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                              title="View Skill entity on Arkiv Explorer"
                            >
                              🔗 View on Arkiv
                            </a>
                          )}
                          {arkivBuilderMode && skill.key && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              Key: {skill.key.slice(0, 12)}...
                            </span>
                          )}
                        </div>
                        {skill.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">
                            {skill.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {topicLink && (
                            <Link
                              href={topicLink}
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              View Community →
                            </Link>
                          )}
                          {walletAddress && (
                            <ArkivQueryTooltip
                              query={[
                                `POST /api/learning-follow { action: '${isJoined ? 'unfollow' : 'follow'}', ... }`,
                                isJoined 
                                  ? `Updates: type='learning_follow' entity (sets active=false)`
                                  : `Creates: type='learning_follow' entity`,
                                `Attributes: profile_wallet='${walletAddress.toLowerCase().slice(0, 8)}...', skill_id='${skill.key.slice(0, 12)}...', active=${!isJoined}`,
                                `Payload: Full learning follow data`,
                                `TTL: 1 year (31536000 seconds)`
                              ]}
                              label={isJoined ? 'Leave Community' : 'Join Community'}
                            >
                              <button
                                onClick={async () => {
                                  if (!walletAddress || !skill.key || isSubmittingFollow) return;
                                  
                                  const action = isJoined ? 'unfollow' : 'follow';
                                  setSubmittingFollow(skill.key);
                                  try {
                                    const res = await fetch('/api/learning-follow', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        action,
                                        profile_wallet: walletAddress,
                                        skill_id: skill.key,
                                      }),
                                    });
                                    
                                    const data = await res.json();
                                    if (data.ok) {
                                      // Wait for Arkiv to index the new entity (especially important for joins)
                                      await new Promise(resolve => setTimeout(resolve, 1500));
                                      // Reload followed skills
                                      const follows = await listLearningFollows({ profile_wallet: walletAddress, active: true });
                                      setFollowedSkills(follows.map(f => f.skill_id));
                                    } else {
                                      alert(data.error || `Failed to ${isJoined ? 'leave' : 'join'} community`);
                                    }
                                  } catch (error: any) {
                                    console.error(`Error ${isJoined ? 'leaving' : 'joining'} community:`, error);
                                    alert(`Failed to ${isJoined ? 'leave' : 'join'} community`);
                                  } finally {
                                    setSubmittingFollow(null);
                                  }
                                }}
                                disabled={isSubmittingFollow}
                                className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isJoined
                                    ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    : 'border-emerald-500 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                }`}
                              >
                                {isSubmittingFollow 
                                  ? (isJoined ? 'Leaving...' : 'Joining...') 
                                  : (isJoined ? 'Leave' : 'Join')
                                }
                              </button>
                            </ArkivQueryTooltip>
                          )}
                        </div>
                        {skill.txHash && (
                          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              Skill Entity Transaction:
                            </p>
                            <a
                              href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${skill.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-mono break-all"
                            >
                              {skill.txHash.slice(0, 20)}...
                            </a>
                          </div>
                        )}
                      </div>
                      {arkivBuilderMode ? (
                        <ArkivQueryTooltip
                          query={[
                            `POST /api/profile { action: 'updateProfile', ... }`,
                            `Creates: type='user_profile' entity`,
                            `Attributes: wallet, displayName, skills, skill_ids (removed), ...`,
                            `Payload: Full profile data with updated skill_ids array`,
                            `TTL: 1 year (31536000 seconds)`,
                            `Note: Creates new immutable profile entity on Arkiv`
                          ]}
                          label="Remove Skill"
                        >
                          <button
                            onClick={() => handleRemoveSkill(skill.key)}
                            disabled={submitting}
                            className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </ArkivQueryTooltip>
                      ) : (
                        <button
                          onClick={() => handleRemoveSkill(skill.key)}
                          disabled={submitting}
                          className="ml-4 px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


        {/* Technical Note */}
        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
            <strong>How it works:</strong>
          </p>
          <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
            <li>Skills are <strong>Arkiv Skill entities</strong> stored on-chain</li>
            <li>Your profile <strong>references</strong> these Skill entities (by skill_id)</li>
            <li>Each profile update creates a <strong>new immutable profile entity</strong> on Arkiv</li>
            <li>All changes are permanent and viewable on the <a href="https://explorer.mendoza.hoodi.arkiv.network" target="_blank" rel="noopener noreferrer" className="underline">Arkiv Explorer</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
