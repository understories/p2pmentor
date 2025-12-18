/**
 * M1 Exam Checklist Admin Dashboard
 * 
 * Interactive checklist for M1 acceptance criteria verification.
 * Allows step-by-step testing with real Arkiv queries and explorer links.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ViewOnArkivLink } from '@/components/ViewOnArkivLink';
import { getArkivExplorerEntityUrl } from '@/lib/arkiv/explorer';

interface ChecklistItem {
  id: string;
  title: string;
  status: 'pass' | 'needs_test' | 'fail' | 'partial';
  codeVerified: boolean;
  hasArkivQuery: boolean;
  hasManualTest: boolean;
  arkivQueryCode?: string;
  manualTests?: string[];
  implementation?: string;
  notes?: string;
  section: string;
  subsection?: string;
  checked: boolean;
  queryResult?: any;
  queryError?: string;
  runningQuery?: boolean;
}

interface ChecklistSection {
  id: string;
  title: string;
  items: ChecklistItem[];
  expanded: boolean;
}

export default function M1ExamChecklistPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<ChecklistSection[]>([]);
  const [testWallet, setTestWallet] = useState<string>('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Check authentication
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('admin_authenticated');
      if (auth === 'true') {
        setAuthenticated(true);
        loadChecklist();
      } else {
        router.push('/admin/login');
      }
    }
    setLoading(false);
  }, [router]);

  const loadChecklist = () => {
    // Load from localStorage or initialize
    const saved = typeof window !== 'undefined' 
      ? localStorage.getItem('m1_exam_checklist')
      : null;
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSections(parsed);
        return;
      } catch (e) {
        console.error('Failed to parse saved checklist:', e);
      }
    }

    // Initialize checklist structure
    const initialSections: ChecklistSection[] = [
      {
        id: 'architecture',
        title: '0. Architecture & Data Design',
        expanded: true,
        items: [
          {
            id: 'schema-docs',
            title: 'Entity Schema Documents',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: false,
            section: 'architecture',
            checked: false,
            notes: 'All M1 entities have documented schemas',
          },
          {
            id: 'testnet-demo',
            title: 'Testnet Validation Demo',
            status: 'needs_test',
            codeVerified: false,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'architecture',
            checked: false,
            arkivQueryCode: `// Query profile by wallet
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();`,
            manualTests: [
              'Wallet connection on Mendoza testnet',
              'Profile entity creation with all fields',
              'Profile entity query by wallet address',
              'Entity visible on Arkiv Explorer',
            ],
          },
        ],
      },
      {
        id: 'auth',
        title: '1. Authentication (5 criteria - P0)',
        expanded: true,
        items: [
          {
            id: 'desktop-connection',
            title: 'Desktop MetaMask Connection',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'auth',
            checked: false,
            implementation: 'app/auth/page.tsx',
            manualTests: [
              'Click "Connect Wallet" on desktop',
              'MetaMask popup appears',
              'After approval, wallet address displayed',
              'Redirect to dashboard works',
              'Wallet persists in localStorage',
            ],
          },
          {
            id: 'mobile-connection',
            title: 'Mobile MetaMask Connection',
            status: 'needs_test',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'auth',
            checked: false,
            implementation: 'lib/auth/metamask-sdk.ts',
            manualTests: [
              'Test on Chrome Android',
              'Test on DuckDuckGo mobile',
              'Verify redirect to MetaMask app',
              'Verify return to app after approval',
              'Verify wallet persists after redirect',
            ],
          },
          {
            id: 'session-persistence',
            title: 'Session Persistence',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'auth',
            checked: false,
            manualTests: [
              'Login with wallet',
              'Refresh page',
              'Verify still logged in',
              'Verify wallet address still displayed',
            ],
          },
          {
            id: 'logout',
            title: 'Logout',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'auth',
            checked: false,
            manualTests: [
              'Click "Logout"',
              'Verify localStorage cleared',
              'Verify redirect to login page',
              'Verify cannot access protected routes',
            ],
          },
          {
            id: 'add-network',
            title: 'Add Mendoza Testnet',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'auth',
            checked: false,
            manualTests: [
              'Click "Add Network to Wallet"',
              'MetaMask prompt appears',
              'Network details match Mendoza testnet config',
              'Network appears in wallet after approval',
            ],
          },
        ],
      },
      {
        id: 'profile',
        title: '2. Profile Management (5 criteria - P0)',
        expanded: true,
        items: [
          {
            id: 'create-profile',
            title: 'Create Profile with Required Fields',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'profile',
            checked: false,
            implementation: 'app/api/profile/route.ts',
            arkivQueryCode: `// Query to verify profile creation:
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();`,
            manualTests: [
              'Navigate to profile creation (onboarding)',
              'Fill in all required fields',
              'Submit form',
              'Verify success message',
              'Verify redirect to profile page',
              'Verify "View on Arkiv" link present',
              'Click "View on Arkiv" - verify entity on Explorer',
            ],
          },
          {
            id: 'username-uniqueness',
            title: 'Username Uniqueness',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'profile',
            checked: false,
            arkivQueryCode: `// Test username uniqueness:
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('username', 'test_username'))
  .withAttributes(true)
  .fetch();`,
            manualTests: [
              'Try to create profile with existing username',
              'Verify error: "Username already taken"',
              'Verify no entity created',
              'Try with unique username - verify success',
            ],
          },
          {
            id: 'edit-profile',
            title: 'Edit Profile (Update Bio)',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'profile',
            checked: false,
            arkivQueryCode: `// Query to verify profile update creates new entity:
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .orderBy('createdAt', 'desc')
  .limit(2)
  .fetch();`,
            manualTests: [
              'Edit bio on profile page',
              'Click "Save"',
              'Verify UI reflects updated bio',
              'Verify "View on Arkiv" shows updated entity',
              'Verify Explorer shows new entity version',
            ],
          },
        ],
      },
      {
        id: 'skills',
        title: '3. Skills Management (4 criteria - P0)',
        expanded: true,
        items: [
          {
            id: 'add-skill',
            title: 'Add First Skill',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'skills',
            checked: false,
            arkivQueryCode: `// Query to verify skill added:
const query = publicClient.buildQuery()
  .where(eq('type', 'user_profile'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .orderBy('createdAt', 'desc')
  .limit(1)
  .fetch();`,
            manualTests: [
              'Navigate to skills page',
              'Click "Add Skill"',
              'Enter skill name "Rust"',
              'Select proficiency "Intermediate"',
              'Click "Save"',
              'Verify skill appears in list',
              'Verify "View on Arkiv" shows updated skillsArray',
            ],
          },
          {
            id: 'prevent-duplicate-skills',
            title: 'Prevent Duplicate Skills',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: false,
            hasManualTest: true,
            section: 'skills',
            checked: false,
            implementation: 'app/me/skills/page.tsx',
            manualTests: [
              'Try to add "Rust" when "Rust" already exists',
              'Verify error: "Skill already added"',
              'Verify no duplicate added',
              'Verify skillsArray unchanged on Arkiv',
            ],
          },
        ],
      },
      {
        id: 'asks',
        title: '5. Asks (3 criteria - P0)',
        expanded: true,
        items: [
          {
            id: 'create-ask',
            title: 'Create Ask',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'asks',
            checked: false,
            arkivQueryCode: `// Query to verify ask creation:
const query = publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .orderBy('createdAt', 'desc')
  .limit(1)
  .fetch();`,
            manualTests: [
              'Navigate to "Post Ask"',
              'Enter topic "Learn Solidity basics"',
              'Enter description',
              'Click "Post"',
              'Verify ask visible in network feed',
              'Verify "View on Arkiv" link present',
              'Verify entity on Explorer',
            ],
          },
          {
            id: 'ask-ttl',
            title: 'Set Ask Expiration (TTL)',
            status: 'pass',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'asks',
            checked: false,
            arkivQueryCode: `// Query to verify TTL:
const query = publicClient.buildQuery()
  .where(eq('type', 'ask'))
  .where(eq('wallet', wallet.toLowerCase()))
  .withAttributes(true)
  .orderBy('createdAt', 'desc')
  .limit(1)
  .fetch();`,
            manualTests: [
              'Create ask with expiration "7 days"',
              'Verify TTL set in entity',
              'Verify Explorer shows TTL/expiration data',
            ],
          },
        ],
      },
      {
        id: 'sessions',
        title: '8. Meeting Workflow (5 criteria - P0)',
        expanded: true,
        items: [
          {
            id: 'request-meeting',
            title: 'Request Meeting from Offer',
            status: 'needs_test',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'sessions',
            checked: false,
            arkivQueryCode: `// Query to verify session creation:
const query = publicClient.buildQuery()
  .where(eq('type', 'session'))
  .where(eq('mentorWallet', mentorWallet.toLowerCase()))
  .where(eq('learnerWallet', learnerWallet.toLowerCase()))
  .withAttributes(true)
  .withPayload(true)
  .orderBy('createdAt', 'desc')
  .limit(1)
  .fetch();`,
            manualTests: [
              'Click "Request Meeting" on Offer',
              'Select Monday 10:00',
              'Add message "Would love to learn about ownership"',
              'Submit request',
              'Verify Session entity created with status "pending"',
              'Verify notification to offer owner',
              'Verify "View on Arkiv" link present',
              'Verify Explorer shows Session entity',
            ],
          },
          {
            id: 'confirm-meeting',
            title: 'Confirm Meeting (Both Parties)',
            status: 'needs_test',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'sessions',
            checked: false,
            arkivQueryCode: `// Query to verify confirmation:
const confirmationQuery = publicClient.buildQuery()
  .where(eq('type', 'session_confirmation'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .fetch();

// Query to verify Jitsi entity (after both confirm):
const jitsiQuery = publicClient.buildQuery()
  .where(eq('type', 'session_jitsi'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .withPayload(true)
  .limit(1)
  .fetch();`,
            manualTests: [
              'Mentor views pending Session request',
              'Click "Confirm"',
              'Learner clicks "Confirm"',
              'Verify status updates to "scheduled" when both confirm',
              'Verify Jitsi URL generated',
              'Verify both parties see meeting link',
              'Verify "View on Arkiv" shows status "scheduled"',
              'Verify Explorer shows Jitsi URL in entity',
            ],
          },
        ],
      },
      {
        id: 'feedback',
        title: '9. Feedback System (3 criteria - P1)',
        expanded: true,
        items: [
          {
            id: 'leave-feedback',
            title: 'Leave Feedback After Session',
            status: 'needs_test',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'feedback',
            checked: false,
            arkivQueryCode: `// Query to verify feedback creation:
const query = publicClient.buildQuery()
  .where(eq('type', 'session_feedback'))
  .where(eq('sessionKey', sessionKey))
  .withAttributes(true)
  .withPayload(true)
  .fetch();`,
            manualTests: [
              'Navigate to completed Session',
              'Click "Leave Feedback"',
              'Rate 5 stars',
              'Write "Great explanation of ownership concepts!"',
              'Submit',
              'Verify Feedback entity created',
              'Verify links to Session and profile',
              'Verify "View on Arkiv" link present',
              'Verify Explorer shows Feedback entity',
            ],
          },
          {
            id: 'feedback-on-profile',
            title: 'Feedback Displayed on Profile',
            status: 'needs_test',
            codeVerified: true,
            hasArkivQuery: true,
            hasManualTest: true,
            section: 'feedback',
            checked: false,
            arkivQueryCode: `// Query to verify feedback aggregation:
const query = publicClient.buildQuery()
  .where(eq('type', 'session_feedback'))
  .where(eq('feedbackTo', profileWallet.toLowerCase()))
  .withAttributes(true)
  .fetch();`,
            manualTests: [
              'Alice has received 3 feedbacks with ratings 5, 4, 5',
              'View Alice\'s profile',
              'Verify "3 reviews" displayed',
              'Verify average rating "4.7" displayed',
              'Verify each feedback has "View on Arkiv" link',
            ],
          },
        ],
      },
    ];

    setSections(initialSections);
  };

  const toggleItemChecked = (sectionId: string, itemId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          items: section.items.map(item => {
            if (item.id === itemId) {
              const updated = { ...item, checked: !item.checked };
              saveChecklist();
              return updated;
            }
            return item;
          }),
        };
      }
      return section;
    }));
  };

  const toggleSection = (sectionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return { ...section, expanded: !section.expanded };
      }
      return section;
    }));
    saveChecklist();
  };

  const toggleItemExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const runArkivQuery = async (item: ChecklistItem) => {
    if (!item.hasArkivQuery || !testWallet) {
      alert('Please enter a test wallet address first');
      return;
    }

    // Set running state
    setSections(prev => prev.map(section => ({
      ...section,
      items: section.items.map(i => {
        if (i.id === item.id) {
          return { ...i, runningQuery: true, queryError: undefined };
        }
        return i;
      }),
    })));

    try {
      // Determine query type from item
      let queryType = 'profile';
      let params: any = { wallet: testWallet };

      if (item.section === 'asks') {
        queryType = 'ask';
      } else if (item.section === 'offers') {
        queryType = 'offer';
      } else if (item.section === 'sessions') {
        queryType = 'session';
      } else if (item.section === 'feedback') {
        queryType = 'feedback';
      } else if (item.section === 'availability') {
        queryType = 'availability';
      }

      const response = await fetch('/api/admin/m1-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queryType, params }),
      });

      const data = await response.json();

      // Update item with result
      setSections(prev => prev.map(section => ({
        ...section,
        items: section.items.map(i => {
          if (i.id === item.id) {
            return {
              ...i,
              runningQuery: false,
              queryResult: data.result,
              queryError: data.error || undefined,
            };
          }
          return i;
        }),
      })));

      saveChecklist();
    } catch (error: any) {
      setSections(prev => prev.map(section => ({
        ...section,
        items: section.items.map(i => {
          if (i.id === item.id) {
            return {
              ...i,
              runningQuery: false,
              queryError: error.message || 'Query failed',
            };
          }
          return i;
        }),
      })));
    }
  };

  const saveChecklist = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('m1_exam_checklist', JSON.stringify(sections));
    }
  };

  const resetChecklist = () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('m1_exam_checklist');
      }
      loadChecklist();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600 dark:text-green-400';
      case 'needs_test': return 'text-yellow-600 dark:text-yellow-400';
      case 'fail': return 'text-red-600 dark:text-red-400';
      case 'partial': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass': return '✅ PASS';
      case 'needs_test': return '⚠️ NEEDS TEST';
      case 'fail': return '❌ FAIL';
      case 'partial': return '🔄 PARTIAL';
      default: return status.toUpperCase();
    }
  };

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>;
  }

  if (!authenticated) {
    return null;
  }

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const checkedItems = sections.reduce((sum, s) => sum + s.items.filter(i => i.checked).length, 0);
  const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                M1 Exam Checklist
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Step-by-step verification of all M1 acceptance criteria
              </p>
            </div>
            <div className="flex gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Back to Admin
              </Link>
              <button
                onClick={resetChecklist}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Reset Progress
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progress: {checkedItems} / {totalItems} items checked
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {progress}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Test Wallet Input */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test Wallet Address (for Arkiv queries):
            </label>
            <input
              type="text"
              value={testWallet}
              onChange={(e) => setTestWallet(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Enter a wallet address to test Arkiv queries. This will be used for all query operations.
            </p>
          </div>
        </div>

        {/* Checklist Sections */}
        {sections.map((section) => (
          <div key={section.id} className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg"
            >
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {section.title}
              </h2>
              <span className="text-gray-500 dark:text-gray-400">
                {section.expanded ? '▼' : '▶'}
              </span>
            </button>

            {section.expanded && (
              <div className="px-6 pb-4">
                {section.items.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 py-4"
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleItemChecked(section.id, item.id)}
                        className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {item.title}
                          </h3>
                          <span className={`text-sm font-medium ${getStatusColor(item.status)}`}>
                            {getStatusBadge(item.status)}
                          </span>
                        </div>

                        {item.implementation && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <span className="font-medium">Implementation:</span> {item.implementation}
                          </p>
                        )}

                        {item.notes && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {item.notes}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-3">
                          {item.hasArkivQuery && (
                            <button
                              onClick={() => runArkivQuery(item)}
                              disabled={item.runningQuery || !testWallet}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded"
                            >
                              {item.runningQuery ? 'Running...' : 'Run Arkiv Query'}
                            </button>
                          )}
                          {(item.hasArkivQuery || item.hasManualTest) && (
                            <button
                              onClick={() => toggleItemExpanded(item.id)}
                              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded"
                            >
                              {expandedItems.has(item.id) ? 'Hide Details' : 'Show Details'}
                            </button>
                          )}
                        </div>

                        {/* Expanded Details */}
                        {expandedItems.has(item.id) && (
                          <div className="mt-4 space-y-4">
                            {/* Arkiv Query Code */}
                            {item.hasArkivQuery && item.arkivQueryCode && (
                              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Arkiv Query:
                                </h4>
                                <pre className="text-xs text-gray-800 dark:text-gray-200 overflow-x-auto">
                                  {item.arkivQueryCode}
                                </pre>
                                {item.queryResult && (
                                  <div className="mt-3">
                                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                      Query Result:
                                    </h5>
                                    <div className="bg-white dark:bg-gray-800 rounded p-2 text-xs">
                                      <p className="text-green-600 dark:text-green-400 mb-1">
                                        ✓ Found {item.queryResult.count} entity(ies)
                                      </p>
                                      {item.queryResult.entities && item.queryResult.entities.length > 0 && (
                                        <div className="mt-2">
                                          <p className="font-medium mb-1">First Entity:</p>
                                          <pre className="text-xs overflow-x-auto">
                                            {JSON.stringify(item.queryResult.entities[0], null, 2)}
                                          </pre>
                                          {item.queryResult.entities[0].key && (
                                            <div className="mt-2">
                                              <ViewOnArkivLink
                                                entityKey={item.queryResult.entities[0].key}
                                                label="View on Arkiv Explorer"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {item.queryError && (
                                  <div className="mt-3 text-red-600 dark:text-red-400 text-sm">
                                    Error: {item.queryError}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Manual Tests */}
                            {item.hasManualTest && item.manualTests && (
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Manual Test Checklist:
                                </h4>
                                <ul className="space-y-1">
                                  {item.manualTests.map((test, idx) => (
                                    <li key={idx} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                                      <span className="mr-2">-</span>
                                      <span>{test}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

