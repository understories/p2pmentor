/**
 * Quick Actions Component
 * 
 * Two small luminous sprout-buttons for creating asks/offers.
 * Part of Network page "Canopy Map" transformation.
 */

'use client';

import Link from 'next/link';
import { askEmojis, offerEmojis } from '@/lib/colors';

export function QuickActions() {
  return (
    <div className="flex gap-3 mb-6">
      <Link
        href="/asks?create=true"
        className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium text-sm transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        style={{
          boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(34, 197, 94, 0.2)',
        }}
      >
        <span className="text-lg">{askEmojis.default}</span>
        <span>Plant an Ask</span>
      </Link>
      <Link
        href="/offers?create=true"
        className="flex-1 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-medium text-sm transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
        style={{
          boxShadow: '0 0 20px rgba(34, 197, 94, 0.4), 0 4px 12px rgba(34, 197, 94, 0.2)',
        }}
      >
        <span className="text-lg">{offerEmojis.default}</span>
        <span>Grow an Offer</span>
      </Link>
    </div>
  );
}
