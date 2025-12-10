/**
 * Learning Follow API route
 * 
 * Handles following/unfollowing skills for learning communities.
 */

import { NextResponse } from 'next/server';
import { createLearningFollow, listLearningFollows, unfollowSkill } from '@/lib/arkiv/learningFollow';
import { getPrivateKey } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, profile_wallet, skill_id } = body;

    if (!profile_wallet || !skill_id) {
      return NextResponse.json(
        { ok: false, error: 'profile_wallet and skill_id are required' },
        { status: 400 }
      );
    }

    if (action === 'follow') {
      try {
        const { key, txHash } = await createLearningFollow({
          profile_wallet,
          skill_id,
          mode: 'learning',
          privateKey: getPrivateKey(),
          spaceId: 'local-dev',
        });

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        console.error('[learning-follow] Error creating follow:', error);
        return NextResponse.json(
          { ok: false, error: error.message || 'Failed to follow skill' },
          { status: 500 }
        );
      }
    } else if (action === 'unfollow') {
      try {
        const { key, txHash } = await unfollowSkill({
          profile_wallet,
          skill_id,
          privateKey: getPrivateKey(),
          spaceId: 'local-dev',
        });

        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        console.error('[learning-follow] Error unfollowing skill:', error);
        return NextResponse.json(
          { ok: false, error: error.message || 'Failed to unfollow skill' },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action. Use "follow" or "unfollow"' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[learning-follow] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const profile_wallet = searchParams.get('profile_wallet');
    const skill_id = searchParams.get('skill_id');
    const active = searchParams.get('active') !== 'false'; // Default to true

    const follows = await listLearningFollows({
      profile_wallet: profile_wallet || undefined,
      skill_id: skill_id || undefined,
      active,
      limit: 100,
    });

    return NextResponse.json({ ok: true, follows });
  } catch (error: any) {
    console.error('[learning-follow] Error listing follows:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
