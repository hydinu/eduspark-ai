import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiChat } from "@/server/ai.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/AppShell";
import { MessageSquare, Send, Loader2, Sparkles, User as UserIcon, Bot } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain Big-O notation with examples",
  "Suggest a 30-day Python learning plan",
  "What's the difference between SQL and NoSQL?",
  "Quiz me on the basics of machine learning",
];

function ChatPage() {
  const chat = useServerFn(aiChat);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: async (history: Msg[]) => chat({ data: { messages: history } }),
    onSuccess: (r) => setMessages((prev) => [...prev, { role: "assistant", content: r.content || "..." }]),
    onError: (e: Error) => {
      toast.error(e.message);
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  function submit(text: string) {
    const t = text.trim();
    if (!t || send.isPending) return;
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next);
    setInput("");
    send.mutate(next);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, send.isPending]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 lg:p-10 pb-4 max-w-4xl mx-auto w-full">
        <PageHeader
          icon={MessageSquare}
          title="AI Tutor"
          description="Ask anything — get clear explanations, study tips, and resources."
        />
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
                <p className="text-sm text-muted-foreground mb-6">Try one of these or ask anything.</p>
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
                <Bubble key={i} role={m.role} content={m.content} />
              ))}
              {send.isPending && (
                <Bubble role="assistant" content="" loading />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card/50 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(input); }}
            className="flex gap-2 items-end"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
              }}
              placeholder="Ask your AI tutor anything…"
              rows={1}
              maxLength={4000}
              className="resize-none min-h-[48px] max-h-40"
            />
            <Button type="submit" disabled={!input.trim() || send.isPending} className="h-12 px-4">
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">EduMate AI can make mistakes. Double-check critical info.</p>
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, content, loading }: { role: "user" | "assistant"; content: string; loading?: boolean }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-primary text-primary-foreground" : "bg-gradient-primary text-primary-foreground"}`}>
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border rounded-tl-sm"}`}>
        {loading ? (
          <div className="flex gap-1.5 py-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{content}</div>
        )}
      </div>
    </div>
  );
}
