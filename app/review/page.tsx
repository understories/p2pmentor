/**
 * Review Mode Onboarding Page
 * 
 * Clean one-page UI for reviewers to test all M1 acceptance criteria scenarios.
 * Gated with access grant entity check.
 * 
 * Steps:
 * 1. Create profile
 * 2. Add/remove/edit skills
 * 3. Add/remove/edit availability
 * 4. Create asks
 * 5. Create offers
 * 6. Explore network
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getProfileByWallet, checkUsernameExists } from '@/lib/arkiv/profile';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { EntityWriteInfo } from '@/components/EntityWriteInfo';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { SkillSelector } from '@/components/SkillSelector';
import { listSkills } from '@/lib/arkiv/skill';
import type { Skill } from '@/lib/arkiv/skill';
import { WeeklyAvailabilityEditor } from '@/components/availability/WeeklyAvailabilityEditor';
import { listAvailabilityForWallet, type Availability, type WeeklyAvailability } from '@/lib/arkiv/availability';
import Link from 'next/link';

type ReviewStep = 'profile' | 'skills' | 'availability' | 'asks' | 'offers' | 'complete';

export default function ReviewOnboardingPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ReviewStep>('profile');
  const [checkingGuards, setCheckingGuards] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const arkivBuilderMode = useArkivBuilderMode();

  // Get wallet from localStorage (reuse existing pattern from onboarding page)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      if (storedWallet) {
        console.log('[Review Onboarding] Wallet from localStorage:', `${storedWallet.substring(0, 6)}...${storedWallet.substring(storedWallet.length - 4)}`);
        setWallet(storedWallet);
        
        // Set review mode bypass (reuse onboarding bypass pattern)
        import('@/lib/onboarding/access').then(({ setReviewModeBypass }) => {
          setReviewModeBypass(true);
        });
      } else {
        console.warn('[Review Onboarding] No wallet found, redirecting to /auth');
        router.push('/auth');
      }
    }
  }, [router]);

  // Load profile and set initial step (no grant checking - we trust the API response)
  useEffect(() => {
    const loadProfile = async () => {
      if (!wallet) {
        return;
      }
      
      setCheckingGuards(true);
      
      try {
        // Load profile if it exists
        console.log('[Review Onboarding] Loading profile');
        const existingProfile = await getProfileByWallet(wallet);
        if (existingProfile) {
          console.log('[Review Onboarding] Profile found, starting at skills step');
          setProfile(existingProfile);
          setCurrentStep('skills');
        } else {
          console.log('[Review Onboarding] No profile found, starting at profile step');
          setCurrentStep('profile');
        }
        
        setCheckingGuards(false);
      } catch (err) {
        console.error('[Review Onboarding] Failed to load profile:', err);
        setCheckingGuards(false);
      }
    };
    
    loadProfile();
  }, [wallet]);

  // Load profile when wallet changes
  useEffect(() => {
    const loadProfile = async () => {
      if (!wallet) return;
      
      try {
        const existingProfile = await getProfileByWallet(wallet);
        if (existingProfile) {
          setProfile(existingProfile);
        }
      } catch (err) {
        console.error('[Review Onboarding] Failed to load profile:', err);
      }
    };
    
    loadProfile();
  }, [wallet]);

  if (checkingGuards || !wallet) {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Checking review mode access...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
            Arkiv Review Mode
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Barebones step-by-step UI for testing Arkiv functionality
          </p>
        </div>

        {/* Profile Action Button at Top */}
        <div className="mb-6">
          {profile ? (
            <button
              onClick={() => setCurrentStep('profile')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Edit Profile
            </button>
          ) : (
            <button
              onClick={() => setCurrentStep('profile')}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Create Profile
            </button>
          )}
        </div>

        {/* Step Navigation */}
        <div className="mb-8 flex flex-wrap gap-2">
          {(['profile', 'skills', 'availability', 'asks', 'offers'] as ReviewStep[]).map((step) => (
            <button
              key={step}
              onClick={() => setCurrentStep(step)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentStep === step
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {step.charAt(0).toUpperCase() + step.slice(1)}
            </button>
          ))}
          <Link
            href="/network"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Explore Network →
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          {currentStep === 'profile' && (
            <ProfileStep
              wallet={wallet}
              profile={profile}
              onProfileCreated={(newProfile) => {
                setProfile(newProfile);
                setCurrentStep('skills');
              }}
              onError={setError}
            />
          )}

          {currentStep === 'skills' && (
            <SkillsStep
              wallet={wallet}
              profile={profile}
              onProfileUpdated={(updatedProfile) => {
                setProfile(updatedProfile);
              }}
              onError={setError}
            />
          )}

          {currentStep === 'availability' && (
            <AvailabilityStep
              wallet={wallet}
              onError={setError}
            />
          )}

          {currentStep === 'asks' && (
            <AsksStep
              wallet={wallet}
              profile={profile}
              onError={setError}
            />
          )}

          {currentStep === 'offers' && (
            <OffersStep
              wallet={wallet}
              profile={profile}
              onError={setError}
            />
          )}
        </div>
      </div>
    </main>
  );
}

