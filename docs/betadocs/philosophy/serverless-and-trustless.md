# Serverless & Verifiable by Design

*(Deeper architectural context)*

## How does an app work without a central database?

Most applications store user data in a private database that the company controls.

p2pmentor works differently.

Instead of storing public application data in our own database, we store it as **entities on Arkiv**, a decentralized data layer anchored to a blockchain network.

**Traditional app**

* User creates a profile → stored in the company's database
* User creates an ask or offer → stored in the company's database
* The company controls the data: it can be changed, deleted, or made unavailable

**p2pmentor**

* User creates a profile → written as an entity on Arkiv
* User creates an ask or offer → written as an entity on Arkiv
* Each write produces a transaction that can be independently verified

When you view public data in p2pmentor, the app reads it from Arkiv.
Our infrastructure acts as a **viewer and coordinator**, not as the source of truth.

You can inspect this yourself in the [p2pmentor Data Explorer](/docs/philosophy/explorer), which shows public p2pmentor records alongside the transactions that created them.

---

## What "serverless" means here (and what it doesn't)

**Serverless does not mean "no computers are running."**

It means we do **not rely on a private backend database** to store or validate public application data.

Arkiv functions as the data layer:

* No PostgreSQL
* No MongoDB
* No internal data warehouse holding public records

Our servers are used only to:

* Serve the web interface
* Format and display public data
* Coordinate interactions with external services (for example, video calls)

If our web servers disappeared, the public data would still exist on Arkiv and could be read by any compatible client.

---

## Verifiability instead of blind trust

With a traditional server-based app, users must trust the operator to:

* Not silently change or delete data
* Not selectively hide records
* Not misuse stored data
* Keep infrastructure running indefinitely

With p2pmentor:

* Public records are written as transactions
* Those transactions are timestamped and immutable
* Anyone can verify them independently using a network explorer

This doesn't eliminate trust entirely, but it **dramatically reduces the trust surface**.
Claims can be checked against the network, not just against our UI.

The [explorer page](/docs/philosophy/explorer) exists specifically to make this visible.

---

## Data ownership (precise version)

Public p2pmentor records are associated with wallet addresses and written to Arkiv.

In the current beta:

* Transactions are submitted by an operational signer on behalf of users
* Once written, records are publicly verifiable and not dependent on our private systems

Ownership here means:

* The data is not locked inside a proprietary database
* The data can be read by any application that understands Arkiv
* The history of changes is anchored to verifiable transactions

Future versions may expand who signs transactions, but the core guarantee already holds: **no private database is required to validate public data.**

---

## Censorship resistance (properly scoped)

A centralized server can be:

* Shut down
* Blocked
* Forced to remove or alter data

A decentralized data layer makes this harder.

As long as the underlying network exists, previously written public records can be verified.
Availability may vary by node type (standard vs archival), but **existence and integrity remain provable**.

---

## Entity expiration and archival (important nuance)

Arkiv entities have an **expiry block**.

* Before expiry: entities are queryable from standard nodes
* After expiry: entities may only be accessible via archival nodes
* Archival access may require payment and is not guaranteed to be free

This means:

* Data is verifiable and accessible during its active lifetime
* Historical verification remains possible, but may depend on archival infrastructure

The explorer reflects this reality rather than hiding it.

---

## Why this matters

This architecture produces a different set of tradeoffs:

* Fewer moving parts
* No private database to secure or migrate
* Clear separation between **data truth** and **user interface**
* Public claims that can be independently checked

p2pmentor is not "decentralized later."
The core data model is verifiable from the start.

The [explorer page](/docs/philosophy/explorer) exists so you don't have to take our word for it.
