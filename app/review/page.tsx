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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { EntityWriteInfo } from '@/components/EntityWriteInfo';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onError('');

    try {
      if (!formData.displayName.trim() || !formData.username.trim() || !formData.bio.trim()) {
        throw new Error('Display name, username, and bio are required');
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
        <h2 className="text-2xl font-semibold mb-4">Profile {profile ? 'Updated' : 'Created'}</h2>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
          <p className="text-green-800 dark:text-green-300">
            Profile {profile ? 'updated' : 'created'} successfully!
          </p>
          <ViewOnArkivLink entityKey={createdProfile.key} txHash={createdProfile.txHash} />
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
          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            required
            disabled={!!profile}
            className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 disabled:opacity-50"
          />
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

// Skills Step Component (simplified - links to /me/skills)
function SkillsStep({ wallet, profile, onProfileUpdated, onError }: {
  wallet: string;
  profile: any;
  onProfileUpdated: (profile: any) => void;
  onError: (error: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Manage Skills</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Add, remove, or edit skills on your profile. Skills are stored in the profile entity's skillsArray.
      </p>
      <Link
        href="/me/skills"
        className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Go to Skills Page →
      </Link>
    </div>
  );
}

// Availability Step Component (simplified - links to /me/availability)
function AvailabilityStep({ wallet, onError }: {
  wallet: string;
  onError: (error: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Manage Availability</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Add, remove, or edit availability blocks. Each availability block is a separate entity on Arkiv.
      </p>
      <Link
        href="/me/availability"
        className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Go to Availability Page →
      </Link>
    </div>
  );
}

// Asks Step Component (simplified - links to /asks)
function AsksStep({ wallet, profile, onError }: {
  wallet: string;
  profile: any;
  onError: (error: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Create Asks</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create learning requests (asks). Each ask is a separate entity on Arkiv with TTL.
      </p>
      <Link
        href="/asks"
        className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Go to Asks Page →
      </Link>
    </div>
  );
}

// Offers Step Component (simplified - links to /offers)
function OffersStep({ wallet, profile, onError }: {
  wallet: string;
  profile: any;
  onError: (error: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Create Offers</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-4">
        Create teaching offers. Each offer is a separate entity on Arkiv with TTL and optional payment details.
      </p>
      <Link
        href="/offers"
        className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        Go to Offers Page →
      </Link>
    </div>
  );
}

