# Behavioral Design Stack for p2pmentor

This document describes how we stack behavioral and UX frameworks when designing p2pmentor.

The goal is to:
- Make it **easy** and **safe** for people to ask for help and offer help
- Align with **ethical, white-hat motivation** (Octalysis)
- Produce a UI that feels **elegant, calm, and empowering**, not manipulative

---

## 1. Frameworks in the Stack

We use these frameworks together:

1. **COM-B** – Capability, Opportunity, Motivation  
2. **Fogg Behavior Model (FBM)** – Behavior = Motivation × Ability × Prompt  
3. **EAST** – Easy, Attractive, Social, Timely  
4. **Hook Model** – Trigger → Action → Variable Reward → Investment  
5. **Octalysis (White Hat emphasis)** – 8 core drives, prioritizing:  
   - Epic Meaning & Calling  
   - Development & Accomplishment  
   - Empowerment of Creativity & Feedback  
   - Social Influence & Relatedness  
6. **Classic UX Heuristics** (Nielsen, etc.) – Visibility, feedback, error prevention, etc.

---

## 2. How These Layers Work Together

### 2.1 Diagnostic Layer – COM-B + Fogg

We first ask for each key behavior (e.g., “Create Ask”, “Claim Offer”, “Leave Feedback”):

- **Capability (C / Ability (A))**
  - Can the user *understand* what this does?
  - Can they *physically/technically* perform the action on their device/network?
- **Opportunity (O)**
  - Is the option visible in the right context?
  - Is the environment (time, place, UI state) supportive?
- **Motivation (M)**
  - Why would this be meaningful or beneficial for them *right now*?
- **Prompt (FBM)**
  - Is there a clear, timely cue to act (button, banner, notification)?

> If any of C, O, M, or the Prompt is weak, we fix that before adding more “engagement features”.

### 2.2 Surface Layer – UX Heuristics + EAST

Once behavior is feasible, we shape the surface:

- **Easy**
  - Reduce steps; minimize text; one primary action per view
  - Avoid unnecessary fields; use smart defaults
- **Attractive**
  - Clear visual hierarchy; one primary button; legible type
- **Social**
  - Light, non-pushy social proof: “3 mentors available right now for X”
- **Timely**
  - Prompts only when useful (e.g. when a matching Ask/Offer appears)

We constantly check against UX heuristics:

- System status is visible (loading, success, error)
- Language matches the user’s mental model (“Ask”, “Offer”, “Session”)
- Errors are prevented where possible; recovery is easy and kind
- Minimalist design: no decorative gamification that doesn’t help the user act

### 2.3 Engagement Layer – Hook Model (White Hat Only)

For behaviors that should repeat (e.g., mentoring regularly):

- **Trigger**
  - Internal: “I want to learn/teach X”
  - External: a gentle notification or in-app highlight
- **Action**
  - Very small interaction: click “Help”, “Book”, “Respond”
- **Variable Reward (White Hat)**
  - Meaningful outcomes, not dopamine casino:
    - A thank-you note, visible impact on someone’s learning
    - Reputation / trust graph updates
- **Investment**
  - Tiny follow-up action that improves the system:
    - Tag a skill, rate the session, refine availability

We avoid black-hat patterns:
- No artificial scarcity timers for learning
- No infinite scroll or engineered FOMO

### 2.4 Motivational Frame – White Hat Octalysis

Every major flow should connect to at least one of these **white-hat core drives**:

1. **Epic Meaning & Calling**
   - Position p2pmentor as “helping the network learn together”, not just a gig marketplace.
2. **Development & Accomplishment**
   - Visible progress in skills, mentoring streaks, and mutual growth.
3. **Empowerment of Creativity & Feedback**
   - Let users shape their offers, ask formats, teaching styles.
4. **Social Influence & Relatedness**
   - Emphasize peer-to-peer, mutual support, not hierarchical gatekeeping.

Black-hat core drives (scarcity, loss & avoidance, unpredictability) are used, if at all, only in soft, informative ways (e.g., honest time limits on availability) and never as pressure tactics.

---

## 3. Design Checklist by Flow

For each flow (“Create Ask”, “Create Offer”, “Browse”, “Match”, “Schedule Session”, “Feedback”):

1. **COM-B / FBM**
   - [ ] Is the user capable? Is the flow understandable?
   - [ ] Is the opportunity present (visible entry point, right timing)?
   - [ ] Is there intrinsic motivation? Are we articulating the “why”?
   - [ ] Is there a clear, well-timed prompt?

2. **EAST + UX**
   - [ ] Is this the easiest reasonable path to the goal?
   - [ ] Is the main call-to-action visually dominant but calm?
   - [ ] Is there light social context (e.g., “X recent sessions completed”)?
   - [ ] Is the prompt timely (not spammy)?

3. **Hook (White Hat)**
   - [ ] What is the trigger?
   - [ ] What is the smallest possible action?
   - [ ] What is the meaningful reward?
   - [ ] What is the low-effort investment that improves the next loop?

4. **Octalysis (White Hat)**
   - [ ] Which positive core drives are we engaging?
   - [ ] Are we avoiding fear, anxiety, or FOMO-based patterns?

---

## 4. Implementation Notes

- This stack is a **lens**, not a checklist to blindly apply everywhere.
- When in doubt, **reduce friction and increase clarity** rather than adding “gamey” elements.
- Any new UX proposal should reference:
  - Which behavior is being supported
  - Which frameworks are being used
  - Why it is white-hat and ethical
