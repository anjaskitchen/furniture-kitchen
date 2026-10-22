"use client";
import { ExternalLink, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/actions";
import { ADMIN_NAV, adminPageLabel, isActiveAdminPath, SIDEBAR_COOKIE } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";

interface Props {
  businessName: string;
  userLabel: string;
  role: string;
  badges: Record<string, number>;
  initialCollapsed: boolean;
  children: ReactNode;
}

function Brand({ name, collapsed }: { name: string; collapsed: boolean }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3" aria-label={`${name} — Dashboard`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bronze-400 font-display text-base font-bold text-charcoal-950">{name.charAt(0)}</span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold text-white">{name}</span>
          <span className="block text-[11px] text-cream-200/50">Admin Panel</span>
        </span>
      )}
    </Link>
  );
}

function NavList({ pathname, collapsed, badges, role, onNavigate }: { pathname: string; collapsed: boolean; badges: Record<string, number>; role: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Menu admin" className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-width:thin]">
      {ADMIN_NAV.map((group) => (
        <div key={group.title} className="mt-5 first:mt-2">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
          ) : (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-cream-200/35">{group.title}</p>
          )}
          <ul className="space-y-0.5">
            {group.items
              .filter((item) => !item.superAdmin || role === "admin")
              .map(({ href, label, icon: Icon }) => {
                const active = isActiveAdminPath(pathname, href);
                const badge = badges[href] ?? 0;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl text-sm transition-colors",
                        collapsed ? "h-10 justify-center" : "px-3 py-2.5",
                        active ? "bg-white/10 font-semibold text-white" : "text-cream-200/65 hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-bronze-400" aria-hidden />}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", active && "text-bronze-300")} />
                      {!collapsed && <span className="flex-1 truncate">{label}</span>}
                      {badge > 0 &&
                        (collapsed ? (
                          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-bronze-400 ring-2 ring-charcoal-950" aria-label={`${badge} baru`} />
                        ) : (
                          <span className="rounded-full bg-bronze-400 px-2 py-0.5 text-[10px] font-bold text-charcoal-950">{badge}</span>
                        ))}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserBox({ userLabel, role, collapsed }: { userLabel: string; role: string; collapsed: boolean }) {
  return (
    <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
      <Link
        href="/admin/users"
        title={collapsed ? `${userLabel} (${role})` : "Akun saya"}
        className={cn("flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/5", collapsed && "justify-center")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream-100 text-xs font-bold uppercase text-charcoal-900">{userLabel.slice(0, 2)}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{userLabel}</span>
            <span className="block text-[11px] capitalize text-cream-200/50">{role}</span>
          </span>
        )}
      </Link>
      <div className={cn("mt-2 grid gap-2", collapsed ? "grid-cols-1" : "grid-cols-2")}>
        <Link
          href="/"
          target="_blank"
          title="Lihat website"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-cream-200/80 transition hover:bg-white/5 hover:text-white"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {!collapsed && "Website"}
        </Link>
        <form action={logoutAction}>
          <button
            title="Keluar"
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-cream-200/80 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            {!collapsed && "Keluar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/** Kerangka admin: sidebar (bisa dilipat di desktop, drawer di mobile) + topbar. */
export function AdminShell({ businessName, userLabel, role, badges, initialCollapsed, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const page = adminPageLabel(pathname);

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);
  // Ctrl/⌘ + B: lipat/buka sidebar. Esc: tutup drawer mobile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const totalBadges = Object.values(badges).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-[100dvh] bg-cream-100 text-charcoal-900">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col bg-charcoal-950 transition-[width] duration-300 ease-out lg:flex",
          collapsed ? "w-[76px]" : "w-64",
        )}
      >
        <div className={cn("flex h-16 items-center gap-2 border-b border-white/5", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <Brand name={businessName} collapsed={collapsed} />
          {!collapsed && (
            <button onClick={toggle} className="rounded-lg p-2 text-cream-200/60 transition hover:bg-white/5 hover:text-white" aria-label="Lipat sidebar" title="Lipat sidebar (Ctrl+B)">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggle} className="mx-auto mt-3 rounded-lg p-2 text-cream-200/60 transition hover:bg-white/5 hover:text-white" aria-label="Buka sidebar" title="Buka sidebar (Ctrl+B)">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <NavList pathname={pathname} collapsed={collapsed} badges={badges} role={role} />
        <UserBox userLabel={userLabel} role={role} collapsed={collapsed} />
      </aside>

      {/* Drawer mobile */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", drawer ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!drawer} inert={!drawer}>
        <div className={cn("absolute inset-0 bg-charcoal-950/60 backdrop-blur-sm transition-opacity duration-300", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-charcoal-950 shadow-2xl transition-transform duration-300 ease-out",
            drawer ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
            <Brand name={businessName} collapsed={false} />
            <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-cream-200/70 hover:bg-white/5" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <NavList pathname={pathname} collapsed={false} badges={badges} role={role} onNavigate={() => setDrawer(false)} />
          <UserBox userLabel={userLabel} role={role} collapsed={false} />
        </aside>
      </div>

      <div className={cn("transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-charcoal-900/5 bg-cream-100/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <button onClick={() => setDrawer(true)} className="relative -ml-1 rounded-lg p-2 hover:bg-charcoal-900/5 lg:hidden" aria-label="Buka menu admin">
            <Menu className="h-5 w-5" />
            {totalBadges > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-wood-500" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-700/60 sm:block">{page.group}</p>
            <p className="truncate font-display text-base font-semibold leading-tight">{page.label}</p>
          </div>
          <Link href="/" target="_blank" className="btn-outline btn-sm hidden !py-2 sm:inline-flex">
            <ExternalLink className="h-3.5 w-3.5" /> Lihat Website
          </Link>
          <Link
            href="/admin/users"
            className="grid h-9 w-9 place-items-center rounded-full bg-charcoal-900 text-xs font-bold uppercase text-cream-50 lg:hidden"
            aria-label="Akun saya"
          >
            {userLabel.slice(0, 2)}
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
