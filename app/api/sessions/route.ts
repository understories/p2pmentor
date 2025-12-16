/**
 * Sessions API route
 * 
 * Handles session creation, listing, and confirmation.
 * 
 * Based on mentor-graph implementation, adapted for Next.js App Router.
 * 
 * Reference: refs/mentor-graph/pages/api/me.ts (createSession action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSession, listSessions, listSessionsForWallet, confirmSession, rejectSession, submitPayment, validatePayment } from '@/lib/arkiv/sessions';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { validateTransaction } from '@/lib/payments';
import { verifyBetaAccess } from '@/lib/auth/betaAccess';

export async function POST(request: NextRequest) {
  // Verify beta access
  const betaCheck = await verifyBetaAccess(request, {
    requireArkivValidation: false, // Fast path - cookies are sufficient
  });

  if (!betaCheck.hasAccess) {
    return NextResponse.json(
      { ok: false, error: betaCheck.error || 'Beta access required. Please enter invite code at /beta' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, wallet, mentorWallet, learnerWallet, skill, skill_id, sessionDate, duration, notes, sessionKey, confirmedByWallet, rejectedByWallet, requiresPayment, paymentAddress, cost, paymentTxHash, submittedByWallet, validatedByWallet, spaceId, offerKey, mode } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createSession') {
      if (!mentorWallet || !learnerWallet || !skill || !sessionDate) {
        return NextResponse.json(
          { ok: false, error: 'mentorWallet, learnerWallet, skill, and sessionDate are required' },
          { status: 400 }
        );
      }

      try {
        // Ensure duration is always an integer to prevent BigInt conversion errors
        const durationInt = duration !== undefined && duration !== null
          ? Math.floor(typeof duration === 'number' ? duration : parseInt(String(duration), 10) || 60)
          : undefined;

        // Determine requester from context
        // - Request mode (from offer): learner is requester
        // - Offer mode (from ask): mentor is requester
        // - Peer mode: userWallet (initiator) is requester
        // - Default: learner is requester (most common case)
        let requesterWallet: string | undefined;
        if (mode === 'offer') {
          // Offering to help: mentor is requester
          requesterWallet = mentorWallet.toLowerCase();
        } else if (mode === 'peer') {
          // Peer learning: userWallet (initiator) is requester
          requesterWallet = wallet?.toLowerCase();
        } else if (offerKey) {
          // Request mode (from offer): learner is requester
          requesterWallet = learnerWallet.toLowerCase();
        } else {
          // Default: learner is requester (most common case)
          requesterWallet = learnerWallet.toLowerCase();
        }

        const { key, txHash } = await createSession({
          mentorWallet,
          learnerWallet,
          skill, // Legacy: kept for backward compatibility
          skill_id: skill_id || undefined, // Arkiv-native: skill entity key (preferred)
          sessionDate,
          duration: durationInt,
          notes: notes || undefined,
          requiresPayment: requiresPayment || undefined,
          paymentAddress: paymentAddress || undefined,
          cost: cost || undefined,
          requesterWallet, // Auto-confirm requester
          privateKey: getPrivateKey(),
        });

        // Create notification for offer owner when meeting is requested on an offer
        if (offerKey && key) {
          try {
            const { createNotification } = await import('@/lib/arkiv/notifications');
            const { getProfileByWallet } = await import('@/lib/arkiv/profile');
            
            // Get learner profile for notification message
            const learnerProfile = await getProfileByWallet(learnerWallet).catch(() => null);
            const learnerName = learnerProfile?.displayName || learnerWallet.slice(0, 6) + '...' + learnerWallet.slice(-4);
            
            await createNotification({
              wallet: mentorWallet.toLowerCase(), // Notify the offer owner (mentor)
              notificationType: 'meeting_request',
              sourceEntityType: 'session',
              sourceEntityKey: key,
              title: 'New Meeting Request on Your Offer',
              message: `${learnerName} requested a meeting for "${skill}"`,
              link: '/me/sessions',
              metadata: {
                sessionKey: key,
                offerKey: offerKey,
                skill: skill,
                learnerWallet: learnerWallet.toLowerCase(),
              },
              privateKey: getPrivateKey(),
            });
          } catch (notifError) {
            // Log but don't fail the session creation if notification fails
            console.error('Failed to create notification for meeting request:', notifError);
          }
        }

        // Create user-focused notification for the requester (learner or mentor who initiated)
        // Note: Requester is auto-confirmed, so they should check Sessions to see when the other party confirms
        if (key) {
          try {
            const { createNotification } = await import('@/lib/arkiv/notifications');
            const requesterWalletNormalized = requesterWallet?.toLowerCase() || learnerWallet.toLowerCase();
            await createNotification({
              wallet: requesterWalletNormalized,
              notificationType: 'entity_created',
              sourceEntityType: 'session',
              sourceEntityKey: key,
              title: 'Meeting Requested',
              message: `Your meeting request for "${skill}" is pending confirmation. Check Sessions for updates.`,
              link: '/me/sessions',
              metadata: {
                sessionKey: key,
                skill: skill,
                mentorWallet: mentorWallet.toLowerCase(),
                learnerWallet: learnerWallet.toLowerCase(),
              },
              privateKey: getPrivateKey(),
            });
          } catch (notifError) {
            console.error('Failed to create user notification for session:', notifError);
          }
        }

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        // Handle transaction receipt timeout gracefully
        // If error mentions pending confirmation, return partial success
        if (error.message?.includes('confirmation pending') || error.message?.includes('Transaction submitted')) {
          // Transaction was submitted but receipt not available - this is OK for testnets
          // Return success with a note that confirmation is pending
          return NextResponse.json({ 
            ok: true, 
            key: null, // Entity key not available yet
            txHash: null, // TxHash not available yet
            pending: true,
            message: error.message || 'Transaction submitted, confirmation pending'
          });
        }
        throw error; // Re-throw other errors
      }
    } else if (action === 'confirmSession') {
      if (!sessionKey || !confirmedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey and confirmedByWallet are required' },
          { status: 400 }
        );
      }

      const { key, txHash } = await confirmSession({
        sessionKey,
        confirmedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else if (action === 'rejectSession') {
      if (!sessionKey || !rejectedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey and rejectedByWallet are required' },
          { status: 400 }
        );
      }

      const { key, txHash } = await rejectSession({
        sessionKey,
        rejectedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else if (action === 'submitPayment') {
      if (!sessionKey || !paymentTxHash || !submittedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey, paymentTxHash, and submittedByWallet are required' },
          { status: 400 }
        );
      }

      const { key, txHash } = await submitPayment({
        sessionKey,
        paymentTxHash,
        submittedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
        spaceId,
      });

      return NextResponse.json({ ok: true, key, txHash });
    } else if (action === 'validatePayment') {
      if (!sessionKey || !paymentTxHash || !validatedByWallet) {
        return NextResponse.json(
          { ok: false, error: 'sessionKey, paymentTxHash, and validatedByWallet are required' },
          { status: 400 }
        );
      }

      // First validate the transaction on-chain
      const validationResult = await validateTransaction(paymentTxHash);
      
      if (!validationResult.valid) {
        return NextResponse.json(
          { ok: false, error: validationResult.error || 'Transaction validation failed' },
          { status: 400 }
        );
      }

      // If transaction is valid, create payment validation entity
      const { key, txHash } = await validatePayment({
        sessionKey,
        paymentTxHash,
        validatedByWallet,
        privateKey: getPrivateKey(),
        mentorWallet,
        learnerWallet,
        spaceId,
      });

      return NextResponse.json({ ok: true, key, txHash, validationResult });
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const mentorWallet = searchParams.get('mentorWallet') || undefined;
    const learnerWallet = searchParams.get('learnerWallet') || undefined;
    const skill = searchParams.get('skill') || undefined;
    const status = searchParams.get('status') || undefined;
    const spaceId = searchParams.get('spaceId') || undefined;

    if (wallet) {
      // List sessions for specific wallet
      const sessions = await listSessionsForWallet(wallet);
      return NextResponse.json({ ok: true, sessions });
    } else {
      // List all sessions (with optional filters)
      const sessions = await listSessions({
        mentorWallet,
        learnerWallet,
        skill,
        status,
        spaceId,
      });
      return NextResponse.json({ ok: true, sessions });
    }
  } catch (error: any) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

