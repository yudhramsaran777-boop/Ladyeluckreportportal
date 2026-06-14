import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function MessageScreen({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md card-panel p-8 text-center">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm text-emerald-200/70">{message}</p>
      </div>
    </main>
  );
}

export default async function DashboardRedirect() {
  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userData.user.id)
    .single();

  if (!profile) {
    return (
      <MessageScreen
        title="Account not set up"
        message="Your profile is not yet configured. Please contact the owner."
      />
    );
  }

  if (!profile.is_active) {
    return (
      <MessageScreen
        title="Account inactive"
        message="Your account has been deactivated. Please contact the owner."
      />
    );
  }

  if (profile.role === "owner") redirect("/owner");
  if (profile.role === "manager") redirect("/manager");
  if (profile.role === "employee") redirect("/employee");

  return (
    <MessageScreen
      title="Unknown role"
      message="Your account role is not recognized. Please contact support."
    />
  );
}
