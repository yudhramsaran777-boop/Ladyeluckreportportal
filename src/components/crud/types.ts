export type FieldType =
  | "text"
  | "number"
  | "textarea"
  | "select"
  | "password"
  | "toggle-status"
  | "image";

export interface SelectOption {
  label: string;
  value: string;
}

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  fullWidth?: boolean;
}

// Serializable "render type" vocabulary. CrudPageClient (a Client Component)
// switches on this string + column.key to decide how to display each cell.
export type RenderType =
  | "currency"
  | "percent"
  | "date"
  | "statusBadge"
  | "roleBadge"
  | "gameBadge"
  | "paymentTypeBadge"
  | "activeBadge"
  | "image"
  | "password"
  | "link"
  | "relation";

export interface ColumnConfig {
  key: string;
  label: string;
  render?: RenderType;
  relationKey?: string;
  fallback?: string;
}
