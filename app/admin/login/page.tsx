/**
 * Admin login page
 *
 * Simple password-based authentication for admin dashboard.
 * Password is configured via ADMIN_PASSWORD environment variable.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify password via API route (server-side check)
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.valid === true) {
        // Store admin session
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admin_authenticated', 'true');
        }
        // Use window.location for more reliable redirect
        window.location.href = '/admin';
      } else {
        setError(data.error || 'Invalid password');
      }
    } catch (err: any) {
      console.error('[Admin Login] Error:', err);
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <BackButton href="/" />
        </div>

        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-gray-50">Admin Login</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-400">
          Enter the admin password to access the dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              placeholder="Enter admin password"
              required
              autoFocus
            />
          </div>

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  );
}
