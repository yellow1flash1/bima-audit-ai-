import { PRORATA_EXEMPT, type Case, type Department, type RoomCap } from "./types";

export function capPerDay(cap: RoomCap | undefined, sumInsured: number): number | null {
  if (!cap || cap.type === "none") return null;
  if (cap.type === "fixed") return cap.perDay;
  return round2((sumInsured * cap.percent) / 100);
}

export interface Proportion {
  proportion: number;
  roomCapPerDay: number | null;
  waiver?: "non_differential" | "package";
}

/**
 * proportion = min(1, room_cap_per_day / actual_room_rent_per_day),
 * forced to 1 when the hospital does not bill differentially by room category
 * or the treatment is on a fixed package rate.
 */
export function computeProportion(c: Case, roomRentPerDay = c.roomRentPerDay): Proportion {
  const roomCapPerDay = capPerDay(c.policy.roomCap, c.policy.sumInsured);
  if (!c.hospital.differentialBilling) return { proportion: 1, roomCapPerDay, waiver: "non_differential" };
  if (c.isPackageBilling) return { proportion: 1, roomCapPerDay, waiver: "package" };
  return { proportion: roomRatio(roomCapPerDay, roomRentPerDay), roomCapPerDay };
}

/** Share of the room line itself that is admissible — never waived. */
export function roomRatio(roomCapPerDay: number | null, roomRentPerDay: number): number {
  if (roomCapPerDay === null || roomRentPerDay <= 0) return 1;
  return Math.min(1, roomCapPerDay / roomRentPerDay);
}

export function isProrataExempt(d: Department): boolean {
  return PRORATA_EXEMPT.has(d);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
