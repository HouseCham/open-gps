# LilyGo T-SIM7080G-S3 — 3D Modeling Reference

Dimensions, clearances, and design notes for modeling enclosures around the
LilyGo T-SIM7080G-S3 board. All measurements in millimeters. Board-local
coordinates have the origin at the PCB's bottom-left corner (X = antenna
connector edge, Y = mounting-hole corner), viewed from the top.

Verified against the official `T-SIM7080G-S3-Standard.step` model, not
estimates.

---

## 1. Bare Board Dimensions

| Property | Value |
|---|---|
| PCB length × width | 110.54 × 33.07 |
| PCB thickness | 1.6 |
| Total stack height (PCB + 18650 holder) | 15.0 below PCB bottom |
| Mounting hole diameter | 2.6 (M2 clearance) |
| Mounting hole pattern | 2.6 from each edge (2.6, 2.7), (30.3, 108.2) — 27.7 × 105.5 spacing |

Mounting hole centers (board-local):

```
(2.6, 108.2)                         (30.3, 108.2)
(2.6, 2.7)                           (30.3, 2.7)
```

## 2. Connectors and Cutouts

| Feature | Edge | Board-local Y center / range | Notes |
|---|---|---|---|
| USB-C #1 | +X (right) | 46.62 | Data / power |
| USB-C #2 | +X (right) | 58.3 | Second port, spacing 11.68 |
| Slide switch | −X (left) | 54.66 – 63.66 (9.0 travel) | Power |
| SIM7080G modem | on-board | — | Heat source, keep some airflow |
| GPS antenna u.FL | on-board | near Y ≈ 2 | Pigtails to external patch |

Cutout sizing used in this enclosure (includes FDM tolerance):

| Slot | Size (X × Y × Z) | Position (case coords) |
|---|---|---|
| USB-C ×2 | 4.0 × 9.5 × 4.7 | X = 37, Y = 45.6 / 57.28, Z = 19.5 |
| Slide switch | 3.5 × 10.8 × 5.5 | X = −1, Y = 57.5, Z = 19.0 |

**Rule of thumb:** the USB-C *receptacle* is ~9.0 wide, but the plug body and
cable overmold are wider — open the slot to the full plug width if you need to
seat the cable fully, or keep it narrow for a dust barrier and accept partial
insertion.

## 3. Battery

- Cell: single 18650 in a holder, **15.0 mm below the PCB bottom**.
- Reserve extra clearance under the holder for wires and the balance leads —
  ~2 mm is usually enough.
- Do not compress the cell; leave the spring end with headroom for insertion.

## 4. Mounting Interface (as modeled)

| Feature | Value |
|---|---|
| Boss diameter | 4.8 |
| Boss height | from floor (z = 2) to PCB bottom (z = 17.5) |
| Pilot hole | Ø2.1 (self-tapping for M2) |
| Screw | M2 × 25–28 through PCB (2.6 hole) into boss |
| Boss centers (case coords) | (6.07, 6.43), (33.77, 6.43), (6.07, 111.93), (33.77, 111.93) |

Pilot Ø2.1 gives a solid bite in PETG. If you print in PLA, consider Ø2.0 or
a heat-set M2 insert instead — PLA bosses crack under repeated assembly.

## 5. Enclosure as Modeled (reference geometry)

| Property | Value |
|---|---|
| Exterior | 40 × 118 |
| Base height (floor to seam) | 33.0 (2 mm floor) |
| Lid plate | 2.4 (z = 33.0 – 35.4) |
| Total height | 35.4 |
| Wall thickness | 2.0 (uniform) |
| Corner radius (vertical, both parts) | 6.0 — matches across the seam |
| Lid top-edge radius | 1.0 |
| Seam | flat, flush both parts (no groove) |
| Antenna well (lid) | 30 × 30 outer, 26 × 26 pocket, 10.5 deep |
| Lid screw holes | Ø2.2 at the four boss positions |

Internal cavity: 36 × 114 × 31. Board placement: origin (3.47, 3.73), PCB
bottom at z = 17.5 — the board sits on the 15 mm battery stack plus a 2.5 mm
gap.

## 6. GPS Antenna (XY07 patch)

- Patch: 25 × 25 × 4 with integrated LNA; coax ~58 mm.
- Sits in the lid well, directly over the SIM7080G u.FL.
- **Radome:** 2.4 mm PETG wall + 2 mm foam spacer between patch and radome +
  copper tape 50 × 50 ground plane.
- **Keep-out rules:**
  - No carbon-fiber or metal-filled filament anywhere near the antenna — it
    detunes the patch and kills GNSS reception.
  - No paint, thick primer, or carbon-loaded filament in the radome zone.
  - Foam spacer matters: the patch was characterized at a specific standoff;
    mounting it flush against the lid changes the tuning.

## 7. Modeling Pitfalls (learned the hard way)

- **Fillet before boolean.** Fillets on a boolean compound fail
  (`BRep_API: command not done`). Fillet the clean primitives, then cut/fuse.
- **Edge index bases differ.** FreeCAD GUI edges are 1-based; the scripting
  API here is 0-based over `Shape.Edges`. Index drift after every fillet —
  re-inspect instead of reusing old indices.
- **Degenerate rim bands.** A plate thinner than `r_top + r_bottom` cannot
  take rim fillets on both faces — hence the 2.4 mm lid (1 + 1 leaves 0.4).
- **Cylinder vs box origins.** `Part::Box` anchors at its min corner;
  `Part::Cylinder` is centered on its axis. Mixing them silently shifts holes.
- **Bbox lies on fillets.** OCC reports a conservative bbox on toroidal faces
  (~+0.5). Verify with vertices or the exported mesh, not the bbox.

## 8. Print Suggestions

- **Material:** PETG (or ABS/ASA if the enclosure will sit in a car). PLA
  softens around the modem and in sunlight.
- **Orientation:** base printed floor-down (open side up), lid printed
  plate-down. Both need no supports with sane bridging settings.
- **Walls:** 3 perimeters minimum — the M2 bosses and slot edges live in the
  wall.
- **Tolerance:** 0.3–0.5 clearance on connector slots; 0.2 press-fit on the
  seam lip if you add one. FDM holes print undersize — drill or ream the
  Ø2.1 pilots if screws bite too hard.
- **Seam:** the lid seats flush on the 2 mm wall top; there is no snap or lip.
  If you want alignment without screws, add a 1 mm lip later — it was left
  out on purpose to keep the joint line flat.
- **Do not** print anything in conductive filament within ~15 mm of the
  antenna well.

## 9. Source Files

| File | Purpose |
|---|---|
| `iot/lilygo-case.FCStd` | Parametric source (FreeCAD), 2 objects: `case_base`, `case_lid` |
| `iot/lilygo-case-base.stl` | Print-ready base |
| `iot/lilygo-case-lid.stl` | Print-ready lid |
| `T-SIM7080G-S3-Standard.step` | Official LilyGo mechanical model (external) |

When changing dimensions, edit in FreeCAD, re-export both STLs, and re-verify
the seam: both parts must carry vertices at `x = 0, z = 33.0` (flush walls).
