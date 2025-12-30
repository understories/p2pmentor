/**
 * Record details page
 * 
 * Demonstrates querying a single record by entity key.
 * Shows transaction hash for verification on explorer.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Record {
  key: string;
  title: string;
  description?: string;
  wallet: string;
  createdAt?: string;
  txHash?: string;
}

export default function RecordDetailsPage() {
  const params = useParams();
  const recordId = params.id as string;
  
  const [record, setRecord] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (recordId) {
      loadRecord(recordId);
    }
  }, [recordId]);
  
  const loadRecord = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Query all records and find the one matching this ID
      // In a real app, you might have a direct query by entity key
      const res = await fetch('/api/records');
      const data = await res.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load record');
      }
      
      const records = data.records || [];
      const found = records.find((r: any) => 
        (r.key || r.entityKey || '') === id
      );
      
      if (!found) {
        throw new Error('Record not found');
      }
      
      // Parse record (same logic as list page)
      let payload: any = {};
      try {
        if (found.payload) {
          const decoded = found.payload instanceof Uint8Array
            ? new TextDecoder().decode(found.payload)
            : typeof found.payload === 'string'
            ? found.payload
            : JSON.stringify(found.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding payload:', e);
      }
      
      const attrs = found.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      setRecord({
        key: found.key || found.entityKey || '',
        title: payload.title || getAttr('title') || 'Untitled',
        description: payload.description || getAttr('description') || '',
        wallet: getAttr('wallet') || '',
        createdAt: payload.createdAt || getAttr('created_at') || '',
        txHash: found.txHash || getAttr('txHash') || '',
      });
    } catch (err: any) {
      console.error('[RecordDetailsPage] Error loading record:', err);
      setError(err?.message || 'Failed to load record');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <p>Loading record...</p>
      </div>
    );
  }
  
  if (error || !record) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-red-600">Error: {error || 'Record not found'}</p>
        <Link href="/records" className="mt-4 inline-block text-blue-500">
          ← Back to Records
        </Link>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8">
      <Link href="/records" className="text-blue-500 mb-4 inline-block">
        ← Back to Records
      </Link>
      
      <h1 className="text-3xl font-bold mb-4">{record.title}</h1>
      
      {record.description && (
        <p className="text-gray-700 mb-4">{record.description}</p>
      )}
      
      <div className="mt-6 space-y-2 text-sm">
        <div>
          <span className="font-semibold">Wallet:</span> {record.wallet}
        </div>
        {record.createdAt && (
          <div>
            <span className="font-semibold">Created:</span>{' '}
            {new Date(record.createdAt).toLocaleString()}
          </div>
        )}
        {record.txHash && (
          <div>
            <span className="font-semibold">Transaction:</span>{' '}
            <a
              href={`https://explorer.mendoza.arkiv.network/tx/${record.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {record.txHash.slice(0, 10)}... (view on explorer)
            </a>
          </div>
        )}
        <div>
          <span className="font-semibold">Entity Key:</span>{' '}
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {record.key}
          </code>
        </div>
      </div>
    </div>
  );
}

