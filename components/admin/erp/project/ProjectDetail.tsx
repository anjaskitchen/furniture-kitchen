"use client";
import { useState } from "react";
import type { Allocation, Budget, Expense, Stage, Template, Usage, Worker } from "@/lib/erp/data";
import type { InventoryLot, MaterialItem, Option, ProjectRow, Requirement } from "@/lib/erp/types";
import { TabLinks } from "../kit";
import { ProjectBudget } from "./ProjectBudget";
import { ProjectMaterials } from "./ProjectMaterials";
import { infoFromProject, ProjectHeader, ProjectInfoModal, ProjectOverview } from "./ProjectOverview";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectWorkers } from "./ProjectWorkers";

export type ProjectTab = "ringkasan" | "material" | "anggaran" | "jadwal" | "pekerja";

export function ProjectDetail(props: {
  tab: ProjectTab;
  isOwner: boolean;
  project: ProjectRow;
  requirements: Requirement[];
  allocations: Allocation[];
  usage: Usage[];
  budgets: Budget[];
  expenses: Expense[];
  stages: Stage[];
  workers: Worker[];
  lots: InventoryLot[];
  items: MaterialItem[];
  templates: Template[];
  suppliers: Option[];
  employees: Option[];
  accounts: Option[];
}) {
  const { tab, isOwner, project: p } = props;
  const [editing, setEditing] = useState(false);
  const tabs = [
    { key: "ringkasan", label: "Ringkasan" },
    { key: "material", label: "RAB & Material", count: props.requirements.length },
    ...(isOwner ? [{ key: "anggaran", label: "Anggaran & Biaya" }] : []),
    { key: "jadwal", label: "Jadwal & Progres" },
    { key: "pekerja", label: "Pekerja & Upah", count: props.workers.length },
  ];
  return (
    <div>
      <ProjectHeader p={p} onEdit={() => setEditing(true)} />
      <TabLinks base={`/admin/proyek/${p.id}`} active={tab} tabs={tabs} />
      {tab === "ringkasan" && <ProjectOverview p={p} showMoney={isOwner} onEdit={() => setEditing(true)} />}
      {tab === "material" && (
        <ProjectMaterials p={p} requirements={props.requirements} allocations={props.allocations} usage={props.usage} lots={props.lots} items={props.items} templates={props.templates} suppliers={props.suppliers} showMoney={isOwner} />
      )}
      {tab === "anggaran" && isOwner && (
        <ProjectBudget key={props.budgets.map((b) => `${b.category}:${b.amount}`).join("|")} p={p} budgets={props.budgets} expenses={props.expenses} accounts={props.accounts} />
      )}
      {tab === "jadwal" && <ProjectTimeline key={props.stages.map((s) => `${s.id}:${s.progress}:${s.status}`).join("|")} p={p} stages={props.stages} />}
      {tab === "pekerja" && <ProjectWorkers p={p} workers={props.workers} employees={props.employees} showMoney={isOwner} />}
      {editing && <ProjectInfoModal open onClose={() => setEditing(false)} initial={infoFromProject(p)} templates={props.templates} employees={props.employees} />}
    </div>
  );
}
