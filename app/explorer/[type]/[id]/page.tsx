/**
 * Entity Detail Page
 * 
 * Shows detailed view of a single entity with provenance.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { PageHeader } from '@/components/PageHeader';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntityResponse {
  ok: boolean;
  entity: PublicEntity & { provenance?: any };
  error?: string;
}

export default function EntityDetailPage() {
  const params = useParams();
  const type = params.type as string;
  const id = params.id as string;
  const [entity, setEntity] = useState<(PublicEntity & { provenance?: any }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;

    const fetchEntity = async () => {
      setLoading(true);
      try {
        const endpoint =
          type === 'profile'
            ? `/api/explorer/profile/${id}`
            : `/api/explorer/${type}/${id}`;
        const res = await fetch(endpoint);
        const data: EntityResponse = await res.json();

        if (data.ok) {
          setEntity(data.entity);
        } else {
          setError(data.error || 'Entity not found');
        }
      } catch (err) {
        setError('Failed to fetch entity');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEntity();
  }, [type, id]);

  if (loading) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/explorer" className="mb-6" />
          <LoadingSpinner text="Loading entity..." />
        </div>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <BackButton href="/explorer" className="mb-6" />
          <EmptyState
            icon="⚠️"
            title={error || 'Entity not found'}
            description="The entity you're looking for doesn't exist or couldn't be loaded."
            action={<BackButton href="/explorer" label="Back to Explorer" />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton href="/explorer" className="mb-6" />

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
          <div className="mb-6">
            <span className="px-3 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
              {entity.type}
            </span>
          </div>

          <PageHeader
            title={entity.title || entity.key}
            description={entity.summary}
          />

          <div className="space-y-4 mb-6 mt-6">
            <div>
              <strong>Key:</strong> <code className="text-sm">{entity.key}</code>
            </div>
            {entity.wallet && (
              <div>
                <strong>Wallet:</strong> <code className="text-sm">{entity.wallet}</code>
              </div>
            )}
            {entity.createdAt && (
              <div>
                <strong>Created:</strong>{' '}
                {new Date(entity.createdAt).toLocaleString()}
              </div>
            )}
          </div>

          {entity.provenance && (
            <div className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Provenance</h2>
              <div className="space-y-2">
                <div>
                  <strong>Transaction Hash:</strong>{' '}
                  <a
                    href={entity.provenance.explorerTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {entity.provenance.txHash}
                  </a>
                </div>
                {entity.provenance.blockNumber && (
                  <div>
                    <strong>Block Number:</strong> {entity.provenance.blockNumber}
                  </div>
                )}
                {entity.provenance.blockTimestamp && (
                  <div>
                    <strong>Block Timestamp:</strong>{' '}
                    {new Date(entity.provenance.blockTimestamp * 1000).toLocaleString()}
                  </div>
                )}
                {entity.provenance.status && (
                  <div>
                    <strong>Status:</strong> {entity.provenance.status}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6">
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded text-xs overflow-auto">
              {JSON.stringify(entity, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

