"use client";
import type { ReactNode } from "react";
import { Modal } from "../Modal";

export function AdminModal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      {children}
    </Modal>
  );
}
