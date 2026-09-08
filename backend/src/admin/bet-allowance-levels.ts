export type BetAllowanceLevel = {
  level: number;
  depositMin: number;
  betMinExclusive: number;
  grantedChances: number;
};

export const DEFAULT_BET_ALLOWANCE_LEVELS: BetAllowanceLevel[] = [
  { level: 1, depositMin: 200, betMinExclusive: 777, grantedChances: 1 },
  { level: 2, depositMin: 500, betMinExclusive: 3777, grantedChances: 2 },
  { level: 3, depositMin: 1000, betMinExclusive: 7777, grantedChances: 3 },
  { level: 4, depositMin: 2000, betMinExclusive: 17777, grantedChances: 5 },
  { level: 5, depositMin: 5000, betMinExclusive: 37777, grantedChances: 5 },
  { level: 6, depositMin: 10000, betMinExclusive: 77777, grantedChances: 10 },
];

export function normalizeBetAllowanceLevels(levels: BetAllowanceLevel[]): BetAllowanceLevel[] {
  return levels
    .map((item, index) => ({
      level: index + 1,
      depositMin: Math.max(0, Math.floor(item.depositMin)),
      betMinExclusive: Math.max(0, Math.floor(item.betMinExclusive)),
      grantedChances: Math.max(0, Math.floor(item.grantedChances)),
    }))
    .slice(0, 6);
}
