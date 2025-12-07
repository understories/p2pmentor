/**
 * Landing page
 * 
 * Adapted from understories.github.io design with dark forest aesthetic.
 * Reference: refs/understories.github.io/index.html
 */

'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import './landing.css';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  const treesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Create tree silhouettes
    if (treesContainerRef.current) {
      const container = treesContainerRef.current;
      container.innerHTML = '';
      const treeCount = 8;
      
      for (let i = 0; i < treeCount; i++) {
        const tree = document.createElement('div');
        tree.className = 'tree';
        const position = (i / (treeCount - 1)) * 100;
        tree.style.left = `${position}%`;
        tree.style.animationDelay = `${i * 0.5}s`;
        container.appendChild(tree);
      }
    }
  }, []);

  return (
    <>
      <div className="forest-bg"></div>
      <div className="fog-layer fog-1"></div>
      <div className="fog-layer fog-2"></div>
      <div className="trees-back" ref={treesContainerRef}></div>
      <ThemeToggle />
      
      <main className="landing-container">
        <h1 className="main-text">p2pmentor</h1>
        <p className="subtitle-text">Planting the first beta seed of peer to peer mentorship</p>
        
        <div className="enter-beta-container">
          <Link 
            href="/beta"
            className="enter-beta-link"
          >
            Enter Beta
          </Link>
        </div>
      </main>
    </>
  );
}
