# JETCAR v6 — design references (researched 2026-10-02)

Base path for evidence: `/tmp/claude-0/-home-user-jetcar/30b999e8-6c14-5a1a-9a64-2d82d6582b57/scratchpad/v6/refs/` (abbreviated `refs/`).

## How these were checked

- **LOADED** means I opened the live page in Playwright/Chromium (SwiftShader WebGL, 1440×900, DPR 1) through the agent proxy. I took screenshots at fixed scroll offsets given in viewport heights (vh, 1vh = 900px) and dumped DOM facts: total page height, sticky and fixed elements, canvas and video count, and the scroll position of each H1/H2.
  - Screenshots: `refs/shots/<slug>/NN.png`. Contact sheets: `refs/shots/<slug>-sheetN.png`. DOM logs: `refs/logs/logs-*.txt`.
  - Capture script: `refs/tools/cap.cjs <slug> <url> <steps> <stepVh>`, with the env var `START=<vh>` for the start offset. Contact sheets: `refs/tools/sheet.py`.
- **DOC** means I worked from text only: WebFetch or search results, with no rendering.
- **Limits:**
  - This Chromium has no H.264 decoder. MP4 hero videos therefore show black or the poster (Lamborghini, Polestar). WebM plays (McLaren).
  - SwiftShader is slow. Heavy WebGL pages (iyO, Lando Norris) only rendered a few frames. Fluidity was not measured anywhere.
  - Scroll offsets are as measured. Sites change, and copy and offsets can drift.

## Index: reference → JETCAR beat → device family

| # | Reference | Status | Main JETCAR use | Device family |
|---|---|---|---|---|
| R1 | Porsche 911 Turbo S model page | LOADED | Hero (type between planes); spec block | photographic + HTML type layering |
| R2 | Porsche Car Configurator | LOADED | Configurator (car → o que melhorar → agendar) | sticky viewer + scrolling option column |
| R3 | McLaren W1 | LOADED | Polimento (pointer paint reveal), focus-window card, chapter nav | canvas brush reveal; theme flip; bottom anchor nav |
| R4 | Ferrari F80 | LOADED | Exterior→interior (top-down x-ray), callouts, anti-pattern long orbit | scroll reel; non-pinned x-ray image with leader callouts |
| R5 | Lamborghini Temerario | LOADED (hero MP4 not decoded) | Service card anatomy, spec numerals, "+" explore affordance | horizontal feature cards |
| R6 | Polestar 5 overview + interior | LOADED | Hairline frame = light line drawing card borders; sticky index nav; editorial split cards | sticky hairline frame; numeral mask; sticky side index |
| R7 | Lucid Air | LOADED | Map route styling; line-drawing spec; sticky CTA pair | static route map; line drawings |
| R8 | Apple AirPods Pro 3 | LOADED | Ceramic/clearcoat "see-through" step; pinned object + alternating copy | pinned object, opaque → x-ray crossfade |
| R9 | iyO One exploded view (Awwwards) | PARTIAL LOAD + DOC | Ceramic exploded view (what to improve on) | WebGL scroll explode |
| R10 | STEK DYNOshield + datasheet | LOADED + DOC | PPF layer content; coverage callouts; a callout mistake to avoid | photo callouts |
| R11 | XPEL Ultimate Plus | LOADED + DOC | PPF: how to make a clear film visible | photography (wet install) |
| R12 | Ceramic Pro ION + Gtechniq Crystal Serum Ultra | DOC (Gtechniq is behind Cloudflare 403) | Ceramic layer copy: base coat + top coat | static diagrams (theirs) |
| R13 | Card stacking: Olivier Larose "Cards Parallax" + NAYA Studio (Awwwards) | DOC | The single card-stacking moment | sticky stack + scale |
| R14 | S-2K (Awwwards SOTD, 6 Sep 2025) | LOADED (first 7vh) | Chapter index, column-wipe transition; video+text anti-pattern | wipes, gauge progress |

Anti-references, including Lando Norris (Awwwards Site of the Year 2025) and Aceternity Compare (21st.dev), are at the end.

---

## R1. Porsche 911 Turbo S model page — LOADED

- **URL:** https://www.porsche.com/usa/models/911/911-turbo-models/911-turbo-s/
- **Page size:** 17.1vh, 1 canvas, sticky model-select menus.
- **Evidence:** `shots/porsche-turbo-s/00-11.png`, `shots/porsche-hero-fine/00-06.png` (0→1.2vh in 0.2 steps), `shots/porsche-grow/00-08.png` (4.4→6.0vh).

