import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { aiGenerateVideoNotes } from "@/server/ai.functions";
import { Loader2, Download, AlertCircle, Play, FileText } from "lucide-react";
import { downloadNotesAsPDF, NotesData } from "@/lib/pdf-generator";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function NotesModal({ isOpen, onClose, videoUrl, videoTitle }: NotesModalProps) {
  const [notesData, setNotesData] = useState<NotesData | null>(null);
  const [activeTab, setActiveTab] = useState("watch");
  const generateFn = useServerFn(aiGenerateVideoNotes);

  // Reset state whenever modal opens for a new video
  useEffect(() => {
    if (isOpen) {
      setNotesData(null);
      setActiveTab("watch");
    }
  }, [isOpen, videoUrl]);

  const generate = useMutation({
    mutationFn: () => generateFn({ data: { video_url: videoUrl, video_title: videoTitle } }),
    onSuccess: (data) => {
      setNotesData(data as unknown as NotesData);
      setActiveTab("notes");
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
                  Could not embed this video.{" "}
                  <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Open on YouTube
                  </a>
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <Button
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
                className="gap-2 shadow-md"
              >
                {generate.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating notes…
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" /> Generate AI Study Notes
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ── Notes Tab ── */}
          <TabsContent value="notes" className="flex-1 overflow-y-auto mt-3 pr-1">
            {generate.isPending && (
              <div className="space-y-6 py-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">Generating AI study notes with Gemini…</p>
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
                <p className="text-sm text-muted-foreground max-w-sm mb-4">
                  {(generate.error as Error)?.message || "An unexpected error occurred."}
                </p>
                <Button variant="outline" onClick={() => generate.mutate()}>
                  Retry
                </Button>
              </div>
            )}

            {!generate.isPending && !generate.isError && !notesData && (
              <div className="flex flex-col items-center justify-center py-14 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">
                  Switch to the <strong>Watch Video</strong> tab and click{" "}
                  <strong>Generate AI Study Notes</strong> to get started.
                </p>
              </div>
            )}

            {!generate.isPending && !generate.isError && notesData && notesData.notes?.length > 0 && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <p className="text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{notesData.notes.length}</span> sections generated
                    </p>
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
                            const trimmed = line.trim();
                            const text = trimmed.replace(/^[•\-\*]\s*/, "");
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
