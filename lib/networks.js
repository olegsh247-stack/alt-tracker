// Сети для вкладки Pool. key — идентификатор сети в GeckoTerminal.
export const NETWORKS = [
  { key: 'eth', label: 'Ethereum', short: 'ETH', color: '#627eea', quick: ['ETH', 'USDC', 'USDT', 'WBTC'] },
  { key: 'bsc', label: 'BNB Chain', short: 'BNB', color: '#f3ba2f', quick: ['BNB', 'USDT', 'USDC', 'BTCB'] },
  { key: 'arbitrum', label: 'Arbitrum One', short: 'ARB', color: '#28a0f0', quick: ['ETH', 'USDC', 'USDT', 'ARB'] },
  { key: 'base', label: 'Base', short: 'BASE', color: '#0052ff', quick: ['ETH', 'USDC', 'cbBTC'] },
  { key: 'solana', label: 'Solana', short: 'SOL', color: '#9945ff', quick: ['SOL', 'USDC', 'USDT'] },
];
export const NETWORK_KEYS = NETWORKS.map(n => n.key);
export function networkFor(key) {
  return NETWORKS.find(n => n.key === key) || { key, label: key, short: String(key).toUpperCase(), color: '#888' };
}
