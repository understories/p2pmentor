'use client';

/**
 * SkillSelector Component
 * 
 * Reusable component for selecting Skills from curated list.
 * Used in Ask/Offer/Profile creation forms.
 * 
 * Features:
 * - Typeahead search
 * - Create new skill flow (if allowed)
 * - Displays skill name with optional description
 */

import { useState, useEffect, useRef } from 'react';
import type { Skill } from '@/lib/arkiv/skill';

interface SkillSelectorProps {
  value?: string; // Selected skill_id
  onChange: (skillId: string, skillName: string) => void;
  allowCreate?: boolean; // Allow creating new skills (default: false for beta)
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export function SkillSelector({
  value,
  onChange,
  allowCreate = false,
  placeholder = 'Select a skill...',
  className = '',
  required = false,
}: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, []);

  // Load selected skill if value provided
  useEffect(() => {
    if (value && skills.length > 0) {
      const skill = skills.find(s => s.key === value);
      if (skill) {
        setSelectedSkill(skill);
        setSearchTerm(skill.name_canonical);
      }
    }
  }, [value, skills]);

  // Filter skills based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSkills(skills);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = skills.filter(skill =>
      skill.name_canonical.toLowerCase().includes(term) ||
      skill.slug.includes(term) ||
      (skill.description && skill.description.toLowerCase().includes(term))
    );
    setFilteredSkills(filtered);
  }, [searchTerm, skills]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const { listSkills } = await import('@/lib/arkiv/skill');
      const allSkills = await listSkills({ status: 'active' });
      setSkills(allSkills);
      setFilteredSkills(allSkills);
    } catch (error) {
      console.error('Error loading skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (skill: Skill) => {
    setSelectedSkill(skill);
    setSearchTerm(skill.name_canonical);
    setIsOpen(false);
    onChange(skill.key, skill.name_canonical);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    
    // Clear selection if user is typing
    if (selectedSkill && term !== selectedSkill.name_canonical) {
      setSelectedSkill(null);
      onChange('', '');
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleCreateNew = async () => {
    if (!allowCreate || !searchTerm.trim()) {
      return;
    }

    // TODO: Implement create new skill flow
    // For now, just show a message
    alert('Creating new skills is not yet enabled in beta. Please select from the curated list.');
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={loading ? 'Loading skills...' : placeholder}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Loading skills...
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              {allowCreate && searchTerm.trim() ? (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Create "{searchTerm}"
                </button>
              ) : (
                'No skills found'
              )}
            </div>
          ) : (
            <>
              {filteredSkills.map((skill) => (
                <button
                  key={skill.key}
                  type="button"
                  onClick={() => handleSelect(skill)}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    selectedSkill?.key === skill.key ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {skill.name_canonical}
                  </div>
                  {skill.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {skill.description}
                    </div>
                  )}
                </button>
              ))}
              {allowCreate && searchTerm.trim() && !filteredSkills.some(s => s.name_canonical.toLowerCase() === searchTerm.toLowerCase()) && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-medium"
                >
                  + Create "{searchTerm}"
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
