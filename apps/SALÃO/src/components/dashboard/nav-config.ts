export interface NavItem {
  label: string;
  to: string;
  hint?: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    title: "Menu Principal",
    items: [
      { label: "Hoje", to: "/dashboard", hint: "Resumo do dia" },
      { label: "Agenda", to: "/dashboard/gestao/agendamentos", hint: "Gestão de horários" },
      { label: "Agenda Inteligente", to: "/dashboard/gestao/agendamentos/inteligente" },
      { label: "Clientes", to: "/dashboard/gestao/clientes" },
      { label: "Serviços", to: "/dashboard/gestao/servicos" },
      { label: "Equipe", to: "/dashboard/gestao/profissionais" },
    ],
  },
  {
    title: "Financeiro & Loja",
    items: [
      { label: "Caixa", to: "/dashboard/finance" },
      { label: "Pagamentos", to: "/dashboard/gestao/pagamentos" },
      { label: "Comissões", to: "/dashboard/gestao/comissoes" },
      { label: "Despesas", to: "/dashboard/finance/despesas" },
      { label: "Comandas", to: "/dashboard/operations/comandas" },
      { label: "Operações", to: "/dashboard/operations" },
      { label: "Loja & Estoque", to: "/dashboard/inventory" },
    ],
  },
  {
    title: "Marketing & Retenção",
    items: [
      { label: "Feed", to: "/dashboard/feed" },
      { label: "Benefícios", to: "/dashboard/benefits" },
      { label: "Fidelidade", to: "/dashboard/benefits/loyalty" },
      { label: "Indicações", to: "/dashboard/benefits/referrals" },
      { label: "Campanhas", to: "/dashboard/benefits/promotions" },
      { label: "Automações", to: "/dashboard/benefits/automations" },
      { label: "Assinaturas", to: "/dashboard/subscriptions" },
      { label: "App do cliente", to: "/dashboard/client-app" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Ajustes", to: "/dashboard/settings" },
      { label: "Notificações", to: "/dashboard/notifications" },
      { label: "Aniversários", to: "/dashboard/birthdays" },
      { label: "IA", to: "/dashboard/ai" },
      { label: "Billing", to: "/dashboard/billing" },
    ],
  },
];