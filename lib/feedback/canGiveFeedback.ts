/**
 * Reusable utility for checking if a user can give feedback for a session
 * 
 * Follows arkiv-native patterns and engineering guidelines.
 * 
 * This logic is reused across:
 * - Sessions page (completed sessions list)
 * - Notifications page (session completion notifications)
 * - Profile pages (session history)
 */

import type { Session } from '@/lib/arkiv/sessions';
import type { Feedback } from '@/lib/arkiv/feedback';
import { hasUserGivenFeedbackForSession } from '@/lib/arkiv/feedback';

/**
 * Check if a session has ended (can receive feedback)
 * 
 * A session has ended if:
 * - Status is 'completed', OR
 * - Status is 'scheduled' AND the session time has passed (including duration buffer)
 * 
 * @param session - Session to check
 * @returns true if session has ended
 */
export function hasSessionEnded(session: Session): boolean {
  if (session.status === 'completed') {
    return true;
  }
  
  if (session.status === 'scheduled') {
    const sessionTime = new Date(session.sessionDate).getTime();
    const duration = (session.duration || 60) * 60 * 1000; // Convert minutes to milliseconds
    const buffer = 60 * 60 * 1000; // 1 hour buffer
    const sessionEnd = sessionTime + duration + buffer;
    const now = Date.now();
    
    return now >= sessionEnd;
  }
  
  return false;
}

/**
 * Check if a user can give feedback for a session
 * 
 * Requirements:
 * 1. User must be a participant (mentor or learner)
 * 2. Session must be confirmed (both mentor and learner confirmed)
 * 3. Session must have ended (completed or past scheduled time)
 * 4. User must not have already given feedback
 * 
 * @param session - Session to check
 * @param userWallet - Wallet address of the user
 * @param existingFeedbacks - Optional array of existing feedbacks (to avoid extra query)
 * @returns Promise<boolean> - true if user can give feedback
 */
export async function canGiveFeedbackForSession(
  session: Session,
  userWallet: string,
  existingFeedbacks?: Feedback[]
): Promise<boolean> {
  // Normalize wallet addresses (arkiv-native pattern)
  const normalizedUserWallet = userWallet.toLowerCase().trim();
  const normalizedMentor = session.mentorWallet.toLowerCase();
  const normalizedLearner = session.learnerWallet.toLowerCase();
  
  // 1. Check if user is a participant
  const isParticipant = normalizedUserWallet === normalizedMentor || normalizedUserWallet === normalizedLearner;
  if (!isParticipant) {
    return false;
  }
  
  // 2. Check if session is confirmed (both sides)
  if (!session.mentorConfirmed || !session.learnerConfirmed) {
    return false;
  }
  
  // 3. Check if session has ended
  if (!hasSessionEnded(session)) {
    return false;
  }
  
  // 4. Check if user has already given feedback
  if (existingFeedbacks) {
    // Use provided feedbacks array (faster, avoids extra query)
    const hasGivenFeedback = existingFeedbacks.some(
      f => f.feedbackFrom.toLowerCase() === normalizedUserWallet
    );
    if (hasGivenFeedback) {
      return false;
    }
  } else {
    // Query Arkiv to check (slower but accurate)
    const hasGivenFeedback = await hasUserGivenFeedbackForSession(session.key, userWallet);
    if (hasGivenFeedback) {
      return false;
    }
  }
  
  return true;
}

/**
 * Synchronous version that uses existing feedbacks array
 * 
 * Use this when you already have the feedbacks loaded to avoid async overhead.
 * 
 * @param session - Session to check
 * @param userWallet - Wallet address of the user
 * @param existingFeedbacks - Array of existing feedbacks for the session
 * @returns boolean - true if user can give feedback
 */
export function canGiveFeedbackForSessionSync(
  session: Session,
  userWallet: string,
  existingFeedbacks: Feedback[]
): boolean {
  // Normalize wallet addresses (arkiv-native pattern)
  const normalizedUserWallet = userWallet.toLowerCase().trim();
  const normalizedMentor = session.mentorWallet.toLowerCase();
  const normalizedLearner = session.learnerWallet.toLowerCase();
  
  // 1. Check if user is a participant
  const isParticipant = normalizedUserWallet === normalizedMentor || normalizedUserWallet === normalizedLearner;
  if (!isParticipant) {
    return false;
  }
  
  // 2. Check if session is confirmed (both sides)
  if (!session.mentorConfirmed || !session.learnerConfirmed) {
    return false;
  }
  
  // 3. Check if session has ended
  if (!hasSessionEnded(session)) {
    return false;
  }
  
  // 4. Check if user has already given feedback
  const hasGivenFeedback = existingFeedbacks.some(
    f => f.feedbackFrom.toLowerCase() === normalizedUserWallet
  );
  if (hasGivenFeedback) {
    return false;
  }
  
  return true;
}

