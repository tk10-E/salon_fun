import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  seedAppointments,
  seedBlocks,
  seedCategories,
  seedClientApp,
  seedClients,
  seedComandas,
  seedExpenses,
  seedOrders,
  seedPosts,
  seedProducts,
  seedProfessionals,
  seedPromotions,
  seedServices,
  seedSettings,
  seedTransactions,
} from "./salon-seed";
import type {
  Appointment,
  Block,
  Client,
  ClientAppConfig,
  Comanda,
  Expense,
  Post,
  Product,
  ProductOrder,
  Professional,
  Promotion,
  SalonSettings,
  Service,
  ServiceCategory,
  Transaction,
} from "./salon-types";

interface SalonState {
  appointments: Appointment[];
  clients: Client[];
  professionals: Professional[];
  services: Service[];
  categories: ServiceCategory[];
  transactions: Transaction[];
  expenses: Expense[];
  posts: Post[];
  products: Product[];
  orders: ProductOrder[];
  promotions: Promotion[];
  comandas: Comanda[];
  blocks: Block[];
  clientApp: ClientAppConfig;
  settings: SalonSettings;
  cashOpen: boolean;
}

const initialState: SalonState = {
  appointments: seedAppointments,
  clients: seedClients,
  professionals: seedProfessionals,
  services: seedServices,
  categories: seedCategories,
  transactions: seedTransactions,
  expenses: seedExpenses,
  posts: seedPosts,
  products: seedProducts,
  orders: seedOrders,
  promotions: seedPromotions,
  comandas: seedComandas,
  blocks: seedBlocks,
  clientApp: seedClientApp,
  settings: seedSettings,
  cashOpen: true,
};

const STORAGE_KEY = "salon-panel-state-v1";

interface SalonContextValue extends SalonState {
  update: <K extends keyof SalonState>(key: K, value: SalonState[K]) => void;
  patch: (partial: Partial<SalonState>) => void;
  reset: () => void;
}

const SalonContext = createContext<SalonContextValue | null>(null);

export function SalonProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalonState>(initialState);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const update = useCallback(<K extends keyof SalonState>(key: K, value: SalonState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patch = useCallback((partial: Partial<SalonState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => setState(initialState), []);

  const value = useMemo(() => ({ ...state, update, patch, reset }), [state, update, patch, reset]);

  return <SalonContext.Provider value={value}>{children}</SalonContext.Provider>;
}

export function useSalon() {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error("useSalon deve ser usado dentro de SalonProvider");
  return ctx;
}

export const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const formatDateBR = (iso: string) => {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
};

export const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

export const statusStyles: Record<string, string> = {
  pendente: "bg-warning-soft text-warning",
  confirmado: "bg-success-soft text-success",
  em_atendimento: "bg-info-soft text-info",
  concluido: "bg-muted text-muted-foreground",
  cancelado: "bg-destructive/10 text-destructive",
  faltou: "bg-destructive/10 text-destructive",
};