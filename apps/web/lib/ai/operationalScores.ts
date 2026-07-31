import { getLocalDateKey, getUtcRangeForLocalDate } from "@/lib/management";

type SalonContext = {
  id: string;
  slot_step_minutes?: number | null;
  timezone?: string | null;
};

type StaffMemberRow = {
  id: string;
  is_active: boolean | null;
  name: string;
};

type StaffScheduleContextRow = {
  closes_at_utc: string;
  is_open: boolean;
  opens_at_utc: string;
};

type AppointmentRow = {
  date: string;
  ends_at: string;
  staff_member_id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

export type DayOccupancySnapshot = {
  bookedAppointmentsCount: number;
  bookedMinutes: number;
  occupancyPercent: number | null;
  openSlotsCount: number;
  totalOpenMinutes: number;
  totalSlots: number;
};

export async function computeDayOccupancySnapshot(args: {
  dayKey: string;
  now?: Date;
  salon: SalonContext;
  supabase: any;
}): Promise<DayOccupancySnapshot> {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const now = args.now ?? new Date();
  const slotStep = Math.max(args.salon.slot_step_minutes ?? 30, 15);
  const isToday = args.dayKey === getLocalDateKey(now, timeZone);

  const staffResult = await args.supabase
    .from("staff_members")
    .select("id,name,is_active")
    .eq("salon_id", args.salon.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (staffResult.error) {
    throw staffResult.error;
  }

  const staffMembers = ((staffResult.data ?? []) as StaffMemberRow[]).filter(
    (staffMember) => staffMember.is_active !== false,
  );

  if (!staffMembers.length) {
    return {
      bookedAppointmentsCount: 0,
      bookedMinutes: 0,
      occupancyPercent: null,
      openSlotsCount: 0,
      totalOpenMinutes: 0,
      totalSlots: 0,
    };
  }

  const scheduleContexts = await Promise.all(
    staffMembers.map(async (staffMember) => {
      const result = await args.supabase.rpc("get_staff_schedule_context", {
        target_day: args.dayKey,
        target_staff_member_id: staffMember.id,
      });

      if (result.error) {
        throw result.error;
      }

      return {
        context: ((result.data ?? [])[0] ?? null) as StaffScheduleContextRow | null,
        staffMember,
      };
    }),
  );

  const appointmentsRange = getUtcRangeForLocalDate(args.dayKey, timeZone);
  const appointmentsResult = await args.supabase
    .from("appointments")
    .select("staff_member_id,date,ends_at,status")
    .eq("salon_id", args.salon.id)
    .gte("date", appointmentsRange.start.toISOString())
    .lt("date", appointmentsRange.end.toISOString())
    .in("status", ["pending", "confirmed"]);

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];
  let totalOpenMinutes = 0;
  let bookedMinutes = 0;
  let totalSlots = 0;

  for (const { context, staffMember } of scheduleContexts) {
    if (!context?.is_open) {
      continue;
    }

    const openAt = new Date(context.opens_at_utc);
    const closeAt = new Date(context.closes_at_utc);
    const windowStart = isToday && now > openAt ? now : openAt;

    if (windowStart >= closeAt) {
      continue;
    }

    const windowMinutes = Math.max(
      0,
      Math.round((closeAt.getTime() - windowStart.getTime()) / 60000),
    );

    totalOpenMinutes += windowMinutes;
    totalSlots += Math.floor(windowMinutes / slotStep);

    const professionalAppointments = appointments.filter(
      (appointment) => appointment.staff_member_id === staffMember.id,
    );

    for (const appointment of professionalAppointments) {
      const startAt = new Date(appointment.date);
      const endAt = new Date(appointment.ends_at);
      const overlapStart = startAt > windowStart ? startAt : windowStart;
      const overlapEnd = endAt < closeAt ? endAt : closeAt;

      if (overlapEnd <= overlapStart) {
        continue;
      }

      bookedMinutes += Math.round(
        (overlapEnd.getTime() - overlapStart.getTime()) / 60000,
      );
    }
  }

  const occupancyPercent =
    totalOpenMinutes > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((bookedMinutes / totalOpenMinutes) * 100)),
        )
      : null;

  const bookedSlots = Math.max(0, Math.round(bookedMinutes / slotStep));

  return {
    bookedAppointmentsCount: appointments.length,
    bookedMinutes,
    occupancyPercent,
    openSlotsCount: Math.max(0, totalSlots - bookedSlots),
    totalOpenMinutes,
    totalSlots,
  };
}

export function buildOperationalRiskLabel(args: {
  cancellationsLast7d: number;
  pendingAppointmentsCount: number;
  tomorrowOccupancyPercent: number | null;
}) {
  if (
    (args.tomorrowOccupancyPercent != null && args.tomorrowOccupancyPercent < 35) ||
    args.pendingAppointmentsCount >= 4 ||
    args.cancellationsLast7d >= 4
  ) {
    return "Alto";
  }

  if (
    (args.tomorrowOccupancyPercent != null && args.tomorrowOccupancyPercent < 70) ||
    args.pendingAppointmentsCount >= 1 ||
    args.cancellationsLast7d >= 1
  ) {
    return "Medio";
  }

  return "Baixo";
}

export function buildFillChanceLabel(args: {
  candidateCount: number;
  highChanceCount: number;
  topChanceLabel: string | null;
}) {
  const topChance = (args.topChanceLabel ?? "").toLowerCase();

  if (topChance.includes("alta") || args.highChanceCount >= 3) {
    return "Alta";
  }

  if (args.candidateCount > 0) {
    return "Media";
  }

  return "Baixa";
}
