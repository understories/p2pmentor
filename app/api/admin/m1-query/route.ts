/**
 * M1 Exam Checklist - Arkiv Query API
 *
 * Server-side proxy for running Arkiv queries from the admin dashboard.
 * This allows the admin dashboard to test real Arkiv queries without exposing
 * private keys or requiring client-side wallet connections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublicClient } from '@/lib/arkiv/client';
import { eqAttr } from '@/lib/arkiv/schema';
import {
  arkivSelect,
  attrsToRecord,
  fetchAll,
  getAttr as readAttr,
  parsePayload,
  type ArkivEntity,
} from '@/lib/arkiv/read';
import { SPACE_ID } from '@/lib/config';

/** Sort query results by `created_at` attribute, newest first (in place) */
function sortNewestFirst(result: { entities?: ArkivEntity[] } | null): void {
  result?.entities?.sort((a, b) =>
    readAttr(b, 'created_at').localeCompare(readAttr(a, 'created_at'))
  );
}

/**
 * JSON-safe view of an entity for the admin UI
 * (bigint fields as strings, attributes as a name -> string record, payload decoded)
 */
function serializeEntity(entity: ArkivEntity) {
  return {
    key: entity.key,
    owner: entity.owner,
    creator: entity.creator,
    createdAt: entity.createdAt?.toString(),
    expiresAt: entity.expiresAt?.toString(),
    attributes: attrsToRecord(entity),
    payload: parsePayload(entity, null),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryType, params } = body;

    const publicClient = getPublicClient();

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
          result = await fetchAll(
            arkivSelect('user_profile', publicClient).where(eqAttr('wallet', wallet)),
            params.limit || 1,
            publicClient
          );

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'ask':
          // Query asks
          let askQuery = arkivSelect('ask', publicClient).where(eqAttr('status', 'open'));

          if (params.wallet) {
            askQuery = askQuery.where(eqAttr('wallet', params.wallet.toLowerCase()));
          }
          if (params.skill_id) {
            askQuery = askQuery.where(eqAttr('skill_id', params.skill_id));
          }
          if (params.spaceId) {
            askQuery = askQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            askQuery = askQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(askQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'offer':
          // Query offers
          let offerQuery = arkivSelect('offer', publicClient).where(eqAttr('status', 'open'));

          if (params.wallet) {
            offerQuery = offerQuery.where(eqAttr('wallet', params.wallet.toLowerCase()));
          }
          if (params.skill_id) {
            offerQuery = offerQuery.where(eqAttr('skill_id', params.skill_id));
          }
          if (params.spaceId) {
            offerQuery = offerQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            offerQuery = offerQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(offerQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'session':
          // Query sessions
          let sessionQuery = arkivSelect('session', publicClient);

          if (params.mentorWallet) {
            sessionQuery = sessionQuery.where(
              eqAttr('mentor_wallet', params.mentorWallet.toLowerCase())
            );
          }
          if (params.learnerWallet) {
            sessionQuery = sessionQuery.where(
              eqAttr('learner_wallet', params.learnerWallet.toLowerCase())
            );
          }
          if (params.sessionKey) {
            // For session confirmations
            const confirmationQuery = arkivSelect('session_confirmation', publicClient).where(
              eqAttr('session_key', params.sessionKey)
            );
            result = await fetchAll(confirmationQuery, params.limit || 10, publicClient);
            break;
          }
          if (params.spaceId) {
            sessionQuery = sessionQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            sessionQuery = sessionQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(sessionQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'feedback':
          // Query feedback
          let feedbackQuery = arkivSelect('session_feedback', publicClient);

          if (params.sessionKey) {
            feedbackQuery = feedbackQuery.where(eqAttr('session_key', params.sessionKey));
          }
          if (params.feedbackTo) {
            feedbackQuery = feedbackQuery.where(
              eqAttr('feedback_to', params.feedbackTo.toLowerCase())
            );
          }
          if (params.spaceId) {
            feedbackQuery = feedbackQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            feedbackQuery = feedbackQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(feedbackQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'availability':
          // Query availability
          let availabilityQuery = arkivSelect('availability', publicClient);

          if (params.wallet) {
            availabilityQuery = availabilityQuery.where(
              eqAttr('wallet', params.wallet.toLowerCase())
            );
          }
          if (params.spaceId) {
            availabilityQuery = availabilityQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            availabilityQuery = availabilityQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(availabilityQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'skill':
          // Query skills
          let skillQuery = arkivSelect('skill', publicClient);

          if (params.status) {
            skillQuery = skillQuery.where(eqAttr('status', params.status));
          }
          if (params.spaceId) {
            skillQuery = skillQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            skillQuery = skillQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(skillQuery, params.limit || 100, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'notification':
          // Query notifications
          let notificationQuery = arkivSelect('notification', publicClient);

          if (params.wallet) {
            notificationQuery = notificationQuery.where(
              eqAttr('wallet', params.wallet.toLowerCase())
            );
          }
          if (params.sourceEntityType) {
            notificationQuery = notificationQuery.where(
              eqAttr('source_entity_type', params.sourceEntityType)
            );
          }
          if (params.spaceId) {
            notificationQuery = notificationQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            notificationQuery = notificationQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(notificationQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'session_confirmation':
          // Query session confirmations
          let confirmationQuery = arkivSelect('session_confirmation', publicClient);

          if (params.sessionKey) {
            confirmationQuery = confirmationQuery.where(eqAttr('session_key', params.sessionKey));
          }
          if (params.confirmedBy) {
            confirmationQuery = confirmationQuery.where(
              eqAttr('confirmed_by', params.confirmedBy.toLowerCase())
            );
          }
          if (params.spaceId) {
            confirmationQuery = confirmationQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            confirmationQuery = confirmationQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(confirmationQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'session_rejection':
          // Query session rejections
          let rejectionQuery = arkivSelect('session_rejection', publicClient);

          if (params.sessionKey) {
            rejectionQuery = rejectionQuery.where(eqAttr('session_key', params.sessionKey));
          }
          if (params.rejectedBy) {
            rejectionQuery = rejectionQuery.where(
              eqAttr('rejected_by', params.rejectedBy.toLowerCase())
            );
          }
          if (params.spaceId) {
            rejectionQuery = rejectionQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            rejectionQuery = rejectionQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(rejectionQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'beta-access':
          // Query beta access
          let betaAccessQuery = arkivSelect('beta_access', publicClient);

          if (params.wallet) {
            betaAccessQuery = betaAccessQuery.where(eqAttr('wallet', params.wallet.toLowerCase()));
          }
          if (params.spaceId) {
            betaAccessQuery = betaAccessQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            betaAccessQuery = betaAccessQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(betaAccessQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
          break;

        case 'beta-code':
          // Query beta codes
          let betaCodeQuery = arkivSelect('beta_code', publicClient);

          if (params.code) {
            betaCodeQuery = betaCodeQuery.where(eqAttr('code', params.code));
          }
          if (params.spaceId) {
            betaCodeQuery = betaCodeQuery.where(eqAttr('space_id', params.spaceId));
          } else {
            betaCodeQuery = betaCodeQuery.where(eqAttr('space_id', SPACE_ID));
          }

          result = await fetchAll(betaCodeQuery, params.limit || 10, publicClient);

          // Sort by createdAt descending client-side
          sortNewestFirst(result);
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
      result: result
        ? {
            entities: (result.entities || []).map(serializeEntity),
            count: result.entities?.length || 0,
          }
        : null,
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
