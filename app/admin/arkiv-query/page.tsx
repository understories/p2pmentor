/**
 * Arkiv Query Tester Admin Page
 * 
 * Interactive tool for testing Arkiv queries with all entity types.
 * Allows inputting parameters and viewing results with explorer links.
 */

'use client';

import { useState } from 'react';
import { getArkivExplorerEntityUrl } from '@/lib/arkiv/explorer';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';

interface QueryResult {
  ok: boolean;
  result: {
    entities: any[];
    count: number;
  } | null;
  error: string | null;
  queryType: string;
  params: any;
}

// Entity type definitions with their parameters
const ENTITY_TYPES = {
  // Core entities
  profile: {
    label: 'User Profile',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: true },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 1 },
    ],
  },
  ask: {
    label: 'Ask',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: false },
      { key: 'skill_id', label: 'Skill ID', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  offer: {
    label: 'Offer',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: false },
      { key: 'skill_id', label: 'Skill ID', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  session: {
    label: 'Session',
    params: [
      { key: 'mentorWallet', label: 'Mentor Wallet', type: 'text', required: false },
      { key: 'learnerWallet', label: 'Learner Wallet', type: 'text', required: false },
      { key: 'sessionKey', label: 'Session Key (for confirmations)', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  feedback: {
    label: 'Session Feedback',
    params: [
      { key: 'sessionKey', label: 'Session Key', type: 'text', required: false },
      { key: 'feedbackTo', label: 'Feedback To (Wallet)', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  availability: {
    label: 'Availability',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  skill: {
    label: 'Skill',
    params: [
      { key: 'status', label: 'Status', type: 'text', required: false, defaultValue: 'active' },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 100 },
    ],
  },
  // Additional entities
  notification: {
    label: 'Notification',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: false },
      { key: 'sourceEntityType', label: 'Source Entity Type', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  'session_confirmation': {
    label: 'Session Confirmation',
    params: [
      { key: 'sessionKey', label: 'Session Key', type: 'text', required: false },
      { key: 'confirmedBy', label: 'Confirmed By (Wallet)', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  'session_rejection': {
    label: 'Session Rejection',
    params: [
      { key: 'sessionKey', label: 'Session Key', type: 'text', required: false },
      { key: 'rejectedBy', label: 'Rejected By (Wallet)', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  'beta-access': {
    label: 'Beta Access',
    params: [
      { key: 'wallet', label: 'Wallet Address', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
  'beta-code': {
    label: 'Beta Code',
    params: [
      { key: 'code', label: 'Code', type: 'text', required: false },
      { key: 'spaceId', label: 'Space ID', type: 'text', required: false, defaultValue: 'beta-launch' },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 10 },
    ],
  },
};

export default function ArkivQueryPage() {
  const [selectedEntityType, setSelectedEntityType] = useState<string>('session');
  const [params, setParams] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);

  const entityConfig = ENTITY_TYPES[selectedEntityType as keyof typeof ENTITY_TYPES];

  const handleParamChange = (key: string, value: string) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleRunQuery = async () => {
    setLoading(true);
    setResult(null);

    try {
      // Build params object, converting numbers and filtering empty strings
      const queryParams: Record<string, any> = {};
      entityConfig.params.forEach((param) => {
        const value = params[param.key] || param.defaultValue || '';
        if (value !== '') {
          if (param.type === 'number') {
            queryParams[param.key] = parseInt(value, 10) || param.defaultValue || 0;
          } else {
            queryParams[param.key] = value;
          }
        }
      });

      const response = await fetch('/api/admin/m1-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queryType: selectedEntityType,
          params: queryParams,
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({
        ok: false,
        result: null,
        error: error.message || 'Failed to run query',
        queryType: selectedEntityType,
        params: {},
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEntityTypeChange = (newType: string) => {
    setSelectedEntityType(newType);
    setParams({});
    setResult(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Arkiv Query Tester
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test Arkiv queries for all entity types. Useful for debugging and finding entities on Arkiv Explorer.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Entity Type
            </label>
            <select
              value={selectedEntityType}
              onChange={(e) => handleEntityTypeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {Object.entries(ENTITY_TYPES).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Query Parameters
            </h3>
            {entityConfig.params.map((param) => (
              <div key={param.key}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {param.label}
                  {param.required && <span className="text-red-500 ml-1">*</span>}
                  {param.defaultValue && (
                    <span className="text-gray-500 dark:text-gray-400 text-xs ml-2">
                      (default: {param.defaultValue})
                    </span>
                  )}
                </label>
                <input
                  type={param.type}
                  value={params[param.key] || param.defaultValue || ''}
                  onChange={(e) => handleParamChange(param.key, e.target.value)}
                  placeholder={param.defaultValue ? `Default: ${param.defaultValue}` : 'Enter value...'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleRunQuery}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {loading ? 'Running Query...' : 'Run Query'}
          </button>
        </div>

        {result && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Query Results
            </h2>

            {result.error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
                <p className="text-red-800 dark:text-red-200 font-medium">Error:</p>
                <p className="text-red-600 dark:text-red-300">{result.error}</p>
              </div>
            ) : result.result ? (
              <div>
                <div className="mb-4">
                  <p className="text-gray-700 dark:text-gray-300">
                    Found <span className="font-semibold">{result.result.count}</span> entity/entities
                  </p>
                </div>

                {result.result.entities.length === 0 ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                    <p className="text-yellow-800 dark:text-yellow-200">
                      No entities found matching the query parameters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {result.result.entities.map((entity, index) => (
                      <div
                        key={entity.key || index}
                        className="border border-gray-200 dark:border-gray-700 rounded-md p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              Entity #{index + 1}
                            </h4>
                            {entity.key && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                Key: {entity.key.slice(0, 20)}...
                              </p>
                            )}
                          </div>
                          {entity.key && (
                            <ViewOnArkivLink
                              entityKey={entity.key}
                              label="View on Arkiv"
                              className="text-sm"
                            />
                          )}
                        </div>

                        <div className="mt-3 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                              Attributes
                            </p>
                            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                              {JSON.stringify(
                                entity.attributes?.reduce((acc: any, attr: any) => {
                                  acc[attr.key] = attr.value;
                                  return acc;
                                }, {}) || {},
                                null,
                                2
                              )}
                            </pre>
                          </div>

                          {entity.payload && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                Payload
                              </p>
                              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                {JSON.stringify(entity.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4">
                <p className="text-gray-600 dark:text-gray-400">No results returned.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

