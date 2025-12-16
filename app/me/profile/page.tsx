/**
 * Profile management page
 * 
 * Create and edit user profile using Arkiv entities.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProfileByWallet, type UserProfile } from '@/lib/arkiv/profile';
import { connectWallet } from '@/lib/auth/metamask';
import { BackButton } from '@/components/BackButton';
import { TimezoneSelector } from '@/components/availability/TimezoneSelector';
import { RegrowProfileBrowser } from '@/components/profile/RegrowProfileBrowser';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timezone, setTimezone] = useState<string>('');
  const [learnerQuestCompletion, setLearnerQuestCompletion] = useState<{ percent: number; readCount: number; totalMaterials: number } | null>(null);
  const [mode, setMode] = useState<'select' | 'regrow' | 'create'>('select'); // 'select' = show buttons, 'regrow' = show browser, 'create' = show form
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

  useEffect(() => {
    // Get wallet address from localStorage
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      // Initialize timezone with auto-detection (will be overridden if profile has timezone)
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(detected);
      } catch {
        setTimezone('UTC');
      }
      loadProfile(address);
    }
  }, [router]);

  const loadProfile = async (wallet: string) => {
    try {
      setLoading(true);
      const profileData = await getProfileByWallet(wallet);
      setProfile(profileData);
      // Set timezone from profile if available, otherwise keep auto-detected value
      if (profileData?.timezone) {
        setTimezone(profileData.timezone);
      }
      // If no profile timezone, timezone state already has auto-detected value from useEffect

      // Day 2: For profile-less wallets, show selection mode (two buttons)
      if (!profileData) {
        setMode('select');
      } else {
        // If profile exists, show edit mode (form is visible)
        setMode('create');
      }

      // Load learner quest completion percentage
      loadLearnerQuestCompletion(wallet);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const loadLearnerQuestCompletion = async (walletAddress: string) => {
    try {
      // Fetch all active quests
      const questsRes = await fetch('/api/learner-quests');
      const questsData = await questsRes.json();
      
      if (!questsData.ok || !questsData.quests || questsData.quests.length === 0) {
        setLearnerQuestCompletion(null);
        return;
      }

      const quests = questsData.quests;

      // Load progress for all quests in parallel
      const progressPromises = quests.map(async (quest: any) => {
        try {
          const res = await fetch(`/api/learner-quests/progress?questId=${quest.questId}&wallet=${walletAddress}`);
          const data = await res.json();

          if (data.ok && data.progress) {
            const readCount = Object.values(data.progress).filter((p: any) => p.status === 'read').length;
            const totalMaterials = quest.materials.length;
            return { readCount, totalMaterials };
          }
          return { readCount: 0, totalMaterials: quest.materials.length };
        } catch (err) {
          console.error(`Error loading progress for quest ${quest.questId}:`, err);
          return { readCount: 0, totalMaterials: quest.materials.length };
        }
      });

      const results = await Promise.all(progressPromises);
      const totalRead = results.reduce((sum, r) => sum + r.readCount, 0);
      const totalMaterials = results.reduce((sum, r) => sum + r.totalMaterials, 0);
      const percent = totalMaterials > 0 ? Math.round((totalRead / totalMaterials) * 100) : 0;

      setLearnerQuestCompletion({ percent, readCount: totalRead, totalMaterials });
    } catch (err) {
      console.error('Error loading learner quest completion:', err);
      setLearnerQuestCompletion(null);
    }
  };


  const handleRegrowSelect = async (selectedProfile: any) => {
    try {
      setSubmitting(true);
      setError('');
      setSuccess('');
      setMode('select'); // Return to select mode after regrow

      if (!walletAddress) {
        setError('No wallet connected');
        return;
      }

      // Beta: Clone the selected profile's data into a new profile for the current wallet
      // We use the selected profile's data directly, not via the regrow API
      // (since the profile might be from a different wallet)
      const candidate = {
        displayName: selectedProfile.displayName,
        username: selectedProfile.username,
        profileImage: selectedProfile.profileImage,
        bio: selectedProfile.bio,
        bioShort: selectedProfile.bioShort,
        bioLong: selectedProfile.bioLong,
        skills: selectedProfile.skills || '',
        skillsArray: selectedProfile.skillsArray,
        timezone: selectedProfile.timezone || timezone || 'UTC',
        languages: selectedProfile.languages,
        contactLinks: selectedProfile.contactLinks,
        seniority: selectedProfile.seniority,
        domainsOfInterest: selectedProfile.domainsOfInterest,
        mentorRoles: selectedProfile.mentorRoles,
        learnerRoles: selectedProfile.learnerRoles,
      };

      // Beta: Create a new profile for the current wallet using the selected profile's data
      // This clones any historical profile into a new profile for the user's wallet
      const createRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createProfile',
          wallet: walletAddress, // Use current wallet, not the original profile's wallet
          displayName: candidate.displayName,
          username: candidate.username,
          profileImage: candidate.profileImage,
          bio: candidate.bio,
          bioShort: candidate.bioShort,
          bioLong: candidate.bioLong,
          skills: candidate.skills || '',
          skillsArray: candidate.skillsArray,
          timezone: candidate.timezone || timezone || 'UTC',
          languages: candidate.languages,
          contactLinks: candidate.contactLinks,
          seniority: candidate.seniority,
          domainsOfInterest: candidate.domainsOfInterest,
          mentorRoles: candidate.mentorRoles,
          learnerRoles: candidate.learnerRoles,
        }),
      });

      const createResult = await createRes.json();
      if (!createResult.ok) {
        // Handle rate limit errors with specific message
        if (createResult.rateLimited || createRes.status === 429) {
          throw new Error('Rate limit exceeded. The Arkiv network is temporarily limiting requests. Please wait 30-60 seconds and try again.');
        }
        throw new Error(createResult.error || 'Failed to clone profile');
      }

      setSuccess(`Profile regrown from history! Entity key: ${createResult.key?.substring(0, 16)}...`);
      
      // Wait a moment to show success message clearly before reloading
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      await loadProfile(walletAddress);
    } catch (err: any) {
      console.error('Error regrowing profile:', err);
      setError(err.message || 'Failed to regrow profile');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    if (!walletAddress) {
      setError('No wallet connected');
      setSubmitting(false);
      return;
    }

    const formData = new FormData(e.target as HTMLFormElement);
    
    // Core Identity
    const displayName = formData.get('displayName') as string;
    const username = formData.get('username') as string;
    const profileImage = formData.get('profileImage') as string;
    const bio = formData.get('bio') as string;
    const bioShort = formData.get('bioShort') as string;
    const bioLong = formData.get('bioLong') as string;
    // Use state timezone (from TimezoneSelector) or fallback to form data
    const timezoneValue = timezone || (formData.get('timezone') as string) || 'UTC';

    // Languages
    const languagesStr = formData.get('languages') as string;
    const languages = languagesStr ? languagesStr.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    
    // Contact Links
    const contactLinks = {
      twitter: formData.get('contactTwitter') as string || undefined,
      github: formData.get('contactGithub') as string || undefined,
      telegram: formData.get('contactTelegram') as string || undefined,
      discord: formData.get('contactDiscord') as string || undefined,
    };
    // Remove undefined values
    Object.keys(contactLinks).forEach(key => {
      if (!contactLinks[key as keyof typeof contactLinks]) {
        delete contactLinks[key as keyof typeof contactLinks];
      }
    });
    
    // Skills - No longer editable here, must use /me/skills page
    // Keep existing skills from profile
    const skillsArray = profile?.skillsArray;
    const seniority = formData.get('seniority') as string || undefined;

    try {
      // Always use API route for profile creation (like mentor-graph)
      // The API route uses the server's private key to sign transactions
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createProfile',
            wallet: walletAddress,
            displayName,
            username: username || undefined,
            profileImage: profileImage || undefined,
            bio: bio || undefined,
            bioShort: bioShort || undefined,
            bioLong: bioLong || undefined,
            skills: skillsArray?.join(', ') || '', // Legacy format for backward compatibility
            skillsArray,
            timezone: timezoneValue,
            languages,
            contactLinks: Object.keys(contactLinks).length > 0 ? contactLinks : undefined,
            seniority: seniority || undefined,
          }),
      });

      const result = await res.json();
      if (!result.ok) {
        // Handle username duplicate error with regrow option
        if (res.status === 409 && result.duplicateProfiles && result.duplicateProfiles.length > 0) {
          const error: any = new Error(result.error || 'Username already exists');
          error.duplicateProfiles = result.duplicateProfiles;
          error.canRegrow = result.canRegrow;
          throw error;
        }
        throw new Error(result.error || 'Failed to create profile');
      }

      // Track action completion
      if (result.ok) {
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('profile_created');
      }

      // Check if transaction is pending
      if (result.pending) {
        setSuccess('Profile creation submitted! Transaction is being processed. Please refresh in a moment.');
        setTimeout(() => loadProfile(walletAddress), 2000);
      } else {
        setSuccess(`Profile created! Entity key: ${result.key?.substring(0, 16)}...`);
        // Reload profile
        await loadProfile(walletAddress);
      }
    } catch (err: any) {
      console.error('Error creating profile:', err);
      if (err.duplicateProfiles && err.duplicateProfiles.length > 0) {
        // Store duplicate profiles in window for error display
        (window as any).duplicateProfiles = err.duplicateProfiles;
        setError('Username already exists');
      } else {
        // Clear duplicateProfiles if different error
        (window as any).duplicateProfiles = undefined;
        setError(err.message || 'Failed to create profile');
      }
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
                `getProfileByWallet("${walletAddress || '...'}")`,
                `Query: type='user_profile', wallet='${walletAddress?.toLowerCase() || '...'}'`,
                `Returns: UserProfile | null`,
                `Note: Returns most recent profile (sorted by createdAt DESC)`
              ]}
              label="Loading Profile"
            >
              <p>Loading profile...</p>
            </ArkivQueryTooltip>
          ) : (
            <p>Loading profile...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className={`${!profile && mode === 'regrow' ? 'max-w-full' : 'max-w-2xl'} mx-auto`}>
        <div className="mb-6 flex items-center justify-between">
          <BackButton href="/me" />
          <Link
            href="/me/skills"
            className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
          >
            Skills &gt;
          </Link>
        </div>
        <h1 className="text-3xl font-semibold mb-6">Profile</h1>

        {/* Day 2: For profile-less wallets, show two buttons at top */}
        {!profile && mode === 'select' && (
          <div className="mb-6 flex gap-4">
            <ArkivQueryTooltip
              query={[
                `createUserProfile({ wallet, ...profileData })`,
                `Creates: type='user_profile' entity`,
                `Attributes: wallet, displayName, username, timezone, skills, ...`,
                `Payload: Full profile data (bio, contactLinks, etc.)`,
                `TTL: 1 year (31536000 seconds)`
              ]}
              label="Regrow Profile"
            >
              <div className="relative group">
                <button
                  onClick={() => setMode('regrow')}
                  className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors flex items-center gap-2"
                >
                  <span>🌱</span>
                  <span>Regrow Profile</span>
                </button>
              </div>
            </ArkivQueryTooltip>
            <ArkivQueryTooltip
              query={[
                `POST /api/profile { action: 'createProfile', ... }`,
                `Creates: type='user_profile' entity`,
                `Attributes: wallet, displayName, username, timezone, skills, ...`,
                `Payload: Full profile data (bio, contactLinks, etc.)`,
                `TTL: 1 year (31536000 seconds)`
              ]}
              label="Create Profile"
            >
              <div className="relative group">
                <button
                  onClick={() => setMode('create')}
                  className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Create Profile
                </button>
              </div>
            </ArkivQueryTooltip>
          </div>
        )}

        {/* Integral Profile View - Tab Navigation (only show when profile exists or in create mode) */}
        {(profile || mode === 'create') && (
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="flex gap-4" aria-label="Profile sections">
              <Link
                href="/me/profile"
                className="px-4 py-2 text-sm font-medium border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 transition-colors"
              >
                Core Identity
              </Link>
              <Link
                href="/me/skills"
                className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
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
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            <p className="font-medium mb-2">{error}</p>
            {error.includes('Username already exists') && typeof window !== 'undefined' && (window as any).duplicateProfiles && Array.isArray((window as any).duplicateProfiles) && (window as any).duplicateProfiles.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm">Found {(window as any).duplicateProfiles.length} profile(s) with this username:</p>
                <div className="space-y-2">
                  {(window as any).duplicateProfiles.map((dup: any, idx: number) => (
                    <div key={idx} className="p-3 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{dup.displayName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Wallet: {dup.wallet.slice(0, 10)}...{dup.wallet.slice(-8)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Created: {new Date(dup.createdAt).toLocaleDateString()}</p>
                        </div>
                        <a
                          href={`https://explorer.mendoza.hoodi.arkiv.network/entity/${dup.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                        >
                          View on Arkiv →
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setMode('regrow');
                    setError('');
                    (window as any).duplicateProfiles = undefined;
                  }}
                  className="mt-3 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  Regrow Profile?
                </button>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
            {success}
          </div>
        )}

        {/* Day 2: Show regrow browser when regrow mode is selected */}
        {!profile && mode === 'regrow' && walletAddress && (
          <div className="mb-6" style={{
            padding: 'clamp(1.5rem, 5vw, 4rem)',
            marginLeft: 'clamp(-2rem, -4vw, -1rem)',
            marginRight: 'clamp(-2rem, -4vw, -1rem)',
            marginTop: 'clamp(1rem, 3vw, 2rem)'
          }}>
            <button
              onClick={() => setMode('select')}
              className="mb-6 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              ← Back to options
            </button>
            <RegrowProfileBrowser
              wallet={walletAddress}
              onSelectProfile={handleRegrowSelect}
              onCancel={() => setMode('select')}
            />
          </div>
        )}

        {/* Show create profile intro only in create mode */}
        {!profile && mode === 'create' && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                Create Your Profile
              </h3>
              <button
                onClick={() => setMode('select')}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ← Back to options
              </button>
            </div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Create your profile to start connecting with mentors and learners in the network.
              All fields marked with * are required.
            </p>
          </div>
        )}

        {profile && (
          <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Editing existing profile</p>
                <p className="font-medium">{profile.displayName}</p>
                {profile.bioShort && <p className="text-sm mt-2">{profile.bioShort}</p>}
                {learnerQuestCompletion && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Learning Quests: {learnerQuestCompletion.percent}% complete ({learnerQuestCompletion.readCount} / {learnerQuestCompletion.totalMaterials} materials)
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Changes will create a new profile entity on Arkiv.
                </p>
                {arkivBuilderMode && profile.key && (
                  <div className="mt-3 flex items-center gap-2">
                    <ViewOnArkivLink
                      entityKey={profile.key}
                      txHash={profile.txHash}
                      label="View Profile Entity"
                      className="text-xs"
                    />
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                      Key: {profile.key.slice(0, 16)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Only show form when profile exists or in create mode */}
        {(profile || mode === 'create') && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core Identity */}
          <div className="space-y-4">
            <h2 className="text-xl font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
              Core Identity
            </h2>
            
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                Display Name *
              </label>
              <input
                type="text"
                id="displayName"
                name="displayName"
                required
                defaultValue={profile?.displayName || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                defaultValue={profile?.username || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="@username"
              />
            </div>

            <div>
              <label htmlFor="bioShort" className="block text-sm font-medium mb-1">
                Short Bio
              </label>
              <textarea
                id="bioShort"
                name="bioShort"
                rows={2}
                defaultValue={profile?.bioShort || profile?.bio || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="A brief description of yourself"
              />
            </div>

            <div>
              <label htmlFor="bioLong" className="block text-sm font-medium mb-1">
                Long Bio
              </label>
              <textarea
                id="bioLong"
                name="bioLong"
                rows={4}
                defaultValue={profile?.bioLong || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="A more detailed description"
              />
            </div>

            <div>
              <TimezoneSelector
                value={timezone}
                onChange={setTimezone}
                className=""
              />
              {/* Hidden input for form submission */}
              <input type="hidden" name="timezone" value={timezone} />
              {/* Display timezone conversion for verification */}
              <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-1">Timezone Verification</p>
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  Your timezone: <strong>{timezone}</strong>
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                  Current time in your timezone: {new Date().toLocaleString('en-US', { timeZone: timezone })}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  UTC time: {new Date().toISOString()}
                </p>
              </div>
            </div>
          </div>

          {/* Skills - Removed legacy text field, skills must be added as entities via /me/skills */}
          <div className="space-y-4">
            <h2 className="text-xl font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
              Skills
            </h2>
            
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200 mb-2">
                Skills are managed as first-class entities. Add or remove skills from the <Link href="/me/skills" className="underline font-medium">Skills page</Link>.
              </p>
              {profile?.skillsArray && profile.skillsArray.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">Current skills:</p>
                  <div className="flex flex-wrap gap-2">
                    {profile.skillsArray.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="seniority" className="block text-sm font-medium mb-1">
                Seniority Level
              </label>
              <select
                id="seniority"
                name="seniority"
                defaultValue={profile?.seniority || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>

          {/* Contact Links */}
          <div className="space-y-4">
            <h2 className="text-xl font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
              Contact Links
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="contactTwitter" className="block text-sm font-medium mb-1">
                  Twitter
                </label>
                <input
                  type="text"
                  id="contactTwitter"
                  name="contactTwitter"
                  defaultValue={profile?.contactLinks?.twitter || ''}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="@username"
                />
              </div>

              <div>
                <label htmlFor="contactGithub" className="block text-sm font-medium mb-1">
                  GitHub
                </label>
                <input
                  type="text"
                  id="contactGithub"
                  name="contactGithub"
                  defaultValue={profile?.contactLinks?.github || ''}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="username"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            {arkivBuilderMode ? (
              <ArkivQueryTooltip
                query={[
                  `POST /api/profile { action: 'createProfile', ... }`,
                  `Creates: type='user_profile' entity (new version)`,
                  `Attributes: wallet, displayName, username, timezone, skills, ...`,
                  `Payload: Full profile data (bio, contactLinks, etc.)`,
                  `Note: Profile updates create new entities (immutable)`,
                  `TTL: 1 year (31536000 seconds)`
                ]}
                label="Profile Entity Creation"
              >
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting 
                    ? (profile ? 'Updating Profile...' : 'Creating Profile...')
                    : (profile ? 'Update Profile' : 'Create Profile')
                  }
                </button>
              </ArkivQueryTooltip>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting 
                  ? (profile ? 'Updating Profile...' : 'Creating Profile...')
                  : (profile ? 'Update Profile' : 'Create Profile')
                }
              </button>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
