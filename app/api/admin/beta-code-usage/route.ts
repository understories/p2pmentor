/**
 * Admin API: Beta Code Usage
 * 
 * Returns beta code usage statistics for admin dashboard.
 * Shows all beta codes, their usage counts, limits, and status.
 */

import { NextResponse } from 'next/server';
import { listAllBetaCodeUsage } from '@/lib/arkiv/betaCode';
import { listBetaAccessByCode } from '@/lib/arkiv/betaAccess';

/**
 * GET /api/admin/beta-code-usage
 * 
 * Returns beta code usage statistics.
 */
export async function GET() {
  // TODO: Add authentication/authorization check
  // For now, this is internal-only (not exposed in production without auth)
  
  try {
    // Get all beta code usage entities (latest version of each code)
    const betaCodes = await listAllBetaCodeUsage();
    
    // Get beta access records for each code to see wallet usage
    // Ensure code is normalized (Arkiv-native pattern: always normalize for queries)
    const codesWithAccess = await Promise.all(
      betaCodes.map(async (code) => {
        // Normalize code to ensure consistent querying (defensive)
        const normalizedCode = code.code.toLowerCase().trim();
        const accessRecords = await listBetaAccessByCode(normalizedCode);
        return {
          ...code,
          walletCount: accessRecords.length,
          wallets: accessRecords.map(a => a.wallet.toLowerCase()), // Ensure wallets are normalized
          accessRecords: accessRecords.slice(0, 10), // Limit to first 10 for display
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