**Observed**
- **0vh.** Full-bleed photo: rear of the 911 inside a desert pavilion. Warm architecture frames the car, and its reflection sits on wet stone. HTML headline "One of a kind." (≈44px light weight) plus a 3-line paragraph, centred, bottom third, over a dark gradient.
- **0.2–0.4vh.** Photo and copy scroll up together, with no pin.
- **0.6–1.0vh.** A black model header rises in.
  - A giant "turbo S" script in dark grey (≈ #3a3a3a, ≈770px wide) sits behind a side-profile cut-out of the car (≈900px wide). The roof hides the "rbo" letters.
  - A horizon split at y≈485 (gradient wall over a black floor) gives a ground plane.
  - Below: a variant segmented control (Coupe / Cabriolet / Targa / GT / Turbo Coupe…), "911 Turbo S", price, and 4 CTAs (Change model variant / Build Your Porsche / Inventory / Test drive).
  - Measured: the script and the car move at exactly the same rate (≈70 thumbnail-px per 0.2vh in both). The occlusion is baked into one plane.
- **2vh.** Spec block. The numbers count up (they rendered blank in the capture) beside a rear 3/4 cut-out.
- **4–6vh.** A rounded-corner inset photo (≈1160px wide) under "Inner strength. External elegance." scrolls normally. I checked whether it grows into a full-bleed image: it does not (same width at 4.4, 4.8 and 5.2vh). The next full-bleed photo follows with an overlaid caption ("Moves you forward…").
- **7vh.** A horizontal card carousel ("The Twin eTurbo engine.", "Enhanced performance.", each with "Show more").
- **8vh.** A "Hold for sound" button on a photo.

**Why it works.** The first viewport is a finished photograph before any scroll happens. The car-over-type header makes the model name and the car one composition, and the type stays readable because only the middle letters are hidden.

**Principle for JETCAR.** The hero must be a complete still composition at 0vh. Headline in HTML. The car hides part of the type, but the headline stays readable.

**Borrow**
- The "car hides the middle of a word, never its first or last letter" rule.
- Horizon split / ground plane under the car.
- Price and CTA hierarchy under the model name. For JETCAR: service name + "Explorar" / "Agendar".
- "Hold for sound" as an opt-in, press-and-hold affordance. It fits JETCAR's optional sound better than a toggle.

**Do not copy**
- The single-plane occlusion. Porsche's type and car move together, so it reads as a flat graphic. JETCAR must give the type and the car cut-out different scroll and pointer rates. That is the user's complaint #3.
- The rounded 12px cards and the grey pill buttons. They read as a generic OEM template and clash with JETCAR's square editorial cards and slanted buttons.

---

## R2. Porsche Car Configurator — LOADED

- **URL:** https://configurator.porsche.com/en-US/mode/model/Y1AAI1 (Taycan; the same UI covers 911)
- **Evidence:** `shots/porsche-config/00-02.png`, `logs/logs-pconf.txt`.

**Observed**
- **Layout.** Left about 66%: a large photoreal viewer, sticky for the whole option column (sticky parent ≈7.1vh). Under it:
  - a thumbnail strip with 9 views (exterior angles, wheel close-up, interior);
  - viewer controls: "Adjust scene", "Compare", "360° View", fullscreen.
- **Right column.** It scrolls through H2 categories in order: Exterior Colors (0.4vh) → Wheels (1.8) → Interior Colors & Material (2.9) → Seats (3.8) → Packages (4.8) → Exterior / Interior / Technology / Accessories → Delivery Experience (6.6) → Summary (7.2).
- **Colours.** Grouped by price tier with the price in the group header: Contrasts $0, Shades $840, Dreams $1,500, Legends $3,000, then Paint to Sample $13,870 / $31,670.
- **Top bar.** Running price ($114,250), "Summary", and a black "Select a dealer" button.
- **Viewer follows scroll.** When the Wheels section scrolls into focus (1.8–2.0vh), the viewer switches to the wheel close-up and the strip marks that thumbnail as active. I verified this in frames 01→02.

**Why it works.** Every choice shows at once on the car. The viewer always shows the part you are deciding about, so there is never a blind choice. The running total and the next action are always visible.

**Principle for JETCAR.** The configurator is a two-column sticky composition. The visual shows the part being decided:
- choosing "Pintura com marcas" shows the paint macro;
- choosing "Interior" shows the cabin;
- choosing "Proteção" shows the PPF edge.
The step state (Carro → O que melhorar → Mensagem → Direct) stays visible like Porsche's Summary bar.

**Borrow**
- A sticky visual tied to the active step.
- Options grouped under one-line group headers.
- A persistent summary line ("Seu pedido: Polimento + Ceramic") with a single primary action (Direct).

**Do not copy**
- Prices. JETCAR has none and must not invent them.
- The 360° view (360° car spin is banned).
- The thumbnail-strip density.
- The rounded white option cards.

---

## R3. McLaren W1 — LOADED (best overall match)

- **URL:** https://www.mclaren.com/cars/gl_en/W1. cars.mclaren.com/en/W1 now 301-redirects here. The old URL only showed a loader in headless mode.
- **Evidence:**
  - `shots/mclaren-w1c/00-15.png` (1vh steps)
  - `shots/mclaren-paint/02-11.png` (6.6→8.4vh, 0.2 steps)
  - `shots/mclaren-hover3/h00-h04.png` (pointer test at 8.3vh)
  - `refs/logs/logs-mclaren3.txt`
- **Videos:** all WebM (`mclaren-w1-hero-desktop.webm`, `-epic-`, `-performs-`, `-authentic-`, `detail-forwards-overview2doors`), so they decode where H.264 does not.
- **Sticky elements:** `paint-reveal-wrapper sticky` (parent 1.64vh), `theme-mist sticky` (2.0vh), and a fixed bottom anchor bar (`n001-anchor-links theme-carbon`).

**Observed**
- **0vh: intro film with a "SKIP INTRO →" button.**
  - A black frame where only rim light on the shoulder and the red tail-light line reveal the car.
  - Interior textile macros follow.
  - It resolves to a side profile in a dark studio, with a floor reflection, "McLAREN W1" at bottom-left (≈13px caps), and "W1 STORIES" (grey) and "ENQUIRE" (white) at bottom-right.
- **"Dramatic design" panel.** Light background with a studio still, and a pager below ("← GROUND EFFECT | ANHEDRAL DOORS →").
- **Specifications, about 3.7vh.**
  - A blurred full-bleed rear-view photo, with a sharp rectangular window of the same photo (≈755×280px at x 335–1090, y 270–550). It works as a focus window: depth of field acting as a card.
  - "350 km/h TOP SPEED · 1340 nm TORQUE · 1275 ps POWER" in a wide light sans, plus "SEE FULL SPECIFICATIONS +".
- **Performance.** A square-cornered white floating card at bottom-right: "W1 PERFORMANCE CAPABILITIES / Performance pushed to extremes / READ MORE >".
- **6.6→6.8vh: theme flip.** The whole dark section fades to a light "mist" grey (#e0dfdc-ish).
- **7.0→7.4vh: text fill.** "399 W1s will be built. No two will be the same…" fills word by word from grey to black as you scroll.
- **7.6→8.0vh.** The car (Papaya Orange) rises from below onto a white tiled studio floor.
- **8.0vh+: "ROLLOVER TO REVEAL".**
  - **Brush.** The car sits in a 1425×600 canvas inside `div.paint-reveal-wrapper` (role="button", tabindex="0", aria-label="Reveal MSO artwork", plus an sr-only aria-live description of the render). The cursor works as a large soft brush, about 200–250px radius, that permanently paints the orange livery away and reveals the MSO "Slipstream" livery (raw carbon grey + white) underneath.
  - **Card.** After about 3 passes most of the car is converted, and a card slides in at bottom-right: thumbnail + "MSO: SLIPSTREAM / Behind the inspiration / READ MORE >". There is also "START MSO ENQUIRY".
- **Later.** Evolution timeline (1992 F1, 2013 P1), stories carousel, Richard Mille cross-sell, "Other models" (750S).
- **Bottom anchor bar, always on.** Fixed, full-width, equal tabs (Overview | In Detail | Specifications | Performance | MSO | Lineage | Stories). The active tab has a grey fill, and a chevron pages through the tabs. Its theme flips with the section.

**Why it works**
- Each chapter uses a different device: film intro → static studio → focus window → text fill → pointer brush → timeline. The user switches between watching and exploring.
- The paint reveal is persistent (it accumulates), so it does not feel like a flashlight. It rewards completion with a card, and it is keyboard-accessible.

**Principle for JETCAR**
- **Polimento.** The pointer (or keyboard or scroll) carries the polishing pad. Corrected paint stays corrected, and the coverage reveals CARD 02.
- **Focus window.** A sharp rectangle over a blurred scene is a real depth-based card frame, and the light line can draw it.
- **Chapter nav.** A persistent, quiet bottom nav (01–05 + Agendar) that changes theme with the section.

**Borrow**
- The persistent brush reveal with a completion threshold that triggers a card. Also the a11y pattern: wrapper with role="button" and tabindex="0", an aria-label, an aria-live description, and a keyboard alternative (Enter/Space runs the full reveal).
- Theme flip dark → light for one chapter. It is a good cut for Ceramic or the result.
- Spec numerals with small units above.
- The skip-intro affordance if any opening film remains.

**Do not copy**
- McLaren's literal "ROLLOVER TO REVEAL" two-livery swap. JETCAR reveals defects being corrected (swirls → mirror), not a different paint.
- The 4+ video chapters in a row.
- The orange/Papaya palette.
- A brush radius so large the job finishes in 3 swipes. For JETCAR the pad should feel like work: about 120px radius, with a 70% coverage threshold before CARD 02.

---

## R4. Ferrari F80 — LOADED

- **URL:** https://www.ferrari.com/en-EN/auto/f80
- **Page size:** 19.1vh, 1 canvas, `ScrollReel` component, custom cursor `MainCursor`.
- **Evidence:** `shots/ferrari-f80/00-13.png`, `shots/ferrari-reel/00-08.png` (0.6→4.6vh, 0.5 steps), `shots/ferrari-xray/00-15.png` (7.7→10.7vh, 0.2 steps).

**Observed**
- **ScrollReel, about 1.1→4.6vh.** An image-sequence orbit in a dark blue studio with fog.
  - It starts front-on, with the two DRL light lines as the brightest marks in frame, and orbits to full side profile by about 3.6vh.
  - Light shafts cut the fog from top-left.
  - A pulsing chevron sits bottom-centre, and a vertical dot progress bar on the left.
- **6vh.** Light-grey editorial section. The headline fills word by word ("Ferrari F80: the new supercar from the Prancing…").
- **7.7→10.7vh: top-down x-ray, not pinned.**
  - A long top-view render scrolls through the viewport. The red body is semi-transparent over the zones of interest, and the internals are opaque.
  - Callouts are anchored to the parts and scroll with them:
    - right: "ACTIVE SUSPENSION SYSTEM / Millimetre-precise control in every condition";
    - left: "'1+' CAB CONFIGURATION / Centred completely around the driver";
    - right: "120° V6, MGU-K, MGU-H AND ELECTRIC FRONT AXLE".
  - Callout anatomy, measured in frame 09: caps title ≈15px, 2-line description ≈13px, then a 1px dark leader ≈510px long ending in a ≈4px square marker on the part.

**Why it works**
- The x-ray answers "what is inside" with no explosion gimmick: transparency only where the copy points.
- Callouts tied to geometry read as engineering drawings.
- The top view makes the car a readable plan.

**Principle for JETCAR**
- **Exterior → interior.** From the top view, the light line sweeps the roof (or windscreen) and makes it go transparent behind the line. The cabin is revealed from above. Then the camera stops and the interior hotspots take over (CARD 05).
- **Callouts.** Use Ferrari's exact anatomy: caps label, one line of copy, 1px leader, small square marker. JETCAR's red square already matches this.

**Borrow**
- Non-pinned scrolling for a long technical image, so it reads like a website and not a film.
- The callout anatomy, with left/right alternation.
- Light lines (DRLs) as the brightest elements in a dark frame.

**Do not copy**
- The ~3.5vh scroll-reel orbit. It is exactly the "scroll-controlled video" feeling the user rejected. A JETCAR scrub should be ≤1–1.5vh, then freeze.
- The blue-fog palette.
- The custom cursor.

---

## R5. Lamborghini Temerario — LOADED (hero MP4 not decoded: black box)

- **URL:** https://www.lamborghini.com/en-en/models/temerario
- **Page size:** 14.9vh. The hero video is `…LB634_VideoHeader_v1-1-0_4k_lamborghini.mp4`.
- **Evidence:** `shots/lambo-temerario/00-13.png`, `shots/lambo-sheet.png`.

**Observed**
- **0vh.** Black hero (the video did not decode). Small caps "YOU CAN'T HIDE WHO YOU ARE", a condensed bold "TEMERARIO" (≈80px cap height) at bottom-left, and two square-cornered buttons at bottom-right: "START CONFIGURATION" (white) and "ENQUIRE" (outline).
- **1vh.** Spec trio in very tall condensed numerals: "677 kW · 343 km/h · 2.7 s", each with a grey label underneath.
- **3–9vh chapters.** A centred caps H2 with one sentence, then a horizontal row of feature cards (POWERTRAIN, LDVI 2.0, SPACEFRAME, ENGINE SOUND / FRONT, WING… / EXPOSED ENGINE, REAR… / ENGINE BONNET, ROCKER COVER, CARBON RIM…).
  - Each card: black panel, about 708×400px, caps title top-left, isolated render, and a **hexagonal "+" button** at bottom-right (the brand shape).
  - Carousels have dash progress plus a pause button.
- **Also:** full-bleed interior photo, design-sketch section on green, specifications table with "ALL SPECIFICATION +", and "DISCOVER MORE" with the CTAs again.
- I did not verify what "+" opens: the click test hit a client-side app error in headless mode.

**Why it works**
- Each feature is one object, one name and one action, so it scans like a parts catalogue.
- The "+" button carries the brand geometry (hexagon), so even the affordance is branded.

**Principle for JETCAR.** Service card anatomy is number + condensed name + one line + one action. The affordance takes JETCAR's own shape: the slanted parallelogram is JETCAR's hexagon. Example: "01 / LAVAGEM / TÉCNICA / O primeiro toque. / EXPLORAR →" with a parallelogram "+".

**Borrow**
- The spec-numeral trio style. Use it only with real figures, such as the paint-layer micron ranges in R12.
- One centred chapter title + one line.
- The brand-shaped "+".

**Do not copy**
- Horizontal card carousels with 4+ cards. They become "a grid of five services" in disguise.
- A video-only hero with no poster (black when the codec fails).
- The fixed consumption-disclaimer bar.

---

## R6. Polestar 5 overview + interior — LOADED

- **URLs:**
  - Overview: https://www.polestar.com/global/polestar-5/ (26.2vh, 4 canvases, 15 sticky containers)
  - Interior: https://www.polestar.com/global/polestar-5/interior/ (9.9vh)
- **Evidence:**
  - `shots/polestar5-fine-a/00-08.png` (0→1.6vh, 0.2 steps)
  - `shots/polestar5/00-13.png` (1vh steps)
  - `shots/polestar5-b/00-03.png` (11–14vh)
  - `shots/polestar5-int/00-11.png`

**Observed (overview)**
- **0vh: the hero is a giant numeral used as a mask.**
  - A "5" about 410×630px on flat dark grey (#2b2b2b), with the car footage visible only through the glyph.
  - It scales about 1.3× at 0.4vh, about 2.5× at 0.6vh and about 5× at 0.8vh, and is fully full-bleed at 1.0vh.
  - The footage leaves at 1.4vh. The video is `…overview-hero-scroll-d-2.mp4`, a scroll-linked clip.
- **1.4–1.6vh.** Plain HTML headline on grey. "Polestar 5. The pure performance GT." is white, and the second sentence fills grey→white with scroll.
- **3.0–5.5vh: a 1px white hairline frame stays sticky** (x 145→1103px, about 958px wide; bottom edge at y≈667) while the content inside it changes:
  - 3.0vh: the box holds three short text columns ("Designed and engineered in-house…").
  - 4.0vh: only the two vertical lines remain while a top-down render of the car crosses them diagonally.
  - 5.0vh: the box closes again around the car, now rotated to a top view, with "Polestar 5" ≈110px and a 4-line description inside it. The car body extends beyond the frame on the right.
- **Also:**
  - Spec block: name + "Range up to 678 km · 0-100 3.2 s · Power up to 650 kW" under a 1px rule.
  - "Choose a colour" list (Storm Matte, Magnesium Matte, Snow, Space, Storm, Magnesium) beside a side profile.
  - Rear light-bar macro.
  - "Performance Architecture": white studio, bonded aluminium body-in-white, top view then side view with a floating shadow.

**Observed (interior)**
- **Sticky left index.** Interior, Upholstery, Deco, Panoramic glass roof, Seating, Rear comfort, Cabin comfort, Interior lighting, Storage. The active item has a **1px vertical black marker** that moves down as you scroll.
- **Main column.** Section title + paragraph + editorial split cards: photo left, white text panel right with title ("Bridge of Weir leather", "Black ash deco", "Rear centre console", "Active Road Noise Cancellation") and a small "Available as an upgrade."
  - Square corners, no shadow, grey page background, small arrows below.
  - The first section has 4 round material swatches.

**Why it works**
- The hairline frame is a layout device that the car is allowed to break, which creates depth through overlap, not transforms.
- The index marker is one quiet line that is both navigation and progress.
- The split cards look like a print catalogue.

**Principle for JETCAR (this is the LIGHT TRACE as a layout tool)**
- After the reveal, the light line draws the 1px frame of a service card. The car or the foreground (water, the pad) is allowed to cross that frame.
- In the interior and services sections, the light line collapses into a vertical index marker (01–05) and becomes the navigation.

**Borrow**
- A sticky hairline frame persisting about 2–3vh while its content changes.
- An object breaking the frame.
- The sticky vertical index with a moving 1px marker.
- Square split cards: image | white or black panel with a condensed title, one line and a slanted "Explorar →".

**Do not copy**
- The numeral-mask hero. JETCAR v5 already did "film inside the JETCAR letters". Repeating a type-mask that expands into video is the "Reel / scroll-video" opening the user wants to leave.
- The grey Swedish neutral palette and the light Inter-style typography.

---

## R7. Lucid Air — LOADED

- **URL:** https://lucidmotors.com/air (20.6vh)
- **Evidence:** `shots/lucid-air/00-15.png`, `shots/lucid-map/00-06.png` (7.9→9.1vh, 0.2 steps).

**Observed**
- **0vh.** Lifestyle photo hero with a serif headline. Spec row at 1vh (512 mi / 12 mins / 1,234 hp / 1.89 secs), small caps labels, thin rules.
- **A pair of CTAs is always docked at bottom-centre.** "VIEW INVENTORY" is white-filled, and "BUILD & ORDER" is an outline in a fixed bar.
- **8vh: "Go the distance on a single charge."** A dark map:
  - land #3a3a3a, ocean pure black, roads in faint grey;
  - a **2px white route** from SAN FRANCISCO to LOS ANGELES, with round white end-dots;
  - **square light-grey tags with letter-spaced caps** for the city names.
  - It scrolls normally. In my capture the route was already drawn and did not animate.
- **12.8vh, safety.** A semi-transparent car with sensor cones and amber rings.
- **15vh, specs.** Thin line drawings (front and side) with numbered gold circular markers for Height / Width / Length / Wheelbase.
- **Interior.** Full photo + 1/4 pager carousel ("Legroom to stretch"). No hotspots.

**Why it works**
- The map is reduced to land, water and one luminous line.
- The labels are typographic tags, not pins.
- The always-visible CTA pair keeps it a commercial website, not an experience.

**Principle for JETCAR (end of the LIGHT TRACE)**
- The light line becomes the route: Avenida Boa Viagem → Rua José Trajano. Keep it to:
  - a dark land/water base;
  - 1–2px white route + a moving head;
  - one square tag "RUA JOSÉ TRAJANO · BOA VIAGEM" with no number or CEP (CLAUDE.md rule).
- Keep a docked primary action ("Agendar pelo Direct") visible during service chapters.

**Borrow**
- The map palette and the tag style.
- Numbered markers on line drawings. Useful for PPF coverage zones (1 Capô, 2 Para-choque, 3 Retrovisores…) without inventing data.

**Do not copy**
- The serif lifestyle tone.
- Carousels for the interior. JETCAR wants an interactive stop with hotspots.

---

## R8. Apple AirPods Pro 3 — LOADED

- **URL:** https://www.apple.com/airpods-pro/
- **Page size:** 32.1vh. Sticky `sticky-element` (2.5vh), `scrub-scroll-container`, image `audio_airpods_pro_guts`.
- **Evidence:** `shots/apple-airpods/00-23.png`, `shots/apple-xray/00-09.png` (7.6→8.95vh, 0.15 steps).

**Observed: "The sound of science" section**
- **7.6vh.** The pair of AirPods, opaque white, rotating.
- **7.9vh.** One bud settles in the centre and is pinned. A copy block fades in on the left (opacity ≈0.3 → 1 over ≈0.15vh).
- **8.05–8.35vh.** The bud stays fixed while the copy block slides across ("A new multiport acoustic architecture…").
- **8.35→8.65vh.** The shell crossfades from opaque to an **x-ray render** (translucent shell, black driver, H2 chip visible) in about 0.3vh, with no camera move.
- **8.8vh.** A second copy block ("A custom-built driver and amplifier…") fades in on the right.
- **Elsewhere.**
  - Stats with hairline rules: "Removes up to 2x more / 4x more".
  - "Take a closer look." module.
  - Horizontal feature cards with an arrow pager.
  - Plain HTML headlines centred above large media.

**Why it works**
- One pinned object and one change at a time: the shell becomes transparent, nothing else moves.
- The copy alternates sides, so the eye travels while the object stays still.
- It is short: about 1.3vh in total.

**Principle for JETCAR (Ceramic, before the exploded view)**
- Freeze the paint macro and let the light line cross it.
- Behind the line the surface turns "x-ray": clearcoat transparent, base colour and primer visible as depth. One change per beat.
- CARD 03 copy alternates sides.

**Borrow**
- Pin + single material change + alternating copy.
- Durations: ≈0.15vh copy fade, ≈0.3vh state change, ≈1.3vh total.

**Do not copy**
- White Apple product-page styling.
- Rainbow/iridescent sound rings.
- 30+vh page length with dozens of modules.

---

## R9. iyO One exploded view (Awwwards "Interactive WebGL Exploded View") — PARTIAL LOAD + DOC

- **URLs:**
  - Live: https://www.iyo.ai/iyo-one (14.7vh, 1 WebGL canvas)
  - Awwwards: https://www.awwwards.com/inspiration/interactive-webgl-exploded-view-iyo (by Matteo Donini / iyO; tags: WebGL, Exploded view, Scroll animation)
- **Evidence:** `shots/iyo-one3/00-04.png` (1.5→2.9vh, 0.35 steps, 1280×800). Each SwiftShader frame took about 1–2 minutes.

**Observed**
- **1.5vh.** Overview text with three rounded feature cards ("Supernatural audio / Superhuman hearing / Superintelligent agents").
- **1.85vh.** The assembled device rises with a tiny "DETAILS / iyO One" label at left.
- **2.2vh.** Large assembled close-up.
- **2.55vh.** Exploded along one axis into three parts with about 100px gaps:
  - "Audio computer disc" (black, gold contacts);
  - "Acoustic system" (transparent housing showing an orange PCB and a blue driver);
  - "Custom fit tip" (white).
  - Seen in 3/4 view over a dotted noise "topography" background.
- **2.9vh.** Already scrolling off into a lifestyle photo.
- The component names come from the page text (via WebFetch). No on-object labels were visible in my frames. The separation is purely scroll-driven: about 0.7vh from assembled to gone, with no pin and no user control.

**Why it works**
- A transparent housing on the middle part shows "inside" without more parts.
- The parts stay on one axis, so it reads as engineering, not chaos.

**Principle for JETCAR (Ceramic, real 3D)**
- One axis (along the surface normal), 5 slabs: coating, clearcoat/verniz, paint/base color, primer, substrate.
- The user controls the separation with drag, scroll or keyboard (range input). It must hold still when released.
- The thickness ratio is honest but readable. See R12 and the micron table there.
- Labels stay attached to each slab's edge (Ferrari callout anatomy).
- The clearcoat is the transparent slab, like iyO's acoustic housing.

**Borrow**
- The single-axis explode, the transparent middle slab, a dark background, and a tight gap rhythm.

**Do not copy**
- The ~0.7vh pass-by with no pin or control. The user explicitly wants to pull the layers apart themselves.
- The dotted-noise particle background (a "Three.js demo" look).
- The rounded glass feature cards and the pill navigation.

---

## R10. STEK DYNOshield + technical datasheet — LOADED + DOC

- **URLs:**
  - Page: https://www.stekautomotive.com/brands/dyno/clear/dynoshield (5.9vh)
  - Datasheet (via Spandex): https://api-shop.spandex.com/medias/DYNOshield-datasheet.pdf (long query string in the search result)
  - Top-coat explainer: https://www.stekautomotive.com/the-top-coating/
- **Evidence:** `shots/stek-dynoshield/00-05.png`.

**Observed**
- **0vh hero.** Dark garage photo of a grey Tesla, "DYNOshield" ≈64px with "Crafted to protect and perform", and a coverage map made of **1px white vertical leader lines from caps labels to panels**: ROCKER PANELS, MIRRORS, HOOD, BUMPER, REAR BUMPER TOP, HEADLIGHTS.
- **Measured label errors.** The "HEADLIGHTS" line ends on the tail-light, and the "ROCKER PANELS" line ends on the rear door glass. The callouts are wrong.
- **Then:**
  - "CUTTING EDGE PPF TECHNOLOGY" over a red car in the dark, with 4 icon tiles (Ultra Gloss Finish, Super Hydrophobic, Exceptional Durability, Self-Healing Properties);
  - "Gloss Defender / Aesthetic Shield" tabs with a red line marker;
  - "Built to last" with a 12-year warranty card, SGS certified, TDS download;
  - "Explore DYNO Films" card row.
- **Datasheet layer stack, top→bottom:** Cap sheet → Self-healing top coat (hydrophobic) → TPU → Pressure-sensitive adhesive → Release liner. Total thickness **200 ± 10 µm**. STEK says the top coat is infused into the TPU rather than sitting on top.

**Why it works.** Leader lines to named panels communicate coverage instantly, and the 5-layer stack is a credible, concrete vocabulary.

**Principle for JETCAR (PPF)**
- Coverage reads as named zones on the real car, with leader lines from the light line.
- The film itself has a clear, honest stack: topcoat / TPU / adhesive. The liner and cap sheet are removed during installation, which is a nice beat: the liner peels as the film goes on.

**Borrow**
- Panel-zone callouts. Verify every leader endpoint against the image: add a QA step that checks the marker pixel lies inside the named panel mask.
- The layer vocabulary for PPF copy: "camada superior autorregenerativa, TPU, adesivo".

**Do not copy**
- Icon tiles.
- Product-brand names or warranty years. JETCAR must not claim STEK/XPEL products or warranties without confirmation.
- The red-on-black "tuning shop" look.
- The mislabeled callouts.

---

## R11. XPEL Ultimate Plus — LOADED + DOC

- **URLs:**
  - Product: https://www.xpel.com/products/ultimate-plus (8.8vh)
  - Landing page: https://lp.xpel.com/discover-automotive-ppf
  - FAQ: https://www.xpel.com/faqs
- **Evidence:** `shots/xpel-up/00-08.png`.

**Observed**
- **Hero.** Split layout: about 63% photo, 37% black text panel. The photo is an installer's hand pushing a squeegee across clear film on a light-grey bumper next to the headlight.
  - The film is visible only through physics: trapped slip-solution droplets and blotchy specular patches where it is still wet, a crisp dry track behind the squeegee, and a faint lifted edge.
  - No tint at all.
- **Text panel.** Breadcrumb, "ULTIMATE PLUS™", rule, "The Pinnacle Of Protection", copy, and a yellow "FIND AN INSTALLER" button.
- **Below.**
  - Feature list with icons ("8 Mil Protection", "Self-Healing", "Invisible Shield").
  - Icon-trio band (Professional Installation / Warranty / Coverage Options).
  - Stealth matte block, video cards, articles, care-product cards, FAQ accordion.
- **Layer facts (DOC, XPEL dealers and FAQ):** self-healing clear-coat top layer about 13 µm (it does not heal if penetrated), then a polyurethane core, then an acrylic pressure-sensitive adhesive. Ultimate Plus is 8 mil (≈203 µm).

**Why it works.** The photograph proves a transparent product exists through water, edge and gloss change. That is exactly what the user asked for: "do not use a fictitious glossy blue film just to make it visible."

**Principle for JETCAR (PPF scene)**
- **Before:** wet, mottled specular. The film is shown by droplets under it.
- **The light line is the squeegee/edge:** a 1–2px bright specular line following the film's leading edge.
- **After:** a uniform deeper gloss.
- Use a horizontal mask/reveal driven by scroll or drag across the bonnet (the brief suggests mask/reveal horizontal for PPF). CARD 04 sits inside the scene.

**Borrow**
- The wet-mottle → dry-gloss read, the squeegee line as the reveal edge, and a split photo/black panel layout for CARD 04.

**Do not copy**
- Yellow CTAs, icon rows, product names and mil figures as JETCAR claims.
- Hands-on stock photography style, unless real JETCAR photos arrive.

---

## R12. Coating layer explanations: Ceramic Pro ION and Gtechniq Crystal Serum Ultra — DOC

- **Ceramic Pro ION:** https://ceramicpro.com/ion/ (WebFetch OK)
  - Two stages. **ION Base Coat** is the "first stage… solid primary layer… fills microscopic imperfections found in clear coats". **ION Top Coat** is the "second stage… helps activate the ION exchange reaction".
  - Mechanism: the "Top Coat replaces the smaller IONs in the base coat with larger IONs, reducing the free space between molecules."
  - Shown with static labelled diagrams and an "ION Exchange Graphic". No interaction.
- **Gtechniq Crystal Serum Ultra:** https://gtechniq.com/shop/auto/ceramic-coatings/crystal-serum-ultra/ (Cloudflare 403 to both WebFetch and Chromium; facts from search snippets of the official page)
  - Hard 10H top layer over a softer 7H base layer.
  - 7nm + 20nm nanoparticles with extra crosslinkers.
  - EXOv5 = inorganic, chemically bonding base coat + slick organic top coat.
- **Typical OEM paint stack (multiple detailing and paint-industry sources, search 2026-10-02):**
  - e-coat ≈15–25 µm
  - primer ≈20–30 µm (13–38 range)
  - basecoat ≈15–25 µm (10–30)
  - clearcoat ≈40–60 µm (35–100)
  - total ≈100–180 µm
  - ceramic coating ≈0.5–2 µm per layer, 2–5 µm total. That is about 15–50× thinner than the clearcoat.
  - Sources: theultimatefinish.co.uk, ocdcarcare.com, engineerfix.com, nanolab.ltd, hhceramiccoatings.com.

**Why it matters.** Coating brands explain layers with static stacks and invented trademarked mechanisms. The honest and striking fact is the scale: the coating is a few microns on a ~100–180 µm paint system.

**Principle for JETCAR (exploded view)**
- The exploded view's "wow" is the true proportion. Show the real micron ratio when fully exploded: coating ≈1–2 µm vs verniz ≈40–60 µm, with labels showing the ranges as "faixa típica de fábrica", not JETCAR claims.
- When assembled, use an exaggerated readable scale.
- A toggle "escala real" can collapse the coating to a hairline (the light line).

**Borrow**
- Base coat / top coat two-step language, if JETCAR's process uses it. Confirm with the user.
- The industry micron ranges, labelled as typical.

**Do not copy**
- Brand names, hardness claims (9H/10H), durability years, "ION exchange"-type proprietary claims.
- Their static diagram aesthetics.

---

## R13. Card stacking (used once) — DOC

- **URLs:**
  - Tutorial: https://blog.olivierlarose.com/tutorials/cards-parallax (Framer Motion / Lenis)
  - Awwwards element: https://www.awwwards.com/inspiration/services-3d-scene-and-stacking-cards-scroll-naya-studio
  - Live site: https://naya-studio-dubai.webflow.io/#services (services as stacking cards over a 3D scene; not loaded)
- **Documented mechanics (Larose)**
  - Each card is `position: sticky` with `top: calc(-5vh + ${i*25}px)`, so every card sits 25px lower than the previous one.
  - Container progress `useScroll({offset:['start start','end end']})`.
  - Each card scales over the range `[i*0.25, 1]` toward `targetScale = 1 - (n - i) * 0.05`, so earlier cards shrink more (n=4: 0.80, 0.85, 0.90, 0.95, 1.0).
  - The image inside each card scales 2 → 1 as it enters.

**Why it works.** The previous card visibly recedes (scale + offset) while the new one takes the foreground. It is a real z-order change, not opacity.

**Principle for JETCAR**
- Use stacking exactly once, where the content is genuinely a sequence of steps, for example Lavagem's sub-steps: pré-lavagem → contato → descontaminação → secagem.
- Add depth cues beyond scale:
  - the receding card darkens 15–25% and loses 1–2px of sharpness (CSS filter on a still);
  - the light line redraws the new card's top border on arrival.

**Borrow**
- Sticky + per-index top offset + targetScale 0.05 steps.
- Inner image 1.2→1 (tamer than 2→1).

**Do not copy**
- Stacking all five services.
- The Webflow-template rounded-card look.
- Rotations or tilt (banned).

---

## R14. S-2K (Honda S2000 tribute) — Awwwards SOTD 6 Sep 2025 — LOADED (0→7vh)

- **URLs:**
  - Live: https://s-2k.webflow.io/
  - Awwwards: https://www.awwwards.com/sites/s-2k
- **Details:** Zuji Studio; Webflow + GSAP; palette #efefef / #0e0e0e; overall score 7.36.
- **Evidence:** `shots/s2k/00-13.png` (0.5vh steps).

**Observed**
- **Loader.** A tachometer counting up ("13 MPH").
- **Hero.** "HONDA" in a wide display face plus "S2000" and "(99—09)", a small monospace chapter index at top-right (BRIEF / ENGINEERING + ARTISTRY / MILESTONES IN MOTION / PURE ANALOG THRILL / UNDER THE SURFACE / THE LEGACY), and thin column grid lines with "+" registration marks.
- **1.0vh: column-wipe transition.** Vertical grid columns flip from black to light grey in a staggered step pattern, about 0.5vh.
- **1.5–3vh.** A paragraph fills word by word over a giant outline "S2000" in the background, and a mini tachometer + "GEAR 01/02" at bottom-right acts as the scroll-progress and chapter counter.
- **3.5–7vh.** Full-bleed driving footage with "ENGINEERING MEETS ARTISTRY" and paragraphs overlaid on moving video.
- Awwwards also lists "horizontal scroll + blueprint reveal" later on the page; I did not capture that far.

**Why it works.** The grid and registration marks give a drafting-table identity. The columns-as-wipe is a cut that belongs to the layout grid, not to a filter.

**Principle for JETCAR**
- Cuts should come from the site's own geometry. JETCAR's equivalent is the light line or the slanted parallelogram edge doing the wipe.
- A chapter counter can be typographic ("02 / 05") instead of a gimmick instrument.

**Borrow**
- A layout-grid-native wipe, done once.
- The small monospace chapter index (compare with R6's sticky index).

**Do not copy**
- The tachometer loader and gauge progress (car-instrument cliché).
- Paragraphs over moving footage (the "vídeo → vídeo" problem).
- Outline mega-type in the background.

---

## Light Trace synthesis: one line, a different job each time (with sources)

| Function in JETCAR | Closest observed precedent | Spec drawn from the observations |
|---|---|---|
| Reveals the car in the dark hero | McLaren W1 intro (rim light + tail-light line), Ferrari DRL lines in fog | One bright line is the only full-white element in frame. Everything else stays ≤ 60% luminance. |
| Crosses the paint and reveals defects | McLaren brush reveal (persistent), Apple x-ray crossfade | The sweep shows swirls only inside the light band. After correction, the band shows a clean mirror. |
| Draws card borders | Polestar 5 sticky 1px frame (958px) that the car breaks | 1px, white at 85–90% opacity, drawn as an SVG stroke (dashoffset). Objects in the scene may cross it. |
| Separates layers | iyO single-axis explode + Ferrari callouts | The line becomes the gap between slabs, plus a leader to each label with a 4px square marker. |
| Follows the PPF edge | XPEL squeegee dry track | A 1–2px specular line on the film's leading edge, with wet mottle ahead and uniform gloss behind. |
| Becomes navigation | Polestar interior 1px index marker; McLaren bottom anchor bar | A vertical 1px marker on a 01–05 index (desktop) / a bottom bar (mobile). It changes theme with the section. |
| Becomes the map route | Lucid Air SF→LA route (2px white, end dots, square caps tags) | Draws Av. Boa Viagem → R. José Trajano. One square tag, no number or CEP. |

---

## Anti-references (what would make JETCAR read as a template, a demo, a Reel or a generic Awwwards site)

**SaaS-template signals**
- **Icon-trio feature tiles.** XPEL "Professional Installation / Industry-Leading Warranty / Comprehensive Coverage" (`shots/xpel-up/02.png`), STEK "Ultra Gloss Finish / Super Hydrophobic…" (`shots/stek-dynoshield/01.png`), iyO's rounded glass cards with icons (`shots/iyo-one3/00.png`).
- **Pill navigation, glass blur, big radii.** iyO's floating pill nav, Porsche's ≈12–16px rounded media.
- **Before/after sliders with sparkles.** Aceternity "Compare" (https://ui.aceternity.com/components/compare, also on 21st.dev https://21st.dev/@manuarora700/components/compare): drag/hover/autoplay (default 5000ms) slider with a sparkle handle. Instantly recognisable as a component-library drop-in. If JETCAR needs a before/after, the boundary is the light line itself, with no handle chrome.
- **Rows of 4+ service cards or carousels.** Lamborghini/Porsche/XPEL card rows. In JETCAR this would be the forbidden "grade dos cinco serviços".

**Three.js-demo signals**
- **Particle or dotted-noise backgrounds.** iyO's topographic dots (`shots/iyo-one3/03.png`), Lando's camo blobs.
- **Free-floating rotating hero objects.** Lando Norris (https://landonorris.com, Awwwards Site of the Year 2025, OFF+BRAND): a 3D helmet that "changes in real time as you scroll". Also any 360° turntable (banned for the car).
- **A custom cursor replacing the system cursor** (Ferrari `MainCursor`), and cursor-following flashlights. The brief says pointer light must be "extremamente sutil", not a lanterna.

**Reel / "scroll-controlled video" signals (user complaint #1)**
- **Long image-sequence orbits.** Ferrari ScrollReel ≈3.5vh of orbit (`shots/ferrari-reel/`). Cap JETCAR scrubs at 1–1.5vh and end each one on a freeze where the user acts.
- **Copy paragraphs over moving footage.** S-2K 3.5–7vh (`shots/s2k/09-13.png`).
- **Type masks expanding into video as the opening.** Polestar "5" (`shots/polestar5-fine-a/`). This is JETCAR v5's own JETCAR-letters opening, so do not reprise it.
- **Video-only heroes with no poster.** Lamborghini and Polestar heroes render as black boxes when H.264 is missing. JETCAR's hero must be a still composition first: WebM VP9/AV1 + MP4 H.264, `poster`, and a decode-failure fallback to a still.

**Generic Awwwards signals**
- **Word-by-word grey→white text fill on every paragraph.** McLaren, Polestar, Ferrari and S-2K all use it. Use it at most once, or not at all.
- **Giant outline mega-type in the background** (S-2K "S2000"). Neon or lime accents and signature scribbles (Lando's lime #d2ff00 signature stroke).
- **Gauge or tachometer loaders and progress meters** (S-2K).
- **Single-plane "occlusion".** Car and type baked together and moving as one (Porsche "turbo S"). It looks layered in a still and flat in motion. JETCAR's layers must move independently (Layer Contract).

**Credibility killers**
- **Callouts that point at the wrong part.** STEK "HEADLIGHTS" points at the tail-light.
- **Brand claims, hardness or warranty numbers, prices** copied from coating and PPF brands (CLAUDE.md: invent no prices, warranties or results).

---

## Not verified / gaps

- **Lamborghini "+" panel content.** The headless click triggered a client-side app error.
- **McLaren intro length.** I only saw the intro states and the skip button.
- **S-2K blueprint reveal.** Not captured (beyond 7vh).
- **iyO on-object labels during the explode.** None seen in my frames.
- **Gtechniq and NAYA Studio pages.** Not rendered (403 / not attempted). Facts come from search and documentation only.
- **Fluidity and frame pacing of any reference.** SwiftShader cannot measure these. Check on real devices if any of these mechanics are adopted.
