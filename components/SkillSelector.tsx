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
  onFocus?: () => void; // Optional callback when input is focused
  onCreatingSkill?: (skillName: string) => void; // Optional callback when skill creation starts
  onSkillCreated?: (skillName: string, skillId: string, pending: boolean, txHash?: string, isNewSkill?: boolean) => void; // Optional callback when skill creation completes. isNewSkill=true means this was a newly created skill (not just selected)
}

export function SkillSelector({
  value,
  onChange,
  allowCreate = false,
  placeholder = 'Select a skill...',
  className = '',
  required = false,
  onFocus,
  onCreatingSkill,
  onSkillCreated,
}: SkillSelectorProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load skills on mount and when dropdown opens (to get latest from Arkiv)
  useEffect(() => {
    loadSkills();
  }, []);

  // Reload skills when dropdown opens to ensure we have latest from Arkiv
  useEffect(() => {
    if (isOpen && !loading) {
      loadSkills();
    }
  }, [isOpen]);

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
      const target = event.target as Node;
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        setIsOpen(false);
        setDropdownPosition(null);
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
      // Use API route (Arkiv-native: queries actual Arkiv entities)
      // Use high limit to ensure all skills are shown
      const res = await fetch('/api/skills?status=active&limit=500');
      if (!res.ok) {
        throw new Error(`Failed to load skills: ${res.status}`);
      }
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load skills');
      }
      setSkills(data.skills || []);
      setFilteredSkills(data.skills || []);
    } catch (error) {
      console.error('Error loading skills:', error);
      setSkills([]);
      setFilteredSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (skill: Skill) => {
    setSelectedSkill(skill);
    setSearchTerm(skill.name_canonical);
    setIsOpen(false);
    setDropdownPosition(null);
    onChange(skill.key, skill.name_canonical);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    setIsOpen(true);
    updateDropdownPosition();
    
    // Clear selection if user is typing
    if (selectedSkill && term !== selectedSkill.name_canonical) {
      setSelectedSkill(null);
      onChange('', '');
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    updateDropdownPosition();
    onFocus?.(); // Notify parent that input is focused (for tooltip display)
  };

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4, // Fixed positioning uses viewport coordinates, not document coordinates
        left: rect.left,
        width: rect.width,
      });
    }
  };

  // Update position when dropdown opens or window resizes
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      const handleResize = () => updateDropdownPosition();
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', updateDropdownPosition, true);
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', updateDropdownPosition, true);
      };
    }
  }, [isOpen]);

  const handleCreateNew = async () => {
    if (!allowCreate || !searchTerm.trim()) {
      return;
    }

    const skillName = searchTerm.trim();
    
    try {
      setLoading(true);
      // Notify parent that skill creation is starting
      onCreatingSkill?.(skillName);
      
      // Get wallet address from localStorage to pass as creator
      const walletAddress = typeof window !== 'undefined'
        ? localStorage.getItem('wallet_address')
        : null;

      // Create new skill entity on Arkiv
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name_canonical: skillName,
          description: undefined, // Can be added later
          created_by_profile: walletAddress || undefined, // Pass wallet so creator is auto-added as member
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create skill');
      }

      // If skill already exists, use it (not a new skill)
      if (data.alreadyExists && data.skill) {
        handleSelect(data.skill);
        onSkillCreated?.(skillName, data.skill.key, false, data.txHash, false);
        return;
      }

      // If skill was created but is pending (not yet queryable), wait and retry
      if (data.pending && data.skill) {
        // Notify parent that skill was created but is pending (isNewSkill=true)
        onSkillCreated?.(skillName, data.skill.key, true, data.txHash, true);
        
        // Skill was created but not yet indexed - wait a bit and reload
        await new Promise(resolve => setTimeout(resolve, 2000));
        await loadSkills();
        // Try to find the skill by slug
        const foundSkill = skills.find(s => s.slug === data.skill.slug);
        if (foundSkill) {
          handleSelect(foundSkill);
        } else {
          // Still not found, but skill exists - use the data we have
          handleSelect(data.skill);
        }
        return;
      }

      // Reload skills to include the new one
      await loadSkills();
      
      // Select the newly created skill (isNewSkill=true)
      if (data.skill) {
        handleSelect(data.skill);
        onSkillCreated?.(skillName, data.skill.key, false, data.txHash, true);
      }
    } catch (error: any) {
      console.error('Error creating skill:', error);
      alert(`Failed to create skill: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
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

      {isOpen && dropdownPosition && (
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
        >
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
                  className="text-emerald-600 dark:text-emerald-400 hover:underline w-full text-left"
                >
                  Create "{searchTerm}"
                </button>
              ) : searchTerm.trim() ? (
                <div>
                  <div className="text-gray-500 dark:text-gray-400 mb-1">No skills found matching "{searchTerm}"</div>
                  {allowCreate && (
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Create "{searchTerm}"
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 dark:text-gray-500">Start typing to search skills...</div>
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
                  disabled={loading}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating...' : `+ Create "${searchTerm}"`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
