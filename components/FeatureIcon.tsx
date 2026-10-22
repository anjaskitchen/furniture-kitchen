import {
  Award,
  BadgeCheck,
  Box,
  Calculator,
  Clock,
  Hammer,
  HeartHandshake,
  House,
  Layers,
  Leaf,
  type LucideIcon,
  Palette,
  PencilRuler,
  Ruler,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { FeatureIconName } from "@/lib/feature-icons";

const ICONS: Record<FeatureIconName, LucideIcon> = {
  sparkles: Sparkles,
  star: Star,
  "shield-check": ShieldCheck,
  award: Award,
  calculator: Calculator,
  "pencil-ruler": PencilRuler,
  ruler: Ruler,
  box: Box,
  hammer: Hammer,
  wrench: Wrench,
  truck: Truck,
  users: Users,
  leaf: Leaf,
  clock: Clock,
  "badge-check": BadgeCheck,
  "heart-handshake": HeartHandshake,
  home: House,
  palette: Palette,
  layers: Layers,
  wallet: Wallet,
};

export function FeatureIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name as FeatureIconName] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
