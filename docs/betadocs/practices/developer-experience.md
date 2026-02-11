# Developer Experience

## DX runbook

Maintain a running DX runbook for Arkiv integration ([`docs/dx_arkiv_runbook.md`](../../../dx_arkiv_runbook.md)). Capture:

- Feature name and entities used
- Query patterns
- Pain points and errors
- Proposed improvements and UX notes

Use this as a living document to improve both p2pmentor and Arkiv SDK.

## Code organization

- Clear separation between Arkiv operations and UI logic
- Reusable modules in `lib/arkiv/*` and `lib/graph/*`
- Type-safe queries and responses
- Consistent error handling

## Documentation

- Public documentation in `docs/` (committed)
- Internal documentation in `refs/docs/` (gitignored)
- Code comments explain why, not what
- Reference external documentation when appropriate

See [`docs/ENGINEERING_GUIDELINES.md`](../../../ENGINEERING_GUIDELINES.md) for complete development standards.

See [CI/CD and Quality Pipeline](/docs/practices/ci-cd) for the GitHub Actions pipeline, local verification workflow, and contributor guide.
