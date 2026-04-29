import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, Trophy, TrendingUp, Calendar, ChevronDown, ChevronUp, Sparkles, ArrowRight, Bot, User as UserIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function InterviewHistoryPanel() {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["interview-history-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("interview_sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const avgScore = sessions?.length
    ? Math.round(sessions.reduce((a, b) => a + (b.score ?? 0), 0) / sessions.length)
    : 0;

  const best = sessions?.length ? Math.max(...sessions.map(s => s.score ?? 0)) : 0;

  const scoreColor = (s: number) =>
    s >= 80 ? "text-emerald-500" : s >= 50 ? "text-amber-500" : "text-red-500";

  const scoreBg = (s: number) =>
    s >= 80 ? "bg-emerald-500/10 border-emerald-500/20"
    : s >= 50 ? "bg-amber-500/10 border-amber-500/20"
    : "bg-red-500/10 border-red-500/20";

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
        <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground text-sm mb-4">Sign in to view your interview history</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </Card>
    );
  }

  if (!sessions?.length) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Mic className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-medium mb-1">No interview sessions yet</p>
        <p className="text-sm text-muted-foreground mb-5">Practice a mock interview to start building your record.</p>
        <Link to="/interview"><Button><Sparkles className="h-4 w-4 mr-2" />Start Mock Interview</Button></Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Sessions", value: sessions.length, icon: Mic, color: "text-primary" },
          { label: "Average Score", value: `${avgScore}/100`, icon: TrendingUp, color: avgScore >= 70 ? "text-emerald-500" : "text-amber-500" },
          { label: "Best Score", value: `${best}/100`, icon: Trophy, color: "text-amber-500" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Score trend bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Last 5 scores</span>
        </div>
        <div className="flex gap-1 h-10 items-end">
          {sessions.slice(0, 5).reverse().map((s, i) => {
            const h = Math.max(8, ((s.score ?? 0) / 100) * 40);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-sm transition-all", (s.score ?? 0) >= 80 ? "bg-emerald-500" : (s.score ?? 0) >= 50 ? "bg-amber-500" : "bg-red-400")}
                  style={{ height: h }}
                />
                <span className="text-[9px] text-muted-foreground">{s.score ?? "?"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Sessions</h3>
        {sessions.map((s: any) => {
          const isOpen = expanded === s.id;
          const transcript: { role: string; content: string }[] = s.transcript ?? [];

          return (
            <Card key={s.id} className={cn("overflow-hidden border transition-all", isOpen && "shadow-soft")}>
              <button
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpanded(isOpen ? null : s.id)}
              >
                <div className={cn("h-12 w-12 rounded-xl border flex items-center justify-center text-lg font-bold shrink-0", scoreBg(s.score ?? 0))}>
                  <span className={scoreColor(s.score ?? 0)}>{s.score ?? "?"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.role_topic}</div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    &nbsp;•&nbsp;{transcript.length} turns
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant={s.score >= 80 ? "default" : s.score >= 50 ? "secondary" : "destructive"} className="text-xs">
                    {s.score >= 80 ? "Excellent" : s.score >= 50 ? "Good" : "Needs work"}
                  </Badge>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
              </button>

              {/* Expanded: feedback + transcript */}
              {isOpen && (
                <div className="border-t bg-secondary/20 p-4 space-y-4">
                  {s.feedback && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">AI Feedback</p>
                      <div className="bg-card rounded-lg p-4 text-sm whitespace-pre-wrap border leading-relaxed">{s.feedback}</div>
                    </div>
                  )}
                  {transcript.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Transcript ({transcript.length} messages)</p>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {transcript.map((t, i) => (
                          <div key={i} className={cn("flex gap-2", t.role === "candidate" ? "flex-row-reverse" : "")}>
                            <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-white",
                              t.role === "candidate" ? "bg-primary" : "bg-gradient-to-br from-violet-500 to-primary")}>
                              {t.role === "candidate" ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                            </div>
                            <div className={cn("max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                              t.role === "candidate"
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-card border rounded-tl-none")}>
                              {t.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Link to="/interview">
        <Button variant="outline" className="w-full">
          Start New Session <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
