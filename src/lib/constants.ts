// Supported games and default cost percentages.
// IMPORTANT: Juwa 3 does not exist. Only the games below are supported.

export type GameCode =
  | "JW"
  | "JW2"
  | "FK"
  | "MW"
  | "GV"
  | "OS"
  | "UP"
  | "VR"
  | "CF"
  | "PD";

export interface GameDef {
  code: GameCode;
  name: string;
  defaultCostPercentage: number;
}

export const GAMES: GameDef[] = [
  { code: "JW", name: "Juwa", defaultCostPercentage: 11 },
  { code: "JW2", name: "Juwa 2", defaultCostPercentage: 12 },
  { code: "FK", name: "Fire Kirin", defaultCostPercentage: 12 },
  { code: "MW", name: "Milky Way", defaultCostPercentage: 13 },
  { code: "GV", name: "Game Vault", defaultCostPercentage: 12 },
  { code: "OS", name: "Orion Stars", defaultCostPercentage: 15 },
  { code: "UP", name: "Ultra Panda", defaultCostPercentage: 10 },
  { code: "VR", name: "Vegas Roll", defaultCostPercentage: 10 },
  { code: "CF", name: "Cash Frenzy", defaultCostPercentage: 10 },
  { code: "PD", name: "Panda Master", defaultCostPercentage: 12 },
];

export const GAME_NAME_BY_CODE: Record<string, string> = GAMES.reduce(
  (acc, g) => ({ ...acc, [g.code]: g.name }),
  {} as Record<string, string>
);

export const PAYMENT_METHODS = [
  "CashApp",
  "Chime",
  "Zelle",
  "Venmo",
  "Bitcoin",
  "Other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TAG_LABELS: Record<PaymentMethod, string> = {
  CashApp: "CashTag",
  Chime: "ChimeTag",
  Zelle: "Zelle Email / Phone",
  Venmo: "Venmo Username",
  Bitcoin: "Bitcoin Wallet",
  Other: "Payment Info",
};

export const SHIFT_INTERVALS = [
  "Morning (8AM - 4PM)",
  "Afternoon (4PM - 12AM)",
  "Night (12AM - 8AM)",
  "Custom",
] as const;

export type Role = "owner" | "manager" | "employee";

export const ROLE_LABELS: Record<Role, string> = {
  owner: "OWNER ACCESS",
  manager: "MANAGER ACCESS",
  employee: "EMPLOYEE ACCESS",
};
