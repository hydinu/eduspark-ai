import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiSuggestCourses } from "@/server/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/AppShell";
import { BookOpen, Loader2, Search, ExternalLink, Bookmark, BookmarkCheck, Play, CheckCircle2, Sparkles, Youtube, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/courses")({
  component: CoursesPage,
});

type Resource = { title: string; type: string; provider: string; description: string; estimated_hours: number; difficulty: string; search_query: string };

function CoursesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const suggestFn = useServerFn(aiSuggestCourses);
  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [results, setResults] = useState<Resource[]>([]);

  const { data: saved } = useQuery({
    queryKey: ["course-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("course_progress").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const suggest = useMutation({
    mutationFn: async () => suggestFn({ data: { topic: topic.trim(), level } }),
    onSuccess: (r) => { setResults(r.resources); if (r.resources.length === 0) toast.info("No suggestions, try another topic."); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function bookmark(r: Resource) {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(r.search_query)}`;
    const { error } = await supabase.from("course_progress").insert({
      user_id: user!.id,
      course_title: r.title,
      course_url: url,
      source: r.provider,
      status: "bookmarked",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Bookmarked!");
    qc.invalidateQueries({ queryKey: ["course-progress"] });
  }

  async function updateStatus(id: string, status: "bookmarked" | "in_progress" | "completed") {
    const { error } = await supabase.from("course_progress").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["course-progress"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("course_progress").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["course-progress"] });
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <PageHeader
        icon={BookOpen}
        title="Course Suggestions"
        description="Tell us a topic — our AI will recommend the best learning resources."
      />

      <Card className="p-5 mb-8 bg-gradient-card border-primary/10">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Python data science, React hooks, Machine Learning…"
              className="pl-9 h-11"
              onKeyDown={(e) => { if (e.key === "Enter" && topic.trim().length >= 2) suggest.mutate(); }}
            />
          </div>
          <Select value={level} onValueChange={(v) => setLevel(v as any)}>
            <SelectTrigger className="w-full sm:w-44 h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => suggest.mutate()}
            disabled={topic.trim().length < 2 || suggest.isPending}
            className="h-11 px-6"
          >
            {suggest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Suggest
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <div className="mb-10">
          <h2 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Suggestions for "{topic}"</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {results.map((r, i) => (
              <Card key={i} className="p-5 hover:shadow-soft transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold leading-snug">{r.title}</h3>
                  <Badge variant="secondary" className="shrink-0 capitalize">{r.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{r.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
                  <span>{r.provider}</span>
                  <span>•</span>
                  <span>~{r.estimated_hours}h</span>
                  <span>•</span>
                  <span className="capitalize">{r.difficulty}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(r.search_query)}`} target="_blank" rel="noopener noreferrer">
                      <Youtube className="h-3.5 w-3.5 mr-1.5" /> Find
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => bookmark(r)} className="flex-1">
                    <Bookmark className="h-3.5 w-3.5 mr-1.5" /> Save
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold mb-4 text-lg">My learning list</h2>
        {(!saved || saved.length === 0) ? (
          <Card className="p-10 text-center text-muted-foreground">
            <BookmarkCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No saved courses yet. Search above to find some!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {saved.map((c) => (
              <Card key={c.id} className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">
                  {c.status === "completed" ? <CheckCircle2 className="h-5 w-5" /> : c.status === "in_progress" ? <Play className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.course_title}</div>
                  <div className="text-xs text-muted-foreground">{c.source}</div>
                </div>
                <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v as any)}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bookmarked">📌 Bookmarked</SelectItem>
                    <SelectItem value="in_progress">🚀 In Progress</SelectItem>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                  </SelectContent>
                </Select>
                {c.course_url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={c.course_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
