# p2pmentor Design Principles (White-Hat, Ethical, Elegant)

This document sets the tone for all design decisions in p2pmentor.  
It complements the ENGINEERING_GUIDELINES and the previous [WHITE_HAT_OCTALYSIS_REFERENCE](https://github.com/understories/hidden-garden/blob/ui-ux-upgrades/docs/WHITE_HAT_OCTALYSIS_REFERENCE.md) (leaderboards).

Our users:
- People who want to **learn**
- People who want to **teach**
- People who want to **coordinate** learning in a network-native way

Our design should make all three feel safe, respected, and empowered.

---

## 1. Core Principles

### 1.1 Dignity First

- Users are never treated as “engagement metrics”.
- Respect time, attention, and cognitive load.
- Avoid patterns that create anxiety, guilt, or addiction loops.

### 1.2 Clarity Over Cleverness

- Use simple, direct language: “Ask”, “Offer”, “Session”, “Availability”.
- UI elements should look and behave as expected.
- When in doubt, choose the option that is more obvious and more boring.

### 1.3 White-Hat Motivation

We intentionally optimize for **positive, long-term motivators**:

- **Epic Meaning & Calling**
  - “You are helping the network learn” > “You’re grinding XP.”
- **Development & Accomplishment**
  - Show real progress in skills and contribution, not arbitrary points.
- **Empowerment & Creativity**
  - Let mentors choose teaching formats, let learners shape their Asks.
- **Social Relatedness**
  - Emphasize peers, mutual support, and reciprocity.

We avoid:
- Manipulative scarcity and FOMO
- Punitive streak mechanics
- Shame-based messaging

### 1.4 Calm, Trustworthy Aesthetic

- Layouts are clean, with plenty of whitespace.
- Colors signal meaning (not panic):
  - Greens/blues for success and action
  - Warm colors only for warnings/irreversible actions
- Motion and animation are minimal and purposeful.

### 1.5 Friction Where It Matters

- Reduce friction for:
  - Creating Asks/Offers
  - Browsing and matching
  - Scheduling and communication
- Intentionally add *light* friction for:
  - Committing to paid sessions
  - Confirming time-heavy commitments
  - Actions that affect others’ reputation or trust

### 1.6 Transparency and Control

- Always show what will happen before it happens.
- Users can:
  - Edit or cancel Asks/Offers within reasonable bounds
  - Control visibility of their profile info where technically possible
- Explain how reputation / trust edges are generated and used.

### 1.7 Accessibility and Inclusivity

- Design for a wide range of devices, connection speeds, and abilities.
- Text is legible; clickable areas are generous.
- Avoid relying solely on color to convey meaning.

---

## 2. Interaction Style

### 2.1 Voice & Tone

- Friendly, grounded, and concise.
- Encouraging but not cheerleader-y.
- When errors happen, we take responsibility:  
  “Something went wrong on our side. Try again.”

### 2.2 States Are Always Visible

For any object (Ask, Offer, Session):

- Show its current state in plain language (e.g., `open`, `active`, `scheduled`, `completed`, `expired`).
- Make transitions visible and understandable.

### 2.3 Safe Defaults

- Default to the least risky option for the user.
- Payment and wallet-related actions are always explicit, never implicit.
- Time-limited actions are clearly labeled as such without pressure wording.

---

## 3. Gamification & Reputation

- We use **light, meaningful gamification**, not slot machines.
- Reputation is:
  - Tied to real interactions (sessions, feedback)
  - Interpretable by humans (e.g., “20 successful sessions taught”)
- No opaque scores that can’t be explained.
- Leaderboards, if present, are:
  - Contextual (e.g., per topic, per event)
  - Opt-out where possible
  - Framed as **celebration and discovery**, not worth as a human

---

## 4. Design Review Questions

Every time we propose a new pattern, we ask:

1. Does this respect user dignity and autonomy?
2. Is the main benefit clear to the user?
3. Which white-hat core drives does this support?
4. Could this increase anxiety, compulsiveness, or FOMO? If so, can we redesign?
5. Would we be comfortable explaining this pattern in public as an example of ethical design?

If an idea fails these questions, we either redesign it or drop it.
