-- Ensure game cost only applies to positive normal coin difference / profit.
-- Negative or zero profit rows must have zero game cost and true profit equal to profit.

update public.shift_game_entries
set
  normal_coin_difference = starting_coins_after_add - ending_coins,
  real_recharge = starting_coins_after_add + redeem_coins - ending_coins,
  gross_profit = starting_coins_after_add - ending_coins,
  game_cost =
    case
      when (starting_coins_after_add - ending_coins) > 0
        then ((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100
      else 0
    end,
  true_profit =
    (starting_coins_after_add - ending_coins) -
    case
      when (starting_coins_after_add - ending_coins) > 0
        then ((starting_coins_after_add - ending_coins) * game_cost_percentage) / 100
      else 0
    end;

notify pgrst, 'reload schema';
