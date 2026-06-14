"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FieldConfig } from "./types";

interface RecordFormModalProps {
  title: string;
  fields: FieldConfig[];
  initialValues?: Record<string, any>;
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}

export function RecordFormModal({
  title,
  fields,
  initialValues,
  onClose,
  onSubmit,
}: RecordFormModalProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    const initial: Record<string, any> = {};
    for (const f of fields) {
      let val = initialValues?.[f.name] ?? f.defaultValue ?? "";
      if (f.type === "toggle-status" && typeof val === "boolean") {
        val = val ? "active" : "inactive";
      }
      initial[f.name] = val;
    }
    setValues(initial);
  }, [fields, initialValues]);

  function setField(name: string, value: any) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ ...values, __imageFile: imageFile });
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card-panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-emerald-200/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.name} className={f.fullWidth ? "sm:col-span-2" : ""}>
              <label className="mb-1 block text-sm text-emerald-200/80">
                {f.label}
                {f.required && <span className="text-danger"> *</span>}
              </label>

              {f.type === "textarea" && (
                <textarea
                  required={f.required}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              )}

              {f.type === "select" && (
                <select
                  required={f.required}
                  value={values[f.name] ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="">Select...</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              {f.type === "toggle-status" && (
                <select
                  value={values[f.name] ?? "active"}
                  onChange={(e) => setField(f.name, e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              )}

              {f.type === "image" && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              )}

              {(f.type === "text" || f.type === "password" || f.type === "number") && (
                <input
                  type={f.type}
                  required={f.required}
                  value={values[f.name] ?? ""}
                  onChange={(e) =>
                    setField(
                      f.name,
                      e.target.value
                    )
                  }
                  placeholder={f.placeholder}
                  step={f.type === "number" ? "any" : undefined}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-panelborder px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-800/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
