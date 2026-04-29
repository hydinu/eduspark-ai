import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    // If already logged in (real user), go straight to dashboard
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AuthPage,
});

type Tab = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otp, setOtp] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields."); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back! 🎉");
      navigate({ to: "/dashboard" });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) { toast.error("Please fill in all fields."); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters."); return; }
    setLoading(true);
    
    // In Supabase, if OTP is enabled, we still call signUp.
    // It will send an OTP if configured in the dashboard.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { 
        data: { display_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    });
    
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification code sent to your email! ✉️");
      setShowOtp(true);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) { toast.error("Please enter the OTP."); return; }
    setLoading(true);
    
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup'
    });
    
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email verified! Welcome to EduSpark. 🎉");
      navigate({ to: "/dashboard" });
    }
  };

  const handleGuest = () => {
    localStorage.setItem("eduspark_guest", "true");
    toast.success("Continuing as guest — your progress won't be saved.");
    navigate({ to: "/dashboard" });
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    const demoEmail = "demo@eduspark.ai";
    const demoPass = "password123";

    // Try login first
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPass });
    
    if (loginError) {
      // If login fails, try signing up the demo account
      const { error: signupError } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPass,
        options: { data: { display_name: "Demo Student" } }
      });
      
      if (signupError) {
        toast.error("Demo login failed. Please use guest mode.");
      } else {
        toast.success("Demo account created! Logging in...");
        await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPass });
        navigate({ to: "/dashboard" });
      }
    } else {
      toast.success("Logged in as Demo User! 🎉");
      navigate({ to: "/dashboard" });
    }
    setLoading(false);
  };

  const features = ["No credit card required", "Free forever", "AI-powered learning"];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] bg-gradient-primary p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg backdrop-blur">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <span className="font-bold text-2xl text-white">EduSpark AI</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Your personal<br />
            <span className="text-white/80">AI learning</span><br />
            companion
          </h1>
          <p className="mt-5 text-white/70 text-base leading-relaxed max-w-sm">
            Get personalized courses, AI tutoring, auto-generated quizzes, and mock interviews — all in one place.
          </p>
          <div className="mt-8 space-y-3">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-white/80 text-sm">
                <CheckCircle2 className="h-4 w-4 text-white/60 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="relative">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">P</div>
              <div>
                <p className="text-white text-sm font-medium">Prashant</p>
                <p className="text-white/60 text-xs">Just got 95% on a React quiz!</p>
              </div>
            </div>
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5].map(s => <Sparkles key={s} className="h-3 w-3 text-yellow-300 fill-yellow-300" />)}
            </div>
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl">EduSpark AI</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight">
              {tab === "login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="mt-1.5 text-muted-foreground text-sm">
              {tab === "login"
                ? "Sign in to continue your learning journey."
                : "Join thousands of students learning with AI."}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-secondary rounded-xl p-1 mb-7 gap-1">
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                id={`auth-tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Form */}
          {!showOtp ? (
            <form onSubmit={tab === "login" ? handleLogin : handleSignup} className="space-y-4">
              {tab === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-display-name" className="text-sm font-medium">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="auth-display-name"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10 h-11"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="auth-password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-password"
                    type={showPass ? "text" : "password"}
                    placeholder={tab === "signup" ? "Min 6 characters" : "Your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11"
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                id="auth-submit-btn"
                type="submit"
                className="w-full h-11 text-sm font-semibold shadow-glow mt-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {tab === "login" ? "Signing in…" : "Sending code…"}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {tab === "login" ? "Sign In" : "Get OTP Code"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-otp" className="text-sm font-medium">Enter 6-digit Code</Label>
                  <button 
                    type="button" 
                    onClick={() => setShowOtp(false)}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit Email
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="auth-otp"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="h-12 text-center text-2xl tracking-[0.5em] font-bold"
                    maxLength={6}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-center">We've sent a code to {email}</p>
              </div>

              <Button
                id="auth-verify-btn"
                type="submit"
                className="w-full h-11 text-sm font-semibold shadow-glow"
                disabled={loading || otp.length < 6}
              >
                {loading ? "Verifying..." : "Verify & Complete Signup"}
              </Button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 my-5">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Quick Access */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <Button
              id="auth-demo-btn"
              variant="outline"
              className="h-11 text-xs font-medium border-primary/30 hover:bg-primary-soft/30"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              <User className="h-4 w-4 mr-2 text-primary" />
              Quick Demo
            </Button>
            
            <Button
              id="auth-guest-btn"
              variant="outline"
              className="h-11 text-xs font-medium"
              onClick={handleGuest}
              disabled={loading}
            >
              <Sparkles className="h-4 w-4 mr-2 text-primary" />
              Guest Mode
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {tab === "login" ? (
              <>Don't have an account?{" "}
                <button id="auth-switch-to-signup" onClick={() => setTab("signup")} className="text-primary font-medium hover:underline">Sign up free</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button id="auth-switch-to-login" onClick={() => setTab("login")} className="text-primary font-medium hover:underline">Sign in</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
