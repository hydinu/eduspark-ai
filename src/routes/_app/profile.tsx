import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/AppShell";
import { UserCircle2, Brain, Mic, BookOpen, FileText, Trophy, TrendingUp, ArrowRight, Mail, MapPin, Github, Linkedin, Briefcase, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  const name = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student";
  const avatar = (name[0] ?? "U").toUpperCase();

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id], enabled: !!user,
    queryFn: async () => {
      const [attempts, quizzes, courses, interviews, chats] = await Promise.all([
        supabase.from("quiz_attempts").select("score,total").limit(100),
        supabase.from("quizzes").select("id", { count: "exact", head: true }),
        supabase.from("course_progress").select("status"),
        supabase.from("interview_sessions").select("score").limit(50),
        supabase.from("chat_conversations").select("id", { count: "exact", head: true }),
      ]);
      const att = attempts.data ?? [];
      const totalScore = att.reduce((a, b) => a + b.score, 0);
      const totalPossible = att.reduce((a, b) => a + b.total, 0);
      const c = courses.data ?? [];
      const iv = interviews.data ?? [];
      return {
        avgQuiz: totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0,
        quizAttempts: att.length, quizCount: quizzes.count ?? 0,
        coursesSaved: c.filter(x => x.status === "bookmarked").length,
        coursesActive: c.filter(x => x.status === "in_progress").length,
        coursesDone: c.filter(x => x.status === "completed").length,
        interviewCount: iv.length,
        avgInterview: iv.length ? Math.round(iv.reduce((a, b) => a + (b.score ?? 0), 0) / iv.length) : 0,
        chatCount: chats.count ?? 0,
      };
    },
  });

  // Resume
  const { data: resume } = useQuery({
    queryKey: ["resume", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_resumes").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const skillsList = resume?.skills ? Object.values(resume.skills as Record<string, string[]>).flat() : [];
  const projectCount = Array.isArray(resume?.projects) ? (resume.projects as any[]).filter(p => p.title).length : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto">
      <PageHeader icon={UserCircle2} title="My Profile" description="Your learning journey at a glance." />

      {/* Profile Card */}
      <Card className="p-5 sm:p-8 mb-6 bg-gradient-card border-primary/10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-primary flex items-center justify-center text-3xl font-bold text-primary-foreground shadow-glow shrink-0">
            {avatar}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h2 className="text-2xl font-bold">{resume?.full_name || name}</h2>
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
              {user?.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user.email}</span>}
              {resume?.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{resume.location}</span>}
              {resume?.github && <span className="flex items-center gap-1"><Github className="h-3.5 w-3.5" />{resume.github}</span>}
              {resume?.linkedin && <span className="flex items-center gap-1"><Linkedin className="h-3.5 w-3.5" />{resume.linkedin}</span>}
            </div>
            {resume?.target_roles && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 px-3 py-1 rounded-full">
                <Briefcase className="h-3 w-3" /> Open to: {resume.target_roles}
              </div>
            )}
          </div>
          <Link to="/resume"><Button variant="outline" size="sm" className="shrink-0"><FileText className="h-4 w-4 mr-1.5" />Edit Resume</Button></Link>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard icon={Brain} label="Quiz Score" value={`${stats?.avgQuiz ?? 0}%`} sub={`${stats?.quizAttempts ?? 0} attempts`} color="text-primary" />
        <StatCard icon={Mic} label="Interviews" value={String(stats?.interviewCount ?? 0)} sub={`Avg ${stats?.avgInterview ?? 0}/100`} color="text-destructive" />
        <StatCard icon={BookOpen} label="Courses" value={String((stats?.coursesSaved ?? 0) + (stats?.coursesActive ?? 0) + (stats?.coursesDone ?? 0))} sub={`${stats?.coursesDone ?? 0} completed`} color="text-success" />
        <StatCard icon={TrendingUp} label="AI Chats" value={String(stats?.chatCount ?? 0)} sub="Conversations" color="text-warning" />
      </div>

      {/* Skills & Projects from Resume */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" />My Skills</h3>
            <Link to="/resume"><Button variant="ghost" size="sm" className="text-xs">Edit</Button></Link>
          </div>
          {skillsList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {skillsList.map((s, i) => <span key={i} className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">{s}</span>)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No skills added yet. <Link to="/resume" className="text-primary underline">Add them in your resume</Link></p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />My Projects</h3>
            <Link to="/resume"><Button variant="ghost" size="sm" className="text-xs">Edit</Button></Link>
          </div>
          {projectCount > 0 ? (
            <div className="space-y-2">
              {(resume!.projects as any[]).filter(p => p.title).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{p.title}</div>
                    {p.tech_stack && <div className="text-xs text-muted-foreground">{p.tech_stack}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No projects added. <Link to="/resume" className="text-primary underline">Add them</Link></p>
          )}
        </Card>
      </div>

      {/* Progress Bars */}
      <Card className="p-5 mb-6">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" />Learning Progress</h3>
        <div className="space-y-4">
          <ProgressRow label="Quiz Mastery" value={stats?.avgQuiz ?? 0} />
          <ProgressRow label="Interview Readiness" value={stats?.avgInterview ?? 0} />
          <ProgressRow label="Course Completion" value={
            ((stats?.coursesDone ?? 0) + (stats?.coursesActive ?? 0) + (stats?.coursesSaved ?? 0)) > 0
              ? Math.round(((stats?.coursesDone ?? 0) / ((stats?.coursesDone ?? 0) + (stats?.coursesActive ?? 0) + (stats?.coursesSaved ?? 0))) * 100)
              : 0
          } />
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickLink to="/chat" icon={TrendingUp} label="AI Tutor" />
        <QuickLink to="/quizzes" icon={Brain} label="Take Quiz" />
        <QuickLink to="/interview" icon={Mic} label="Interview" />
        <QuickLink to="/resume" icon={FileText} label="Resume" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub: string; color: string }) {
  return (
    <Card className="p-4">
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", color === "text-primary" ? "bg-primary/10" : color === "text-destructive" ? "bg-destructive/10" : color === "text-success" ? "bg-success/10" : "bg-warning/10")}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    </Card>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">{label}</span>
        <span className={cn("font-bold", value >= 70 ? "text-success" : value >= 40 ? "text-warning" : "text-muted-foreground")}>{value}%</span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to as any}>
      <Card className="p-4 text-center hover:shadow-soft hover:border-primary/30 transition-all cursor-pointer group">
        <Icon className="h-5 w-5 mx-auto mb-1.5 text-primary group-hover:scale-110 transition-transform" />
        <div className="text-xs font-medium">{label}</div>
      </Card>
    </Link>
  );
}
