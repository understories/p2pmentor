/**
 * Onboarding Page
 * 
 * Magical onboarding experience where identity, skills, asks, offers, and communities grow.
 * 
 * Reference: refs/doc/onboarding_levelup.md
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOnboardingLevel } from '@/lib/onboarding/useOnboardingLevel';
import { OnboardingStep } from '@/lib/onboarding/types';
import { BackgroundImage } from '@/components/BackgroundImage';
import { ThemeToggle } from '@/components/ThemeToggle';
import { IdentityStep } from '@/components/onboarding/IdentityStep';
import { SkillsStep } from '@/components/onboarding/SkillsStep';
import { PathSelectionStep } from '@/components/onboarding/PathSelectionStep';
import { AskPathStep } from '@/components/onboarding/AskPathStep';
import { OfferPathStep } from '@/components/onboarding/OfferPathStep';
import { NetworkPathStep } from '@/components/onboarding/NetworkPathStep';
import { CommunityPathStep } from '@/components/onboarding/CommunityPathStep';
import { CompleteStep } from '@/components/onboarding/CompleteStep';
import { GardenLayer } from '@/components/garden/GardenLayer';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { profileToGardenSkills } from '@/lib/garden/types';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [animateNewSkill, setAnimateNewSkill] = useState<string | undefined>(undefined);
  const { level, isComplete, loading } = useOnboardingLevel(wallet);

  // Get profile wallet from localStorage (set during auth)
  // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
  // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      if (storedWallet) {
        setWallet(storedWallet); // Profile wallet address
      } else {
        // No wallet - redirect to auth
        router.push('/auth');
      }
    }
  }, [router]);

  // If onboarding is complete, redirect to garden
  useEffect(() => {
    if (!loading && isComplete && wallet) {
      router.push('/garden/public-board');
    }
  }, [loading, isComplete, wallet, router]);

  // Load garden skills from profile
  useEffect(() => {
    if (wallet && !loading) {
      getProfileByWallet(wallet)
        .then(profile => {
          if (profile) {
            const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
            setGardenSkills(skills);
          }
        })
        .catch(() => {
          // Profile not found yet - that's okay during onboarding
        });
    }
  }, [wallet, loading, currentStep]);

  // If already has profile, skip welcome and identity
  useEffect(() => {
    if (!loading && wallet && level >= 1 && currentStep === 'welcome') {
      // Has profile, start at skills or paths
      if (level >= 2) {
        setCurrentStep('paths');
      } else {
        setCurrentStep('skills');
      }
    }
  }, [loading, level, wallet, currentStep]);

  if (loading || !wallet) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-4">🌱</div>
          <p className="text-gray-600 dark:text-gray-400">Loading your garden...</p>
        </div>
      </div>
    );
  }

  const handleStepComplete = (nextStep?: OnboardingStep) => {
    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      // Auto-advance based on current step
      const stepOrder: OnboardingStep[] = [
        'welcome',
        'identity',
        'skills',
        'paths',
        'ask',
        'offer',
        'network',
        'community',
        'complete',
      ];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
    setError(null);
  };

  const handlePathSelect = (path: 'ask' | 'offer' | 'network' | 'community') => {
    setCurrentStep(path);
    setError(null);
  };

  const handleError = (err: Error) => {
    setError(err.message);
    console.error('Onboarding error:', err);
  };

  // Determine if we should show identity seed (welcome/identity steps)
  const showIdentitySeed = currentStep === 'welcome' || currentStep === 'identity';

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Forest Background */}
      <BackgroundImage />
      
      {/* Garden Layer - shows plants behind the UI */}
      <GardenLayer 
        skills={gardenSkills} 
        showIdentitySeed={showIdentitySeed}
        animateNew={animateNewSkill}
      />
      
      {/* Overlay for onboarding (darken background during onboarding) */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 transition-opacity duration-1000 z-0"
        style={{
          opacity: 0.3 + (level * 0.1), // Gradually brighten as level increases
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center p-4">
          <div className="text-sm text-gray-400 dark:text-gray-500">
            Onboarding
          </div>
          <ThemeToggle />
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl">
            <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-lg p-4 md:p-8 shadow-xl border border-gray-200 dark:border-gray-700">
              {/* Error Message */}
              {error && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Step Content */}
              {currentStep === 'welcome' && (
                <div className="text-center space-y-6">
                  <div className="text-6xl mb-4 hg-anim-plant-idle">🌱</div>
                  <h1 className="text-3xl font-bold mb-2">Every mentor begins as a seed</h1>
                  <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Let's grow your presence in the Hidden Garden.
                  </p>
                  <button
                    onClick={() => {
                      // Trigger seed "planted" animation
                      const button = document.querySelector('[data-welcome-button]');
                      if (button) {
                        button.classList.add('hg-anim-plant-pulse', 'hg-anim-ring-pulse');
                      }
                      setTimeout(() => handleStepComplete('identity'), 400);
                    }}
                    data-welcome-button
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium relative"
                  >
                    Begin Growing →
                  </button>
                </div>
              )}

              {currentStep === 'identity' && wallet && (
                <IdentityStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('skills')}
                  onError={handleError}
                />
              )}

              {currentStep === 'skills' && wallet && (
                <SkillsStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('paths')}
                  onError={handleError}
                  onSkillAdded={(skillId) => {
                    // Trigger garden animation for new skill
                    setAnimateNewSkill(skillId);
                    // Reload garden skills
                    getProfileByWallet(wallet)
                      .then(profile => {
                        if (profile) {
                          const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
                          setGardenSkills(skills);
                        }
                      })
                      .catch(() => {});
                    // Clear animation after animation completes
                    setTimeout(() => setAnimateNewSkill(undefined), 800);
                  }}
                />
              )}

              {currentStep === 'paths' && (
                <PathSelectionStep onSelectPath={handlePathSelect} />
              )}

              {currentStep === 'ask' && wallet && (
                <AskPathStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('complete')}
                  onError={handleError}
                />
              )}

              {currentStep === 'offer' && wallet && (
                <OfferPathStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('complete')}
                  onError={handleError}
                />
              )}

              {currentStep === 'network' && wallet && (
                <NetworkPathStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('complete')}
                  onError={handleError}
                />
              )}

              {currentStep === 'community' && wallet && (
                <CommunityPathStep
                  wallet={wallet}
                  onComplete={() => handleStepComplete('complete')}
                  onError={handleError}
                />
              )}

              {currentStep === 'complete' && (
                <CompleteStep onEnterGarden={() => router.push('/garden/public-board')} />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
