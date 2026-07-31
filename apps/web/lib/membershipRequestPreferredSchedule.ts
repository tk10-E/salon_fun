import { Buffer } from "node:buffer";

const MEMBERSHIP_REQUEST_PREFERRED_SCHEDULE_MARKER =
  "[salonfun_membership_preferred_schedule]";

export type ParsedMembershipRequestPreferredSchedule = {
  notes: string | null;
  preferredStaffMemberId: string | null;
  preferredStaffMemberName: string | null;
  preferredStartAt: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function parseMembershipRequestPreferredScheduleNotes(
  rawNotes: string | null | undefined,
): ParsedMembershipRequestPreferredSchedule {
  const normalizedNotes = readString(rawNotes);
  if (!normalizedNotes) {
    return {
      notes: null,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
      preferredStartAt: null,
    };
  }

  const markerIndex = normalizedNotes.lastIndexOf(
    MEMBERSHIP_REQUEST_PREFERRED_SCHEDULE_MARKER,
  );
  if (markerIndex < 0) {
    return {
      notes: normalizedNotes,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
      preferredStartAt: null,
    };
  }

  const visibleNotes = normalizedNotes.slice(0, markerIndex).trim() || null;
  const encodedPayload = normalizedNotes
    .slice(markerIndex + MEMBERSHIP_REQUEST_PREFERRED_SCHEDULE_MARKER.length)
    .trim();

  if (!encodedPayload) {
    return {
      notes: normalizedNotes,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
      preferredStartAt: null,
    };
  }

  try {
    const decodedPayload = Buffer.from(encodedPayload, "base64url").toString(
      "utf8",
    );
    const payload = JSON.parse(decodedPayload) as Record<string, unknown>;

    return {
      notes: visibleNotes,
      preferredStaffMemberId: readString(payload.preferredStaffMemberId),
      preferredStaffMemberName: readString(payload.preferredStaffMemberName),
      preferredStartAt: readString(payload.preferredStartAt),
    };
  } catch {
    return {
      notes: normalizedNotes,
      preferredStaffMemberId: null,
      preferredStaffMemberName: null,
      preferredStartAt: null,
    };
  }
}
