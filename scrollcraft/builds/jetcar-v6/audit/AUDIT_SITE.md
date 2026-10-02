# JETCAR v5 audit (visual and structural), input for v6

Folder: `/tmp/claude-0/-home-user-jetcar/30b999e8-6c14-5a1a-9a64-2d82d6582b57/scratchpad/v6/audit-site` (all paths below are relative to it).

## 0. Method and caveats

- Captures were made with Playwright/Chromium and SwiftShader WebGL. Desktop is 1440×900 at DPR 1. Mobile is the iPhone 14 Pro preset (viewport 393×660) with DPR forced to 2 (a real phone is DPR 3).
- Each chapter was captured at t = 0, .25, .5, .75 and 1. Extra captures: `extra/` (marca:.18, final:.9, final:.96), `reduced/` (reduced motion, mobile), `fallback/` (no WebGL and no JS) and the post-track page (`shots/*_post_*`, `*_menu_open.png`).
- Scripts: `audit.cjs` (adapted from `qa5.orig.cjs`, which also records caption state), `fallback.cjs`, `a11y.cjs`, `metrics.py` (output in `metrics.json`) and `sheets.py`.
- Something else changed the repo during the audit. `dist/index.html` and `style.css` were modified at 21:23, and `dist/js/acts/` and `scrollcraft/` are new and untracked (v6 work in progress).
  - The main captures loaded the page at 21:12, before that change, so they show v5.
  - The extra, reduced, fallback and a11y runs used a `git archive HEAD` copy (commit 9ed39fa, v5) served at `http://localhost:3005` from `v5/dist`.
- Shot file naming: `shots/<device>_<u in screens>_<chapter>_<t>.png`. Below, `d:` means desktop and `m:` means mobile. For example, d:lavagem:.75 is `shots/desktop_08.60_lavagem_0.75.png`.

### Contact sheets

- `sheets/contact_desktop_all.png`, `sheets/contact_mobile_all.png`: 10 chapters × 5 t values each.
- Detail sheets: `sheets/contact_{desktop,mobile}_{1..4}_*.png`.
- Page after the track: `sheets/contact_{desktop,mobile}_post.png`.
- Key artifact crops: `sheets/evidence_crops.png`, with panels A to H.
- Other crops: `crops/*.png`, `quality/*.png`.

## 1. Global numbers

- **Length.** The track is 30.3 screens: 27,270 px on desktop and about 20,000 px on mobile before the booking section.
- **First service.** The first service name ("01 Lavagem técnica") becomes legible only at u = 6.52 screens (5.9k px on desktop).
- **Captions mostly hidden.** Captions are fully legible for 9.4 of 30.3 screens (31%). The five service captions together are fully visible for only 6.0 screens (20%). In 33 of 50 sampled frames per device, no caption is legible (`metrics.json`).
- **The film fills 42% of the track.** Of the 30.3 screens, 12.8 are the AI film scrubbed by scroll: abertura 3.4, marca 2.8, lavagem 3.2 and final 3.4. Studio CG takes 14.7 screens and the map 2.8.
- **Four visual languages in one strip.**
  - AI photoreal video.
  - A black lacquer and chrome logo wall.
  - A gray procedural CG macro of a hood.
  - A dark OpenStreetMap city.
- **4 of 9 chapter boundaries cut through pure black or white:**
  - lavagem→correcao: foam fills the screen with white (L 0.784 at u 9.40).
  - ceramic→camadas: inside a water drop, near black (L 0.007 at u 15.10).
  - interior→final: 100% black at u 24.10.
  - final→rota: 94% black at u 27.50.
  - marca also flashes to white (exposure ×47, white 0.96) at u ≈ 5.6–5.9. d:marca:.75 is 11% clipped pixels on desktop and 21% on mobile.
- **Sharpness proxy** (variance of the Laplacian over the frame, without the nav):

  | Content | Desktop | Mobile |
  |---|---|---|
  | Film chapters | 186–380 | 21–44 |
  | Studio CG / map | 250–970 | 500–970 |
  | DOM page | 1760 | — |

  On mobile the film is the softest content on the site by a factor of about 20.
