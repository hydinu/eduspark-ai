import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Bookmark, Play, CheckCircle2, ExternalLink, Trash2, Sparkles, ArrowRight, Calendar, TrendingUp } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_CONFIG = {
  bookmarked:  { label: "Bookmarked",  icon: Bookmark,       color: "text-blue-500",   bg: "bg-blue-500/10 border-blue-500/20" },
  in_progress: { label: "In Progress", icon: Play,           color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20" },
  completed:   { label: "Completed",   icon: CheckCircle2,   color: "text-emerald-500",bg: "bg-emerald-500/10 border-emerald-500/20" },
} as const;

export function CourseHistoryPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: courses, isLoading } = useQuery({
    queryKey: ["course-history-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_progress")
        .select("*")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const bookmarked  = courses?.filter(c => c.status === "bookmarked").length ?? 0;
  const inProgress  = courses?.filter(c => c.status === "in_progress").length ?? 0;
  const completed   = courses?.filter(c => c.status === "completed").length ?? 0;
  const total       = (courses?.length ?? 0);
  const completionPct = total ? Math.round((completed / total) * 100) : 0;

  async function updateStatus(id: string, status: "bookmarked" | "in_progress" | "completed") {
    const { error } = await supabase
      .from("course_progress")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["course-history-full"] });
    qc.invalidateQueries({ queryKey: ["course-progress"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success(`Marked as ${status.replace("_", " ")}!`);
  }

  async function remove(id: string) {
    const { error } = await supabase.from("course_progress").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["course-history-full"] });
    qc.invalidateQueries({ queryKey: ["course-progress"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    toast.success("Removed from list");
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted" />)}
      </div>
    );
  }

  if (!user) {
    return (
      <Card className="p-10 text-center">
        <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground text-sm mb-4">Sign in to track your courses</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </Card>
    );
  }

  if (!courses?.length) {
    return (
      <Card className="p-12 text-center border-dashed">
        <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-medium mb-1">No courses tracked yet</p>
        <p className="text-sm text-muted-foreground mb-5">Search a topic and bookmark courses to start tracking.</p>
        <Link to="/courses"><Button><Sparkles className="h-4 w-4 mr-2" />Find Courses</Button></Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Bookmarked",  value: bookmarked,  icon: Bookmark,     color: "text-blue-500" },
          { label: "In Progress", value: inProgress,  icon: Play,         color: "text-amber-500" },
          { label: "Completed",   value: completed,   icon: CheckCircle2, color: "text-emerald-500" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Completion bar */}
      {total > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Completion rate</span>
            <span className="font-semibold text-emerald-500">{completionPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{completed} of {total} completed</p>
        </div>
      )}

      {/* Courses list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Courses ({total})</h3>
        {courses.map((c: any) => {
          const cfg = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.bookmarked;
          const Icon = cfg.icon;
          return (
            <Card key={c.id} className="p-4 flex items-center gap-3 hover:shadow-soft transition-all">
              <div className={cn("h-10 w-10 rounded-lg border flex items-center justify-center shrink-0", cfg.bg)}>
                <Icon className={cn("h-4 w-4", cfg.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">{c.course_title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {c.source && <span className="text-xs text-muted-foreground truncate">{c.source}</span>}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(c.updated_at || c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v as any)}>
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bookmarked">📌 Bookmarked</SelectItem>
                    <SelectItem value="in_progress">🚀 In Progress</SelectItem>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                  </SelectContent>
                </Select>

                {c.course_url && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                    <a href={c.course_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Link to="/courses">
        <Button variant="outline" className="w-full">
          Find More Courses <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
