/**
 * Onboarding Types
 * 
 * Type definitions for the onboarding flow.
 */

export type OnboardingStep = 
  | 'welcome'
  | 'identity'
  | 'skills'
  | 'paths'
  | 'ask'
  | 'offer'
  | 'network'
  | 'community'
  | 'complete';

export type OnboardingLevel = 0 | 1 | 2 | 3 | 4;

export interface OnboardingState {
  currentStep: OnboardingStep;
  completedSteps: Set<OnboardingStep>;
  level: OnboardingLevel;
  isComplete: boolean;
  // Form data collected during onboarding
  formData: {
    displayName?: string;
    exploringStatement?: string;
    skills?: Array<{
      skillId: string;
      skillName: string;
      expertise: number; // 0-5
    }>;
    askCreated?: boolean;
    offerCreated?: boolean;
    networkExplored?: boolean;
    communityJoined?: boolean;
  };
}

export interface OnboardingProgress {
  level: OnboardingLevel;
  isComplete: boolean;
  completedSteps: string[];
  missingSteps: string[];
}
