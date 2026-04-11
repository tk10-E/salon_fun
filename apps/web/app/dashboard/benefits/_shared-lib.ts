import type {
  BenefitReferralRewardUnlock,
  BenefitWalletHighlight,
  GrowthAutomationOverview,
  GrowthAutomationRecentRun,
  GrowthAutomationSettings,
  LoyaltyLeaderboardItem,
  LoyaltyOverview,
  LoyaltyProgramRow,
  LoyaltyTierSnapshot,
  MarketingBirthdayCustomer,
  MarketingIdea,
  MarketingInactiveCustomer,
  MarketingLoyaltyTier,
  ReferralServiceOption,
} from "./_lib";

export type ReferralProgramRow = {
  id: string;
  title: string;
  description: string | null;
  reward_for_referrer: string;
  reward_for_invited: string | null;
  is_active: boolean;
  required_qualified_referrals?: number | null;
  reward_service_id?: string | null;
  reward_service_name?: string | null;
  updated_at: string;
};

export type ReferralEventRow = {
  id: string;
  referrer_customer_id: string;
  invited_customer_id: string;
  status: "pending" | "qualified";
  qualified_at: string | null;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  name: string;
  referral_code: string | null;
};

type CustomerDirectoryOverview = {
  cashback_customers: number;
};

type CustomerDirectoryItem = {
  cashback_balance: number | string;
  completed_visits: number;
  current_tier: LoyaltyTierSnapshot | null;
  id: string;
  name: string;
  points_balance: number;
  referral_code: string | null;
};

export type CustomerDirectoryResponse = {
  overview: CustomerDirectoryOverview;
  items: CustomerDirectoryItem[];
};

export type MembershipRelationRow = {
  customer_id: string;
  customers?: { name: string } | { name: string }[] | null;
  expires_at: string;
  id: string;
  sessions_included: number;
  sessions_used: number;
  status: "active" | "completed" | "expired" | "cancelled";
  title: string;
};

export type RewardUnlockRelationRow = {
  customers?: { name: string } | { name: string }[] | null;
  id: string;
  redeemed_at: string | null;
  referrer_customer_id: string;
  required_qualified_referrals: number;
  reward_description: string;
  reward_service_name: string | null;
  status: "available" | "redeemed";
  threshold_reached: number;
  unlocked_at: string;
};

export type LoyaltyDashboardResponse = {
  program: LoyaltyProgramRow | null;
  overview: LoyaltyOverview;
  leaderboard: LoyaltyLeaderboardItem[];
};

export type GrowthAutomationDashboardResponse = {
  settings: GrowthAutomationSettings;
  overview: GrowthAutomationOverview;
  recent_runs: GrowthAutomationRecentRun[];
};

export type MarketingDashboardResponse = {
  birthday_customers: MarketingBirthdayCustomer[];
  birthdays_this_month: number;
  customers_with_birth_date: number;
  inactive_customers: MarketingInactiveCustomer[];
  inactive_threshold_days: number;
  inactive_total: number;
  loyalty_tiers: MarketingLoyaltyTier[];
};

export function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function startOfDayIso(value: string) {
  return `${value}T00:00:00.000Z`;
}

