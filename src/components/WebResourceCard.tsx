import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { downloadNotesAsPDF, NotesData } from "@/lib/pdf-generator";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface WebResource {
  title: string;
  url: string;
  site: string;
  site_label: string;
  snippet: string;
  favicon: string;
}

interface WebResourceCardProps {
  resource: WebResource;
  index: number;
}

async function fetchWebNotes(url: string, title: string): Promise<NotesData> {
  const res = await fetch(`${BACKEND_URL}/api/web-page-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

export function WebResourceCard({ resource, index }: WebResourceCardProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleGetNotes() {
    setLoading(true);
    setDone(false);
    try {
      toast.loading("Scraping article & generating notes…", { id: "web-notes" });
      const notes = await fetchWebNotes(resource.url, resource.title);
      toast.dismiss("web-notes");
      toast.success("Notes ready! Downloading PDF…");
      await downloadNotesAsPDF(notes);
      setDone(true);
    } catch (err: any) {
      toast.dismiss("web-notes");
      const msg = err.message || "";
      if (msg.includes("fetch") || msg.includes("Failed to fetch")) {
        toast.error("Backend not running. Start with: python backend.py");
      } else if (msg.includes("paywalled") || msg.includes("422")) {
        toast.error("This page is paywalled or login-required.");
      } else {
        toast.error(msg || "Could not generate notes. Try another article.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="p-4 hover:shadow-soft transition-all duration-200 flex flex-col gap-3 border border-border/60 hover:border-primary/20 animate-in fade-in slide-in-from-bottom-3"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "both" }}
    >
      {/* Site header */}
      <div className="flex items-center gap-2">
        <img
          src={resource.favicon}
          alt={resource.site_label}
          className="w-4 h-4 rounded-sm"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5 font-medium">
          {resource.site_label}
        </Badge>
      </div>

      {/* Title */}
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-sm leading-snug hover:text-primary transition-colors line-clamp-2"
      >
        {resource.title}
      </a>

      {/* Snippet */}
      {resource.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
          {resource.snippet}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-auto">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-8 text-xs"
          asChild
        >
          <a href={resource.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1.5" />
            Open Article
          </a>
        </Button>

        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          onClick={handleGetNotes}
          disabled={loading}
          variant={done ? "secondary" : "default"}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Generating…</>
          ) : done ? (
            <><CheckCircle className="h-3 w-3 mr-1.5 text-green-500" /> Downloaded</>
          ) : (
            <><FileText className="h-3 w-3 mr-1.5" /> Quick Notes PDF</>
          )}
        </Button>
      </div>
    </Card>
  );
}
