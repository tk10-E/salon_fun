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

const d = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const today = () => new Date().toISOString().slice(0, 10);

export const seedCategories: ServiceCategory[] = [
  { id: "cat-1", name: "Cabelo", color: "#C87D61" },
  { id: "cat-2", name: "Coloração", color: "#9A6B4F" },
  { id: "cat-3", name: "Unhas", color: "#D9A184" },
  { id: "cat-4", name: "Estética", color: "#7E8C6A" },
  { id: "cat-5", name: "Barbearia", color: "#4A4A4A" },
];

export const seedServices: Service[] = [
  { id: "srv-1", name: "Corte Feminino", categoryId: "cat-1", duration: 60, price: 130, description: "Corte com lavagem e finalização.", active: true },
  { id: "srv-2", name: "Hidratação Vegana", categoryId: "cat-1", duration: 45, price: 110, description: "Máscara profunda com ativos naturais.", active: true },
  { id: "srv-3", name: "Coloração Global", categoryId: "cat-2", duration: 120, price: 320, description: "Coloração completa com tonalização.", active: true },
  { id: "srv-4", name: "Luzes / Mechas", categoryId: "cat-2", duration: 180, price: 450, description: "Mechas com reconstrução.", active: true },
  { id: "srv-5", name: "Manicure Express", categoryId: "cat-3", duration: 30, price: 45, description: "Esmaltação simples.", active: true },
  { id: "srv-6", name: "Pedicure Spa", categoryId: "cat-3", duration: 60, price: 85, description: "Ritual completo de pés.", active: true },
  { id: "srv-7", name: "Limpeza de Pele", categoryId: "cat-4", duration: 75, price: 180, description: "Limpeza profunda com extração.", active: true },
  { id: "srv-8", name: "Barba Premium", categoryId: "cat-5", duration: 40, price: 85, description: "Barba com toalha quente.", active: true },
];

export const seedProfessionals: Professional[] = [
  { id: "pro-1", name: "Felipe Castro", role: "Cabeleireiro Sênior", phone: "(11) 98812-3344", commission: 40, active: true, serviceIds: ["srv-1", "srv-2", "srv-3", "srv-4"], workdays: ["Seg", "Ter", "Qua", "Qui", "Sex"], startTime: "09:00", endTime: "19:00" },
  { id: "pro-2", name: "Solange Ribeiro", role: "Manicure", phone: "(11) 99123-8890", commission: 35, active: true, serviceIds: ["srv-5", "srv-6"], workdays: ["Ter", "Qua", "Qui", "Sex", "Sáb"], startTime: "10:00", endTime: "18:00" },
  { id: "pro-3", name: "Caio Nogueira", role: "Barbeiro", phone: "(11) 97744-1120", commission: 45, active: true, serviceIds: ["srv-8"], workdays: ["Qua", "Qui", "Sex", "Sáb"], startTime: "11:00", endTime: "20:00" },
  { id: "pro-4", name: "Renata Duarte", role: "Esteticista", phone: "(11) 98220-7765", commission: 38, active: false, serviceIds: ["srv-7"], workdays: ["Seg", "Qua", "Sex"], startTime: "09:00", endTime: "16:00" },
];

export const seedClients: Client[] = [
  { id: "cli-1", name: "Mariana Cavalcante", phone: "(11) 99881-2233", email: "mariana@email.com", birthday: "1992-03-14", since: "2023-02-10", visits: 28, totalSpent: 5240, lastVisit: d(-12), plan: "Plano Beleza Mensal", planSessions: 3, tags: ["VIP", "Coloração"] },
  { id: "cli-2", name: "Beatriz Soares", phone: "(11) 99770-4412", email: "bia@email.com", birthday: "1988-07-02", since: "2022-11-05", visits: 41, totalSpent: 9120, lastVisit: d(-3), plan: "Plano Premium", planSessions: 6, tags: ["VIP"] },
  { id: "cli-3", name: "Rafael Costa", phone: "(11) 98123-0091", email: "rafael@email.com", birthday: "1995-11-27", since: "2024-01-18", visits: 9, totalSpent: 780, lastVisit: d(-48), tags: ["Em risco"] },
  { id: "cli-4", name: "Aline Vieira", phone: "(11) 99456-7788", email: "aline@email.com", birthday: "1999-05-09", since: "2024-06-22", visits: 14, totalSpent: 2110, lastVisit: d(-7), tags: ["Indicação"] },
  { id: "cli-5", name: "Melissa Silva", phone: "(11) 98800-3345", email: "melissa@email.com", birthday: "1990-01-30", since: "2023-09-14", visits: 22, totalSpent: 4380, lastVisit: d(-21), tags: ["Fidelidade"] },
  { id: "cli-6", name: "Clara Mendonça", phone: "(11) 99011-2244", email: "clara@email.com", birthday: "1985-12-08", since: "2021-04-02", visits: 55, totalSpent: 13400, lastVisit: d(-45), tags: ["VIP", "Em risco"] },
];

