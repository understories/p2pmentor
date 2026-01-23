# Hash Properties Demonstration

## Verify Hash Properties

In this step, you'll verify the key properties of hash functions.

## Exercise 1: Deterministic Property

1. Enter the same text twice
2. Verify both hashes are identical
3. This proves hashes are deterministic

[Interactive component showing two hash inputs with same output]

## Exercise 2: Avalanche Effect

1. Enter "Hello"
2. Note the hash
3. Change to "Hello!" (just added exclamation)
4. Compare hashes - they should be completely different!

[Interactive component showing hash change with small input change]

## Exercise 3: One-Way Property

Try to find the original input for this hash:
`5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8`

[This is the hash of a common word - try to guess it!]

**Answer:** "password" (but you can't reverse it - you have to guess or know)

## Why This Matters

- **Blockchain:** Each block's hash depends on previous block (chain integrity)
- **Merkle Trees:** Efficiently verify large datasets
- **Commitments:** Commit to a value, reveal later, prove it was chosen earlier

## Verification

Complete the exercises above to verify you understand hash properties.

Click "Complete" when you've verified all three properties.
