/**
 * Deliberative Practice Planner Component
 *
 * Interactive component for designing deliberative practice sessions.
 * Used in meta-learning quest steps to demonstrate deliberative practice planning.
 */

'use client';

import { useState } from 'react';

interface DeliberativePracticePlannerProps {
  onPlanCreated?: (plan: {
    skill: string;
    component: string;
    goal: string;
    activity: string;
    feedbackMethod: string;
    challengeLevel: string;
  }) => void;
  requirePlan?: boolean;
}

export function DeliberativePracticePlanner({ onPlanCreated, requirePlan = true }: DeliberativePracticePlannerProps) {
  const [skill, setSkill] = useState('');
  const [components, setComponents] = useState('');
  const [selectedComponent, setSelectedComponent] = useState('');
  const [goal, setGoal] = useState('');
  const [activity, setActivity] = useState('');
  const [feedbackMethod, setFeedbackMethod] = useState('');
  const [challengeLevel, setChallengeLevel] = useState('just_right');
  const [created, setCreated] = useState(false);

  const handleCreatePlan = () => {
    if (!skill.trim() || !selectedComponent.trim() || !goal.trim() || !activity.trim() || !feedbackMethod.trim()) {
      return;
    }

    const plan = {
      skill: skill.trim(),
      component: selectedComponent.trim(),
      goal: goal.trim(),
      activity: activity.trim(),
      feedbackMethod: feedbackMethod.trim(),
      challengeLevel,
    };

    setCreated(true);

    if (onPlanCreated) {
      onPlanCreated(plan);
    }
  };

  const componentList = components
    .split('\n')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Deliberative Practice Planner
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Skill to improve:
          </label>
          <input
            type="text"
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            placeholder="e.g., JavaScript, Spanish pronunciation, Math problem-solving"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Components of this skill (one per line):
          </label>
          <textarea
            value={components}
            onChange={(e) => setComponents(e.target.value)}
            placeholder="e.g., Variables and data types&#10;Functions&#10;Control flow&#10;Async/await"
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {componentList.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Focus component (choose one):
            </label>
            <select
              value={selectedComponent}
              onChange={(e) => setSelectedComponent(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a component...</option>
              {componentList.map((comp, idx) => (
                <option key={idx} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Goal (what specific improvement are you targeting?):
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g., Write async/await code without looking up syntax"
            rows={2}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Practice activity (what will you actually do?):
          </label>
          <textarea
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="e.g., Write 10 variations of async/await patterns, test each one"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Feedback method (how will you know if you're improving?):
          </label>
          <input
            type="text"
            value={feedbackMethod}
            onChange={(e) => setFeedbackMethod(e.target.value)}
            placeholder="e.g., Run code, check for errors, compare to examples"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Challenge level:
          </label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="too_easy"
                checked={challengeLevel === 'too_easy'}
                onChange={(e) => setChallengeLevel(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">Too Easy</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="just_right"
                checked={challengeLevel === 'just_right'}
                onChange={(e) => setChallengeLevel(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">Just Right</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="too_hard"
                checked={challengeLevel === 'too_hard'}
                onChange={(e) => setChallengeLevel(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">Too Hard</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleCreatePlan}
          disabled={!skill.trim() || !selectedComponent.trim() || !goal.trim() || !activity.trim() || !feedbackMethod.trim() || created}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {created ? 'Plan Created' : 'Create Practice Plan'}
        </button>

        {created && (
          <div className="mt-4 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
              Your Deliberative Practice Plan:
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
              <div><strong>Skill:</strong> {skill}</div>
              <div><strong>Focus Component:</strong> {selectedComponent}</div>
              <div><strong>Goal:</strong> {goal}</div>
              <div><strong>Activity:</strong> {activity}</div>
              <div><strong>Feedback Method:</strong> {feedbackMethod}</div>
              <div><strong>Challenge Level:</strong> {challengeLevel === 'just_right' ? 'Just Right' : challengeLevel === 'too_easy' ? 'Too Easy' : 'Too Hard'}</div>
            </div>
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ Plan created! Start practicing with this plan.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
