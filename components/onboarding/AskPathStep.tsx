/**
 * Ask Path Step Component
 *
 * Simplified form to create an ask during onboarding
 */

'use client';

import { useState, useEffect } from 'react';
import { listSkills } from '@/lib/arkiv/skill';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { Skill } from '@/lib/arkiv/skill';

interface AskPathStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function AskPathStep({ wallet, onComplete, onError }: AskPathStepProps) {
  const [message, setMessage] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [ttlHours, setTtlHours] = useState('168'); // Default 1 week
  const [customTtlHours, setCustomTtlHours] = useState('');
  const arkivBuilderMode = useArkivBuilderMode();

  // Load user's skills for selection
  useEffect(() => {
    async function loadData() {
      try {
        const [profile, allSkills] = await Promise.all([
          getProfileByWallet(wallet),
          listSkills({ status: 'active', limit: 100 }),
        ]);

        // Filter to user's skills if available
        if (profile?.skillsArray && profile.skillsArray.length > 0) {
          const userSkills = allSkills.filter((skill) =>
            profile.skillsArray!.some(
              (userSkill) => skill.name_canonical.toLowerCase() === userSkill.toLowerCase()
            )
          );
          setAvailableSkills(userSkills.length > 0 ? userSkills : allSkills.slice(0, 10));
        } else {
          setAvailableSkills(allSkills.slice(0, 10));
        }

        // Pre-select first skill if available
        if (availableSkills.length > 0 && !selectedSkill) {
          setSelectedSkill(availableSkills[0].key);
        }
      } catch (err) {
        console.error('Failed to load skills:', err);
        setAvailableSkills([]);
      } finally {
        setIsLoadingSkills(false);
      }
    }
    loadData();
  }, [wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate wallet is profile wallet (not signing wallet)
    if (!wallet || wallet.trim() === '') {
      onError(new Error('Profile wallet address is required. Please refresh the page.'));
      return;
    }
    const normalizedWallet = wallet.toLowerCase().trim();
    if (normalizedWallet.length < 10) {
      onError(new Error('Invalid profile wallet address. Please refresh the page.'));
      return;
    }

    if (!message.trim()) {
      onError(new Error('Ask message is required'));
      return;
    }

    if (!selectedSkill) {
      onError(new Error('Please select a skill'));
      return;
    }

    setIsSubmitting(true);

    try {
      const skill = availableSkills.find((s) => s.key === selectedSkill);

      if (!skill) {
        throw new Error('Selected skill not found');
      }

      // Convert hours to seconds for expiresIn
      const ttlValue = ttlHours === 'custom' ? customTtlHours : ttlHours;
      const ttlHoursNum = parseFloat(ttlValue);
      const expiresIn =
        isNaN(ttlHoursNum) || ttlHoursNum <= 0 ? 604800 : Math.floor(ttlHoursNum * 3600); // Default to 1 week if invalid

      // Use API route for ask creation
      // wallet is the profile wallet address (from localStorage 'wallet_address')
      // This is used as the 'wallet' attribute on the ask entity
      // The API route uses getPrivateKey() (global signing wallet) to sign the transaction
      const res = await fetch('/api/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createAsk',
          wallet: normalizedWallet, // Profile wallet address (used as 'wallet' attribute on entity)
          skill: skill.name_canonical, // Legacy: kept for backward compatibility
          skill_id: skill.key, // New: preferred for beta
          skill_label: skill.name_canonical, // Derived from Skill entity
          message: message.trim(),
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Track action completion
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('ask_created');

        // Note: EntityWriteInfo not displayed in onboarding flow (modal closes on success)
        // But entity info is logged in backend for explorer independence

        onComplete();
      } else {
        throw new Error(data.error || 'Failed to create ask');
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to create ask'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <div
          className="mb-4 text-6xl"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.6))',
          }}
        >
          🎓
        </div>
        <h2
          className="mb-4 text-4xl font-bold text-white drop-shadow-lg dark:text-white md:text-5xl"
          style={{
            textShadow: '0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3)',
          }}
        >
          What are you seeking?
        </h2>
        <p
          className="mb-8 text-lg text-gray-200 drop-shadow-md dark:text-gray-300"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Your ask will rise into the constellation, visible to mentors who can help.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <select
            id="skill"
            value={selectedSkill}
            onChange={(e) => setSelectedSkill(e.target.value)}
            required
            autoFocus
            className="w-full rounded-xl border-2 border-white/30 bg-white/90 px-6 py-4 text-lg text-gray-900 shadow-lg backdrop-blur-md transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
            disabled={isLoadingSkills || isSubmitting}
          >
            {isLoadingSkills ? (
              <option>Loading skills...</option>
            ) : (
              <>
                <option value="">Select a skill</option>
                {availableSkills.map((skill) => (
                  <option key={skill.key} value={skill.key}>
                    {skill.name_canonical}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What are you learning or seeking help with?"
            rows={4}
            required
            className="w-full resize-none rounded-xl border-2 border-white/30 bg-white/90 px-6 py-4 text-lg text-gray-900 shadow-lg backdrop-blur-md transition-all focus:border-purple-500 focus:ring-2 focus:ring-purple-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
            disabled={isSubmitting}
          />
        </div>

        {/* Expiration Date Display */}
        {(() => {
          const ttlValue = ttlHours === 'custom' ? customTtlHours : ttlHours;
          const ttlHoursNum = parseFloat(ttlValue) || 168;
          const expirationDate = new Date(Date.now() + ttlHoursNum * 3600 * 1000);
          const formattedDate = expirationDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
          return (
            <div className="pb-2 pt-2 text-sm text-gray-200 dark:text-gray-400">
              <span className="font-medium">Expires:</span> {formattedDate}
            </div>
          );
        })()}

        {/* Advanced Options Toggle */}
        <div className="border-t border-white/20 pt-2 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-2 text-sm text-gray-200 transition-colors hover:text-white dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg
              className={`h-4 w-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Advanced Options
          </button>
        </div>

        {/* Advanced Options (Collapsed by Default) */}
        {showAdvancedOptions && (
          <div className="space-y-4 border-t border-white/20 pt-4 dark:border-white/10">
            <div>
              <label
                htmlFor="ttlHours"
                className="mb-2 block text-sm font-medium text-white dark:text-white"
              >
                Expiration Duration (optional)
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `TTL (Time To Live)`,
                      `TLDR: Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.`,
                      ``,
                      `Current Selection: ${ttlHours === 'custom' ? `${customTtlHours || '...'} hours` : `${ttlHours || '24'} hours`}`,
                      `Conversion: hours → seconds (${ttlHours === 'custom' ? parseFloat(customTtlHours || '24') * 3600 : parseFloat(ttlHours || '24') * 3600} seconds)`,
                      ``,
                      `In Ask Entity:`,
                      `→ Attribute: ttlSeconds='${ttlHours === 'custom' ? Math.floor(parseFloat(customTtlHours || '24') * 3600) : Math.floor(parseFloat(ttlHours || '24') * 3600)}'`,
                      `→ Arkiv expiresIn: ${ttlHours === 'custom' ? Math.floor(parseFloat(customTtlHours || '24') * 3600) : Math.floor(parseFloat(ttlHours || '24') * 3600)} seconds`,
                      ``,
                      `Client-Side Filtering:`,
                      `→ Checks: createdAt + ttlSeconds < now`,
                      `→ Expired asks filtered out (unless includeExpired: true)`,
                      ``,
                      `Arkiv-Level Expiration:`,
                      `→ Hard deletion after expiresIn seconds`,
                      `→ Used for network cleanup`,
                    ]}
                    label="TTL Info"
                  >
                    <span className="ml-2 cursor-help text-xs text-gray-300 dark:text-gray-500">
                      ℹ️
                    </span>
                  </ArkivQueryTooltip>
                ) : (
                  <span
                    className="ml-2 text-xs text-gray-300 dark:text-gray-500"
                    title="TTL (Time To Live): Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network."
                  >
                    ℹ️
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <select
                  id="ttlHours"
                  value={ttlHours === 'custom' ? 'custom' : ttlHours}
                  onChange={(e) => setTtlHours(e.target.value)}
                  className="flex-1 rounded-lg border border-white/30 bg-white/90 px-4 py-2 text-gray-900 backdrop-blur-md focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
                  disabled={isSubmitting}
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
                {ttlHours === 'custom' && (
                  <input
                    type="number"
                    min="0.5"
                    max="8760"
                    step="0.5"
                    placeholder="Hours"
                    value={customTtlHours}
                    onChange={(e) => setCustomTtlHours(e.target.value)}
                    className="w-32 rounded-lg border border-white/30 bg-white/90 px-4 py-2 text-gray-900 backdrop-blur-md focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100"
                    disabled={isSubmitting}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {arkivBuilderMode ? (
          <ArkivQueryTooltip
            query={[
              `POST /api/asks { action: 'createAsk', ... }`,
              `Creates: type='ask' entity`,
              `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skill, skill_id, message, status='active'`,
              `Payload: Full ask data`,
              `TTL: expiresIn (default 24 hours = 86400 seconds)`,
            ]}
            label="Continue"
          >
            <button
              type="submit"
              disabled={!message.trim() || !selectedSkill || isSubmitting}
              className="w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🎓</span>
                  <span>Creating ask...</span>
                </span>
              ) : (
                'Continue →'
              )}
            </button>
          </ArkivQueryTooltip>
        ) : (
          <button
            type="submit"
            disabled={!message.trim() || !selectedSkill || isSubmitting}
            className="w-full rounded-xl bg-purple-600 px-6 py-4 text-lg font-medium text-white shadow-lg transition-all duration-200 hover:bg-purple-700 hover:shadow-xl disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">🎓</span>
                <span>Creating ask...</span>
              </span>
            ) : (
              'Continue →'
            )}
          </button>
        )}
      </form>
    </div>
  );
}
