# MetaMask Integration

## Overview

This document details our MetaMask wallet integration implementation, covering desktop extension support, mobile browser handling, and the technical challenges we encountered and solved. Our implementation builds on the [Arkiv MetaMask tutorial](https://github.com/Arkiv-Network/learn-arkiv/tree/main/tutorial-source-code/metamask-tutorial) but extends it significantly for production mobile dapp requirements.

## Architecture

### Core Components

1. **MetaMask SDK** (`lib/auth/metamask-sdk.ts`)
   - Provides unified API for desktop and mobile connections
   - Singleton pattern for SDK instance management
   - Disabled deeplinking (we handle redirects explicitly)

2. **Deep Link Utilities** (`lib/auth/deep-link.ts`)
   - MetaMask universal link construction
   - Mobile browser redirect handling
   - Deterministic URL construction

3. **Mobile Detection** (`lib/auth/mobile-detection.ts`)
   - Browser platform detection (iOS, Android)
   - MetaMask browser detection
   - MetaMask availability checking

4. **MetaMask Connection** (`lib/auth/metamask.ts`)
   - Unified connection API
   - Chain switching (Mendoza testnet)
   - Error handling and user feedback

5. **Auth Page** (`app/auth/page.tsx`)
   - Connection flow orchestration
   - Mobile redirect handling
   - Pathname normalization

## Implementation Details

### Desktop Flow

On desktop browsers with MetaMask extension installed:

1. User clicks "Connect Wallet"
2. `connectWallet()` detects `window.ethereum`
3. Requests account access via `eth_requestAccounts`
4. Switches to Mendoza testnet
5. Stores wallet address in localStorage
6. Redirects based on onboarding level

### Mobile Flow

On mobile browsers (Safari, Chrome, DuckDuckGo):

1. User clicks "Connect Wallet"
2. System detects mobile browser without MetaMask
3. Redirects to MetaMask universal link: `https://link.metamask.io/dapp/p2pmentor.com/auth`
4. MetaMask app opens with dapp loaded
5. User selects wallet in MetaMask
6. MetaMask redirects back to browser
7. Connection completes via SDK

### Universal Link Format

**Critical Implementation Detail:**

```typescript
// IMPORTANT: do NOT encode the dappUrl here.
// MetaMask does not reliably decode %2F in the path segment.
const dappUrl = `${host}${pathname}${search}`;
const metamaskLink = `https://link.metamask.io/dapp/${dappUrl}`;
```

We do not use `encodeURIComponent()` on the dappUrl. MetaMask handles unencoded slashes reliably. Encoding creates `%2F` which MetaMask may not decode, leaving `host%2fpath` in the address bar.

**Correct Format:**
```
https://link.metamask.io/dapp/p2pmentor.com/auth
```

**Incorrect Format (causes bugs):**
```
https://link.metamask.io/dapp/p2pmentor.com%2Fauth
```

## Technical Challenges and Solutions

### Challenge 1: Transient Browser State

**Problem:** `window.location.href` can be `null`, `undefined`, or `"about:blank"` during navigation on mobile browsers, especially during React hydration.

**Solution:** Use deterministic construction from stable primitives:

```typescript
// Use window.location.origin (stable) instead of window.location.href (transient)
const origin = window.location.origin || 'https://www.p2pmentor.com';
const pathname = dappPath.startsWith('/') ? dappPath : `/${dappPath}`;
const host = new URL(origin).host;
const dappUrl = `${host}${pathname}${search}`;
```

**Why This Works:**
- `window.location.origin` is stable even when `href` is transient
- Never parses unknown strings
- Never accepts `"null"` as input
- Never depends on timing quirks

### Challenge 2: Redirect Parameter Validation

**Problem:** `URLSearchParams.get()` returns `null`, which becomes the string `"null"` when used in `router.push()`, causing navigation to `/null`.

**Solution:** Created `safeRedirect()` helper function:

```typescript
export function safeRedirect(
  value: string | null | undefined,
  fallback: string = '/auth'
): string {
  if (!value) return fallback;
  if (value === 'null' || value === 'undefined') return fallback;
  
  // Always try to decode once (handles "%2Fauth" -> "/auth")
  let v = value;
  try {
    v = decodeURIComponent(v);
  } catch {
    // If malformed, keep original
  }
  
  if (v === 'null' || v === 'undefined') return fallback;
  if (!v.startsWith('/')) return fallback;
  if (v === '/') return fallback;
  
  return v;
}
```

**Usage:**
```typescript
const params = new URLSearchParams(window.location.search);
const redirectParam = params.get('redirect');
const redirectUrl = safeRedirect(redirectParam, '/auth');
router.push(redirectUrl);
```

### Challenge 3: Encoded Pathname in Address Bar

**Problem:** MetaMask sometimes doesn't decode `%2F` properly, leaving `p2pmentor.com%2fauth` in the address bar on privacy browsers like DuckDuckGo.

**Solution:** Targeted pathname normalization with self-healing:

```typescript
// Normalize encoded pathname BEFORE any other logic
const currentPath = window.location.pathname;
const normalizedPath = currentPath.replace(/^\/%2F/i, '/');

if (normalizedPath !== currentPath) {
  window.history.replaceState({}, '', normalizedPath + window.location.search);
}

// Self-heal: fix encoded slash in host pattern
const href = window.location.href.toLowerCase();
if (href.includes('.com%2f') || href.includes('.xyz%2f')) {
  const fixedHref = window.location.href.replace(/%2f/gi, '/');
  window.location.href = fixedHref;
  return;
}
```

**Why This Works:**
- Only normalizes the specific `/%2F` pattern (not global decode)
- No risk of throwing on malformed escape sequences
- Self-healing fixes legacy bad URLs
- Works consistently across Safari, DuckDuckGo, and MetaMask webviews

### Challenge 4: Pathname Validation During Hydration

**Problem:** `usePathname()` hook can return `null` during React hydration, especially on mobile browsers. When encoded in redirect URLs, this creates `redirect=null`.

**Solution:** Created `safePathname()` helper and use URL APIs for redirect construction:

```typescript
export function safePathname(
  pathname: string | null | undefined,
  fallback: string = '/auth'
): string {
  if (!pathname) return fallback;
  if (typeof pathname !== 'string') return fallback;
  if (!pathname.startsWith('/')) return fallback;
  if (pathname === '/') return fallback;
  return pathname;
}
```

**Usage with URL APIs:**
```typescript
const returnUrl = safePathname(pathname, '/auth');
const url = new URL('/beta', window.location.origin);
url.searchParams.set('redirect', returnUrl); // URLSearchParams handles encoding automatically
router.push(url.pathname + url.search);
```

### Challenge 5: Redirect Loop Prevention

**Problem:** Normalization must run before other redirect logic, otherwise the app can act on the wrong pathname and create redirect loops.

**Solution:** Execute normalization in the first `useEffect`, before any other logic:

```typescript
useEffect(() => {
  // 1. Normalize pathname FIRST
  // 2. Self-heal encoded host pattern
  // 3. Then check beta access
  // 4. Then handle MetaMask params
}, [router]);
```

## Code Locations

### Core Files

- `lib/auth/metamask.ts` - Main connection logic
- `lib/auth/metamask-sdk.ts` - SDK wrapper and configuration
- `lib/auth/deep-link.ts` - Universal link construction
- `lib/auth/mobile-detection.ts` - Browser/platform detection
- `lib/utils/redirect.ts` - Safe redirect validation helpers
- `app/auth/page.tsx` - Auth page with connection flow

### Key Functions

- `connectWallet()` - Main connection entry point
- `openInMetaMaskBrowser(dappPath)` - Mobile redirect handler
- `safeRedirect(value, fallback)` - Redirect param validation
- `safePathname(pathname, fallback)` - Pathname validation
- `isMobileBrowser()` - Mobile detection
- `isMetaMaskBrowser()` - MetaMask browser detection

## Best Practices

### 1. Never Encode dappUrl in Universal Link

Do not use `encodeURIComponent()` on the dappUrl segment. MetaMask handles unencoded slashes reliably.

### 2. Always Validate Redirect Params

Use `safeRedirect()` when reading redirect parameters from URLSearchParams to prevent routing to `"null"`.

### 3. Always Validate Pathnames

Use `safePathname()` when using `usePathname()` hook values in redirect URLs to handle hydration timing.

### 4. Use URL APIs for Redirect Construction

Prefer `URL` and `URLSearchParams` APIs over manual string concatenation to avoid double-encoding.

### 5. Normalize Pathname Before Redirect Logic

Run pathname normalization in the first `useEffect` before any redirect decisions to prevent loops.

### 6. Self-Heal Encoded URLs

Include self-healing logic for legacy encoded URLs that may persist in browser history.

## Error Handling

### Desktop Errors

- "No injected wallet provider found" - User needs to install MetaMask extension
- "Connection cancelled by user" - User rejected connection request
- Chain switching errors - Non-critical, user can switch manually

### Mobile Errors

- Redirect failures - Handled with timeout and user feedback
- MetaMask not installed - Shows installation links
- Browser compatibility - Falls back to manual connection instructions

## Testing Matrix

### Desktop
- Chrome with MetaMask extension
- Firefox with MetaMask extension
- Safari with MetaMask extension (if supported)

### Mobile
- Safari on iOS
- Chrome on Android
- DuckDuckGo browser (privacy-focused)
- MetaMask in-app browser

### Test Cases
- Direct `/auth` page load
- Redirect from `/beta?redirect=/auth`
- MetaMask universal link redirect
- Encoded pathname recovery
- Hydration timing edge cases

## Related Documentation

- [Arkiv MetaMask Tutorial](https://github.com/Arkiv-Network/learn-arkiv/tree/main/tutorial-source-code/metamask-tutorial)
- [Wallet Architecture](/docs/arkiv/wallet-architecture)
- [WalletConnect Integration](walletconnect-integration.md)
- [Passkey Integration](/docs/architecture/integrations/passkey-integration)
- [Jitsi Integration](/docs/architecture/integrations/jitsi-integration)

## Summary

Our MetaMask integration eliminates reliance on transient browser state, normalizes redirect semantics across WebView implementations, and makes the auth flow resilient to hydration timing, privacy browsers, WebView history restoration, and encoded path leakage. This class of bug can kill mobile dapps quietly if not handled properly.

Key achievements:
- Deterministic URL construction from stable primitives
- Comprehensive redirect parameter validation
- Targeted pathname normalization
- Self-healing for legacy encoded URLs
- Production-ready mobile dapp support

