/**
 * GraphQL Schema for Arkiv Mentorship Data
 * 
 * Provides GraphQL interface over Arkiv's JSON-RPC indexer.
 * Reusable tool for any Arkiv-based application.
 * 
 * Reference: docs/graph_indexing_plan.md
 */

export const graphQLSchema = `
  scalar BigInt

  type Query {
    # Network overview for graph visualization
    networkOverview(
      skill: String
      limitSkills: Int
      limitAsks: Int
      limitOffers: Int
      includeExpired: Boolean
    ): NetworkOverview
    
    # Profile queries
    profile(wallet: String!): Profile
    profiles(
      skill: String
      seniority: String
      limit: Int
    ): [Profile!]!
    
    # Ask queries
    asks(
      skill: String
      wallet: String
      includeExpired: Boolean
      limit: Int
    ): [Ask!]!
    ask(key: String!): Ask
    
    # Offer queries
    offers(
      skill: String
      wallet: String
      includeExpired: Boolean
      limit: Int
    ): [Offer!]!
    offer(key: String!): Offer
    
    # Skill queries
    skills(search: String, limit: Int): [SkillRef!]!
    skill(name: String!): SkillRef
    
    # Dashboard overview
    meOverview(wallet: String!, limitAsks: Int, limitOffers: Int, limitSessions: Int): MeOverview!
    
    # Feedback queries
    feedback(
      sessionKey: String
      wallet: String
      limit: Int
      since: String
    ): [Feedback!]!
    
    # App feedback (for builders/admin, separate from session feedback)
    appFeedback(
      page: String
      wallet: String
      limit: Int
      since: String
    ): [AppFeedback!]!
  }

  type NetworkOverview {
    skillRefs: [SkillRef!]!
  }

  type SkillRef {
    id: ID!
    name: String!
    asks(includeExpired: Boolean, limit: Int): [Ask!]!
    offers(includeExpired: Boolean, limit: Int): [Offer!]!
    profiles(limit: Int): [Profile!]!
  }

  type Profile {
    id: ID!
    wallet: String!
    displayName: String
    username: String
    bio: String
    bioShort: String
    bioLong: String
    timezone: String
    seniority: String
    skills: [String!]!
    availabilityWindow: String
    createdAt: BigInt
    asks(limit: Int): [Ask!]!
    offers(limit: Int): [Offer!]!
  }

  type Ask {
    id: ID!
    key: String!
    wallet: String!
    skill: String!
    message: String
    status: String!
    createdAt: String!
    expiresAt: BigInt
    ttlSeconds: Int!
    txHash: String
    profile: Profile
  }

  type Offer {
    id: ID!
    key: String!
    wallet: String!
    skill: String!
    message: String
    availabilityWindow: String
    isPaid: Boolean!
    cost: String
    paymentAddress: String
    status: String!
    createdAt: String!
    expiresAt: BigInt
    ttlSeconds: Int!
    txHash: String
    profile: Profile
  }

  type Session {
    id: ID!
    key: String!
    mentorWallet: String!
    learnerWallet: String!
    skill: String!
    date: String!
    time: String!
    duration: String!
    notes: String
    status: String!
    mentorConfirmed: Boolean!
    learnerConfirmed: Boolean!
    createdAt: String!
    txHash: String
  }

  type MeOverview {
    profile: Profile
    asks: [Ask!]!
    offers: [Offer!]!
    sessions: [Session!]!
  }

  type Feedback {
    id: ID!
    key: String!
    sessionKey: String!
    mentorWallet: String!
    learnerWallet: String!
    feedbackFrom: String!
    feedbackTo: String!
    rating: Int
    notes: String
    technicalDxFeedback: String
    createdAt: String!
    txHash: String
  }

  type AppFeedback {
    id: ID!
    key: String!
    wallet: String!
    page: String!
    message: String!
    rating: Int
    createdAt: String!
    txHash: String
  }
`;

