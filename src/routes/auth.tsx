import { createFileRoute, redirect } from "@tanstack/react-router";

// Auth is disabled — redirect straight to the app
export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});
