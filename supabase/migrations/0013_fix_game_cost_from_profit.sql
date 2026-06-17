-- ============================================================================
-- Lady E Luck Portal - Migration 0013
-- Fix game_cost and true_profit to always derive from normal_coin_difference
-- (profit), never from real_recharge / total_recharge / shop_recharge.
--
-- Correct formulas:
--   normal_coin_difference = starting_coins_after_add - ending_coins
--   real_recharge          = starting_coins_after_add + redeem_coins - ending_coins
--   game_cost              = GREATEST(normal_coin_difference, 0) * game_cost_percentage / 100
--   true_profit            = normal_coin_difference - game_cost
--
-- real_recharge is a separate reporting metric and must NOT affect game_cost.
-- ============================================================================

UPDATE public.shift_game_entries
SET
  -- Re-derive from source columns to be certain
  normal_coin_difference = starting_coins_after_add - ending_coins,
  real_recharge          = starting_coins_after_add + redeem_coins - ending_coins,
  gross_profit           = starting_coins_after_add - ending_coins,

  -- Game cost: only on positive profit; zero when profit is zero or negative
  game_cost = CASE
    WHEN (starting_coins_after_add - ending_coins) > 0
      THEN ((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100
    ELSE 0
  END,

  -- True profit = profit - game_cost (game_cost is 0 when profit <= 0)
  true_profit = (starting_coins_after_add - ending_coins) - CASE
    WHEN (starting_coins_after_add - ending_coins) > 0
      THEN ((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100
    ELSE 0
  END;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
