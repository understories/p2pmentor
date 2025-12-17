/**
 * Admin API: Beta Code Usage
 *
 * Returns beta code usage statistics for admin dashboard.
 * Shows all beta codes, their usage counts, limits, and status.
 */

import { NextResponse } from 'next/server';
import { listAllBetaCodeUsage } from '@/lib/arkiv/betaCode';
import { listBetaAccessByCode } from '@/lib/arkiv/betaAccess';
import { SPACE_ID } from '@/lib/config';

/**
 * GET /api/admin/beta-code-usage
 *
 * Returns beta code usage statistics.
 * Query params:
 *   - spaceId: Optional space ID to filter by (defaults to SPACE_ID from config)
 *   - spaceIds: Optional comma-separated list of space IDs (for multi-space queries)
 */
export async function GET(request: Request) {
  // TODO: Add authentication/authorization check
  // For now, this is internal-only (not exposed in production without auth)

  try {
    const { searchParams } = new URL(request.url);
    const spaceIdParam = searchParams.get('spaceId');
    const spaceIdsParam = searchParams.get('spaceIds');

    // Determine which space IDs to query
    let spaceIds: string[] = [];
    if (spaceIdsParam) {
      // Multiple space IDs provided
      spaceIds = spaceIdsParam.split(',').map(s => s.trim()).filter(Boolean);
    } else if (spaceIdParam) {
      // Single space ID provided
      spaceIds = [spaceIdParam];
    } else {
      // Default to SPACE_ID from config
      spaceIds = [SPACE_ID];
    }

    // Query all specified spaces and aggregate results
    const allBetaCodes: any[] = [];
    for (const spaceId of spaceIds) {
      const betaCodes = await listAllBetaCodeUsage(spaceId);
      allBetaCodes.push(...betaCodes);
    }

    // Deduplicate codes across spaces (keep the one with highest usageCount)
    // This handles cases where the same code exists in multiple spaces
    const codeMap = new Map<string, any>();
    for (const code of allBetaCodes) {
      if (!code.code) continue;
      const normalizedCode = code.code.toLowerCase().trim();
      const existing = codeMap.get(normalizedCode);
      if (!existing) {
        codeMap.set(normalizedCode, code);
      } else {
        // Keep the one with higher usageCount, or if equal, most recent
        if (code.usageCount > existing.usageCount) {
          codeMap.set(normalizedCode, code);
        } else if (code.usageCount === existing.usageCount) {
          const codeTime = new Date(code.createdAt || 0).getTime();
          const existingTime = new Date(existing.createdAt || 0).getTime();
          if (codeTime > existingTime) {
            codeMap.set(normalizedCode, code);
          }
        }
      }
    }

    // Get all beta code usage entities (latest version of each code, deduplicated across spaces)
    const betaCodes = Array.from(codeMap.values());

    // Get beta access records for each code to see wallet usage
    // Ensure code is normalized (Arkiv-native pattern: always normalize for queries)
    const codesWithAccess = await Promise.all(
      betaCodes.map(async (code) => {
        // Normalize code to ensure consistent querying (defensive)
        const normalizedCode = code.code.toLowerCase().trim();

        // Query access records across all specified spaces
        const allAccessRecords: any[] = [];
        for (const spaceId of spaceIds) {
          const accessRecords = await listBetaAccessByCode(normalizedCode, spaceId);
          allAccessRecords.push(...accessRecords);
        }

        // Deduplicate by wallet address (in case same wallet used code in multiple spaces)
        const uniqueWallets = new Set(allAccessRecords.map(a => a.wallet.toLowerCase()));

        return {
          ...code,
          walletCount: uniqueWallets.size,
          wallets: Array.from(uniqueWallets),
          accessRecords: allAccessRecords.slice(0, 10), // Limit to first 10 for display
        };
      })
    );

    // Calculate summary statistics
    const totalCodes = codesWithAccess.length;
    const totalUsage = codesWithAccess.reduce((sum, code) => sum + code.usageCount, 0);
    const totalLimit = codesWithAccess.reduce((sum, code) => sum + code.limit, 0);
    const totalWallets = new Set(codesWithAccess.flatMap(code => code.wallets)).size;
    const codesAtLimit = codesWithAccess.filter(code => code.usageCount >= code.limit).length;
    const codesAvailable = codesWithAccess.filter(code => code.usageCount < code.limit).length;

    return NextResponse.json({
      ok: true,
      summary: {
        totalCodes,
        totalUsage,
        totalLimit,
        totalWallets,
        codesAtLimit,
        codesAvailable,
        utilizationRate: totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0,
      },
      codes: codesWithAccess.sort((a, b) => {
        // Sort by usage count descending, then by code name
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return a.code.localeCompare(b.code);
      }),
    });
  } catch (error: any) {
    console.error('[admin/beta-code-usage] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch beta code usage' },
      { status: 500 }
    );
  }
}

