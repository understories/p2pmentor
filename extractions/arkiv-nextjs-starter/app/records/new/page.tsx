/**
 * Create record page
 * 
 * Demonstrates optimistic UI with reconciliation.
 * Follows PAT-OPTIMISTIC-001 (Optimistic UI + Reconciliation).
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateRecordPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !wallet) {
      setError('Title and wallet are required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          wallet,
        }),
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        // Handle submitted_or_pending status (indexer lag is normal)
        if (data.status === 'submitted_or_pending') {
          setSubmitted(true);
          setTxHash(data.txHash || null);
          // Show message that record is pending indexing
          setTimeout(() => {
            router.push('/records');
          }, 2000);
          return;
        }
        throw new Error(data.error || 'Failed to create record');
      }
      
      // Success - record submitted (may not be indexed yet)
      setSubmitted(true);
      setTxHash(data.txHash || null);
      
      // Redirect after a moment (gives indexer time)
      setTimeout(() => {
        router.push('/records');
      }, 2000);
      
    } catch (err: any) {
      console.error('[CreateRecordPage] Error creating record:', err);
      setError(err?.message || 'Failed to create record');
    } finally {
      setLoading(false);
    }
  };
  
  if (submitted) {
    return (
      <div className="container mx-auto p-8">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">Record Created</h1>
          <p className="text-green-600 mb-4">
            Your record has been submitted to Arkiv.
          </p>
          {txHash && (
            <p className="text-sm text-gray-600 mb-4">
              Transaction: {txHash.slice(0, 10)}...
              <br />
              <span className="text-xs">
                It may take a moment to appear in the list (indexer lag is normal).
              </span>
            </p>
          )}
          <p className="text-sm text-gray-500">
            Redirecting to records list...
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Create Record</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wallet" className="block text-sm font-medium mb-1">
              Wallet Address *
            </label>
            <input
              id="wallet"
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              required
              className="w-full px-3 py-2 border rounded"
            />
            <p className="text-xs text-gray-500 mt-1">
              Will be normalized to lowercase automatically
            </p>
          </div>
          
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Record'}
          </button>
        </form>
      </div>
    </div>
  );
}

