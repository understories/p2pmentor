/**
 * Explore Skills Page
 * 
 * Lists all skill entities with profile counts (how many profiles have each skill).
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Skill } from '@/lib/arkiv/skill';
import { normalizeSkillSlug } from '@/lib/arkiv/skill';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';

type SkillWithCount = Skill & {
  profileCount: number;
};

export default function ExploreSkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [followedSkills, setFollowedSkills] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      setWalletAddress(address);
      if (address) {
        loadFollowedSkills(address);
      }
    }
    loadSkills();
  }, []);

  const loadFollowedSkills = async (wallet: string) => {
    try {
      const follows = await listLearningFollows({ profile_wallet: wallet, active: true });
      setFollowedSkills(follows.map(f => f.skill_id));
    } catch (error) {
      console.error('Error loading followed skills:', error);
    }
  };

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/skills/explore');
      const data = await res.json();
      
      if (data.ok) {
        setSkills(data.skills || []);
      } else {
        setError(data.error || 'Failed to load skills');
      }
    } catch (err: any) {
      console.error('Error loading skills:', err);
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  };

  // Filter skills by search term
  const filteredSkills = skills.filter(skill =>
    skill.name_canonical.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
    skill.slug?.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <ThemeToggle />
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <LoadingSpinner text="Loading skills..." className="py-12" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <ThemeToggle />
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <BackButton href="/me" />
          </div>
          <EmptyState
            title="Error loading skills"
            description={error}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <ThemeToggle />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <BackButton href="/me" />
        </div>

        <PageHeader
          title="Explore Skills"
          description="Discover all skills in the network and see how many people are learning or teaching each one"
        />

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
          />
        </div>

        {/* Skills List */}
        {filteredSkills.length === 0 ? (
          <EmptyState
            title="No skills found"
            description={searchTerm ? `No skills match "${searchTerm}". Try a different search term.` : 'No skills found in the network yet.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              // Use proper slug normalization - ensure skill has a slug
              // If skill doesn't have a slug, generate one from name_canonical using proper normalization
              const skillSlug = skill.slug || normalizeSkillSlug(skill.name_canonical);
              const topicLink = skillSlug ? `/topic/${skillSlug}` : null;
              
              const isJoined = walletAddress && followedSkills.includes(skill.key);
              const isSubmitting = submitting === skill.key;

              const content = (
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-500 dark:hover:border-emerald-400 hover:shadow-md transition-all duration-200">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {skill.name_canonical}
                    </h3>
                  </div>
                  {skill.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                      {skill.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">{skill.profileCount}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {skill.profileCount === 1 ? 'profile' : 'profiles'}
                      </span>
                    </div>
                    {walletAddress && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!walletAddress || !skill.key || isSubmitting) return;
                          
                          const action = isJoined ? 'unfollow' : 'follow';
                          setSubmitting(skill.key);
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
                              await loadFollowedSkills(walletAddress);
                            } else {
                              alert(data.error || `Failed to ${isJoined ? 'leave' : 'join'} community`);
                            }
                          } catch (error: any) {
                            console.error(`Error ${isJoined ? 'leaving' : 'joining'} community:`, error);
                            alert(`Failed to ${isJoined ? 'leave' : 'join'} community`);
                          } finally {
                            setSubmitting(null);
                          }
                        }}
                        disabled={isSubmitting}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          isJoined
                            ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            : 'border-emerald-500 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSubmitting 
                          ? (isJoined ? 'Leaving...' : 'Joining...') 
                          : (isJoined ? 'Leave' : 'Join')
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
              
              // If skill has a slug, link to topic page; otherwise show as non-clickable
              if (topicLink) {
                return (
                  <Link 
                    key={skill.key} 
                    href={topicLink}
                    className="block"
                    onClick={(e) => {
                      // Prevent navigation if clicking on the button
                      if ((e.target as HTMLElement).closest('button')) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {content}
                  </Link>
                );
              } else {
                return (
                  <div key={skill.key}>
                    {content}
                    <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                      ⚠️ Topic page unavailable (missing slug)
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}

        {/* Stats */}
        {skills.length > 0 && (
          <div className="mt-8 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{skills.length}</span> total skills in the network
              {searchTerm && (
                <>
                  {' • '}
                  <span className="font-medium">{filteredSkills.length}</span> matching "{searchTerm}"
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

