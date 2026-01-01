# p2pmentor Data Explorer

## TL;DR

**This page lets you inspect the public p2pmentor dataset and verify where it comes from.**
The records you see here are written to Arkiv and anchored by transactions you can independently check in a network explorer. p2pmentor serves this page as a viewer, but the public data itself does not rely on a private p2pmentor database as its source of truth.

---

## What you're looking at

This explorer shows the **public parts of p2pmentor**: profiles, asks, offers, and skills.

Each item here corresponds to:

* a record written to Arkiv, and
* a transaction hash that proves when and how it was written.

Nothing on this page requires logging in. Nothing here is pulled from a hidden internal database.

---

## How this works (plain language)

Most apps store user data in their own database.
p2pmentor doesn't do that for public records.

When something public is created in p2pmentor:

* it's written as an **entity on Arkiv**, and
* that write produces a **transaction**.

When you browse this page:

* we read public entities from Arkiv, and
* we link each one to its originating transaction so you can verify it yourself.

This page is a **viewer**, not a vault.

---

## What "verifiable" means here

For every public record shown:

* you can see the transaction hash that created it,
* you can open that transaction in the network explorer,
* you can confirm the timestamp and status independently.

You don't have to trust p2pmentor's UI for these facts.
The network provides the proof.

---

## What we do and do not run

**We do run software for:**

* [serving this website](/docs/architecture/integrations/vercel-integration),
* formatting and displaying public data,
* [coordinating user interactions](/docs/architecture/integrations/jitsi-integration) (for example, video calls).

**We do not run a private database that acts as the source of truth for public records.**

If this website disappeared, the public records shown here would still be verifiable from the network.

---

## What appears here · and what doesn't

This explorer only shows data designed to be public:

* public profiles
* public asks and offers
* public skills

It does **not** show:

* private session details
* notifications or preferences
* internal or administrative records

Public visibility is intentional and enforced by design.

---

## About transactions and signers (advanced)

In the current beta, some transactions are submitted by an operational signer on behalf of users.

What matters for verification is that:

* once written, records are anchored by a transaction hash,
* that transaction can be independently inspected,
* the data does not depend on a private database to be checked.

The explorer reflects this reality rather than abstracting it away.

---

## Data lifetime and archival

Arkiv entities have an active lifetime.

* During that period, entities are queryable from standard nodes.
* After expiry, historical verification may require archival infrastructure.
* Archival access may not always be free or guaranteed.

This page shows currently accessible public data and links to the underlying transactions that prove it existed.

---

## Why this page exists

This explorer exists so you don't have to take architectural claims on faith.

It's meant to:

* make public data legible to humans,
* make verification obvious,
* show the difference between *serving data* and *being the source of truth*.

You're encouraged to click through, inspect transactions, and decide for yourself.

---

## Deeper context

For more on the architectural principles behind this explorer, see [Serverless & Verifiable by Design](/docs/philosophy/serverless-and-trustless).

