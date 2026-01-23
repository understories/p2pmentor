/**
 * Admin API: Sync Quest Entities
 * 
 * Syncs quest definitions from files to Arkiv entities.
 * Requires admin authentication.
 * 
 * POST /api/admin/sync-quests
 * Body: { trackId?: string } (optional - sync specific quest, otherwise syncs all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * POST /api/admin/sync-quests
 * 
 * Triggers quest entity sync.
 * Body: { trackId?: string } (optional)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication via session (same pattern as other admin routes)
    const authHeader = request.headers.get('authorization');
    const sessionAuth = request.cookies.get('admin_authenticated')?.value === 'true';
    
    if (!sessionAuth && !authHeader) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const trackId = body.trackId; // Optional: specific quest to sync

    const projectRoot = process.cwd();
    
    // Build command
    const command = trackId
      ? `pnpm exec tsx scripts/sync-quest-entities.ts ${trackId}`
      : `pnpm exec tsx scripts/sync-quest-entities.ts`;

    console.log('[admin/sync-quests] Starting quest entity sync...');
    console.log(`[admin/sync-quests] Command: ${command}`);
    
    // Run sync script
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
      timeout: 300000, // 5 minute timeout
      env: {
        ...process.env, // Preserve environment variables (ARKIV_PRIVATE_KEY, etc.)
      },
    });

    // Parse output for summary
    const output = stdout + stderr;
    const successMatch = output.match(/✅ Sync complete: (\d+) succeeded, (\d+) failed/);
    const successCount = successMatch ? parseInt(successMatch[1]) : null;
    const failCount = successMatch ? parseInt(successMatch[2]) : null;

    if (successMatch) {
      return NextResponse.json({
        ok: true,
        message: 'Quest sync completed',
        successCount,
        failCount,
        output: output.slice(-1000), // Last 1000 chars for debugging
      });
    }

    // Check for single quest sync
    if (trackId && output.includes('✅ Created entity')) {
      return NextResponse.json({
        ok: true,
        message: `Quest ${trackId} synced successfully`,
        output: output.slice(-1000),
      });
    }

    // If no clear success indicator, check for errors
    if (output.includes('❌') || output.includes('Error')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Sync completed with errors',
          output: output.slice(-1000),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Sync completed',
      output: output.slice(-1000),
    });
  } catch (error: any) {
    console.error('[admin/sync-quests] Error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Failed to sync quest entities',
        details: error?.stderr || error?.stdout || error?.toString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-quests
 * 
 * Returns sync status and available quests.
 */
export async function GET() {
  try {
    // Check authentication
    const sessionAuth = typeof window === 'undefined' 
      ? false // Server-side check would need request object
      : document.cookie.includes('admin_authenticated=true');

    // For now, allow GET without auth (just info)
    return NextResponse.json({
      ok: true,
      message: 'Quest sync API',
      usage: {
        method: 'POST',
        body: '{ trackId?: string }',
        description: 'Sync quest entities from files to Arkiv',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to get sync info' },
      { status: 500 }
    );
  }
}
