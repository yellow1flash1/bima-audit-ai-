import { describe, expect, it } from "vitest";
import { flatKeys, messagesFor, translate } from "./dictionary";

describe("i18n", () => {
  it("en and hi have identical key sets", () => {
    expect(flatKeys(messagesFor("hi-IN")).sort()).toEqual(flatKeys(messagesFor("en-IN")).sort());
  });

  it("seeds the core glossary", () => {
    expect(translate("hi-IN", "status.payable")).toBe("पूर्णतः देय (Payable)");
    expect(translate("hi-IN", "status.prorata_trap")).toBe("कमरे के किराए के अनुपात में कटौती");
    expect(translate("hi-IN", "sla.delay_alert")).toBe("3 घंटे की समय-सीमा समाप्त");
    expect(translate("hi-IN", "status.subsumed", undefined, true)).toContain("अलग से नहीं काटा जा सकता");
  });

  it("interpolates", () => {
    expect(translate("en-IN", "sla.remaining", { time: "01:18:42" })).toBe("01:18:42 remaining");
  });
});
