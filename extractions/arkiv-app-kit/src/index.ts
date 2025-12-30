/**
 * Arkiv App Primitives - Main Export
 * 
 * This package provides composable building blocks for Arkiv integrations.
 * These are primitives, not a framework - use them as needed.
 */

// Environment and configuration
export * from './env';
export * from './space';
export * from './wallet';

// Schema and attributes
export * from './schema';

// Client construction
export * from './client';

// Query builders
export * from './queries';

// Transaction handling
export * from './transactions';

// Entity key derivation
export * from './keys';

// Indexer reconciliation (strongly recommended)
export * from './indexer';

// Transaction hash companion entities (strongly recommended)
export * from './txhash-entities';

