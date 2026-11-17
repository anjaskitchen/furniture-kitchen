"use client";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  LogOut,
  type LucideIcon,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  UserCog,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/actions";
import { ADMIN_NAV, adminPageLabel, isActiveAdminPath, SIDEBAR_COOKIE } from "@/lib/admin/navigation";
import { cn } from "@/lib/utils";
import { type CommandItem, CommandPalette } from "./CommandPalette";

interface Props {
  businessName: string;
  logoUrl?: string | null;
  userLabel: string;
  role: string;
  badges: Record<string, number>;
  initialCollapsed: boolean;
  children: ReactNode;
}

/** Aksi "buat baru" yang paling sering dipakai. */
const CREATE_ACTIONS: { href: string; label: string; hint: string; icon: LucideIcon; superAdmin?: boolean }[] = [
  { href: "/admin/orders/new", label: "Order baru", hint: "Catat pesanan customer", icon: Receipt },
  { href: "/admin/pembelian/new", label: "Pembelian bahan", hint: "Buat PO ke supplier", icon: ShoppingCart },
  { href: "/admin/absensi", label: "Catat absensi", hint: "Kehadiran pegawai hari ini", icon: CalendarDays },
  { href: "/admin/products", label: "Produk katalog", hint: "Tambah / ubah produk", icon: Package },
  { href: "/admin/portfolio", label: "Portfolio", hint: "Tambah hasil pekerjaan", icon: ImageIcon },
];

/** Sinonim agar pencarian menu mudah ("gaji" → Penggajian, dst.). */
const KEYWORDS: Record<string, string> = {
  "/admin": "beranda home ringkasan",
  "/admin/orders": "pesanan invoice penjualan customer",
  "/admin/reports": "laporan kpi omset excel",
  "/admin/hpp": "harga pokok modal margin laba persentase",
  "/admin/invoice-settings": "rekening bank logo invoice syarat",
  "/admin/proyek": "rab timeline jadwal progres pekerjaan",
  "/admin/pembelian": "po purchase beli supplier",
  "/admin/stok": "inventory gudang persediaan",
  "/admin/bahan": "material item hpl multiplek",
  "/admin/suppliers": "pemasok toko vendor",
  "/admin/template-material": "formula rumus kebutuhan",
  "/admin/pegawai": "karyawan tukang sdm",
  "/admin/absensi": "kehadiran hadir izin",
  "/admin/penggajian": "gaji slip payroll upah kasbon",
  "/admin/keuangan": "kas uang laba rugi pengeluaran bank",
  "/admin/products": "katalog barang",
  "/admin/categories": "kategori jenis",
  "/admin/portfolio": "galeri project hasil",
  "/admin/clients": "klien logo instansi",
  "/admin/prices": "kalkulator estimasi harga",
  "/admin/materials": "bahan kalkulator",
  "/admin/hpl": "warna motif",
  "/admin/duco": "cat warna",
  "/admin/hardware": "engsel rel aksesoris",
  "/admin/surveys": "leads permintaan ukur",
  "/admin/messages": "leads kontak inbox",
  "/admin/submissions": "kiriman customer approval",
  "/admin/reviews": "ulasan testimoni google",
  "/admin/settings": "whatsapp alamat logo hero seo google",
  "/admin/users": "akun password login admin",
  "/admin/landing": "beranda section hero faq",
  "/admin/videos": "youtube",
};

const BADGE_LABEL: Record<string, string> = {
  "/admin/surveys": "request survey baru",
  "/admin/messages": "pesan kontak baru",
  "/admin/submissions": "kiriman customer menunggu persetujuan",
};

function Brand({ name, logoUrl, collapsed }: { name: string; logoUrl?: string | null; collapsed: boolean }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-3" aria-label={`${name} — Dashboard`}>
      {logoUrl ? (
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-white/10">
          <Image src={logoUrl} alt="" width={36} height={36} unoptimized className="h-full w-full object-contain" />
        </span>
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-bronze-300 to-wood-500 font-display text-base font-bold text-charcoal-950 shadow-[0_6px_20px_-6px_rgba(200,164,106,0.7)]">
          {name.charAt(0)}
        </span>
      )}
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-bold text-white">{name}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-cream-200/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden /> Admin Panel
          </span>
        </span>
      )}
    </Link>
  );
}

