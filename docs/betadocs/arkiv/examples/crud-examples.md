# CRUD Examples

## Overview

Complete CRUD (Create, Read, Update, Delete) examples for common entity types.

## Profile CRUD

### Create Profile

```typescript
import { createProfile } from "@/lib/arkiv/profile";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createProfile({
  wallet: walletAddress,
  displayName: "Alice",
  username: "alice",
  bioShort: "Software engineer passionate about mentorship",
  timezone: "America/New_York",
  skill_ids: [skill1.key, skill2.key],
  skillExpertise: {
    [skill1.key]: 4,
    [skill2.key]: 3,
  },
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Profile

```typescript
import { getProfileByWallet } from "@/lib/arkiv/profile";

const profile = await getProfileByWallet(walletAddress);
if (profile) {
  console.log('Profile:', profile.displayName);
}
```

### Update Profile

```typescript
import { updateProfile } from "@/lib/arkiv/profile";

// Updates create new entity
const updated = await updateProfile(walletAddress, {
  displayName: "Alice Updated",
  bioShort: "Updated bio",
  privateKey: userPrivateKey,
});
```

### List All Profiles

```typescript
import { listUserProfiles } from "@/lib/arkiv/profile";

const profiles = await listUserProfiles({ limit: 100 });
```

## Ask CRUD

### Create Ask

```typescript
import { createAsk } from "@/lib/arkiv/asks";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createAsk({
  wallet: walletAddress,
  skill_id: spanishSkill.key,
  message: "Looking for a Spanish conversation partner",
  expiresIn: 3600, // 1 hour
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Ask

```typescript
import { getAskByKey } from "@/lib/arkiv/asks";

const ask = await getAskByKey(askKey);
```

### List Asks

```typescript
import { listAsks } from "@/lib/arkiv/asks";

// Get all active asks
const asks = await listAsks({ 
  limit: 50,
  includeExpired: false 
});

// Get asks for specific skill
const spanishAsks = await listAsks({
  skill_id: spanishSkill.key,
  limit: 20,
});
```

### Delete Ask (Expiration)

Asks expire automatically via TTL. To "delete" before expiration, create a new ask with `status: 'closed'` or let it expire.

## Offer CRUD

### Create Offer

```typescript
import { createOffer } from "@/lib/arkiv/offers";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createOffer({
  wallet: walletAddress,
  skill_id: javascriptSkill.key,
  message: "I can help with JavaScript fundamentals",
  availabilityWindow: {
    version: '1.0',
    timeBlocks: [
      { day: 'monday', start: '09:00', end: '17:00', timezone: 'America/New_York' },
      { day: 'wednesday', start: '09:00', end: '17:00', timezone: 'America/New_York' },
    ],
  },
  isPaid: false,
  expiresIn: 7200, // 2 hours
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Offer

```typescript
import { getOfferByKey } from "@/lib/arkiv/offers";

const offer = await getOfferByKey(offerKey);
```

### List Offers

```typescript
import { listOffers } from "@/lib/arkiv/offers";

// Get all active offers
const offers = await listOffers({ 
  limit: 50,
  includeExpired: false 
});

// Get offers for specific skill
const jsOffers = await listOffers({
  skill_id: javascriptSkill.key,
  limit: 20,
});
```

## Session CRUD

### Create Session

```typescript
import { createSession } from "@/lib/arkiv/sessions";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createSession({
  mentorWallet: mentorWallet,
  learnerWallet: learnerWallet,
  skill_id: spanishSkill.key,
  sessionDate: "2024-01-20T18:00:00Z",
  duration: 60, // 60 minutes
  notes: "First Spanish conversation session",
  requiresPayment: false,
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Session

```typescript
import { getSessionByKey } from "@/lib/arkiv/sessions";

const session = await getSessionByKey(sessionKey);
```

### List Sessions

```typescript
import { listSessions } from "@/lib/arkiv/sessions";

// Get sessions for wallet
const sessions = await listSessions({
  wallet: walletAddress,
  limit: 50,
});

// Get sessions by status
const scheduledSessions = sessions.filter(s => s.status === 'scheduled');
```

### Update Session Status

```typescript
import { confirmSession, rejectSession } from "@/lib/arkiv/sessions";

// Confirm session
await confirmSession({
  sessionKey: session.key,
  wallet: walletAddress,
  privateKey: userPrivateKey,
});

// Reject session
await rejectSession({
  sessionKey: session.key,
  wallet: walletAddress,
  privateKey: userPrivateKey,
});
```

## Feedback CRUD

### Create Feedback

```typescript
import { createFeedback } from "@/lib/arkiv/feedback";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createFeedback({
  sessionKey: session.key,
  mentorWallet: session.mentorWallet,
  learnerWallet: session.learnerWallet,
  feedbackFrom: learnerWallet,
  feedbackTo: mentorWallet,
  rating: 5,
  notes: "Great session! Very helpful.",
  technicalDxFeedback: "The video quality was excellent",
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Feedback

```typescript
import { getFeedbackByKey } from "@/lib/arkiv/feedback";

const feedback = await getFeedbackByKey(feedbackKey);
```

### List Feedback

```typescript
import { listFeedbackForWallet } from "@/lib/arkiv/feedback";

// Get feedback for wallet
const feedbacks = await listFeedbackForWallet(walletAddress);

// Get feedback for session
import { listFeedbackForSession } from "@/lib/arkiv/feedback";
const sessionFeedbacks = await listFeedbackForSession(sessionKey);
```

## Availability CRUD

### Create Availability

```typescript
import { createAvailability } from "@/lib/arkiv/availability";
import { getWalletClientFromMetaMask } from "@/lib/arkiv/client";

const walletClient = await getWalletClientFromMetaMask();
const { key, txHash } = await createAvailability({
  wallet: walletAddress,
  timezone: "America/New_York",
  timeBlocks: {
    version: '1.0',
    timeBlocks: [
      { day: 'monday', start: '09:00', end: '17:00', timezone: 'America/New_York' },
      { day: 'tuesday', start: '09:00', end: '17:00', timezone: 'America/New_York' },
      { day: 'wednesday', start: '09:00', end: '17:00', timezone: 'America/New_York' },
    ],
  },
  privateKey: walletClient.account.privateKey,
  spaceId: 'local-dev',
});
```

### Read Availability

```typescript
import { getAvailabilityByWallet } from "@/lib/arkiv/availability";

const availability = await getAvailabilityByWallet(walletAddress);
```

### Delete Availability

```typescript
import { deleteAvailability } from "@/lib/arkiv/availability";

await deleteAvailability({
  availabilityKey: availability.key,
  wallet: walletAddress,
  privateKey: userPrivateKey,
});
```

## Skill CRUD

### Create Skill

```typescript
import { createSkill } from "@/lib/arkiv/skill";
import { getPrivateKey } from "@/lib/config";

const { key, txHash } = await createSkill({
  name_canonical: "TypeScript",
  slug: "typescript",
  status: "active",
  created_by_profile: walletAddress,
  privateKey: getPrivateKey(),
  spaceId: 'local-dev',
});
```

### Read Skill

```typescript
import { getSkillByKey } from "@/lib/arkiv/skill";

const skill = await getSkillByKey(skillKey);
```

### List Skills

```typescript
import { listSkills } from "@/lib/arkiv/skill";

// Get all active skills
const skills = await listSkills({ status: 'active', limit: 100 });
```

