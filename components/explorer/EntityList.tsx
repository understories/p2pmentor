/**
 * Entity List Component
 * 
 * Displays paginated list of entities with search and filtering.
 */

'use client';

import { useEffect, useState } from 'react';
import { EntityCard } from './EntityCard';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntitiesResponse {
  ok: boolean;
  entities: (PublicEntity & { provenance?: any })[];
  nextCursor: string | null;
  generatedAt: string;
}

export function EntityList() {
  const [entities, setEntities] = useState<(PublicEntity & { provenance?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>('all');
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

  useEffect(() => {
    fetchEntities(null, true);
  }, [type, search]);

  const loadMore = () => {
    if (nextCursor && !loading) {
      fetchEntities(nextCursor, false);
    }
  };

  return (
    <div className="mb-8">
      {/* Search and Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by wallet, key, tx hash, or content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="all">All Types</option>
          <option value="profile">Profiles</option>
          <option value="ask">Asks</option>
          <option value="offer">Offers</option>
          <option value="skill">Skills</option>
        </select>
      </div>

      {/* Entity Cards */}
      <div className="space-y-4">
        {entities.map((entity) => (
          <EntityCard key={entity.key} entity={entity} />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {entities.length === 0 && !loading && (
        <div className="text-center text-gray-500 py-8">No entities found.</div>
      )}
    </div>
  );
}