- **Weight.**
  - Desktop transfer is about 9.9 MB uncompressed.
  - The film sequences are 8.3 MB on desktop (`film/d`, 226 frames × 35.8 KB average, range 24–51 KB) and 5.9 MB on mobile (`film/m`, 24.5 KB average).
  - Libraries and data: three.min.js 564 KB, map.json 391 KB, interior.webp 236 KB, js/ 172 KB, fonts about 156 KB.

## 2. Image quality: source resolution vs displayed size

### Source

- **Master.** `porsche-scroll.mp4` is 1916×1080 H.264 at 6 Mbps, 24 fps. It is an AI generation and soft in itself: downscaling it 50% and back up loses only 39–44 dB PSNR. Its real detail is about 960–1100 px across.
- **Frames.** Each WebP is 1280×1080 on desktop (color 1280×720 plus depth 640×360) and 960×810 on mobile (color 960×540 plus depth 480×270). That is about 0.26 bits per pixel.
- **Compression loss.** Against the master scaled to the same size, the frames are 38.9–40.8 dB on desktop and 37.5–40.1 dB on mobile. WebP wipes out fine texture such as paint swirls and the water film: `quality/crop3x_master_vs_webp_135.png` (panel D).
- **Frame rate.** The film was sampled at 15 fps. Between frames the shader cross-fades two adjacent frames (`FrameSequence.sample`: mix of i0 and i1). That produces ghosting and dissolves while scrolling, and so does `idleDrift`, which moves the film ±0.18 s back and forth by itself when the scroll stops. Both read as a "video".

### Displayed size

| Case | Visible source region | Displayed at | Upscale |
|---|---|---|---|
| Desktop, 1440×900 at DPR 1 | about 1097×686 px (visFrac 0.857 of 1280) | 1440×900 | 1.31× |
| Retina laptop at DPR 2 | same | GL buffer 2160×1350 (high profile, maxScale 1.5), then 2880×1800 device px | 2.6× |
| Mobile 393×660, low profile | about 306×513 px (visFrac **0.319** of 960×540: only 32% of the frame width) | GL buffer 590×990 (scale 1.5) | 1.28× in CSS px, **3.85× in device px at DPR 3** |

Extra 2D zooms on the flat frame:

- **Lavagem dive** (t 0.8–1.0, u 8.76–9.40): uDolly 2.4, a 3.4× zoom. About 320 source px end up across 1440 px, a 4.5× upscale, partly hidden by the foam.
- **Final departure** (t 0.86–0.985, u 27.0–27.45): up to 2.15×.

### Visible defects

- **d:marca:.75 and m:marca:.75.** Exposure is boosted up to ×47 during the headlight flash. 8–16 px WebP macroblocks show in the windshield and interior, and the headlight is clipped to white (`crops/m_marca075_top.png`, panel B).
- **d:lavagem:.25–.75.** The wash mitt and the hand are smeared by motion blur and look mushy at 1:1 (panel C).
- **d:final:.75.** The bumper and grille are soft and covered in white water spots: the "result" shot shows a dirty car (`crops/d_final075_bumper_2x.png`, panel H).
- **Edge-detect look.** The "glint" shading draws white outlines on every edge of the car: d:abertura:.75, d:marca:1, d:final:.75, m:final:.75. It makes the car look like an X-ray or a line drawing. Early in abertura (t .25–.5) the car is also desaturated to gray by `reveal`.

## 3. Chapter by chapter

Complaints: C1 = reads as a scroll-controlled video, C2 = poor image quality, C3 = fake 3D (warping, parallax, transforms), C4 = services lack website structure.

### abertura (u 0–3.4, film)

- **What the visitor sees.**
  - t0: the H1 "Estética automotiva em Boa Viagem" in a 55–128 px condensed face over a frame that is 93% black, with only a faint silhouette of the car. The first viewport shows no product.
  - t.25: two vertical additive light lines sweep across. They pass over the nav.
  - t.5: a 3/4 hero of the car. This is the best frame on the site.
  - t.75: a push-in on the headlight with a white edge glint.
  - t1: the logo wall.
