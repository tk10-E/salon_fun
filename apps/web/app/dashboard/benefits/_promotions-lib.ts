import { formatDate } from "@/lib/formatters";
import {
  isMonthlyMembershipPlan,
  resolveMembershipLifecycleCopy,
  resolveMembershipOfferLabel,
} from "@/lib/membershipOffers";
import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  OfferLifecycle,
  OfferRow,
  OfferSearchParams,
  PromotionsPageData,
  ReferralServiceOption,
} from "./_lib";
import { firstParam, mapServiceOptions } from "./_shared-lib";

export function getOfferLifecycle(
  offer: OfferRow,
  today: string,
): OfferLifecycle {
  if (!offer.is_active) {
    return "paused";
  }

  if (offer.starts_on && offer.starts_on > today) {
    return "scheduled";
  }

  if (offer.ends_on && offer.ends_on < today) {
    return "expired";
  }

  return "active";
}

export function formatOfferKind(offer: Pick<OfferRow, "kind" | "membership_validity_days">) {
  return offer.kind === "membership"
    ? resolveMembershipOfferLabel(offer.membership_validity_days)
    : "Promoção";
}

export function formatOfferPeriod(offer: OfferRow) {
  if (!offer.starts_on && !offer.ends_on) {
    return "Sem data definida";
  }

  if (offer.starts_on && offer.ends_on) {
    return `${formatDate(offer.starts_on)} até ${formatDate(offer.ends_on)}`;
  }

  return offer.starts_on
    ? `A partir de ${formatDate(offer.starts_on)}`
    : `Até ${formatDate(offer.ends_on!)}`;
}

export function formatOfferOperationalSummary(
  offer: OfferRow,
  serviceName?: string | null,
) {
  if (
    offer.kind !== "membership" ||
    !offer.membership_service_id ||
    offer.membership_sessions_included == null ||
    offer.membership_validity_days == null
  ) {
    return "Somente vitrine comercial por enquanto.";
  }

  const serviceLabel = serviceName?.trim() || "serviço configurado";
  const sessionsLabel =
    offer.membership_sessions_included === 1
      ? "1 sessão"
      : `${offer.membership_sessions_included} sessões`;
  const validityLabel =
    offer.membership_validity_days === 1
      ? "1 dia"
      : `${offer.membership_validity_days} dias`;

  const membershipLabel = resolveMembershipLifecycleCopy(
    offer.membership_validity_days,
  );

  return `${sessionsLabel} de ${serviceLabel} com validade real de ${validityLabel} para este ${membershipLabel}.`;
}

export function formatPercent(value: number | string) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Number(value))}%`;
}

export function formatLifecycleLabel(lifecycle: OfferLifecycle) {
  switch (lifecycle) {
    case "active":
      return "ativa";
    case "scheduled":
      return "agendada";
    case "expired":
      return "expirada";
    default:
      return "pausada";
  }
}

export function badgeClassForLifecycle(lifecycle: OfferLifecycle) {
  switch (lifecycle) {
    case "active":
      return "badge badge--confirmed";
    case "scheduled":
      return "badge badge--pending";
    case "expired":
      return "badge badge--cancelled";
    default:
      return "badge badge--soft";
  }
}

export function lifecycleHint(
  offer: OfferRow,
  lifecycle: OfferLifecycle,
  today: string,
) {
  if (lifecycle === "scheduled" && offer.starts_on) {
    if (
      offer.kind === "membership" &&
      isMonthlyMembershipPlan(offer.membership_validity_days)
    ) {
      return `Pedido já pode ser feito no app. A ativação real começa na data que o salão aprovar.`;
    }

    return `Entra no app em ${formatDate(offer.starts_on)}.`;
  }

  if (lifecycle === "expired" && offer.ends_on) {
    return `Saiu de vigência em ${formatDate(offer.ends_on)}.`;
  }

  if (lifecycle === "active" && offer.ends_on === today) {
    return "Vence hoje.";
  }

  if (lifecycle === "paused") {
    return "Não aparece para o cliente enquanto estiver pausada.";
  }

  return "Disponível no app do cliente conforme a vigência acima.";
}

export async function loadPromotionsPageData(
  searchParams?: OfferSearchParams,
): Promise<PromotionsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const offerQuery = firstParam(searchParams?.offerQ).trim();
  const offerKindFilter = firstParam(searchParams?.offerKind).trim();
  const offerStateFilter = firstParam(searchParams?.offerState).trim();
  const hasOfferFilters = Boolean(
    offerQuery || offerKindFilter || offerStateFilter,
  );

  const offersQuery = (() => {
    let query = supabase
      .from("salon_offers")
      .select("*")
      .eq("salon_id", salon.id);

    if (offerKindFilter === "promotion" || offerKindFilter === "membership") {
      query = query.eq("kind", offerKindFilter);
    }

    if (offerQuery) {
      query = query.or(
        `title.ilike.%${offerQuery}%,description.ilike.%${offerQuery}%,highlight_text.ilike.%${offerQuery}%`,
      );
    }

    return query.order("sort_order").order("created_at");
  })();

  const [
    offersResult,
    activeOffersCountResult,
    activeMembershipsCountResult,
    serviceOptionsResult,
  ] = await Promise.all([
    offersQuery,
    supabase
      .from("salon_offers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_offers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("kind", "membership"),
    supabase
      .from("services")
      .select("id, name, category")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .order("name"),
  ]);

  const allOffers = (offersResult.data ?? []) as OfferRow[];
  const lifecycleCounts: Record<OfferLifecycle, number> = {
    active: 0,
    expired: 0,
    paused: 0,
    scheduled: 0,
  };

  for (const offer of allOffers) {
    lifecycleCounts[getOfferLifecycle(offer, today)] += 1;
  }

  const offers = allOffers.filter((offer) => {
    if (!offerStateFilter) {
      return true;
    }

    return getOfferLifecycle(offer, today) === offerStateFilter;
  });

  const scheduledOffers = allOffers
    .filter((offer) => getOfferLifecycle(offer, today) === "scheduled")
    .sort((left, right) => {
      const leftDate = left.starts_on ?? "9999-12-31";
      const rightDate = right.starts_on ?? "9999-12-31";
      return leftDate.localeCompare(rightDate);
    })
    .slice(0, 4);

  const featuredOffer =
    allOffers.find((offer) => getOfferLifecycle(offer, today) === "active") ??
    allOffers[0] ??
    null;

  const groupedOffers = offers.reduce<Record<string, OfferRow[]>>(
    (groups, offer) => {
      const key =
        offer.kind === "membership" ? "Planos e pacotes" : "Promoções";
      groups[key] ??= [];
      groups[key].push(offer);
      return groups;
    },
    {},
  );

  return {
    activeOffersCount: activeOffersCountResult.count ?? 0,
    activeMembershipsCount: activeMembershipsCountResult.count ?? 0,
    featuredOffer,
    groupedOffers,
    hasOfferFilters,
    lifecycleCounts,
    offerKindFilter,
    offerQuery,
    offerStateFilter,
    offers,
    scheduledOffers,
    serviceOptions: mapServiceOptions(
      (serviceOptionsResult.data ?? []) as ReferralServiceOption[],
    ),
    today,
  };
}
