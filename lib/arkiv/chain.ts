/**
 * Arkiv chain definition
 *
 * Single source of truth for the network p2pmentor runs on. The SDK's `tiramisu`
 * export has no `blockExplorers` entry, so we add the explorer here; wallet
 * add-chain flows and explorer links read it from this object.
 *
 * Network: Arkiv Tiramisu testnet (chain id 7738577, native currency GLM)
 * Faucet: https://hub.arkiv.network/faucet
 */

import { tiramisu } from '@arkiv-network/sdk/chains';
import { ARKIV_EXPLORER_BASE_URL } from './explorer';

export const arkivChain = {
  ...tiramisu,
  name: 'Arkiv Tiramisu Testnet',
  blockExplorers: {
    default: {
      name: 'Arkiv Explorer',
      url: ARKIV_EXPLORER_BASE_URL,
    },
  },
} as const;

export const ARKIV_CHAIN_ID = arkivChain.id;
export const ARKIV_CHAIN_ID_HEX = `0x${arkivChain.id.toString(16)}` as const;
export const ARKIV_RPC_URL = arkivChain.rpcUrls.default.http[0];
export const ARKIV_FAUCET_URL = 'https://hub.arkiv.network/faucet';

/**
 * Parameters for `wallet_addEthereumChain` (EIP-3085)
 */
export const ARKIV_ADD_CHAIN_PARAMS = {
  chainId: ARKIV_CHAIN_ID_HEX,
  chainName: arkivChain.name,
  nativeCurrency: arkivChain.nativeCurrency,
  rpcUrls: [...arkivChain.rpcUrls.default.http],
  blockExplorerUrls: [ARKIV_EXPLORER_BASE_URL],
};
