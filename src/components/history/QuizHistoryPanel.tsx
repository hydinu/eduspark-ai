import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Brain, Trophy, TrendingUp, Calendar, ChevronDown, ChevronUp, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function QuizHistoryPanel({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["quiz-history-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(topic, difficulty, questions)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const avgPct = attempts?.length
    ? Math.round(attempts.reduce((a, b) => a + Math.round((b.score / b.total) * 100), 0) / attempts.length)
    : 0;

  const best = attempts?.length
    ? Math.max(...attempts.map(a => Math.round((a.score / a.total) * 100)))
    : 0;

  const scoreColor = (pct: number) =>
    pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-500" : "text-red-500";

  const scoreBg = (pct: number) =>
    pct >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : pct >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

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
        <Brain className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-muted-foreground text-sm mb-4">Sign in to view your quiz history</p>
        <Link to="/auth"><Button>Sign In</Button></Link>
      </Card>
    );
  }

  if (!attempts?.length) {
    return (
      <Card className="p-12 text-center border-dashed">
        <Brain className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-medium mb-1">No quiz attempts yet</p>
        <p className="text-sm text-muted-foreground mb-5">Take your first quiz to start tracking your progress.</p>
        <Link to="/quizzes"><Button><Sparkles className="h-4 w-4 mr-2" />Generate a Quiz</Button></Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Attempts", value: attempts.length, icon: Brain, color: "text-primary" },
          { label: "Average Score", value: `${avgPct}%`, icon: TrendingUp, color: avgPct >= 70 ? "text-emerald-500" : "text-amber-500" },
          { label: "Best Score", value: `${best}%`, icon: Trophy, color: "text-amber-500" },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <s.icon className={`h-5 w-5 mx-auto mb-1.5 ${s.color}`} />
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Average progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Overall performance</span>
          <span className={cn("font-semibold", scoreColor(avgPct))}>{avgPct}%</span>
        </div>
        <Progress value={avgPct} className="h-2" />
      </div>

      {/* Attempts list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Attempts</h3>
        {attempts.map((a: any) => {
          const pct = Math.round((a.score / a.total) * 100);
          const isOpen = expanded === a.id;
          const questions: any[] = a.quizzes?.questions ?? [];
          const answers: Record<number, number> = a.answers ?? {};

          return (
            <Card key={a.id} className={cn("overflow-hidden border transition-all", isOpen && "shadow-soft")}>
              <button
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/30 transition-colors"
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                <div className={cn("h-12 w-12 rounded-xl border flex items-center justify-center text-lg font-bold shrink-0", scoreBg(pct))}>
                  <span className={scoreColor(pct)}>{pct}%</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{a.quizzes?.topic || "Quiz"}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{a.quizzes?.difficulty ?? "medium"}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{a.score}/{a.total}</div>
                  <div className="text-xs text-muted-foreground">correct</div>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1 shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 shrink-0" />}
              </button>

              {/* Expanded: per-question breakdown */}
              {isOpen && questions.length > 0 && (
                <div className="border-t bg-secondary/20 p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question Breakdown</p>
                  {questions.map((q: any, qi: number) => {
                    const userAns = answers[qi];
                    const correct = userAns === q.correct_index;
                    return (
                      <div key={qi} className={cn("rounded-lg p-3 border text-sm", correct ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20")}>
                        <p className="font-medium mb-1 text-xs text-muted-foreground">Q{qi + 1}</p>
                        <p className="mb-2">{q.question}</p>
                        <div className="flex gap-2 flex-wrap text-xs">
                          <span className={cn("px-2 py-0.5 rounded-full font-medium", correct ? "bg-emerald-500/20 text-emerald-700" : "bg-red-500/20 text-red-700")}>
                            {correct ? "✓ Correct" : `✗ You: ${q.options?.[userAns] ?? "Unanswered"}`}
                          </span>
                          {!correct && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700">
                              ✓ Correct: {q.options?.[q.correct_index]}
                            </span>
                          )}
                        </div>
                        {q.explanation && <p className="mt-2 text-xs text-muted-foreground">{q.explanation}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Link to="/quizzes">
        <Button variant="outline" className="w-full">
          Take New Quiz <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
