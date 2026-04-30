import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  MessageSquare,
  BookOpen,
  Brain,
  Mic,
  LayoutDashboard,
  LogOut,
  LogIn,
  Sparkles,
  UserCircle2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/courses", label: "Courses", icon: BookOpen },
  { to: "/chat", label: "AI Tutor", icon: MessageSquare },
  { to: "/quizzes", label: "Quizzes", icon: Brain },
  { to: "/interview", label: "Interview", icon: Mic },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
] as const;

function isGuestMode() {
  return typeof window !== "undefined" && localStorage.getItem("eduspark_guest") === "true";
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const loc = useLocation();
  const nav2 = useNavigate();
  const guest = !user && isGuestMode();

  const handleSignOut = async () => {
    if (guest) {
      localStorage.removeItem("eduspark_guest");
      toast.success("Signed out of guest mode.");
    } else {
      await signOut();
      toast.success("Signed out successfully.");
    }
    nav2({ to: "/auth" });
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Guest";
  const avatar = guest ? "G" : (displayName[0] ?? "U").toUpperCase();

  return (
    <div className="min-h-screen flex bg-background">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-6 py-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-soft">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-sidebar-foreground">EduSpark</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              AI Learning
            </span>
          </div>
        </Link>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {nav.map((item) => {
            const active = loc.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User panel */}
        <div className="p-4 border-t border-sidebar-border">
          {/* Guest banner */}
          {guest && (
            <div className="mb-3 px-3 py-2.5 rounded-lg bg-primary-soft border border-primary/20">
              <p className="text-xs font-medium text-primary mb-1.5">Guest Mode</p>
              <p className="text-[11px] text-muted-foreground leading-snug mb-2">
                Your progress won't be saved. Sign in for full features.
              </p>
              <Link to="/auth">
                <Button size="sm" className="w-full h-7 text-xs" id="sidebar-signin-btn">
                  <LogIn className="h-3.5 w-3.5 mr-1.5" />
                  Sign In / Sign Up
                </Button>
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                guest
                  ? "bg-muted text-muted-foreground"
                  : "bg-gradient-primary text-primary-foreground",
              )}
            >
              {avatar}
            </div>
            <Link to="/profile" className="flex-1 min-w-0 cursor-pointer hover:opacity-80">
              <p className="text-sm font-medium truncate">{guest ? "Guest User" : displayName}</p>
              <p className="text-xs text-muted-foreground">{guest ? "No account" : "Student"}</p>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label={guest ? "Exit guest mode" : "Sign out"}
              id="sidebar-signout-btn"
              title={guest ? "Exit guest mode" : "Sign out"}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ═══ Main content area ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── Mobile header ─── */}
        <header className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b bg-card sticky top-0 z-30">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">EduSpark</span>
          </Link>
          <div className="flex items-center gap-1.5">
            {guest ? (
              <Link to="/auth">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 px-2.5"
                  id="mobile-signin-btn"
                >
                  <LogIn className="h-3 w-3 mr-1" /> Sign In
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground hidden sm:block">{displayName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleSignOut}
                  id="mobile-signout-btn"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Guest top-bar notice on mobile — compact */}
        {guest && (
          <div className="lg:hidden flex items-center justify-between px-3 py-1.5 bg-primary-soft border-b border-primary/20 text-xs">
            <span className="text-primary font-medium flex items-center gap-1">
              <UserCircle2 className="h-3 w-3" />
              Guest mode
            </span>
            <Link to="/auth" className="text-primary font-semibold underline">
              Sign In
            </Link>
          </div>
        )}

        {/* Page content — bottom padding to clear the tab bar */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>

        {/* ═══ Mobile bottom tab bar — replaces the old scrolling nav ═══ */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom"
          id="mobile-bottom-nav"
        >
          <div className="flex items-stretch justify-around h-14">
            {nav.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  <span
                    className={cn(
                      "text-[10px] font-medium leading-none truncate max-w-full px-0.5",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: any;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
      <div className="flex items-start gap-2 sm:gap-3 min-w-0">
        {Icon && (
          <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl bg-primary-soft flex items-center justify-center text-primary shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export { Sparkles };