export function endOfDayExclusiveIso(value: string) {
  const day = new Date(`${value}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString();
}

export function membershipSessionsRemaining(
  membership: Pick<
    MembershipRelationRow,
    "sessions_included" | "sessions_used"
  >,
) {
  return Math.max(membership.sessions_included - membership.sessions_used, 0);
}

export function isMembershipOperationallyActive(
  membership: Pick<
    MembershipRelationRow,
    "expires_at" | "sessions_included" | "sessions_used" | "status"
  >,
  today: string,
) {
  if (membership.status === "cancelled" || membership.status === "expired") {
    return false;
  }

  if (membership.status === "completed") {
    return false;
  }

  if (membership.expires_at < today) {
    return false;
  }

  return membershipSessionsRemaining(membership) > 0;
}

export function buildRewardUnlockEntries(
  rewardUnlocks: RewardUnlockRelationRow[],
): BenefitReferralRewardUnlock[] {
  return rewardUnlocks.map((unlock) => ({
    customerId: unlock.referrer_customer_id,
    customerName: firstRelation(unlock.customers)?.name ?? "Cliente do salão",
    id: unlock.id,
    redeemedAt: unlock.redeemed_at,
    requiredQualifiedReferrals: unlock.required_qualified_referrals,
    rewardDescription: unlock.reward_description,
    rewardServiceName: unlock.reward_service_name,
    status: unlock.status,
    thresholdReached: unlock.threshold_reached,
    unlockedAt: unlock.unlocked_at,
  }));
}

export function buildWalletHighlights(args: {
  activeMemberships: MembershipRelationRow[];
  directoryItems: CustomerDirectoryItem[];
  rewardUnlocks: BenefitReferralRewardUnlock[];
}) {
  const directoryMap = new Map(
    args.directoryItems.map((item) => [item.id, item]),
  );
  const orderedIds: string[] = [];
  const customerNames = new Map<string, string>();
  const membershipMap = new Map<
    string,
    {
      expiresAt: string;
      sessionsRemaining: number;
      title: string;
    }
  >();
  const availableRewardCounts = new Map<string, number>();

  const pushCustomer = (customerId?: string | null) => {
    if (!customerId || orderedIds.includes(customerId)) {
      return;
    }

    orderedIds.push(customerId);
  };

  for (const item of args.directoryItems) {
    customerNames.set(item.id, item.name);
    pushCustomer(item.id);
  }

  for (const membership of args.activeMemberships) {
    const customerName = firstRelation(membership.customers)?.name;
    if (customerName) {
      customerNames.set(membership.customer_id, customerName);
    }

    const currentEntry = membershipMap.get(membership.customer_id);
    const nextEntry = {
      expiresAt: membership.expires_at,
      sessionsRemaining: membershipSessionsRemaining(membership),
      title: membership.title,
    };

    if (!currentEntry || currentEntry.expiresAt > nextEntry.expiresAt) {
      membershipMap.set(membership.customer_id, nextEntry);
    }

    pushCustomer(membership.customer_id);
  }

  for (const unlock of args.rewardUnlocks) {
    customerNames.set(unlock.customerId, unlock.customerName);

    if (unlock.status === "available") {
      availableRewardCounts.set(
        unlock.customerId,
        (availableRewardCounts.get(unlock.customerId) ?? 0) + 1,
      );
    }

    pushCustomer(unlock.customerId);
  }

  return orderedIds
    .slice(0, 6)
    .map((customerId) => {
      const directoryItem = directoryMap.get(customerId);
      const membership = membershipMap.get(customerId);

      return {
        activeMembershipExpiresAt: membership?.expiresAt ?? null,
        activeMembershipTitle: membership?.title ?? null,
        availableReferralRewards: availableRewardCounts.get(customerId) ?? 0,
        cashbackBalance: Number(directoryItem?.cashback_balance ?? 0),
        completedVisits: directoryItem?.completed_visits ?? 0,
        customerId,
        membershipSessionsRemaining: membership?.sessionsRemaining ?? 0,
        name:
          directoryItem?.name ??
          customerNames.get(customerId) ??
          "Cliente do salão",
        pointsBalance: directoryItem?.points_balance ?? 0,
        referralCode: directoryItem?.referral_code ?? null,
        tierLabel: directoryItem?.current_tier?.label ?? null,
      } satisfies BenefitWalletHighlight;
    })
    .filter(
      (item) =>
        item.pointsBalance > 0 ||
        Number(item.cashbackBalance) > 0 ||
        item.activeMembershipTitle != null ||
        item.availableReferralRewards > 0,
    );
}

export function defaultLoyaltyDashboard(): LoyaltyDashboardResponse {
  return {
    program: null,
    overview: {
      ranked_customers: 0,
      vip_customers: 0,
      total_completed_visits: 0,
      total_points_earned: 0,
      total_cashback_earned: 0,
    },
    leaderboard: [],
  };
}

export function defaultGrowthAutomationDashboard(): GrowthAutomationDashboardResponse {
  return {
    settings: {
      is_active: false,
      winback_inactive_days: 30,
      winback_discount_percent: 10,
      winback_title: "Sentimos sua falta 😄",
      winback_body_template:
        "Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.",
      smart_rebook_is_active: false,
      smart_rebook_window_days: 4,
      smart_rebook_title: "Hora do seu próximo {service_name}",
      smart_rebook_body_template:
        "Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.",
      updated_at: null,
    },
    overview: {
      at_risk_customers: 0,
      due_now_customers: 0,
      winbacks_sent_last_30d: 0,
      smart_rebook_due_customers: 0,
      smart_rebooks_sent_last_30d: 0,
      recovered_customers_last_30d: 0,
    },
    recent_runs: [],
  };
}

export function defaultMarketingDashboard(): MarketingDashboardResponse {
  return {
    birthday_customers: [],
    birthdays_this_month: 0,
    customers_with_birth_date: 0,
    inactive_customers: [],
    inactive_threshold_days: 30,
    inactive_total: 0,
    loyalty_tiers: [],
  };
}

export function buildLoyaltyTierDistribution(
  loyaltyProgram: LoyaltyProgramRow | null,
  marketingDashboard: MarketingDashboardResponse,
) {
  const liveDistribution = marketingDashboard.loyalty_tiers ?? [];

  if (liveDistribution.length > 0) {
    return liveDistribution;
  }

  if (!loyaltyProgram?.tiers?.length) {
    return [];
  }

  return loyaltyProgram.tiers.map((tier) => ({
    customer_count: 0,
    is_vip: tier.is_vip,
    label: tier.label,
    min_visits: tier.min_visits,
  }));
}

export function buildMarketingIdeas(args: {
  activeMembershipsCount: number;
  activeOffersCount: number;
  birthdaysThisMonth: number;
  customersWithBirthDate: number;
  inactiveThresholdDays: number;
  inactiveTotal: number;
  loyaltyOverview: LoyaltyOverview;
  pendingReferralsCount: number;
  qualifiedReferralsCount: number;
  referralProgram: ReferralProgramRow | null;
}) {
  const ideas: MarketingIdea[] = [];

  if (args.birthdaysThisMonth > 0) {
    ideas.push({
      href: "#benefits-birthdays",
      id: "birthday-campaign",
      label: "Aniversário do mês",
      note: `${args.birthdaysThisMonth} cliente${args.birthdaysThisMonth === 1 ? "" : "s"} faz${args.birthdaysThisMonth === 1 ? "" : "em"} aniversário neste mês.`,
      title: "Dispare uma ação de aniversário no app",
      tone: "warm",
    });
  } else if (args.customersWithBirthDate === 0) {
    ideas.push({
      href: "/dashboard/gestao/clientes",
      id: "birthday-crm",
      label: "CRM comercial",
      note: "A base ainda não tem datas de nascimento cadastradas.",
      title: "Complete aniversários das clientes no CRM",
      tone: "soft",
    });
  }

  if (args.inactiveTotal > 0) {
    ideas.push({
      href: "#benefits-reactivation",
      id: "reactivation",
      label: "Recuperação",
      note: `${args.inactiveTotal} cliente${args.inactiveTotal === 1 ? "" : "s"} já passou${args.inactiveTotal === 1 ? "" : "ram"} de ${args.inactiveThresholdDays} dias sem voltar.`,
      title: "Reative a base com mensagem pronta no app",
      tone: "danger",
    });
  }

  if (args.pendingReferralsCount > 0 || args.referralProgram?.is_active) {
    ideas.push({
      href: "/dashboard/benefits/referrals",
      id: "referral",
      label: "Indicação",
      note:
        args.pendingReferralsCount > 0
          ? `${args.pendingReferralsCount} indicação${args.pendingReferralsCount === 1 ? "" : "ões"} ainda espera${args.pendingReferralsCount === 1 ? "" : "m"} validação.`
          : `${args.qualifiedReferralsCount} indicação${args.qualifiedReferralsCount === 1 ? "" : "ões"} já virou${args.qualifiedReferralsCount === 1 ? "" : "ram"} visita.`,
      title: args.referralProgram?.is_active
        ? "Acelere a frente de indicação"
        : "Estruture a próxima campanha por indicação",
      tone: "accent",
    });
  }

  if (args.activeOffersCount === 0) {
    ideas.push({
      href: "/dashboard/benefits/promotions",
      id: "offer",
      label: "Campanhas",
      note: "Ainda não existe promoção ativa na vitrine do app.",
      title: "Publique a primeira oferta do salão",
      tone: "success",
    });
  }

  if (args.activeMembershipsCount === 0) {
    ideas.push({
      href: "/dashboard/subscriptions",
      id: "membership",
      label: "Recorrência",
      note: "Nenhum plano mensal está ativo no momento.",
      title: "Abra uma frente de receita recorrente",
      tone: "soft",
    });
  }

  if (args.loyaltyOverview.vip_customers > 0) {
    ideas.push({
      href: "/dashboard/benefits/loyalty",
      id: "vip",
      label: "Fidelidade",
      note: `${args.loyaltyOverview.vip_customers} cliente${args.loyaltyOverview.vip_customers === 1 ? "" : "s"} já está${args.loyaltyOverview.vip_customers === 1 ? "" : "ão"} no topo do programa.`,
      title: "Use a base VIP para puxar novas campanhas",
      tone: "success",
    });
  }

  return ideas.slice(0, 3);
}

export function mapServiceOptions(
  services: ReferralServiceOption[],
): ReferralServiceOption[] {
  return services.map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category ?? null,
  }));
}
