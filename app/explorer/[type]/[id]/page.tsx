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

          {/* Entity Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-6">
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Entity Key</div>
              <code className="text-sm text-gray-900 dark:text-gray-100 break-all">{entity.key}</code>
            </div>
            {entity.wallet && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Wallet Address</div>
                <code className="text-sm text-gray-900 dark:text-gray-100 break-all">{entity.wallet}</code>
              </div>
            )}
            {entity.createdAt && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Created</div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {new Date(entity.createdAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Provenance Section */}
          {entity.provenance && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Provenance
              </h2>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Transaction Hash</div>
                  <a
                    href={entity.provenance.explorerTxUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-green-700 dark:text-green-300 hover:text-green-800 dark:hover:text-green-200 hover:underline break-all"
                  >
                    <code>{entity.provenance.txHash}</code>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                {entity.provenance.blockNumber && (
                  <div>
                    <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Block Number</div>
                    <div className="text-sm text-green-800 dark:text-green-200 font-mono">{entity.provenance.blockNumber}</div>
                  </div>
                )}
                {entity.provenance.blockTimestamp && (
                  <div>
                    <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Block Timestamp</div>
                    <div className="text-sm text-green-800 dark:text-green-200">
                      {new Date(entity.provenance.blockTimestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                )}
                {entity.provenance.status && (
                  <div>
                    <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">Status</div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      entity.provenance.status === 'success'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                        : entity.provenance.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                    }`}>
                      {entity.provenance.status}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raw JSON (Collapsible) */}
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 mb-2 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 -mx-2">
                <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Raw JSON Data
              </summary>
              <pre className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg text-xs overflow-auto mt-2 font-mono">
                {JSON.stringify(entity, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

