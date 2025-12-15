/**
 * Generate static HTML pages from Arkiv data
 * 
 * Simple HTML generator for MVP - no external dependencies required
 * Generates pure HTML/CSS pages that work without JavaScript
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'static-app', 'public');

interface Entity {
  key: string;
  wallet?: string;
  displayName?: string;
  name_canonical?: string;
  slug?: string;
  message?: string;
  skill?: string;
  skill_id?: string;
  createdAt?: string;
  [key: string]: any;
}

async function loadJsonFile(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    return null;
  }
}

function escapeHtml(text: string | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return dateString;
  }
}

function generateHeader(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>p2pmentor (Decentralized)</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/profiles/">Profiles</a>
      <a href="/skills/">Skills</a>
      <a href="/asks/">Asks</a>
      <a href="/offers/">Offers</a>
    </nav>
  </header>
  <main>`;
}

function generateFooter(): string {
  return `  </main>
  <footer>
    <p>p2pmentor - Decentralized mentorship platform</p>
    <p>Data from <a href="https://mendoza.arkiv.org">Arkiv Network</a></p>
  </footer>
</body>
</html>`;
}

async function generateIndexPage(): Promise<void> {
  const html = generateHeader() + `
    <div class="container">
      <h1>p2pmentor - Decentralized Mentorship Platform</h1>
      <p>Welcome to the no-JavaScript, fully decentralized version of p2pmentor.</p>
      
      <h2>Browse</h2>
      <ul class="entity-list">
        <li><a href="/profiles/">All Profiles</a></li>
        <li><a href="/skills/">All Skills</a></li>
        <li><a href="/asks/">All Asks</a></li>
        <li><a href="/offers/">All Offers</a></li>
      </ul>
      
      <h2>About</h2>
      <p>This is a static, no-JavaScript version of p2pmentor that works entirely without centralized servers. All data is fetched from Arkiv Network at build time and embedded in HTML.</p>
    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(OUTPUT_DIR, 'index.html'), html, 'utf-8');
}

async function generateProfilesList(profiles: Entity[]): Promise<void> {
  const profilesDir = path.join(OUTPUT_DIR, 'profiles');
  await fs.mkdir(profilesDir, { recursive: true });
  
  let html = generateHeader() + `
    <div class="container">
      <h1>All Profiles</h1>
      <p>${profiles.length} profiles</p>
      <ul class="entity-list">
  `;
  
  for (const profile of profiles) {
    const wallet = profile.wallet?.toLowerCase() || '';
    const displayName = profile.displayName || wallet.slice(0, 10) + '...';
    html += `        <li><a href="/profiles/${wallet}/">${escapeHtml(displayName)}</a> <span class="meta">(${wallet.slice(0, 10)}...)</span></li>\n`;
  }
  
  html += `      </ul>
    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(profilesDir, 'index.html'), html, 'utf-8');
}

async function generateProfilePage(profile: Entity, asksByWallet: Record<string, Entity[]>, offersByWallet: Record<string, Entity[]>): Promise<void> {
  const wallet = profile.wallet?.toLowerCase() || '';
  const profileDir = path.join(OUTPUT_DIR, 'profiles', wallet);
  await fs.mkdir(profileDir, { recursive: true });
  
  const asks = asksByWallet[wallet] || [];
  const offers = offersByWallet[wallet] || [];
  
  let html = generateHeader() + `
    <div class="container">
      <h1>${escapeHtml(profile.displayName || wallet)}</h1>
      
      <div class="entity-card">
        <p><strong>Wallet:</strong> <code>${escapeHtml(wallet)}</code></p>
        ${profile.bioShort ? `<p>${escapeHtml(profile.bioShort)}</p>` : ''}
        ${profile.timezone ? `<p><strong>Timezone:</strong> ${escapeHtml(profile.timezone)}</p>` : ''}
        ${profile.skillsArray && profile.skillsArray.length > 0 ? `<p><strong>Skills:</strong> ${escapeHtml(profile.skillsArray.join(', '))}</p>` : ''}
      </div>
      
      ${asks.length > 0 ? `
      <h2>Active Asks (${asks.length})</h2>
      ${asks.map(ask => `
        <div class="entity-card">
          <p>${escapeHtml(ask.message || '')}</p>
          <p class="meta">Skill: ${escapeHtml(ask.skill || '')} | Created: ${formatDate(ask.createdAt)}</p>
        </div>
      `).join('')}
      ` : ''}
      
      ${offers.length > 0 ? `
      <h2>Active Offers (${offers.length})</h2>
      ${offers.map(offer => `
        <div class="entity-card">
          <p>${escapeHtml(offer.message || '')}</p>
          <p class="meta">Skill: ${escapeHtml(offer.skill || '')} | Created: ${formatDate(offer.createdAt)}</p>
        </div>
      `).join('')}
      ` : ''}
      
      <p><a href="/profiles/">← Back to all profiles</a></p>
    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(profileDir, 'index.html'), html, 'utf-8');
}

async function generateSkillsList(skills: Entity[]): Promise<void> {
  const skillsDir = path.join(OUTPUT_DIR, 'skills');
  await fs.mkdir(skillsDir, { recursive: true });
  
  let html = generateHeader() + `
    <div class="container">
      <h1>All Skills</h1>
      <p>${skills.length} skills</p>
      <ul class="entity-list">
  `;
  
  for (const skill of skills) {
    const slug = skill.slug || '';
    html += `        <li><a href="/skills/${slug}/">${escapeHtml(skill.name_canonical || slug)}</a></li>\n`;
  }
  
  html += `      </ul>
    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(skillsDir, 'index.html'), html, 'utf-8');
}

async function generateAsksList(asks: Entity[]): Promise<void> {
  const asksDir = path.join(OUTPUT_DIR, 'asks');
  await fs.mkdir(asksDir, { recursive: true });
  
  let html = generateHeader() + `
    <div class="container">
      <h1>All Active Asks</h1>
      <p>${asks.length} active asks</p>
  `;
  
  for (const ask of asks) {
    const wallet = ask.wallet?.toLowerCase() || '';
    html += `
      <div class="entity-card">
        <p>${escapeHtml(ask.message || '')}</p>
        <p class="meta">
          Skill: ${escapeHtml(ask.skill || '')} | 
          By: <a href="/profiles/${wallet}/">${wallet.slice(0, 10)}...</a> | 
          Created: ${formatDate(ask.createdAt)}
        </p>
      </div>
    `;
  }
  
  html += `    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(asksDir, 'index.html'), html, 'utf-8');
}

async function generateOffersList(offers: Entity[]): Promise<void> {
  const offersDir = path.join(OUTPUT_DIR, 'offers');
  await fs.mkdir(offersDir, { recursive: true });
  
  let html = generateHeader() + `
    <div class="container">
      <h1>All Active Offers</h1>
      <p>${offers.length} active offers</p>
  `;
  
  for (const offer of offers) {
    const wallet = offer.wallet?.toLowerCase() || '';
    html += `
      <div class="entity-card">
        <p>${escapeHtml(offer.message || '')}</p>
        <p class="meta">
          Skill: ${escapeHtml(offer.skill || '')} | 
          By: <a href="/profiles/${wallet}/">${wallet.slice(0, 10)}...</a> | 
          Created: ${formatDate(offer.createdAt)}
        </p>
      </div>
    `;
  }
  
  html += `    </div>
  ` + generateFooter();
  
  await fs.writeFile(path.join(offersDir, 'index.html'), html, 'utf-8');
}

async function copyCss(): Promise<void> {
  const cssDir = path.join(OUTPUT_DIR, 'css');
  await fs.mkdir(cssDir, { recursive: true });
  
  // Copy CSS from static-app/static/css/style.css if it exists, otherwise create basic one
  const sourceCss = path.join(process.cwd(), 'static-app', 'static', 'css', 'style.css');
  const targetCss = path.join(cssDir, 'style.css');
  
  try {
    await fs.copyFile(sourceCss, targetCss);
  } catch {
    // If source doesn't exist, create basic CSS
    const basicCss = await fs.readFile(sourceCss, 'utf-8').catch(() => null);
    if (!basicCss) {
      // Create minimal CSS inline in the script or use the one we created
      const defaultCss = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; background: #fff; max-width: 1200px; margin: 0 auto; padding: 1rem; }
header { border-bottom: 1px solid #ddd; padding: 1rem 0; margin-bottom: 2rem; }
nav { display: flex; gap: 1rem; flex-wrap: wrap; }
nav a { color: #0066cc; text-decoration: none; padding: 0.5rem; }
nav a:hover { text-decoration: underline; }
main { min-height: 60vh; }
h1 { margin-bottom: 1rem; color: #222; }
h2 { margin-top: 2rem; margin-bottom: 1rem; color: #333; }
.container { max-width: 800px; margin: 0 auto; }
.entity-list { list-style: none; padding: 0; }
.entity-list li { padding: 0.75rem; border-bottom: 1px solid #eee; }
.entity-list a { color: #0066cc; text-decoration: none; font-weight: 500; }
.entity-card { border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin-bottom: 1rem; background: #f9f9f9; }
.meta { color: #666; font-size: 0.9rem; margin-top: 0.5rem; }
footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9rem; }
footer a { color: #0066cc; text-decoration: none; }`;
      await fs.writeFile(targetCss, defaultCss, 'utf-8');
    }
  }
}

async function main(): Promise<void> {
  console.log('🏗️  Generating static HTML pages...');
  
  const staticDataDir = path.join(process.cwd(), 'static-data');
  
  // Load data
  const profiles = await loadJsonFile(path.join(staticDataDir, 'entities', 'profiles.json')) || [];
  const skills = await loadJsonFile(path.join(staticDataDir, 'entities', 'skills.json')) || [];
  const asks = await loadJsonFile(path.join(staticDataDir, 'entities', 'asks.json')) || [];
  const offers = await loadJsonFile(path.join(staticDataDir, 'entities', 'offers.json')) || [];
  const asksByWallet = await loadJsonFile(path.join(staticDataDir, 'indexes', 'asks-by-wallet.json')) || {};
  const offersByWallet = await loadJsonFile(path.join(staticDataDir, 'indexes', 'offers-by-wallet.json')) || {};
  
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  
  // Copy CSS
  await copyCss();
  
  // Generate pages
  await generateIndexPage();
  await generateProfilesList(profiles);
  for (const profile of profiles) {
    await generateProfilePage(profile, asksByWallet, offersByWallet);
  }
  await generateSkillsList(skills);
  await generateAsksList(asks);
  await generateOffersList(offers);
  
  console.log(`✅ Generated static HTML pages in ${OUTPUT_DIR}`);
  console.log(`   - ${profiles.length} profile pages`);
  console.log(`   - ${skills.length} skills listed`);
  console.log(`   - ${asks.length} asks listed`);
  console.log(`   - ${offers.length} offers listed`);
}

main().catch((error) => {
  console.error('Error generating static HTML:', error);
  process.exit(1);
});

