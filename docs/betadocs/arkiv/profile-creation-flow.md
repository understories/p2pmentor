# Profile Creation Flow

Technical documentation of the profile creation and update flow.

## Conceptual Flow Diagram

Pre-implementation conceptual diagram of the profile creation flow.

<img src="/profilem1.svg" alt="Profile Creation Flow - Conceptual" />

<details>
<summary>View Mermaid source code</summary>

```mermaid
flowchart TD
  A[User on profile page] --> B[Fill profile form]
  B --> C[Validate form]
  C --> D{Valid}

  D -- No --> D1[Show validation errors]
  D1 --> B

  D -- Yes --> E[Submit POST api profile]

  E --> F[Verify beta access]
  F --> G{Access valid}
  G -- No --> G1[Error beta access required]
  G1 --> B

  G -- Yes --> H{Action type}

  H -- Create --> I[Proceed with create]
  H -- Update --> J[Load existing profile]

  J --> K{Profile exists}
  K -- No --> K1[Error profile not found]
  K1 --> B
  K -- Yes --> I

  I --> L{Username provided}
  L -- No --> M[Build profile payload]
  L -- Yes --> N[Check username uniqueness]
  N --> O{Username taken}
  O -- Yes --> O1[Error username exists]
  O1 --> B
  O -- No --> M

  M --> P[Server signs transaction]
  P --> Q[Create profile entity on Arkiv]

  Q --> R{Transaction success}
  R -- No --> R1[Error transaction failed]
  R1 --> B

  R -- Yes --> S[Create notification entity]

  S --> T[Return success response]

  T --> U[Update UI]
  U --> V[Show View on Explorer]
  V --> W[Redirect to profile page]
```

</details>

## Implementation Flow Diagram

Current implementation diagram of the profile creation and update flow.

<img src="/profilediagram.svg" alt="Profile Creation Flow - Implementation" />

<details>
<summary>View Mermaid source code</summary>

```mermaid
flowchart TD
  %% =========================
  %% M1 Profile Creation Flow
  %% Based on actual implementation
  %% =========================

  A([User fills profile form on /me/profile])
  B[Validate form data client-side]
  B --> B1{Valid?}
  B1 -- No --> E1[[Error: Show validation errors\nStay on form]]
  E1 --> A
  B1 -- Yes --> C[Submit to API: POST /api/profile]

  C --> C1[Verify beta access]
  C1 --> C2{Beta access valid?}
  C2 -- No --> E2[[Error: Beta access required\nStatus 403]]
  E2 --> A
  C2 -- Yes --> C3[Extract wallet from request body]

  C3 --> C4{Action?}
  C4 -- updateProfile --> U1[Get existing profile getProfileByWallet]
  U1 --> U2{Profile exists?}
  U2 -- No --> E3[[Error: Profile not found\nStatus 404]]
  E3 --> A
  U2 -- Yes --> U3[Merge with existing profile data]
  U3 --> D
  C4 -- createProfile --> D

  D --> D1{Username provided?}
  D1 -- No --> F[Build entity payload and attributes]
  D1 -- Yes --> D2[Check username uniqueness checkUsernameExists]
  D2 --> D3[Query: type=user_profile, username, spaceId]
  D3 --> D4{Username exists for other wallet?}
  D4 -- Yes --> E4[[Error: Username already exists\nStatus 409 Conflict\nCan regrow from history]]
  E4 --> A
  D4 -- No --> F

  F --> F1[Get existing profile for avgRating calculation]
  F1 --> F2{Existing profile found?}
  F2 -- Yes --> F3[Calculate avgRating from feedback]
  F2 -- No --> F4[Set avgRating to 0]
  F3 --> F5[Build payload with all profile data]
  F4 --> F5
  F5 --> F6[Build attributes array type, wallet, displayName, timezone, spaceId, createdAt]
  F6 --> F7{Username provided?}
  F7 -- Yes --> F8[Add username to attributes]
  F7 -- No --> G
  F8 --> G

  G --> G1[Server-side creation only]
  G1 --> G2[Get server wallet client getWalletClientFromPrivateKey]
  G2 --> G3[Use ARKIV_PRIVATE_KEY for signing]
  G3 --> I[Create entity on Arkiv walletClient.createEntity]

  I --> I1[Wrap in handleTransactionWithTimeout]
  I1 --> I2{Transaction succeeds?}
  I2 -- No --> I3{Error type?}
  I3 -- Rate limit --> E5[[Error: Rate limit exceeded\nStatus 429\nWait and retry]]
  I3 -- Timeout --> E6[[Warning: Transaction pending\nReturns pending: true]]
  I3 -- Other --> E7[[Error: Transaction failed\nShow details\nAllow retry]]
  E5 --> A
  E6 --> M
  E7 --> A
  I2 -- Yes --> J[Transaction submitted\nReturn key, txHash]

  J --> K{Create notification?}
  K -- Yes --> K1[Create notification entity type=notification]
  K1 --> K2[notificationType: entity_created]
  K2 --> K3[sourceEntityType: user_profile]
  K3 --> K4[sourceEntityKey: profile key]
  K4 --> L
  K -- No --> L[Return success to frontend ok: true, key, txHash]

  L --> M[Update UI on frontend]
  M --> M1{Transaction pending?}
  M1 -- Yes --> M2[Show pending message\nRefresh after 2 seconds]
  M1 -- No --> M3[Show success message with entity key]
  M2 --> M4[Reload profile getProfileByWallet]
  M3 --> M4
  M4 --> N[Redirect to /me or stay on /me/profile]

  %% Update flow (creates new entity - immutable)
  U3 --> D

  %% =========================
  %% Styling
  %% =========================
  classDef user fill:#FFE08A,stroke:#B58900,color:#000;
  classDef decision fill:#E5E7EB,stroke:#374151,color:#000;
  classDef arkiv fill:#B7F7C6,stroke:#15803D,color:#000;
  classDef api fill:#DDD6FE,stroke:#6D28D9,color:#000;
  classDef server fill:#FED7AA,stroke:#C2410C,color:#000;
  classDef error fill:#FCA5A5,stroke:#B91C1C,color:#000;
  classDef warn fill:#FDE68A,stroke:#B45309,color:#000;
  classDef nav fill:#C7F9CC,stroke:#16A34A,color:#000;

  class A user
  class B1,C2,C4,D1,D4,F2,F7,I2,I3,K,M1 decision
  class D2,D3,F1,F3,F5,F6,I,J,K1,K2,K3,K4 arkiv
  class C,C1,G1 api
  class G2,G3 server
  class E1,E2,E3,E4,E5,E7 error
  class E6 warn
  class N,M4 nav
```