export const seedAppointments: Appointment[] = [
  { id: "apt-1", clientId: "cli-1", professionalId: "pro-1", serviceId: "srv-1", date: today(), time: "09:00", status: "concluido", price: 130, deposit: 130, usedPlanSession: false },
  { id: "apt-2", clientId: "cli-5", professionalId: "pro-2", serviceId: "srv-5", date: today(), time: "10:30", status: "concluido", price: 45, deposit: 45, usedPlanSession: false },
  { id: "apt-3", clientId: "cli-2", professionalId: "pro-1", serviceId: "srv-3", date: today(), time: "14:30", status: "confirmado", price: 320, deposit: 100, usedPlanSession: false },
  { id: "apt-4", clientId: "cli-4", professionalId: "pro-3", serviceId: "srv-8", date: today(), time: "15:15", status: "pendente", price: 85, deposit: 0, usedPlanSession: false },
  { id: "apt-5", clientId: "cli-3", professionalId: "pro-2", serviceId: "srv-6", date: today(), time: "16:30", status: "confirmado", price: 85, deposit: 40, usedPlanSession: false },
  { id: "apt-6", clientId: "cli-6", professionalId: "pro-1", serviceId: "srv-4", date: today(), time: "17:30", status: "pendente", price: 450, deposit: 0, usedPlanSession: false },
  { id: "apt-7", clientId: "cli-1", professionalId: "pro-1", serviceId: "srv-2", date: d(1), time: "11:00", status: "confirmado", price: 110, deposit: 50, usedPlanSession: true },
  { id: "apt-8", clientId: "cli-2", professionalId: "pro-2", serviceId: "srv-5", date: d(2), time: "09:30", status: "confirmado", price: 45, deposit: 0, usedPlanSession: false },
  { id: "apt-9", clientId: "cli-4", professionalId: "pro-1", serviceId: "srv-1", date: d(3), time: "13:00", status: "pendente", price: 130, deposit: 0, usedPlanSession: false },
  { id: "apt-10", clientId: "cli-5", professionalId: "pro-3", serviceId: "srv-8", date: d(-2), time: "18:00", status: "cancelado", price: 85, deposit: 0, usedPlanSession: false },
];

export const seedTransactions: Transaction[] = [
  { id: "trx-1", date: today(), description: "Corte Feminino — Mariana", category: "Serviço", method: "pix", type: "entrada", amount: 130 },
  { id: "trx-2", date: today(), description: "Manicure — Melissa", category: "Serviço", method: "credito", type: "entrada", amount: 45 },
  { id: "trx-3", date: today(), description: "Venda shampoo reparador", category: "Produto", method: "debito", type: "entrada", amount: 89 },
  { id: "trx-4", date: today(), description: "Sinal coloração — Beatriz", category: "Sinal", method: "pix", type: "entrada", amount: 100 },
  { id: "trx-5", date: d(-1), description: "Compra de insumos", category: "Insumo", method: "dinheiro", type: "saida", amount: 320 },
];

export const seedExpenses: Expense[] = [
  { id: "exp-1", description: "Aluguel do espaço", dueDate: d(5), amount: 4200, recurring: true, paid: false },
  { id: "exp-2", description: "Energia elétrica", dueDate: d(9), amount: 680, recurring: true, paid: false },
  { id: "exp-3", description: "Fornecedor de coloração", dueDate: d(-2), amount: 1450, recurring: false, paid: true },
];

export const seedPosts: Post[] = [
  { id: "post-1", format: "before_after", title: "Transformação loira do dia", body: "De castanho escuro para loiro pérola em uma sessão. 💇‍♀️", createdAt: d(-1), likes: 132, comments: [{ id: "c1", author: "Aline V.", text: "Amei! Quero igual" }] },
  { id: "post-2", format: "reel", title: "Bastidores do atelier", body: "Um dia na Maison Lumière em 30 segundos.", createdAt: d(-4), likes: 289, comments: [] },
  { id: "post-3", format: "story", title: "Vagas para hoje", body: "Temos 3 janelas livres às 16h. Corre!", createdAt: today(), likes: 41, comments: [] },
];

