// Сети для вкладки Pool. key — идентификатор сети в GeckoTerminal.
export const NETWORKS = [
  { key: 'eth', label: 'Ethereum', short: 'ETH', color: '#627eea' },
  { key: 'bsc', label: 'BNB Chain', short: 'BNB', color: '#f3ba2f' },
  { key: 'arbitrum', label: 'Arbitrum One', short: 'ARB', color: '#28a0f0' },
  { key: 'base', label: 'Base', short: 'BASE', color: '#0052ff' },
  { key: 'solana', label: 'Solana', short: 'SOL', color: '#9945ff' },
];
export const NETWORK_KEYS = NETWORKS.map(n => n.key);
export function networkFor(key) {
  return NETWORKS.find(n => n.key === key) || { key, label: key, short: String(key).toUpperCase(), color: '#888' };
}
