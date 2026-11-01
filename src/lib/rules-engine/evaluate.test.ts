import { describe, expect, it } from "vitest";
import { demoCases } from "../demo/cases";
import { evaluate } from "./evaluate";
import { matchRule } from "./match";
import { buildRebuttal } from "./rebuttal";
import type { Case } from "./types";

const byDesc = (c: Case, prefix: string) => {
  const ev = evaluate(c);
  const l = ev.lines.find((x) => x.item.description.startsWith(prefix));
  if (!l) throw new Error(`no line ${prefix}`);
  return l;
};

describe("matchRule", () => {
  it.each([
    ["Shoe Covers (12)", "LII.SHOE_COVER"],
    ["Face mask", "LII.FACE_MASK"],
    ["Oxygen Mask", "LI.OXYGEN_MASK"],
    ["N95 mask", "LI.MASK"],
    ["Surgical Tape (Micropore)", "LIII.SURGICAL_TAPE"],
    ["Gauze Swabs", "LIII.GAUZE"],
    ["Glucometer Strips", "LIV.GLUCOMETER"],
    ["Attendant Food", "LI.FOOD_NON_PATIENT"],
    ["Mineral Water (24)", "LI.MINERAL_WATER"],
  ])("%s → %s", (desc, code) => {
    expect(matchRule(desc)?.code).toBe(code);
  });

  it("does not match medical lines", () => {
    expect(matchRule("Inj. Ceftriaxone 1g")).toBeUndefined();
    expect(matchRule("OT Charges")).toBeUndefined();
  });
});

describe("proportionate deduction", () => {
  const [trap, pkg, nonDiff] = demoCases();

  it("computes 62.5% for 1% of ₹5L cap vs ₹8,000 room", () => {
    const ev = evaluate(trap);
    expect(ev.roomCapPerDay).toBe(5000);
    expect(ev.proportion).toBe(0.625);
  });

  it("caps the room line and scales associated expenses", () => {
    expect(byDesc(trap, "Single Room").payable).toBe(20000);
    expect(byDesc(trap, "Single Room").status).toBe("room_excess");
    const surgeon = byDesc(trap, "Surgeon Fee");
    expect(surgeon.payable).toBe(28125);
    expect(surgeon.status).toBe("prorata_trap");
    expect(surgeon.disputable).toBe(0); // TPA deducted exactly the legal amount
  });

  it("never scales pharmacy, implants, diagnostics or ICU", () => {
    for (const p of ["Pharmacy", "Endo-clips", "CBC", "ICU"]) {
      const l = byDesc(trap, p);
      expect(l.payable, p).toBe(l.item.amount);
      expect(l.disputable, p).toBe(l.item.tpaDeducted);
      expect(l.flag).toBe("green");
    }
  });

  it("flags List items and holds subsumed lines until remapped", () => {
    expect(byDesc(trap, "Mineral Water").status).toBe("non_payable");
    const shoe = byDesc(trap, "Shoe Covers");
    expect(shoe.flag).toBe("amber");
    expect(shoe.remapOptions).toContain("room");
  });

  it("pays a remapped line into its bucket at the proportion", () => {
    const c = structuredClone(trap);
    c.items.find((i) => i.description.startsWith("Surgical Tape"))!.remappedTo = "procedure";
    const l = evaluate(c).lines.find((x) => x.item.description.startsWith("Surgical Tape"))!;
    expect(l.status).toBe("remapped");
    expect(l.payable).toBe(400);
  });

  it("ignores machine suggestions until confirmed", () => {
    const l = byDesc(trap, "Disposable kit");
    expect(l.item.suggestedList).toBe("III");
    expect(l.list).toBe("NONE");
    const c = structuredClone(trap);
    c.items.find((i) => i.description.startsWith("Disposable kit"))!.confirmedList = "III";
    expect(evaluate(c).lines.find((x) => x.item.description.startsWith("Disposable kit"))!.status).toBe("subsumed");
  });

  it("waives pro-rata for non-differential hospitals but still caps the room", () => {
    const ev = evaluate(nonDiff);
    expect(ev.proportion).toBe(1);
    expect(ev.proportionWaiver).toBe("non_differential");
    expect(byDesc(nonDiff, "Semi-private").payable).toBe(9000);
    expect(byDesc(nonDiff, "Physician").disputable).toBe(2000);
  });

  it("waives pro-rata for package billing and honours the consumables add-on", () => {
    const ev = evaluate(pkg);
    expect(ev.proportionWaiver).toBe("package");
    expect(byDesc(pkg, "Gloves").status).toBe("payable_addon");
    expect(byDesc(pkg, "Gloves").disputable).toBe(420);
  });

  it("previews a cheaper room via the slider", () => {
    const ev = evaluate(trap, { roomRentPerDay: 5000 });
    expect(ev.proportion).toBe(1);
    expect(ev.lines.find((l) => l.item.department === "room")!.payable).toBe(20000);
    expect(ev.totals.outOfPocket).toBeLessThan(evaluate(trap).totals.outOfPocket);
  });

  it("applies policy sub-limits after scaling", () => {
    const c = structuredClone(trap);
    c.policy.subLimits = { pharmacy: 10000 };
    expect(byDesc(c, "Pharmacy").payable).toBe(10000);
  });

  it("totals add up", () => {
    const { totals, lines } = evaluate(trap);
    expect(totals.billed).toBe(lines.reduce((a, l) => a + l.item.amount, 0));
    expect(totals.outOfPocket).toBeCloseTo(totals.billed - totals.payable, 2);
    expect(totals.disputable).toBeCloseTo(3562.5 + 6993.75 + 5325 + 2775 + 906.25, 2);
  });
});

describe("rebuttal", () => {
  it("cites the exemption for every illegally scaled exempt line", () => {
    const pts = buildRebuttal(evaluate(demoCases()[0]));
    const exempt = pts.filter((p) => p.code === "PRORATA.EXEMPT");
    expect(exempt.map((p) => p.item)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^ICU/), expect.stringMatching(/^Pharmacy/), expect.stringMatching(/^Endo/), expect.stringMatching(/^CBC/)]),
    );
    expect(exempt[0].en).toContain("₹");
    expect(exempt[0].hi).toMatch(/[ऀ-ॿ]/);
  });
});
