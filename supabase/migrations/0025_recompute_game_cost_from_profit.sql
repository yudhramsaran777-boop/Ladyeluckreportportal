-- ============================================================================
-- Lady E Luck Portal - Migration 0025
-- Re-derive game_cost and true_profit strictly from shop profit
-- (normal_coin_difference), never from real_recharge.
--
-- Formula:
--   normal_coin_difference = starting_coins_after_add - ending_coins  (PROFIT)
--   real_recharge          = starting_coins_after_add + redeem_coins - ending_coins
--                            (real_recharge is a display metric ONLY — never used
--                             in game_cost or true_profit calculations)
--
--   game_cost   = GREATEST(normal_coin_difference, 0) * game_cost_percentage / 100
--                 (zero when profit is zero or negative — shop owes no fee on losses)
--   true_profit = normal_coin_difference - game_cost
--
-- This migration is idempotent and safe to re-run.
-- ============================================================================

UPDATE public.shift_game_entries
SET
  -- Re-derive profit and recharge from source columns (belt-and-suspenders)
  normal_coin_difference = starting_coins_after_add - ending_coins,
  real_recharge          = starting_coins_after_add + redeem_coins - ending_coins,
  gross_profit           = starting_coins_after_add - ending_coins,

  -- Game cost: derived from PROFIT only, zero when profit <= 0
  game_cost = CASE
    WHEN (starting_coins_after_add - ending_coins) > 0
      THEN GREATEST((starting_coins_after_add - ending_coins) * game_cost_percentage / 100, 0)
    ELSE 0
  END,

  -- True profit = profit - game_cost
  true_profit = (starting_coins_after_add - ending_coins) - CASE
    WHEN (starting_coins_after_add - ending_coins) > 0
      THEN GREATEST((starting_coins_after_add - ending_coins) * game_cost_percentage / 100, 0)
    ELSE 0
  END;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
