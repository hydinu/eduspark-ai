import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { downloadNotesAsPDF, NotesData } from "@/lib/pdf-generator";
import { toast } from "sonner";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
}

export function NotesModal({ isOpen, onClose, videoUrl, videoTitle }: NotesModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notesData, setNotesData] = useState<NotesData | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setNotesData(null);

    async function fetchNotes() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/generate-notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ video_url: videoUrl }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || `Server error ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setNotesData(data);
        }
      } catch (err: any) {
        console.error("Notes generation error:", err);
        if (isMounted) {
          setError(err.message || "Failed to generate notes.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchNotes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, videoUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <DialogTitle className="text-xl font-bold pr-8">{notesData?.video_title || videoTitle}</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse"></div>
                <p className="text-sm text-muted-foreground">Fetching transcript & generating AI study notes…</p>
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-6 bg-primary/20 rounded-lg"></div>
                    <div className="w-40 h-5 bg-muted rounded"></div>
                  </div>
                  <div className="space-y-2 pl-6">
                    <div className="w-full h-4 bg-muted rounded"></div>
                    <div className="w-4/5 h-4 bg-muted rounded"></div>
                    <div className="w-3/5 h-4 bg-muted rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-base font-bold mb-2">Failed to generate notes</h3>
              <p className="text-sm text-muted-foreground max-w-sm">{error}</p>
            </div>
          )}

          {!loading && !error && notesData && notesData.notes && notesData.notes.length > 0 && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <p className="text-sm text-muted-foreground">
                    Generated <span className="font-semibold text-foreground">{notesData.notes.length}</span> sections of study notes
                  </p>
                </div>
                <Button onClick={() => downloadNotesAsPDF(notesData)} className="shrink-0 gap-2">
                  <Download className="w-4 h-4" /> Download PDF
                </Button>
              </div>

              <div className="space-y-6 divide-y divide-border [&>*+*]:pt-6">
                {notesData.notes.map((note, i) => (
                  <div key={i} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${i * 100}ms`, animationFillMode: "both" }}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-mono font-bold">
                        {note.timestamp}
                      </span>
                      <h4 className="text-base font-bold">{note.section_title}</h4>
                    </div>
                    <ul className="space-y-2 pl-1">
                      {note.content.split('\n').filter(line => line.trim().length > 0).map((line, j) => {
                        const trimmed = line.trim();
                        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
                        const text = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : trimmed;
                        
                        return (
                          <li key={j} className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground">
                            <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${isBullet ? 'bg-primary' : 'bg-muted-foreground/30'}`}></span>
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

          {!loading && !error && (!notesData || !notesData.notes || notesData.notes.length === 0) && (
            <p className="text-muted-foreground text-center py-8">No notes could be generated for this video.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
