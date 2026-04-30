import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { aiGenerateQuiz } from "@/server/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import {
  Brain,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Network,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/quizzes")({
  component: QuizPage,
});

type Question = { question: string; options: string[]; correct_index: number; explanation: string };
type Mode = "standard" | "logic";
type Difficulty = "beginner" | "intermediate" | "advanced" | "expert" | "elite";

const KG_API_BASE = "https://outstandingom-knowledge-graph-env.hf.space";

function QuizPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [mode, setMode] = useState<Mode>("standard");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [count, setCount] = useState("5");

  const [quiz, setQuiz] = useState<{
    id?: string;
    topic: string;
    questions?: Question[];
    observation?: string;
    mode: Mode;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [textAnswer, setTextAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const { data: history } = useQuery({
    queryKey: ["quiz-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("quiz_attempts")
        .select("*, quizzes(topic,difficulty)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (mode === "standard") {
        return aiGenerateQuiz({
          topic: topic.trim(),
          difficulty: difficulty as any,
          count: parseInt(count, 10),
        });
      } else {
        const resp = await fetch(`${KG_API_BASE}/reset`, { method: "POST" });
        if (!resp.ok) throw new Error("Knowledge Graph Engine failed to reset");
        return resp.json();
      }
    },
    onSuccess: async (r) => {
      if (mode === "standard") {
        if (!r.questions?.length) {
          toast.error("Couldn't generate questions, try a different topic.");
          return;
        }
        if (user) {
          const { data, error } = await supabase
            .from("quizzes")
            .insert({
              user_id: user.id,
              topic: topic.trim(),
              difficulty,
              questions: r.questions as any,
            })
            .select()
            .single();
          if (error) {
            toast.error(error.message);
            return;
          }
          setQuiz({ id: data.id, topic: topic.trim(), questions: r.questions, mode: "standard" });
        } else {
          setQuiz({ topic: topic.trim(), questions: r.questions, mode: "standard" });
        }
      } else {
        const kgTopic = "Knowledge Graph Reasoning";
        if (user) {
          let kgQuizId = "";
          const { data: existing } = await supabase
            .from("quizzes")
            .select("id")
            .eq("user_id", user.id)
            .eq("topic", kgTopic)
            .maybeSingle();
          if (existing) kgQuizId = existing.id;
          else {
            const { data: created } = await supabase
              .from("quizzes")
              .insert({
                user_id: user.id,
                topic: kgTopic,
                difficulty: "dynamic",
                questions: [] as any,
              })
              .select("id")
              .single();
            if (created) kgQuizId = created.id;
          }
          setQuiz({ id: kgQuizId, topic: kgTopic, observation: r.observation, mode: "logic" });
        } else {
          setQuiz({ topic: kgTopic, observation: r.observation, mode: "logic" });
        }
      }
      setAnswers({});
      setTextAnswer("");
      setSubmitted(false);
      setScore(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function submitStandard() {
    if (!quiz?.questions) return;
    const s = quiz.questions.reduce(
      (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
      0,
    );
    const total = quiz.questions.length;
    const pct = Math.round((s / total) * 100);
    setScore(pct);
    setSubmitted(true);

    if (user && quiz.id) {
      const { error } = await supabase.from("quiz_attempts").insert({
        quiz_id: quiz.id,
        user_id: user.id,
        score: s,
        total,
        answers: answers as any,
      });
      if (error) toast.error(error.message);
      else qc.invalidateQueries({ queryKey: ["quiz-history"] });
    }
  }

  const submitLogic = useMutation({
    mutationFn: async () => {
      const resp = await fetch(`${KG_API_BASE}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: "task_easy", input_text: textAnswer }),
      });
      if (!resp.ok) throw new Error("Grading failed");
      return resp.json();
    },
    onSuccess: async (data) => {
      const finalScore = Math.round(data.score * 100);
      setScore(finalScore);
      setSubmitted(true);
      if (user && quiz?.id) {
        await supabase.from("quiz_attempts").insert({
          user_id: user.id,
          quiz_id: quiz.id,
          score: finalScore,
          total: 100,
          answers: {
            observation: quiz.observation,
            answer: textAnswer,
            feedback: data.feedback,
          } as any,
        });
        qc.invalidateQueries({ queryKey: ["quiz-history"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setTopic("");
  }

  if (quiz) {
    if (quiz.mode === "standard") {
      const currentScore = quiz.questions!.reduce(
        (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
        0,
      );
      const allAnswered = Object.keys(answers).length === quiz.questions!.length;
      const pct =
        score !== null ? score : Math.round((currentScore / quiz.questions!.length) * 100);

      return (
        <div className="p-3 sm:p-6 lg:p-10 max-w-3xl mx-auto">
          <PageHeader
            icon={Brain}
            title={quiz.topic}
            description={`${quiz.questions!.length} questions • ${difficulty}`}
            action={
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" /> New quiz
              </Button>
            }
          />

          {submitted && (
            <Card className="p-6 mb-6 bg-gradient-card border-primary/20">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0",
                    pct >= 80
                      ? "bg-success/20 text-success"
                      : pct >= 50
                        ? "bg-warning/20 text-warning"
                        : "bg-destructive/20 text-destructive",
                  )}
                >
                  {pct}%
                </div>
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-warning" /> {currentScore}/
                    {quiz.questions!.length} correct
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {pct >= 80
                      ? "Excellent work! 🎉"
                      : pct >= 50
                        ? "Good effort — review the explanations."
                        : "Keep practicing — you've got this!"}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {quiz.questions!.map((q, qi) => (
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
                          showResult &&
                            selected &&
                            !correct &&
                            "border-destructive bg-destructive/10",
                          showResult && !selected && !correct && "border-border opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0",
                            !showResult &&
                              selected &&
                              "border-primary bg-primary text-primary-foreground",
                            !showResult && !selected && "border-muted-foreground/30",
                            showResult &&
                              correct &&
                              "border-success bg-success text-success-foreground",
                            showResult &&
                              selected &&
                              !correct &&
                              "border-destructive bg-destructive text-destructive-foreground",
                          )}
                        >
                          {showResult && correct ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : showResult && selected ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            String.fromCharCode(65 + oi)
                          )}
                        </span>
                        <span className="flex-1">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {submitted && (
                  <div className="mt-3 p-3 rounded-lg bg-secondary/50 text-sm">
                    <span className="font-semibold">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {!submitted && (
            <div className="mt-6 sticky bottom-4">
              <Button
                onClick={submitStandard}
                disabled={!allAnswered}
                className="w-full h-12 shadow-glow"
              >
                Submit ({Object.keys(answers).length}/{quiz.questions!.length})
              </Button>
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="p-3 sm:p-6 lg:p-10 max-w-3xl mx-auto">
          <PageHeader
            icon={Network}
            title="Logic Reasoning Quiz"
            description="Powered by the Knowledge Graph Engine"
            action={
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" /> New quiz
              </Button>
            }
          />

          <Card className="p-6 border-primary/20 bg-primary-soft/30 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
              Scenario Observation
            </h3>
            <div className="text-lg leading-relaxed whitespace-pre-wrap">{quiz.observation}</div>
          </Card>

          {submitted ? (
            <Card className="p-10 text-center">
              <div
                className={cn(
                  "h-24 w-24 rounded-full flex items-center justify-center text-4xl font-bold mx-auto mb-6 border-4",
                  score! >= 70
                    ? "bg-success/10 text-success border-success/30"
                    : score! >= 40
                      ? "bg-warning/10 text-warning border-warning/30"
                      : "bg-destructive/10 text-destructive border-destructive/30",
                )}
              >
                {score}%
              </div>
              <h3 className="text-2xl font-bold mb-2">
                {score! >= 70 ? "Mastermind!" : "Good effort"}
              </h3>
              <p className="text-muted-foreground mb-6">
                Your reasoning has been analyzed by the Knowledge Graph engine.
              </p>
              <Button onClick={reset}>
                <Sparkles className="h-4 w-4 mr-2" /> Next Challenge
              </Button>
            </Card>
          ) : (
            <Card className="p-6">
              <h3 className="text-sm font-semibold mb-3">Explain the reasoning & solution</h3>
              <Textarea
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Type your explanation here..."
                className="min-h-[120px] mb-4"
              />
              <Button
                onClick={() => submitLogic.mutate()}
                disabled={!textAnswer.trim() || submitLogic.isPending}
                className="w-full h-12"
              >
                {submitLogic.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Submit for Logic Grading
              </Button>
            </Card>
          )}
        </div>
      );
    }
  }

  return (
    <div className="p-3 sm:p-6 lg:p-10 max-w-4xl mx-auto">
      <PageHeader
        icon={Brain}
        title="AI Quiz Generator"
        description="Choose a mode to start testing your knowledge."
      />

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => setMode("standard")}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all text-left group",
            mode === "standard"
              ? "border-primary bg-primary-soft/50 shadow-soft"
              : "border-border hover:border-primary/40 bg-card",
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg">Multiple Choice</h3>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated questions on any specific topic.
          </p>
        </button>

        <button
          onClick={() => setMode("logic")}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all text-left group",
            mode === "logic"
              ? "border-primary bg-primary-soft/50 shadow-soft"
              : "border-border hover:border-primary/40 bg-card",
          )}
        >
          <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Network className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-lg">Logic Reasoning</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Dynamic reasoning tasks from the KG engine.
          </p>
        </button>
      </div>

      <Card className="p-5 mb-8 bg-gradient-card border-primary/10">
        <div className="space-y-4">
          {mode === "standard" ? (
            <div className="space-y-3">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What do you want to be quizzed on?"
                className="h-11"
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
                  <SelectTrigger className="h-11 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner"> Beginner</SelectItem>
                    <SelectItem value="intermediate"> Intermediate</SelectItem>
                    <SelectItem value="advanced"> Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={count} onValueChange={setCount}>
                  <SelectTrigger className="h-11 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 8, 10, 15].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} questions
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => generate.mutate()}
                  disabled={topic.trim().length < 2 || generate.isPending}
                  className="h-11 px-8 shadow-glow"
                >
                  {generate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate Quiz
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 text-center">
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                The Logic Reasoning mode generates a dynamic scenario from a knowledge graph. You
                will need to explain the solution using logic and reasoning.
              </p>
              <Button
                size="lg"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="h-12 px-10 shadow-glow"
              >
                {generate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Network className="h-4 w-4 mr-2" />
                )}
                Start Logic Challenge
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h2 className="font-semibold mb-3 text-lg">Recent attempts</h2>
        {!history || history.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No quiz history yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((h: any) => {
              const pct = Math.round((h.score / h.total) * 100);
              const isKG = h.quizzes?.topic === "Knowledge Graph Reasoning";
              return (
                <Card key={h.id} className="p-4 flex items-center gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      isKG ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {isKG ? <Network className="h-5 w-5" /> : <Brain className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{h.quizzes?.topic || "Quiz"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString()} • {h.quizzes?.difficulty}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {h.score}/{h.total}
                    </div>
                    <div
                      className={cn(
                        "text-xs",
                        pct >= 70
                          ? "text-success"
                          : pct >= 50
                            ? "text-warning"
                            : "text-destructive",
                      )}
                    >
                      {pct}%
                    </div>
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
