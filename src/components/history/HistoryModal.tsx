import { ReactNode } from "react";
import { X, Brain, Mic, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizHistoryPanel } from "./QuizHistoryPanel";
import { InterviewHistoryPanel } from "./InterviewHistoryPanel";
import { CourseHistoryPanel } from "./CourseHistoryPanel";
import { cn } from "@/lib/utils";

export type HistoryType = "quiz" | "interview" | "courses" | null;

interface HistoryModalProps {
  type: HistoryType;
  onClose: () => void;
}

const CONFIG: Record<
  Exclude<HistoryType, null>,
  {
    title: string;
    subtitle: string;
    icon: any;
    gradient: string;
    panel: ReactNode;
  }
> = {
  quiz: {
    title: "Quiz History",
    subtitle: "All your quiz attempts with detailed breakdowns",
    icon: Brain,
    gradient: "from-violet-500 to-primary",
    panel: <QuizHistoryPanel />,
  },
  interview: {
    title: "Interview History",
    subtitle: "Past mock interviews with AI feedback & transcripts",
    icon: Mic,
    gradient: "from-rose-500 to-pink-600",
    panel: <InterviewHistoryPanel />,
  },
  courses: {
    title: "Course History",
    subtitle: "Your full learning list and progress tracking",
    icon: BookOpen,
    gradient: "from-blue-500 to-cyan-500",
    panel: <CourseHistoryPanel />,
  },
};

export function HistoryModal({ type, onClose }: HistoryModalProps) {
  if (!type) return null;

  const cfg = CONFIG[type];
  const Icon = cfg.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl flex flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className={cn("p-6 text-white bg-gradient-to-r", cfg.gradient)}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{cfg.title}</h2>
                <p className="text-white/70 text-sm mt-0.5">{cfg.subtitle}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/20 -mr-1 -mt-1"
              id="history-modal-close-btn"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">{cfg.panel}</div>
      </div>
    </>
  );
}
