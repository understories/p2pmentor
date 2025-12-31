#!/usr/bin/env python3
"""
Comprehensive link audit for betadocs.
Checks all markdown links, verifies targets exist, and identifies issues.
"""

import os
import re
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

# Configuration
BETADOCS_ROOT = Path("docs/betadocs")
LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^)]+)\)')

# Track results
results = {
    'total_files': 0,
    'total_links': 0,
    'valid_links': 0,
    'broken_links': [],
    'external_links': [],
    'anchor_links': [],
    'redundant_links': defaultdict(list),
    'path_issues': [],
    'file_details': {}
}

# Build file map
file_map = {}
for md_file in BETADOCS_ROOT.rglob("*.md"):
    rel_path = str(md_file.relative_to(BETADOCS_ROOT)).replace('.md', '').strip()
    if rel_path.endswith(' '):
        rel_path = rel_path[:-1]
    # Multiple path formats for lookup
    file_map[rel_path] = md_file
    file_map[f"/docs/{rel_path}"] = md_file
    file_map[f"docs/{rel_path}"] = md_file
    # Also map without leading slash
    if rel_path.startswith('/'):
        file_map[rel_path[1:]] = md_file

def resolve_link_path(link_url: str, source_file: Path) -> Tuple[Optional[str], str]:
    """Resolve a link URL to a file path. Returns (resolved_path, link_type)."""
    # Remove anchor
    url = link_url.split('#')[0]
    
    # External links
    if url.startswith(('http://', 'https://', 'mailto:')):
        return None, 'external'
    
    # Anchor-only links
    if url.startswith('#'):
        return None, 'anchor'
    
    # Remove .md extension if present
    url = url.replace('.md', '').replace('.MD', '')
    
    # Absolute paths starting with /docs/
    if url.startswith('/docs/'):
        path_without_docs = url[6:]  # Remove '/docs/'
        return path_without_docs, 'absolute'
    
    # Relative paths
    if url.startswith('../') or url.startswith('./') or not url.startswith('/'):
        source_dir = str(source_file.parent.relative_to(BETADOCS_ROOT))
        if source_dir == '.':
            source_dir = ''
        
        # Handle relative path resolution
        if url.startswith('./'):
            url = url[2:]
        elif url.startswith('../'):
            # Go up directories
            parts = source_dir.split('/') if source_dir else []
            rel_parts = url.split('/')
            
            for part in rel_parts:
                if part == '..':
                    if parts:
                        parts.pop()
                elif part == '.' or part == '':
                    continue
                else:
                    parts.append(part)
            
            resolved = '/'.join(parts) if parts else ''
            return resolved, 'relative'
        else:
            # Relative to current directory
            if source_dir:
                resolved = f"{source_dir}/{url}"
            else:
                resolved = url
            return resolved, 'relative'
    
    # Absolute path without /docs/
    if url.startswith('/'):
        return url[1:], 'absolute'
    
    return url, 'relative'

def check_file_exists(resolved_path: str) -> bool:
    """Check if a resolved path exists in the file map."""
    if not resolved_path:
        return False
    
    # Try multiple path formats
    for path_variant in [resolved_path, f"/docs/{resolved_path}", f"docs/{resolved_path}"]:
        if path_variant in file_map:
            return True
    
    # Check if it's a directory (README.md)
    if resolved_path.endswith('/README'):
        resolved_path = resolved_path[:-7]
    elif not resolved_path.endswith('/README'):
        # Try with README
        readme_path = f"{resolved_path}/README"
        if readme_path in file_map:
            return True
    
    return False

# Process each file
for md_file in sorted(BETADOCS_ROOT.rglob("*.md")):
    results['total_files'] += 1
    rel_path = str(md_file.relative_to(BETADOCS_ROOT))
    
    try:
        content = md_file.read_text(encoding='utf-8')
        file_links = []
        
        for match in LINK_PATTERN.finditer(content):
            results['total_links'] += 1
            link_text = match.group(1)
            link_url = match.group(2)
            
            resolved_path, link_type = resolve_link_path(link_url, md_file)
            
            link_info = {
                'source': rel_path,
                'text': link_text,
                'url': link_url,
                'resolved': resolved_path,
                'type': link_type,
                'line': content[:match.start()].count('\n') + 1
            }
            
            if link_type == 'external':
                results['external_links'].append(link_info)
                continue
            
            if link_type == 'anchor':
                results['anchor_links'].append(link_info)
                continue
            
            # Check if file exists
            if resolved_path and check_file_exists(resolved_path):
                results['valid_links'] += 1
                link_info['status'] = 'ok'
                file_links.append(link_info)
                
                # Check for redundancy (same target from multiple sources)
                target_key = resolved_path
                results['redundant_links'][target_key].append(link_info)
            else:
                link_info['status'] = 'broken'
                results['broken_links'].append(link_info)
                file_links.append(link_info)
        
        results['file_details'][rel_path] = {
            'total_links': len(file_links),
            'valid_links': len([l for l in file_links if l.get('status') == 'ok']),
            'broken_links': len([l for l in file_links if l.get('status') == 'broken']),
            'links': file_links
        }
        
    except Exception as e:
        results['file_details'][rel_path] = {
            'error': str(e),
            'links': []
        }

# Generate report
print("=" * 80)
print("BETADOCS LINK AUDIT REPORT")
print("=" * 80)
print(f"\nTotal files processed: {results['total_files']}")
print(f"Total links found: {results['total_links']}")
print(f"Valid links: {results['valid_links']}")
print(f"Broken links: {len(results['broken_links'])}")
print(f"External links: {len(results['external_links'])}")
print(f"Anchor links: {len(results['anchor_links'])}")

# Broken links by file
if results['broken_links']:
    print("\n" + "=" * 80)
    print("BROKEN LINKS")
    print("=" * 80)
    
    broken_by_file = defaultdict(list)
    for link in results['broken_links']:
        broken_by_file[link['source']].append(link)
    
    for file_path in sorted(broken_by_file.keys()):
        print(f"\n{file_path}:")
        for link in broken_by_file[file_path]:
            print(f"  Line {link['line']}: [{link['text']}]({link['url']})")
            print(f"    -> Resolved to: {link['resolved']}")
            print(f"    -> Type: {link['type']}")

# Redundant links (same target linked from many places)
print("\n" + "=" * 80)
print("REDUNDANT LINKS (targets linked from 5+ sources)")
print("=" * 80)
for target, links in sorted(results['redundant_links'].items()):
    if len(links) >= 5:
        print(f"\n{target} ({len(links)} links):")
        sources = set(l['source'] for l in links)
        for source in sorted(sources)[:10]:  # Show first 10
            print(f"  - {source}")
        if len(sources) > 10:
            print(f"  ... and {len(sources) - 10} more")

# Files with most links
print("\n" + "=" * 80)
print("FILES WITH MOST LINKS")
print("=" * 80)
files_by_links = sorted(
    [(path, info['total_links']) for path, info in results['file_details'].items() if 'total_links' in info],
    key=lambda x: x[1],
    reverse=True
)
for path, count in files_by_links[:15]:
    info = results['file_details'][path]
    valid = info.get('valid_links', 0)
    broken = info.get('broken_links', 0)
    print(f"{path}: {count} links ({valid} valid, {broken} broken)")

print("\n" + "=" * 80)
print("AUDIT COMPLETE")
print("=" * 80)

