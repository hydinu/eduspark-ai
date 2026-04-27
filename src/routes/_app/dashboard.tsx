import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/AppShell";
import { LayoutDashboard, MessageSquare, BookOpen, Brain, Mic, TrendingUp, Sparkles, ArrowRight, Trophy, Flame } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [attempts, quizzes, courses, interviews] = await Promise.all([
        supabase.from("quiz_attempts").select("score,total,created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
        supabase.from("course_progress").select("status"),
        supabase.from("interview_sessions").select("score,created_at").order("created_at", { ascending: false }).limit(5),
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
        coursesBookmarked: c.filter(x => x.status === "bookmarked").length,
        coursesInProgress: c.filter(x => x.status === "in_progress").length,
        coursesDone: c.filter(x => x.status === "completed").length,
        recentAttempts: att.slice(0, 5),
        interviewCount: interviews.data?.length ?? 0,
        avgInterviewScore: interviews.data?.length ? Math.round(interviews.data.reduce((a, b) => a + (b.score ?? 0), 0) / interviews.data.length) : 0,
      };
    },
  });

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <PageHeader
        icon={LayoutDashboard}
        title={`${greet}, ${name} 👋`}
        description="Here's your learning at a glance."
      />

      {/* Quick action cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ActionCard to="/chat" icon={MessageSquare} title="Ask AI Tutor" subtitle="Get instant answers" gradient />
        <ActionCard to="/courses" icon={BookOpen} title="Find Courses" subtitle="Personalized picks" />
        <ActionCard to="/quizzes" icon={Brain} title="Take a Quiz" subtitle="Test yourself" />
        <ActionCard to="/interview" icon={Mic} title="Mock Interview" subtitle="Practice & improve" />
      </div>

      {/* Stats */}
      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Average quiz score</span>
            <Trophy className="h-4 w-4 text-warning" />
          </div>
          <div className="text-3xl font-bold">{stats?.avgPct ?? 0}%</div>
          <Progress value={stats?.avgPct ?? 0} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-2">{stats?.attempts ?? 0} attempts so far</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Courses tracked</span>
            <BookOpen className="h-4 w-4 text-primary" />
          </div>
          <div className="text-3xl font-bold">{(stats?.coursesBookmarked ?? 0) + (stats?.coursesInProgress ?? 0) + (stats?.coursesDone ?? 0)}</div>
          <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
            <span>📌 {stats?.coursesBookmarked ?? 0}</span>
            <span>🚀 {stats?.coursesInProgress ?? 0}</span>
            <span>✅ {stats?.coursesDone ?? 0}</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">Interview practice</span>
            <Flame className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-3xl font-bold">{stats?.interviewCount ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-3">Avg score: <span className="font-semibold text-foreground">{stats?.avgInterviewScore ?? 0}/100</span></p>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Recent quiz attempts</h2>
          <Link to="/quizzes"><Button variant="ghost" size="sm">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></Link>
        </div>
        {(!stats?.recentAttempts || stats.recentAttempts.length === 0) ? (
          <div className="py-12 text-center text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No quiz attempts yet. Start your first quiz!</p>
            <Link to="/quizzes"><Button className="mt-4">Generate a quiz</Button></Link>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.recentAttempts.map((a, i) => {
              const pct = Math.round((a.score / a.total) * 100);
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <div className="text-sm font-medium">Quiz attempt</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{a.score}/{a.total}</div>
                    <div className={`text-xs ${pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>{pct}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, subtitle, gradient }: { to: string; icon: any; title: string; subtitle: string; gradient?: boolean }) {
  return (
    <Link to={to as any}>
      <Card className={`p-5 hover:shadow-soft transition-all group cursor-pointer h-full ${gradient ? "bg-gradient-primary text-primary-foreground border-0" : ""}`}>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${gradient ? "bg-white/20" : "bg-primary-soft text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="font-semibold">{title}</div>
        <div className={`text-xs mt-0.5 ${gradient ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{subtitle}</div>
        <ArrowRight className="h-4 w-4 mt-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Card>
    </Link>
  );
}
