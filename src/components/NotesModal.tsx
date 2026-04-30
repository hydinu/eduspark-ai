import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Download, AlertCircle, Play, FileText, CheckCircle } from "lucide-react";
import { downloadNotesAsPDF, NotesData } from "@/lib/pdf-generator";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
}

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchNotesFromBackend(videoUrl: string, videoTitle: string): Promise<NotesData & { source?: string; has_real_transcript?: boolean }> {
  const res = await fetch(`${BACKEND_URL}/api/generate-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_url: videoUrl, video_title: videoTitle }),
  });

  if (!res.ok) {
    let detail = `Backend error (${res.status})`;
    try { const j = await res.json(); detail = j.detail || detail; } catch {}
    throw new Error(detail);
  }

  return res.json();
}

export function NotesModal({ isOpen, onClose, videoUrl, videoTitle }: NotesModalProps) {
  const [notesData, setNotesData] = useState<(NotesData & { source?: string; has_real_transcript?: boolean }) | null>(null);
  const [activeTab, setActiveTab] = useState("watch");

  // Reset when modal opens for a different video
  useEffect(() => {
    if (isOpen) {
      setNotesData(null);
      setActiveTab("watch");
    }
  }, [isOpen, videoUrl]);

  const generate = useMutation({
    mutationFn: () => fetchNotesFromBackend(videoUrl, videoTitle),
    onSuccess: (data) => {
      setNotesData(data);
      setActiveTab("notes");
      if (data.has_real_transcript) {
        toast.success("📝 Notes generated from real subtitles!");
      } else {
        toast.info("💡 No subtitles found — AI generated notes from context.");
      }
    },
    onError: (err: Error) => {
      const msg = err.message || "";
      if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("Load failed")) {
        toast.error("Backend not running. Start it with: python backend.py");
      } else if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
        toast.error("AI quota exceeded. Notes will use direct transcript parsing — restart backend.");
      } else {
        toast.error("Could not generate notes. Please try again.");
      }
      console.error("Notes error:", msg);
    },
  });

  const videoId = extractVideoId(videoUrl);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-3 border-b shrink-0">
          <DialogTitle className="text-base font-bold pr-8 line-clamp-2 leading-snug">
            {videoTitle}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid grid-cols-2 w-full shrink-0 mt-2">
            <TabsTrigger value="watch" className="flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5" /> Watch Video
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Study Notes
            </TabsTrigger>
          </TabsList>

          {/* ── Watch Tab ── */}
          <TabsContent value="watch" className="flex-1 overflow-auto mt-3">
            {videoId ? (
              <div
                className="relative w-full rounded-xl overflow-hidden bg-black shadow-lg"
                style={{ paddingBottom: "56.25%" }}
              >
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                  title={videoTitle}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">
                  Could not embed video.{" "}
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Open on YouTube
                  </a>
                </p>
              </div>
            )}

            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="gap-2 shadow-md"
              >
                {generate.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Fetching subtitles & generating notes…</>
                ) : (
                  <><FileText className="h-4 w-4" /> Generate Notes from Real Subtitles</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Uses real YouTube subtitles/ASR • Falls back to AI if unavailable
              </p>
            </div>
          </TabsContent>

          {/* ── Notes Tab ── */}
          <TabsContent value="notes" className="flex-1 overflow-y-auto mt-3 pr-1">
            {generate.isPending && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">Fetching YouTube transcript and generating notes…</p>
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-6 bg-primary/20 rounded-lg" />
                      <div className="w-48 h-5 bg-muted rounded" />
                    </div>
                    <div className="space-y-2 pl-4">
                      <div className="w-full h-4 bg-muted rounded" />
                      <div className="w-4/5 h-4 bg-muted rounded" />
                      <div className="w-3/5 h-4 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {generate.isError && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-destructive" />
                </div>
                <h3 className="text-base font-bold mb-1">Failed to generate notes</h3>
                <p className="text-sm text-muted-foreground max-w-sm mb-2">
                  {(() => {
                    const msg = (generate.error as Error)?.message || "";
                    if (msg.includes("fetch") || msg.includes("Failed to fetch")) return "Python backend is not running.";
                    if (msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) return "AI quota exceeded — restart the backend.";
                    return "Something went wrong. Please try again.";
                  })()}
                </p>
                <p className="text-xs text-muted-foreground mb-4 bg-muted rounded p-2 font-mono">
                  python backend.py
                </p>
                <Button variant="outline" onClick={() => generate.mutate()}>Retry</Button>
              </div>
            )}

            {!generate.isPending && !generate.isError && !notesData && (
              <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">
                  Switch to <strong>Watch Video</strong> and click <strong>Generate Notes from Real Subtitles</strong>.
                </p>
              </div>
            )}

            {!generate.isPending && !generate.isError && notesData && notesData.notes?.length > 0 && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    {notesData.has_real_transcript ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        <CheckCircle className="h-3 w-3" /> Real subtitles
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                        💡 AI-generated
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{notesData.notes.length}</span> sections
                    </span>
                  </div>
                  <Button onClick={() => downloadNotesAsPDF(notesData)} size="sm" className="gap-2 shrink-0">
                    <Download className="w-4 h-4" /> Download PDF
                  </Button>
                </div>

                <div className="space-y-6 divide-y divide-border [&>*+*]:pt-6">
                  {notesData.notes.map((note, i) => (
                    <div
                      key={i}
                      className="animate-in fade-in slide-in-from-bottom-4 duration-500"
                      style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold">
                          {note.timestamp}
                        </span>
                        <h4 className="text-sm font-bold">{note.section_title}</h4>
                      </div>
                      <ul className="space-y-1.5 pl-1">
                        {note.content
                          .split("\n")
                          .filter((line) => line.trim().length > 0)
                          .map((line, j) => {
                            const text = line.trim().replace(/^[•\-\*]\s*/, "");
                            return (
                              <li key={j} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full shrink-0 bg-primary/60" />
                                <span>{text}</span>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
