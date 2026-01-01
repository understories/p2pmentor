/**
 * Entity Detail Page
 * 
 * Shows detailed view of a single entity with provenance.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PublicEntity } from '@/lib/explorer/types';

interface EntityResponse {
  ok: boolean;
  entity: PublicEntity & { provenance?: any };
  error?: string;
}

export default function EntityDetailPage() {
  const params = useParams();
  const router = useRouter();
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
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">Loading...</div>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-red-600">{error || 'Entity not found'}</p>
          <Link href="/explorer" className="text-blue-600 hover:underline mt-4 inline-block">
            Back to Explorer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/explorer"
          className="text-blue-600 hover:underline mb-6 inline-block"
        >
          ← Back to Explorer
        </Link>

        <div className="bg-white dark:bg-gray-800 border rounded-lg p-6 dark:border-gray-700">
          <div className="mb-4">
            <span className="px-2 py-1 text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {entity.type}
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-4">{entity.title || entity.key}</h1>

          {entity.summary && (
            <p className="text-gray-600 dark:text-gray-400 mb-6">{entity.summary}</p>
          )}

          <div className="space-y-4 mb-6">
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

