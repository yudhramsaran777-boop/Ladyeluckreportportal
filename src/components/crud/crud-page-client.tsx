"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink, Copy } from "lucide-react";
import clsx from "clsx";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { RecordFormModal } from "./record-form-modal";
import { formatCurrency } from "@/lib/calculations";
import { GAME_NAME_BY_CODE } from "@/lib/constants";
import type { ColumnConfig, FieldConfig } from "./types";

export type TransformType = "gameAccount" | "gameSettingsActive";

function normalizePaymentAccount(values: Record<string, any>, userId: string | undefined): Record<string, any> {
  const paymentTypeKey = String(values.payment_type || "").trim().toLowerCase().replace(/[\s_-]/g, "");
  const statusKey = String(values.status || "active").trim().toLowerCase();
  const payment_type = paymentTypeKey === "chime" || paymentTypeKey === "chimetag" ? "Chime" : "CashApp";
  const status = statusKey === "inactive" ? "inactive" : "active";

  return {
    ...values,
    payment_type,
    status,
    ...(userId ? { created_by: values.created_by || userId } : {}),
  };
}

function normalizeGameAccount(values: Record<string, any>, userId: string | undefined): Record<string, any> {
  const statusKey = String(values.status || "active").trim().toLowerCase();
  return {
    ...values,
    status: statusKey === "inactive" ? "inactive" : "active",
    ...(userId ? { created_by: values.created_by || userId } : {}),
  };
}

function applyTransform(transformType: TransformType | undefined, values: Record<string, any>): Record<string, any> {
  switch (transformType) {
    case "gameAccount":
      return {
        ...values,
        game_name: GAME_NAME_BY_CODE[values.game_code] || values.game_code,
      };
    case "gameSettingsActive":
      return {
        ...values,
        is_active: values.is_active === "active" || values.is_active === true,
      };
    default:
      return values;
  }
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  owner: "bg-gold/15 text-gold border-gold/30",
  manager: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  employee: "bg-emerald-700/20 text-emerald-200 border-emerald-700/40",
};

function RoleBadge({ role }: { role: string }) {
  const key = (role || "").toLowerCase();
  const style = ROLE_BADGE_STYLES[key] || "bg-emerald-700/20 text-emerald-200 border-emerald-700/40";
  return (
    <span className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium capitalize", style)}>
      {role || "—"}
    </span>
  );
}

const PAYMENT_TYPE_BADGE_STYLES: Record<string, string> = {
  cashapp: "bg-positive/15 text-positive border-positive/30",
  chime: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function PaymentTypeBadge({ paymentType }: { paymentType: string }) {
  const key = (paymentType || "").toLowerCase();
  const style = PAYMENT_TYPE_BADGE_STYLES[key] || "bg-emerald-700/20 text-emerald-200 border-emerald-700/40";
  return (
    <span className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium", style)}>
      {paymentType || "—"}
    </span>
  );
}

function GameBadge({ gameName }: { gameName: string }) {
  return (
    <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-xs font-medium text-gold">
      {gameName || "—"}
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <StatusBadge status={isActive ? "active" : "inactive"} />;
}

function PasswordCell({ value }: { value: string | null | undefined }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <span>—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono">{visible ? value : "••••••••"}</span>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-emerald-200/60 hover:text-gold"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function LinkCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-emerald-200/40 text-xs">No link</span>;
  const display = value.length > 40 ? value.slice(0, 38) + "…" : value;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-emerald-200/80 max-w-[160px] truncate" title={value}>{display}</span>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value)}
        className="text-emerald-200/60 hover:text-gold flex-shrink-0"
        aria-label="Copy link"
      >
        <Copy size={13} />
      </button>
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-200/60 hover:text-gold flex-shrink-0"
        aria-label="Open link"
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

function getByPath(row: Record<string, any>, path: string): any {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), row);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

function renderCell(column: ColumnConfig, row: Record<string, any>) {
  const rawValue =
    column.render === "relation"
      ? getByPath(row, column.relationKey || column.key)
      : row[column.key];

  switch (column.render) {
    case "currency":
      return formatCurrency(Number(rawValue) || 0);
    case "percent":
      return `${Number(rawValue) || 0}%`;
    case "date":
      return formatDate(rawValue);
    case "statusBadge":
      return <StatusBadge status={rawValue} />;
    case "roleBadge":
      return <RoleBadge role={rawValue} />;
    case "gameBadge":
      return <GameBadge gameName={rawValue} />;
    case "paymentTypeBadge":
      return <PaymentTypeBadge paymentType={rawValue} />;
    case "activeBadge":
      return <ActiveBadge isActive={Boolean(rawValue)} />;
    case "image":
      return rawValue ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rawValue}
          alt="Account"
          className="h-10 w-10 rounded-lg object-cover border border-panelborder"
        />
      ) : (
        <span>—</span>
      );
    case "password":
      return <PasswordCell value={rawValue} />;
    case "link":
      return <LinkCell value={rawValue} />;
    case "relation":
      return rawValue ?? column.fallback ?? "—";
    default:
      if (column.key === "status" && rawValue !== undefined) {
        return <StatusBadge status={rawValue} />;
      }
      return rawValue ?? column.fallback ?? "—";
  }
}

