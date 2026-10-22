/** Menu utama website. `wide`: hanya tampil di navbar layar lebar (xl), selalu ada di menu mobile & footer. */
export const NAV_ITEMS = [
  { href: "/", label: "Home", wide: true },
  { href: "/katalog", label: "Katalog" },
  { href: "/kalkulator", label: "Kalkulator Harga" },
  { href: "/bahan-warna", label: "Bahan & Warna" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/video", label: "Video", wide: true },
  { href: "/tentang", label: "Tentang Kami" },
  { href: "/review", label: "Review", wide: true },
  { href: "/kontak", label: "Kontak" },
] as const;
