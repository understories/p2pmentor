/**
 * Keypair Generator Component
 *
 * Interactive component for generating public/private keypairs.
 * Used in cryptography quest steps to demonstrate keypair generation.
 *
 * Security: All operations are client-side only. Private keys are NEVER sent to server.
 */

'use client';

import { useState } from 'react';

interface KeypairGeneratorProps {
  onKeypairGenerated?: (publicKey: string) => void;
  storePublicKey?: boolean;
}

export function KeypairGenerator({
  onKeypairGenerated,
  storePublicKey = true,
}: KeypairGeneratorProps) {
  const [keypair, setKeypair] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const generateKeypair = async () => {
    setIsGenerating(true);
    try {
      // Generate Ed25519 keypair using Web Crypto API
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'Ed25519',
          namedCurve: 'Ed25519',
        },
        true, // extractable
        ['sign', 'verify']
      );

      // Export public key
      const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
      const publicKeyArray = Array.from(new Uint8Array(publicKeyRaw));
      const publicKeyHex = publicKeyArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Export private key
      const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
      const privateKeyArray = Array.from(new Uint8Array(privateKeyRaw));
      const privateKeyHex = privateKeyArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      setKeypair({
        publicKey: publicKeyHex,
        privateKey: privateKeyHex,
      });

      setHasShownWarning(true);

      if (onKeypairGenerated && storePublicKey) {
        onKeypairGenerated(publicKeyHex);
      }
    } catch (error: any) {
      // Fallback: Ed25519 might not be supported in all browsers
      // Use ECDSA P-256 as fallback
      if (error.name === 'NotSupportedError' || error.message?.includes('Ed25519')) {
        try {
          const keyPair = await crypto.subtle.generateKey(
            {
              name: 'ECDSA',
              namedCurve: 'P-256',
            },
            true,
            ['sign', 'verify']
          );

          const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
          const publicKeyArray = Array.from(new Uint8Array(publicKeyRaw));
          const publicKeyHex = publicKeyArray.map((b) => b.toString(16).padStart(2, '0')).join('');

          const privateKeyRaw = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
          const privateKeyArray = Array.from(new Uint8Array(privateKeyRaw));
          const privateKeyHex = privateKeyArray
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          setKeypair({
            publicKey: publicKeyHex,
            privateKey: privateKeyHex,
          });

          setHasShownWarning(true);

          if (onKeypairGenerated && storePublicKey) {
            onKeypairGenerated(publicKeyHex);
          }
        } catch (fallbackError) {
          console.error('Error generating keypair (fallback):', fallbackError);
          // Error will be logged - user can see in console or try again
        }
      } else {
        console.error('Error generating keypair:', error);
        // Error will be logged - user can see in console or try again
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const [copiedKey, setCopiedKey] = useState<'public' | 'private' | null>(null);

  const copyToClipboard = (text: string, keyType: 'public' | 'private') => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(keyType);
        setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
      });
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-lg border border-purple-200 bg-purple-50 p-6 dark:border-purple-800 dark:bg-purple-900/20">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Keypair Generator
      </h3>

      {!keypair && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generate a public/private keypair. The private key will be shown once - make sure to
            save it securely!
          </p>
          <button
            onClick={generateKeypair}
            disabled={isGenerating}
            className="w-full rounded-lg bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? 'Generating Keypair...' : 'Generate Keypair'}
          </button>
        </div>
      )}

      {keypair && (
        <div className="space-y-4">
          {hasShownWarning && (
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="mb-2 text-sm font-semibold text-red-800 dark:text-red-200">
                ⚠️ Security Warning
              </div>
              <div className="text-xs text-red-700 dark:text-red-300">
                Your private key is shown below. Copy it now if you want to save it. It will not be
                shown again on this page.
                <strong> Never share your private key with anyone!</strong>
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Public Key (safe to share):
              </label>
              <button
                onClick={() => copyToClipboard(keypair.publicKey, 'public')}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {copiedKey === 'public' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
              <div className="break-all font-mono text-xs text-green-900 dark:text-green-100">
                {keypair.publicKey}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Private Key (keep secret!):
              </label>
              <button
                onClick={() => copyToClipboard(keypair.privateKey, 'private')}
                className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                {copiedKey === 'private' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="break-all font-mono text-xs text-red-900 dark:text-red-100">
                {keypair.privateKey}
              </div>
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Note:</strong> All keypair generation is done in your browser. Your private
            key is never sent to any server.
          </div>
        </div>
      )}
    </div>
  );
}
