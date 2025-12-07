/**
 * Jitsi room generation utilities
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/lib/jitsi.ts
 */

import crypto from 'crypto';
import { JITSI_BASE_URL } from "./config";

export type VideoProvider = 'jitsi' | 'none' | 'custom';

/**
 * Generate a stable but opaque room name for a session
 * Format: mg-{sessionKey}-{hash}
 * 
 * @param sessionKey - Session entity key from Arkiv
 * @returns Room name string
 */
export function buildJitsiRoomName(sessionKey: string): string {
  const prefix = 'mg';
  
  // Hash the session key to avoid predictable patterns
  const hash = crypto
    .createHash('sha256')
    .update(sessionKey)
    .digest('hex')
    .slice(0, 16); // 16 hex chars = 64 bits
  
  return `${prefix}-${sessionKey}-${hash}`;
}

/**
 * Build the full Jitsi URL from a room name
 * 
 * @param roomName - Room name
 * @param baseUrl - Optional base URL (defaults to JITSI_BASE_URL)
 * @returns Full Jitsi Meet URL
 */
export function buildJitsiUrlFromRoomName(roomName: string, baseUrl?: string): string {
  const base = baseUrl || JITSI_BASE_URL;
  // Remove trailing slashes and encode room name
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/${encodeURIComponent(roomName)}`;
}

/**
 * Generate Jitsi room name and URL for a session
 * 
 * @param sessionKey - Session entity key from Arkiv
 * @param baseUrl - Optional base URL (defaults to JITSI_BASE_URL)
 * @returns Object with video provider, room name, and join URL
 */
export function generateJitsiMeeting(sessionKey: string, baseUrl?: string): {
  videoProvider: VideoProvider;
  videoRoomName: string;
  videoJoinUrl: string;
} {
  const roomName = buildJitsiRoomName(sessionKey);
  const joinUrl = buildJitsiUrlFromRoomName(roomName, baseUrl);
  
  return {
    videoProvider: 'jitsi',
    videoRoomName: roomName,
    videoJoinUrl: joinUrl,
  };
}

