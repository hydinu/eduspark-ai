import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { QuizAttempt, InterviewSession, CourseProgress, DashboardStats } from "./useHistory";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

// ─── Token Helper ─────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function backendGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const r = await fetch(`${BACKEND}${path}`, { headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${r.status}`);
  }
  return r.json();
}

// ─── Backend-powered History Hooks ───────────────────────────────────────────
// These hit the Python backend which uses Supabase with the user's JWT.
// Use these if you prefer backend aggregation; the direct Supabase hooks
// in useHistory.ts also work and are used by default.

export function useBackendQuizHistory() {
  const { user } = useAuth();
  return useQuery<{ data: QuizAttempt[]; count: number }>({
    queryKey: ["backend-quiz-history", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => backendGet("/api/history/quizzes"),
  });
}

export function useBackendInterviewHistory() {
  const { user } = useAuth();
  return useQuery<{ data: InterviewSession[]; count: number }>({
    queryKey: ["backend-interview-history", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => backendGet("/api/history/interviews"),
  });
}

export function useBackendCourseHistory() {
  const { user } = useAuth();
  return useQuery<{ data: CourseProgress[]; count: number }>({
    queryKey: ["backend-course-history", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: () => backendGet("/api/history/courses"),
  });
}

export function useBackendDashboardStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["backend-dashboard-stats", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => backendGet("/api/history/dashboard"),
  });
}

// ─── Backend-powered Course mutations ────────────────────────────────────────

export function useBackendUpdateCourseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CourseProgress["status"] }) => {
      const headers = await getAuthHeaders();
      const r = await fetch(`${BACKEND}/api/history/courses/${id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backend-course-history"] });
      qc.invalidateQueries({ queryKey: ["course-history-full"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useBackendDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const headers = await getAuthHeaders();
      const r = await fetch(`${BACKEND}/api/history/courses/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backend-course-history"] });
      qc.invalidateQueries({ queryKey: ["course-history-full"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}
