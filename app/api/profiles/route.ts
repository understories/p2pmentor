/**
 * Profiles API route
 * 
 * Handles profile listing with optional filters.
 * 
 * Based on mentor-graph implementation, adapted for Next.js App Router.
 * 
 * Reference: refs/mentor-graph/pages/api/profiles.ts
 */

import { NextResponse } from 'next/server';
import { listUserProfiles } from '@/lib/arkiv/profile';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill') || undefined;
    const seniority = searchParams.get('seniority') || undefined;
    const spaceId = searchParams.get('spaceId') || undefined;

    // List all profiles with optional filters
    const profiles = await listUserProfiles({
      skill,
      seniority,
      spaceId,
    });

    return NextResponse.json({ ok: true, profiles });
  } catch (error: any) {
    console.error('Profiles API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