- **C1:** yes. Film time 0→4.49 s over 3.4 screens, plus the idle drift.
- **C2:** yes. The film is soft at 1.31× (2.6× on retina) and grayed out at t.25.
- **C3:** yes. The 2.5D depth warp opens a black seam about 15 px wide along the right edge of the front bumper (d:abertura:.25, `crops/d_abertura025_bumper_edge_3x.png`, panel A). The light lines are flat additive planes. A hairline light line stays across the nav at t.5.
- **Mobile:** only the front of the car is visible. The hero text sits over a near-black frame.

### marca (u 3.4–6.2, film plus logo wall)

- **What the visitor sees.**
  - t0–.25: a black lacquer wall with "JETCAR" cut out and chrome bevels. The film shows dimly through the letters; a Porsche crest appears inside the A. The tagline "Estética automotiva" is 11–14 px at 62% white, letterspaced .62em, and only visible at t ≈ .1–.26 (`extra/desktop_03.90_marca_0.18.png`).
  - t.5: the camera is inside the A. 60% of the frame is black wall and letter fragments (d:marca:.5).
  - t.75: the headlight flash. The frame is overexposed, clipped and shows macroblocks.
  - t1: a close-up of the hood. It is flat and gray.
- **C1:** yes. **C2:** yes (t.75). **C3:** partly. The wall is real geometry, but flying through a letter is the "transform tunnel" trope, and inside it the screen reads as empty black.
- **Mobile:** "JETCAR" spans 18–383 of 393 px, with no margin.

### lavagem (u 6.2–9.4, film, service 01)

- **What the visitor sees.** A close-up of a wet hood: droplets, a pressure washer, then a mitt.
  - The caption "01 / LAVAGEM TÉCNICA / 24 words" sits over medium-gray paint.
  - At t.75 the caption is fading out over bright paint and the body text is unreadable (d:lavagem:.75).
  - At t1 the screen is 100% white foam (L 0.78), with only the nav (d:lavagem:1 = d:correcao:0).
- **C1:** yes, the strongest case. 5.6 s of raw video over 3.2 screens.
- **C2:** yes, the smeared mitt.
- **C3:** yes. The foam is flat white blobs pasted on the screen (left edge of d:lavagem:.75, panel C). The dive is a 2D zoom of 3.4×.
- **C4:** yes. One sentence, no image of the result, no list of what is included, no CTA.
- **Contrast:** the red "01" over gray paint is about 1.2–1.8:1. The body text on mobile at t.25 is about 3.8:1, below the 4.5:1 required for 15.5 px text.
- **Mobile:** the Porsche crest sits directly behind the caption title (m:lavagem:.25/.5). That is visual noise and puts a third-party brand behind our heading.

### correcao (u 9.4–12.4, studio CG, service 02)

- **What the visitor sees.**
  - t0: white foam.
  - t.25–.75: a dark gray plane with two long light-tube reflections, a speckle of "swirl" scratches, a bright LED dot, and a huge blurred "02" behind, cropped by the nav and the right edge.
  - t1: almost empty gray.
- There is no car silhouette and no recognizable polisher in the samples. The scene does not read as a car or as polishing.
- **C3:** no warping here; it is real 3D. But it is abstract and unconvincing, and the micro-scratches read as noise.
- **C4:** yes. A 29-word caption over an abstract scene.
- **Contrast:** "02" is about 1.8–2.8:1.
- **Mobile:** "02" is cropped by the right edge and sits under the nav (m:correcao:.25–.75).

### ceramic (u 12.4–15.1, studio, service 03)

- **What the visitor sees.** The same gray hood with a vertical reflection that zig-zags at the crease of the hood and looks like a lightning-bolt glitch (d:ceramic:0–.5, right side). Then a giant blurred "03", then beads of water (t.75, the best frame of this chapter). At t1 the camera is inside a drop: an almost black screen with arcs (L 0.007).
- **C3:** a reflection glitch.
- **C4:** yes. 21 words; the caption says nothing about benefits.
- **Mobile:** t.25 has a white overexposed band under the nav (m:ceramic:.25).

### camadas (u 15.1–18.5, studio, "Proteção")

- **What the visitor sees.**
  - t0: black, inside the drop.
  - t.5–.75: an exploded view of the paint layers with labels (red square, rule, uppercase). This is the only scene that explains anything. It works.
  - t1: a dark plane.
