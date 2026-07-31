import {
  AppointmentPaymentMethod,
  AppointmentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

type CategorySeed = {
  name: string;
  description: string;
  isActive?: boolean;
};

type ProfessionalSeed = {
  name: string;
  specialty: string;
  phone: string;
  commissionRatePercent: number;
  isActive?: boolean;
};

type ServiceSeed = {
  name: string;
  categoryName: string;
  duration: number;
  price: number;
  description: string;
  isActive?: boolean;
};

type ClientSeed = {
  name: string;
  phone: string;
  email: string;
  birthDate?: string;
  notes?: string;
};

type SeedRefs = {
  clients: Record<string, string>;
  professionals: Record<string, string>;
  services: Record<string, { id: string; duration: number; price: number }>;
};

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function parseSalonIdArg() {
  const fromArg = process.argv.find((entry) => entry.startsWith("--salon="));
  if (fromArg) {
    return fromArg.slice("--salon=".length).trim();
  }

  return process.env.SALON_ID?.trim() || null;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function todayPast(hoursAgo: number) {
  const now = new Date();
  const candidate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

  if (candidate.toDateString() === now.toDateString()) {
    candidate.setMinutes(0, 0, 0);
    return candidate;
  }

  const fallback = new Date(now);
  fallback.setHours(0, 30, 0, 0);
  return fallback;
}

function futureSlot(hoursAhead: number) {
  const candidate = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  candidate.setMinutes(0, 0, 0);
  return candidate;
}

function dayAt(daysAhead: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function monthStartDate() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function resolveSalon() {
  const requestedSalonId = parseSalonIdArg();
  const salon = requestedSalonId
    ? await prisma.salon.findUnique({ where: { id: requestedSalonId } })
    : await prisma.salon.findFirst({ orderBy: { createdAt: "asc" } });

  if (!salon) {
    throw new Error(
      "Nenhum salão foi encontrado. Crie uma conta, conclua o onboarding e rode o seed novamente.",
    );
  }

  return salon;
}

async function ensureCategory(salonId: string, category: CategorySeed) {
  const existing = await prisma.serviceCategory.findFirst({
    where: {
      salonId,
      name: category.name,
    },
  });

  if (existing) {
    return prisma.serviceCategory.update({
      where: { id: existing.id },
      data: {
        description: category.description,
        isActive: category.isActive ?? true,
      },
    });
  }

  return prisma.serviceCategory.create({
    data: {
      salonId,
      name: category.name,
      description: category.description,
      isActive: category.isActive ?? true,
    },
  });
}

async function ensureProfessional(salonId: string, professional: ProfessionalSeed) {
  const existing = await prisma.professional.findFirst({
    where: {
      salonId,
      name: professional.name,
    },
  });

  const data = {
    salonId,
    name: professional.name,
    specialty: professional.specialty,
    phone: professional.phone,
    commissionRatePercent: decimal(professional.commissionRatePercent),
    isActive: professional.isActive ?? true,
  };

  if (existing) {
    return prisma.professional.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.professional.create({ data });
}

async function ensureService(
  salonId: string,
  service: ServiceSeed,
  categoryId: string,
) {
  const existing = await prisma.service.findFirst({
    where: {
      salonId,
      name: service.name,
    },
  });

  const data = {
    salonId,
    serviceCategoryId: categoryId,
    categoryLabel: service.categoryName,
    name: service.name,
    duration: service.duration,
    price: decimal(service.price),
    description: service.description,
    sortOrder: 0,
    isActive: service.isActive ?? true,
  };

  if (existing) {
    return prisma.service.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.service.create({ data });
}

async function ensureClient(salonId: string, client: ClientSeed) {
  const existing = await prisma.client.findFirst({
    where: {
      salonId,
      name: client.name,
    },
  });

  const data = {
    salonId,
    name: client.name,
    phone: client.phone,
    email: client.email,
    birthDate: client.birthDate ? new Date(client.birthDate) : undefined,
    notes: client.notes ?? null,
  };

  if (existing) {
    return prisma.client.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.client.create({ data });
}

async function ensureAppointment(args: {
  salonId: string;
  key: string;
  customerId: string;
  serviceId: string;
  professionalId: string;
  startsAt: Date;
  duration: number;
  status: AppointmentStatus;
  note: string;
  cancellationReason?: string;
}) {
  const existing = await prisma.appointment.findFirst({
    where: {
      salonId: args.salonId,
      notes: `[seed:${args.key}] ${args.note}`,
    },
  });

  const scheduledAt = args.startsAt;
  const endsAt = addMinutes(args.startsAt, args.duration);
  const data = {
    salonId: args.salonId,
    customerId: args.customerId,
    serviceId: args.serviceId,
    professionalId: args.professionalId,
    scheduledAt,
    endsAt,
    status: args.status,
    notes: `[seed:${args.key}] ${args.note}`,
    completedAt:
      args.status === AppointmentStatus.completed ? addMinutes(endsAt, 10) : null,
    cancelledAt:
      args.status === AppointmentStatus.cancelled ? addMinutes(scheduledAt, -90) : null,
    cancelledBy: args.status === AppointmentStatus.cancelled ? "salon" : null,
    cancellationReason:
      args.status === AppointmentStatus.cancelled
        ? args.cancellationReason ?? "Cliente pediu reagendamento."
        : null,
  };

  if (existing) {
    return prisma.appointment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.appointment.create({ data });
}

async function ensurePayment(args: {
  salonId: string;
  appointmentId: string;
  amount: number;
  paymentMethod: AppointmentPaymentMethod;
  paidAt: Date;
  notes?: string;
}) {
  const existing = await prisma.appointmentPayment.findUnique({
    where: {
      appointmentId: args.appointmentId,
    },
  });

  const data = {
    salonId: args.salonId,
    appointmentId: args.appointmentId,
    amount: decimal(args.amount),
    paymentMethod: args.paymentMethod,
    paidAt: args.paidAt,
    notes: args.notes ?? null,
  };

  if (existing) {
    return prisma.appointmentPayment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.appointmentPayment.create({ data });
}

async function ensureMonthlyTarget(args: {
  salonId: string;
  referenceMonth: Date;
  revenueGoal: number;
  completedAppointmentsGoal: number;
  servedCustomersGoal: number;
}) {
  const existing = await prisma.salonMonthlyTarget.findFirst({
    where: {
      salonId: args.salonId,
      referenceMonth: args.referenceMonth,
    },
  });

  const data = {
    salonId: args.salonId,
    referenceMonth: args.referenceMonth,
    revenueGoal: decimal(args.revenueGoal),
    completedAppointmentsGoal: args.completedAppointmentsGoal,
    servedCustomersGoal: args.servedCustomersGoal,
  };

  if (existing) {
    return prisma.salonMonthlyTarget.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.salonMonthlyTarget.create({ data });
}

async function seedReferenceData(salonId: string): Promise<SeedRefs> {
  const categories: CategorySeed[] = [
    {
      name: "Cabelo",
      description: "Cortes, escovas e finalizações rápidas para o dia a dia.",
    },
    {
      name: "Unhas",
      description: "Serviços essenciais de manicure e acabamento.",
    },
    {
      name: "Estética",
      description: "Cuidados de pele e bem-estar com ticket médio maior.",
    },
    {
      name: "Sobrancelha",
      description: "Design e acabamento express para encaixes rápidos.",
    },
  ];

  const professionals: ProfessionalSeed[] = [
    {
      name: "Camila Ferreira",
      specialty: "Cabeleireira",
      phone: "(11) 98877-1122",
      commissionRatePercent: 40,
    },
    {
      name: "Juliana Souza",
      specialty: "Manicure",
      phone: "(11) 97755-3322",
      commissionRatePercent: 35,
    },
    {
      name: "Renata Lima",
      specialty: "Esteticista",
      phone: "(11) 96644-2211",
      commissionRatePercent: 30,
    },
    {
      name: "Paulo Alves",
      specialty: "Barbeiro",
      phone: "(11) 95533-1100",
      commissionRatePercent: 25,
      isActive: false,
    },
  ];

  const services: ServiceSeed[] = [
    {
      name: "Corte feminino",
      categoryName: "Cabelo",
      duration: 60,
      price: 95,
      description: "Corte com finalização leve e orientação rápida de manutenção.",
    },
    {
      name: "Escova modelada",
      categoryName: "Cabelo",
      duration: 45,
      price: 70,
      description: "Escova prática para atender agenda corrida sem perder acabamento.",
    },
    {
      name: "Manicure completa",
      categoryName: "Unhas",
      duration: 50,
      price: 55,
      description: "Cuticulagem, esmaltação e acabamento com brilho.",
    },
    {
      name: "Design de sobrancelha",
      categoryName: "Sobrancelha",
      duration: 30,
      price: 45,
      description: "Modelagem express para encaixe e manutenção recorrente.",
    },
    {
      name: "Limpeza de pele",
      categoryName: "Estética",
      duration: 75,
      price: 150,
      description: "Sessão completa com higienização, extração e máscara calmante.",
    },
    {
      name: "Progressiva express",
      categoryName: "Cabelo",
      duration: 150,
      price: 280,
      description: "Serviço pausado na agenda enquanto a operação valida demanda.",
      isActive: false,
    },
  ];

  const clients: ClientSeed[] = [
    {
      name: "Ana Paula Ribeiro",
      phone: "(11) 99123-4567",
      email: "ana.ribeiro@example.com",
      birthDate: "1991-05-14",
      notes: "Prefere horários na primeira metade do dia e responde rápido.",
    },
    {
      name: "Beatriz Costa",
      phone: "(11) 99876-5432",
      email: "beatriz.costa@example.com",
      birthDate: "1988-11-03",
      notes: "Costuma confirmar no mesmo dia e gosta de retorno com foto do resultado.",
    },
    {
      name: "Carla Mendes",
      phone: "(11) 98765-1234",
      email: "carla.mendes@example.com",
      birthDate: "1994-02-22",
      notes: "Cliente recorrente de manicure com bom histórico de comparecimento.",
    },
    {
      name: "Fernanda Rocha",
      phone: "(11) 97654-3321",
      email: "fernanda.rocha@example.com",
      notes: "Pede lembrete do dia anterior e costuma remarcar com antecedência.",
    },
  ];

  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const saved = await ensureCategory(salonId, category);
    categoryMap.set(category.name, saved.id);
  }

  const professionalIds: Record<string, string> = {};
  for (const professional of professionals) {
    const saved = await ensureProfessional(salonId, professional);
    professionalIds[professional.name] = saved.id;
  }

  const serviceRefs: Record<string, { id: string; duration: number; price: number }> = {};
  for (const service of services) {
    const saved = await ensureService(
      salonId,
      service,
      categoryMap.get(service.categoryName)!,
    );
    serviceRefs[service.name] = {
      id: saved.id,
      duration: service.duration,
      price: service.price,
    };
  }

  const clientIds: Record<string, string> = {};
  for (const client of clients) {
    const saved = await ensureClient(salonId, client);
    clientIds[client.name] = saved.id;
  }

  return {
    clients: clientIds,
    professionals: professionalIds,
    services: serviceRefs,
  };
}

async function seedAppointments(salonId: string, refs: SeedRefs) {
  const todayCompleted = todayPast(2);
  const confirmedSoon = futureSlot(2);
  const pendingSoon = futureSlot(4);
  const tomorrowMorning = dayAt(1, 10, 0);
  const yesterdayNoShow = dayAt(-1, 15, 0);
  const yesterdayCancelled = dayAt(-1, 11, 0);
  const lastWeekCompleted = dayAt(-3, 14, 0);

  const completedToday = await ensureAppointment({
    salonId,
    key: "completo-hoje",
    customerId: refs.clients["Ana Paula Ribeiro"],
    serviceId: refs.services["Limpeza de pele"].id,
    professionalId: refs.professionals["Renata Lima"],
    startsAt: todayCompleted,
    duration: refs.services["Limpeza de pele"].duration,
    status: AppointmentStatus.completed,
    note: "Limpeza de pele com foco em sensibilidade pós-sol.",
  });

  const completedPast = await ensureAppointment({
    salonId,
    key: "completo-passado",
    customerId: refs.clients["Beatriz Costa"],
    serviceId: refs.services["Corte feminino"].id,
    professionalId: refs.professionals["Camila Ferreira"],
    startsAt: lastWeekCompleted,
    duration: refs.services["Corte feminino"].duration,
    status: AppointmentStatus.completed,
    note: "Retorno de corte com ajuste de franja.",
  });

  await ensureAppointment({
    salonId,
    key: "confirmado-proximo",
    customerId: refs.clients["Fernanda Rocha"],
    serviceId: refs.services["Escova modelada"].id,
    professionalId: refs.professionals["Camila Ferreira"],
    startsAt: confirmedSoon,
    duration: refs.services["Escova modelada"].duration,
    status: AppointmentStatus.confirmed,
    note: "Escova para evento no fim do dia.",
  });

  await ensureAppointment({
    salonId,
    key: "agendado-hoje",
    customerId: refs.clients["Carla Mendes"],
    serviceId: refs.services["Manicure completa"].id,
    professionalId: refs.professionals["Juliana Souza"],
    startsAt: pendingSoon,
    duration: refs.services["Manicure completa"].duration,
    status: AppointmentStatus.pending,
    note: "Manutenção quinzenal de esmaltação.",
  });

  await ensureAppointment({
    salonId,
    key: "agendado-amanha",
    customerId: refs.clients["Beatriz Costa"],
    serviceId: refs.services["Corte feminino"].id,
    professionalId: refs.professionals["Camila Ferreira"],
    startsAt: tomorrowMorning,
    duration: refs.services["Corte feminino"].duration,
    status: AppointmentStatus.pending,
    note: "Primeiro horário livre da manhã para encaixe.",
  });

  await ensureAppointment({
    salonId,
    key: "faltou-ontem",
    customerId: refs.clients["Fernanda Rocha"],
    serviceId: refs.services["Design de sobrancelha"].id,
    professionalId: refs.professionals["Renata Lima"],
    startsAt: yesterdayNoShow,
    duration: refs.services["Design de sobrancelha"].duration,
    status: AppointmentStatus.no_show,
    note: "Cliente não compareceu e pediu novo horário por mensagem.",
  });

  await ensureAppointment({
    salonId,
    key: "cancelado-ontem",
    customerId: refs.clients["Ana Paula Ribeiro"],
    serviceId: refs.services["Manicure completa"].id,
    professionalId: refs.professionals["Juliana Souza"],
    startsAt: yesterdayCancelled,
    duration: refs.services["Manicure completa"].duration,
    status: AppointmentStatus.cancelled,
    note: "Cancelamento com aviso prévio pelo telefone.",
    cancellationReason: "Cliente precisou viajar e pediu novo encaixe.",
  });

  await ensurePayment({
    salonId,
    appointmentId: completedToday.id,
    amount: refs.services["Limpeza de pele"].price,
    paymentMethod: AppointmentPaymentMethod.pix,
    paidAt: addMinutes(completedToday.endsAt, 15),
    notes: "Pagamento recebido no caixa do dia.",
  });

  await ensurePayment({
    salonId,
    appointmentId: completedPast.id,
    amount: refs.services["Corte feminino"].price,
    paymentMethod: AppointmentPaymentMethod.credit_card,
    paidAt: addMinutes(completedPast.endsAt, 10),
    notes: "Pagamento no crédito em uma parcela.",
  });
}

async function main() {
  const salon = await resolveSalon();
  const refs = await seedReferenceData(salon.id);
  await seedAppointments(salon.id, refs);
  await ensureMonthlyTarget({
    salonId: salon.id,
    referenceMonth: monthStartDate(),
    revenueGoal: 2400,
    completedAppointmentsGoal: 16,
    servedCustomersGoal: 12,
  });

  console.log(
    `Seed do módulo de gestão concluído para o salão "${salon.name}" (${salon.id}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
