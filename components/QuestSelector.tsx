'use client';

/**
 * QuestSelector Component
 *
 * Reusable dropdown for selecting a learning quest.
 * Fetches quests from /api/quests and displays them as selectable options.
 * Used in meeting scheduling forms (RequestMeetingModal, virtual gathering form).
 *
 * Pattern: follows SkillSelector convention (value/onChange props).
 */

import { useState, useEffect } from 'react';

interface QuestOption {
  questId: string;
  title: string;
  track?: string;
  description?: string;
  difficulty?: string;
}

interface QuestSelectorProps {
  value?: string;
  onChange: (questId: string, questTitle: string) => void;
  placeholder?: string;
  className?: string;
}

export function QuestSelector({
  value,
  onChange,
  placeholder = 'None (no quest)',
  className = '',
}: QuestSelectorProps) {
  const [quests, setQuests] = useState<QuestOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchQuests() {
      try {
        const res = await fetch('/api/quests');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && Array.isArray(data.quests)) {
          setQuests(
            data.quests.map((q: any) => ({
              questId: q.questId || q.trackId || q.track,
              title: q.title,
              track: q.track || q.trackId,
              description: q.description,
              difficulty: q.difficulty,
            }))
          );
        }
      } catch (e) {
        console.warn('[QuestSelector] Failed to fetch quests:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchQuests();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={className}>
      <select
        value={value || ''}
        onChange={(e) => {
          const selectedId = e.target.value;
          if (!selectedId) {
            onChange('', '');
            return;
          }
          const quest = quests.find((q) => q.questId === selectedId);
          onChange(selectedId, quest?.title || '');
        }}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      >
        <option value="">{loading ? 'Loading quests...' : placeholder}</option>
        {quests.map((q) => (
          <option key={q.questId} value={q.questId}>
            {q.title}
            {q.difficulty ? ` (${q.difficulty})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
