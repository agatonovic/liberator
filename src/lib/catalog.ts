import {
  createDocument,
  createElement,
  createSampleShipping,
  type DataColumn,
  type LabelDocument,
  type LabelElement,
  type SheetLayout,
} from "./document";

const PT = 25.4 / 72;
const INK = "#221F1F";
const RED = "#E01E2B";
const NAVY = "#1F295C";
const MUTED = "#737373";
const WHITE = "#ffffff";
const BLACK = "#000000";
const ARTIFAKT = "Artifakt Element";
const ARTIFAKT_BLACK = "Artifakt Element Black";
const FIXED_BLUE = "#305496";
const FIXED_RED = "#CC1F2D";
const FIXED_BORDER = "#737373";
const POS_GRAY = "#595959";
const A3 = { widthMm: 420, heightMm: 297 };
const A4 = { widthMm: 210, heightMm: 297 };

/** Bump to replace seeded catalog copies that still have the old geometry. */
export const CATALOG_REVISION: Record<string, number> = {
  ga_warehouse_a3: 3,
  ga_warehouse_a3_dual: 3,
  fixed_ga_a3: 3,
  fixed_ga_a4: 3,
};

export type CatalogEntry = {
  id: string;
  name: string;
  group: string;
  description: string;
  build: () => LabelDocument;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function geom(box: [number, number, number, number], origin: [number, number] = [0, 0]) {
  return {
    x: round2((box[0] - origin[0]) * PT),
    y: round2((box[1] - origin[1]) * PT),
    width: round2((box[2] - box[0]) * PT),
    height: round2((box[3] - box[1]) * PT),
  };
}

function fontMm(pt: number): number {
  return round2(pt * PT);
}

function col(
  key: string,
  label: string,
  headers: string[],
  example: string,
  required = true,
  extras?: Partial<DataColumn>,
): DataColumn {
  return { key, label, headers, example, required, ...extras };
}

function finish(
  doc: LabelDocument,
  catalogId: string,
  description: string,
  dataColumns: DataColumn[],
  sheet?: SheetLayout,
): LabelDocument {
  doc.catalogId = catalogId;
  doc.catalogRevision = CATALOG_REVISION[catalogId];
  doc.description = description;
  doc.dataColumns = dataColumns;
  doc.sheet = sheet;
  return doc;
}

function fitFontMm(pt: number, box: [number, number, number, number], origin: [number, number] = [0, 0]) {
  return round2(Math.min(fontMm(pt), geom(box, origin).height * 0.92));
}

function underlay(src: string, page: { widthMm: number; heightMm: number }): LabelElement {
  return createElement("image", 0, 0, {
    width: page.widthMm,
    height: page.heightMm,
    imageDataUrl: src,
    locked: true,
    style: { opacity: 1 },
  });
}

function imageBox(
  box: [number, number, number, number],
  extras: Partial<LabelElement> & { origin?: [number, number] } = {},
): LabelElement {
  const { origin = [0, 0], ...rest } = extras;
  const g = geom(box, origin);
  return createElement("image", g.x, g.y, {
    width: g.width,
    height: g.height,
    style: { opacity: 1 },
    ...rest,
  });
}

function textBox(
  box: [number, number, number, number],
  extras: Partial<LabelElement> & { origin?: [number, number] } = {},
): LabelElement {
  const { origin = [0, 0], ...rest } = extras;
  const g = geom(box, origin);
  return createElement("text", g.x, g.y, {
    width: g.width,
    height: g.height,
    ...rest,
    style: {
      fill: INK,
      fontWeight: "bold",
      align: "center",
      verticalAlign: "middle",
      opacity: 1,
      ...rest.style,
    },
  });
}

function refRow(
  columns: [number, number, number, number][],
  binding: string,
  fontPt: number,
  sample: string,
  origin: [number, number] = [0, 0],
  opts?: { fontFamily?: string; ink?: string; red?: string },
): LabelElement[] {
  const parts = sample.split(/\s+/);
  return columns.map((box, index) =>
    textBox(box, {
      origin,
      binding,
      partIndex: index,
      transform: "part",
      content: parts[index] ?? "",
      style: {
        fill: index === 2 ? (opts?.red ?? RED) : (opts?.ink ?? INK),
        fontFamily: opts?.fontFamily,
        fontSizeMm: fitFontMm(fontPt, box, origin),
        fontWeight: "bold",
        align: "center",
        verticalAlign: "middle",
      },
    }),
  );
}

function barcodeBox(
  box: [number, number, number, number],
  extras: Partial<LabelElement> & { origin?: [number, number] } = {},
): LabelElement {
  const { origin = [0, 0], ...rest } = extras;
  const g = geom(box, origin);
  return createElement("barcode", g.x, g.y, {
    width: g.width,
    height: g.height,
    style: { barcodeSymbology: "code128", barcodeDisplayValue: false, opacity: 1 },
    ...rest,
  });
}

function rectBox(
  box: [number, number, number, number],
  fill: string,
  origin: [number, number] = [0, 0],
): LabelElement {
  const g = geom(box, origin);
  return createElement("rect", g.x, g.y, {
    width: g.width,
    height: g.height,
    style: { fill, stroke: "transparent", strokeWidth: 0, opacity: 1 },
  });
}

function warehouse(): LabelDocument {
  const doc = createDocument("Warehouse A3", A3);
  doc.elements = [
    ...refRow(
      [
        [20, 14, 275, 218],
        [275, 14, 615, 218],
        [615, 14, 945, 218],
        [945, 14, 1172, 218],
      ],
      "reference",
      120,
      "73 580 423 50",
    ),
    textBox([20, 226, 284, 368], {
      binding: "ref4",
      content: "QULY",
      style: { fill: INK, fontSizeMm: fontMm(72), fontWeight: "bold", align: "center" },
    }),
    textBox([288, 226, 538, 368], {
      binding: "depth",
      content: "1",
      style: { fill: INK, fontSizeMm: fontMm(72), fontWeight: "bold", align: "center" },
    }),
    textBox([542, 226, 792, 368], {
      binding: "stackability",
      content: "4",
      style: { fill: INK, fontSizeMm: fontMm(72), fontWeight: "bold", align: "center" },
    }),
    textBox([796, 226, 1172, 368], {
      binding: "packaging",
      content: "X4202",
      style: { fill: INK, fontSizeMm: fontMm(72), fontWeight: "bold", align: "center" },
    }),
    textBox([20, 384, 792, 576], {
      binding: "warehouse_code",
      content: "WG6.99.123",
      style: { fill: INK, fontSizeMm: fontMm(64), fontWeight: "normal", align: "left" },
    }),
    textBox([796, 384, 1172, 558], {
      binding: "packaging",
      content: "IMAGE",
      style: { fill: MUTED, fontSizeMm: fontMm(18), fontWeight: "normal", align: "center" },
    }),
    barcodeBox([20, 582, 1172, 818], {
      binding: "barcode",
      fallbackBinding: "warehouse_code",
      transform: "barcode_pct",
      content: "WG6.99.123%",
    }),
  ];
  return finish(doc, "warehouse_a3", "A3 warehouse sticker. One row per label.", [
    col("reference", "Reference", ["REFERENCA", "REFERENCE", "Produit", "PRODUCT"], "73 580 423 50"),
    col("warehouse_code", "Magacin", ["MAGACIN", "WAREHOUSE_CODE"], "WG6.99.123"),
    col("ref4", "REF4", ["REF4"], "QULY"),
    col("depth", "Dubina", ["DUBINA"], "1"),
    col("stackability", "Složivost", ["SLOŽIVOST", "SLOZIVOST"], "4"),
    col("packaging", "Pakovanje", ["PAKOVANJE", "PAKOVANJE (MDR)"], "X4202"),
    col("barcode", "Barcode", ["BARCODE", "BARCODE: ADRESA SKLADIŠTA"], "WG6.99.123%", false),
  ]);
}

function ovs(dual: boolean): LabelDocument {
  const page = dual ? { widthMm: 420, heightMm: 148.5 } : A3;
  const origin: [number, number] = [0, 0];
  const doc = createDocument(dual ? "OVS A3 dual" : "OVS A3", page);
  doc.elements = [
    rectBox([0, 0, 1190.55, 175], NAVY, origin),
    textBox([67, 29, 1123, 138], {
      origin,
      binding: "title",
      content: "OVS FIKSNE POZICIJE",
      style: { fill: WHITE, fontSizeMm: fontMm(48), fontWeight: "bold", align: "center" },
    }),
    ...refRow(
      [
        [136, 178, 310, 368],
        [310, 178, 615, 368],
        [615, 178, 855, 368],
        [855, 178, 1055, 368],
      ],
      "reference",
      90,
      "98 474 044 80",
      origin,
    ),
    textBox([980, 348, 1175, 368], {
      origin,
      binding: "mapping_address",
      content: "HB2K.001.001",
      style: { fill: MUTED, fontSizeMm: fontMm(9), fontWeight: "normal", align: "right" },
    }),
  ];
  const columns = [
    col("reference", "Product code", ["Produit", "REFERENCA", "REFERENCE", "PRODUCT"], "9847404480"),
    col("title", "Header text", ["Title", "HEADER", "NASLOV"], "OVS FIKSNE POZICIJE", false),
    col("mapping_address", "Mapping address", ["New mapping", "Mapping", "MAPPING", "Adresa", "Location", "POSITION"], "HB2K.001.001", false),
  ];
  return finish(
    doc,
    dual ? "simple_ovs_a3_dual" : "simple_ovs_a3",
    dual ? "Two OVS labels per A3 page." : "OVS A3 label — product code with red middle group.",
    columns,
    dual ? { pageSize: "A3", columns: 1, rows: 2, gapMm: 0, marginMm: 0 } : undefined,
  );
}

function hbc(): LabelDocument {
  const doc = createDocument("HBC A4 shelf", A4);
  const rows: [number, number, number, number][] = [
    [8, 205.6, 441.2, 270.1],
    [8, 270.1, 441.2, 334.5],
    [8, 334.5, 441.2, 398.9],
    [8, 398.9, 441.2, 463.2],
    [8, 463.2, 441.2, 527.6],
  ];
  const keys = ["lvl5", "lvl4", "lvl3", "lvl2", "lvl1"];
  const samples = ["98 457 969 80", "98 457 968 80", "98 457 967 80", "98 457 966 80", "98 457 965 80"];
  doc.elements = [
    rectBox([0, 0, 595.3, 88], NAVY),
    textBox([0, 20, 595.3, 70], {
      content: "HBC",
      style: { fill: WHITE, fontSizeMm: fontMm(28), fontWeight: "bold", align: "center" },
    }),
    textBox([0, 88.4, 595.3, 153.1], {
      binding: "shelf_name",
      content: "HBC.05.001",
      style: { fill: INK, fontSizeMm: fontMm(32), fontWeight: "bold", align: "center" },
    }),
    rectBox([0, 153.1, 595.3, 205], NAVY),
    textBox([0, 165, 595.3, 198], {
      content: "NIVO  /  BROJ CRTEZA",
      style: { fill: WHITE, fontSizeMm: fontMm(14), fontWeight: "bold", align: "center" },
    }),
    ...rows.flatMap((box, index) => {
      const width = (box[2] - box[0]) / 4;
      const cols: [number, number, number, number][] = [0, 1, 2, 3].map((part) => [
        box[0] + part * width,
        box[1],
        box[0] + (part + 1) * width,
        box[3],
      ]);
      return refRow(cols, keys[index], 36, samples[index]);
    }),
  ];
  return finish(doc, "hbc_a4", "A4 shelf label. One Excel row per shelf (levels 5→1 as columns).", [
    col("shelf_name", "Ime Regala", ["Ime Regala", "SHELF"], "HBC.05.001"),
    col("lvl5", "Nivo 5", ["Nivo 5", "lvl5"], "9845796980"),
    col("lvl4", "Nivo 4", ["Nivo 4", "lvl4"], "9845796880", false),
    col("lvl3", "Nivo 3", ["Nivo 3", "lvl3"], "9845796780", false),
    col("lvl2", "Nivo 2", ["Nivo 2", "lvl2"], "9845796680", false),
    col("lvl1", "Nivo 1", ["Nivo 1", "lvl1"], "9845796580", false),
  ]);
}

function cdc(): LabelDocument {
  const doc = createDocument("CDC A3", A3);
  doc.elements = [
    rectBox([0, 0, 1190.55, 250], NAVY),
    textBox([16, 16, 1174, 246], {
      binding: "building_name",
      content: "CDC",
      style: { fill: WHITE, fontSizeMm: fontMm(96), fontWeight: "bold", align: "center" },
    }),
    textBox([22, 258, 1168, 500], {
      binding: "warehouse_code",
      content: "CDCNN.10.001",
      style: { fill: INK, fontSizeMm: fontMm(72), fontWeight: "normal", align: "center" },
    }),
    textBox([22, 500, 1168, 540], {
      content: "ADRESA SKLADISTA",
      style: { fill: MUTED, fontSizeMm: fontMm(12), fontWeight: "bold", align: "left" },
    }),
    barcodeBox([28, 558, 1162, 828], {
      binding: "barcode",
      fallbackBinding: "warehouse_code",
      transform: "barcode_pct",
      content: "CDCNN.10.001%",
    }),
  ];
  return finish(doc, "cdc_a3", "CDC A3 warehouse sticker.", [
    col("building_name", "Naziv zgrade", ["Naziv zgrade", "NAZIV ZGRADE", "BUILDING", "CDC"], "CDC"),
    col("warehouse_code", "Adresa skladista", ["Adresa skladista", "ADRESA SKLADISTA", "MAGACIN", "WAREHOUSE_CODE"], "CDCNN.10.001"),
    col("barcode", "Barcode", ["BARCODE", "BARCODE: ADRESA SKLADISTA"], "CDCNN.10.001%", false),
  ]);
}

function canopy1(): LabelDocument {
  const doc = createDocument("Canopy A3 — 1 PN", A3);
  doc.elements = [
    ...refRow(
      [
        [38.6, 155.9, 202.1, 304.5],
        [202.1, 111.7, 583.8, 339.6],
        [593.5, 131.6, 936.7, 339.6],
        [936.7, 155.9, 1135.7, 324.3],
      ],
      "ref1",
      110,
      "98 456 056 80",
    ),
    textBox([215.6, 380, 968.1, 544], {
      binding: "position",
      content: "WG1D.02.001",
      style: { fill: INK, fontSizeMm: fontMm(56), fontWeight: "normal", align: "center" },
    }),
    textBox([22, 505, 130, 538], {
      content: "MAGACIN",
      style: { fill: INK, fontSizeMm: fontMm(12), fontWeight: "bold", align: "left", verticalAlign: "bottom" },
    }),
    barcodeBox([71.6, 548, 1112.5, 800], {
      binding: "barcode",
      fallbackBinding: "position",
      transform: "barcode_pct",
      content: "WG1D.02.001%",
    }),
  ];
  return finish(doc, "canopy_a3_1pn", "Canopy A3 for positions with one part number.", [
    col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.02.001"),
    col("ref1", "Part number 1", ["PN", "Produit", "REFERENCE", "ref1"], "9845605680"),
    col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.02.001%", false),
  ]);
}

function canopy2(): LabelDocument {
  const doc = createDocument("Canopy A3 — 2 PN", A3);
  doc.elements = [
    ...refRow(
      [
        [22.4, 72.3, 165.3, 202.3],
        [173.8, 56, 454.1, 226],
        [468.3, 56, 748.5, 226],
        [767.9, 72.3, 910.8, 202.3],
      ],
      "ref1",
      90,
      "98 467 559 80",
    ),
    rectBox([957.8, 72.3, 1100.7, 202.3], NAVY),
    textBox([957.8, 72.3, 1100.7, 202.3], {
      binding: "qty1",
      content: "x2",
      style: { fill: WHITE, fontSizeMm: fontMm(48), fontWeight: "bold", align: "center" },
    }),
    ...refRow(
      [
        [22.4, 281.1, 165.3, 411.2],
        [173.8, 264.8, 454.1, 434.9],
        [468.3, 264.8, 748.5, 434.9],
        [767.9, 281.1, 910.8, 411.2],
      ],
      "ref2",
      90,
      "73 579 933 20",
    ),
    rectBox([957.8, 281.1, 1100.7, 411.2], NAVY),
    textBox([957.8, 281.1, 1100.7, 411.2], {
      binding: "qty2",
      content: "x3",
      style: { fill: WHITE, fontSizeMm: fontMm(48), fontWeight: "bold", align: "center" },
    }),
    textBox([199.8, 438, 960.3, 560], {
      binding: "position",
      content: "WG1D.13.006",
      style: { fill: INK, fontSizeMm: fontMm(48), fontWeight: "normal", align: "center" },
    }),
    textBox([22, 528, 115, 560], {
      content: "MAGACIN",
      style: { fill: INK, fontSizeMm: fontMm(11), fontWeight: "bold", align: "left", verticalAlign: "bottom" },
    }),
    barcodeBox([19, 571, 1143, 829], {
      binding: "barcode",
      fallbackBinding: "position",
      transform: "barcode_pct",
      content: "WG1D.13.006%",
    }),
  ];
  return finish(doc, "canopy_a3_2pn", "Canopy A3 for positions with two part numbers.", [
    col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.13.006"),
    col("ref1", "Part number 1", ["ref1", "PN", "Produit"], "9846755980"),
    col("qty1", "Qty 1", ["qty1", "QTY1"], "2"),
    col("ref2", "Part number 2", ["ref2"], "7357993320"),
    col("qty2", "Qty 2", ["qty2", "QTY2"], "3"),
    col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.13.006%", false),
  ]);
}

function canopy3(): LabelDocument {
  const doc = createDocument("Canopy A3 — 3 PN", A3);
  const row = (
    y0: number,
    y1: number,
    binding: string,
    sample: string,
    qtyKey: string,
    qtySample: string,
  ): LabelElement[] => [
    ...refRow(
      [
        [22.4, y0 + 14, 165.3, y1 - 21],
        [177.6, y0, 450, y1],
        [472.3, y0, 744.6, y1],
        [744.6, y0 + 14, 910.8, y1 - 9],
      ],
      binding,
      70,
      sample,
    ),
    rectBox([948.4, y0 + 14, 1091.3, y1 - 21], NAVY),
    textBox([948.4, y0 + 14, 1091.3, y1 - 21], {
      binding: qtyKey,
      content: qtySample,
      style: { fill: WHITE, fontSizeMm: fontMm(40), fontWeight: "bold", align: "center" },
    }),
  ];
  doc.elements = [
    ...row(20.3, 185.3, "ref1", "98 559 365 80", "qty1", "x3"),
    ...row(156.1, 321.1, "ref2", "98 559 361 80", "qty2", "x1"),
    ...row(297.1, 462.2, "ref3", "98 606 925 80", "qty3", "x1"),
    textBox([199.8, 470, 960.3, 560], {
      binding: "position",
      content: "WG1D.11.014",
      style: { fill: INK, fontSizeMm: fontMm(40), fontWeight: "normal", align: "center" },
    }),
    textBox([22, 528, 115, 560], {
      content: "MAGACIN",
      style: { fill: INK, fontSizeMm: fontMm(11), fontWeight: "bold", align: "left" },
    }),
    barcodeBox([19, 571, 1143, 829], {
      binding: "barcode",
      fallbackBinding: "position",
      transform: "barcode_pct",
      content: "WG1D.11.014%",
    }),
  ];
  return finish(doc, "canopy_a3_3pn", "Canopy A3 for positions with three part numbers.", [
    col("position", "Position", ["MAP SIMPLE", "Position", "position"], "WG1D.11.014"),
    col("ref1", "Part number 1", ["ref1"], "9855936580"),
    col("qty1", "Qty 1", ["qty1"], "3"),
    col("ref2", "Part number 2", ["ref2"], "9855936180"),
    col("qty2", "Qty 2", ["qty2"], "1"),
    col("ref3", "Part number 3", ["ref3"], "9860692580"),
    col("qty3", "Qty 3", ["qty3"], "1"),
    col("barcode", "Barcode", ["BARCODE", "Map", "MAP"], "WG1D.11.014%", false),
  ]);
}

function slozivost(): LabelDocument {
  const page = { widthMm: 210, heightMm: 148.5 };
  const doc = createDocument("Složivost A4", page);
  doc.elements = [
    textBox([20, 18, 260, 50], {
      content: "SLOŽIVOST",
      style: { fill: MUTED, fontSizeMm: fontMm(14), fontWeight: "bold", align: "left" },
    }),
    textBox([275, 1, 544, 391], {
      binding: "stackability",
      content: "4",
      style: { fill: INK, fontSizeMm: fontMm(120), fontWeight: "bold", align: "center", verticalAlign: "middle" },
    }),
    textBox([49, 328, 280, 345], {
      binding: "address",
      content: "WG1D.02.001",
      style: { fill: INK, fontSizeMm: fontMm(11), fontWeight: "normal", align: "left" },
    }),
  ];
  return finish(
    doc,
    "slozivost_a4",
    "Two stackability labels per A4 page.",
    [
      col("address", "Address", ["MAP SIMPLE", "Map Simple", "POSITION", "address"], "WG1D.02.001"),
      col("stackability", "Složivost", ["Stackability", "SLOŽIVOST", "SLOZIVOST"], "4"),
    ],
    { pageSize: "A4", columns: 1, rows: 2, gapMm: 0, marginMm: 0 },
  );
}

function gaWarehouse(): LabelDocument {
  const origin: [number, number] = [0, 0];
  const page = { widthMm: round2((1167.2 - 7.9) * PT), heightMm: round2((243.4 - 14.6) * PT) };
  const doc = createDocument("GA warehouse A3", page);
  const field = (
    box: [number, number, number, number],
    extras: Partial<LabelElement>,
  ): LabelElement =>
    textBox(box, {
      origin,
      ...extras,
      style: {
        fill: BLACK,
        fontFamily: ARTIFAKT_BLACK,
        fontSizeMm: fitFontMm(105, box, origin),
        fontWeight: "bold",
        align: "center",
        verticalAlign: "middle",
        ...extras.style,
      },
    });
  doc.elements = [
    underlay("/templates/ga/ga_warehouse.png", page),
    field([94.7, 75.8, 281.9, 149.0], {
      binding: "address",
      transform: "ga_magacin",
      content: "HB9",
    }),
    field([401.4, 77.4, 465.7, 147.4], {
      binding: "address",
      transform: "ga_regal_letter",
      content: "A",
    }),
    field([562.1, 75.8, 719.3, 149.0], {
      binding: "address",
      transform: "ga_regal_number",
      content: "011",
    }),
    field([817.2, 75.8, 988.7, 149.0], {
      binding: "address",
      transform: "ga_nivo",
      content: "001",
    }),
    imageBox([1036.0, 82.2, 1103.4, 152.3], {
      origin,
      binding: "arrow",
      content: "DOWN",
      transform: "arrow",
      imageDataUrl: "/templates/ga/arrows/DOWN.png",
    }),
    barcodeBox([190.5, 164.0, 969.9, 226.0], {
      origin,
      binding: "barcode",
      fallbackBinding: "address",
      content: "HB9A.011.001",
    }),
  ];
  return finish(
    doc,
    "ga_warehouse_a3",
    "One MAGACIN / REGAL / NIVO sticker (409 × 81 mm). Generate packs 3 per A3 landscape.",
    [
      col("address", "Address", ["address", "Address", "MAP SIMPLE", "POSITION"], "HB9A.011.001"),
      col("arrow", "Arrow", ["arrow", "Arrow", "ARROW"], "DOWN", true, { values: ["UP", "DOWN"] }),
      col("barcode", "Barcode", ["barcode", "Barcode"], "HB9A.011.001", false),
    ],
    { pageSize: "A3-landscape", columns: 1, rows: 3, gapMm: 0, marginMm: 2 },
  );
}

function gaDual(): LabelDocument {
  const origin: [number, number] = [0, 0];
  const page = { widthMm: round2((1167.2 - 7.9) * PT), heightMm: round2(378.8 * PT) };
  const doc = createDocument("GA warehouse A3 dual", page);
  const field = (
    box: [number, number, number, number],
    extras: Partial<LabelElement>,
  ): LabelElement =>
    textBox(box, {
      origin,
      ...extras,
      style: {
        fill: BLACK,
        fontFamily: ARTIFAKT_BLACK,
        fontSizeMm: fitFontMm(105, box, origin),
        fontWeight: "bold",
        align: "center",
        verticalAlign: "middle",
        ...extras.style,
      },
    });
  const band = (
    prefix: "top" | "bot",
    boxes: {
      magacin: [number, number, number, number];
      letter: [number, number, number, number];
      number: [number, number, number, number];
      nivo: [number, number, number, number];
      arrow: [number, number, number, number];
      barcode: [number, number, number, number];
    },
    sample: string,
    arrow: string,
  ): LabelElement[] => {
    const [head, shelf, nivo] = sample.split(".");
    const mag = head.slice(0, -1);
    const letter = head.slice(-1);
    return [
      field(boxes.magacin, {
        binding: `address_${prefix}`,
        transform: "ga_magacin",
        content: mag,
        spans: mag.toUpperCase().startsWith("R") ? [{ start: 0, end: 1, fill: "#FF0000" }] : undefined,
      }),
      field(boxes.letter, {
        binding: `address_${prefix}`,
        transform: "ga_regal_letter",
        content: letter,
      }),
      field(boxes.number, {
        binding: `address_${prefix}`,
        transform: "ga_regal_number",
        content: shelf,
      }),
      field(boxes.nivo, {
        binding: `address_${prefix}`,
        transform: "ga_nivo",
        content: nivo,
      }),
      imageBox(boxes.arrow, {
        origin,
        content: arrow,
        imageDataUrl: `/templates/ga/arrows/${arrow}.png`,
      }),
      barcodeBox(boxes.barcode, {
        origin,
        binding: `barcode_${prefix}`,
        fallbackBinding: `address_${prefix}`,
        content: sample,
      }),
    ];
  };
  doc.elements = [
    underlay("/templates/ga/ga_warehouse_dual.png", page),
    ...band(
      "top",
      {
        magacin: [94.7, 74.1, 281.9, 147.3],
        letter: [401.4, 75.7, 465.7, 145.7],
        number: [562.1, 74.1, 719.3, 147.3],
        nivo: [817.2, 74.1, 988.7, 147.3],
        arrow: [1036.0, 80.5, 1103.4, 150.6],
        barcode: [190.5, 1.7, 969.9, 63.7],
      },
      "RHB7B.001.002",
      "UP",
    ),
    ...band(
      "bot",
      {
        magacin: [94.7, 231.1, 281.9, 304.3],
        letter: [401.4, 232.7, 465.7, 302.7],
        number: [562.1, 231.1, 719.3, 304.3],
        nivo: [817.2, 231.1, 988.7, 304.3],
        arrow: [1036.0, 237.5, 1103.4, 307.6],
        barcode: [190.5, 314.0, 969.9, 376.0],
      },
      "HB7B.001.001",
      "DOWN",
    ),
  ];
  return finish(
    doc,
    "ga_warehouse_a3_dual",
    "One dual sticker (409 × 134 mm): level 002 UP over 001 DOWN. Generate packs 2 per A3 landscape.",
    [
      col("address_top", "Top address", ["address_top", "Address Top", "TOP", "MAP TOP"], "RHB7B.001.002"),
      col("barcode_top", "Top barcode", ["barcode_top"], "RHB7B.001.002", false),
      col("address_bot", "Bottom address", ["address_bot", "Address Bot", "BOTTOM", "MAP BOT"], "HB7B.001.001"),
      col("barcode_bot", "Bottom barcode", ["barcode_bot"], "HB7B.001.001", false),
    ],
    { pageSize: "A3-landscape", columns: 1, rows: 2, gapMm: 0, marginMm: 2 },
  );
}

function fixedGa(a4: boolean): LabelDocument {
  const origin: [number, number] = [235, 0];
  const page = { widthMm: round2(720 * PT), heightMm: round2(203 * PT) };
  const doc = createDocument(a4 ? "FIXED GA A4" : "FIXED GA A3", page);
  doc.elements = [
    createElement("rect", 0, 0, {
      width: page.widthMm,
      height: page.heightMm,
      style: { fill: WHITE, stroke: FIXED_BORDER, strokeWidth: round2(1.2 * PT), opacity: 1 },
    }),
    rectBox([235, 0, 955, 58], FIXED_BLUE, origin),
    textBox([250, 6, 880, 52], {
      origin,
      binding: "title",
      content: "FIXED",
      style: {
        fill: WHITE,
        fontFamily: ARTIFAKT_BLACK,
        fontSizeMm: fontMm(42),
        fontWeight: "bold",
        align: "center",
        verticalAlign: "middle",
      },
    }),
    imageBox([890, 14, 930, 46], {
      origin,
      binding: "arrow",
      content: "UP",
      transform: "arrow",
      imageDataUrl: "/templates/ga/arrows/UP-white.png",
    }),
    ...refRow(
      [
        [265, 58, 385, 175],
        [393, 58, 580, 175],
        [588, 58, 785, 175],
        [793, 58, 925, 175],
      ],
      "reference",
      125,
      "73 579 863 30",
      origin,
      { fontFamily: ARTIFAKT_BLACK, ink: INK, red: FIXED_RED },
    ),
    textBox([250, 168, 940, 184], {
      origin,
      binding: "position",
      content: "RHB1A.001.003",
      style: {
        fill: POS_GRAY,
        fontFamily: ARTIFAKT,
        fontWeight: "normal",
        align: "center",
        verticalAlign: "middle",
      },
    }),
  ];
  const columns = [
    col("reference", "Part Number", ["reference", "Part Number", "PN", "part_number"], "7357986330"),
    col("position", "Assigned Location", ["position", "Assigned Location", "Location", "MAP SIMPLE", "address"], "RHB1A.001.003"),
    col("title", "Header text", ["title", "Title", "HEADER", "Header"], "FIXED", false),
    col("arrow", "Arrow", ["arrow", "Arrow", "ARROW"], "UP", false, { values: ["UP", "DOWN"] }),
  ];
  return finish(
    doc,
    a4 ? "fixed_ga_a4" : "fixed_ga_a3",
    a4
      ? "FIXED sticker (254 × 72 mm). Generate packs 2 per A4 landscape."
      : "FIXED sticker (254 × 72 mm). Generate packs 3 per A3 landscape.",
    columns,
    a4
      ? { pageSize: "A4-landscape", columns: 1, rows: 2, gapMm: 0, marginMm: 4 }
      : { pageSize: "A3-landscape", columns: 1, rows: 3, gapMm: 0, marginMm: 4 },
  );
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "warehouse_a3",
    name: "Warehouse A3",
    group: "Warehouse",
    description: "A3 warehouse sticker (reference, magacin, barcode).",
    build: warehouse,
  },
  {
    id: "cdc_a3",
    name: "CDC A3",
    group: "Warehouse",
    description: "CDC building header + warehouse address + barcode.",
    build: cdc,
  },
  {
    id: "simple_ovs_a3",
    name: "OVS A3",
    group: "OVS",
    description: "Product code with red middle group.",
    build: () => ovs(false),
  },
  {
    id: "simple_ovs_a3_dual",
    name: "OVS A3 dual",
    group: "OVS",
    description: "Two OVS labels per A3 page.",
    build: () => ovs(true),
  },
  {
    id: "hbc_a4",
    name: "HBC A4 shelf",
    group: "HBC",
    description: "Shelf name + five drawing-number rows.",
    build: hbc,
  },
  {
    id: "canopy_a3_1pn",
    name: "Canopy A3 — 1 PN",
    group: "Canopy",
    description: "One part number per position.",
    build: canopy1,
  },
  {
    id: "canopy_a3_2pn",
    name: "Canopy A3 — 2 PN",
    group: "Canopy",
    description: "Two part numbers + quantities.",
    build: canopy2,
  },
  {
    id: "canopy_a3_3pn",
    name: "Canopy A3 — 3 PN",
    group: "Canopy",
    description: "Three part numbers + quantities.",
    build: canopy3,
  },
  {
    id: "slozivost_a4",
    name: "Složivost A4",
    group: "Canopy",
    description: "Two stackability labels per A4.",
    build: slozivost,
  },
  {
    id: "ga_warehouse_a3",
    name: "GA warehouse A3",
    group: "GA",
    description: "One MAGACIN / REGAL / NIVO sticker. Generate packs three per A3 landscape.",
    build: gaWarehouse,
  },
  {
    id: "ga_warehouse_a3_dual",
    name: "GA warehouse A3 dual",
    group: "GA",
    description: "Dual sticker (002↑ / 001↓). Generate packs two per A3 landscape.",
    build: gaDual,
  },
  {
    id: "fixed_ga_a3",
    name: "FIXED GA A3",
    group: "GA",
    description: "FIXED sticker. Generate packs three per A3 landscape.",
    build: fixedGa.bind(null, false),
  },
  {
    id: "fixed_ga_a4",
    name: "FIXED GA A4",
    group: "GA",
    description: "Same FIXED sticker. Generate packs two per A4 landscape.",
    build: fixedGa.bind(null, true),
  },
  {
    id: "sample_shipping",
    name: "Sample shipping",
    group: "Starter",
    description: "Small 100×50 mm shipping label.",
    build: createSampleShipping,
  },
];

export function buildCatalogDocument(id: string): LabelDocument {
  const entry = CATALOG.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown starter template: ${id}`);
  const doc = entry.build();
  doc.updatedAt = new Date().toISOString();
  return doc;
}
