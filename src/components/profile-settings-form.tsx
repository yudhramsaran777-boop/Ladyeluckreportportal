"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ProfileSettingsFormProps {
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
  } | null;
}

export function ProfileSettingsForm({ profile }: ProfileSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Saved successfully.");
    router.refresh();
  }

  if (!profile) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <div className="rounded-lg border border-positive/40 bg-positive/10 px-3 py-2 text-sm text-positive">
          {message}
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm text-emerald-200/80">Full Name</label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-panelborder bg-emerald-950/60 px-3 py-2 text-sm text-white outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-emerald-200/80">Email</label>
        <input
          type="text"
          value={profile.email || ""}
          disabled
          className="w-full rounded-lg border border-panelborder bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200/50"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-emerald-200/80">Role</label>
        <input
          type="text"
          value={profile.role}
          disabled
          className="w-full rounded-lg border border-panelborder bg-emerald-950/30 px-3 py-2 text-sm capitalize text-emerald-200/50"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-gradient-to-r from-gold-dark to-gold px-4 py-2 text-sm font-semibold text-emerald-950 hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </form>
  );
}
