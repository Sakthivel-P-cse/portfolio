import { create } from "zustand";
import type { TransactionType } from "@/types";

// Modal kinds the quick-action buttons can open.
export type ModalKind =
  | { type: "transaction"; txnType?: TransactionType; editId?: string }
  | { type: "journal"; editId?: string }
  | { type: "import" }
  | null;

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (v: boolean) => void;

  modal: ModalKind;
  openModal: (modal: NonNullable<ModalKind>) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebar: (v) => set({ sidebarCollapsed: v }),

  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}));
