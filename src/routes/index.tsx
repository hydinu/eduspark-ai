import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Brain, MessageSquare, Mic, BookOpen, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  { icon: MessageSquare, title: "AI Tutor Chat", desc: "Ask anything, get instant explanations from your personal AI tutor." },
  { icon: BookOpen, title: "Smart Course Suggestions", desc: "Personalized courses, projects and tutorials based on your goals." },
  { icon: Brain, title: "Auto-Generated Quizzes", desc: "Test yourself on any topic with instantly generated quizzes." },
  { icon: Mic, title: "Interview Practice", desc: "Mock technical interviews with real-time AI feedback." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 lg:px-12 py-5">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">EduMate AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/dashboard"><Button variant="ghost">Open App</Button></Link>
          <Link to="/dashboard"><Button>Get started</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-24 px-6">
        <div className="absolute inset-0 bg-gradient-hero opacity-[0.07]" />
        <div className="absolute top-20 -left-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 -right-40 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-soft text-primary text-xs font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by advanced AI
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05]">
            Your AI-powered<br />
            <span className="bg-gradient-primary bg-clip-text text-transparent">learning companion</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Get personalized course suggestions, instant tutoring, auto-generated quizzes,
            and interview practice — all in one beautifully simple workspace.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link to="/dashboard">
              <Button size="lg" className="h-12 px-6 text-base shadow-glow">
                Start learning free
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline" className="h-12 px-6 text-base">
                Go to Dashboard
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
            {["No credit card", "Free forever", "Setup in 30s"].map((t) => (
              <div key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-secondary/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold">Everything you need to learn faster</h2>
            <p className="mt-3 text-muted-foreground">Four powerful tools, working together.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-card rounded-2xl p-6 shadow-card border hover:shadow-soft transition-shadow">
                <div className="h-11 w-11 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto bg-gradient-primary rounded-3xl p-10 md:p-14 text-center shadow-glow">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">Ready to level up your learning?</h2>
          <p className="mt-3 text-primary-foreground/80">Join students using AI to study smarter, not harder.</p>
          <Link to="/dashboard" className="inline-block mt-7">
            <Button size="lg" variant="secondary" className="h-12 px-6 text-base">
              Get started — it's free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t text-center text-sm text-muted-foreground">
        © 2026 EduMate AI. Learn smarter.
      </footer>
    </div>
  );
}
