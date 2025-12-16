# Asks and Offers

## Asks ("I am learning")

Learning signals with skill, description, urgency and context. Time to live (TTL) for each ask to keep the network fresh (default: 3600 seconds / 1 hour). Status: 'open' for active asks.

## Offers ("I am teaching")

Teaching signals with skill, experience, and availability window. Time to live (TTL) for offers, separate from asks (default: 7200 seconds / 2 hours). Status: 'active' for active offers.

## Matching logic

Simple skill-based matching for beta. Client side filtering with room to move matching to the server later. Matching is intentionally simple in beta. No ranking, scoring, or hidden prioritization is applied.

## Entity structure

- Main entity: `ask` or `offer` with payload and attributes
- Separate `ask_txhash` or `offer_txhash` entity for transaction hash tracking
- Linked via `askKey` or `offerKey` attributes
