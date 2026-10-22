"use client";
import {
  BarChart3,
  CalendarCheck,
  Droplets,
  ExternalLink,
  Image as ImageIcon,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  Package,
  Palette,
  Settings,
  Star,
  Tags,
  Users,
  Video,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const MENU = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/landing", label: "Landing Page", icon: LayoutTemplate },
  { href: "/admin/products", label: "Produk", icon: Package },
  { href: "/admin/categories", label: "Kategori", icon: Tags },
  { href: "/admin/prices", label: "Harga", icon: Wallet },
  { href: "/admin/materials", label: "Material", icon: Layers },
  { href: "/admin/hpl", label: "HPL", icon: Palette },
  { href: "/admin/duco", label: "Cat Duco", icon: Droplets },
  { href: "/admin/hardware", label: "Hardware", icon: Wrench },
  { href: "/admin/portfolio", label: "Portfolio", icon: ImageIcon },
  { href: "/admin/videos", label: "Video", icon: Video },
  { href: "/admin/submissions", label: "Customer Submission", icon: Inbox },
  { href: "/admin/reviews", label: "Review", icon: Star },
  { href: "/admin/surveys", label: "Request Survey", icon: CalendarCheck },
  { href: "/admin/messages", label: "Kontak", icon: Mail },
  { href: "/admin/settings", label: "Pengaturan Website", icon: Settings },
  { href: "/admin/users", label: "Akun Admin", icon: Users },
];

export function AdminSidebar({ businessName, userLabel, badges }: { businessName: string; userLabel: string; badges: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <BarChart3 className="h-5 w-5 text-bronze-400" />
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-white">{businessName}</p>
          <p className="text-xs text-cream-200/50">Admin Panel</p>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {MENU.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active(href) ? "bg-white/10 font-semibold text-white" : "text-cream-200/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badges[href] ? <span className="rounded-full bg-bronze-400 px-2 py-0.5 text-[10px] font-bold text-charcoal-950">{badges[href]}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-4 text-xs text-cream-200/60">
        <Link href="/admin/users" className="block truncate hover:text-white" title="Kelola akun">
          {userLabel}
        </Link>
        <div className="mt-3 flex gap-2">
          <Link href="/" target="_blank" className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/15 py-2 hover:bg-white/5">
            <ExternalLink className="h-3.5 w-3.5" /> Website
          </Link>
          <form action={logoutAction} className="flex-1">
            <button className="flex w-full items-center justify-center gap-1 rounded-lg border border-white/15 py-2 hover:bg-white/5">
              <LogOut className="h-3.5 w-3.5" /> Keluar
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between bg-charcoal-950 px-4 py-3 text-white lg:hidden">
        <span className="font-display text-sm font-bold">{businessName} · Admin</span>
        <button onClick={() => setOpen(true)} aria-label="Buka menu admin">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-charcoal-950 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-charcoal-950">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 text-white" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
