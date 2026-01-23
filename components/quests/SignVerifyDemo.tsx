/**
 * Sign and Verify Demo Component
 *
 * Interactive component for signing messages and verifying signatures.
 * Used in cryptography quest steps to demonstrate digital signatures.
 *
 * Security: All operations are client-side only. Private keys are NEVER sent to server.
 */

'use client';

import { useState } from 'react';

interface SignVerifyDemoProps {
  onVerified?: (message: string, signature: string, publicKey: string) => void;
  requireVerification?: boolean;
}

export function SignVerifyDemo({ onVerified, requireVerification = true }: SignVerifyDemoProps) {
  const [message, setMessage] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState('');
  const [verifyPublicKey, setVerifyPublicKey] = useState('');
  const [verifySignatureInput, setVerifySignatureInput] = useState('');
  const [verificationResult, setVerificationResult] = useState<'valid' | 'invalid' | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const signMessage = async () => {
    if (!message.trim() || !privateKey.trim()) {
      // Show error state - user can see what's missing
      return;
    }

    setIsSigning(true);
    try {
      // Import private key (simplified - in production would need proper key import)
      // For demo purposes, we'll use a simplified approach
      // Note: This is a simplified demo - real implementation would need proper key import/export
      
      // Create a hash of the message
      const encoder = new TextEncoder();
      const messageData = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', messageData);
      
      // For demo: Create a signature-like hash (simplified)
      // In production, would use proper Ed25519 or ECDSA signing
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Combine with private key for demo signature
      // Note: This is simplified - real signatures use proper cryptographic signing
      const signatureData = encoder.encode(`${message}:${privateKey}:${hashHex}`);
      const signatureBuffer = await crypto.subtle.digest('SHA-256', signatureData);
      const signatureArray = Array.from(new Uint8Array(signatureBuffer));
      const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

      setSignature(signatureHex);
      
      // Auto-fill verify fields
      setVerifyMessage(message);
      // Extract public key from private key (simplified - in production would derive properly)
      setVerifyPublicKey(privateKey.slice(0, 64)); // Simplified for demo
    } catch (error) {
      console.error('Error signing message:', error);
      // Error state will be shown via UI
    } finally {
      setIsSigning(false);
    }
  };

  const verifySignature = async () => {
    if (!verifyMessage.trim() || !verifyPublicKey.trim() || !verifySignatureInput.trim()) {
      // Show error state - user can see what's missing
      return;
    }

    setIsVerifying(true);
    try {
      // Recreate signature for verification (simplified demo)
      const encoder = new TextEncoder();
      const messageData = encoder.encode(verifyMessage);
      const hashBuffer = await crypto.subtle.digest('SHA-256', messageData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Simplified verification (in production would use proper cryptographic verification)
      const expectedSignatureData = encoder.encode(`${verifyMessage}:${verifyPublicKey}:${hashHex}`);
      const expectedSignatureBuffer = await crypto.subtle.digest('SHA-256', expectedSignatureData);
      const expectedSignatureArray = Array.from(new Uint8Array(expectedSignatureBuffer));
      const expectedSignatureHex = expectedSignatureArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const isValid = verifySignatureInput === expectedSignatureHex;
      setVerificationResult(isValid ? 'valid' : 'invalid');

      if (isValid && onVerified) {
        onVerified(verifyMessage, verifySignatureInput, verifyPublicKey);
      }
    } catch (error) {
      console.error('Error verifying signature:', error);
      setVerificationResult('invalid');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Signing Section */}
      <div className="p-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Step 1: Sign a Message
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message to sign:
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter a message (e.g., 'I understand cryptography!')"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Private Key:
            </label>
            <input
              type="text"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="Paste your private key from keypair step"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={signMessage}
            disabled={!message.trim() || !privateKey.trim() || isSigning}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigning ? 'Signing...' : 'Sign Message'}
          </button>

          {signature && (
            <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                Signature:
              </div>
              <div className="font-mono text-xs text-emerald-900 dark:text-emerald-100 break-all">
                {signature}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verification Section */}
      <div className="p-6 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Step 2: Verify the Signature
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message:
            </label>
            <textarea
              value={verifyMessage}
              onChange={(e) => setVerifyMessage(e.target.value)}
              placeholder="Enter the same message"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Public Key:
            </label>
            <input
              type="text"
              value={verifyPublicKey}
              onChange={(e) => setVerifyPublicKey(e.target.value)}
              placeholder="Paste the public key"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Signature:
            </label>
            <input
              type="text"
              value={verifySignatureInput}
              onChange={(e) => setVerifySignatureInput(e.target.value)}
              placeholder="Paste the signature"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            onClick={verifySignature}
            disabled={!verifyMessage.trim() || !verifyPublicKey.trim() || !verifySignatureInput.trim() || isVerifying}
            className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Verifying...' : 'Verify Signature'}
          </button>

          {verificationResult !== null && (
            <div className={`p-4 rounded-lg border-2 ${
              verificationResult === 'valid'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className={`text-sm font-semibold ${
                verificationResult === 'valid'
                  ? 'text-emerald-800 dark:text-emerald-200'
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {verificationResult === 'valid' ? '✅ Valid Signature' : '❌ Invalid Signature'}
              </div>
              <div className={`text-xs mt-1 ${
                verificationResult === 'valid'
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {verificationResult === 'valid'
                  ? 'The message matches and the signature is authentic.'
                  : 'The message was modified or the signature is invalid.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        💡 <strong>Note:</strong> All signing and verification is done in your browser. Your private key is never sent to any server.
      </div>
    </div>
  );
}
