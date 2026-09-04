export const REWARD_COIN_RULE = {
  coinsPerBlock: 1000,
  rupeesPerBlock: 10,
} as const;

/** Fixed coins earned per completed booking. */
export const BOOKING_REWARD_COINS = 10;

/** Coins earned by referrer when a friend signs up with their code. */
export const REFERRAL_REWARD_COINS = 100;

/** Welcome coins for the friend who signs up with a referral code. */
export const REFERRAL_FRIEND_SIGNUP_COINS = 50;

/** Coins earned by referrer each time a referred friend completes a booking. */
export const REFERRAL_BOOKING_COINS = 10;

export function computeCoinRedemption(coinBalance: number, maxRupees: number) {
  const { coinsPerBlock, rupeesPerBlock } = REWARD_COIN_RULE;

  if (coinBalance < coinsPerBlock || maxRupees <= 0) {
    return {
      rupeeDiscount: 0,
      coinsToDebit: 0,
      blocksUsed: 0,
      redeemableBlocks: 0,
      redeemableAmount: 0,
      coinsToNextBlock: Math.max(0, coinsPerBlock - coinBalance),
    };
  }

  const redeemableBlocks = Math.floor(coinBalance / coinsPerBlock);
  const rupeeFromCoins = redeemableBlocks * rupeesPerBlock;
  const rupeeDiscount = Math.min(rupeeFromCoins, maxRupees);
  const blocksUsed = Math.ceil(rupeeDiscount / rupeesPerBlock);
  const coinsToDebit = blocksUsed * coinsPerBlock;

  return {
    rupeeDiscount,
    coinsToDebit,
    blocksUsed,
    redeemableBlocks,
    redeemableAmount: rupeeFromCoins,
    coinsToNextBlock: coinBalance % coinsPerBlock === 0 ? 0 : coinsPerBlock - (coinBalance % coinsPerBlock),
  };
}

export function buildRewardBalanceView(coinBalance: number) {
  const redemption = computeCoinRedemption(coinBalance, Number.MAX_SAFE_INTEGER);
  return {
    balance: coinBalance,
    unit: 'COINS' as const,
    coinsPerBlock: REWARD_COIN_RULE.coinsPerBlock,
    rupeesPerBlock: REWARD_COIN_RULE.rupeesPerBlock,
    redeemableBlocks: redemption.redeemableBlocks,
    redeemableAmount: redemption.redeemableAmount,
    coinsToNextBlock: redemption.coinsToNextBlock,
  };
}
