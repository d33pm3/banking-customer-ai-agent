import { useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AlarmClock,
  BarChart3,
  BookOpen,
  Briefcase,
  ChevronLeft,
  ClipboardCheck,
  FileSearch,
  Flame,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Star,
  UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "./atoms";
import { cn } from "@/lib/utils";
import { getRecent, logout, useHydratedCases, visibleCases } from "@/lib/domain/store";
import type { User } from "@/lib/domain/types";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "branch", "cc", "digital", "gho", "hitl"] },
  { to: "/cases", label: "Cases", icon: Briefcase, roles: ["admin", "branch", "cc", "digital", "gho", "hitl"] },
  { to: "/agents", label: "Agents", icon: Gauge, roles: ["admin", "branch", "cc", "digital", "gho", "hitl"] },
  { to: "/routing", label: "Routing", icon: Route, roles: ["admin", "gho", "branch", "cc", "digital"] },
  { to: "/desk", label: "My Workbench", icon: ClipboardCheck, roles: ["admin", "branch", "cc", "digital", "gho"] },
  { to: "/hitl", label: "HITL Queue", icon: ShieldCheck, roles: ["admin", "hitl", "gho"] },
  { to: "/policy", label: "Policy Library", icon: BookOpen, roles: ["admin", "gho", "hitl", "branch", "cc", "digital"] },
  { to: "/audit", label: "Audit", icon: FileSearch, roles: ["admin", "gho", "hitl"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "gho"] },
  { to: "/admin", label: "Administration", icon: Settings2, roles: ["admin"] },
] as const;

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { cases } = useHydratedCases();
  const mine = useMemo(() => visibleCases(cases, user), [cases, user]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return mine
      .filter(
        (c) =>
          c.case_id.toLowerCase().includes(q) ||
          c.customer_token.toLowerCase().includes(q) ||
          c.product.toLowerCase().includes(q) ||
          c.narrative.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, mine]);

  const recent = getRecent();
  const nav = NAV.filter((n) => (n.roles as readonly string[]).includes(user.role));

  const quick = [
    { label: "My Cases", icon: Briefcase, search: {} as Record<string, string>, count: mine.length },
    { label: "HITL Pending", icon: ShieldCheck, search: { status: "HITL_REQUIRED" }, count: mine.filter((c) => c.status === "HITL_REQUIRED").length },
    { label: "SLA Breaches", icon: AlarmClock, search: { sla: "breached" }, count: mine.filter((c) => c.deadline && new Date(c.deadline.date).getTime() < Date.now()).length },
    { label: "High Severity", icon: Flame, search: { severity: "S1" }, count: mine.filter((c) => c.severity === "S1" || c.severity === "S2").length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-brand sticky top-0 z-40 border-b border-sidebar-border">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle menu"
          >
            <Menu className="size-5" />
          </Button>
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-black">
              SBF
            </span>
            <span className="hidden text-sidebar-foreground sm:block">
              <span className="block text-sm leading-4 font-extrabold">Complaint Navigator</span>
              <span className="block text-[11px] leading-4 opacity-70">State Bank of Faridabad</span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  pathname.startsWith(n.to) && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="relative ml-auto hidden md:block">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) {
                  navigate({ to: "/cases", search: { q: query.trim() } });
                  setQuery("");
                }
              }}
              placeholder="Search case ID, token, keywords…"
              className="w-64 bg-card pl-8"
            />
            {suggestions.length > 0 && (
              <div className="panel absolute top-11 right-0 z-50 w-96 overflow-hidden p-1">
                {suggestions.map((s) => (
                  <button
                    key={s.case_id}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setQuery("");
                      navigate({ to: "/cases/$caseId", params: { caseId: s.case_id } });
                    }}
                  >
                    <span className="mono text-xs font-semibold">{s.case_id}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{s.narrative.slice(0, 52)}…</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-sidebar-foreground">{user.user_id}</p>
              <p className="text-[11px] text-sidebar-foreground/70 capitalize">{user.role} role</p>
            </div>
            <UserCircle2 className="size-7 text-sidebar-foreground" />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                logout();
                navigate({ to: "/" });
              }}
            >
              <LogOut className="size-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-border bg-surface transition-all lg:block",
            collapsed ? "w-14" : "w-60",
          )}
        >
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
            <Button
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} />
            </Button>

            <div>
              {!collapsed && (
                <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Quick filters
                </p>
              )}
              <div className="space-y-1">
                {quick.map((q) => (
                  <Link
                    key={q.label}
                    to="/cases"
                    search={q.search}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <q.icon className="size-4 shrink-0 text-primary" />
                    {!collapsed && (
                      <>
                        <span className="truncate">{q.label}</span>
                        <span className="mono ml-auto text-xs text-muted-foreground">{q.count}</span>
                      </>
                    )}
                  </Link>
                ))}
              </div>
            </div>

            {!collapsed && (
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Recent cases
                </p>
                <div className="space-y-1">
                  {recent.length === 0 && <p className="px-2 text-xs text-muted-foreground">None yet</p>}
                  {recent.map((id) => (
                    <Link
                      key={id}
                      to="/cases/$caseId"
                      params={{ caseId: id }}
                      className="mono block truncate rounded-md px-2 py-1 text-xs hover:bg-muted"
                    >
                      {id}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {!collapsed && (
              <div>
                <p className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Bookmarks
                </p>
                <div className="space-y-1">
                  {mine.filter((c) => c.starred).length === 0 && (
                    <p className="px-2 text-xs text-muted-foreground">Star cases to pin them</p>
                  )}
                  {mine
                    .filter((c) => c.starred)
                    .slice(0, 6)
                    .map((c) => (
                      <Link
                        key={c.case_id}
                        to="/cases/$caseId"
                        params={{ caseId: c.case_id }}
                        className="mono flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Star className="size-3 fill-accent text-accent" /> {c.case_id}
                      </Link>
                    ))}
                </div>
              </div>
            )}

            {!collapsed && (
              <div className="mt-auto rounded-lg border border-border bg-card p-3">
                <Chip tone="info">{user.view_filter}</Chip>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex-1 p-3 sm:p-5">
          <nav className="mb-3 flex gap-1 overflow-x-auto lg:hidden">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
                  pathname.startsWith(n.to) && "bg-primary text-primary-foreground",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
}