interface CrudPageClientProps {
  table: string;
  columns: ColumnConfig[];
  fields: FieldConfig[];
  rows: Record<string, any>[];
  emptyMessage: string;
  emptyHint?: string;
  addLabel?: string;
  fixedValues?: Record<string, any>;
  canEdit?: boolean;
  canDelete?: boolean;
  canAdd?: boolean;
  imageField?: string; // field name that maps to image_url
  transformType?: TransformType;
}

export function CrudPageClient({
  table,
  columns,
  fields,
  rows,
  emptyMessage,
  emptyHint,
  addLabel = "Add New",
  fixedValues = {},
  canEdit = true,
  canDelete = true,
  canAdd = true,
  imageField,
  transformType,
}: CrudPageClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);

  async function handleSubmit(values: Record<string, any>) {
    const { __imageFile, ...rest } = values;
    // Strip out image-type fields — they are not DB columns.
    // image_url is handled separately via Supabase Storage upload.
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(rest)) {
      const field = fields.find((f) => f.name === k);
      if (field?.type === "image") continue;
      payload[k] = v;
    }
    // Apply fixed values
    for (const [k, v] of Object.entries(fixedValues)) {
      payload[k] = v;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const normalizedPayload =
      table === "payment_accounts"
        ? normalizePaymentAccount(payload, user?.id)
        : table === "game_accounts"
          ? normalizeGameAccount(payload, user?.id)
          : payload;
    // Apply transform
    const transformed = applyTransform(transformType, normalizedPayload);

    // Handle image upload if present
    if (__imageFile && imageField) {
      const ext = __imageFile.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const bucket = table === "payment_accounts" ? "payment-account-images" : "account-images";
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, __imageFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);
      transformed[imageField] = publicUrlData.publicUrl;
    }

    if (editingRow) {
      const { error } = await supabase
        .from(table)
        .update(transformed)
        .eq("id", editingRow.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(transformed);
      if (error) throw error;
    }

    setModalOpen(false);
    setEditingRow(null);
    router.refresh();
  }

  async function handleDelete(row: Record<string, any>) {
    if (!confirm("Delete this record? This cannot be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {canAdd && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setEditingRow(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90"
          >
            <Plus size={16} />
            {addLabel}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card-panel p-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-emerald-200/60">{emptyMessage}</p>
            {emptyHint && <p className="text-xs text-emerald-200/40">{emptyHint}</p>}
          </div>
        </div>
      ) : (
        <div className="card-panel min-w-0 max-w-full overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-panelborder text-xs uppercase text-emerald-200/50">
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-medium">
                      {col.label}
                    </th>
                  ))}
                  {(canEdit || canDelete) && (
                    <th className="px-4 py-3 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-panelborder">
                {rows.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-emerald-900/20">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-emerald-100">
                        {renderCell(col, row)}
                      </td>
                    ))}
                    {(canEdit || canDelete) && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {canEdit && (
                            <button
                              onClick={() => {
                                setEditingRow(row);
                                setModalOpen(true);
                              }}
                              className="text-emerald-300/60 hover:text-gold"
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(row)}
                              className="text-emerald-300/60 hover:text-danger"
                              title="Delete"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <RecordFormModal
          title={editingRow ? `Edit ${addLabel}` : addLabel}
          fields={fields}
          initialValues={editingRow || undefined}
          onClose={() => {
            setModalOpen(false);
            setEditingRow(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
    </>
  );
}
