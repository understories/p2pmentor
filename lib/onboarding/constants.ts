/**
 * Onboarding Constants
 * 
 * Step definitions, copy, and configuration.
 */

import { OnboardingStep, OnboardingLevel, OnboardingProgress } from './types';

export const ONBOARDING_STEPS: OnboardingStep[] = [
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

export const STEP_LABELS: Record<OnboardingStep, string> = {
  welcome: 'Welcome to the Garden',
  identity: 'Create Your Identity',
  skills: 'Plant Your First Skill',
  paths: 'Choose Your Path',
  ask: 'Create an Ask',
  offer: 'Create an Offer',
  network: 'Explore the Network',
  community: 'Join a Community',
  complete: 'Welcome to Your Garden',
};

export const STEP_COPY: Record<OnboardingStep, { title: string; description: string }> = {
  welcome: {
    title: 'Every mentor begins as a seed',
    description: "Let's grow your presence in the Hidden Garden.",
  },
  identity: {
    title: 'What should we call you?',
    description: 'Your identity is the seed from which everything grows.',
  },
  skills: {
    title: 'What are you growing skill in?',
    description: 'Every skill grows in its own time. What stage are you at?',
  },
  paths: {
    title: 'There are four paths through the Garden',
    description: 'Follow any one to begin. You can explore others later.',
  },
  ask: {
    title: 'What are you seeking?',
    description: 'Your ask will rise into the constellation, visible to mentors who can help.',
  },
  offer: {
    title: 'What can you share?',
    description: 'Offering grows roots that connect you to others.',
  },
  network: {
    title: 'Explore the Network',
    description: 'These are people whose skills resonate with your own.',
  },
  community: {
    title: 'Join a Learning Community',
    description: 'Joining a community plants a shared tree in your garden.',
  },
  complete: {
    title: 'Your Garden is alive',
    description: 'Explore, grow, connect.',
  },
};

/**
 * Minimum level required to unlock each navigation item
 */
export const NAV_UNLOCK_LEVELS: Record<string, OnboardingLevel> = {
  '/me': 0, // Always available
  '/garden': 1, // After identity + skills
  '/asks': 2, // After first ask or offer
  '/offers': 2, // After first ask or offer
  '/network': 3, // After network exploration
  '/me/sessions': 4, // After community join
  '/communities': 4, // After community join
};

/**
 * Level calculation rules
 */
export const LEVEL_REQUIREMENTS: Record<OnboardingLevel, {
  description: string;
  check: (progress: OnboardingProgress) => boolean;
}> = {
  0: {
    description: 'No profile created',
    check: (progress) => progress.level === 0,
  },
  1: {
    description: 'Identity + ≥1 skill created',
    check: (progress) => progress.level >= 1,
  },
  2: {
    description: '≥1 Ask OR Offer created',
    check: (progress) => progress.level >= 2,
  },
  3: {
    description: 'Network explored once',
    check: (progress) => progress.level >= 3,
  },
  4: {
    description: 'Joined ≥1 community',
    check: (progress) => progress.level >= 4,
  },
};
