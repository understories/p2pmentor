# Engineering Guidelines Summary

## Core Principles

Engineering principles for p2pmentor development ensuring code quality, transparency, and alignment with FLOSS and Ethereum values.

## Code Organization

**Directory Structure:**
- `docs/` = Public documentation (committed to repo)
- `refs/` = Internal documentation (gitignored, not committed)
- Clear, descriptive file names

**Documentation Standards:**
- Public docs in `docs/` for external contributors and users
- Internal docs in `refs/docs/` for team coordination, research, planning
- Code comments explain why, not what

## Code Quality

**Clean Code:**
- No commented-out code, unused imports, or debug logs
- Clear commit messages with logical grouping
- All data sources real and traceable
- No hardcoded values (use environment variables)

**Verification:**
- All on-chain data verifiable via explorers
- Performance data stored on-chain with txHash
- Build must pass before every commit and push

## FLOSS Principles

**Transparency:**
- All code open and auditable
- Public documentation for public APIs
- No hidden functionality

**Community:**
- Welcome contributions
- Clear contribution guidelines
- Proper attribution and credit

## Ethereum Values

**Decentralization:**
- Users own their data (stored on Arkiv, not centralized DB)
- No single point of failure
- Censorship resistance

**Transparency:**
- On-chain verification for all important data
- Open source code
- Clear intent in code and documentation

**Trustlessness:**
- Verifiable data with cryptographic proof
- No trusted third parties
- Direct interaction with Arkiv protocol

## Security

**Secrets Management:**
- Never commit secrets in any form
- Use environment variables only
- Scripts must fail if required env vars are missing
- Never mention passwords in commit messages or documentation

**Authentication:**
- Wallet-based authentication (no centralized auth)
- Admin routes password-protected

## Data Integrity

**Real Data Only:**
- All data must be real, verifiable, and traceable
- Query real Arkiv entities
- No hardcoded test data or fabricated metrics
- Every performance sample has txHash

## Arkiv-Native Patterns

**Wallet Normalization:**
- Always normalize wallet addresses to lowercase when storing and querying
- Ensures consistent querying and prevents case-sensitivity bugs

**Query Patterns:**
- Use standard `buildQuery().where(eq(...))` pattern
- Validate result structure before processing
- Create parallel `*_txhash` entities for reliable querying

**Entity Creation:**
- Use attributes for queryable fields
- Use payload for user-facing content
- Include `spaceId`, `createdAt`, and `type` attributes
- Use `handleTransactionWithTimeout` for graceful timeout handling

**Consistency:**
- Use Arkiv's query system properly
- Compose, don't duplicate
- Follow established patterns
- Build on decentralized infrastructure

## Testing and Verification

**Build Testing:**
- Build must pass before every commit and push
- Fix all TypeScript and linting errors locally
- Never push code that fails to build

**Testing Standards:**
- Test with real Arkiv entities
- No mock data in production code
- Document test procedures and expected results

## Best Practices

**Code:** Clean, auditable, verifiable, real data only, proper error handling, type-safe, well-documented

**Documentation:** Public in `docs/`, internal in `refs/docs/`, clear and comprehensive

**Commits:** Clear descriptive messages, logical grouping, one feature per commit

**Data:** Real and verifiable, stored on-chain when important, traceable via transaction hashes, no secrets

**Values:** FLOSS principles, Ethereum values, open source best practices, community-friendly, proper attribution

See [Full Engineering Guidelines](https://github.com/understories/p2pmentor/blob/main/docs/ENGINEERING_GUIDELINES.md) for complete documentation.

