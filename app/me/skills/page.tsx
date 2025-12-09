/**
 * Skills management page
 * 
 * Add, view, and edit skills using Arkiv profile entities.
 * Skills are stored in the profile's skillsArray field.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getProfileByWallet, createUserProfileClient } from '@/lib/arkiv/profile';
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { connectWallet } from '@/lib/auth/metamask';
import type { UserProfile } from '@/lib/arkiv/profile';
import 'viem/window'; // Adds window.ethereum type definition

export default function SkillsPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const router = useRouter();

  useEffect(() => {
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

  const handleAddSkill = async () => {
    if (!newSkill.trim() || !profile || !walletAddress) return;

    const skill = newSkill.trim();
    const currentSkills = profile.skillsArray || [];
    
    // Case-insensitive duplicate check
    const skillLower = skill.toLowerCase();
    if (currentSkills.some(s => s.toLowerCase() === skillLower)) {
      setError('Skill already exists (case-insensitive)');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const updatedSkills = [...currentSkills, skill];
      
      // Check if MetaMask is available
      const hasMetaMask = typeof window !== 'undefined' && window.ethereum;
      
      if (!hasMetaMask) {
        // Use server-side API route for example wallet
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
            timezone: profile.timezone,
            languages: profile.languages,
            contactLinks: profile.contactLinks,
            seniority: profile.seniority,
          }),
        });

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.error || 'Failed to update profile');
        }

        // Check if transaction is pending
        if (data.pending) {
          setSuccess('Skill update submitted! Transaction is being processed. Please refresh in a moment.');
          setNewSkill('');
          // Don't reload immediately - transaction is still confirming
          setTimeout(() => loadProfile(walletAddress), 2000);
        } else {
          setSuccess('Skill added!');
          setNewSkill('');
          await loadProfile(walletAddress);
        }
      } else {
        // Use MetaMask directly to create profile entity (Arkiv-native)
        if (!window.ethereum) {
          setError('MetaMask not available');
          return;
        }

        // Get connected account from MetaMask
        let account: `0x${string}`;
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (!accounts || accounts.length === 0) {
            // Try to connect
            account = await connectWallet();
          } else {
            account = accounts[0] as `0x${string}`;
          }
        } catch (connectError: any) {
          setError(connectError.message || 'Failed to connect MetaMask');
          return;
        }
        
        if (account.toLowerCase() !== walletAddress.toLowerCase()) {
          setError('Connected MetaMask account does not match your profile wallet');
          return;
        }

        // Create updated profile with new skills using MetaMask
        const { key, txHash } = await createUserProfileClient({
          wallet: walletAddress,
          displayName: profile.displayName,
          username: profile.username,
          profileImage: profile.profileImage,
          bio: profile.bio,
          bioShort: profile.bioShort,
          bioLong: profile.bioLong,
          skills: updatedSkills.join(', '),
          skillsArray: updatedSkills,
          timezone: profile.timezone,
          languages: profile.languages,
          contactLinks: profile.contactLinks,
          seniority: profile.seniority,
          account,
        });

        setSuccess('Skill added! Transaction submitted.');
        setNewSkill('');
        // Reload profile after a short delay to allow transaction to be indexed
        setTimeout(() => loadProfile(walletAddress), 2000);
      }
    } catch (err: any) {
      console.error('Error adding skill:', err);
      setError(err.message || 'Failed to add skill');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    if (!profile || !walletAddress) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const currentSkills = profile.skillsArray || [];
      const updatedSkills = currentSkills.filter(s => s !== skillToRemove);
      
      // Check if MetaMask is available
      const hasMetaMask = typeof window !== 'undefined' && window.ethereum;
      
      if (!hasMetaMask) {
        // Use server-side API route for example wallet
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
            timezone: profile.timezone,
            languages: profile.languages,
            contactLinks: profile.contactLinks,
            seniority: profile.seniority,
          }),
        });

        const data = await res.json();
        if (!data.ok) {
          throw new Error(data.error || 'Failed to update profile');
        }

        // Check if transaction is pending
        if (data.pending) {
          setSuccess('Skill removal submitted! Transaction is being processed. Please refresh in a moment.');
          // Don't reload immediately - transaction is still confirming
          setTimeout(() => loadProfile(walletAddress), 2000);
        } else {
          setSuccess('Skill removed!');
          await loadProfile(walletAddress);
        }
      } else {
        // Use MetaMask directly to create profile entity (Arkiv-native)
        if (!window.ethereum) {
          setError('MetaMask not available');
          return;
        }

        // Get connected account from MetaMask
        let account: `0x${string}`;
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
          if (!accounts || accounts.length === 0) {
            // Try to connect
            account = await connectWallet();
          } else {
            account = accounts[0] as `0x${string}`;
          }
        } catch (connectError: any) {
          setError(connectError.message || 'Failed to connect MetaMask');
          return;
        }
        
        if (account.toLowerCase() !== walletAddress.toLowerCase()) {
          setError('Connected MetaMask account does not match your profile wallet');
          return;
        }

        // Create updated profile with removed skill using MetaMask
        const { key, txHash } = await createUserProfileClient({
          wallet: walletAddress,
          displayName: profile.displayName,
          username: profile.username,
          profileImage: profile.profileImage,
          bio: profile.bio,
          bioShort: profile.bioShort,
          bioLong: profile.bioLong,
          skills: updatedSkills.join(', '),
          skillsArray: updatedSkills,
          timezone: profile.timezone,
          languages: profile.languages,
          contactLinks: profile.contactLinks,
          seniority: profile.seniority,
          account,
        });

        setSuccess('Skill removed! Transaction submitted.');
        // Reload profile after a short delay to allow transaction to be indexed
        setTimeout(() => loadProfile(walletAddress), 2000);
      }
    } catch (err: any) {
      console.error('Error removing skill:', err);
      setError(err.message || 'Failed to remove skill');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-2xl mx-auto">
          <p>Loading skills...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
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

  const skills = profile.skillsArray || [];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
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
          </div>
        )}

        {/* Add Skill Form */}
        <div className="mb-6 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-medium mb-4">Add Skill</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSkill();
                }
              }}
              placeholder="Enter skill name"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={handleAddSkill}
              disabled={submitting || !newSkill.trim()}
              className="px-6 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>

        {/* Skills List */}
        <div className="mb-6">
          <h2 className="text-lg font-medium mb-4">
            Your Skills ({skills.length})
          </h2>
          
          {skills.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
              No skills added yet. Add your first skill above!
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {skills.map((skill, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                >
                  <span className="font-medium">{skill}</span>
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    disabled={submitting}
                    className="px-3 py-1 rounded text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seniority Level */}
        {profile.seniority && (
          <div className="mb-6 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <h2 className="text-lg font-medium mb-2">Seniority Level</h2>
            <p className="text-gray-600 dark:text-gray-400 capitalize">
              {profile.seniority}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Update seniority level from the{' '}
              <a href="/me/profile" className="text-green-600 dark:text-green-400 underline">
                Profile page
              </a>
            </p>
          </div>
        )}

        <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Skills are stored in your profile on Arkiv. Each update creates a new profile entity.
          </p>
        </div>
      </div>
    </div>
  );
}
