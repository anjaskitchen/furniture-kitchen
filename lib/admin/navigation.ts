import {
  CalendarCheck,
  Droplets,
  Image as ImageIcon,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  type LucideIcon,
  Mail,
  Package,
  Palette,
  Settings,
  Star,
  Tags,
  Users,
  Video,
  Wallet,
  Wrench,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hanya untuk role admin penuh. */
  superAdmin?: boolean;
}

export const ADMIN_NAV: { title: string; items: AdminNavItem[] }[] = [
  {
    title: "Utama",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/landing", label: "Landing Page", icon: LayoutTemplate },
    ],
  },
  {
    title: "Katalog",
    items: [
      { href: "/admin/products", label: "Produk", icon: Package },
      { href: "/admin/categories", label: "Kategori", icon: Tags },
      { href: "/admin/portfolio", label: "Portfolio", icon: ImageIcon },
      { href: "/admin/videos", label: "Video", icon: Video },
    ],
  },
  {
    title: "Harga & Material",
    items: [
      { href: "/admin/prices", label: "Harga Kalkulator", icon: Wallet },
      { href: "/admin/materials", label: "Material", icon: Layers },
      { href: "/admin/hpl", label: "Warna HPL", icon: Palette },
      { href: "/admin/duco", label: "Cat Duco", icon: Droplets },
      { href: "/admin/hardware", label: "Hardware", icon: Wrench },
    ],
  },
  {
    title: "Leads & Review",
    items: [
      { href: "/admin/surveys", label: "Request Survey", icon: CalendarCheck },
      { href: "/admin/messages", label: "Pesan Kontak", icon: Mail },
      { href: "/admin/submissions", label: "Customer Submission", icon: Inbox },
      { href: "/admin/reviews", label: "Review", icon: Star },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/admin/settings", label: "Pengaturan Website", icon: Settings },
      { href: "/admin/users", label: "Akun Admin", icon: Users },
    ],
  },
];

export const isActiveAdminPath = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

export function adminPageLabel(pathname: string) {
  for (const group of ADMIN_NAV) for (const item of group.items) if (isActiveAdminPath(pathname, item.href) && item.href !== "/admin") return { group: group.title, label: item.label };
  return { group: "Utama", label: "Dashboard" };
}

export const SIDEBAR_COOKIE = "admin-sidebar";
