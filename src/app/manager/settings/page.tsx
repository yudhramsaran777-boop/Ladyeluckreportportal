import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ProfileSettingsForm } from "@/components/profile-settings-form";

export const dynamic = "force-dynamic";

export default async function ManagerSettingsPage() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user!.id)
    .single();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" showDateFilter={false} />
      <div className="card-panel max-w-xl p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Account Settings</h2>
        <ProfileSettingsForm profile={profile} />
      </div>
    </div>
  );
}
