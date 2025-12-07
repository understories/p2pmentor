# **BETA_LAUNCH_SPRINT.md**

**Mentor Garden / Mentor-Graph — Beta Launch Sprint (One-Week)**
**Objective:** Ship a fully functional beta with end-to-end mentorship flow, clean Arkiv integration, mobile-ready UI, safe authentication, and stable UX patterns.
**Principles:**

* Build slowly and intentionally on Arkiv; **DX feedback must be logged at each step**.
* Guarantee safety: no real funds, no sensitive data.
* Architecture first → features second.
* Mobile-first UI.
* All code changes must be reproducible, testable, and well-documented.

---

## **Sprint Checklist**

### P0 — Core Foundations

- [x] Establish beta invite code system (anti-DDOS) - Basic invite gate at `/beta` with "growtogether" code
- [x] Set up Arkiv SDK both client and server side with testnet - Client wrapper created in `lib/arkiv/client.ts`
- [x] MetaMask authentication - Connection flow in `lib/auth/metamask.ts` and `/auth` page with improved styling
- [x] Example wallet login - Implemented `/api/wallet` route and "Log in with Example Wallet" button (from mentor-graph)
- [ ] Ethereum Passkey login - **Deferred to end of sprint** (brand new feature, will add after core functionality)
- [ ] Mobile-first layout (global responsive scaffolding) - Basic structure, needs UI components
- [x] DX tracking document creation: `/docs/dx_arkiv_runbook.md` - Created and ready for tracking
- [x] Local dev server running without errors - Project structure ready, run `pnpm install && pnpm dev`

### P1 — Core Data Flows

- [x] "Create Profile" flow using Arkiv entities - Profile form implemented with client-side Arkiv integration, Tailwind CSS styling
- [x] Skills: Add + view + edit (Arkiv entity) - Skills management page implemented, updates profile's skillsArray
- [x] Availability integration:
  - [x] Simple text-based availability (beta-ready approach)
  - [ ] Calendar connection (deferred to post-beta based on user feedback)
- [x] Asks & Offers:
  - [x] "I am learning"
  - [x] "I am teaching"
  - [ ] Pricing logic (free/paid + payment receiving address) - Deferred to later
- [x] Network graph:
  - [x] View network
  - [x] Match asks ↔ offers ↔ skills
  - [x] Filtering (skill, type)

### P2 — Mentorship Session Flow

- [ ] Browse profiles
- [ ] Request a meeting time
- [ ] Confirm meeting time
- [ ] Paid flow: requestor enters tx hash → confirmer validates → session confirmed
- [ ] Jitsi link generation on confirmation
  - [ ] Optional add-on: Livepeer + LiveKit (x402 hook placeholder)

### P3 — Notifications + Feedback

- [ ] UI-only notifications:
  - [ ] Meeting requests
  - [ ] Profile matches
  - [ ] Ask & offer matches
  - [ ] New offers
- [ ] Post-session:
  - [ ] Technical DX feedback form
  - [ ] Mentor/student rating + qualitative notes
  - [ ] Session added to mentor & student profile history

### P4 — Polish

- [ ] Full mobile optimization pass
- [ ] Safety reminders / disclaimers surfaced in UI
- [ ] Documentation cleanup and beta launch note
- [ ] Deployment to Vercel + environment variable audit

---

# 0. **References**

