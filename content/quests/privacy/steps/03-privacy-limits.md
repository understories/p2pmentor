# What Privacy Can't Do on Public Chains

It's important to understand the **hard limits** of privacy on transparent blockchains. False confidence in privacy tools can be worse than knowing you're exposed.

## Hard Limits

### 1. You Cannot Make Transactions Invisible

On a public chain, every transaction is recorded in the blockchain permanently. There is no "delete" button. Even if you use privacy techniques, the fact that a transaction occurred is always recorded.

### 2. Chain Analysis Gets Better Over Time

Analytics firms like Chainalysis and Elliptic continuously improve their ability to link addresses. Techniques that work today may not work tomorrow as clustering algorithms improve.

### 3. Metadata Leaks Are Powerful

Even if you hide the link between two addresses, metadata like:

- **Timing**: Transactions that occur close together in time
- **Amounts**: Matching or round-number amounts
- **Gas prices**: Consistent gas price settings
- **Token selections**: Unusual token combinations

...can still reveal connections between addresses.

### 4. Social Engineering Bypasses Technical Privacy

The strongest privacy tools are useless if you:

- Tell someone your address
- Post it on social media
- Use it in a context where your identity is known

## What Privacy CAN Do

Despite these limits, good privacy practices can:

- **Increase the cost** of linking your activity (make it hard, not impossible)
- **Compartmentalize** your on-chain identities (limit blast radius)
- **Protect against casual observation** (not everyone is Chainalysis)
- **Preserve plausible deniability** (multiple addresses, unclear ownership)

## The Realistic Goal

**Privacy on public chains is about making linking expensive and compartmentalizing risk** — not about becoming invisible.

Think of it like physical privacy: you can't be invisible in public, but you can choose what you wear, which routes you take, and who you share your address with.
