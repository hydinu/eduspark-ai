import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiInterviewStart, aiInterviewTurn, aiInterviewFinish } from "@/server/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppShell";
import { Mic, Loader2, Sparkles, Send, Trophy, RotateCcw, Bot, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/interview")({
  component: InterviewPage,
});

type Turn = { role: "interviewer" | "candidate"; content: string };

const TEMPLATES = [
  "Frontend Developer (React)",
  "Backend Engineer (Node.js)",
  "Data Scientist (Python)",
  "Product Manager",
  "ML Engineer",
];

function InterviewPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const startFn = useServerFn(aiInterviewStart);
  const turnFn = useServerFn(aiInterviewTurn);
  const finishFn = useServerFn(aiInterviewFinish);

  const [roleTopic, setRoleTopic] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ score: number; markdown: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: past } = useQuery({
    queryKey: ["interviews", user?.id],
    enabled: !!user && transcript.length === 0,
    queryFn: async () => {
      const { data } = await supabase.from("interview_sessions").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const start = useMutation({
    mutationFn: async () => startFn({ data: { role_topic: roleTopic.trim() } }),
    onSuccess: (r) => setTranscript([{ role: "interviewer", content: r.content }]),
    onError: (e: Error) => toast.error(e.message),
  });

  const turn = useMutation({
    mutationFn: async (t: Turn[]) => turnFn({ data: { role_topic: roleTopic, transcript: t } }),
    onSuccess: (r) => setTranscript((prev) => [...prev, { role: "interviewer", content: r.content }]),
    onError: (e: Error) => { toast.error(e.message); setTranscript((p) => p.slice(0, -1)); },
  });

  const finish = useMutation({
    mutationFn: async () => finishFn({ data: { role_topic: roleTopic, transcript } }),
    onSuccess: async (r) => {
      setFeedback({ score: r.score, markdown: r.feedback_markdown });
      await supabase.from("interview_sessions").insert({
        user_id: user!.id,
        role_topic: roleTopic,
        transcript: transcript as any,
        feedback: r.feedback_markdown,
        score: r.score,
      });
      qc.invalidateQueries({ queryKey: ["interviews"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function sendAnswer() {
    const t = answer.trim();
    if (!t || turn.isPending) return;
    const next: Turn[] = [...transcript, { role: "candidate", content: t }];
    setTranscript(next);
    setAnswer("");
    turn.mutate(next);
  }

  function reset() {
    setRoleTopic(""); setTranscript([]); setAnswer(""); setFeedback(null);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, turn.isPending]);

  if (feedback) {
    const color = feedback.score >= 80 ? "text-success" : feedback.score >= 50 ? "text-warning" : "text-destructive";
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader
          icon={Trophy}
          title="Interview Feedback"
          description={roleTopic}
          action={<Button onClick={reset}><RotateCcw className="h-4 w-4 mr-2" /> New session</Button>}
        />
        <Card className="p-6 mb-4 bg-gradient-card border-primary/20 text-center">
          <div className="text-sm text-muted-foreground mb-2">Your score</div>
          <div className={`text-6xl font-bold ${color}`}>{feedback.score}<span className="text-2xl text-muted-foreground">/100</span></div>
        </Card>
        <Card className="p-6">
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">{feedback.markdown}</div>
        </Card>
      </div>
    );
  }

  if (transcript.length === 0) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader
          icon={Mic}
          title="Mock Interview"
          description="Practice with an AI interviewer. Get feedback at the end."
        />

        <Card className="p-6 mb-6 bg-gradient-card border-primary/10">
          <label className="text-sm font-medium block mb-2">What role are you preparing for?</label>
          <Input
            value={roleTopic}
            onChange={(e) => setRoleTopic(e.target.value)}
            placeholder="e.g. Frontend Developer (React)"
            className="h-11 mb-3"
          />
          <div className="flex flex-wrap gap-2 mb-4">
            {TEMPLATES.map((t) => (
              <button key={t} onClick={() => setRoleTopic(t)} className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-accent transition-colors">
                {t}
              </button>
            ))}
          </div>
          <Button
            onClick={() => start.mutate()}
            disabled={roleTopic.trim().length < 2 || start.isPending}
            className="w-full h-11"
          >
            {start.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Start interview
          </Button>
        </Card>

        {past && past.length > 0 && (
          <div>
            <h2 className="font-semibold mb-3 text-lg">Past interviews</h2>
            <div className="space-y-2">
              {past.map((p) => (
                <Card key={p.id} className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                    <Mic className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.role_topic}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                  </div>
                  {p.score != null && <div className="font-bold text-lg">{p.score}<span className="text-xs text-muted-foreground">/100</span></div>}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 lg:p-10 pb-2 max-w-4xl mx-auto w-full">
        <PageHeader
          icon={Mic}
          title="Mock Interview"
          description={roleTopic}
          action={
            <Button variant="outline" onClick={() => finish.mutate()} disabled={finish.isPending || transcript.length < 3}>
              {finish.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
              Finish & get feedback
            </Button>
          }
        />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-10">
        <div className="max-w-4xl mx-auto pb-4 space-y-4">
          {transcript.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "candidate" ? "flex-row-reverse" : ""}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "candidate" ? "bg-primary text-primary-foreground" : "bg-gradient-primary text-primary-foreground"}`}>
                {m.role === "candidate" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${m.role === "candidate" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm"}`}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          {turn.isPending && (
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center"><Bot className="h-4 w-4" /></div>
              <div className="bg-card border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 py-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card/50 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAnswer(); } }}
            placeholder="Type your answer…"
            rows={1}
            maxLength={4000}
            className="resize-none min-h-[48px] max-h-40"
          />
          <Button onClick={sendAnswer} disabled={!answer.trim() || turn.isPending} className="h-12 px-4">
            {turn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
