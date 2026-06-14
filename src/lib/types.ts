import type { Role } from "./constants";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  shop_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shop {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameSetting {
  id: string;
  game_code: string;
  game_name: string;
  cost_percentage: number;
  is_active: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAccount {
  id: string;
  shop_id: string;
  payment_type: "CashApp" | "Chime";
  tag: string | null;
  email: string | null;
  password: string | null;
  image_url: string | null;
  payment_link: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GameAccount {
  id: string;
  shop_id: string;
  game_code: string;
  game_name: string;
  game_link: string | null;
  admin_link: string | null;
  username: string | null;
  password: string | null;
  vendor: string | null;
  admin_name: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageSource {
  id: string;
  shop_id: string;
  page_name: string;
  platform: string;
  page_url: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftReport {
  id: string;
  shop_id: string;
  employee_id: string;
  employee_name: string;
  shift_date: string;
  shift_interval: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftGameEntry {
  id: string;
  shift_report_id: string;
  game_code: string;
  game_name: string;
  opening_coins_before_add: number;
  admin_added_coins: number;
  starting_coins_after_add: number;
  redeem_coins: number;
  ending_coins: number;
  normal_coin_difference: number;
  real_recharge: number;
  redeem_amount: number;
  game_cost_percentage: number;
  game_cost: number;
  gross_profit: number;
  true_profit: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftCashout {
  id: string;
  shift_report_id: string;
  shop_id: string;
  employee_id: string;
  customer_facebook_name: string;
  game_code: string;
  game_name: string;
  game_username: string | null;
  amount: number;
  payment_method: string;
  payment_tag: string | null;
  page_source_id: string | null;
  page_source_name: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}
