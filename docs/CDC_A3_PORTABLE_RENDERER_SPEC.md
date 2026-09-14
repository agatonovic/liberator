# CDC A3 portable renderer validation

Live document `3085002f-b6ce-4feb-bfb5-62f111cd9645`, name `CDC A3`, catalogId `cdc_a3`, catalogRevision `null`, folder `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6`. Page 420×297 mm. Sheet null. 1-up. Seven elements. No assets. No rotations. No spans.

| Element | Notes |
| --- | --- |
| Two navy rects | `#1F295C`, same box, fill only |
| `building_name` text | Artifakt Element Black bold 70 mm, white, center/middle |
| Hidden `warehouse_code` text | Artifakt Element Black normal 50.4 mm. Skipped at print |
| Visible `warehouse_code` text | Open Sans bold 50 mm, `#221F1F`, center/middle, letter spacing 0 |
| Barcode | Code128, binding `barcode`, fallback `warehouse_code`, transform `barcode_pct`, displayValue false, about 408×105 mm |
| Frame | Transparent fill, white stroke 6 mm |

`barcode_pct` is the existing suffix rule. Designed barcode content `CDCNN.01.003` does not include `%`. Columns: `building_name`, `warehouse_code`, `barcode`.

Print-time repair does not rebind this template. Export still packages a repaired clone so the renderer does not run LABELATOR repair. Hidden elements stay in the package and are skipped when `hidden` is set.

Fonts the exporter must include because they appear on text elements, including the hidden one: Artifakt Element Black 400 and 700 (same OTF bytes LABELATOR uses for both weights), Open Sans 700.
