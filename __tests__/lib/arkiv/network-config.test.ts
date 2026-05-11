import { describe, it, expect } from 'vitest';
import {
  ARKIV_EXPLORER_BASE_URL,
  getArkivExplorerEntityUrl,
  getArkivExplorerTxUrl,
  getArkivExplorerUrl,
} from '@/lib/arkiv/explorer';
import {
  getPublicClient,
  getWalletClientFromPrivateKey,
  getWalletClientFromMetaMask,
} from '@/lib/arkiv/client';

/** Braga chain id (Arkiv current testnet). See docs.arkiv.network/networks/braga */
const BRAGA_CHAIN_ID = 60138453102;

/** Well-known anvil-style key: never use on mainnet; only for client construction in tests */
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

describe('Arkiv explorer URLs (Braga)', () => {
  it('uses Braga explorer host', () => {
    expect(ARKIV_EXPLORER_BASE_URL).toBe('https://explorer.braga.hoodi.arkiv.network');
    expect(ARKIV_EXPLORER_BASE_URL).not.toMatch(/kaolin/i);
  });

  it('builds transaction URLs', () => {
    const hash = '0xabc123';
    expect(getArkivExplorerTxUrl(hash)).toBe(
      'https://explorer.braga.hoodi.arkiv.network/tx/0xabc123'
    );
  });

  it('builds entity URLs', () => {
    expect(getArkivExplorerEntityUrl('ent_1')).toBe(
      'https://explorer.braga.hoodi.arkiv.network/entity/ent_1'
    );
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

describe('Arkiv client chain (Braga)', () => {
  it('getPublicClient uses Braga id and GLM native currency', () => {
    const client = getPublicClient();
    expect(Number(client.chain?.id)).toBe(BRAGA_CHAIN_ID);
    expect(client.chain?.name).toMatch(/Braga/i);
    expect(client.chain?.nativeCurrency?.symbol).toBe('GLM');
  });

  it('getWalletClientFromPrivateKey uses Braga', () => {
    const wallet = getWalletClientFromPrivateKey(TEST_PRIVATE_KEY);
    expect(Number(wallet.chain?.id)).toBe(BRAGA_CHAIN_ID);
    expect(wallet.chain?.nativeCurrency?.symbol).toBe('GLM');
  });

  it('getWalletClientFromMetaMask throws without injected provider', () => {
    expect(() => getWalletClientFromMetaMask('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266')).toThrow(
      /MetaMask not available/i
    );
  });
});
