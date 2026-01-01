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
  const [showProvenance, setShowProvenance] = useState(false);

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

  // Get human-readable title
  const getHumanTitle = () => {
    if (entity.type === 'profile' && 'displayName' in entity) {
      return (entity as any).displayName || entity.wallet || 'Unknown Profile';
    }
    if (entity.type === 'skill' && 'name_canonical' in entity) {
      return (entity as any).name_canonical || entity.title || 'Unknown Skill';
    }
    if (entity.type === 'ask' && 'message' in entity) {
      const ask = entity as any;
      return entity.title || `Ask: ${ask.skill || ask.skill_label || 'Unknown'}` || 'Unknown Ask';
    }
    if (entity.type === 'offer' && 'message' in entity) {
      const offer = entity as any;
      return entity.title || `Offer: ${offer.skill || offer.skill_label || 'Unknown'}` || 'Unknown Offer';
    }
    return entity.title || entity.key || 'Unknown Entity';
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <BackButton href="/explorer" className="mb-6" />

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
          {/* Type badge - small and subtle */}
          <div className="mb-4">
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {entity.type}
            </span>
          </div>

          {/* Human-readable title - LARGE and PROMINENT */}
          <PageHeader
            title={getHumanTitle()}
            description={entity.summary}
          />

          {/* Entity Details - Show all fields stored on Arkiv */}
          {entity.type === 'profile' && (
            <div className="mt-6 space-y-6">
              {/* Core Identity */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  {(entity as any).displayName && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Display Name</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).displayName}</div>
                    </div>
                  )}
                  {(entity as any).username && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Username</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">@{(entity as any).username}</div>
                    </div>
                  )}
                  {(entity as any).timezone && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Timezone</div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).timezone}</div>
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
              </div>

              {/* Bio Sections */}
              {((entity as any).bio || (entity as any).bioShort || (entity as any).bioLong || (entity as any).exploringStatement) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">About</h3>
                  <div className="space-y-3">
                    {(entity as any).exploringStatement && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Exploring Statement</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).exploringStatement}</div>
                      </div>
                    )}
                    {(entity as any).bioShort && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Short Bio</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).bioShort}</div>
                      </div>
                    )}
                    {(entity as any).bio && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Bio</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).bio}</div>
                      </div>
                    )}
                    {(entity as any).bioLong && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Long Bio</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{(entity as any).bioLong}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Links - Stored on Arkiv, so we show them */}
              {(entity as any).contactLinks && Object.keys((entity as any).contactLinks).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Contact Links</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-3">
                      {(entity as any).contactLinks.twitter && (
                        <a
                          href={`https://twitter.com/${(entity as any).contactLinks.twitter.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                          </svg>
                          Twitter
                        </a>
                      )}
                      {(entity as any).contactLinks.github && (
                        <a
                          href={`https://github.com/${(entity as any).contactLinks.github.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          GitHub
                        </a>
                      )}
                      {(entity as any).contactLinks.telegram && (
                        <a
                          href={`https://t.me/${(entity as any).contactLinks.telegram.replace(/^@/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                          </svg>
                          Telegram
                        </a>
                      )}
                      {(entity as any).contactLinks.discord && (
                        <a
                          href={`https://discord.com/users/${(entity as any).contactLinks.discord}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                          </svg>
                          Discord
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Skills */}
              {(((entity as any).skills || (entity as any).skillsArray || (entity as any).skillExpertise)) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Skills</h3>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    {(entity as any).skillsArray && (entity as any).skillsArray.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Skills List</div>
                        <div className="flex flex-wrap gap-2">
                          {(entity as any).skillsArray.map((skill: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded text-sm">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(entity as any).skills && (
                      <div className="mb-3">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Skills (Legacy)</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).skills}</div>
                      </div>
                    )}
                    {(entity as any).skillExpertise && Object.keys((entity as any).skillExpertise).length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Expertise Levels</div>
                        <div className="space-y-1">
                          {Object.entries((entity as any).skillExpertise).map(([skillId, level]: [string, any]) => (
                            <div key={skillId} className="text-sm text-gray-900 dark:text-gray-100">
                              {skillId}: {level}/5
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Fields */}
              {((entity as any).languages || (entity as any).seniority || (entity as any).domainsOfInterest || (entity as any).mentorRoles || (entity as any).learnerRoles || (entity as any).availabilityWindow) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Additional Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(entity as any).languages && (entity as any).languages.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Languages</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).languages.join(', ')}</div>
                      </div>
                    )}
                    {(entity as any).seniority && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Seniority</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100 capitalize">{(entity as any).seniority}</div>
                      </div>
                    )}
                    {(entity as any).availabilityWindow && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Availability</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).availabilityWindow}</div>
                      </div>
                    )}
                    {(entity as any).domainsOfInterest && (entity as any).domainsOfInterest.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Domains of Interest</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).domainsOfInterest.join(', ')}</div>
                      </div>
                    )}
                    {(entity as any).mentorRoles && (entity as any).mentorRoles.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Mentor Roles</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).mentorRoles.join(', ')}</div>
                      </div>
                    )}
                    {(entity as any).learnerRoles && (entity as any).learnerRoles.length > 0 && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Learner Roles</div>
                        <div className="text-sm text-gray-900 dark:text-gray-100">{(entity as any).learnerRoles.join(', ')}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Non-profile entities - show basic details */}
          {entity.type !== 'profile' && (
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
          )}

          {/* Blockchain Provenance - Collapsible Section at Bottom */}
          {entity.provenance && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-8">
              <button
                onClick={() => setShowProvenance(!showProvenance)}
                className="w-full flex items-center justify-between text-left text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Blockchain Verification
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showProvenance ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showProvenance && (
                <div className="mt-4 space-y-3 text-xs text-gray-500 dark:text-gray-500">
                  <div>
                    <span className="font-medium">Transaction:</span>{' '}
                    <a
                      href={entity.provenance.explorerTxUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {entity.provenance.txHash.slice(0, 20)}...
                    </a>
                  </div>
                  {entity.provenance.blockNumber && (
                    <div>
                      <span className="font-medium">Block:</span> {entity.provenance.blockNumber}
                    </div>
                  )}
                  {entity.provenance.blockTimestamp && (
                    <div>
                      <span className="font-medium">Timestamp:</span>{' '}
                      {new Date(entity.provenance.blockTimestamp * 1000).toLocaleString()}
                    </div>
                  )}
                  {entity.provenance.status && (
                    <div>
                      <span className="font-medium">Status:</span>{' '}
                      <span className={entity.provenance.status === 'success' ? 'text-green-600 dark:text-green-400' : ''}>
                        {entity.provenance.status}
                      </span>
                    </div>
                  )}
                </div>
              )}
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

