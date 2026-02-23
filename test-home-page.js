/**
 * Simple test script to navigate and test the home page
 * Usage: node test-home-page.js
 */

import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testHomePage() {
  console.log('🚀 Starting home page test...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const screenshotsDir = path.join(__dirname, 'test-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = {
    pages: [],
    errors: [],
    warnings: [],
  };

  try {
    // 1. Navigate to home page
    console.log('\n📍 Navigating to http://localhost:3002...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Wait for animations

    const homeScreenshot = path.join(screenshotsDir, '01-home.png');
    await page.screenshot({ path: homeScreenshot, fullPage: true });
    console.log(`✅ Home page loaded - Screenshot: ${homeScreenshot}`);

    // Get page title
    const title = await page.title();
    console.log(`   Title: ${title}`);

    // Check for main elements
    const mainText = await page.locator('h1').first().textContent();
    console.log(`   Main heading: ${mainText}`);

    results.pages.push({
      url: 'http://localhost:3002',
      title,
      screenshot: homeScreenshot,
      status: 'success',
    });

    // 2. Check navigation links
    console.log('\n🔍 Checking navigation links...');
    const enterBetaLink = await page.locator('a[href="/beta"]').first();
    if (enterBetaLink) {
      console.log('   ✅ Found "Enter Beta" link');
    }

    const adminLink = await page.locator('a[href="/admin/login"]').first();
    if (adminLink) {
      console.log('   ✅ Found "Admin Login" link');
    }

    const docsLink = await page.locator('a[href="/docs"]').first();
    if (docsLink) {
      console.log('   ✅ Found "Docs" link');
    }

    // 3. Click "Enter Beta" to see what happens
    console.log('\n📍 Clicking "Enter Beta"...');
    await enterBetaLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const betaScreenshot = path.join(screenshotsDir, '02-beta-page.png');
    await page.screenshot({ path: betaScreenshot, fullPage: true });
    console.log(`✅ Beta page loaded - Screenshot: ${betaScreenshot}`);

    const betaTitle = await page.title();
    const betaHeading = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => 'Not found');
    console.log(`   Title: ${betaTitle}`);
    console.log(`   Heading: ${betaHeading}`);

    results.pages.push({
      url: page.url(),
      title: betaTitle,
      screenshot: betaScreenshot,
      status: 'success',
    });

    // 4. Check if there's a way to get to quest pages without authentication
    // Let's try navigating directly to see what happens
    console.log('\n📍 Attempting to access /learner-quests directly...');
    await page
      .goto('http://localhost:3002/learner-quests', { waitUntil: 'networkidle', timeout: 10000 })
      .catch((err) => {
        console.log('   ⚠️  Could not access /learner-quests (might require auth)');
        results.warnings.push('Cannot access /learner-quests without authentication');
      });

    const questsScreenshot = path.join(screenshotsDir, '03-quests-or-redirect.png');
    await page.screenshot({ path: questsScreenshot, fullPage: true });
    console.log(`   Screenshot: ${questsScreenshot}`);

    results.pages.push({
      url: page.url(),
      screenshot: questsScreenshot,
      status: 'success',
    });

    // Check for any console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`   🔴 Console error: ${msg.text()}`);
        results.errors.push(msg.text());
      }
    });

    // Check for failed requests
    page.on('requestfailed', (request) => {
      console.log(`   ❌ Failed request: ${request.url()}`);
      results.errors.push(`Failed request: ${request.url()}`);
    });
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    results.errors.push(error.message);
  } finally {
    await browser.close();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`\n✅ Pages tested: ${results.pages.length}`);
  results.pages.forEach((page, i) => {
    console.log(`   ${i + 1}. ${page.url} - ${page.status}`);
    console.log(`      Screenshot: ${page.screenshot}`);
  });

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors: ${results.errors.length}`);
    results.errors.forEach((err) => console.log(`   - ${err}`));
  } else {
    console.log('\n✅ No errors detected!');
  }

  if (results.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
    results.warnings.forEach((warn) => console.log(`   - ${warn}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Test complete!');
  console.log('='.repeat(60));
}

testHomePage().catch(console.error);
