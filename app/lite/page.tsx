/**
 * Lite Page
 * 
 * Simplified ask/offer board with no authentication.
 * Uses server wallet for all entity creation.
 * Fixed 1 month TTL for all asks and offers.
 * 
 * Reference: refs/lite-implementation-plan.md
 */

'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import type { LiteAsk } from '@/lib/arkiv/liteAsks';
import type { LiteOffer } from '@/lib/arkiv/liteOffers';

interface Match {
  ask: LiteAsk;
  offer: LiteOffer;
}

export default function LitePage() {
  const [asks, setAsks] = useState<LiteAsk[]>([]);
  const [offers, setOffers] = useState<LiteOffer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateAskForm, setShowCreateAskForm] = useState(false);
  const [showCreateOfferForm, setShowCreateOfferForm] = useState(false);
  
  // Ask form state
  const [newAsk, setNewAsk] = useState({
    name: '',
    discordHandle: '',
    skill: '',
    description: '',
  });

  // Offer form state
  const [newOffer, setNewOffer] = useState({
    name: '',
    discordHandle: '',
    skill: '',
    description: '',
    cost: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [asksRes, offersRes] = await Promise.all([
        fetch('/api/lite/asks').then(r => r.json()),
        fetch('/api/lite/offers').then(r => r.json()),
      ]);

      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      }

      // Compute matches
      computeMatches(asksRes.asks || [], offersRes.offers || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const computeMatches = (asksList: LiteAsk[], offersList: LiteOffer[]) => {
    const matchesList: Match[] = [];
    
    asksList.forEach(ask => {
      offersList.forEach(offer => {
        // Match if same skill/topic (case-insensitive, trimmed) and different Discord handles
        if (
          ask.skill.toLowerCase().trim() === offer.skill.toLowerCase().trim() &&
          ask.discordHandle.toLowerCase() !== offer.discordHandle.toLowerCase()
        ) {
          matchesList.push({ ask, offer });
        }
      });
    });
    
    // Sort by creation date (newest first)
    matchesList.sort((a, b) => {
      const aTime = new Date(a.ask.createdAt).getTime();
      const bTime = new Date(b.ask.createdAt).getTime();
      return bTime - aTime;
    });
    
    setMatches(matchesList);
  };

  const handleCreateAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsk.name.trim() || !newAsk.discordHandle.trim() || !newAsk.skill.trim()) {
      setError('Please fill in all required fields (name, Discord handle, skill/topic)');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/lite/asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAsk.name.trim(),
          discordHandle: newAsk.discordHandle.trim(),
          skill: newAsk.skill.trim(),
          description: newAsk.description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Ask submitted! Transaction is being processed. Please refresh in a moment.');
        } else {
          setSuccess('Ask created successfully!');
        }
        setNewAsk({ name: '', discordHandle: '', skill: '', description: '' });
        setShowCreateAskForm(false);
        // Reload data after a delay
        setTimeout(() => {
          loadData();
        }, 2000);
      } else {
        setError(data.error || 'Failed to create ask');
      }
    } catch (err: any) {
      console.error('Error creating ask:', err);
      setError(err.message || 'Failed to create ask');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.name.trim() || !newOffer.discordHandle.trim() || !newOffer.skill.trim()) {
      setError('Please fill in all required fields (name, Discord handle, skill/topic)');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/lite/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOffer.name.trim(),
          discordHandle: newOffer.discordHandle.trim(),
          skill: newOffer.skill.trim(),
          description: newOffer.description.trim() || undefined,
          cost: newOffer.cost.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        if (data.pending) {
          setSuccess('Offer submitted! Transaction is being processed. Please refresh in a moment.');
        } else {
          setSuccess('Offer created successfully!');
        }
        setNewOffer({ name: '', discordHandle: '', skill: '', description: '', cost: '' });
        setShowCreateOfferForm(false);
        // Reload data after a delay
        setTimeout(() => {
          loadData();
        }, 2000);
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

  const formatTimeRemaining = (createdAt: string, ttlSeconds: number) => {
    const created = new Date(createdAt).getTime();
    const expires = created + (ttlSeconds * 1000);
    const now = Date.now();
    const remaining = expires - now;

    if (remaining <= 0) {
      return 'Expired';
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
        <div className="max-w-4xl mx-auto">
          <LoadingSpinner text="Loading asks and offers..." className="py-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="Lite Ask/Offer Board"
          description="Simple ask and offer board. No login required. All data stored on Arkiv."
        />

        {/* Arkiv Explanation */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            All data you enter here is stored on the Arkiv network. This means it is visible and verifiable on their{' '}
            <a 
              href="http://explorer.mendoza.hoodi.arkiv.network/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              Arkiv explorer
            </a>
            . View our own{' '}
            <a 
              href="/explorer" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              p2pmentor explorer here
            </a>
            {' '}to demonstrate this. Until we implement encrypted data, your data is NOT private.
            <br />
            <a 
              href="http://explorer.mendoza.hoodi.arkiv.network/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              Learn more about Arkiv here
            </a>
            .
          </p>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <Alert type="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}
        {success && (
          <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-4" />
        )}

        {/* Create Ask Section */}
        <div className="mb-8">
          {!showCreateAskForm ? (
            <button
              onClick={() => setShowCreateAskForm(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              📝 Create Ask
            </button>
          ) : (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Create Ask</h2>
              <form onSubmit={handleCreateAsk} className="space-y-4">
                <div>
                  <label htmlFor="ask-name" className="block text-sm font-medium mb-2">
                    Name *
                  </label>
                  <input
                    id="ask-name"
                    type="text"
                    value={newAsk.name}
                    onChange={(e) => setNewAsk({ ...newAsk, name: e.target.value })}
                    maxLength={100}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="ask-discord" className="block text-sm font-medium mb-2">
                    Discord Handle *
                  </label>
                  <input
                    id="ask-discord"
                    type="text"
                    value={newAsk.discordHandle}
                    onChange={(e) => setNewAsk({ ...newAsk, discordHandle: e.target.value })}
                    maxLength={50}
                    required
                    placeholder="username#1234"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="ask-skill" className="block text-sm font-medium mb-2">
                    Skill/Topic *
                  </label>
                  <input
                    id="ask-skill"
                    type="text"
                    value={newAsk.skill}
                    onChange={(e) => setNewAsk({ ...newAsk, skill: e.target.value })}
                    maxLength={200}
                    required
                    placeholder="e.g., TypeScript, React, Machine Learning"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="ask-description" className="block text-sm font-medium mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="ask-description"
                    value={newAsk.description}
                    onChange={(e) => setNewAsk({ ...newAsk, description: e.target.value })}
                    maxLength={1000}
                    rows={4}
                    placeholder="Describe what you want to learn..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Ask'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateAskForm(false);
                      setNewAsk({ name: '', discordHandle: '', skill: '', description: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Create Offer Section */}
        <div className="mb-8">
          {!showCreateOfferForm ? (
            <button
              onClick={() => setShowCreateOfferForm(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              💼 Create Offer
            </button>
          ) : (
            <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Create Offer</h2>
              <form onSubmit={handleCreateOffer} className="space-y-4">
                <div>
                  <label htmlFor="offer-name" className="block text-sm font-medium mb-2">
                    Name *
                  </label>
                  <input
                    id="offer-name"
                    type="text"
                    value={newOffer.name}
                    onChange={(e) => setNewOffer({ ...newOffer, name: e.target.value })}
                    maxLength={100}
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="offer-discord" className="block text-sm font-medium mb-2">
                    Discord Handle *
                  </label>
                  <input
                    id="offer-discord"
                    type="text"
                    value={newOffer.discordHandle}
                    onChange={(e) => setNewOffer({ ...newOffer, discordHandle: e.target.value })}
                    maxLength={50}
                    required
                    placeholder="username#1234"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="offer-skill" className="block text-sm font-medium mb-2">
                    Skill/Topic *
                  </label>
                  <input
                    id="offer-skill"
                    type="text"
                    value={newOffer.skill}
                    onChange={(e) => setNewOffer({ ...newOffer, skill: e.target.value })}
                    maxLength={200}
                    required
                    placeholder="e.g., TypeScript, React, Machine Learning"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="offer-description" className="block text-sm font-medium mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="offer-description"
                    value={newOffer.description}
                    onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                    maxLength={1000}
                    rows={4}
                    placeholder="Describe what you can teach..."
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label htmlFor="offer-cost" className="block text-sm font-medium mb-2">
                    Cost (optional)
                  </label>
                  <input
                    id="offer-cost"
                    type="text"
                    value={newOffer.cost}
                    onChange={(e) => setNewOffer({ ...newOffer, cost: e.target.value })}
                    maxLength={50}
                    placeholder="e.g., $50, 0.1 ETH, Free"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Creating...' : 'Create Offer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateOfferForm(false);
                      setNewOffer({ name: '', discordHandle: '', skill: '', description: '', cost: '' });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Matches Section */}
        {matches.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Matches ({matches.length})</h2>
            <div className="space-y-4">
              {matches.map((match, index) => (
                <div
                  key={`${match.ask.key}-${match.offer.key}`}
                  className="p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {match.ask.skill}
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      Match
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                        📝 Ask
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>{match.ask.name}</strong> ({match.ask.discordHandle})
                      </p>
                      {match.ask.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {match.ask.description}
                        </p>
                      )}
                    </div>
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded">
                      <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-1">
                        💼 Offer
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <strong>{match.offer.name}</strong> ({match.offer.discordHandle})
                      </p>
                      {match.offer.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {match.offer.description}
                        </p>
                      )}
                      {match.offer.cost && (
                        <p className="text-sm font-medium text-green-800 dark:text-green-200 mt-2">
                          💰 Cost: {match.offer.cost}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(match.ask.createdAt)} · {formatTimeRemaining(match.ask.createdAt, match.ask.ttlSeconds)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asks List */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Asks ({asks.length})</h2>
          {asks.length === 0 ? (
            <EmptyState
              title="No asks yet"
              description="Be the first to share what you're learning!"
              icon="📝"
            />
          ) : (
            <div className="space-y-4">
              {asks.map((ask) => (
                <div
                  key={ask.key}
                  className="p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                        {ask.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(ask.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                      {formatTimeRemaining(ask.createdAt, ask.ttlSeconds)}
                    </span>
                  </div>
                  {ask.description && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {ask.description}
                    </p>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{ask.name}</strong> · {ask.discordHandle}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offers List */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Offers ({offers.length})</h2>
          {offers.length === 0 ? (
            <EmptyState
              title="No offers yet"
              description="Be the first to share what you can teach!"
              icon="💼"
            />
          ) : (
            <div className="space-y-4">
              {offers.map((offer) => (
                <div
                  key={offer.key}
                  className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                        {offer.skill}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {formatDate(offer.createdAt)}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                      {formatTimeRemaining(offer.createdAt, offer.ttlSeconds)}
                    </span>
                  </div>
                  {offer.description && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">
                      {offer.description}
                    </p>
                  )}
                  {offer.cost && (
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-3">
                      💰 Cost: {offer.cost}
                    </p>
                  )}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>{offer.name}</strong> · {offer.discordHandle}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

