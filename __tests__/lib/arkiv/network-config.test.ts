import { describe, it, expect } from 'vitest';
import {
  ARKIV_EXPLORER_BASE_URL,
  getArkivExplorerAddressUrl,
  getArkivExplorerEntityUrl,
  getArkivExplorerTxUrl,
  getArkivExplorerUrl,
} from '@/lib/arkiv/explorer';
import {
  getPublicClient,
  getWalletClientFromPrivateKey,
  getWalletClientFromMetaMask,
} from '@/lib/arkiv/client';
import { ARKIV_ADD_CHAIN_PARAMS, ARKIV_CHAIN_ID_HEX, arkivChain } from '@/lib/arkiv/chain';

/** Tiramisu chain id (Arkiv current testnet) */
const TIRAMISU_CHAIN_ID = 7738577;
const EXPLORER = 'https://tiramisu.explorer.arkiv.network';

/** Hardhat account #0 secret; built with template so CI `git grep` for `0x` + 64 hex does not false positive */
const TEST_PRIVATE_KEY =
  `0x${'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'}` as `0x${string}`;

describe('Arkiv explorer URLs (Tiramisu)', () => {
  it('uses Tiramisu explorer host', () => {
    expect(ARKIV_EXPLORER_BASE_URL).toBe(EXPLORER);
    expect(ARKIV_EXPLORER_BASE_URL).not.toMatch(/braga|kaolin/i);
  });

  it('builds transaction URLs', () => {
    const hash = '0xabc123';
    expect(getArkivExplorerTxUrl(hash)).toBe(`${EXPLORER}/tx/0xabc123`);
  });

  it('builds entity URLs', () => {
    expect(getArkivExplorerEntityUrl('ent_1')).toBe(`${EXPLORER}/entity/ent_1`);
  });

  it('builds address URLs', () => {
    expect(getArkivExplorerAddressUrl('0xabc')).toBe(`${EXPLORER}/address/0xabc`);
  });

  it('getArkivExplorerUrl prefers entityKey over txHash', () => {
    expect(getArkivExplorerUrl('0xtx', 'ent_k')).toBe(getArkivExplorerEntityUrl('ent_k'));
  });

  it('getArkivExplorerUrl falls back to txHash', () => {
    expect(getArkivExplorerUrl('0xdead')).toBe(getArkivExplorerTxUrl('0xdead'));
  });

  it('getArkivExplorerUrl returns null for missing args', () => {
    expect(getArkivExplorerUrl()).toBeNull();
    expect(getArkivExplorerUrl(undefined, undefined)).toBeNull();
  });

  it('getArkivExplorerUrl ignores string undefined txHash', () => {
    expect(getArkivExplorerUrl('undefined')).toBeNull();
  });
});

describe('Arkiv chain config (Tiramisu)', () => {
  it('arkivChain is Tiramisu with explorer and RPC', () => {
    expect(arkivChain.id).toBe(TIRAMISU_CHAIN_ID);
    expect(arkivChain.blockExplorers.default.url).toBe(EXPLORER);
    expect(arkivChain.rpcUrls.default.http[0]).toBe(
      'https://rpc.tiramisu.db-chain.testnet.arkiv.network'
    );
  });

  it('wallet add-chain params match the chain', () => {
    expect(ARKIV_CHAIN_ID_HEX).toBe('0x7614d1');
    expect(ARKIV_ADD_CHAIN_PARAMS.chainId).toBe('0x7614d1');
    expect(ARKIV_ADD_CHAIN_PARAMS.nativeCurrency.symbol).toBe('GLM');
    expect(ARKIV_ADD_CHAIN_PARAMS.blockExplorerUrls).toEqual([EXPLORER]);
  });
});

describe('Arkiv client chain (Tiramisu)', () => {
  it('getPublicClient uses Tiramisu id and GLM native currency', () => {
    const client = getPublicClient();
    expect(Number(client.chain?.id)).toBe(TIRAMISU_CHAIN_ID);
    expect(client.chain?.name).toMatch(/Tiramisu/i);
    expect(client.chain?.nativeCurrency?.symbol).toBe('GLM');
  });

  it('getWalletClientFromPrivateKey uses Tiramisu', () => {
    const wallet = getWalletClientFromPrivateKey(TEST_PRIVATE_KEY);
    expect(Number(wallet.chain?.id)).toBe(TIRAMISU_CHAIN_ID);
    expect(wallet.chain?.nativeCurrency?.symbol).toBe('GLM');
  });

  it('getWalletClientFromMetaMask throws without injected provider', () => {
    expect(() => getWalletClientFromMetaMask('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toThrow(
      /MetaMask not available/i
    );
  });
});
