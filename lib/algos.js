// Алгоритм / механизм консенсуса для известных монет (справочник; для остальных — прочерк).
export const ALGOS = {
  BTC: 'SHA-256 (PoW)', BCH: 'SHA-256 (PoW)', BSV: 'SHA-256 (PoW)', XEC: 'SHA-256 (PoW)',
  LTC: 'Scrypt (PoW)', DOGE: 'Scrypt (PoW)', SC: 'Blake2b (PoW)', ETC: 'Etchash (PoW)', XMR: 'RandomX (PoW)',
  KAS: 'kHeavyHash (PoW)', ZEC: 'Equihash (PoW)', BTG: 'Equihash (PoW)', DASH: 'X11 (PoW)', RVN: 'KawPow (PoW)', ERG: 'Autolykos (PoW)', CFX: 'Tree-Graph (PoW/PoS)',
  ETH: 'Proof of Stake (Gasper)', BNB: 'Proof of Staked Authority', XRP: 'XRP Ledger Consensus (RPCA)', SOL: 'Proof of Stake + Proof of History',
  ADA: 'Proof of Stake (Ouroboros)', TRX: 'Delegated Proof of Stake', AVAX: 'Snowman (Proof of Stake)', TON: 'Proof of Stake (Catchain)',
  DOT: 'Nominated Proof of Stake', XLM: 'Stellar Consensus Protocol', ATOM: 'Tendermint (Proof of Stake)', NEAR: 'Nightshade (Proof of Stake)',
  ALGO: 'Pure Proof of Stake', ICP: 'Chain Key (threshold consensus)', APT: 'AptosBFT (Proof of Stake)', SUI: 'Narwhal & Bullshark (PoS)',
  HBAR: 'Hashgraph (aBFT)', POL: 'Proof of Stake', MATIC: 'Proof of Stake', OP: 'Optimistic rollup (L2)', ARB: 'Optimistic rollup (L2)',
  STX: 'Proof of Transfer', EGLD: 'Secure Proof of Stake', S: 'Lachesis (aBFT)', FTM: 'Lachesis (aBFT)', XTZ: 'Liquid Proof of Stake', EOS: 'Delegated Proof of Stake',
  NEO: 'Delegated BFT', VET: 'Proof of Authority', TAO: 'Yuma Consensus', INJ: 'Tendermint (Proof of Stake)', SEI: 'Twin-Turbo (Proof of Stake)',
  CRO: 'Proof of Authority / Tendermint', MINA: 'Ouroboros Samisika (PoS)', FIL: 'Proof of Replication / Spacetime', KAVA: 'Tendermint (Proof of Stake)',
  FLOW: 'Proof of Stake (multi-role)', ZIL: 'Proof of Stake (PBFT)', QTUM: 'Proof of Stake', XDC: 'XDPoS', IOTA: 'Tangle (DAG)', HYPE: 'HyperBFT (Proof of Stake)',
};
