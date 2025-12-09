/**
 * Admin API: Page Load Times
 * 
 * Measures page load times for key pages using the sample wallet.
 * This helps track real-world performance from a user perspective.
 */

import { NextResponse } from 'next/server';
import { CURRENT_WALLET } from '@/lib/config';

interface PageLoadResult {
  page: string;
  durationMs: number;
  status: number;
  error?: string;
}

/**
 * Measure page load time by making a request to the page
 */
async function measurePageLoad(baseUrl: string, path: string): Promise<PageLoadResult> {
  const startTime = Date.now();
  
  try {
    const url = `${baseUrl}${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'p2pmentor-admin-dashboard',
      },
    });
    
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    return {
      page: path,
      durationMs,
      status: response.status,
    };
  } catch (error: any) {
    const endTime = Date.now();
    return {
      page: path,
      durationMs: endTime - startTime,
      status: 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * GET /api/admin/page-load-times
 * 
 * Measures load times for key pages.
 * Uses the sample wallet (CURRENT_WALLET) for wallet-specific pages.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const baseUrl = searchParams.get('baseUrl') || 'http://localhost:3000';
    
    // Key pages to measure
    const pages = [
      '/',
      '/network',
      '/network/forest',
      '/me',
      '/me/sessions',
      '/me/skills',
      '/asks',
      '/offers',
      '/profiles',
      ...(CURRENT_WALLET ? [`/profiles/${CURRENT_WALLET}`] : []),
    ];
    
    // Warm up: Make a request to each page first to avoid cold start skewing results
    // This ensures we're measuring actual page load time, not compilation time
    await Promise.all(
      pages.map(page => measurePageLoad(baseUrl, page))
    );
    
    // Wait a moment for server to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Now measure for real (warm measurements)
    const results = await Promise.all(
      pages.map(page => measurePageLoad(baseUrl, page))
    );
    
    // Calculate summary stats
    const successful = results.filter(r => r.status === 200);
    const avgDuration = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.durationMs, 0) / successful.length
      : 0;
    const minDuration = successful.length > 0
      ? Math.min(...successful.map(r => r.durationMs))
      : 0;
    const maxDuration = successful.length > 0
      ? Math.max(...successful.map(r => r.durationMs))
      : 0;
    
    return NextResponse.json({
      ok: true,
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: results.length - successful.length,
        avgDurationMs: Math.round(avgDuration),
        minDurationMs: minDuration,
        maxDurationMs: maxDuration,
      },
      measuredAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[admin/page-load-times] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to measure page load times' },
      { status: 500 }
    );
  }
}

