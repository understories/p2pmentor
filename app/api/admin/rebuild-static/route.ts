/**
 * Admin API: Rebuild Static Client
 * 
 * Triggers rebuild of static client (fetches data from Arkiv and generates HTML).
 * Requires admin authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * POST /api/admin/rebuild-static
 * 
 * Triggers static client rebuild.
 * Body: { password?: string } (optional, uses session auth)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication via session (same pattern as other admin routes)
    // Note: In production, you'd want more robust auth
    const authHeader = request.headers.get('authorization');
    const sessionAuth = request.cookies.get('admin_authenticated')?.value === 'true';
    
    // For now, allow if session auth or if called from admin dashboard
    // TODO: Add proper authentication check
    if (!sessionAuth && !authHeader) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const projectRoot = process.cwd();
    const buildScript = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
    
    // Check if build script exists
    try {
      await fs.access(buildScript);
    } catch {
      // Fallback to npx
      const npxCheck = await execAsync('which npx').catch(() => ({ stdout: '' }));
      if (!npxCheck.stdout.trim()) {
        return NextResponse.json(
          { ok: false, error: 'Build tools not available' },
          { status: 500 }
        );
      }
    }

    console.log('[admin/rebuild-static] Starting static client rebuild...');
    
    // Run build:static command
    // Use npm run to ensure proper environment
    const { stdout, stderr } = await execAsync(
      'npm run build:static',
      {
        cwd: projectRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large output
        timeout: 300000, // 5 minute timeout
      }
    );

    // Check if build was successful
    const outputDir = path.join(projectRoot, 'static-app', 'public');
    let buildSuccess = false;
    let fileCount = 0;
    
    try {
      const files = await fs.readdir(outputDir, { recursive: true });
      fileCount = files.length;
      buildSuccess = fileCount > 0;
    } catch (error) {
      console.error('[admin/rebuild-static] Error checking output directory:', error);
    }

    if (!buildSuccess) {
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Build completed but no output files found',
          stdout: stdout.slice(-500), // Last 500 chars
          stderr: stderr.slice(-500),
        },
        { status: 500 }
      );
    }

    // Get build timestamp
    const buildTimestamp = new Date().toISOString();
    
    // Try to read metadata if available
    let entityCounts = null;
    try {
      const metadataPath = path.join(projectRoot, 'static-data', 'metadata', 'build-timestamp.json');
      const metadata = await fs.readFile(metadataPath, 'utf-8');
      const metadataData = JSON.parse(metadata);
      entityCounts = metadataData.entityCounts;
    } catch (error) {
      // Metadata not critical, continue
    }

    console.log('[admin/rebuild-static] Build completed successfully');

    return NextResponse.json({
      ok: true,
      message: 'Static client rebuilt successfully',
      buildTimestamp,
      fileCount,
      entityCounts,
      outputDir: 'static-app/public',
    });
  } catch (error: any) {
    console.error('[admin/rebuild-static] Error:', error);
    
    // Handle timeout
    if (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM') {
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Build timed out. This may take a few minutes. Please try again.',
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { 
        ok: false, 
        error: error.message || 'Failed to rebuild static client',
        details: error.stdout || error.stderr || undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/rebuild-static
 * 
 * Returns last build status and metadata.
 */
export async function GET() {
  try {
    const projectRoot = process.cwd();
    const metadataPath = path.join(projectRoot, 'static-data', 'metadata', 'build-timestamp.json');
    const outputDir = path.join(projectRoot, 'static-app', 'public');
    
    let lastBuild = null;
    let fileCount = 0;
    let entityCounts = null;

    try {
      const metadata = await fs.readFile(metadataPath, 'utf-8');
      const metadataData = JSON.parse(metadata);
      lastBuild = metadataData.timestamp;
      entityCounts = metadataData.entityCounts;
    } catch (error) {
      // No previous build
    }

    try {
      const files = await fs.readdir(outputDir, { recursive: true });
      fileCount = files.length;
    } catch (error) {
      // Output directory doesn't exist
    }

    return NextResponse.json({
      ok: true,
      lastBuild,
      fileCount,
      entityCounts,
      outputDir: 'static-app/public',
    });
  } catch (error: any) {
    console.error('[admin/rebuild-static] Error getting build status:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get build status' },
      { status: 500 }
    );
  }
}

