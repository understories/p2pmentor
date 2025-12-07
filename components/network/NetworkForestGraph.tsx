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
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function NetworkForestGraph() {
  // All hooks must be called unconditionally at the top level
  const [data, setData] = useState<NetworkGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // useMemo must be called unconditionally
  const graphData = useMemo(
    () => data ? { nodes: data.nodes, links: data.links } : { nodes: [], links: [] },
    [data]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/network/graph?limitAsks=25&limitOffers=25');
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
  }, []);

  // Render UI - all hooks have been called unconditionally above
  // Always render ForceGraph2D to maintain consistent hook order
  return (
    <div className="w-full h-[calc(100vh-4rem)] bg-black dark:bg-gray-900 relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80 dark:bg-gray-900/80">
          <div className="text-center">
            <LoadingSpinner size="large" className="mx-auto mb-4" />
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
            <a
              href="/network"
              className="text-sm text-emerald-400 hover:text-emerald-300 underline"
            >
              Back to network list
            </a>
          </div>
        </div>
      )}

      {/* Always render ForceGraph2D to maintain hook consistency */}
      <ForceGraph2D
        graphData={graphData}
        nodeRelSize={6}
        backgroundColor="#02040a"
        linkColor={(link: NetworkGraphLink) => {
          if (link.type === 'match') {
            const score = link.score || 0;
            return `rgba(76, 175, 80, ${0.3 + score * 0.5})`; // Green with opacity based on score
          }
          if (link.type === 'ask-skill') {
            return 'rgba(239, 83, 80, 0.3)'; // Soft red for asks
          }
          return 'rgba(76, 175, 80, 0.4)'; // Green for offers
        }}
        linkWidth={(link: NetworkGraphLink) => {
          if (link.type === 'match') {
            return 1.5 + (link.score || 0) * 1.5; // 1.5-3px based on score
          }
          return 1;
        }}
        linkOpacity={0.6}
        nodeCanvasObject={(node: NetworkGraphNode, ctx, globalScale) => {
          const label = node.label;
          const fontSize = Math.max(8, 12 / globalScale);
          const nodeSize = Math.max(4, 6 / globalScale);

          // Node color by type
          let color = '#6ee7b7'; // default (skill) - teal
          if (node.type === 'ask') color = '#f97373'; // soft red
          if (node.type === 'offer') color = '#4ade80'; // green

          // Draw glow effect (outer circle with blur)
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, nodeSize * 2, 0, 2 * Math.PI, false);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();

          // Draw main node circle
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI, false);
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
            ctx.fillText(label, node.x! + nodeSize + 4, node.y!);
          }
        }}
        onNodeClick={(node: any) => {
          const n = node as NetworkGraphNode;
          if (n.wallet) {
            router.push(`/profiles/${n.wallet}`);
          }
        }}
        onNodeHover={(node: any) => {
          // Optional: could show tooltip here
        }}
        cooldownTicks={100}
        onEngineStop={() => {
          // Physics simulation stopped
        }}
      />
    </div>
  );
}

