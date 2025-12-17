/**
 * Create Reading List Quest Page
 *
 * Allows users to create their own reading list quests by adding materials one by one.
 * Quest functions exactly like the web3privacy one (same progress tracking, same UI).
 *
 * Reference: refs/resilient-learner-quests-plan.md Phase 3
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { BetaGate } from '@/components/auth/BetaGate';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { LearnerQuestMaterial } from '@/lib/arkiv/learnerQuest';

export default function CreateQuestPage() {
  const router = useRouter();
  const [wallet, setWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Quest metadata
  const [questId, setQuestId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  
  // Materials
  const [materials, setMaterials] = useState<LearnerQuestMaterial[]>([]);
  const [currentMaterial, setCurrentMaterial] = useState<Partial<LearnerQuestMaterial>>({
    id: '',
    title: '',
    author: '',
    year: undefined,
    url: '',
    category: undefined,
    description: '',
  });

  // Load wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const walletAddress = localStorage.getItem('wallet_address');
      setWallet(walletAddress);
      setLoading(false);
    }
  }, []);

  // Generate questId from title
  useEffect(() => {
    if (title) {
      const generatedId = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setQuestId(generatedId);
    }
  }, [title]);

  const handleAddMaterial = () => {
    // Validate required fields
    if (!currentMaterial.id || !currentMaterial.title || !currentMaterial.url) {
      setError('Material must have id, title, and url');
      return;
    }

    // Check for duplicate IDs
    if (materials.some(m => m.id === currentMaterial.id)) {
      setError(`Material with ID "${currentMaterial.id}" already exists`);
      return;
    }

    // Add material
    setMaterials([...materials, currentMaterial as LearnerQuestMaterial]);
    
    // Reset form
    setCurrentMaterial({
      id: '',
      title: '',
      author: '',
      year: undefined,
      url: '',
      category: undefined,
      description: '',
    });
    setError(null);
  };

  const handleRemoveMaterial = (materialId: string) => {
    setMaterials(materials.filter(m => m.id !== materialId));
  };

  const handleSaveQuest = async () => {
    if (!wallet) {
      setError('Wallet not found. Please connect your wallet.');
      return;
    }

    if (!title || !description) {
      setError('Title and description are required');
      return;
    }

    if (materials.length === 0) {
      setError('At least one material is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/learner-quests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questId,
          title,
          description,
          materials,
          wallet,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        // Redirect to the new quest
        router.push(`/learner-quests?questId=${questId}`);
      } else {
        setError(data.error || 'Failed to create quest');
      }
    } catch (err: any) {
      console.error('Error creating quest:', err);
      setError(err.message || 'Failed to create quest');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BetaGate>
        <main className="min-h-screen p-8">
          <LoadingSpinner />
        </main>
      </BetaGate>
    );
  }

  return (
    <BetaGate>
      <main className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <BackButton href="/learner-quests" />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Create Reading List Quest
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Add materials one by one to create your own reading list quest. It will function exactly like the Web3Privacy Foundations quest.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Quest Metadata */}
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Quest Information
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., My Reading List"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quest ID (auto-generated)
              </label>
              <input
                type="text"
                value={questId}
                onChange={(e) => setQuestId(e.target.value)}
                placeholder="auto-generated from title"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your reading list quest..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Add Material Form */}
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Add Material
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ID *
              </label>
              <input
                type="text"
                value={currentMaterial.id || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, id: e.target.value })}
                placeholder="unique-id"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={currentMaterial.title || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, title: e.target.value })}
                placeholder="Material Title"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Author
              </label>
              <input
                type="text"
                value={currentMaterial.author || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, author: e.target.value })}
                placeholder="Author Name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Year
              </label>
              <input
                type="number"
                value={currentMaterial.year || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, year: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="2024"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL *
              </label>
              <input
                type="url"
                value={currentMaterial.url || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, url: e.target.value })}
                placeholder="https://example.com/article"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Category
              </label>
                <select
                  value={currentMaterial.category || 'foundational'}
                  onChange={(e) => setCurrentMaterial({ ...currentMaterial, category: e.target.value as 'foundational' | 'recent' | 'book' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="foundational">Foundational</option>
                  <option value="recent">Recent</option>
                  <option value="book">Book</option>
                </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={currentMaterial.description || ''}
                onChange={(e) => setCurrentMaterial({ ...currentMaterial, description: e.target.value })}
                placeholder="Brief description of the material..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleAddMaterial}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Add Material
          </button>
        </div>

        {/* Materials Preview */}
        {materials.length > 0 && (
          <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Materials ({materials.length})
            </h2>
            
            <div className="space-y-3">
              {materials.map((material, idx) => (
                <div
                  key={material.id}
                  className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        #{idx + 1}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {material.title}
                      </h3>
                    </div>
                    {material.author && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        by {material.author}
                        {material.year && ` (${material.year})`}
                      </p>
                    )}
                    {material.category && (
                      <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded">
                        {material.category}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMaterial(material.id)}
                    className="ml-4 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSaveQuest}
            disabled={saving || !title || !description || materials.length === 0}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              'Save Quest'
            )}
          </button>
          
          <button
            onClick={() => router.push('/learner-quests')}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </main>
    </BetaGate>
  );
}

