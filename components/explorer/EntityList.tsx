/**
 * Entity List Component
 * 
 * Displays paginated list of entities with search and filtering.
 */

'use client';

import { useEffect, useState } from 'react';
import { EntityCard } from './EntityCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntitiesResponse {
  ok: boolean;
  entities: (PublicEntity & { provenance?: any })[];
  nextCursor: string | null;
  generatedAt: string;
}

interface EntityListProps {
  spaceId?: string;
  onSpaceIdChange?: (spaceId: string) => void;
}

export function EntityList({ spaceId: propSpaceId, onSpaceIdChange }: EntityListProps = {} as EntityListProps) {
  const [entities, setEntities] = useState<(PublicEntity & { provenance?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>('all');
  const [spaceId, setSpaceId] = useState<string>(propSpaceId || 'all');
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchEntities = async (cursor?: string | null, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        limit: '25',
        includeProvenance: 'true',
      });
      if (search) {
        params.set('q', search);
      }
      if (spaceId && spaceId !== 'all') {
        params.set('spaceId', spaceId);
      }
      if (cursor) {
        params.set('cursor', cursor);
      }

      const res = await fetch(`/api/explorer/entities?${params}`);
      const data: EntitiesResponse = await res.json();

      if (data.ok) {
        if (reset) {
          setEntities(data.entities);
        } else {
          setEntities((prev) => [...prev, ...data.entities]);
        }
        setNextCursor(data.nextCursor);
        setHasMore(!!data.nextCursor);
      }
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync with prop if provided
  useEffect(() => {
    if (propSpaceId !== undefined) {
      setSpaceId(propSpaceId);
    }
  }, [propSpaceId]);

  const handleSpaceIdChange = (newSpaceId: string) => {
    setSpaceId(newSpaceId);
    if (onSpaceIdChange) {
      onSpaceIdChange(newSpaceId);
    }
  };

  useEffect(() => {
    fetchEntities(null, true);
  }, [type, spaceId, search]);

  const loadMore = () => {
    if (nextCursor && !loading) {
      fetchEntities(nextCursor, false);
    }
  };

  return (
    <div className="mb-8">
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search by wallet, key, tx hash, or content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all"
        >
          <option value="all">All Types</option>
          <option value="profile">Profiles</option>
          <option value="ask">Asks</option>
          <option value="offer">Offers</option>
          <option value="skill">Skills</option>
        </select>
        <select
          value={spaceId}
          onChange={(e) => handleSpaceIdChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:shadow-sm transition-all"
        >
          <option value="all">All Spaces</option>
          <option value="beta-launch">Beta Launch</option>
          <option value="local-dev">Local Dev</option>
          <option value="local-dev-seed">Local Dev Seed</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && entities.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                    <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entity Cards */}
      {!loading && entities.length > 0 && (
        <div className="space-y-4">
          {entities.map((entity) => (
            <EntityCard key={entity.key} entity={entity} />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && entities.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Empty State */}
      {entities.length === 0 && !loading && (
        <EmptyState
          icon={search || type !== 'all' ? '🔍' : '📭'}
          title={search || type !== 'all' ? 'No entities found' : 'No entities available'}
          description={
            search
              ? `No entities match "${search}". Try a different search term or clear the filter.`
              : type !== 'all'
              ? `No ${type} entities are available. Try selecting "All Types" or a different type.`
              : 'No entities are available at this time. Check back later or create some content!'
          }
        />
      )}
    </div>
  );
}

