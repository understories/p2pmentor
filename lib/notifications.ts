/**
 * Notifications utilities
 *
 * Client-side notification detection and management.
 *
 * Since notifications are UI-only, we poll for new data and compare
 * against previously seen data to detect new items.
 */

import type { Session } from './arkiv/sessions';
import type { Ask } from './arkiv/asks';
import type { Offer } from './arkiv/offers';
import type { UserProfile } from './arkiv/profile';
import { canGiveFeedbackForSessionSync, hasSessionEnded } from './feedback/canGiveFeedback';

export type NotificationType =
  | 'meeting_request'
  | 'profile_match'
  | 'ask_offer_match'
  | 'new_offer'
  | 'admin_response'
  | 'issue_resolved'
  | 'app_feedback_submitted'
  | 'new_garden_note'
  | 'new_skill_created'
  | 'community_meeting_scheduled'
  | 'session_completed_feedback_needed';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: Record<string, any>;
}

/**
 * Detect new meeting requests for a user
 */
export function detectMeetingRequests(
  sessions: Session[],
  userWallet: string,
  previousSessionKeys: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  sessions.forEach((session) => {
    // Only check pending sessions where user is the recipient
    if (session.status !== 'pending') return;

    const isMentor = session.mentorWallet.toLowerCase() === userWallet.toLowerCase();
    const isLearner = session.learnerWallet.toLowerCase() === userWallet.toLowerCase();

    if (!isMentor && !isLearner) return;

    // Check if this is a new session (not seen before)
    if (!previousSessionKeys.has(session.key)) {
      const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
      const hasConfirmed = isMentor ? session.mentorConfirmed : session.learnerConfirmed;

      // Only notify if user hasn't confirmed yet
      if (!hasConfirmed) {
        notifications.push({
          id: `meeting_request_${session.key}`,
          type: 'meeting_request',
          title: 'New Meeting Request',
          message: `You have a new meeting request for ${session.skill}`,
          timestamp: session.createdAt,
          read: false,
          link: `/me/sessions`,
          metadata: {
            sessionKey: session.key,
            skill: session.skill,
            otherWallet,
          },
        });
      }
    }
  });

  return notifications;
}

/**
 * Detect profile matches (users with matching skills)
 */
export function detectProfileMatches(
  userProfile: UserProfile | null,
  allProfiles: UserProfile[],
  userWallet: string,
  previousMatchedWallets: Set<string>
): Notification[] {
  if (!userProfile || !userProfile.skills) return [];

  const notifications: Notification[] = [];
  const userSkills = userProfile.skillsArray || userProfile.skills.split(',').map(s => s.trim().toLowerCase());

  allProfiles.forEach((profile) => {
    if (profile.wallet.toLowerCase() === userWallet.toLowerCase()) return;
    if (previousMatchedWallets.has(profile.wallet.toLowerCase())) return;

    const profileSkills = profile.skillsArray || profile.skills?.split(',').map(s => s.trim().toLowerCase()) || [];

    // Check for skill overlap
    const hasMatch = userSkills.some(skill =>
      profileSkills.some(ps =>
        ps === skill || ps.includes(skill) || skill.includes(ps)
      )
    );

    if (hasMatch) {
      notifications.push({
        id: `profile_match_${profile.wallet}`,
        type: 'profile_match',
        title: 'Profile Match',
        message: `${profile.displayName || 'Someone'} has matching skills`,
        timestamp: profile.createdAt || new Date().toISOString(),
        read: false,
        link: `/profiles/${profile.wallet}`,
        metadata: {
          wallet: profile.wallet,
          displayName: profile.displayName,
        },
      });
    }
  });

  return notifications;
}

/**
 * Detect ask & offer matches
 */
export function detectAskOfferMatches(
  userAsks: Ask[],
  allOffers: Offer[],
  previousMatches: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  userAsks.forEach((ask) => {
    allOffers.forEach((offer) => {
      const matchKey = `${ask.key}_${offer.key}`;
      if (previousMatches.has(matchKey)) return;

      // Check if skills match
      const askSkill = ask.skill.toLowerCase();
      const offerSkill = offer.skill.toLowerCase();

      if (askSkill === offerSkill || askSkill.includes(offerSkill) || offerSkill.includes(askSkill)) {
        notifications.push({
          id: `ask_offer_match_${matchKey}`,
          type: 'ask_offer_match',
          title: 'Ask & Offer Match',
          message: `Your "${ask.skill}" ask matches an offer`,
          timestamp: offer.createdAt,
          read: false,
          link: `/network?typeFilter=matches`,
          metadata: {
            askKey: ask.key,
            offerKey: offer.key,
            skill: ask.skill,
          },
        });
      }
    });
  });

  return notifications;
}

