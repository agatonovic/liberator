# Canopy A3 — 1 PN portable renderer validation

Live document `14057388-ae40-4251-a03d-d9cb77a5d0e4`, name `Canopy A3 — 1 PN`, catalogId `null`, catalogRevision `null`, folder `655d6e1b-31bb-4d5e-ae3d-0ca99fbdead6`. Page 420×297 mm. Sheet null. 1-up. Six elements. No assets. No rotations.

| Element | Notes |
| --- | --- |
| `position` | Open Sans normal 50 mm, center/middle, letter spacing 1 mm |
| MAGACIN | Unbound Inter bold 5.48 mm, `#929292`. Static content |
| Barcode | Code128, binding `barcode`, fallback `position`, transform `barcode_pct`, displayValue false, about 412×86 mm |
| Two frames | Transparent fill, `#929292` stroke 1.5 mm. One has `cornerRadiusMm: 0` (no rounding) |
| `ref1` | Already bound, transform `part_number`, Open Sans bold, letter spacing −1.4 mm, grouped spans (size + red fill) |

Columns already match the 1 PN schema (`position`, `ref1`, `barcode`), so Canopy schema repair is a no-op. `part_number` is already set. Export still packages a repaired clone. Python does not re-run repair.

Fonts drawn: Open Sans 400, Open Sans 700, Inter 700. Same packaged WOFF bytes as Canopy A3 — 3 PN. No new font or renderer path.
