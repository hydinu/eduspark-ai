import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total: number;
  answers: Record<number, number>;
  created_at: string;
  quizzes?: {
    topic: string;
    difficulty: string;
    questions: QuizQuestion[];
  };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  role_topic: string;
  transcript: { role: "interviewer" | "candidate"; content: string }[];
  feedback: string | null;
  score: number | null;
  created_at: string;
}

export interface CourseProgress {
  id: string;
  user_id: string;
  course_title: string;
  course_url: string | null;
  source: string | null;
  status: "bookmarked" | "in_progress" | "completed";
  created_at: string;
  updated_at: string;
}

// ─── Quiz History ─────────────────────────────────────────────────────────────

export function useQuizHistory(limit = 50) {
  const { user } = useAuth();
  return useQuery<QuizAttempt[]>({
    queryKey: ["quiz-history-full", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(topic, difficulty, questions)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as QuizAttempt[];
    },
  });
}

// ─── Interview History ────────────────────────────────────────────────────────

export function useInterviewHistory(limit = 50) {
  const { user } = useAuth();
  return useQuery<InterviewSession[]>({
    queryKey: ["interview-history-full", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interview_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as InterviewSession[];
    },
  });
}

// ─── Course History ───────────────────────────────────────────────────────────

export function useCourseHistory() {
  const { user } = useAuth();
  return useQuery<CourseProgress[]>({
    queryKey: ["course-history-full", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_progress")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as CourseProgress[];
    },
  });
}

export function useUpdateCourseStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CourseProgress["status"] }) => {
      const { error } = await supabase
        .from("course_progress")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-history-full"] });
      qc.invalidateQueries({ queryKey: ["course-progress"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_progress").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-history-full"] });
      qc.invalidateQueries({ queryKey: ["course-progress"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Dashboard summary stats ──────────────────────────────────────────────────

export interface DashboardStats {
  avgPct: number;
  attempts: number;
  quizCount: number;
  coursesBookmarked: number;
  coursesInProgress: number;
  coursesDone: number;
  recentAttempts: { score: number; total: number; created_at: string }[];
  interviewCount: number;
  avgInterviewScore: number;
}

export function useDashboardStats() {
  const { user } = useAuth();
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const [attempts, quizzes, courses, interviews] = await Promise.all([
        supabase
          .from("quiz_attempts")
          .select("score,total,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
        supabase.from("course_progress").select("status"),
        supabase
          .from("interview_sessions")
          .select("score,created_at")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const att = attempts.data ?? [];
      const totalScore = att.reduce((a, b) => a + b.score, 0);
      const totalPossible = att.reduce((a, b) => a + b.total, 0);
      const avgPct = totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0;
      const c = courses.data ?? [];

      return {
        avgPct,
        attempts: att.length,
        quizCount: quizzes.count ?? 0,
        coursesBookmarked: c.filter((x) => x.status === "bookmarked").length,
        coursesInProgress: c.filter((x) => x.status === "in_progress").length,
        coursesDone: c.filter((x) => x.status === "completed").length,
        recentAttempts: att.slice(0, 5),
        interviewCount: interviews.data?.length ?? 0,
        avgInterviewScore: interviews.data?.length
          ? Math.round(
              interviews.data.reduce((a, b) => a + (b.score ?? 0), 0) / interviews.data.length,
            )
          : 0,
      };
    },
  });
}
