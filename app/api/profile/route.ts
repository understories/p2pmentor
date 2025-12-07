/**
 * Profile API route
 * 
 * Handles profile creation and updates.
 * Supports both MetaMask (client-side) and example wallet (server-side).
 * 
 * Reference: refs/mentor-graph/pages/api/me.ts
 */

import { NextResponse } from 'next/server';
import { createUserProfile, getProfileByWallet } from '@/lib/arkiv/profile';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wallet, action, ...profileData } = body;

    // Use wallet from request, fallback to CURRENT_WALLET for example wallet
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createProfile' || action === 'updateProfile') {
      const {
        displayName,
        username,
        profileImage,
        bio,
        bioShort,
        bioLong,
        skills = '',
        skillsArray,
        timezone = '',
        languages,
        contactLinks,
        seniority,
        domainsOfInterest,
        mentorRoles,
        learnerRoles,
      } = profileData;

      if (!displayName) {
        return NextResponse.json(
          { ok: false, error: 'displayName is required' },
          { status: 400 }
        );
      }

      // Check if this is the example wallet
      const isExampleWallet = !wallet && CURRENT_WALLET && targetWallet.toLowerCase() === CURRENT_WALLET.toLowerCase();
      
      if (isExampleWallet) {
        // Use server-side creation with private key
        const { key, txHash } = await createUserProfile({
          wallet: targetWallet,
          displayName,
          username,
          profileImage,
          bio,
          bioShort,
          bioLong,
          skills: skills || '',
          skillsArray: skillsArray || (skills ? skills.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined),
          timezone: timezone || '',
          languages: languages || undefined,
          contactLinks: contactLinks || undefined,
          seniority: seniority || undefined,
          domainsOfInterest: domainsOfInterest || undefined,
          mentorRoles: mentorRoles || undefined,
          learnerRoles: learnerRoles || undefined,
          privateKey: getPrivateKey(),
        });
        
        return NextResponse.json({ ok: true, key, txHash });
      } else {
        // For MetaMask wallets, client should use createUserProfileClient directly
        return NextResponse.json(
          { ok: false, error: 'Use MetaMask to sign transactions directly' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet') || CURRENT_WALLET || '';
    
    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    const profile = await getProfileByWallet(wallet);
    return NextResponse.json({ ok: true, profile });
  } catch (error: any) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

