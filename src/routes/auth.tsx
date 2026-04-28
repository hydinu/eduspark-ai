import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function AuthPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (error.message.toLowerCase().includes("email not confirmed")) {
        toast.error("Please confirm your email before signing in. Check your inbox.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back!");
    nav({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: name || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    // If session is returned immediately → email confirmation is disabled → go to dashboard
    if (data.session) {
      toast.success("Account created! Welcome!");
      nav({ to: "/dashboard" });
      return;
    }
    // Email confirmation required → show pending screen
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MailCheck className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Check your email 📬</h1>
          <p className="text-muted-foreground mb-1">
            We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Click the link in the email to activate your account, then come back here to sign in.
          </p>
          <Button variant="outline" onClick={() => setAwaitingConfirmation(false)} className="w-full h-11">
            Back to sign in
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Didn't receive it? Check your spam folder or{" "}
            <button
              className="underline text-primary hover:text-primary/80"
              onClick={async () => {
                const { error } = await supabase.auth.resend({ type: "signup", email });
                if (error) toast.error(error.message);
                else toast.success("Confirmation email resent!");
              }}
            >
              resend it
            </button>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form */}
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">EduMate AI</span>
          </Link>

          <h1 className="text-3xl font-bold">Welcome 👋</h1>
          <p className="text-muted-foreground mt-1.5 mb-8">Sign in or create your free account.</p>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <Label htmlFor="email2">Email</Label>
                  <Input id="email2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" />
                </div>
                <div>
                  <Label htmlFor="password2">Password</Label>
                  <Input id="password2" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right: visual */}
      <div className="hidden lg:flex relative bg-gradient-hero items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "32px 32px" }} />
        <div className="relative max-w-md text-primary-foreground">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs font-medium mb-6">
            ✨ Trusted by curious learners
          </div>
          <h2 className="text-4xl font-bold leading-tight">Learn anything, faster — with your personal AI tutor.</h2>
          <p className="mt-4 text-primary-foreground/80">Personalized courses, instant doubt solving, smart quizzes and mock interviews. All in one place.</p>

          <div className="mt-10 grid grid-cols-2 gap-3">
            {["AI Tutor", "Quizzes", "Courses", "Interviews"].map((s) => (
              <div key={s} className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/10">
                <div className="text-sm font-semibold">{s}</div>
                <div className="text-xs text-primary-foreground/70 mt-0.5">Ready to go</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
