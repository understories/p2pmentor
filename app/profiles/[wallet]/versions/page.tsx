/**
 * Profile Version History Page
 *
 * Displays all versions/edits of a profile entity, showing:
 * - Entity key and transaction hash for each version
 * - Timestamp of when each version was created/updated
 * - Entity data (displayName, username, bio, skills, etc.)
 * - Links to Arkiv Explorer for each version
 *
 * Follows engineering guidelines: Arkiv-native queries, proper error handling,
 * wallet normalization, real data only.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BackButton } from '@/components/BackButton';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';

interface ProfileVersion {
  version: number;
  isCurrent: boolean;
  entityKey: string;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  username?: string;
  bioShort?: string;
  skills: string[];
  languages: string[];
  explorerUrl: string;
  txExplorerUrl: string | null;
}

export default function ProfileVersionsPage() {
  const params = useParams();
  const walletParam = params.wallet as string;

  // Normalize wallet
  let wallet = walletParam ? walletParam.trim().toLowerCase() : '';

  const [versions, setVersions] = useState<ProfileVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!wallet) {
      setError('Wallet address required');
      setLoading(false);
      return;
    }

    const loadVersions = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(`/api/profiles/${wallet}/versions`);
        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to load version history');
        }

        setVersions(data.versions || []);
      } catch (err: any) {
        console.error('Error loading version history:', err);
        setError(err.message || 'Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    loadVersions();
  }, [wallet]);

  const shortenWallet = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <BackButton />
          <div className="mt-8 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-4xl">
          <BackButton />
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-4xl">
        <BackButton />

        <div className="mb-6 mt-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-50">
            Profile Version History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            All versions of profile for wallet:{' '}
            <span className="font-mono text-sm">{shortenWallet(wallet)}</span>
          </p>
          <Link
            href={`/profiles/${wallet}`}
            className="mt-2 inline-block text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Back to profile
          </Link>
        </div>

        {versions.length === 0 ? (
          <div className="rounded-lg bg-gray-50 p-8 text-center dark:bg-gray-800">
            <p className="text-gray-600 dark:text-gray-400">No version history found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.entityKey}
                className={`rounded-lg border p-6 ${
                  version.isCurrent
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Version {version.version}
                      </h3>
                      {version.isCurrent && (
                        <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {version.txHash && (
                      <a
                        href={version.txExplorerUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        title="View transaction on Arkiv Explorer"
                      >
                        TX: {version.txHash.slice(0, 10)}...
                      </a>
                    )}
                    <ViewOnArkivLink
                      entityKey={version.entityKey}
                      txHash={version.txHash || undefined}
                      label="View Entity"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Display Name</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {version.displayName || '(not set)'}
                    </p>
                  </div>

                  {version.username && (
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Username</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        @{version.username}
                      </p>
                    </div>
                  )}

                  {version.bioShort && (
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Bio</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{version.bioShort}</p>
                    </div>
                  )}

                  {version.skills.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Skills</p>
                      <div className="flex flex-wrap gap-2">
                        {version.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {version.languages.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Languages</p>
                      <div className="flex flex-wrap gap-2">
                        {version.languages.map((lang, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                    <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Entity Key</p>
                    <p className="break-all font-mono text-xs text-gray-600 dark:text-gray-400">
                      {version.entityKey}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Note:</strong> All profile versions are preserved on-chain. Each version
            represents a transaction that created or updated the profile entity. The current version
            is the most recent update to the canonical profile entity.
          </p>
        </div>
      </div>
    </main>
  );
}