// Profile Step Component
function ProfileStep({ wallet, profile, onProfileCreated, onError }: {
  wallet: string;
  profile: any;
  onProfileCreated: (profile: any) => void;
  onError: (error: string) => void;
}) {
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    username: profile?.username || '',
    bio: profile?.bio || '',
    timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdProfile, setCreatedProfile] = useState<{ key: string; txHash: string } | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time username uniqueness checking (reuse from IdentityStep)
  useEffect(() => {
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    if (!formData.username.trim()) {
      setUsernameError(null);
      return;
    }

    // Skip check if profile exists (username cannot be changed)
    if (profile) {
      setUsernameError(null);
      return;
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(formData.username.trim())) {
      setUsernameError('Username must be 3-20 characters, alphanumeric with _ or -');
      return;
    }

    // Debounce username check
    setIsCheckingUsername(true);
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const existingProfiles = await checkUsernameExists(formData.username.trim());
        // Filter out profiles from the same wallet (user can reuse their own username)
        const otherWalletProfiles = existingProfiles.filter(p => 
          p.wallet.toLowerCase() !== wallet.toLowerCase()
        );
        
        if (otherWalletProfiles.length > 0) {
          setUsernameError('Username already taken');
        } else {
          setUsernameError(null);
        }
      } catch (err) {
        console.error('Error checking username:', err);
        // Don't block on check error, let API handle it
        setUsernameError(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [formData.username, wallet, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onError('');

    try {
      if (!formData.displayName.trim() || !formData.username.trim() || !formData.bio.trim()) {
        throw new Error('Display name, username, and bio are required');
      }

      if (usernameError) {
        throw new Error(usernameError);
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: profile ? 'updateProfile' : 'createProfile',
          wallet,
          displayName: formData.displayName.trim(),
          username: formData.username.trim(),
          bio: formData.bio.trim(),
          timezone: formData.timezone,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create/update profile');
      }

      setCreatedProfile({ key: data.key, txHash: data.txHash });
      
      // Reload profile
      const updatedProfile = await getProfileByWallet(wallet);
      if (updatedProfile) {
        onProfileCreated(updatedProfile);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create/update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdProfile) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-4">Profile Created</h2>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
          <p className="text-green-800 dark:text-green-300 font-medium mb-4">
            Profile created successfully!
          </p>
          
          {/* Full Entity Information */}
          <div className="space-y-2 mb-4 text-sm">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Entity Key:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {createdProfile.key}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {createdProfile.txHash}
              </code>
            </div>
          </div>

          {/* View on Arkiv Link */}
          <div className="mt-4">
            <ViewOnArkivLink 
              entityKey={createdProfile.key} 
              txHash={createdProfile.txHash}
              label="View on Arkiv Explorer"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setCreatedProfile(null);
            setFormData({
              displayName: '',
              username: '',
              bio: '',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });
          }}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Create/Edit Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.username}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                setFormData(prev => ({ ...prev, username: value }));
              }}
              required
              disabled={!!profile || isSubmitting}
              maxLength={20}
              minLength={3}
              className={`w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 disabled:opacity-50 ${
                usernameError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : formData.username.trim() && !usernameError && !isCheckingUsername
                  ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {isCheckingUsername && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
              </div>
            )}
          </div>
          {usernameError && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">{usernameError}</p>
          )}
          {profile && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Username cannot be changed after creation
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Bio <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
            required
            rows={4}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Timezone <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.timezone}
            onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
            required
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
        </button>
      </form>
    </div>
  );
}

// Skills Step Component
function SkillsStep({ wallet, profile, onProfileUpdated, onError }: {
  wallet: string;
  profile: any;
  onProfileUpdated: (profile: any) => void;
  onError: (error: string) => void;
}) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedSkillName, setSelectedSkillName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastWriteInfo, setLastWriteInfo] = useState<{ key: string; txHash: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const skills = await listSkills({ status: 'active', limit: 500 });
        setAllSkills(skills);
      } catch (err) {
        console.error('Error loading skills:', err);
        onError('Failed to load skills');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const getUserSkillIds = (): string[] => {
    if (!profile) return [];
    return (profile as any).skill_ids || [];
  };

  const getUserSkills = (): Skill[] => {
    const skillIds = getUserSkillIds();
    return allSkills.filter(skill => skillIds.includes(skill.key));
  };

  const handleAddSkill = async () => {
    if (!selectedSkillId || !selectedSkillName || !profile) {
      onError('Please select a skill');
      return;
    }

    const currentSkillIds = getUserSkillIds();
    if (currentSkillIds.includes(selectedSkillId)) {
      onError('Skill already added');
      return;
    }

    setIsSubmitting(true);
    onError('');

    try {
      const updatedSkillIds = [...currentSkillIds, selectedSkillId];
      const currentSkills = profile.skillsArray || [];
      const updatedSkills = [...currentSkills, selectedSkillName];

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet,
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

      if (data.key && data.txHash) {
        setLastWriteInfo({ key: data.key, txHash: data.txHash });
      }

      const updatedProfile = await getProfileByWallet(wallet);
      if (updatedProfile) {
        onProfileUpdated(updatedProfile);
      }

      setSelectedSkillId('');
      setSelectedSkillName('');
    } catch (err: any) {
      onError(err.message || 'Failed to add skill');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!profile) return;

    const skill = allSkills.find(s => s.key === skillId);
    if (!skill) return;

    if (!confirm(`Remove "${skill.name_canonical}" from your skills?`)) {
      return;
    }

    setIsSubmitting(true);
    onError('');

    try {
      const currentSkillIds = getUserSkillIds();
      const updatedSkillIds = currentSkillIds.filter(id => id !== skillId);
      const currentSkills = profile.skillsArray || [];
      const updatedSkills = currentSkills.filter((s: string) => s.toLowerCase() !== skill.name_canonical.toLowerCase());

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateProfile',
          wallet,
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

      if (data.key && data.txHash) {
        setLastWriteInfo({ key: data.key, txHash: data.txHash });
      }

      const updatedProfile = await getProfileByWallet(wallet);
      if (updatedProfile) {
        onProfileUpdated(updatedProfile);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to remove skill');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading skills...</div>;
  }

  const userSkills = getUserSkills();

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Manage Skills</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Add, remove, or edit skills on your profile. Skills are stored in the profile entity's skillsArray.
      </p>

      {lastWriteInfo && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-medium mb-2">Profile updated successfully!</p>
          <div className="space-y-1 text-sm mb-2">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Entity Key:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.key}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.txHash}
              </code>
            </div>
          </div>
          <ViewOnArkivLink entityKey={lastWriteInfo.key} txHash={lastWriteInfo.txHash} label="View on Arkiv Explorer" />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Add Skill</label>
          <SkillSelector
            value={selectedSkillId}
            onChange={(skillId, skillName) => {
              setSelectedSkillId(skillId);
              setSelectedSkillName(skillName);
            }}
            allowCreate={true}
            placeholder="Select or create a skill..."
            required
          />
          <button
            onClick={handleAddSkill}
            disabled={!selectedSkillId || isSubmitting}
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Adding...' : 'Add Skill'}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Your Skills</label>
          {userSkills.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No skills added yet.</p>
          ) : (
            <div className="space-y-2">
              {userSkills.map((skill) => (
                <div key={skill.key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span>{skill.name_canonical}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill.key)}
                    disabled={isSubmitting}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Availability Step Component
function AvailabilityStep({ wallet, onError }: {
  wallet: string;
  onError: (error: string) => void;
}) {
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyAvailability | null>(null);
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [lastWriteInfo, setLastWriteInfo] = useState<{ key: string; txHash: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await listAvailabilityForWallet(wallet);
        setAvailabilities(data);
      } catch (err) {
        console.error('Error loading availability:', err);
        onError('Failed to load availability');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weeklyAvailability) {
      onError('Please set your availability');
      return;
    }

    setIsSubmitting(true);
    onError('');

    try {
      const res = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet,
          timeBlocks: weeklyAvailability,
          timezone,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create availability');
      }

      if (data.key && data.txHash) {
        setLastWriteInfo({ key: data.key, txHash: data.txHash });
      }

      setWeeklyAvailability(null);
      const updated = await listAvailabilityForWallet(wallet);
      setAvailabilities(updated);
    } catch (err: any) {
      onError(err.message || 'Failed to create availability');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (availabilityKey: string) => {
    if (!confirm('Are you sure you want to delete this availability block?')) {
      return;
    }

    setIsDeleting(availabilityKey);
    onError('');

    try {
      const res = await fetch('/api/availability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availabilityKey,
          wallet,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to delete availability');
      }

      const updated = await listAvailabilityForWallet(wallet);
      setAvailabilities(updated);
    } catch (err: any) {
      onError(err.message || 'Failed to delete availability');
    } finally {
      setIsDeleting(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600 dark:text-gray-400">Loading availability...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Manage Availability</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Add, remove, or edit availability blocks. Each availability block is a separate entity on Arkiv.
      </p>

      {lastWriteInfo && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-medium mb-2">Availability created successfully!</p>
          <div className="space-y-1 text-sm mb-2">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Entity Key:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.key}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.txHash}
              </code>
            </div>
          </div>
          <ViewOnArkivLink entityKey={lastWriteInfo.key} txHash={lastWriteInfo.txHash} label="View on Arkiv Explorer" />
        </div>
      )}

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Add Availability Block</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <WeeklyAvailabilityEditor
              value={weeklyAvailability}
              onChange={setWeeklyAvailability}
              timezone={timezone}
              onTimezoneChange={setTimezone}
            />
            <button
              type="submit"
              disabled={!weeklyAvailability || isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Availability'}
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Your Availability Blocks</h3>
          {availabilities.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No availability blocks yet.</p>
          ) : (
            <div className="space-y-2">
              {availabilities.map((availability) => (
                <div key={availability.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{availability.timezone}</div>
                    <ViewOnArkivLink entityKey={availability.key} txHash={availability.txHash} label="View on Arkiv" />
                  </div>
                  <button
                    onClick={() => handleDelete(availability.key)}
                    disabled={isDeleting === availability.key}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting === availability.key ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Asks Step Component
function AsksStep({ wallet, profile, onError }: {
  wallet: string;
  profile: any;
  onError: (error: string) => void;
}) {
  const [skillId, setSkillId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [message, setMessage] = useState('');
  const [ttlHours, setTtlHours] = useState('168'); // Default 1 week
  const [customTtlHours, setCustomTtlHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastWriteInfo, setLastWriteInfo] = useState<{ key: string; txHash: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillId || !message.trim()) {
      onError('Please select a skill and enter a message');
      return;
    }

    setIsSubmitting(true);
    onError('');

    try {
      const ttlValue = ttlHours === 'custom' ? customTtlHours : ttlHours;
      const ttlHoursNum = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHoursNum) || ttlHoursNum <= 0 ? 604800 : Math.floor(ttlHoursNum * 3600);

      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet,
          skill: skillName.trim(),
          skill_id: skillId,
          skill_label: skillName.trim(),
          message: message.trim(),
          expiresIn,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create ask');
      }

      if (data.key && data.txHash) {
        setLastWriteInfo({ key: data.key, txHash: data.txHash });
      }

      setMessage('');
      setSkillId('');
      setSkillName('');
      setTtlHours('168');
      setCustomTtlHours('');
    } catch (err: any) {
      onError(err.message || 'Failed to create ask');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Create Asks</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create learning requests (asks). Each ask is a separate entity on Arkiv with TTL.
      </p>

      {lastWriteInfo && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-medium mb-2">Ask created successfully!</p>
          <div className="space-y-1 text-sm mb-2">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Entity Key:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.key}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.txHash}
              </code>
            </div>
          </div>
          <ViewOnArkivLink entityKey={lastWriteInfo.key} txHash={lastWriteInfo.txHash} label="View on Arkiv Explorer" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Skill <span className="text-red-500">*</span>
          </label>
          <SkillSelector
            value={skillId}
            onChange={(id, name) => {
              setSkillId(id);
              setSkillName(name);
            }}
            allowCreate={true}
            placeholder="Select or create a skill..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Describe what you want to learn..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Expiration (TTL)</label>
          <select
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="24">24 hours</option>
            <option value="168">1 week</option>
            <option value="720">1 month</option>
            <option value="custom">Custom</option>
          </select>
          {ttlHours === 'custom' && (
            <input
              type="number"
              value={customTtlHours}
              onChange={(e) => setCustomTtlHours(e.target.value)}
              placeholder="Hours"
              min="1"
              className="mt-2 w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!skillId || !message.trim() || isSubmitting}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Ask'}
        </button>
      </form>
    </div>
  );
}

// Offers Step Component
function OffersStep({ wallet, profile, onError }: {
  wallet: string;
  profile: any;
  onError: (error: string) => void;
}) {
  const [skillId, setSkillId] = useState('');
  const [skillName, setSkillName] = useState('');
  const [message, setMessage] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [cost, setCost] = useState('');
  const [paymentAddress, setPaymentAddress] = useState('');
  const [ttlHours, setTtlHours] = useState('168'); // Default 1 week
  const [customTtlHours, setCustomTtlHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastWriteInfo, setLastWriteInfo] = useState<{ key: string; txHash: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillId || !message.trim()) {
      onError('Please select a skill and enter a message');
      return;
    }

    if (isPaid) {
      if (!cost.trim()) {
        onError('Cost is required for paid offers');
        return;
      }
      if (!paymentAddress.trim()) {
        onError('Payment address is required for paid offers');
        return;
      }
    }

    setIsSubmitting(true);
    onError('');

    try {
      const ttlValue = ttlHours === 'custom' ? customTtlHours : ttlHours;
      const ttlHoursNum = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHoursNum) || ttlHoursNum <= 0 ? 604800 : Math.floor(ttlHoursNum * 3600);

      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOffer',
          wallet,
          skill: skillName.trim(),
          skill_id: skillId,
          skill_label: skillName.trim(),
          message: message.trim(),
          availabilityWindow: '',
          isPaid,
          cost: isPaid ? cost.trim() : undefined,
          paymentAddress: isPaid ? paymentAddress.trim() : undefined,
          expiresIn,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create offer');
      }

      if (data.key && data.txHash) {
        setLastWriteInfo({ key: data.key, txHash: data.txHash });
      }

      setMessage('');
      setSkillId('');
      setSkillName('');
      setIsPaid(false);
      setCost('');
      setPaymentAddress('');
      setTtlHours('168');
      setCustomTtlHours('');
    } catch (err: any) {
      onError(err.message || 'Failed to create offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Create Offers</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create teaching offers. Each offer is a separate entity on Arkiv with TTL and optional payment details.
      </p>

      {lastWriteInfo && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-300 font-medium mb-2">Offer created successfully!</p>
          <div className="space-y-1 text-sm mb-2">
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Entity Key:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.key}
              </code>
            </div>
            <div>
              <span className="font-medium text-gray-700 dark:text-gray-300">Transaction Hash:</span>
              <code className="ml-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all">
                {lastWriteInfo.txHash}
              </code>
            </div>
          </div>
          <ViewOnArkivLink entityKey={lastWriteInfo.key} txHash={lastWriteInfo.txHash} label="View on Arkiv Explorer" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Skill <span className="text-red-500">*</span>
          </label>
          <SkillSelector
            value={skillId}
            onChange={(id, name) => {
              setSkillId(id);
              setSkillName(name);
            }}
            allowCreate={true}
            placeholder="Select or create a skill..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={4}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            placeholder="Describe your teaching offer..."
          />
        </div>

        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isPaid}
              onChange={(e) => setIsPaid(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-medium">Paid offer</span>
          </label>
        </div>

        {isPaid && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">
                Cost <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                required={isPaid}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="e.g., 0.01 ETH per session"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Payment Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentAddress}
                onChange={(e) => setPaymentAddress(e.target.value)}
                required={isPaid}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                placeholder="0x..."
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">Expiration (TTL)</label>
          <select
            value={ttlHours}
            onChange={(e) => setTtlHours(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
          >
            <option value="24">24 hours</option>
            <option value="168">1 week</option>
            <option value="720">1 month</option>
            <option value="custom">Custom</option>
          </select>
          {ttlHours === 'custom' && (
            <input
              type="number"
              value={customTtlHours}
              onChange={(e) => setCustomTtlHours(e.target.value)}
              placeholder="Hours"
              min="1"
              className="mt-2 w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!skillId || !message.trim() || isSubmitting || (isPaid && (!cost.trim() || !paymentAddress.trim()))}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Offer'}
        </button>
      </form>
    </div>
  );
}