- **Bug:** there are 5 labels but only 3 slabs are visible. The labels "PROTEÇÃO" and "VERNIZ" (y ≈ 174 and 302 on desktop) point at faint streaks far above the visible plates (d:camadas:.5).
- **C4:** this is not a service, but it sits between Ceramic and PPF and splits them apart. The nav link "Proteção" lands here.

### ppf (u 18.5–21.1, studio, service 04)

- **What the visitor sees.** A dark hood. A light bar passes, drops form and run, then the film "slides". In practice: gray texture, beads of water, a giant "04".
- t0, t.25 and t1 are almost empty (L 0.015–0.03).
- **C4:** yes. 23 words. There is no visible "before and after protection", although that is the main sales argument for PPF.
- **Mobile:** "04" is cropped by the right edge.

### interior (u 21.1–24.1, studio plus photo, service 05)

- **What the visitor sees.**
  - t0–.25: a dark abstract plane (windshield or glass).
  - t.5–.75: the interior photo (1536×1024, depth 768×512) shows a leather seat and a gloved hand with an extractor. This is the clearest "service" image on the site.
  - t1: 100% black.
- **C3:** yes. The photo sits on a mesh displaced by depth. A carbon-fiber slab cuts across it with a hard straight seam at y ≈ 695 on desktop (d:interior:.5).
- **C4:** yes. 26 words.

### final (u 24.1–27.5, film)

- **What the visitor sees.**
  - t0: black.
  - t.25: a dark hood with a wet windshield.
  - t.5–.75: the full car with the "JETCAR" wordmark between the car and the background. The wordmark is gray, about #4a4a4a on dark gray, so it reads poorly.
  - t.9 (`extra/desktop_27.16_final_0.9.png`): the gate light comes up, the wordmark glows, and the caption "SEU CARRO. EM OUTRO NÍVEL." with the "Agendar" button appears. It is visible only at t .8–1.0, i.e. 0.31 fully visible screen.
  - t.96: the image darkens and zooms in.
  - t1: 94% black with a floor light line.
- **C1:** yes. 11→15 s of film.
- **C2:** yes. A soft, spotted bumper (panel H).
- **C3:** yes, the worst case on the site.
  - The silhouette of the car has a jagged, dotted, cut-out edge where the depth mask meets the type and the gate light (panel E, `crops/d_final09_cutout_edge_2x.png`; mobile `crops/m_final075_roofedge_2x.png`, panel G).
  - The wheel "spin" is a 6-tap radial blur on a fixed ellipse that turns the wheel into a wire spoke wheel (panel F).
  - The departure is a 2D zoom.
- **Layout:** the CTA sits over the bumper, and the floor light line runs right behind the "Agendar" button.
- **Copy:** "Seu carro. Em outro nível." is a generic slogan, against the CLAUDE.md rule.
- **Mobile:** the 16:9 frame in portrait shows only the front half of the car, and the wordmark is cut off by the roof (m:final:.75).

### rota (u 27.5–30.3, map)

- **What the visitor sees.**
  - t0: black with the floor line.
  - t.25: a dark extruded city.
  - t.5: the red route from the Av. Boa Viagem / ORLA label to Rua José Trajano, with the caption "Rua José Trajano, Boa Viagem" (right-aligned on desktop) and an "Abrir no mapa" link. It is clear, true to the data and attributed (d:rota:.5).
  - t.75: the booking section starts rising over the map.
- **Works.** Small issues only:
  - The labels appear only at t .48–.66.
  - On mobile, "ORLA" is cropped at the right edge and the route leaves the frame.
  - At t.25 the frame is almost empty.

### Post-track page

Booking (07), FAQ (08) and the red footer, all in normal flow over a black gradient. `sheets/contact_*_post.png`, `shots/desktop_post_config_filled.png`.

- Clear, readable, good identity. This is the part that already behaves like a website.

## 4. Complaint 4 in detail: services do not form a website architecture

- Each service is a number, a title and 1–2 sentences (21–29 words) at the bottom left of a full-screen abstract scene.
  - It is legible for only about 1–1.5 screens out of 2.6–3.2.
  - There is no card, no thumbnail or result photo, no "o que inclui / para quem / quando fazer / cuidados depois".
  - There is no CTA per service. The only Agendar buttons are the nav button, the final caption and the booking section.
