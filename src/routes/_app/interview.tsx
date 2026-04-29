import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiInterviewStart, aiInterviewTurn, aiInterviewFinish } from "@/server/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/AppShell";
import { Mic, MicOff, Loader2, Sparkles, Trophy, RotateCcw, Bot, User as UserIcon } from "lucide-react";
import { useSpeech } from "@/hooks/useSpeech";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  const [roleTopic, setRoleTopic] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [feedback, setFeedback] = useState<{ score: number; markdown: string } | null>(null);
  const [phase, setPhase] = useState<"setup" | "listening" | "thinking" | "speaking" | "done">("setup");
  const scrollRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef("");

  const {
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    transcript: speechTranscript,
    supported: speechSupported,
    resetTranscript,
  } = useSpeech();

  // --- STRICT MIC CONTROL: OFF during speaking/thinking, ON only during listening ---
  useEffect(() => {
    if (phase === "speaking" || phase === "thinking" || phase === "done") {
      // ALWAYS stop mic when it's NOT user's turn
      stopListening();
    }
  }, [phase]);

  // --- When AI finishes speaking, start user's turn ---
  useEffect(() => {
    if (phase === "speaking" && !isSpeaking) {
      // AI done speaking → give mic to user
      setPhase("listening");
      lastTranscriptRef.current = "";
      resetTranscript();
      setTimeout(() => startListening(), 500);
    }
  }, [isSpeaking, phase]);

  // --- Auto-detect silence: 3 seconds of no new speech → auto-submit ---
  useEffect(() => {
    if (phase !== "listening") return;
    if (!speechTranscript || speechTranscript === lastTranscriptRef.current) return;

    lastTranscriptRef.current = speechTranscript;

    // Clear previous timer
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    // 3 seconds of silence → submit
    silenceTimerRef.current = setTimeout(() => {
      const finalAnswer = lastTranscriptRef.current.trim();
      if (finalAnswer.length > 2) {
        stopListening();
        submitAnswer(finalAnswer);
      }
    }, 3000);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [speechTranscript, phase]);

  // --- Auto-scroll ---
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, phase]);

  function interruptAI() {
    stopSpeaking();
    setPhase("listening");
    lastTranscriptRef.current = "";
    resetTranscript();
    setTimeout(() => startListening(), 300);
  }

  function submitAnswer(text: string) {
    // Stop mic FIRST
    stopListening();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    const next: Turn[] = [...transcript, { role: "candidate", content: text }];
    setTranscript(next);
    lastTranscriptRef.current = "";
    resetTranscript();
    setPhase("thinking"); // This triggers mic OFF via the effect above
    turnMutation.mutate(next);
  }

  // --- Load user resume for context ---
  const { data: resume } = useQuery({
    queryKey: ["resume", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_resumes").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  function buildResumeContext() {
    if (!resume) return "";
    const parts: string[] = [];
    if (resume.full_name) parts.push(`Name: ${resume.full_name}`);
    if (resume.skills && typeof resume.skills === "object") {
      const s = Object.entries(resume.skills as Record<string, string[]>).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join("; ");
      if (s) parts.push(`Skills: ${s}`);
    }
    if (Array.isArray(resume.projects)) {
      const p = (resume.projects as any[]).filter(x => x.title).map(x => `${x.title} (${x.tech_stack || ""})`);
      if (p.length) parts.push(`Projects: ${p.join(", ")}`);
    }
    if (Array.isArray(resume.experience)) {
      const e = (resume.experience as any[]).filter(x => x.title).map(x => `${x.title} at ${x.company}`);
      if (e.length) parts.push(`Experience: ${e.join(", ")}`);
    }
    return parts.join(". ");
  }

  // --- Past interviews query ---
  const { data: past } = useQuery({
    queryKey: ["interviews", user?.id],
    enabled: !!user && transcript.length === 0,
    queryFn: async () => {
      const { data } = await supabase.from("interview_sessions").select("*").order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  // --- Start interview ---
  const startInterview = useMutation({
    mutationFn: async () => aiInterviewStart({ role_topic: roleTopic.trim(), resume_context: buildResumeContext() }),
    onSuccess: (r) => {
      setTranscript([{ role: "interviewer", content: r.content }]);
      setPhase("speaking");
      speak(r.content);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- AI asks next question (with resume context) ---
  const turnMutation = useMutation({
    mutationFn: async (t: Turn[]) => aiInterviewTurn({ role_topic: roleTopic, transcript: t, resume_context: buildResumeContext() }),
    onSuccess: (r) => {
      setTranscript((prev) => [...prev, { role: "interviewer", content: r.content }]);
      setPhase("speaking");
      speak(r.content);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setTranscript((p) => p.slice(0, -1));
      startMicForAnswer();
    },
  });

  // --- Finish & get feedback ---
  const finishInterview = useMutation({
    mutationFn: async () => aiInterviewFinish({ role_topic: roleTopic, transcript }),
    onSuccess: async (r) => {
      stopListening();
      stopSpeaking();
      setPhase("done");
      setFeedback({ score: r.score, markdown: r.feedback_markdown });
      if (user) {
        await supabase.from("interview_sessions").insert({
          user_id: user.id,
          role_topic: roleTopic,
          transcript: transcript as any,
          feedback: r.feedback_markdown,
          score: r.score,
        });
        qc.invalidateQueries({ queryKey: ["interviews"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    stopListening();
    stopSpeaking();
    setRoleTopic("");
    setTranscript([]);
    setFeedback(null);
    setPhase("setup");
    lastTranscriptRef.current = "";
    resetTranscript();
  }

  // ==================== FEEDBACK SCREEN ====================
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

  // ==================== SETUP SCREEN ====================
  if (transcript.length === 0) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <PageHeader
          icon={Mic}
          title="Mock Interview"
          description="Voice-first AI interview practice. Just talk naturally — no buttons needed."
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
            onClick={() => startInterview.mutate()}
            disabled={roleTopic.trim().length < 2 || startInterview.isPending}
            className="w-full h-12 shadow-glow text-base"
          >
            {startInterview.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Mic className="h-5 w-5 mr-2" />}
            Start Voice Interview
          </Button>

          {!speechSupported && (
            <p className="text-xs text-destructive mt-2 text-center">
              ⚠️ Your browser doesn't support speech recognition. Please use Google Chrome or Microsoft Edge.
            </p>
          )}
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

  // ==================== LIVE INTERVIEW SCREEN ====================
  const questionCount = transcript.filter(t => t.role === "interviewer").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 lg:px-10 border-b bg-card/50 backdrop-blur flex items-center justify-between">
        <div>
          <h2 className="font-bold text-lg">{roleTopic}</h2>
          <p className="text-xs text-muted-foreground">Question {questionCount} • {transcript.length} exchanges</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => finishInterview.mutate()}
            disabled={finishInterview.isPending || transcript.length < 3}
          >
            {finishInterview.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trophy className="h-4 w-4 mr-1" />}
            End & Get Feedback
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-10 py-4">
        <div className="max-w-3xl mx-auto space-y-4">
          {transcript.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "candidate" ? "flex-row-reverse" : ""}`}>
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                m.role === "candidate" ? "bg-primary text-primary-foreground" : "bg-gradient-primary text-primary-foreground"
              )}>
                {m.role === "candidate" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3",
                m.role === "candidate"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border rounded-tl-sm"
              )}>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {phase === "thinking" && (
            <div className="flex gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-primary text-primary-foreground flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
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

      {/* Status Bar — shows mic/speaking state */}
      <div className="border-t bg-card/80 backdrop-blur p-4">
        <div className="max-w-3xl mx-auto">
          {phase === "speaking" && (
            <div className="flex flex-col items-center gap-3 py-3">
              <div className="relative">
                <Bot className="h-6 w-6 text-primary" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-success rounded-full animate-pulse" />
              </div>
              <span className="text-sm font-medium text-muted-foreground">Interviewer is speaking...</span>
              <Button size="sm" variant="outline" onClick={interruptAI} className="mt-1">
                <MicOff className="h-3.5 w-3.5 mr-1.5" /> Tap to interrupt & answer
              </Button>
            </div>
          )}

          {phase === "listening" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="relative">
                <div className={cn(
                  "h-16 w-16 rounded-full flex items-center justify-center transition-all",
                  isListening
                    ? "bg-primary text-primary-foreground shadow-glow animate-pulse"
                    : "bg-primary/20 text-primary"
                )}>
                  {isListening ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
                </div>
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                    <span className="absolute -inset-2 rounded-full border-2 border-primary/20 animate-pulse" />
                  </>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {speechTranscript ? "Listening... (pause to auto-submit)" : "Your turn — speak your answer"}
                </p>
                {speechTranscript && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-md italic">
                    "{speechTranscript}"
                  </p>
                )}
              </div>
              {/* Manual submit button as fallback */}
              {speechTranscript && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    stopListening();
                    submitAnswer(speechTranscript.trim());
                  }}
                  className="mt-1"
                >
                  Submit answer now
                </Button>
              )}
            </div>
          )}

          {phase === "thinking" && (
            <div className="flex items-center justify-center gap-3 py-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Interviewer is preparing next question...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