</details>

## Implementation Details

### Key Implementation Points

1. **Always Server-Side**: Profile creation always uses the API route (`POST /api/profile`), which uses the server's private key (`ARKIV_PRIVATE_KEY`) to sign transactions. No client-side MetaMask signing for profiles.

2. **Beta Access Check**: First step in API route is to verify beta access via `verifyBetaAccess()`.

3. **Profile Existence Check**: 
   - For `updateProfile`: Checks if profile exists first, returns 404 if not found
   - For `createProfile`: No existence check (allows creating new profile)

4. **Username Uniqueness**: 
   - Only checked if username is provided
   - Uses `checkUsernameExists()` which queries all profiles with that username
   - Filters out profiles from the same wallet (user can reuse their own username)
   - Returns 409 Conflict with `canRegrow: true` if duplicate found

5. **Update Flow**: 
   - Updates create new entities (immutable pattern)
   - Merges new data with existing profile data
   - Preserves fields not provided in update

6. **Average Rating Calculation**: 
   - For updates: Fetches existing profile and recalculates `avgRating` from all feedback
   - For new profiles: Sets `avgRating` to 0

7. **Identity Seed**: 
   - Uses provided `identity_seed` if given
   - For updates: Preserves existing `identity_seed` if not provided
   - For new profiles: Auto-generates random emoji if not provided

8. **Transaction Handling**: 
   - Wrapped in `handleTransactionWithTimeout()` for timeout handling
   - Handles rate limit errors (429 status)
   - Handles transaction timeout (returns `pending: true`)
   - Other errors return 500 status

9. **Notification Creation**: 
   - Always creates notification entity after successful profile creation
   - Notification type: `entity_created`
   - Source entity type: `user_profile`
   - Links to `/me/profile`

10. **Frontend Handling**: 
    - Checks for `pending: true` in response
    - Shows appropriate message for pending transactions
    - Reloads profile after success
    - Handles username duplicate errors with regrow option

## Files Referenced

- `app/api/profile/route.ts` - API route handler
- `app/me/profile/page.tsx` - Profile form UI and submission
- `lib/arkiv/profile.ts` - Profile creation functions (`createUserProfile`, `checkUsernameExists`, `getProfileByWallet`)
- `lib/arkiv/transaction-utils.ts` - `handleTransactionWithTimeout` wrapper
- `lib/arkiv/notifications.ts` - Notification creation