function NavList({ pathname, collapsed, badges, role, onNavigate }: { pathname: string; collapsed: boolean; badges: Record<string, number>; role: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Menu admin" className="admin-scroll flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
      {ADMIN_NAV.filter((group) => group.items.some((item) => !item.superAdmin || role === "admin")).map((group) => (
        <div key={group.title} className="mt-5 first:mt-2">
          {collapsed ? (
            <div className="mx-auto mb-2 h-px w-6 bg-white/10" aria-hidden />
          ) : (
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-cream-200/35">{group.title}</p>
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
                        "group relative flex items-center gap-3 rounded-xl text-sm transition-all duration-200",
                        collapsed ? "h-10 justify-center" : "px-3 py-2.5",
                        active
                          ? "bg-gradient-to-r from-bronze-400/20 via-bronze-400/10 to-transparent font-semibold text-white ring-1 ring-inset ring-bronze-400/20"
                          : "text-cream-200/65 hover:bg-white/[0.06] hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-bronze-400 shadow-[0_0_12px_rgba(200,164,106,0.9)]" aria-hidden />}
                      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110", active && "text-bronze-300")} />
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

function SidebarSearch({ collapsed, onOpen }: { collapsed: boolean; onOpen: () => void }) {
  return (
    <div className={cn("px-3 pt-3", collapsed && "px-2")}>
      <button
        type="button"
        onClick={onOpen}
        title="Cari menu (Ctrl+K)"
        aria-label="Cari menu"
        className={cn(
          "flex h-10 w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-cream-200/60 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white",
          collapsed ? "justify-center" : "px-3",
        )}
      >
        <Search className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">Cari menu…</span>
            <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-cream-200/60">Ctrl K</kbd>
          </>
        )}
      </button>
    </div>
  );
}

function UserBox({ userLabel, role, collapsed }: { userLabel: string; role: string; collapsed: boolean }) {
  return (
    <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
      <Link
        href="/admin/users"
        title={collapsed ? `${userLabel} (${role})` : "Akun saya"}
        className={cn("flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.06]", collapsed && "justify-center")}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cream-50 to-cream-300 text-xs font-bold uppercase text-charcoal-900">{userLabel.slice(0, 2)}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{userLabel}</span>
            <span className="block text-[11px] capitalize text-cream-200/50">{role === "admin" ? "Admin utama" : role}</span>
          </span>
        )}
      </Link>
      <div className={cn("mt-2 grid gap-2", collapsed ? "grid-cols-1" : "grid-cols-2")}>
        <Link
          href="/"
          target="_blank"
          title="Lihat website"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs text-cream-200/80 transition hover:bg-white/[0.06] hover:text-white"
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

const SIDEBAR_BG =
  "bg-[#0d0d0e] bg-[radial-gradient(120%_60%_at_0%_0%,rgba(200,164,106,0.16),transparent_60%),radial-gradient(90%_50%_at_100%_100%,rgba(154,107,67,0.14),transparent_60%)]";
const ICON_BTN = "relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-charcoal-800 transition hover:bg-charcoal-900/[0.06] focus-visible:ring-offset-0";
const POPOVER = "absolute right-0 top-[calc(100%+8px)] z-50 origin-top-right rounded-2xl bg-white p-2 shadow-[0_24px_60px_-18px_rgba(18,18,18,0.35)] ring-1 ring-charcoal-900/10 admin-pop";

type MenuKey = null | "create" | "notif" | "user";

/** Kerangka admin: sidebar (bisa dilipat di desktop, drawer di mobile) + topbar dengan pencarian, buat baru, notifikasi. */
export function AdminShell({ businessName, logoUrl, userLabel, role, badges, initialCollapsed, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState<MenuKey>(null);
  const menus = useRef<HTMLDivElement>(null);
  const page = adminPageLabel(pathname);
  const isOwner = role === "admin";

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/admin; max-age=31536000; samesite=lax`;
      return next;
    });
  }, []);

  useEffect(() => {
    setDrawer(false);
    setMenu(null);
  }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);
  // Ctrl/⌘+K: cari menu · Ctrl/⌘+B: lipat sidebar · Esc: tutup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenu(null);
        setPalette((p) => !p);
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        setDrawer(false);
        setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !menus.current?.contains(e.target as Node) && setMenu(null);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  const totalBadges = Object.values(badges).reduce((a, b) => a + b, 0);
  const notifications = Object.entries(badges).filter(([, n]) => n > 0);
  const createActions = useMemo(() => CREATE_ACTIONS.filter((a) => !a.superAdmin || isOwner), [isOwner]);

  const commands = useMemo<CommandItem[]>(
    () => [
      ...createActions.map((a) => ({ href: a.href, label: a.label, group: "Aksi cepat", icon: a.icon, keywords: `buat tambah baru ${a.hint}` })),
      ...ADMIN_NAV.flatMap((g) => g.items.filter((i) => !i.superAdmin || isOwner).map((i) => ({ href: i.href, label: i.label, group: g.title, icon: i.icon, keywords: KEYWORDS[i.href] }))),
      { href: "/", label: "Lihat website", group: "Lainnya", icon: ExternalLink, keywords: "situs publik beranda", external: true },
    ],
    [createActions, isOwner],
  );
  const openPalette = () => {
    setDrawer(false);
    setMenu(null);
    setPalette(true);
  };

  return (
    <div className="admin-app min-h-[100dvh] text-charcoal-900">
      {/* Sidebar desktop */}
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/5 transition-[width] duration-300 ease-out lg:flex", SIDEBAR_BG, collapsed ? "w-[76px]" : "w-64")}>
        <div className={cn("flex h-16 items-center gap-2 border-b border-white/5", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <Brand name={businessName} logoUrl={logoUrl} collapsed={collapsed} />
          {!collapsed && (
            <button onClick={toggle} className="rounded-lg p-2 text-cream-200/60 transition hover:bg-white/[0.06] hover:text-white" aria-label="Lipat sidebar" title="Lipat sidebar (Ctrl+B)">
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>
        {collapsed && (
          <button onClick={toggle} className="mx-auto mt-3 rounded-lg p-2 text-cream-200/60 transition hover:bg-white/[0.06] hover:text-white" aria-label="Buka sidebar" title="Buka sidebar (Ctrl+B)">
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
        <SidebarSearch collapsed={collapsed} onOpen={openPalette} />
        <NavList pathname={pathname} collapsed={collapsed} badges={badges} role={role} />
        <UserBox userLabel={userLabel} role={role} collapsed={collapsed} />
      </aside>

      {/* Drawer mobile */}
      <div className={cn("fixed inset-0 z-50 lg:hidden", drawer ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!drawer} inert={!drawer}>
        <div className={cn("absolute inset-0 bg-charcoal-950/60 backdrop-blur-sm transition-opacity duration-300", drawer ? "opacity-100" : "opacity-0")} onClick={() => setDrawer(false)} />
        <aside className={cn("absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col shadow-2xl transition-transform duration-300 ease-out", SIDEBAR_BG, drawer ? "translate-x-0" : "-translate-x-full")}>
          <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
            <Brand name={businessName} logoUrl={logoUrl} collapsed={false} />
            <button onClick={() => setDrawer(false)} className="rounded-lg p-2 text-cream-200/70 hover:bg-white/[0.06]" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
          </div>
          <SidebarSearch collapsed={false} onOpen={openPalette} />
          <NavList pathname={pathname} collapsed={false} badges={badges} role={role} onNavigate={() => setDrawer(false)} />
          <UserBox userLabel={userLabel} role={role} collapsed={false} />
        </aside>
      </div>

      <div className={cn("transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-charcoal-900/[0.06] bg-white/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-6 lg:px-8">
          <button onClick={() => setDrawer(true)} className={cn(ICON_BTN, "lg:hidden")} aria-label="Buka menu admin">
            <Menu className="h-5 w-5" />
            {totalBadges > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-wood-500 ring-2 ring-white" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-charcoal-700/60 sm:flex">
              Admin <ChevronRight className="h-3 w-3" /> {page.group}
            </p>
            <p className="truncate font-display text-base font-semibold leading-tight">{page.label}</p>
          </div>

          {/* Pencarian */}
          <button
            type="button"
            onClick={openPalette}
            className="hidden h-10 w-56 items-center gap-2.5 rounded-xl border border-charcoal-900/10 bg-white/80 px-3 text-sm text-charcoal-700/70 shadow-[0_1px_2px_rgba(18,18,18,0.04)] transition hover:border-charcoal-900/25 hover:text-charcoal-900 md:flex xl:w-72"
            aria-label="Cari menu (Ctrl+K)"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Cari menu…</span>
            <kbd className="rounded-md border border-charcoal-900/10 bg-cream-50 px-1.5 py-0.5 text-[10px] font-medium text-charcoal-700">Ctrl K</kbd>
          </button>
          <button type="button" onClick={openPalette} className={cn(ICON_BTN, "md:hidden")} aria-label="Cari menu">
            <Search className="h-5 w-5" />
          </button>

          <div ref={menus} className="flex items-center gap-1 sm:gap-2">
            {/* Buat baru */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "create" ? null : "create"))}
                aria-haspopup="menu"
                aria-expanded={menu === "create"}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-charcoal-900 px-3 text-sm font-semibold text-cream-50 shadow-[0_8px_20px_-10px_rgba(18,18,18,0.7)] transition hover:bg-wood-600 sm:px-4"
              >
                <Plus className={cn("h-4 w-4 transition-transform duration-200", menu === "create" && "rotate-45")} />
                <span className="hidden sm:inline">Buat</span>
              </button>
              {menu === "create" && (
                <div role="menu" className={cn(POPOVER, "w-72")}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-700/50">Buat baru</p>
                  {createActions.map(({ href, label, hint, icon: Icon }) => (
                    <Link key={href} href={href} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream-100">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-wood-600">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block truncate text-xs text-charcoal-700/70">{hint}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Notifikasi */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "notif" ? null : "notif"))}
                aria-haspopup="menu"
                aria-expanded={menu === "notif"}
                aria-label={totalBadges ? `${totalBadges} hal perlu ditindak` : "Notifikasi"}
                className={ICON_BTN}
              >
                <Bell className="h-5 w-5" />
                {totalBadges > 0 && (
                  <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">{totalBadges > 99 ? "99+" : totalBadges}</span>
                )}
              </button>
              {menu === "notif" && (
                <div role="menu" className={cn(POPOVER, "w-80")}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-charcoal-700/50">Perlu ditindak</p>
                  {notifications.length ? (
                    notifications.map(([href, n]) => {
                      const item = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.href === href);
                      const Icon = item?.icon ?? Bell;
                      return (
                        <Link key={href} href={href} role="menuitem" className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-cream-100">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1 text-sm">
                            <strong className="font-semibold">{n}</strong> {BADGE_LABEL[href] ?? item?.label ?? "hal baru"}
                          </span>
                          <ChevronRight className="h-4 w-4 text-charcoal-700/40" />
                        </Link>
                      );
                    })
                  ) : (
                    <p className="flex items-center gap-2 px-3 py-4 text-sm text-charcoal-700">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Semua beres. Tidak ada yang menunggu.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Akun */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => (m === "user" ? null : "user"))}
                aria-haspopup="menu"
                aria-expanded={menu === "user"}
                aria-label="Menu akun"
                className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-charcoal-800 to-charcoal-950 text-xs font-bold uppercase text-cream-50 ring-2 ring-white transition hover:ring-bronze-300"
              >
                {userLabel.slice(0, 2)}
              </button>
              {menu === "user" && (
                <div role="menu" className={cn(POPOVER, "w-60")}>
                  <div className="px-3 pb-2 pt-2">
                    <p className="truncate text-sm font-semibold">{userLabel}</p>
                    <p className="text-xs capitalize text-charcoal-700/70">{isOwner ? "Admin utama" : role}</p>
                  </div>
                  <div className="border-t border-charcoal-900/10 pt-1">
                    <Link href="/admin/users" role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition hover:bg-cream-100">
                      <UserCog className="h-4 w-4 text-charcoal-700" /> Akun & password
                    </Link>
                    <Link href="/" target="_blank" role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition hover:bg-cream-100">
                      <ExternalLink className="h-4 w-4 text-charcoal-700" /> Lihat website
                    </Link>
                    <form action={logoutAction}>
                      <button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50">
                        <LogOut className="h-4 w-4" /> Keluar
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="admin-main mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} items={commands} />
    </div>
  );
}
