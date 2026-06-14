import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, shop_id, is_active")
    .eq("id", userData.user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role !== "employee" || !profile.is_active) redirect("/dashboard");

  return (
    <DashboardShell role="employee" userName={profile.full_name} userEmail={profile.email}>
      {children}
    </DashboardShell>
  );
}
