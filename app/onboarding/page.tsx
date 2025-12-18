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
import { IdentityStep } from '@/components/onboarding/IdentityStep';
import { SkillsStep } from '@/components/onboarding/SkillsStep';
import { PathSelectionStep } from '@/components/onboarding/PathSelectionStep';
import { AskPathStep } from '@/components/onboarding/AskPathStep';
import { OfferPathStep } from '@/components/onboarding/OfferPathStep';
import { CompleteStep } from '@/components/onboarding/CompleteStep';
import { GardenLayer } from '@/components/garden/GardenLayer';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import { profileToGardenSkills } from '@/lib/garden/types';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useSkillProfileCounts } from '@/lib/hooks/useSkillProfileCounts';
import { listLearningFollows } from '@/lib/arkiv/learningFollow';

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [wallet, setWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gardenSkills, setGardenSkills] = useState<any[]>([]);
  const [animateNewSkill, setAnimateNewSkill] = useState<string | undefined>(undefined);
  const [learningSkillIds, setLearningSkillIds] = useState<string[]>([]);
  const { level, isComplete, loading } = useOnboardingLevel(wallet);
  const arkivBuilderMode = useArkivBuilderMode();
  const skillProfileCounts = useSkillProfileCounts();

  // Get profile wallet from localStorage (set during auth)
  // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
  // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedWallet = localStorage.getItem('wallet_address');
      if (storedWallet) {
        setWallet(storedWallet); // Profile wallet address
        
        // Set bypass flag when on onboarding page
        // This allows navigation to protected pages during onboarding flow
        import('@/lib/onboarding/access').then(({ setOnboardingBypass }) => {
          setOnboardingBypass(true);
        });
      } else {
        // No wallet - redirect to auth
        router.push('/auth');
      }
    }
  }, [router]);

  // Handle returnTo redirect (from checkOnboardingRoute)
  // Only redirect if onboarding is truly complete (level >= 2)
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading && wallet && level >= 2) {
      const searchParams = new URLSearchParams(window.location.search);
      const returnTo = searchParams.get('returnTo');
      if (returnTo && returnTo.startsWith('/')) {
        // Clear returnTo param and redirect
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        router.push(returnTo);
        return;
      }
    }
  }, [loading, wallet, level, router]);

  // If onboarding is complete (level >= 2), redirect to me dashboard
  // Only redirect if truly complete (has ask/offer), not just profile + skills
  useEffect(() => {
    if (!loading && isComplete && wallet && level >= 2) {
      router.push('/me');
    }
  }, [loading, isComplete, wallet, level, router]);

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

      // Load learning follows for glow
      listLearningFollows({ profile_wallet: wallet, active: true })
        .then(follows => {
          setLearningSkillIds(follows.map(f => f.skill_id));
        })
        .catch(() => {
          // Learning follows not found - that's okay
        });
    }
  }, [wallet, loading, currentStep, arkivBuilderMode]);

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
        'complete',
      ];
      const currentIndex = stepOrder.indexOf(currentStep);
      if (currentIndex < stepOrder.length - 1) {
        setCurrentStep(stepOrder[currentIndex + 1]);
      }
    }
    setError(null);
  };

  const handlePathSelect = (path: 'ask' | 'offer') => {
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
        skillProfileCounts={skillProfileCounts}
        learningSkillIds={learningSkillIds}
        showIdentitySeed={showIdentitySeed}
        animateNew={animateNewSkill}
        onSeedClick={currentStep === 'welcome' ? () => handleStepComplete('identity') : undefined}
        showSeedTooltip={currentStep === 'welcome'}
      />
      

      {/* Content */}
      <div className={`relative ${currentStep === 'welcome' ? 'z-5' : 'z-10'} min-h-screen flex flex-col`}>
        {/* Header - hide on welcome step for game-like feel */}
        {currentStep !== 'welcome' && (
          <header className="flex justify-between items-center p-4">
            <div className="text-sm text-gray-400 dark:text-gray-500">
              Onboarding
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl">
            {/* Error Message - only show if not welcome step */}
            {error && currentStep !== 'welcome' && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Welcome Step - No card, floating text with fade-in */}
            {currentStep === 'welcome' && (
              <div className="text-center animate-fade-in">
                <h1 
                  className="text-4xl md:text-5xl font-bold text-white dark:text-white mb-4 drop-shadow-lg"
                  style={{
                    textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
                    animation: 'fadeIn 1.5s ease-in',
                  }}
                >
                  knowledge and networks light our way through the dark forest
                </h1>
              </div>
            )}

            {/* Other Steps - Floating text style, no card */}
            {currentStep !== 'welcome' && (
              <>
                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50/90 dark:bg-red-900/30 backdrop-blur-md rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm shadow-lg">
                    {error}
                  </div>
                )}

                {/* Step Content - Floating over background */}

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
                    // Reload garden skills after a delay to allow Arkiv indexing
                    setTimeout(() => {
                      getProfileByWallet(wallet)
                        .then(profile => {
                          if (profile) {
                            const skills = profileToGardenSkills(profile.skillsArray, profile.skillExpertise);
                            setGardenSkills(skills);
                          }
                        })
                        .catch(() => {});
                    }, 1000); // 1 second delay to allow Arkiv to index the profile update
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

              {currentStep === 'complete' && (
                <CompleteStep onEnterGarden={() => router.push('/me')} />
              )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
