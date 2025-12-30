/**
 * Records list page
 * 
 * Demonstrates Arkiv read path with optimistic UI.
 * Follows PAT-OPTIMISTIC-001 (Optimistic UI + Reconciliation).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Record {
  key: string;
  title: string;
  description?: string;
  wallet: string;
  createdAt?: string;
  txHash?: string;
}

export default function RecordsPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load records on mount
  useEffect(() => {
    loadRecords();
  }, []);
  
  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch('/api/records');
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load records');
      }
      
      // Parse records from entities
      const parsedRecords: Record[] = (data.records || []).map((entity: any) => {
        let payload: any = {};
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            payload = JSON.parse(decoded);
          }
        } catch (e) {
          console.error('Error decoding payload:', e);
        }
        
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        
        return {
          key: entity.key || entity.entityKey || '',
          title: payload.title || getAttr('title') || 'Untitled',
          description: payload.description || getAttr('description') || '',
          wallet: getAttr('wallet') || '',
          createdAt: payload.createdAt || getAttr('created_at') || '',
          txHash: entity.txHash || getAttr('txHash') || '',
        };
      });
      
      setRecords(parsedRecords);
    } catch (err: any) {
      console.error('[RecordsPage] Error loading records:', err);
      setError(err?.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Records</h1>
        <p>Loading records...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Records</h1>
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={loadRecords}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Records</h1>
        <Link
          href="/records/new"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create Record
        </Link>
      </div>
      
      {records.length === 0 ? (
        <p className="text-gray-500">No records found. Create your first record!</p>
      ) : (
        <div className="space-y-4">
          {records.map((record) => (
            <Link
              key={record.key}
              href={`/records/${record.key}`}
              className="block p-4 border rounded hover:bg-gray-50"
            >
              <h2 className="text-xl font-semibold">{record.title}</h2>
              {record.description && (
                <p className="text-gray-600 mt-2">{record.description}</p>
              )}
              <div className="mt-2 text-sm text-gray-500">
                <span>Wallet: {record.wallet.slice(0, 10)}...</span>
                {record.createdAt && (
                  <span className="ml-4">
                    Created: {new Date(record.createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

