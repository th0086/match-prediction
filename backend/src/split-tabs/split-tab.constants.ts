export const DEFAULT_SPLIT_TAB_NAME = "Champion";
export const LEGACY_DEFAULT_SPLIT_TAB_NAME = "冠軍";
export const DEFAULT_SPLIT_TAB_BASE_JACKPOT_AMOUNT_KES = 5_000_000;
export const DEFAULT_SPLIT_TAB_INVITE_AMOUNT_KES = 50;
export const PREDICTION_JACKPOT_SCOPE_PREFIX = "prediction-tab:";
export const JACKPOT_CURRENCY = "KES";

export function buildPredictionJackpotScope(splitTabId: string): string {
  return `${PREDICTION_JACKPOT_SCOPE_PREFIX}${splitTabId}`;
}