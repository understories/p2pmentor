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
        timezone = '',
        languages,
        contactLinks,
        seniority,
        domainsOfInterest,
        mentorRoles,
        learnerRoles,
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
      const finalSkills = skills || (existingProfile?.skills || '');
      const finalSkillsArray = skillsArray !== undefined 
        ? skillsArray 
        : (existingProfile?.skillsArray || (finalSkills ? finalSkills.split(',').map((s: string) => s.trim()).filter(Boolean) : []));

      if (!finalDisplayName) {
        return NextResponse.json(
          { ok: false, error: 'displayName is required' },
          { status: 400 }
        );
      }

      // Always allow server-side creation (like mentor-graph)
      // The frontend decides whether to use this API or MetaMask directly
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
        timezone: finalTimezone,
        languages: finalLanguages,
        contactLinks: finalContactLinks,
        seniority: finalSeniority,
        domainsOfInterest: finalDomainsOfInterest,
        mentorRoles: finalMentorRoles,
        learnerRoles: finalLearnerRoles,
        privateKey: getPrivateKey(),
      });
      
      return NextResponse.json({ ok: true, key, txHash });
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