/**
 * Detect new offers (offers created since last check)
 */
export function detectNewOffers(
  allOffers: Offer[],
  userWallet: string,
  previousOfferKeys: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  allOffers.forEach((offer) => {
    // Don't notify about user's own offers
    if (offer.wallet.toLowerCase() === userWallet.toLowerCase()) return;

    // Check if this is a new offer
    if (!previousOfferKeys.has(offer.key)) {
      notifications.push({
        id: `new_offer_${offer.key}`,
        type: 'new_offer',
        title: 'New Offer',
        message: `New "${offer.skill}" offer available`,
        timestamp: offer.createdAt,
        read: false,
        link: `/offers`,
        metadata: {
          offerKey: offer.key,
          skill: offer.skill,
          wallet: offer.wallet,
        },
      });
    }
  });

  return notifications;
}

/**
 * Detect admin responses to user feedback
 */
export function detectAdminResponses(
  adminResponses: Array<{ key: string; feedbackKey: string; message: string; createdAt: string }>,
  userWallet: string,
  previousResponseKeys: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  adminResponses.forEach((response) => {
    // Only notify if this is a new response (not seen before)
    if (!previousResponseKeys.has(response.key)) {
      notifications.push({
        id: `admin_response_${response.key}`,
        type: 'admin_response',
        title: 'Response to Your Feedback',
        message: response.message.length > 100
          ? `${response.message.substring(0, 100)}...`
          : response.message,
        timestamp: response.createdAt,
        read: false,
        link: `/notifications`,
        metadata: {
          responseKey: response.key,
          feedbackKey: response.feedbackKey,
        },
      });
    }
  });

  return notifications;
}

/**
 * Detect issue resolutions (arkiv-native: from resolution entities)
 */
export function detectIssueResolutions(
  resolvedFeedbacks: Array<{ key: string; message: string; resolvedAt: string; page: string }>,
  userWallet: string,
  previousResolvedKeys: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  resolvedFeedbacks.forEach((feedback) => {
    // Only notify if this is a new resolution (not seen before)
    if (!previousResolvedKeys.has(feedback.key)) {
      notifications.push({
        id: `issue_resolved_${feedback.key}`,
        type: 'issue_resolved',
        title: 'Issue Resolved',
        message: `Your issue reported on ${feedback.page} has been resolved`,
        timestamp: feedback.resolvedAt,
        read: false,
        link: `/me/issues`,
        metadata: {
          feedbackKey: feedback.key,
          page: feedback.page,
        },
      });
    }
  });

  return notifications;
}

/**
 * Detect completed sessions that need feedback
 *
 * Notifies users when a session has ended and they haven't given feedback yet.
 * Uses the reusable canGiveFeedbackForSessionSync utility.
 */
export function detectCompletedSessionsNeedingFeedback(
  sessions: Session[],
  userWallet: string,
  sessionFeedbacks: Record<string, any[]>, // sessionKey -> Feedback[]
  previousSessionKeys: Set<string>
): Notification[] {
  const notifications: Notification[] = [];

  sessions.forEach((session) => {
    // Only check sessions that have ended
    if (!hasSessionEnded(session)) return;

    const isMentor = session.mentorWallet.toLowerCase() === userWallet.toLowerCase();
    const isLearner = session.learnerWallet.toLowerCase() === userWallet.toLowerCase();

    if (!isMentor && !isLearner) return;

    // Check if user can give feedback (using reusable utility)
    const existingFeedbacks = sessionFeedbacks[session.key] || [];
    const canGiveFeedback = canGiveFeedbackForSessionSync(
      session,
      userWallet,
      existingFeedbacks
    );

    if (canGiveFeedback) {
      // Only notify if this is a new completion (not seen before)
      // Use a key that includes the feedback status to detect when feedback is given
      const notificationKey = `session_feedback_${session.key}`;
      if (!previousSessionKeys.has(notificationKey)) {
        const otherWallet = isMentor ? session.learnerWallet : session.mentorWallet;
        const role = isMentor ? 'mentor' : 'learner';

        notifications.push({
          id: notificationKey,
          type: 'session_completed_feedback_needed',
          title: 'Session Completed - Leave Feedback',
          message: `Your ${session.skill} session has ended. Share your experience!`,
          timestamp: session.sessionDate, // Use session date as timestamp
          read: false,
          link: `/me/sessions`,
          metadata: {
            sessionKey: session.key,
            skill: session.skill,
            otherWallet,
            role,
            mentorWallet: session.mentorWallet,
            learnerWallet: session.learnerWallet,
          },
        });
      }
    }
  });

  return notifications;
}

/**
 * Get unread notification count
 */
export function getUnreadCount(notifications: Notification[]): number {
  return notifications.filter(n => !n.read).length;
}

