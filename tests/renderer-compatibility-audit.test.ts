import { describe, expect, it } from "vitest";
import library from "../data/library.json";
import type { LabelDocument } from "@/lib/document";
import { auditIndustrialTemplates, formatCompatibilityAudit } from "@/lib/labelator-package/audit";
import { A3_WAREHOUSE_TEMPLATE_ID } from "@/lib/labelator-package/a3-warehouse";
import { GA_ADDRESS_TEMPLATE_ID } from "@/lib/labelator-package/ga-address";
import { FIXED_GA_A4_TEMPLATE_ID } from "@/lib/labelator-package/fixed-ga-a4";
import { CANOPY_A3_3PN_TEMPLATE_ID } from "@/lib/labelator-package/canopy-a3-3pn";
import { CDC_A3_TEMPLATE_ID } from "@/lib/labelator-package/cdc-a3";
import { CANOPY_A3_1PN_TEMPLATE_ID } from "@/lib/labelator-package/canopy-a3-1pn";

const GOLDEN_IDS = [
  A3_WAREHOUSE_TEMPLATE_ID,
  GA_ADDRESS_TEMPLATE_ID,
  FIXED_GA_A4_TEMPLATE_ID,
  CANOPY_A3_3PN_TEMPLATE_ID,
  CDC_A3_TEMPLATE_ID,
  CANOPY_A3_1PN_TEMPLATE_ID,
];

describe("Industrial renderer compatibility audit", () => {
  it("prints the derived audit and finds the validated templates compatible", () => {
    const rows = auditIndustrialTemplates(library.documents as LabelDocument[]);
    // Diagnostic report. Expected answers are not hardcoded in the analyzer.
    console.log(`\n${formatCompatibilityAudit(rows)}\n`);
    expect(rows.length).toBeGreaterThanOrEqual(GOLDEN_IDS.length);
    for (const id of GOLDEN_IDS) {
      const row = rows.find((item) => item.id === id);
      expect(row, id).toBeTruthy();
      expect(row?.status, `${row?.name}: ${row?.unsupported.join(", ")}`).toBe("compatible");
    }
  });
});
