# Understanding Hashing

## What is a Hash?

A hash function takes any input (text, file, data) and produces a fixed-size output called a "hash" or "digest". Think of it as a unique fingerprint for data.

## Properties of Good Hashes

1. **Deterministic:** Same input always produces same hash
2. **One-way:** Can't reverse hash to get original input
3. **Avalanche effect:** Small change in input = completely different hash
4. **Fixed size:** Always produces same-length output

## Try It Yourself

Enter some text below and generate its hash:

[Interactive hash generator component will appear here]

**Example:**
- Input: "Hello, World!"
- Hash (SHA-256): `dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f`

## Common Hash Functions

- **SHA-256:** Used in Bitcoin and many blockchains
- **MD5:** Older, not secure (don't use for security)
- **SHA-3:** Newer standard

## Use Cases

- **Password storage:** Store hash, not password
- **Data integrity:** Verify file hasn't changed
- **Blockchain:** Each block has hash of previous block
- **Commitment schemes:** Commit to value without revealing it

## Practice

Generate hashes for:
1. Your name
2. "Cryptography is cool"
3. The same text twice (should get same hash!)

Click "Complete" when you've generated at least one hash.