- **No overview anywhere.** The five services never appear together in the page body. They only appear together in:
  - the menu overlay,
  - the footer columns,
  - the booking chips, which use different labels: Pintura, Proteção, Interior, Lavagem, Avaliação.
- **No deep links.** `#lavagem` etc. are scroll positions in the track (`captionHold`), not sections or pages.
  - The nav "Serviços" jumps to Lavagem only.
  - The nav "Proteção" goes to the camadas diagram, not to Ceramic or PPF.
  - Ceramic (03) and PPF (04) are separated by the layers chapter.
- **Numbering is inconsistent.** 01–05 are services, 06 Endereço exists only in the menu (the rota caption has no "06"), then 07 Agendar and 08 Dúvidas.
- **No comparison.** Ceramic vs PPF is explained only in FAQ 02. There is no comparison block.
- **Hidden from assistive tech and the tab order.**
  - `.cap` uses `visibility:hidden` outside its window. At the top of the page the accessibility tree contains only the H1, "Vamos preparar…", "Perguntas comuns" and three footer H4s (`a11y.cjs` output). The five service H2s, the final heading and the address heading are absent.
  - The Tab order goes straight from the nav to the booking form. The links "Agendar" (final) and "Abrir no mapa" (rota) cannot be reached unless the scroll is inside their window.
  - Search engines see the text but as hidden content.
- **No content images in the DOM.** Every visual is inside the canvas (`aria-hidden`), so there is no alt text and no image SEO. The only `<img>` elements are the logo three times and the poster.
- **Footer headings** jump from H2 to H4.

## 5. Contrast and legibility

Estimates from `metrics.py`: the 40th percentile of the background under each text box, with the text alpha composited.

