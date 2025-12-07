/**
 * Offers page
 * 
 * Browse and create "I am teaching" offers.
 * Design inspired by hidden-garden-ui-ux-upgrades.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { getProfileByWallet } from '@/lib/arkiv/profile';
import type { UserProfile } from '@/lib/arkiv/profile';
import type { Offer } from '@/lib/arkiv/offers';

export default function OffersPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newOffer, setNewOffer] = useState({ skill: '', message: '', availabilityWindow: '' });
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const address = localStorage.getItem('wallet_address');
      if (!address) {
        router.push('/auth');
        return;
      }
      setWalletAddress(address);
      loadData(address);
    }
  }, [router]);

  const loadData = async (wallet: string) => {
    try {
      setLoading(true);
      const [profileData, offersRes] = await Promise.all([
        getProfileByWallet(wallet).catch(() => null),
        fetch('/api/offers').then(r => r.json()),
      ]);
      setProfile(profileData);
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.skill.trim() || !newOffer.message.trim() || !newOffer.availabilityWindow.trim() || !walletAddress) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createOffer',
          wallet: walletAddress,
          skill: newOffer.skill.trim(),
          message: newOffer.message.trim(),
          availabilityWindow: newOffer.availabilityWindow.trim(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSuccess('Offer created successfully!');
        setNewOffer({ skill: '', message: '', availabilityWindow: '' });
        setShowCreateForm(false);
        // Reload offers
        const offersRes = await fetch('/api/offers').then(r => r.json());
        if (offersRes.ok) {
          setOffers(offersRes.offers || []);
        }
      } else {
        setError(data.error || 'Failed to create offer');
      }
    } catch (err: any) {
      console.error('Error creating offer:', err);
      setError(err.message || 'Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <BackButton href="/network" />
          </div>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/network" />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Offers</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Browse what others are teaching, or post your own teaching offer.
          </p>
        </div>

        {/* Beta Warning */}
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            ⚠️ <strong>Beta Environment:</strong> This is a test environment. All data is on the Mendoza testnet and may be reset.
          </p>
        </div>

        {/* Create Offer Button */}
        {!showCreateForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              + Create Offer
            </button>
          </div>
        )}

        {/* Create Offer Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Create New Offer</h2>
            <form onSubmit={handleCreateOffer} className="space-y-4">
              <div>
                <label htmlFor="skill" className="block text-sm font-medium mb-2">
                  Skill you can teach *
                </label>
                <input
                  id="skill"
                  type="text"
                  value={newOffer.skill}
                  onChange={(e) => setNewOffer({ ...newOffer, skill: e.target.value })}
                  placeholder="e.g., React, TypeScript, Solidity"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  value={newOffer.message}
                  onChange={(e) => setNewOffer({ ...newOffer, message: e.target.value })}
                  placeholder="Describe what you can teach..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label htmlFor="availabilityWindow" className="block text-sm font-medium mb-2">
                  Availability Window *
                </label>
                <input
                  id="availabilityWindow"
                  type="text"
                  value={newOffer.availabilityWindow}
                  onChange={(e) => setNewOffer({ ...newOffer, availabilityWindow: e.target.value })}
                  placeholder="e.g., Weekdays 6-8 PM EST, Weekends flexible"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Offer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewOffer({ skill: '', message: '', availabilityWindow: '' });
                    setError('');
                    setSuccess('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-800 dark:text-green-200">
                {success}
              </div>
            )}
          </div>
        )}

        {/* Offers List */}
        <div className="space-y-4">
          {offers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>No offers yet. Be the first to create one!</p>
            </div>
          ) : (
            offers.map((offer) => (
              <div
                key={offer.key}
                className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {offer.skill}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDate(offer.createdAt)}
                    </p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                    {offer.status}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                  {offer.message}
                </p>
                {offer.availabilityWindow && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                      Availability:
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      {offer.availabilityWindow}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span className="font-mono text-xs">{offer.wallet.slice(0, 6)}...{offer.wallet.slice(-4)}</span>
                  {offer.txHash && (
                    <a
                      href={`https://explorer.mendoza.hoodi.arkiv.network/tx/${offer.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View on Arkiv Explorer
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
