"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/empty-state";
import type { Role } from "@/lib/constants";

interface ShopOption {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  shop_id: string | null;
  is_active: boolean;
}

interface UserAssignmentTableProps {
  users: UserRow[];
  shops: ShopOption[];
  emptyMessage: string;
  emptyHint?: string;
  roleOptions?: Role[];
}

export function UserAssignmentTable({
  users,
  shops,
  emptyMessage,
  emptyHint,
  roleOptions = ["manager", "employee"],
}: UserAssignmentTableProps) {
  const router = useRouter();
  const supabase = createClient();

  async function updateUser(id: string, patch: Record<string, any>) {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  if (users.length === 0) {
    return <EmptyState message={emptyMessage} hint={emptyHint} />;
  }

  return (
    <div className="card-panel overflow-x-auto p-4">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="text-xs uppercase text-emerald-200/50">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Role</th>
            <th className="py-2 pr-4">Assigned Shop</th>
            <th className="py-2 pr-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panelborder">
          {users.map((u) => (
            <tr key={u.id}>
              <td className="py-2 pr-4 text-emerald-100">{u.full_name || "—"}</td>
              <td className="py-2 pr-4 text-emerald-100/70">{u.email}</td>
              <td className="py-2 pr-4">
                <select
                  value={u.role}
                  onChange={(e) => updateUser(u.id, { role: e.target.value })}
                  className="rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold"
                >
                  {roleOptions.map((r) => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                  <option value="owner">Owner</option>
                </select>
              </td>
              <td className="py-2 pr-4">
                <select
                  value={u.shop_id || ""}
                  onChange={(e) =>
                    updateUser(u.id, { shop_id: e.target.value || null })
                  }
                  className="rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="">Unassigned</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-2 pr-4">
                <select
                  value={u.is_active ? "active" : "inactive"}
                  onChange={(e) =>
                    updateUser(u.id, { is_active: e.target.value === "active" })
                  }
                  className="rounded-lg border border-panelborder bg-emerald-950/60 px-2 py-1 text-sm text-white outline-none focus:border-gold"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
