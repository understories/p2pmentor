/**
 * Offer Path Step Component
 * 
 * Simplified form to create an offer during onboarding
 */

'use client';

import { useState, useEffect } from 'react';
import { listSkills } from '@/lib/arkiv/skill';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import type { Skill } from '@/lib/arkiv/skill';

interface OfferPathStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function OfferPathStep({ wallet, onComplete, onError }: OfferPathStepProps) {
  const [message, setMessage] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string>('');
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [ttlHours, setTtlHours] = useState('48'); // Default 48 hours
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
          const userSkills = allSkills.filter(skill =>
            profile.skillsArray!.some(userSkill =>
              skill.name_canonical.toLowerCase() === userSkill.toLowerCase()
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
      onError(new Error('Offer message is required'));
      return;
    }

    if (!selectedSkill) {
      onError(new Error('Please select a skill'));
      return;
    }

    setIsSubmitting(true);

    try {
      const skill = availableSkills.find(s => s.key === selectedSkill);

      if (!skill) {
        throw new Error('Selected skill not found');
      }

      // Convert hours to seconds for expiresIn
      const ttlValue = ttlHours === 'custom' ? customTtlHours : ttlHours;
      const ttlHoursNum = parseFloat(ttlValue);
      const expiresIn = isNaN(ttlHoursNum) || ttlHoursNum <= 0 ? 172800 : Math.floor(ttlHoursNum * 3600); // Default to 48 hours if invalid

      // Use API route for offer creation
      // wallet is the profile wallet address (from localStorage 'wallet_address')
      // This is used as the 'wallet' attribute on the offer entity
      // The API route uses getPrivateKey() (global signing wallet) to sign the transaction
      // Note: Offers require availabilityWindow, so we'll use a simple default
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOffer',
          wallet: normalizedWallet, // Profile wallet address (used as 'wallet' attribute on entity)
          skill: skill.name_canonical, // Legacy: kept for backward compatibility
          skill_id: skill.key, // New: preferred for beta
          skill_label: skill.name_canonical, // Derived from Skill entity
          message: message.trim(),
          availabilityWindow: 'Flexible - contact me to schedule', // Default for onboarding
          expiresIn: expiresIn,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Track action completion
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('offer_created');

        onComplete();
      } else {
        throw new Error(data.error || 'Failed to create offer');
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to create offer'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <div 
          className="text-6xl mb-4"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(6, 182, 212, 0.6))',
          }}
        >
          💎
        </div>
        <h2 
          className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(6, 182, 212, 0.5), 0 0 40px rgba(6, 182, 212, 0.3)',
          }}
        >
          What can you share?
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg mb-8 drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Offering grows roots that connect you to others.
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
            className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all shadow-lg"
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
            placeholder="What can you teach or share?"
            rows={4}
            required
            className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all resize-none shadow-lg"
            disabled={isSubmitting}
          />
        </div>

        {/* Advanced Options Toggle */}
        <div className="pt-2 border-t border-white/20 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="flex items-center gap-2 text-sm text-gray-200 dark:text-gray-400 hover:text-white dark:hover:text-gray-200 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showAdvancedOptions ? 'rotate-90' : ''}`}
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
          <div className="space-y-4 pt-4 border-t border-white/20 dark:border-white/10">
            <div>
              <label htmlFor="ttlHours" className="block text-sm font-medium mb-2 text-white dark:text-white">
                Expiration Duration (optional)
                {arkivBuilderMode ? (
                  <ArkivQueryTooltip
                    query={[
                      `TTL (Time To Live)`,
                      `TLDR: Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.`,
                      ``,
                      `Current Selection: ${ttlHours === 'custom' ? `${customTtlHours || '...'} hours` : `${ttlHours || '48'} hours`}`,
                      `Conversion: hours → seconds (${ttlHours === 'custom' ? (parseFloat(customTtlHours || '48') * 3600) : (parseFloat(ttlHours || '48') * 3600)} seconds)`,
                      ``,
                      `In Offer Entity:`,
                      `→ Attribute: ttlSeconds='${ttlHours === 'custom' ? Math.floor(parseFloat(customTtlHours || '48') * 3600) : Math.floor(parseFloat(ttlHours || '48') * 3600)}'`,
                      `→ Arkiv expiresIn: ${ttlHours === 'custom' ? Math.floor(parseFloat(customTtlHours || '48') * 3600) : Math.floor(parseFloat(ttlHours || '48') * 3600)} seconds`,
                      ``,
                      `Client-Side Filtering:`,
                      `→ Checks: createdAt + ttlSeconds < now`,
                      `→ Expired offers filtered out (unless includeExpired: true)`,
                      ``,
                      `Arkiv-Level Expiration:`,
                      `→ Hard deletion after expiresIn seconds`,
                      `→ Used for network cleanup`
                    ]}
                    label="TTL Info"
                  >
                    <span className="ml-2 text-xs text-gray-300 dark:text-gray-500 cursor-help">ℹ️</span>
                  </ArkivQueryTooltip>
                ) : (
                  <span className="ml-2 text-xs text-gray-300 dark:text-gray-500" title="TTL (Time To Live): Arkiv entities have an expiration date. After this time, the entity is automatically deleted from the network.">ℹ️</span>
                )}
              </label>
              <div className="flex gap-2">
                <select
                  id="ttlHours"
                  value={ttlHours === 'custom' ? 'custom' : ttlHours}
                  onChange={(e) => setTtlHours(e.target.value)}
                  className="flex-1 px-4 py-2 border border-white/30 dark:border-white/20 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  disabled={isSubmitting}
                >
                  <option value="1">1 hour</option>
                  <option value="2">2 hours</option>
                  <option value="6">6 hours</option>
                  <option value="12">12 hours</option>
                  <option value="24">24 hours (1 day)</option>
                  <option value="48">48 hours (2 days) - Recommended</option>
                  <option value="168">1 week</option>
                  <option value="custom">Custom (hours)</option>
                </select>
                {ttlHours === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    step="1"
                    placeholder="Hours"
                    value={customTtlHours}
                    onChange={(e) => setCustomTtlHours(e.target.value)}
                    className="w-32 px-4 py-2 border border-white/30 dark:border-white/20 rounded-lg bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
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
              `POST /api/offers { action: 'createOffer', ... }`,
              `Creates: type='offer' entity`,
              `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', skill, skill_id, message, availabilityWindow, status='active'`,
              `Payload: Full offer data`,
              `TTL: expiresIn (default 48 hours = 172800 seconds)`
            ]}
            label="Continue"
          >
            <button
              type="submit"
              disabled={!message.trim() || !selectedSkill || isSubmitting}
              className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">💎</span>
                  <span>Creating offer...</span>
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
            className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">💎</span>
                <span>Creating offer...</span>
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
