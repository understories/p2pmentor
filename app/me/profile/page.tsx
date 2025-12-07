/**
 * Profile management page
 * 
 * Create and edit user profile using Arkiv entities.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createUserProfileClient, getProfileByWallet, type UserProfile } from '@/lib/arkiv/profile';
import { connectWallet } from '@/lib/auth/metamask';
import { BackButton } from '@/components/BackButton';

export default function ProfilePage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Get wallet address from localStorage
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadProfile(address);
    }
  }, [router]);

  const loadProfile = async (wallet: string) => {
    try {
      setLoading(true);
      const profileData = await getProfileByWallet(wallet);
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
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
    const timezone = formData.get('timezone') as string || 'UTC';
    const availabilityWindow = formData.get('availabilityWindow') as string;
    
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
    
    // Skills
    const skills = formData.get('skills') as string;
    const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : undefined;
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
          skills: skills || '',
          skillsArray,
          timezone,
          languages,
          contactLinks: Object.keys(contactLinks).length > 0 ? contactLinks : undefined,
          seniority: seniority || undefined,
          availabilityWindow: availabilityWindow || undefined,
        }),
      });

      const result = await res.json();
      if (!result.ok) {
        throw new Error(result.error || 'Failed to create profile');
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
      setError(err.message || 'Failed to create profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>
        <h1 className="text-3xl font-semibold mb-6">Profile</h1>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400">
            {success}
          </div>
        )}

        {profile && (
          <div className="mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Existing profile found</p>
            <p className="font-medium">{profile.displayName}</p>
            {profile.bioShort && <p className="text-sm mt-2">{profile.bioShort}</p>}
          </div>
        )}

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
              <label htmlFor="timezone" className="block text-sm font-medium mb-1">
                Timezone
              </label>
              <input
                type="text"
                id="timezone"
                name="timezone"
                defaultValue={profile?.timezone || 'UTC'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="UTC"
              />
            </div>

            <div>
              <label htmlFor="availabilityWindow" className="block text-sm font-medium mb-1">
                Availability Window
              </label>
              <input
                type="text"
                id="availabilityWindow"
                name="availabilityWindow"
                defaultValue={profile?.availabilityWindow || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., Mon-Fri 9am-5pm EST, Weekends flexible"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Describe when you're generally available for mentorship
              </p>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-4">
            <h2 className="text-xl font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
              Skills
            </h2>
            
            <div>
              <label htmlFor="skills" className="block text-sm font-medium mb-1">
                Skills (comma-separated)
              </label>
              <input
                type="text"
                id="skills"
                name="skills"
                defaultValue={profile?.skillsArray?.join(', ') || profile?.skills || ''}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="JavaScript, React, TypeScript"
              />
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
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating Profile...' : profile ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>⚠️ Beta Warning:</strong> Blockchain data is immutable. All data inputted is viewable forever on the{' '}
              <a href="https://explorer.mendoza.hoodi.arkiv.network" target="_blank" rel="noopener noreferrer" className="underline">
                Arkiv explorer
              </a>.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
