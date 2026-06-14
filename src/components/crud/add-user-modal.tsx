"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";

interface ShopOption {
  id: string;
  name: string;
}

interface AddUserModalProps {
  roleLabel: "Manager" | "Employee";
  shops: ShopOption[];
  action: (input: {
    email: string;
    password: string;
    fullName: string;
    shopId?: string | null;
    isActive?: boolean;
  }) => Promise<{ success: boolean; message: string }>;
}

export function AddUserModal({ roleLabel, shops, action }: AddUserModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopId, setShopId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  function reset() {
    setFullName("");
    setEmail("");
    setPassword("");
    setShopId("");
    setIsActive(true);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);
    try {
      const res = await action({
        email,
        password,
        fullName,
        shopId: shopId || null,
        isActive,
      });
      setResult(res);
      if (res.success) {
        router.refresh();
      }
    } catch (err: any) {
      setResult({ success: false, message: err?.message || "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90"
        >
          <Plus size={16} />
          Add {roleLabel}
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card-panel max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add {roleLabel}</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-emerald-200/60 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {result && (
              <div
                className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                  result.success
                    ? "border-positive/40 bg-positive/10 text-positive"
                    : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {result.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-emerald-200/80">
                  Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-emerald-200/80">
                  Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-emerald-200/80">
                  Temporary Password <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-emerald-200/80">Assign Shop</label>
                <select
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="">Unassigned</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-emerald-200/80">Status</label>
                <select
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                  className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-panelborder px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-800/40"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Creating..." : `Create ${roleLabel}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
