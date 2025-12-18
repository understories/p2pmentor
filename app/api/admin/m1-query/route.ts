/**
 * M1 Exam Checklist - Arkiv Query API
 * 
 * Server-side proxy for running Arkiv queries from the admin dashboard.
 * This allows the admin dashboard to test real Arkiv queries without exposing
 * private keys or requiring client-side wallet connections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/arkiv/client';
import { eq } from '@arkiv-network/sdk/query';
import { SPACE_ID } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryType, params } = body;

    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    let result: any = null;
    let error: string | null = null;

    try {
      switch (queryType) {
        case 'profile':
          // Query profile by wallet
          const wallet = (params.wallet || '').toLowerCase();
          if (!wallet) {
            throw new Error('Wallet address required');
          }
          result = await query
            .where(eq('type', 'user_profile'))
            .where(eq('wallet', wallet))
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 1)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'ask':
          // Query asks
          let askQuery = query
            .where(eq('type', 'ask'))
            .where(eq('status', 'open'));
          
          if (params.wallet) {
            askQuery = askQuery.where(eq('wallet', params.wallet.toLowerCase()));
          }
          if (params.skill_id) {
            askQuery = askQuery.where(eq('skill_id', params.skill_id));
          }
          if (params.spaceId) {
            askQuery = askQuery.where(eq('spaceId', params.spaceId));
          } else {
            askQuery = askQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await askQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'offer':
          // Query offers
          let offerQuery = query
            .where(eq('type', 'offer'))
            .where(eq('status', 'open'));
          
          if (params.wallet) {
            offerQuery = offerQuery.where(eq('wallet', params.wallet.toLowerCase()));
          }
          if (params.skill_id) {
            offerQuery = offerQuery.where(eq('skill_id', params.skill_id));
          }
          if (params.spaceId) {
            offerQuery = offerQuery.where(eq('spaceId', params.spaceId));
          } else {
            offerQuery = offerQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await offerQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'session':
          // Query sessions
          let sessionQuery = query.where(eq('type', 'session'));
          
          if (params.mentorWallet) {
            sessionQuery = sessionQuery.where(eq('mentorWallet', params.mentorWallet.toLowerCase()));
          }
          if (params.learnerWallet) {
            sessionQuery = sessionQuery.where(eq('learnerWallet', params.learnerWallet.toLowerCase()));
          }
          if (params.sessionKey) {
            // For session confirmations
            const confirmationQuery = query
              .where(eq('type', 'session_confirmation'))
              .where(eq('sessionKey', params.sessionKey))
              .withAttributes(true)
              .fetch();
            result = await confirmationQuery;
            break;
          }
          if (params.spaceId) {
            sessionQuery = sessionQuery.where(eq('spaceId', params.spaceId));
          } else {
            sessionQuery = sessionQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await sessionQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'feedback':
          // Query feedback
          let feedbackQuery = query.where(eq('type', 'session_feedback'));
          
          if (params.sessionKey) {
            feedbackQuery = feedbackQuery.where(eq('sessionKey', params.sessionKey));
          }
          if (params.feedbackTo) {
            feedbackQuery = feedbackQuery.where(eq('feedbackTo', params.feedbackTo.toLowerCase()));
          }
          if (params.spaceId) {
            feedbackQuery = feedbackQuery.where(eq('spaceId', params.spaceId));
          } else {
            feedbackQuery = feedbackQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await feedbackQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'availability':
          // Query availability
          let availabilityQuery = query.where(eq('type', 'availability'));
          
          if (params.wallet) {
            availabilityQuery = availabilityQuery.where(eq('wallet', params.wallet.toLowerCase()));
          }
          if (params.spaceId) {
            availabilityQuery = availabilityQuery.where(eq('spaceId', params.spaceId));
          } else {
            availabilityQuery = availabilityQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await availabilityQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'skill':
          // Query skills
          let skillQuery = query.where(eq('type', 'skill'));
          
          if (params.status) {
            skillQuery = skillQuery.where(eq('status', params.status));
          }
          if (params.spaceId) {
            skillQuery = skillQuery.where(eq('spaceId', params.spaceId));
          } else {
            skillQuery = skillQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await skillQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 100)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'notification':
          // Query notifications
          let notificationQuery = query.where(eq('type', 'notification'));
          
          if (params.wallet) {
            notificationQuery = notificationQuery.where(eq('wallet', params.wallet.toLowerCase()));
          }
          if (params.sourceEntityType) {
            notificationQuery = notificationQuery.where(eq('sourceEntityType', params.sourceEntityType));
          }
          if (params.spaceId) {
            notificationQuery = notificationQuery.where(eq('spaceId', params.spaceId));
          } else {
            notificationQuery = notificationQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await notificationQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'session_confirmation':
          // Query session confirmations
          let confirmationQuery = query.where(eq('type', 'session_confirmation'));
          
          if (params.sessionKey) {
            confirmationQuery = confirmationQuery.where(eq('sessionKey', params.sessionKey));
          }
          if (params.confirmedBy) {
            confirmationQuery = confirmationQuery.where(eq('confirmedBy', params.confirmedBy.toLowerCase()));
          }
          if (params.spaceId) {
            confirmationQuery = confirmationQuery.where(eq('spaceId', params.spaceId));
          } else {
            confirmationQuery = confirmationQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await confirmationQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'session_rejection':
          // Query session rejections
          let rejectionQuery = query.where(eq('type', 'session_rejection'));
          
          if (params.sessionKey) {
            rejectionQuery = rejectionQuery.where(eq('sessionKey', params.sessionKey));
          }
          if (params.rejectedBy) {
            rejectionQuery = rejectionQuery.where(eq('rejectedBy', params.rejectedBy.toLowerCase()));
          }
          if (params.spaceId) {
            rejectionQuery = rejectionQuery.where(eq('spaceId', params.spaceId));
          } else {
            rejectionQuery = rejectionQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await rejectionQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'beta-access':
          // Query beta access
          let betaAccessQuery = query.where(eq('type', 'beta_access'));
          
          if (params.wallet) {
            betaAccessQuery = betaAccessQuery.where(eq('wallet', params.wallet.toLowerCase()));
          }
          if (params.spaceId) {
            betaAccessQuery = betaAccessQuery.where(eq('spaceId', params.spaceId));
          } else {
            betaAccessQuery = betaAccessQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await betaAccessQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        case 'beta-code':
          // Query beta codes
          let betaCodeQuery = query.where(eq('type', 'beta_code'));
          
          if (params.code) {
            betaCodeQuery = betaCodeQuery.where(eq('code', params.code));
          }
          if (params.spaceId) {
            betaCodeQuery = betaCodeQuery.where(eq('spaceId', params.spaceId));
          } else {
            betaCodeQuery = betaCodeQuery.where(eq('spaceId', SPACE_ID));
          }
          
          result = await betaCodeQuery
            .withAttributes(true)
            .withPayload(true)
            .limit(params.limit || 10)
            .fetch();
          
          // Sort by createdAt descending client-side
          if (result.entities && result.entities.length > 0) {
            result.entities.sort((a: any, b: any) => {
              const aTime = a.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              const bTime = b.attributes?.find((attr: any) => attr.key === 'createdAt')?.value || '';
              return bTime.localeCompare(aTime);
            });
          }
          break;

        default:
          throw new Error(`Unknown query type: ${queryType}`);
      }
    } catch (queryError: any) {
      error = queryError.message || 'Query failed';
      console.error('[M1 Query API] Query error:', queryError);
    }

    return NextResponse.json({
      ok: !error,
      result: result ? {
        entities: result.entities || [],
        count: result.entities?.length || 0,
      } : null,
      error,
      queryType,
      params,
    });
  } catch (error: any) {
    console.error('[M1 Query API] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

