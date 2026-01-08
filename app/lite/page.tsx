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
import { EntityDataToggle } from '@/components/lite/EntityDataToggle';
import type { LiteAsk } from '@/lib/arkiv/liteAsks';
import type { LiteOffer } from '@/lib/arkiv/liteOffers';
import type { SpaceIdMetadata } from '@/lib/arkiv/liteSpaceIds';

interface Match {
  ask: LiteAsk;
  offer: LiteOffer;
}

export default function LitePage() {
  const [spaceId, setSpaceId] = useState<string>('nsjan26'); // Default spaceId
  const [availableSpaceIds, setAvailableSpaceIds] = useState<string[]>(['nsjan26', 'test']); // Available space IDs (for backward compatibility)
  const [spaceIdMetadata, setSpaceIdMetadata] = useState<SpaceIdMetadata[]>([]); // Space IDs with metadata
  const [spaceIdFilter, setSpaceIdFilter] = useState<'all' | 'p2pmentor' | 'network'>('all');
  const [showCreateNewSpaceId, setShowCreateNewSpaceId] = useState(false);
  const [newSpaceIdInput, setNewSpaceIdInput] = useState('');
  const [asks, setAsks] = useState<LiteAsk[]>([]);
  const [offers, setOffers] = useState<LiteOffer[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [polling, setPolling] = useState(false);
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
  }, [spaceId]); // Reload data when spaceId changes

  // Load available space IDs from network and localStorage on mount
  useEffect(() => {
    const loadSpaceIds = async () => {
      if (typeof window === 'undefined') return;

      // Load from localStorage first (for immediate UI update)
      let localStorageSpaceIds: string[] = [];
      try {
        const saved = localStorage.getItem('lite_space_ids');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorageSpaceIds = parsed;
          }
        }
      } catch (err) {
        console.error('Error loading space IDs from localStorage:', err);
      }

      // Fetch space IDs with metadata from network (source of truth)
      let networkMetadata: SpaceIdMetadata[] = [];
      try {
        const res = await fetch(`/api/lite/space-ids?filter=${spaceIdFilter}`);
        const data = await res.json();
        if (data.ok && Array.isArray(data.spaceIds)) {
          // Check if it's the new format (with metadata) or old format (simple array)
          if (data.spaceIds.length > 0 && typeof data.spaceIds[0] === 'object' && 'spaceId' in data.spaceIds[0]) {
            networkMetadata = data.spaceIds as SpaceIdMetadata[];
          } else {
            // Old format: convert to metadata format
            networkMetadata = (data.spaceIds as string[]).map(id => ({
              spaceId: id,
              askCount: 0,
              offerCount: 0,
              totalEntities: 0,
              mostRecentActivity: new Date().toISOString(),
              isP2pmentorSpace: false,
              hasActiveEntities: false,
            }));
          }
        }
      } catch (err) {
        console.error('Error fetching space IDs from network:', err);
        // Fallback to localStorage if network fails
        networkMetadata = localStorageSpaceIds.map(id => ({
          spaceId: id,
          askCount: 0,
          offerCount: 0,
          totalEntities: 0,
          mostRecentActivity: new Date().toISOString(),
          isP2pmentorSpace: false,
          hasActiveEntities: false,
        }));
      }

      // Merge: network space IDs (source of truth) + localStorage space IDs (cache) + current spaceId
      const mergedMap = new Map<string, SpaceIdMetadata>();

      // Add network space IDs first (source of truth)
      networkMetadata.forEach(meta => mergedMap.set(meta.spaceId, meta));

      // Add localStorage space IDs (may have user-created IDs not yet in network)
      localStorageSpaceIds.forEach(id => {
        if (!mergedMap.has(id)) {
          mergedMap.set(id, {
            spaceId: id,
            askCount: 0,
            offerCount: 0,
            totalEntities: 0,
            mostRecentActivity: new Date().toISOString(),
            isP2pmentorSpace: false,
            hasActiveEntities: false,
          });
        }
      });

      // Ensure current spaceId is included
      if (spaceId && !mergedMap.has(spaceId)) {
        mergedMap.set(spaceId, {
          spaceId,
          askCount: 0,
          offerCount: 0,
          totalEntities: 0,
          mostRecentActivity: new Date().toISOString(),
          isP2pmentorSpace: false,
          hasActiveEntities: false,
        });
      }

      // Convert to sorted array (already sorted by relevance from API)
      const mergedArray = Array.from(mergedMap.values());

      // Update state
      setSpaceIdMetadata(mergedArray);
      setAvailableSpaceIds(mergedArray.map(m => m.spaceId));

      // Update localStorage with merged list (cache for next load)
      localStorage.setItem('lite_space_ids', JSON.stringify(mergedArray.map(m => m.spaceId)));
    };

    loadSpaceIds();
  }, [spaceIdFilter]); // Reload when filter changes

  // Save available space IDs to localStorage whenever they change (cache update)
  useEffect(() => {
    if (typeof window !== 'undefined' && availableSpaceIds.length > 0) {
      localStorage.setItem('lite_space_ids', JSON.stringify(availableSpaceIds));
    }
  }, [availableSpaceIds]);

  // Recompute matches whenever asks or offers change
  useEffect(() => {
    if (asks.length > 0 || offers.length > 0) {
      computeMatches(asks, offers);
    } else {
      setMatches([]);
    }
  }, [asks, offers]);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [asksRes, offersRes] = await Promise.all([
        fetch(`/api/lite/asks?spaceId=${encodeURIComponent(spaceId)}`).then(r => r.json()),
        fetch(`/api/lite/offers?spaceId=${encodeURIComponent(spaceId)}`).then(r => r.json()),
      ]);

      if (asksRes.ok) {
        setAsks(asksRes.asks || []);
      }
      if (offersRes.ok) {
        setOffers(offersRes.offers || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Refresh space IDs from network (called after creating asks/offers)
  const refreshSpaceIds = async () => {
    try {
      const res = await fetch(`/api/lite/space-ids?filter=${spaceIdFilter}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.spaceIds)) {
        // Check if it's the new format (with metadata) or old format (simple array)
        let networkMetadata: SpaceIdMetadata[];
        if (data.spaceIds.length > 0 && typeof data.spaceIds[0] === 'object' && 'spaceId' in data.spaceIds[0]) {
          networkMetadata = data.spaceIds as SpaceIdMetadata[];
        } else {
          // Old format: convert to metadata format
          networkMetadata = (data.spaceIds as string[]).map(id => ({
            spaceId: id,
            askCount: 0,
            offerCount: 0,
            totalEntities: 0,
            mostRecentActivity: new Date().toISOString(),
            isP2pmentorSpace: false,
            hasActiveEntities: false,
          }));
        }

        // Merge with current space IDs
        const mergedMap = new Map<string, SpaceIdMetadata>();
        spaceIdMetadata.forEach(meta => mergedMap.set(meta.spaceId, meta));
        networkMetadata.forEach(meta => mergedMap.set(meta.spaceId, meta));

        // Ensure current spaceId is included
        if (spaceId && !mergedMap.has(spaceId)) {
          mergedMap.set(spaceId, {
            spaceId,
            askCount: 0,
            offerCount: 0,
            totalEntities: 0,
            mostRecentActivity: new Date().toISOString(),
            isP2pmentorSpace: false,
            hasActiveEntities: false,
          });
        }

        const merged = Array.from(mergedMap.values());
        setSpaceIdMetadata(merged);
        setAvailableSpaceIds(merged.map(m => m.spaceId));

        if (typeof window !== 'undefined') {
          localStorage.setItem('lite_space_ids', JSON.stringify(merged.map(m => m.spaceId)));
        }
      }
    } catch (err) {
      console.error('Error refreshing space IDs:', err);
      // Silently fail - not critical
    }
  };

  // Poll for new data after creation (waits for blockchain indexing)
  const pollForNewData = async (
    checkFn: (asks: LiteAsk[], offers: LiteOffer[]) => boolean,
    maxAttempts = 10,
    initialDelay = 2000
  ) => {
    setPolling(true);
    let attempt = 0;

    while (attempt < maxAttempts) {
      // Wait before checking (exponential backoff)
      if (attempt > 0) {
        const delay = initialDelay * Math.pow(1.5, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Load data without showing full loading state
      try {
        const [asksRes, offersRes] = await Promise.all([
          fetch(`/api/lite/asks?spaceId=${encodeURIComponent(spaceId)}`).then(r => r.json()),
          fetch(`/api/lite/offers?spaceId=${encodeURIComponent(spaceId)}`).then(r => r.json()),
        ]);

        const currentAsks = asksRes.ok ? (asksRes.asks || []) : [];
        const currentOffers = offersRes.ok ? (offersRes.offers || []) : [];

        // Update state
        setAsks(currentAsks);
        setOffers(currentOffers);

        // Check if new data appeared
        if (checkFn(currentAsks, currentOffers)) {
          setPolling(false);
          return true;
        }
      } catch (err) {
        console.error('Error polling for data:', err);
      }

      attempt++;
    }

    setPolling(false);
    return false;
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

  const handleCreateNewSpaceId = () => {
    if (!newSpaceIdInput.trim()) {
      setError('Please enter a space ID');
      return;
    }

    const trimmedSpaceId = newSpaceIdInput.trim();

    // Check if it already exists
    if (availableSpaceIds.includes(trimmedSpaceId)) {
      setError('This space ID already exists');
      setShowCreateNewSpaceId(false);
      setSpaceId(trimmedSpaceId); // Switch to existing space ID
      setNewSpaceIdInput('');
      return;
    }

    // Add to available space IDs
    const updated = [...availableSpaceIds, trimmedSpaceId];
    setAvailableSpaceIds(updated);

    // Set as current space ID (this will trigger useEffect to reload data)
    setSpaceId(trimmedSpaceId);

    // Reset create new UI
    setShowCreateNewSpaceId(false);
    setNewSpaceIdInput('');
    setError('');
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
          spaceId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const submittedName = newAsk.name.trim();
        const submittedSkill = newAsk.skill.trim();
        const submittedDiscordHandle = newAsk.discordHandle.trim();

        setNewAsk({ name: '', discordHandle: '', skill: '', description: '' });
        setShowCreateAskForm(false);

        if (data.pending) {
          setSuccess('Ask submitted! Waiting for transaction to be indexed...');
        } else {
          setSuccess('Ask created successfully! Waiting for it to appear...');
        }

        // Poll for the new ask to appear
        const found = await pollForNewData((currentAsks, currentOffers) => {
          return currentAsks.some(
            ask =>
              ask.name === submittedName &&
              ask.skill === submittedSkill &&
              ask.discordHandle === submittedDiscordHandle
          );
        });

        if (found) {
          setSuccess('Ask created successfully!');
          // Refresh space IDs to ensure new space IDs appear in the list
          await refreshSpaceIds();
        } else {
          setSuccess('Ask created! It may take a moment to appear. Refresh if needed.');
          // Still refresh space IDs even if not found yet (may appear later)
          await refreshSpaceIds();
        }
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
          spaceId: spaceId,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        const submittedName = newOffer.name.trim();
        const submittedSkill = newOffer.skill.trim();
        const submittedDiscordHandle = newOffer.discordHandle.trim();

        setNewOffer({ name: '', discordHandle: '', skill: '', description: '', cost: '' });
        setShowCreateOfferForm(false);

        if (data.pending) {
          setSuccess('Offer submitted! Waiting for transaction to be indexed...');
        } else {
          setSuccess('Offer created successfully! Waiting for it to appear...');
        }

        // Poll for the new offer to appear
        const found = await pollForNewData((currentAsks, currentOffers) => {
          return currentOffers.some(
            offer =>
              offer.name === submittedName &&
              offer.skill === submittedSkill &&
              offer.discordHandle === submittedDiscordHandle
          );
        });

        if (found) {
          setSuccess('Offer created successfully!');
          // Refresh space IDs to ensure new space IDs appear in the list
          await refreshSpaceIds();
        } else {
          setSuccess('Offer created! It may take a moment to appear. Refresh if needed.');
          // Still refresh space IDs even if not found yet (may appear later)
          await refreshSpaceIds();
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
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4 backdrop-blur-sm pb-24 md:pb-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Mentorship Matching: Ask & Offer Board"
            description="We all have something to teach and something to learn. Meet your match(es) with this simple ask and offer board."
          />
          <LoadingSpinner text="Loading asks and offers..." className="py-12" />
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4 backdrop-blur-sm pb-24 md:pb-4">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            title="Mentorship Matching: Ask & Offer Board"
            description="We all have something to teach and something to learn. Meet your match(es) with this simple ask and offer board."
          />

        {/* Space ID Selector */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="spaceId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Space ID
            </label>
            <select
              value={spaceIdFilter}
              onChange={(e) => {
                const filter = e.target.value as 'all' | 'p2pmentor' | 'network';
                setSpaceIdFilter(filter);
                // Reload space IDs with filter
                const loadFiltered = async () => {
                  try {
                    const res = await fetch(`/api/lite/space-ids?filter=${filter}`);
                    const data = await res.json();
                    if (data.ok && Array.isArray(data.spaceIds)) {
                      let networkMetadata: SpaceIdMetadata[];
                      if (data.spaceIds.length > 0 && typeof data.spaceIds[0] === 'object' && 'spaceId' in data.spaceIds[0]) {
                        networkMetadata = data.spaceIds as SpaceIdMetadata[];
                      } else {
                        networkMetadata = (data.spaceIds as string[]).map(id => ({
                          spaceId: id,
                          askCount: 0,
                          offerCount: 0,
                          totalEntities: 0,
                          mostRecentActivity: new Date().toISOString(),
                          isP2pmentorSpace: false,
                          hasActiveEntities: false,
                        }));
                      }
                      setSpaceIdMetadata(networkMetadata);
                      setAvailableSpaceIds(networkMetadata.map(m => m.spaceId));
                    }
                  } catch (err) {
                    console.error('Error loading filtered space IDs:', err);
                  }
                };
                loadFiltered();
              }}
              className="px-3 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Spaces</option>
              <option value="p2pmentor">p2pmentor Spaces</option>
              <option value="network">Arkiv Network Spaces</option>
            </select>
          </div>
          <select
            id="spaceId"
            value={showCreateNewSpaceId ? 'create-new' : spaceId}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'create-new') {
                setShowCreateNewSpaceId(true);
                setNewSpaceIdInput('');
              } else {
                setShowCreateNewSpaceId(false);
                setSpaceId(value);
              }
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {availableSpaceIds.map((id) => {
              const metadata = spaceIdMetadata.find(m => m.spaceId === id);
              const displayText = metadata && metadata.totalEntities > 0
                ? `${id} (${metadata.totalEntities} ${metadata.totalEntities === 1 ? 'entity' : 'entities'})`
                : id;
              return (
                <option key={id} value={id}>
                  {displayText}
                </option>
              );
            })}
            <option value="create-new">Create new</option>
          </select>

          {showCreateNewSpaceId && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newSpaceIdInput}
                onChange={(e) => setNewSpaceIdInput(e.target.value.trim())}
                placeholder="Enter new space ID"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSpaceIdInput) {
                    handleCreateNewSpaceId();
                  }
                }}
              />
              <button
                onClick={handleCreateNewSpaceId}
                disabled={!newSpaceIdInput}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                Create
              </button>
            </div>
          )}

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Select a space ID for data isolation. Changing this will reload all data.
          </p>
        </div>

        {/* Arkiv Explanation */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            All data you enter here is stored on the Arkiv network for 30 days.
            <br />
            This means it is visible and verifiable on their{' '}
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
            {' '}to demonstrate this. <strong>In other words, your data is not private.</strong>
            <br />
            <a
              href="https://p2pmentor.com/docs/user-flows/lite-version"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline"
            >
              Learn more about the Lite Version here
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
        {polling && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm">
              <LoadingSpinner text="" className="py-0" />
              <span>Waiting for transaction to be indexed on the blockchain...</span>
            </div>
          </div>
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
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {match.ask.skill}
                      </h3>
                    </div>
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                          {ask.skill}
                        </h3>
                        <EntityDataToggle entityKey={ask.key} txHash={ask.txHash} />
                      </div>
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {offer.skill}
                        </h3>
                        <EntityDataToggle entityKey={offer.key} txHash={offer.txHash} />
                      </div>
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

