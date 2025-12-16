/**
 * Network Forest Graph Component
 * 
 * Experimental forest visualization of asks, offers, and skills.
 * Uses react-force-graph-2d for rendering.
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { NetworkGraphData, NetworkGraphNode, NetworkGraphLink } from '@/lib/types';
import type { UserProfile } from '@/lib/arkiv/profile';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackButton } from '@/components/BackButton';
import { GraphQLIndicator } from './GraphQLIndicator';

export default function NetworkForestGraph() {
  // All hooks must be called unconditionally at the top level
  const [data, setData] = useState<NetworkGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredLink, setHoveredLink] = useState<NetworkGraphLink | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null); // kept for link hover text if needed
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, UserProfile | null>>({});
  const [includeExpired, setIncludeExpired] = useState(true);
  const router = useRouter();

  // useMemo must be called unconditionally
  const graphData = useMemo(
    () => data ? { nodes: data.nodes, links: data.links } : { nodes: [], links: [] },
    [data]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, NetworkGraphNode>();
    data?.nodes.forEach(node => map.set(node.id, node));
    return map;
  }, [data]);

  const truncateWallet = (wallet: string) => `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  const getLinkKey = (link: any) => {
    const sourceId = typeof link.source === 'object' ? (link.source as any)?.id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any)?.id : link.target;
    return `${sourceId}-${targetId}`;
  };

  const hoveredLinkKey = hoveredLink ? getLinkKey(hoveredLink) : null;
  const isHoveredLink = (link: any) => hoveredLinkKey ? getLinkKey(link) === hoveredLinkKey : false;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({
          limitAsks: '100',
          limitOffers: '100',
          includeExpired: includeExpired ? 'true' : 'false',
        });
        const response = await fetch(`/api/network/graph?${params.toString()}`);
        const result = await response.json();
        
        if (!response.ok || !result.ok) {
          throw new Error(result.error || 'Failed to load graph data');
        }
        
        if (!cancelled) {
          setData({
            nodes: result.nodes || [],
            links: result.links || [],
          });
          console.log(`[Forest Graph] Loaded ${result.nodes?.length || 0} nodes, ${result.links?.length || 0} links`);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load graph data', err);
          setError('Failed to load forest view.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [includeExpired]);

  useEffect(() => {
    let cancelled = false;

    if (!hoveredLink) {
      setHoverLabel(null);
      return () => { cancelled = true; };
    }

    const normalizeId = (value: any) => typeof value === 'object' ? (value as any)?.id : value;
    const sourceId = normalizeId(hoveredLink.source);
    const targetId = normalizeId(hoveredLink.target);
    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);
    const wallets = [sourceNode?.wallet, targetNode?.wallet].filter(Boolean) as string[];

    const describeNode = (node?: NetworkGraphNode) => {
      if (!node) return '';
      const cachedProfile = node.wallet ? profileCache[node.wallet] : null;
      const displayName = cachedProfile?.displayName || cachedProfile?.username;
      const walletLabel = node.wallet ? truncateWallet(node.wallet) : '';
      const baseName = displayName || walletLabel || node.label || 'Unknown';
      const role = node.type === 'ask' ? 'Ask' : node.type === 'offer' ? 'Offer' : 'Skill';
      const skill = node.skillName || node.label;
      if (role === 'Skill') return `${role}: ${skill}`;
      return `${role}: ${baseName}${skill ? ` • ${skill}` : ''}`;
    };

    const buildLabel = () => {
      const parts = [describeNode(sourceNode), describeNode(targetNode)].filter(Boolean);
      if (!parts.length) return 'Click a node to view profile';
      return parts.join(' ↔ ');
    };

    const fetchProfiles = async () => {
      const toFetch = wallets.filter(wallet => !(wallet in profileCache));
      if (toFetch.length > 0) {
        const fetchedEntries: Record<string, UserProfile | null> = {};

        await Promise.all(
          toFetch.map(async (wallet) => {
            try {
              const res = await fetch(`/api/profile?wallet=${wallet}`);
              const result = await res.json();
              fetchedEntries[wallet] = result?.ok ? (result.profile as UserProfile | null) : null;
            } catch (err) {
              console.error('Failed to fetch profile for wallet', wallet, err);
              fetchedEntries[wallet] = null;
            }
          })
        );

        if (!cancelled && Object.keys(fetchedEntries).length > 0) {
          setProfileCache(prev => ({ ...prev, ...fetchedEntries }));
        }
      }

      if (!cancelled) {
        setHoverLabel(buildLabel());
      }
    };

    fetchProfiles();

    return () => {
      cancelled = true;
    };
  }, [hoveredLink, nodeMap, profileCache]);

  // Render UI - all hooks have been called unconditionally above
  // Always render ForceGraph2D to maintain consistent hook order
  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-black dark:bg-gray-900 relative">
      <GraphQLIndicator />
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/70 border border-emerald-700/40 text-sm text-emerald-100 backdrop-blur">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-400"
            checked={includeExpired}
            onChange={(e) => setIncludeExpired(e.target.checked)}
          />
          Include expired asks/offers
        </label>
      </div>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 dark:bg-gray-900/80">
          <div className="text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-4" />
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading forest view…</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 dark:bg-gray-900/80">
          <div className="text-center max-w-md px-4">
            <p className="text-sm text-red-400 dark:text-red-500 mb-4">
              {error}
            </p>
            <BackButton href="/network" label="Back to network list" className="text-sm text-emerald-400 hover:text-emerald-300 underline border-0 bg-transparent p-0" />
          </div>
        </div>
      )}

      {/* Always render ForceGraph2D to maintain hook consistency */}
      <ForceGraph2D
        graphData={graphData}
        nodeRelSize={6}
        backgroundColor="#02040a"
        linkColor={(link: NetworkGraphLink) => {
          if (isHoveredLink(link)) {
            return 'rgba(74, 222, 128, 0.9)';
          }
          if (link.type === 'match') {
            const score = link.score || 0;
            return `rgba(76, 175, 80, ${0.45 + score * 0.45})`; // Stronger opacity
          }
          if (link.type === 'ask-skill') {
            return 'rgba(239, 83, 80, 0.55)'; // Brighter for visibility
          }
          return 'rgba(76, 175, 80, 0.6)'; // Green for offers
        }}
        linkWidth={(link: NetworkGraphLink) => {
          if (link.type === 'match') {
            const base = 1.5 + (link.score || 0) * 1.5; // 1.5-3px based on score
            return isHoveredLink(link) ? base + 1 : base;
          }
          return isHoveredLink(link) ? 2.5 : 1.5;
        }}
        nodeCanvasObject={(node: NetworkGraphNode & { x?: number; y?: number }, ctx, globalScale) => {
          const label = node.label;
          const fontSize = Math.max(8, 12 / globalScale);
          const nodeSize = Math.max(4, 6 / globalScale);
          const isHovered = hoveredNodeId === node.id;

          // Node color by type
          let color = '#6ee7b7'; // default (skill) - teal
          if (node.type === 'ask') color = '#f97373'; // soft red
          if (node.type === 'offer') color = '#4ade80'; // green

          // Skip if position not available (shouldn't happen, but TypeScript safety)
          if (node.x === undefined || node.y === undefined) return;

          // Draw glow effect (outer circle with blur)
          ctx.save();
          ctx.globalAlpha = isHovered ? 0.7 : 0.3;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize * (isHovered ? 2.8 : 2), 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();

          // Draw main node circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeSize * (isHovered ? 1.2 : 1), 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.9;
          ctx.fill();
          ctx.globalAlpha = 1;

          // Draw border
          ctx.strokeStyle = color;
          ctx.lineWidth = 1 / globalScale;
          ctx.stroke();

          // Draw label
          if (globalScale > 0.5) { // Only show labels when zoomed in enough
            ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
            ctx.fillStyle = '#e5f9ff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, node.x + nodeSize + 4, node.y);
          }

          // Paid/free badge for offers
          if (node.type === 'offer' && (node as any).isPaid !== undefined) {
            const badge = (node as any).isPaid ? 'Paid' : 'Free';
            const badgeColor = (node as any).isPaid ? 'rgba(248, 113, 113, 0.9)' : 'rgba(74, 222, 128, 0.9)';
            const textColor = '#0b1221';
            const badgeFont = `${Math.max(8, 11 / globalScale)}px system-ui, -apple-system, sans-serif`;
            ctx.font = badgeFont;
            const textWidth = ctx.measureText(badge).width;
            const paddingX = 6 / globalScale;
            const paddingY = 4 / globalScale;
            const boxWidth = textWidth + paddingX * 2;
            const boxHeight = Math.max(12 / globalScale, paddingY * 2 + fontSize * 0.4);
            const offsetY = nodeSize * (isHovered ? 2.4 : 1.8);

            ctx.save();
            ctx.fillStyle = badgeColor;
            ctx.fillRect(node.x! - boxWidth / 2, node.y! - offsetY - boxHeight, boxWidth, boxHeight);
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badge, node.x!, node.y! - offsetY - boxHeight / 2);
            ctx.restore();
          }
        }}
        onNodeClick={(node: any) => {
          const n = node as NetworkGraphNode;
          if (n.wallet) {
            router.push(`/profiles/${n.wallet}`);
          }
        }}
        onNodeHover={(node: any) => {
          setHoveredNodeId(node ? (node as NetworkGraphNode).id : null);
          if (node) setHoveredLink(null); // clear link hover when focusing on a node
        }}
        onLinkHover={(link: any) => {
          setHoveredLink(link as NetworkGraphLink | null);
        }}
        cooldownTicks={100}
        onEngineStop={() => {
          // Physics simulation stopped
        }}
      />
    </div>
  );
}

