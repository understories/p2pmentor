/**
 * Hash Generator Component
 *
 * Interactive component for generating SHA-256 hashes from user input.
 * Used in cryptography quest steps to demonstrate hashing.
 *
 * Security: All operations are client-side only (never sent to server)
 */

'use client';

import { useState } from 'react';

interface HashGeneratorProps {
  onHashGenerated?: (hash: string, input: string) => void;
  minHashes?: number;
}

export function HashGenerator({ onHashGenerated, minHashes = 1 }: HashGeneratorProps) {
  const [input, setInput] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [generatedHashes, setGeneratedHashes] = useState<Array<{ input: string; hash: string }>>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateHash = async (text: string) => {
    if (!text.trim()) return;

    setIsGenerating(true);
    try {
      // Use Web Crypto API for SHA-256 hashing
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      
      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setHash(hashHex);
      
      const hashEntry = { input: text, hash: hashHex };
      setGeneratedHashes(prev => [...prev, hashEntry]);
      
      if (onHashGenerated) {
        onHashGenerated(hashHex, text);
      }
    } catch (error) {
      console.error('Error generating hash:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = () => {
    if (input.trim()) {
      generateHash(input);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGenerate();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Hash Generator
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Enter text to hash:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter any text..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleGenerate}
              disabled={!input.trim() || isGenerating}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Hashing...' : 'Generate Hash'}
            </button>
          </div>
        </div>

        {hash && (
          <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
              SHA-256 Hash:
            </div>
            <div className="font-mono text-sm text-emerald-900 dark:text-emerald-100 break-all">
              {hash}
            </div>
          </div>
        )}

        {generatedHashes.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generated Hashes ({generatedHashes.length} / {minHashes} minimum):
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {generatedHashes.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Input: "{entry.input}"
                  </div>
                  <div className="font-mono text-xs text-gray-900 dark:text-gray-100 break-all">
                    {entry.hash}
                  </div>
                </div>
              ))}
            </div>
            {generatedHashes.length >= minHashes && (
              <div className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Minimum hashes generated! You can continue or generate more.
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
          💡 <strong>Note:</strong> All hashing is done in your browser. Your input is never sent to any server.
        </div>
      </div>
    </div>
  );
}