* Original hack: [https://mentor-graph.vercel.app](https://mentor-graph.vercel.app)
* Repo: [https://github.com/understories/mentor-graph](https://github.com/understories/mentor-graph)
* UI/UX design reference: [https://github.com/understories/hidden-garden/tree/ui-ux-upgrades](https://github.com/understories/hidden-garden/tree/ui-ux-upgrades)

---

# 1. **Sprint Priorities (in order)**

### **P0 — Core Foundations**

1. Establish beta invite code system (anti-DDOS).
2. Set up Arkiv SDK both client and server side with testnet.
3. Authentication system:

   * MetaMask
   * Ethereum Passkey login
4. Mobile-first layout (global responsive scaffolding).
5. DX tracking document creation: `/docs/dx_arkiv_runbook.md`.

### **P1 — Core Data Flows**

6. “Create Profile” flow using Arkiv entities.
7. Skills: Add + view + edit (Arkiv entity).
8. Availability integration:

   * Calendar availability editor
   * Calendar connection (Google Cal or iCal export)
9. Asks & Offers:

   * “I am learning”
   * “I am teaching”
   * Pricing logic (free/paid + payment receiving address)
10. Network graph:

* View network
* Match asks ↔ offers ↔ skills
* Filtering

### **P2 — Mentorship Session Flow**

11. Browse profiles
12. Request a meeting time
13. Confirm meeting time
14. Paid flow: requestor enters tx hash → confirmer validates → session confirmed
15. Jitsi link generation on confirmation

    * optional add-on after other functionalities finished: Livepeer + LiveKit (x402 hook placeholder)

### **P3 — Notifications + Feedback**

16. UI-only notifications:

* meeting requests
* profile matches
* ask & offer matches
* new offers

17. Post-session:

* Technical DX feedback form
* Mentor/student rating + qualitative notes
* Session added to mentor & student profile history

### **P4 — Polish**

18. Full mobile optimization pass
19. Safety reminders / disclaimers surfaced in UI
20. Documentation cleanup and beta launch note
21. Deployment to Vercel + environment variable audit

---

# 2. **Architecture & Scaffolding Strategy**

This sprint must follow **architecture-first**, **layered implementation**, and **DX-tracked** development.

---

## **2A — Folder Structure Additions**

```
/app
  /auth
  /profile
  /skills
  /availability
  /asks
  /offers
  /network
  /sessions
  /notifications

/lib
  arkiv/
    client.ts
    entities/
      profile.json
      skill.json
      ask.json
      offer.json
      session.json
      feedback.json
    queries/
      profile.ts
      skills.ts
      matches.ts
  auth/
    metamask.ts
    passkey.ts
  utils/
```

/docs
  dx_arkiv_runbook.md
  beta_readme_internal.md
  architecture_overview.md
```

---

## **2B — Arkiv Integration (Scaffold first, then implement)**

### Step 0 - Review MentorGraph code and do not start from scratch unnecessarily. However, the code originates from a hackathon project, so some of the work was done in a rush. We now have the time to do this slowly and with intention to build a longterm resilient project.

### Step 1 — Create Arkiv client wrapper

Do not make anything up. Review Arkiv's documentation and code examples in depth every step of the way so we ensure we are following the latest guidelines of their engineering team. Note any inconsistencies or confusion areas in the DX document and we will discuss with the team directly.

`/lib/arkiv/client.ts`

* initialize SDK
* export read/write helpers
* log errors into dx runbook

### Step 2 — Define entity schemas

Mirror the patterns from `mentor-graph` repo:

* Profile
* Skill
* Ask
* Offer
* Session
* Feedback

### Step 3 — Create high-level service abstractions

Example:

```
arkiv.profile.create(data)
arkiv.profile.get(id)
arkiv.profile.query(filters)
```

Add similar for skills, asks, offers, sessions.

### Step 4 — Add DX tracking hooks

In every Arkiv operation:

* measure round-trip
* log schema friction
* log error messages
* propose improvements

---

## **2C — Authentication Layer**

### MetaMask

* use Mentor Graph integration for reference

### Ethereum Passkey

* explore latest standards, see Scaffold-ETH for reference
* store credential mapping in Arkiv profile entity

### Credit

* give proper credit for all code references used as comments and respect all licensing requirements

### Safety Conditions

* Upon log in, show banner:
  *“Do not use a wallet containing real funds. This is a beta environment.”*
* For text input fields, show banner:
  *"Blockchain data is immutable. All data inputted is viewable forever on the [Arkiv explorer](https://explorer.mendoza.hoodi.arkiv.network)."*

---

## **2D — UI Scaffolding (Hidden Garden Guidelines)**

### Global UI

* Bring in design guidelines, elements, and components from `hidden-garden/ui-ux-upgrades`
* Mobile-first grid + vertical stack patterns

### Component kit

* Cards
* Modals
* Inputs
* Buttons (primary, secondary)
* Toast/notification panel

---

## **2E — Feature-by-Feature Scaffold**

Below is the suggested step-by-step development sequence.

### **1. Invite Code Gate**

* `/beta` page
* input → to start, simply require "growtogether" as input to "unlock beta"

### **2. Auth**

* Add login page with CTA: “Connect Wallet” / “Use Passkey”
* On success → redirect to `/me`

### **3. Profile**

* `/me/profile`
* fields: name, bio, timezone, avatar
* Write directly to Arkiv
* Show success/failure banner

### **4. Skills**

* Add skill
* Attach optional tier/experience
* Delete/edit skill

### **5. Availability**

* Simple UI grid
* Google Calendar or iCal export placeholder
* Store availability block in Arkiv

### **6. Asks & Offers**

* Create ask: “I’m learning X”
* Create offer: “I’m teaching X”
* Free or paid
* Payment address field and price required if paid is selected

### **7. Network View**

* Query Arkiv for profiles + skills
* Filter sidebar
* Show skill/ask/offer badges

### **8. Profile Browsing**

* `/network/:id`
* Show profile, skills, offers, availability

### **9. Request → Confirm Meeting**

* Request meeting modal
* Store as Arkiv “Session” entity
* Confirm flows for both sides
* If paid:

  * Requestor inputs tx hash
  * Confirmer validates + closes loop

### **10. Jitsi Core**

* Generate room URL (`uuid-v4`)
* Add to session entity
* Display button “Join call”

### **11. Notifications**

* Client-side polling or Arkiv subscription
* Badge indicators
* Notification center panel

### **12. After Session**

* Feedback form
* Store rating + comments in Arkiv
* Add session summary to profile

---

# 3. **DX Runbook Requirements**

Create `/docs/dx_arkiv_runbook.md` with these sections:

### Section Template (for every feature):

* Feature name
* Arkiv entities used
* Queries used
* SDK pain points
* Errors encountered
* Developer friction level
* Proposed improvements
* UX team notes
* Screenshot or screen recording if helpful

DX logging is mandatory for all engineers and designers.

---

# 4. **Deployment Checklist**

* Add environment variables
* Validate Vercel branch preview
* Validate Arkiv testnet connectivity
* Ensure no private keys in repo
* Confirm mobile breakpoints
* Add beta banners
* Run final smoke test of full flow

---

# 5. **Beta Launch Goals (Definition of Done)**

A beta user can:

* Join using invite code
* Log in with MetaMask or Passkey
* Create a profile
* Add skills
* Add availability
* Create asks/offers
* Browse the network
* Request & confirm a meeting
* Enter a tx hash for paid sessions
* Join a Jitsi call
* Give mutual feedback
* See everything working smoothly on mobile

---

# 6. **Local Development**

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

3. Set required environment variables in `.env`:
   - `ARKIV_PRIVATE_KEY` (required for example wallet login, optional for server-side operations)
   - `JITSI_BASE_URL` (optional, defaults to https://meet.jit.si)
   
   **Note:** To use the "Log in with Example Wallet" feature, you must set `ARKIV_PRIVATE_KEY` to a valid private key (format: `0x...`). This derives the example wallet address automatically.

4. Run the development server:
   ```bash
   pnpm dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Required Environment Variables

See `.env.example` for the complete list. At minimum for local development:
- No required variables for basic client-side operations
- `ARKIV_PRIVATE_KEY` required for server-side API routes that create entities

## Notes

- This app uses Arkiv testnet (Mendoza chain)
- Never use wallets with real funds in this beta environment
- All data written to Arkiv is immutable and viewable on the [Mendoza testnet explorer](https://explorer.mendoza.hoodi.arkiv.network)
