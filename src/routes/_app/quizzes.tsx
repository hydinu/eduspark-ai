import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiGenerateQuiz } from "@/server/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import { Brain, Loader2, Sparkles, CheckCircle2, XCircle, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quizzes")({
  component: QuizPage,
});

type Question = { question: string; options: string[]; correct_index: number; explanation: string };

function QuizPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const genFn = useServerFn(aiGenerateQuiz);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [count, setCount] = useState("5");
  const [quiz, setQuiz] = useState<{ id?: string; topic: string; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: history } = useQuery({
    queryKey: ["quiz-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("quiz_attempts").select("*, quizzes(topic,difficulty)").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => genFn({ data: { topic: topic.trim(), difficulty, count: parseInt(count, 10) } }),
    onSuccess: async (r) => {
      if (!r.questions?.length) { toast.error("Couldn't generate questions, try a different topic."); return; }
      const { data, error } = await supabase.from("quizzes").insert({
        user_id: user!.id, topic: topic.trim(), difficulty, questions: r.questions as any,
      }).select().single();
      if (error) { toast.error(error.message); return; }
      setQuiz({ id: data.id, topic: topic.trim(), questions: r.questions });
      setAnswers({});
      setSubmitted(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function submit() {
    if (!quiz?.id) return;
    const score = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0), 0);
    setSubmitted(true);
    const { error } = await supabase.from("quiz_attempts").insert({
      quiz_id: quiz.id, user_id: user!.id, score, total: quiz.questions.length, answers: answers as any,
    });
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["quiz-history"] });
  }

  function reset() {
    setQuiz(null); setAnswers({}); setSubmitted(false);
  }

  if (quiz) {
    const score = quiz.questions.reduce((acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0), 0);
    const allAnswered = Object.keys(answers).length === quiz.questions.length;
    const pct = Math.round((score / quiz.questions.length) * 100);

    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader
          icon={Brain}
          title={quiz.topic}
          description={`${quiz.questions.length} questions • ${difficulty}`}
          action={<Button variant="outline" onClick={reset}><RotateCcw className="h-4 w-4 mr-2" /> New quiz</Button>}
        />

        {submitted && (
          <Card className="p-6 mb-6 bg-gradient-card border-primary/20">
            <div className="flex items-center gap-4">
              <div className={cn("h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0",
                pct >= 80 ? "bg-success/20 text-success" : pct >= 50 ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive")}>
                {pct}%
              </div>
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-warning" /> {score}/{quiz.questions.length} correct
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Good effort — review the explanations." : "Keep practicing — you've got this!"}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {quiz.questions.map((q, qi) => (
            <Card key={qi} className="p-5">
              <div className="flex items-start gap-2 mb-4">
                <span className="text-xs font-bold text-muted-foreground mt-0.5">Q{qi + 1}</span>
                <h3 className="font-medium flex-1">{q.question}</h3>
              </div>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const correct = oi === q.correct_index;
                  const showResult = submitted;
                  return (
                    <button
                      key={oi}
                      disabled={submitted}
                      onClick={() => setAnswers({ ...answers, [qi]: oi })}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border-2 text-sm transition-all flex items-center gap-3",
                        !showResult && selected && "border-primary bg-primary-soft",
                        !showResult && !selected && "border-border hover:border-primary/40",
                        showResult && correct && "border-success bg-success/10",
                        showResult && selected && !correct && "border-destructive bg-destructive/10",
                        showResult && !selected && !correct && "border-border opacity-60",
                      )}
                    >
                      <span className={cn("h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0",
                        !showResult && selected && "border-primary bg-primary text-primary-foreground",
                        !showResult && !selected && "border-muted-foreground/30",
                        showResult && correct && "border-success bg-success text-success-foreground",
                        showResult && selected && !correct && "border-destructive bg-destructive text-destructive-foreground",
                      )}>
                        {showResult && correct ? <CheckCircle2 className="h-3.5 w-3.5" /> : showResult && selected ? <XCircle className="h-3.5 w-3.5" /> : String.fromCharCode(65 + oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <div className="mt-3 p-3 rounded-lg bg-secondary/50 text-sm">
                  <span className="font-semibold">Explanation: </span>{q.explanation}
                </div>
              )}
            </Card>
          ))}
        </div>

        {!submitted && (
          <div className="mt-6 sticky bottom-4">
            <Button onClick={submit} disabled={!allAnswered} className="w-full h-12 shadow-glow">
              Submit ({Object.keys(answers).length}/{quiz.questions.length})
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        icon={Brain}
        title="AI Quiz Generator"
        description="Generate a multiple-choice quiz on any topic in seconds."
      />

      <Card className="p-5 mb-8 bg-gradient-card border-primary/10">
        <div className="space-y-3">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What do you want to be quizzed on?"
            className="h-11"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 5, 8, 10, 15].map(n => <SelectItem key={n} value={String(n)}>{n} questions</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={() => generate.mutate()}
              disabled={topic.trim().length < 2 || generate.isPending}
              className="h-11 px-6 sm:flex-1"
            >
              {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="font-semibold mb-3 text-lg">Recent attempts</h2>
        {(!history || history.length === 0) ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No quiz history yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((h: any) => {
              const pct = Math.round((h.score / h.total) * 100);
              return (
                <Card key={h.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{h.quizzes?.topic || "Quiz"}</div>
                    <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()} • {h.quizzes?.difficulty}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{h.score}/{h.total}</div>
                    <div className={cn("text-xs", pct >= 70 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive")}>{pct}%</div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
