import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    // Allow access if: (1) real Supabase session exists, OR (2) guest flag is set
    const { data } = await supabase.auth.getSession();
    const isGuest = typeof window !== "undefined" && localStorage.getItem("eduspark_guest") === "true";

    if (!data.session && !isGuest) {
      throw redirect({ to: "/auth" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
