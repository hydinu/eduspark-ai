import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { aiChat } from "@/server/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppShell";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  User as UserIcon,
  Bot,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Brain,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { useSpeech } from "@/hooks/useSpeech";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

type Question = { question: string; options: string[]; correct_index: number; explanation: string };
type QuizData = { topic: string; questions: Question[]; difficulty: string; id?: string };
type Msg = { role: "user" | "assistant"; content: string; quiz?: QuizData };

const SUGGESTIONS = [
  "Explain Big-O notation with examples",
  "Suggest a 30-day Python learning plan",
  "What's the difference between SQL and NoSQL?",
  "Quiz me on the basics of machine learning",
];

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const {
    isListening,
    supported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    transcript,
    resetTranscript,
  } = useSpeech();

  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // Load most recent conversation on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: convs } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (convs && convs.length > 0) {
        const cid = convs[0].id;
        setConversationId(cid);
        const { data: msgs } = await supabase
          .from("chat_messages")
          .select("role, content")
          .eq("conversation_id", cid)
          .order("created_at", { ascending: true });
        if (msgs)
          setMessages(
            msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
          );
      }
    })();
  }, [user]);

  async function ensureConversation(firstUserMsg: string): Promise<string | null> {
    if (conversationId) return conversationId;
    if (!user) return null;
    const title = firstUserMsg.slice(0, 60);
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({ user_id: user.id, title })
      .select("id")
      .single();
    if (error || !data) return null;
    setConversationId(data.id);
    return data.id;
  }

  async function persistMessage(cid: string, role: "user" | "assistant", content: string) {
    if (!user) return;
    await supabase.from("chat_messages").insert({
      conversation_id: cid,
      user_id: user.id,
      role,
      content,
    });
    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cid);
  }

  const send = useMutation({
    mutationFn: async (vars: { history: Msg[]; cid: string }) => {
      // Filter out quiz data from history to stay within token limits and match schema
      const historyForAI = vars.history.map((m) => ({ role: m.role, content: m.content }));
      const r = await aiChat({ messages: historyForAI });
      return { r, cid: vars.cid };
    },
    onSuccess: async ({ r, cid }) => {
      const responseText = r.content || "...";
      const quiz = r.quiz as QuizData | undefined;

      let savedQuizId = undefined;
      if (quiz && user && cid !== "guest") {
        const { data, error } = await supabase
          .from("quizzes")
          .insert({
            user_id: user.id,
            topic: quiz.topic,
            difficulty: quiz.difficulty,
            questions: quiz.questions as any,
          })
          .select("id")
          .single();
        if (!error && data) savedQuizId = data.id;
      }

      const newMsg: Msg = {
        role: "assistant",
        content: responseText,
        quiz: quiz ? { ...quiz, id: savedQuizId } : undefined,
      };

      setMessages((prev) => [...prev, newMsg]);
      if (cid !== "guest") await persistMessage(cid, "assistant", responseText);
      if (voiceMode) speak(responseText);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  async function submit(text: string) {
    const t = text.trim();
    if (!t || send.isPending) return;

    stopListening();
    stopSpeaking();
    resetTranscript();

    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");

    if (!user) {
      // Guest mode: Chat works in-session but is NOT saved to Supabase
      send.mutate({ history: next, cid: "guest" });
      return;
    }

    const cid = await ensureConversation(t);
    if (!cid) {
      toast.error("Could not save conversation");
      return;
    }
    await persistMessage(cid, "user", t);
    send.mutate({ history: next, cid });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 sm:p-6 lg:p-10 pb-2 sm:pb-4 max-w-4xl mx-auto w-full flex items-start justify-between gap-2">
        <PageHeader
          icon={MessageSquare}
          title="AI Tutor & Quiz Bot"
          description="Ask for a quiz or get help with any subject."
        />
        {supported && (
          <Button
            variant={voiceMode ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setVoiceMode(!voiceMode);
              if (voiceMode) stopSpeaking();
            }}
            className="shrink-0 rounded-full px-4"
          >
            {voiceMode ? (
              <Volume2 className="h-4 w-4 mr-2" />
            ) : (
              <VolumeX className="h-4 w-4 mr-2" />
            )}
            {voiceMode ? "Voice On" : "Voice Off"}
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 lg:px-10">
        <div className="max-w-4xl mx-auto pb-4">
          {messages.length === 0 ? (
            <div className="py-10">
              <Card className="p-8 text-center bg-gradient-card border-primary/10">
                <div className="h-14 w-14 rounded-2xl bg-gradient-primary mx-auto flex items-center justify-center mb-4 shadow-glow">
                  <Sparkles className="h-7 w-7 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-1">How can I help you learn today?</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Try one of these or ask for a quiz!
                </p>
                <div className="grid sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => submit(s)}
                      className="text-left text-sm p-3 rounded-lg border hover:border-primary/50 hover:bg-primary-soft transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} content={m.content} quiz={m.quiz} />
              ))}
              {send.isPending && <Bubble role="assistant" content="" loading />}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card/50 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2 items-end"
          >
            <div className="relative flex-1">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                placeholder={
                  isListening ? "Listening..." : "Ask your AI tutor anything or 'Quiz me on React'…"
                }
                rows={1}
                maxLength={4000}
                className="resize-none min-h-[48px] max-h-40 pr-12"
              />
              {supported && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`absolute right-2 bottom-2 h-8 w-8 rounded-full ${isListening ? "text-red-500 hover:text-red-600 bg-red-500/10" : "text-muted-foreground"}`}
                  onClick={() => (isListening ? stopListening() : startListening())}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || send.isPending}
              className="h-12 px-4 shrink-0"
            >
              {send.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            EduMate AI can make mistakes. Double-check critical info.
          </p>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  role,
  content,
  loading,
  quiz,
}: {
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
  quiz?: QuizData;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-gradient-primary text-primary-foreground"}`}
      >
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm"}`}
      >
        {loading ? (
          <div className="flex gap-1.5 py-1">
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
            {quiz && <ChatQuiz quiz={quiz} />}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatQuiz({ quiz }: { quiz: QuizData }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const score = quiz.questions.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
    0,
  );
  const allAnswered = Object.keys(answers).length === quiz.questions.length;
  const pct = Math.round((score / quiz.questions.length) * 100);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (user && quiz.id) {
      setIsSaving(true);
      try {
        await supabase.from("quiz_attempts").insert({
          quiz_id: quiz.id,
          user_id: user.id,
          score,
          total: quiz.questions.length,
          answers: answers as any,
        });
        qc.invalidateQueries({ queryKey: ["quiz-history"] });
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      } catch (e) {
        console.error("Failed to save quiz attempt", e);
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <Card className="mt-4 p-4 border-primary/20 bg-primary-soft/10">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">Quiz: {quiz.topic}</span>
      </div>

      <div className="space-y-6">
        {quiz.questions.map((q, qi) => (
          <div key={qi} className="space-y-2">
            <div className="text-sm font-medium leading-tight">
              Q{qi + 1}: {q.question}
            </div>
            <div className="grid gap-2">
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
                      "text-left p-2.5 rounded-lg border text-xs transition-all flex items-center gap-2",
                      !showResult && selected && "border-primary bg-primary/10",
                      !showResult && !selected && "border-border hover:border-primary/20",
                      showResult && correct && "border-success bg-success/10",
                      showResult && selected && !correct && "border-destructive bg-destructive/10",
                      showResult && !selected && !correct && "border-border opacity-60",
                    )}
                  >
                    <span
                      className={cn(
                        "h-5 w-5 rounded-full border flex items-center justify-center shrink-0",
                        !showResult &&
                          selected &&
                          "border-primary bg-primary text-primary-foreground",
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
                        <CheckCircle2 className="h-3 w-3" />
                      ) : showResult && selected ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        String.fromCharCode(65 + oi)
                      )}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded italic">
                {q.explanation}
              </div>
            )}
          </div>
        ))}
      </div>

      {!submitted ? (
        <Button
          className="w-full mt-6 h-10 shadow-glow"
          disabled={!allAnswered}
          onClick={handleSubmit}
        >
          Submit Quiz
        </Button>
      ) : (
        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg",
                pct >= 70 ? "bg-success/20 text-success" : "bg-warning/20 text-warning",
              )}
            >
              {pct}%
            </div>
            <div>
              <div className="text-xs font-bold">
                {score}/{quiz.questions.length} correct
              </div>
              <div className="text-[10px] text-muted-foreground">
                {isSaving ? "Saving..." : "Attempt saved!"}
              </div>
            </div>
          </div>
          <Trophy className={cn("h-6 w-6", pct >= 70 ? "text-warning" : "text-muted opacity-30")} />
        </div>
      )}
    </Card>
  );
}
