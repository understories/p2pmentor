/**
 * Profile API route
 * 
 * Handles profile creation and updates.
 * Supports both MetaMask (client-side) and example wallet (server-side).
 * 
 * Reference: refs/mentor-graph/pages/api/me.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUserProfile, getProfileByWallet } from '@/lib/arkiv/profile';
import { getPrivateKey, CURRENT_WALLET } from '@/lib/config';
import { isTransactionTimeoutError, isRateLimitError } from '@/lib/arkiv/transaction-utils';
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
    const { wallet, action, ...profileData } = body;

    // Use wallet from request body, fallback to CURRENT_WALLET for backward compatibility
    // (like mentor-graph does)
    const targetWallet = wallet || CURRENT_WALLET || '';
    if (!targetWallet) {
      return NextResponse.json(
        { ok: false, error: 'No wallet address provided' },
        { status: 400 }
      );
    }

    if (action === 'createProfile' || action === 'updateProfile') {
      // For updateProfile, we need to get existing profile first to preserve other fields
      let existingProfile = null;
      if (action === 'updateProfile') {
        existingProfile = await getProfileByWallet(targetWallet);
        if (!existingProfile) {
          return NextResponse.json(
            { ok: false, error: 'Profile not found. Please create a profile first.' },
            { status: 404 }
          );
        }
      }
      const {
        displayName,
        username,
        profileImage,
        bio,
        bioShort,
        bioLong,
        skills = '',
        skillsArray,
        skill_ids,
        skillExpertise,
        timezone = '',
        languages,
        contactLinks,
        seniority,
        domainsOfInterest,
        mentorRoles,
        learnerRoles,
        availabilityWindow,
      } = profileData;

      // For updateProfile, use existing values if not provided
      const finalDisplayName = displayName || existingProfile?.displayName || '';
      const finalUsername = username !== undefined ? username : existingProfile?.username;
      const finalProfileImage = profileImage !== undefined ? profileImage : existingProfile?.profileImage;
      const finalBio = bio !== undefined ? bio : existingProfile?.bio;
      const finalBioShort = bioShort !== undefined ? bioShort : existingProfile?.bioShort;
      const finalBioLong = bioLong !== undefined ? bioLong : existingProfile?.bioLong;
      const finalTimezone = timezone || existingProfile?.timezone || '';
      const finalLanguages = languages !== undefined ? languages : existingProfile?.languages;
      const finalContactLinks = contactLinks !== undefined ? contactLinks : existingProfile?.contactLinks;
      const finalSeniority = seniority !== undefined ? seniority : existingProfile?.seniority;
      const finalDomainsOfInterest = domainsOfInterest !== undefined ? domainsOfInterest : existingProfile?.domainsOfInterest;
      const finalMentorRoles = mentorRoles !== undefined ? mentorRoles : existingProfile?.mentorRoles;
      const finalLearnerRoles = learnerRoles !== undefined ? learnerRoles : existingProfile?.learnerRoles;
      const finalAvailabilityWindow = availabilityWindow !== undefined ? availabilityWindow : existingProfile?.availabilityWindow;
      const finalSkills = skills || (existingProfile?.skills || '');
      const finalSkillsArray = skillsArray !== undefined 
        ? skillsArray 
        : (existingProfile?.skillsArray || (finalSkills ? finalSkills.split(',').map((s: string) => s.trim()).filter(Boolean) : []));
      const finalSkillIds = skill_ids !== undefined 
        ? skill_ids 
        : ((existingProfile as any)?.skill_ids || []);
      const finalSkillExpertise = skillExpertise !== undefined
        ? skillExpertise
        : (existingProfile?.skillExpertise || {});

      if (!finalDisplayName) {
        return NextResponse.json(
          { ok: false, error: 'displayName is required' },
          { status: 400 }
        );
      }

      // Always allow server-side creation (like mentor-graph)
      // The frontend decides whether to use this API or MetaMask directly
      try {
        const { key, txHash } = await createUserProfile({
          wallet: targetWallet,
          displayName: finalDisplayName,
          username: finalUsername,
          profileImage: finalProfileImage,
          bio: finalBio,
          bioShort: finalBioShort,
          bioLong: finalBioLong,
          skills: finalSkills,
          skillsArray: finalSkillsArray,
          skill_ids: finalSkillIds,
          skillExpertise: finalSkillExpertise,
          timezone: finalTimezone,
          languages: finalLanguages,
          contactLinks: finalContactLinks,
          seniority: finalSeniority,
          domainsOfInterest: finalDomainsOfInterest,
          mentorRoles: finalMentorRoles,
          learnerRoles: finalLearnerRoles,
          availabilityWindow: finalAvailabilityWindow,
          privateKey: getPrivateKey(),
        });
        
        return NextResponse.json({ ok: true, key, txHash });
      } catch (error: any) {
        // Handle rate limit errors with user-friendly message
        if (isRateLimitError(error)) {
          return NextResponse.json({ 
            ok: false, 
            error: 'Rate limit exceeded. The Arkiv network is temporarily limiting requests. Please wait a moment and try again.',
            rateLimited: true,
          }, { status: 429 });
        }
        
        // Handle transaction receipt timeout gracefully
        if (isTransactionTimeoutError(error)) {
          return NextResponse.json({ 
            ok: true, 
            key: null,
            txHash: null,
            pending: true,
            message: error.message || 'Transaction submitted, confirmation pending'
          });
        }
        throw error;
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

