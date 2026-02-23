# Build Your Threat Model

A **threat model** is a structured way to think about what risks you face and how to address them. Instead of trying to protect against everything, you identify the threats most relevant to your situation and prioritize accordingly.

## Why Threat Models Matter

Without a threat model, you either:

- **Over-protect**: Spend excessive time and effort on unlikely risks
- **Under-protect**: Miss the threats that actually matter to you
- **Protect randomly**: Apply security measures without strategy

## How to Build Your Model

For each potential threat, consider:

1. **What is the threat?** Describe what could go wrong
2. **How likely is it?** (Low / Medium / High)
3. **What's the impact?** If it happens, how bad is it? (Low / Medium / High)
4. **What can you do about it?** Your mitigation strategy

## Example Threat Model

| Threat                                        | Likelihood | Impact | Mitigation                              |
| --------------------------------------------- | ---------- | ------ | --------------------------------------- |
| Exchange links my address to my identity      | High       | High   | Use separate withdrawal addresses       |
| Someone sees my NFT collection and targets me | Medium     | High   | Keep valuable NFTs in a separate wallet |
| RPC provider logs my IP                       | Medium     | Low    | Use a privacy-focused RPC or VPN        |

## Your Turn

Use the interactive worksheet below to build your own threat model. Identify at least 2 threats relevant to your situation.
