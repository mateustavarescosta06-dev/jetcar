# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| jetcar-v5 (built before the skill, registered as existing) | Filmic one-shot | Fixed bar with links, sound, Agendar and a progress hairline | Full-screen AI film scrubbed by scroll, 2.5D depth warp, the film shown inside the JETCAR letters | 10 chapters on one 30.3-screen track, one continuous camera | Map route inside the film, then a booking form | Camera flies through the leg of the A in the logo | Dark detailing garage, graphite 911 | :3000 (prod v3, preview v5) |
| jetcar-v6 | Service bays (new: a workshop corridor visited bay by bay, each bay its own medium and control, entered and left through light) | Light-trace lane: the five bays as clickable stops that light up as you pass | Still photo split into real planes (clean plate projected on proxy geometry, cut-out car, wordmark behind the car, near pillar), a light bar sweeps and reveals the car | Hero + 5 bays of different media (scrub-then-freeze video, 3D paint, 3D exploded view + photo film wipe, two-plane photo with hotspots, SVG map), ~15 pinned screens, peak in bay 3+4, flow sections between | Full-bleed result photo, then the visitor writes their own work order, then the light becomes the route carrying the order | JETCAR Light Trace: one white line that changes job in every bay (reveal, inspection light, layer separator, film edge, glass wipe, nav, route) | Dark detailing garage, graphite 911 (same world as v5) | :3100 |

v6 against v5: differs on grammar, nav, hero, sequence and signature (5 of 6); shares the close
ingredients (route + form), in a different order and role.

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- **Filmic one-shot** with a logo fly-through (jetcar-v5).
- **Service bays** grammar, the **light-trace lane** nav and the **Light Trace** signature (jetcar-v6).
- **Route + order form close** (both JETCAR builds): a third build should close differently.
- **Hero as a split still photo with a revealing light sweep** (jetcar-v6).

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