export const seedProducts: Product[] = [
  { id: "prd-1", name: "Shampoo Reparador 300ml", brand: "Lumière Care", price: 89, stock: 24, minStock: 10 },
  { id: "prd-2", name: "Máscara Nutritiva 250g", brand: "Lumière Care", price: 129, stock: 7, minStock: 10 },
  { id: "prd-3", name: "Óleo Finalizador 60ml", brand: "Kera Pro", price: 74, stock: 18, minStock: 8 },
  { id: "prd-4", name: "Oxidante 20vol", brand: "Igora", price: 42, stock: 3, minStock: 12 },
];

export const seedOrders: ProductOrder[] = [
  { id: "ord-1", clientName: "Beatriz Soares", productName: "Máscara Nutritiva 250g", total: 129, status: "novo" },
  { id: "ord-2", clientName: "Aline Vieira", productName: "Óleo Finalizador 60ml", total: 74, status: "separando" },
  { id: "ord-3", clientName: "Rafael Costa", productName: "Shampoo Reparador 300ml", total: 89, status: "entregue" },
];

export const seedPromotions: Promotion[] = [
  { id: "pro-a", name: "Terça da Hidratação", discount: 25, channel: "App do cliente", active: true, redemptions: 34 },
  { id: "pro-b", name: "Volta pra casa (45 dias)", discount: 15, channel: "WhatsApp", active: true, redemptions: 12 },
  { id: "pro-c", name: "Indique e ganhe", discount: 20, channel: "Indicação", active: false, redemptions: 58 },
];

export const seedComandas: Comanda[] = [
  { id: "cmd-1", clientName: "Beatriz Soares", opened: "14:30", items: [{ id: "i1", name: "Coloração Global", price: 320 }], payments: [{ id: "p1", method: "pix", amount: 100 }], status: "aberta" },
  { id: "cmd-2", clientName: "Melissa Silva", opened: "10:30", items: [{ id: "i2", name: "Manicure Express", price: 45 }], payments: [{ id: "p2", method: "credito", amount: 45 }], status: "fechada" },
];

export const seedBlocks: Block[] = [
  { id: "blk-1", professionalId: "pro-1", date: d(2), from: "12:00", to: "13:00", reason: "Almoço estendido" },
];

export const seedClientApp: ClientAppConfig = {
  appName: "Maison Lumière",
  tagline: "Seu ritual de beleza, na palma da mão",
  primaryColor: "#C87D61",
  accentColor: "#1A1A1A",
  backgroundColor: "#FDFCF8",
  textColor: "#1A1A1A",
  cornerStyle: "soft",
  fontStyle: "serif",
  theme: "claro",
  heroTitle: "Agende sua próxima sessão de autocuidado",
  heroSubtitle: "Horários abertos para esta semana com nossa equipe sênior.",
  heroCta: "Reservar horário",
  heroImage: "",
  logoText: "ML",
  showPrices: true,
  showTeam: true,
  showFeed: true,
  showLoyalty: true,
  showStore: true,
  allowOnlineBooking: true,
  requireDeposit: true,
  depositPercent: 30,
  cancelWindowHours: 12,
  autoCancelMinutes: 20,
  welcomeMessage: "Bem-vinda de volta! Seu horário favorito ainda está livre.",
  supportPhone: "(11) 3344-5566",
  address: "Rua das Acácias, 210 — Jardins, São Paulo",
  inviteCode: "LUMIERE2026",
  highlightBlocks: [
    { id: "hb-1", title: "Clube Lumière", subtitle: "Assine e ganhe 2 sessões", emoji: "✨" },
    { id: "hb-2", title: "Indique amigas", subtitle: "R$ 30 de crédito por indicação", emoji: "🎁" },
    { id: "hb-3", title: "Loja do salão", subtitle: "Produtos usados no seu atendimento", emoji: "🛍️" },
  ],
};

export const seedSettings: SalonSettings = {
  name: "Maison Lumière",
  segment: "Salão de beleza & barbearia",
  description: "Atelier de beleza no coração dos Jardins, especializado em coloração e cuidados naturais.",
  phone: "(11) 3344-5566",
  email: "contato@maisonlumiere.com.br",
  brandColor: "#C87D61",
  logoText: "ML",
  monthlyGoal: 72000,
  twoFactor: false,
  requireStrongPassword: true,
  aiAssist: true,
};