- **Red numbers over gray paint.** The red `.cap-num` (#d7261e, 59–104 px) measures:
  - lavagem 1.2–1.8:1
  - correcao 1.8–2.8:1
  - ceramic 1.2–2.1:1
  - ppf 1.4–3.2:1
  - interior 3.3–3.6:1

  Large text needs 3:1.
- **Body text** at full alpha is mostly ≥ 4.5:1 thanks to the text-shadow. The exception is m:lavagem:.25 at about 3.8:1.
- **Fade windows.** During entry and exit the text is at partial alpha over busy footage and is unreadable (d:lavagem:.75, m:lavagem:.75, d:camadas:.25).
- **Small and faint text.**
  - Slate: 11.5 px at 55% white.
  - marca tagline: 11–14 px at 62%.
  - Kicker: 13 px at 78%.
  - "Role para revelar": 12 px at 70%.
  - Map attribution: small.
- **Decorative but illegible.** The final wordmark at t.5–.75 is about 1.5:1, and the big blurred "02/03/04" in the background compete with the caption numbers.

## 6. Mobile crops and layout (393×660)

- The film shows 32% of the frame width. The car is never seen whole, only the front 3/4 (m:abertura:.5, m:final:.5/.75).
- The background numbers "02/03/04" are cropped by the right edge and sit under the nav.
- "ORLA" on the map is cropped.
- The logo wall has no side margin.
- The Porsche crest sits behind the lavagem caption.
- Captions take the bottom 35% of the screen (y 379–627 of 660), so the subject is squeezed into the top half, which is often empty or dark.

## 7. Motion, reduced motion and fallbacks

- **Reduced motion** (system setting or the "Reduzir movimento" button, remembered in localStorage) only removes:
  - Lenis smoothing,
  - lerp easing of `u`,
  - cursor wobble,
  - idle drift,
  - caption fades.

  All scroll-linked camera moves stay (through the A, the dive into the paint, into a drop, through the windshield, the zooms), and so does the **white flash** at marca (exposure ×47, white 0.96). See `reduced/mobile_*.png`. This is weak for vestibular and photosensitive users.
- **No WebGL** (`fallback/*_nogl_*`): the stacked captions sit over the fixed poster at 38% opacity, plus a looping video.
  - The video is H.264 MP4 only (`film-720.mp4`, `film-portrait.mp4`). This Chromium has no H.264, so it showed `MEDIA_ERR_SRC_NOT_SUPPORTED` and the poster only. A WebM source is needed.
  - The page still preloads `film/*/000.webp`, unused (console warning).
  - It is readable and orderly; this is actually a good skeleton for v6. Weak points: the same poster is behind every service, and "Role para revelar" is still shown.
- **No JS** (`fallback/mobile_nojs_*`): the same stacked layout. It works.

## 8. What works and should be preserved

1. **Booking configurator** (`#config`, `js/ui.js`).
   - Car → chips → live message. Example output: "Olá, JETCAR! Meu carro é um Porsche 911. Tenho interesse em correção de pintura (polimento) e proteção da pintura (Ceramic Coating ou PPF). Podem me passar o orçamento e a disponibilidade?"
   - The message is copied inside the click gesture, then the Direct opens (ig.me cannot prefill text). There is also a "Só copiar a mensagem" fallback with a selection fallback, an `aria-live` status, and the honest note "Nada é enviado por este site".
   - Enter in the car field moves to the chips.
2. **FAQ.** Native `<details>` with 5 honest answers and no invented data.
3. **Map chapter.** Real OSM geometry with ODbL attribution in the map and the footer. Red route from the orla to Rua José Trajano, an Apple Maps link, no invented number or CEP (d:rota:.5).
4. **Exploded paint-layer diagram** (camadas .5–.75). The label style works; fix the two orphan labels.
5. **Strong still frames that can be reused as stills, not scrubbed:**
   - d:abertura:.5, the 3/4 hero.
   - d:final:.75, the full car.
   - The interior photo (d:interior:.5).
   - The ceramic beads (d:ceramic:.75).
   - `film-poster.webp` 1600×902, which looks cleaner than any WebGL-processed frame.
6. **Identity.**
   - Barlow and Barlow Condensed 700/800/800i, self-hosted under the OFL.
   - `--red #d7261e` with the light gradient only on buttons, parallelogram buttons.
   - Kicker with a red number, captions bottom left, the red footer.
7. **Accessibility already in place.**
   - Skip link; `lang="pt-BR"`; `aria-hidden` on the canvas and the track.
   - The menu has `aria-expanded`/`aria-controls`, Escape closes it, and focus returns to the toggle.
   - `aria-pressed` on the sound and motion toggles; sound is off by default.
   - Anchor jumps move focus to the heading (`tabindex -1`).
   - An `sr-only` list of the layers.
   - iOS keyboard scroll freeze, `env(safe-area-inset-*)`, svh/lvh probes.
8. **SEO and meta.** Title, description, OG tags, schema.org `AutoWash` JSON-LD with geo coordinates and `hasMap`.
9. **Engineering to keep.**
   - Quality profiles (`pickQuality`) and dynamic resolution (0.55–1×).
   - 30 fps when idle, the stage is hidden when covered.
   - Decode window for frames (−4…+8), a cut to black for long anchor jumps.
   - Fallback layers for no WebGL and no JS.
   - `npm run check`.
10. **Honesty constraints are respected.** "Fotos e vídeo ilustrativos" is in the footer. There are no invented phone numbers, prices, hours or reviews, and "Preço e prazo são definidos pela equipe depois de ver o carro" is stated.

## 9. Short list of what v6 must fix (derived from the evidence)

1. **Stop scrubbing the AI film** (42% of the track) and stop the frame cross-fade and idle drift. Use stills or clean short loops in normal page sections. Reuse the best frames as stills, not as 15 fps scrub.
2. **No 2.5D depth warp, depth-masked type, radial "wheel spin" or 2D dolly on flat frames.** These are the sources of the seams, the cut-out edges and the softness (panels A, E, F, G).
3. **Every image displayed at ≤ 1.5× its source in device pixels.** On mobile, crop dedicated portrait assets instead of showing 32% of a 960 px frame at 3.85×.
4. **Services as real sections or cards** with an image, what is included, when to choose it and a CTA. Add a five-service overview near the top, deep links and visible (non-hidden) HTML text in the tab order and the accessibility tree.
5. **Remove pure black/white interstitials and the white flash.** Under reduced motion, no camera travel at all.
6. **Keep:** the configurator, the FAQ, the footer, the map route, the layer diagram, the identity tokens, the accessibility plumbing and the fallbacks.
