/** Ikon yang bisa dipilih admin untuk poin keunggulan / proses / statistik (data murni, aman untuk client). */
export const FEATURE_ICONS = [
  { value: "sparkles", label: "Sparkles" },
  { value: "star", label: "Bintang" },
  { value: "shield-check", label: "Perisai (garansi)" },
  { value: "award", label: "Penghargaan" },
  { value: "calculator", label: "Kalkulator" },
  { value: "pencil-ruler", label: "Penggaris & pensil" },
  { value: "ruler", label: "Penggaris" },
  { value: "box", label: "Kotak 3D" },
  { value: "hammer", label: "Palu" },
  { value: "wrench", label: "Kunci" },
  { value: "truck", label: "Truk" },
  { value: "users", label: "Tim" },
  { value: "leaf", label: "Daun" },
  { value: "clock", label: "Jam" },
  { value: "badge-check", label: "Centang" },
  { value: "heart-handshake", label: "Kerja sama" },
  { value: "home", label: "Rumah" },
  { value: "palette", label: "Palet warna" },
  { value: "layers", label: "Lapisan material" },
  { value: "wallet", label: "Dompet" },
] as const;

export type FeatureIconName = (typeof FEATURE_ICONS)[number]["value"];
