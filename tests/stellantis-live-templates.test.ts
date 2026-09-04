import { describe, expect, it } from "vitest";
import library from "../data/library.json";

const GA_ADDRESS_ID = "0a9b4a95-985c-487d-a58e-057a5e45ba57";
const CANOPY_3PN_ID = "6060f5ce-7572-44a4-b085-9845557f62df";
const OVS_DUAL_ID = "ac4c76e0-42b0-4233-94d9-946516d43d80";

type JsonElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  binding?: string | null;
  transform?: string | null;
  content?: string | null;
};

type JsonDocument = {
  id: string;
  name: string;
  catalogId?: string | null;
  catalogRevision?: number | null;
  page: { widthMm: number; heightMm: number };
  elements: JsonElement[];
};

function byId<T extends { id: string }>(items: T[], id: string) {
  const found = items.find((item) => item.id === id);
  if (!found) throw new Error(`Missing ${id}`);
  return found;
}

function layoutOf(el: JsonElement) {
  const mm = (value: number) => Math.round(value * 10) / 10 + 0;
  return {
    type: el.type,
    x: mm(el.x),
    y: mm(el.y),
    width: mm(el.width),
    height: mm(el.height),
    binding: el.binding ?? null,
    transform: el.transform ?? null,
  };
}

describe("Phase 1 accidental-write templates", () => {
  const documents = library.documents as JsonDocument[];

  it("keeps GA Address MAGACIN/REGAL/NIVO bindings and an unbound designed arrow", () => {
    const doc = byId(documents, GA_ADDRESS_ID);
    expect(doc.name).toBe("GA Address");
    expect(doc.catalogId).toBe("ga_warehouse_a3");
    expect(doc.catalogRevision).toBe(3);
    expect(doc.page).toEqual({ widthMm: 408.98, heightMm: 80.72 });
    expect(doc.elements).toHaveLength(18);
    const transforms = doc.elements.map((el) => el.transform).filter(Boolean);
    expect(transforms).toEqual(expect.arrayContaining(["ga_magacin", "ga_regal_letter", "ga_regal_number", "ga_nivo"]));
    expect(doc.elements.filter((el) => el.binding === "address").length).toBeGreaterThanOrEqual(4);
    const arrow = byId(doc.elements, "b4f1e589-f6a6-4513-ae27-fc9e1d47bc33");
    expect(arrow.type).toBe("arrow");
    expect(arrow.binding ?? null).toBeNull();
    expect(arrow.transform ?? null).toBeNull();
    expect(arrow.content ?? null).toBeNull();
    expect(layoutOf(arrow)).toMatchObject({ x: 388.3, y: 28.1, width: 24.3, height: 23.5 });
  });

  it("keeps Canopy A3 — 3 PN qty cells on qty1 and part-number texts unbound", () => {
    const doc = byId(documents, CANOPY_3PN_ID);
    expect(doc.name).toBe("Canopy A3 — 3 PN");
    expect(doc.catalogId).toBe("canopy_a3_3pn");
    expect(doc.page).toEqual({ widthMm: 420, heightMm: 297 });
    expect(doc.elements).toHaveLength(16);
    expect(byId(doc.elements, "6f1d2868-c1d8-4cb1-abf7-3be57b9aced8").binding).toBe("qty1");
    expect(byId(doc.elements, "1c84c33b-6ac4-4ee4-875e-3b47cee378e2").binding).toBe("qty1");
    expect(byId(doc.elements, "f01775b2-1324-4dc7-9b4e-1abd08d6a6f5").binding).toBe("qty1");
    expect(byId(doc.elements, "3d98b03d-746e-46ba-bcd6-d367216456ca").binding ?? null).toBeNull();
    expect(byId(doc.elements, "3d98b03d-746e-46ba-bcd6-d367216456ca").transform ?? null).toBeNull();
    expect(byId(doc.elements, "6086a9a6-ec55-42c2-b19c-3adc38ed2b19").binding ?? null).toBeNull();
    expect(byId(doc.elements, "79144a9b-19ce-4b2d-98ec-7cfd9ed201e9").binding ?? null).toBeNull();
  });

  it("keeps OVS A3 dual title/address bindings and the large part-number text unbound", () => {
    const doc = byId(documents, OVS_DUAL_ID);
    expect(doc.name).toBe("OVS A3 dual");
    expect(doc.catalogId).toBe("simple_ovs_a3_dual");
    expect(doc.page).toEqual({ widthMm: 380, heightMm: 100 });
    expect(doc.elements).toHaveLength(4);
    expect(byId(doc.elements, "b844eb1d-ad0d-4b61-b4da-17ee54b2244d").binding).toBe("title");
    expect(byId(doc.elements, "1d477871-e6f7-4fc2-be4b-125ae4f54edf").binding).toBe("mapping_address");
    const pn = byId(doc.elements, "b7154d4b-41ad-4a0e-aa43-37be04085556");
    expect(pn.binding ?? null).toBeNull();
    expect(pn.transform ?? null).toBeNull();
    expect(layoutOf(pn)).toMatchObject({ x: 0, y: 33, width: 380, height: 79 });
  });
});
