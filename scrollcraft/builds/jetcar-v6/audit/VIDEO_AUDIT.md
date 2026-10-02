# JETCAR v6: video and frame asset audit

Folder: `/tmp/claude-0/-home-user-jetcar/30b999e8-6c14-5a1a-9a64-2d82d6582b57/scratchpad/v6/audit-video` (abbreviated `AV/` below). Nothing under `/home/user/jetcar` was modified.

## 0. Bottom line

- There is **only one real video source**: `dist/assets/porsche-scroll.mp4`. I searched the whole filesystem and found no Higgsfield original. Everything else is derived from it: `film-720.mp4`, `film-portrait.mp4`, `film/d`, `film/m`, `film-poster*.webp` and `src/finish.webp`, which is master f324.
- **The master is already a re-encode, so some quality is lost before v6 starts.** It was encoded with x264 CRF 24, keyint 6 (an I-frame every 0.25 s), about 6.0 Mbps, at an unusual size of 1916x1080. The AI footage is also soft in itself. At the same scale, `src/poster.webp` has **about 4.3 to 4.5 times the Laplacian variance** of the matching video frame f0.
- **Where the v5 perceived-quality problem comes from:** master (CRF 24) → 15 fps WebP (1280x720 q72 / 960x540 q70) → stretched full-screen in the shader plus a 2.5D zoom. Compared with a Lanczos downscale of the master, the WebP frames lose 21% (d) / 32% (m) of their high-frequency energy, with SSIM 0.969 / 0.959. On an iPhone 14 Pro in portrait with cover fit, each 960x540 source pixel is enlarged **about 4.7x** (852/540 × DPR 3). Even the 1080p master would be enlarged 2.4x there. In portrait, no available source can fill the screen sharply.
- **Picks:**
  - Hero still: **`src/poster.webp`**, which is the source still for frame 0. Video fallback: **f048 (2.000 s)**.
  - Wash scrub clip: **3.50 → 9.00 s (f084 → f216, 5.5 s), freeze on f216 (9.000 s)**.
  - PPF close-up: **f084 (3.500 s)**.
  - Avoid **7.04–8.00 s, 8.42–8.88 s, 9.29–10.96 s** (mist slab, ghosted hand, mitt smear, flash, soft pull-back).
- **Seek test:** a dense GOP (`-g 8`) seeks **about 5.7x faster** than a default VP9 GOP in Chromium. The paired test gave a median of 166 vs 942 ms and a p95 of 420 vs 2389 ms under heavy machine load. In standalone runs the g8 median was 94–123 ms and the default median was 358–666 ms. The H.264 dense-GOP encode with the specified settings is 6.36 MB for 6 s (8.48 Mbps).

## 1. Video files (ffprobe)

| File | Codec / profile / level | Res | fps | Frames / dur | Bitrate | Size | pix_fmt / color tags | Encoder settings (x264 SEI) | Keyframes |
|---|---|---|---|---|---|---|---|---|---|
| `porsche-scroll.mp4` (master) | H.264 High L4.0, avc1, B-frames 2 | **1916x1080** (DAR 1.774, not 16:9; 1916 is not a multiple of 16) | 24/1 CFR | 361 / 15.042 s | 5.96 Mbps | 11,209,796 B | yuv420p, range/space/trc/primaries **unknown** (untagged; browsers assume BT.709 TV range) | crf=24, keyint=6, keyint_min=4, scenecut=0, ref=2, bframes=3, aq=1 (Lavf60.16.100) | **61 I-frames, every 6 frames (0.25 s)**. I-frames avg 81.3 KB (max 126 KB), P 23.5 KB, B 14.3 KB. 87 B / 213 P |
| `film-720.mp4` | H.264 High L3.2 | 1280x**722** | 24 | 337 / 14.042 s | 2.18 Mbps | 3,834,614 B | yuv420p, untagged | crf=24, maxrate 3M, keyint=48, min 24, scenecut=40, ref=5 | 8 keyframes, every 2.0 s |
| `film-portrait.mp4` | H.264 High L3.1 | 704x1080 (center crop of master, x offset 606) | 24 | 337 / 14.042 s | 1.60 Mbps | 2,808,434 B | yuv420p, untagged | same as film-720 | 8 keyframes, irregular: 0, 2, 4, 5.58, 7.04, 8.75, 10.75, 12.75 s |

No audio in any of the files. Content mapping, verified by matching frames: film-720 / film-portrait frame 0 = master f24 (1.00 s), f100 = master f124, f300 = master f324. The last 24 frames (13.0–14.04 s) cross-fade the master's end (14.0–15.04 s) into its start (0–1 s); frame 320 matches no single master frame (MAD 8.2). This is the loop made by `scripts/encode-film.sh`. Neither file is a usable source for v6, being lower resolution, CRF 24 on top of CRF 24, and blended at the end.

### Levels (signalstats on raw Y; full CSVs: `AV/signalstats_*.csv`, columns t,YMIN,YLOW,YAVG,YHIGH,YMAX,UMIN,UMAX,SATAVG)

| File | YMIN median (min) | YLOW (p10) median | YAVG min / median / max | YHIGH (p90) median | YMAX median (max) | Frames with YMIN<16 | Frames with YMAX>235 | SATAVG median (max) |
|---|---|---|---|---|---|---|---|---|
| master | 9 (0) | 22 | 40.8 / 55.4 / 120.2 | 106 | 245 (255) | 350/361 | 361/361 | 1.22 (2.75) |
| film-720 | 7 (0) | 25 | 40.8 / 60.0 / 120.2 | 114 | 248 (255) | 333/337 | 318/337 | 1.16 (2.70) |
| film-portrait | 11 (3) | 30 | 40.9 / 65.7 / 134.7 | 119 | 242 (255) | 265/337 | 302/337 | 1.06 (4.24) |

Master luma histogram over all 361 frames, raw Y in TV range: Y<16 is 0.11% of pixels, Y 16–18 is 3.91%, Y≤20 is 6.07%, Y>235 is 0.04%, Y≥250 is about 0.

| Master frames | Y<16 | Y≤20 (within 4 codes of black) | p1 / p50 / p99 / p99.9 |
|---|---|---|---|
| f0–35 (wide) | 0.16% | 7.4% | 16 / 39 / 165 / 232 |
| f36–119 (push-in) | 0.21% | **11.0%** | 16 / 37 / 146 / 231 |
| f120–239 (wash) | 0.04% | 2.2% | 17 / 87 / 198 / 235 |
| f240–311 | 0.05% | 3.4% | 17 / 67 / 203 / 235 |
| f312–360 (wide, wet) | 0.19% | 9.9% | 16 / 40 / 178 / 235 |

What the levels mean:
- The master is TV range (16–235) with only stray excursions, so it is not broken.
- **Shadows sit on the black floor.** 7–11% of pixels in the wide and push-in shots are within 4 codes of black, so the hall's dark gradients are crushed, and banding appears at low bitrate or in 8-bit WebP.
- Speculars reach 235, which is white; the light bars and headlights clip.
- The grade is **almost monochrome**: SATAVG about 1.2 on a 0–181 scale. The only colour comes from the yellow calipers and the crest.
- Crop and aspect: there are no letterbox bars (YMIN 0–9 is real black hall, not padding). The master's aspect is 1.774, not 1.778.

## 2. Frame sequences (v5 scroll film) and stills

| Set | Packed size | Real image part | Depth part | Frames | WebP q | File size min / mean / max | Total | Quality vs master (Lanczos to same res, every 15th frame) |
|---|---|---|---|---|---|---|---|---|
| `film/d/*.webp` | 1280x1080 | **1280x720** (top) | 640x360, bottom-left; rest black | 226 @ 15 fps (frame i = master round(1.6·i); verified i=15k → f24k) | 72 | 24.8 / 36.6 / 52.0 KB | 8.28 MB | PSNR 39.05 dB (min 37.79), SSIM 0.969 (min 0.949), Laplacian energy 79% of reference |
| `film/m/*.webp` | 960x810 | **960x540** | 480x270 | 226 | 70 | 16.6 / 25.1 / 34.5 KB | 5.66 MB | PSNR 37.14 dB (min 35.87), SSIM 0.959 (min 0.930), Laplacian energy 68% |

Visible compression: WebP smooths away the fine grain and surface texture, and the dark gradients have no dither. See `AV/seq/crop_film_d090_left_vs_master_right.png`, a 3x crop of the hood; the WebP is on the left. The 24 → 15 fps resample takes 1 or 2 source frames per step, so the cadence is uneven.

| Still | Res | Bytes | Laplacian var at 1280 w | YAVG | Notes |
|---|---|---|---|---|---|
| `src/poster.webp` | 1672x941 | 111,782 | 394 | 37.0 | **The image-to-video start still.** Maps onto master f0 by a similarity transform with scale 1.1461 (=1916/1672), offset (0.2, 0.8) px, 678/800 ORB inliers |
| `dist/assets/film-poster.webp` | 1600x902 | 45,702 | n/a | n/a | = master f24, q78; derivative |
| `dist/assets/film-poster-portrait.webp` | 704x1080 | 24,842 | n/a | n/a | = master f24 center crop; the car is cut on both sides |
| `src/finish.webp` | 1916x1080 | 114,540 | 217 | 40.1 | = **master f324 (13.5 s)** (MAD 1.22); no gain over the master |
| `src/wash.webp` | 1536x1024 | 445,646 | 2764 | 84.6 | Bright workshop, foam cannon, person visible |
| `src/polish.webp` | 1536x1024 | 248,562 | 1046 | 67.8 | Bright workshop, orbital polisher, person |
| `src/ceramic.webp` | 1536x1024 | 217,636 | 694 | 68.9 | Bright workshop, applicator pad on fender |
| `src/ppf.webp` | 1536x1024 | 356,116 | 1395 | 75.4 | Bright workshop, film peeled over headlight/fender with squeegee |
| `src/interior.webp` | 1536x1024 | 241,432 | 804 | 57.0 | Identical to `dist/assets/interior.webp` |
| `src/*-soft.webp` | 480x320 | about 3.3 KB | n/a | n/a | Blurred placeholders |

The five service stills are much sharper than any video frame, but they are lit as a **bright grey workshop** (YAVG 57–85). The video is a **dark hall** (YAVG 35–40 in wide shots). Do not cut directly between the two without a grade or a black transition. Contact sheet: `AV/src_stills_sheet.png`.

## 3. Master: per-frame sharpness and shot breakdown

Per-frame CSV: `AV/master_metrics.csv`, 361 rows. Columns:
- `lapvar`: variance of the Laplacian on full-res luma.
- `lapvar_half`, `lapvar_center` (middle 60%x60%), `tenengrad`.
- `yavg`, `pct_le17` / `pct_ge250` (on RGB-derived luma).
- `blockiness` (8-px boundary ratio).
- `mad_prev`, `hist_corr`: change from the previous frame.
- `flow_mag`, `zoom_px` (radial Farneback flow at 480x270; positive means push-in), `pan_x`, `pan_y`.

Contact sheet at 0.5 s steps: `AV/contact_master_0.5s.png`. Larger 3x3 sheets: `AV/cs_a.png` … `AV/cs_d.png`. I inspected all of them.

Global Laplacian variance: mean 76.7, median 79.8, min 15.3 (f236, 9.83 s), max 130.0 (f336, 14.0 s). Frames below 35: f178–179, f186–191, f193, f234–238. Frames at I-frame positions (multiples of 6, i.e. 0.25 s) show small sharpness bumps, so **take stills from multiples of 0.25 s**.

**There are no hard cuts.** It is one continuous AI camera move: a push-in from 0 to about 9.3 s, then a pull-back from about 10.25 s to 15 s. The lowest histogram correlation is 0.764 at f234, which is a mist flash, not a cut.

| # | Time (s) | Frames | What it shows | Camera (flow @480 w) | Sharpness (lapvar mean / min / max) | Use? |
|---|---|---|---|---|---|---|
| A | 0.00–1.04 | f0–24 | **Wide establishing.** Full dry car, 3/4 front-left, dark hall, ceiling light bar at top, pillars with warm LED strips, reflective floor | Slow push-in, zoom +0.21, flow 0.25 | 81 / 71 / 91 | Yes (same composition as `poster.webp`) |
| B | 1.04–4.04 | f25–96 | **Push-in.** Ceiling bar leaves the top by about 1.5 s. Full car with margins until about 2.75 s, then the front fills the frame (3.5 s: both headlights, hood, bumper) | Smooth dolly-in, zoom +0.30, flow 0.61, no pan | **89 / 70 / 103 (peak f54)** | **Best-quality stretch of the clip** |
| C | 4.04–5.29 | f97–126 | Close front: headlights, hood, crest. Faint haze starts at the right edge about 5.1 s | Push-in, flow 1.0 | 54 / 46 / 68 | OK (softer) |
| D | 5.29–7.04 | f127–168 | **Spray** enters from the right (5.3), the right headlight blooms, the jet hits the hood (6.0–7.0) | Push-in plus slight left pan, flow 1.75 (spike 2.9 at f145) | 58 / 36 / **101 (f168)** | Yes |
| E | 7.04–8.00 | f169–191 | Heavy mist "slab" sweeping the hood. The spray sheet morphs and the hood texture changes frame to frame | **Jerky**: flow 6.8 (f173), 4.4–6.1 (f177–179), **9.3–10.1 (f186–188)**, hist corr 0.85 | 41 / **19.6** / 80 | Avoid as a hold; pass quickly |
| F | 8.00–8.50 | f192–203 | Water beads on the hood after the jet; the jet continues top-right | flow 1.6 | 67 / 35 / 88 | Yes |
| G | 8.50–9.29 | f204–222 | **Mitt wash.** Gloved hand and white mitt enter top-right. f202–212 are ghosted/translucent; by f216 the glove and mitt are crisp on the beaded hood | flow 2.6 | 76 / 61 / 93 | Yes; **f216 is the freeze** |
| H | 9.29–9.71 | f223–232 | Fast mitt swipe across the hood | **flow 10–21.5 px/frame (about 40–86 px at full res)**, pan_x up to 22 | 59 / 50 / 68 | Avoid (smear, arm/glove look detached f225–226, crest covered) |
| I | 9.71–10.00 | f233–239 | **Mist flash**: YAVG 92 → 120 → 100. The water beads on the hood vanish between f232 and f233, a continuity break | hist corr **0.764** | **27 / 15.3 / 55** | Avoid |
| J | 10.00–10.96 | f240–262 | Misty hood; second mitt pass top-right (10.3–10.6) exits right. Push-in turns into pull-back about 10.25 s | zoom −0.1…−0.8, flow 2.9 (max 5.9) | 49 / 36 / 69 | Avoid |
| K | 10.96–13.00 | f263–311 | **Pull-back reveal of the wet car**: hood, then left headlight, then both headlights and bumper; beaded windshield | Pull-back zoom −1.46, pan right 0.2–0.8 | 91 / 73 / 116 | Usable, see artifact note |
| L | 13.00–15.04 | f312–360 | **Final wide**: full wet car in the hall, beaded windshield, wet floor. Framing at 15.0 s is like f0, but tighter and wet | Pull-back −0.9 decelerating | 116 / 94 / 130 | Usable. Lapvar is inflated by droplet texture, not real sharpness |

## 4. Recommendations

### (a) Hero still (full car, dark hall)

**Use `src/poster.webp`.** It is the cleaner version of the same shot: identical framing to master f0, as the scale and offset in §2 show.

Detail crops at matched scale (Laplacian variance, poster vs f0):

| Region | poster | f0 | Ratio |
|---|---|---|---|
| Headlight/windshield | 955 | 211 | 4.5x |
| Front wheel/door | 1382 | 326 | 4.2x |
| Rear quarter | 508 | 117 | 4.3x |

On the poster the mirror, door shut-lines, wheel spokes and caliper lettering are crisp. It has deeper blacks, no codec smear, and no visible AI artifacts at 1:1 (`AV/hero/poster_car_1to1.png`). Side-by-side crops: `AV/hero/crop_*_poster_left_f0_right.png`.

Caveat: it is natively 1672x941. A full-bleed hero on a 1440-CSS-px screen at DPR 2 needs 1.72x upscaling. Either show it at ≤ about 1700 device px or run an offline 2x upscale.

The poster is f0, so the clip can start from it with no jump.

**Video fallback:** f048 (2.000 s, I-frame), lapvar 101.6 / center 222, ceiling bar out of frame, car spans about 16–84% of the width. The sharpest wide frame is f054 (2.25 s, lapvar 103.3), but it is slightly tighter. PNGs: `AV/cand/f048.png`, `AV/cand/f054.png`.

### (b) Scroll-scrubbed wash clip

**Clip: 3.50 → 9.00 s (f084 → f216), 133 frames, 5.54 s. Freeze on f216 (9.000 s, I-frame).**

Why f216: lapvar 86.6, center 111.5. It is the crisp black glove and white mitt on the beaded hood with the crest, and comes just before the f223 smear. Preview: `AV/cand/sheet_wash_freeze.png`, bottom-right.

Beats and scroll weighting:

| Time (s) | Beat | Scroll share |
|---|---|---|
| 3.50–5.29 | Dry push-in to the headlight/hood (starts on the PPF frame) | Normal |
| 5.29–7.04 | Spray arrives and hits the hood (best spray frame: f168, 7.000 s) | Normal |
| **7.04–8.00** | Mist slab, soft and jerky | **About 10% of the scroll distance, or fewer frames** |
| 8.00–8.50 | Beads | Normal |
| 8.50–9.00 | Mitt (f202–212 ghosted, so move through quickly) | Quick |

Shorter alternatives:
- 5.25 → 7.00 s (f126 → f168) for spray only, freezing on f168.
- Two pieces joined by a cut to black: 5.25–7.00 s, then 8.00–9.00 s.

Do not extend past 9.25 s.

### (c) Front close-up for a PPF reveal

**Use f084 (3.500 s, I-frame).** Measurements: lapvar 90.0, center 169, headlight crop 340.

Framing: dry paint; both headlights, the full hood and the complete bumper with intakes; left wheel and yellow caliper; dark wall above for type. File: `AV/cand/f084.png`. Crop comparison: `AV/cand/headlight_crops.png`.

| Alternative | Strength | Weakness |
|---|---|---|
| f096 (4.000 s) | Tighter framing | About 30% softer (lapvar 70.4, headlight 238); right bumper edge touches the frame |
| Wet f312 (13.000 s) | Shows beading for a ceramic/hydrophobic beat: droplets on headlight and hood, lapvar 121 | Bumper cut at the bottom; paint has a streaky texture |
| `src/ppf.webp` | Sharper, shows film being applied | Bright workshop lighting; mismatched with the hall |

### (d) Frames to avoid

| Frames | Time (s) | Problem |
|---|---|---|
| f169–191 | 7.04–8.00 | Mist slab morph, soft (lapvar to 19.6), camera jerks at f173, f177–179, f186–188 |
| f202–212 | 8.42–8.88 | Translucent/ghosted hand and mitt merging with spray |
| f223–232 | 9.29–9.71 | Mitt swipe with motion smear up to about 86 px/frame; arm/glove look detached (f225–226) |
| f233–239 | 9.71–10.00 | Mist flash (YAVG +28, hist corr 0.76), lowest sharpness in the clip (f236, 15.3); hood beads vanish (continuity break) |
| f240–262 | 10.00–10.96 | Soft, second mitt pass, direction reversal |
| f263–360 (wet sections) | 10.96–15.04 | Wet paint has fine "brushed" streak texture and smeared drips on the bumper (`AV/cand/headlight_crops.png` f300/f312). Reads as hazy or scratched under scrutiny, which is bad for a detailing studio's "result" shot. Use small or briefly |
| f123–144 | 5.12–6.00 | Right headlight blooms and clips as the spray enters (pct Y≥250 rises to about 0.4%). Acceptable in motion, not as a still |
| All | 0–15.04 | Porsche crest/script is legible on the hood (f168–f312 close-ups) and wheels: a brand/trademark consideration. The current site already identifies the car as a Porsche 911 Turbo S |
| All | 0–15.04 | Untagged colour. Crushed shadows in A/B/L (7–11% of pixels within 4 codes of black); add grain/dither on output |

## 5. Seek test

Segment: master 3.25 → 9.25 s (6.0 s, 144 frames, covers the recommended wash clip), Lanczos scaled to 1920 wide. `-2` rounding gave **1920x1082**. In production, keep the native 1916x1080 or scale to exactly 1920:1080 (0.2% stretch).

Method: headless Playwright Chromium. It has no H.264 decoder and decodes VP9 in software. Each file was loaded as a **Blob URL**, so no network time is included. `currentTime` was set and the time to the `seeked` event was measured. The 40 random targets come from a deterministic PRNG, identical for every file. I also ran 60-step reverse and forward scrubs in steps of 1/24 to about 0.25 s. `requestVideoFrameCallback` never fired in headless mode, so only `seeked` is reported.

Host: 4 vCPU Xeon @ 2.8 GHz, **shared with other jobs (load average 3.5 → 25 during the runs)**, so absolute times are pessimistic and noisy. The paired test (all variants in one page, seeked in rotation for each target) gives the reliable ratios.

| Encode | Settings | Size (6 s) | Bitrate | Keyframes | SSIM-Y vs lossless ref | Random-40 seeked, standalone runs: median / p95 ms | Paired (n=120): median / p95 / max ms |
|---|---|---|---|---|---|---|---|
| **VP9 dense GOP** `wash_vp9_g8.webm` | libvpx-vp9 -g 8 -keyint_min 8 -crf 30 -b:v 0 -row-mt 1 | 4,070,877 B | 5.43 Mbps | 18 (every 0.333 s) | 0.9867 | run1 **123 / 209**, run2 94 / 164, run3 93 / 167, run4 56 / 74 | **166 / 420 / 639** |
| **VP9 default GOP** `wash_vp9_default.webm` | same, no -g | 3,363,897 B | 4.49 Mbps | 2 (0, 5.333 s; libvpx default 128-frame max) | 0.9864 | run1 **358 / 726**, run2 666 / 1359, run3 522 / 1814, run4 345 / 709 | **942 / 2389 / 3050** |
| VP9 GOP 4 `wash_vp9_g4.webm` | -g 4 -keyint_min 4 | 5,469,859 B | 7.29 Mbps | 36 | not measured aligned (about the same as g8) | run2 43 / 57, run3 45 / 87, run4 85 / 128 | 138 / 311 / 612 |
| VP9 g8 1280 w `wash_vp9_g8_1280.webm` | -g 8, 1280x722 | 2,500,253 B | 3.33 Mbps | 18 | n/a | run2 31 / 50, run3 59 / 93, run4 101 / 217 | 90 / 236 / 399 |
| VP9 all-intra `wash_vp9_allintra.webm` | -g 1 | 15,559,069 B | 20.7 Mbps | 144 | n/a | run1 46 / 58, run2 57 / 99, run3 84 / 120, run4 47 / 67 | 147 / 359 / 531 |
| **H.264 dense GOP (skill settings)** `wash_h264_g8_crf20.mp4` | libx264 -preset slow -crf 20 -g 8 -keyint_min 8 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart -an | **6,357,235 B** | **8.48 Mbps** | 18 | 0.9902 | not decoded (no H.264 in this Chromium) | n/a |
| H.264 g8 CRF 23 `wash_h264_g8_crf23.mp4` | same, crf 23 | 4,477,998 B | 5.97 Mbps | 18 | 0.9866 | n/a | n/a |
| H.264 g8 CRF 20 1280 w `wash_h264_g8_crf20_1280.mp4` | same, 1280x722 | 3,472,941 B | 4.63 Mbps | 18 | n/a | n/a | n/a |
| H.264 default GOP CRF 20 `wash_h264_defgop_crf20.mp4` | crf 20, default keyint | 5,518,493 B | 7.36 Mbps | 1 | 0.9895 | n/a | n/a |

Scrub patterns (standalone, run 2, median / p95 ms):

| Encode | Reverse scrub | Forward scrub |
|---|---|---|
| g8 | 81 / 183 | 94 / 144 |
| default | 406 / 1242 | 318 / 504 |
| g4 | 39 / 55 | 45 / 55 |
| 1280 g8 | 29 / 50 | 33 / 51 |

Chromium re-decodes from the preceding keyframe on every seek, so even small forward steps are slow with a long GOP.

Conclusions:
1. A dense GOP is required for scrubbing. g8 seeks about 5.7x faster than the default GOP (paired median and p95) and costs +21% bytes in VP9 and +15% in H.264 at equal SSIM.
2. g4 is only about 17% faster than g8 for +34% bytes. All-intra is not faster under load (bigger frames to parse) and is 3.8x the size. **Use g8.**
3. Resolution matters as much as GOP: 1280-wide g8 is about 0.54x the seek time of 1920 g8. Serve about 1280 w (2.5 MB VP9 / 3.5 MB H.264 CRF 20) to phones and 1916 w to desktop.
4. At equal SSIM, VP9 CRF 30 (4.07 MB) is about 9% smaller than H.264 CRF 23 (4.48 MB).
5. Format choice for real devices. Real Chrome, Safari/iOS and Firefox decode H.264 in hardware, so list **H.264 g8 MP4 first** (CRF 22–23 is enough, about 4.5 MB for 6 s at 1080p) and **VP9 g8 WebM** as a second `<source>`. The WebM covers Chromium builds without proprietary codecs, such as this test browser.
6. Tag the colour on every output: `-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv`.
7. Encode from the master only, and do not upscale 1916 → 1920.

## 6. Output files

- Metrics: `AV/master_metrics.csv`, `AV/signalstats_{porsche-scroll,film-720,film-portrait}.mp4.csv`, `AV/frames_*.csv` (frame type, size, keyframe per frame).
- Sheets: `AV/contact_master_0.5s.png`, `AV/cs_a.png` … `AV/cs_d.png`, `AV/detail/f166_193.png`, `AV/detail/f222_241.png`, `AV/src_stills_sheet.png`.
- Candidate frames (lossless PNG, 1916x1080): `AV/cand/f048.png`, `f054`, `f060`, `f084`, `f096`, `f168`, `f204`, `f210`, `f216`, `f222`, `f300`, `f312`, `f336`, `f360` and others. Comparison sheets: `AV/cand/sheet_hero.png`, `sheet_ppf.png`, `sheet_wash_freeze.png`, `headlight_crops.png`.
- Hero comparison: `AV/hero/poster_warped_to_f0.png`, `AV/hero/crop_{headlight,wheel,rear,wall}_poster_left_f0_right.png`, `AV/hero/poster_car_1to1.png`.
- Sequence crop: `AV/seq/crop_film_d090_left_vs_master_right.png`.
- Seek encodes and results: `AV/seek/*.webm`, `AV/seek/*.mp4`, `AV/seek/seek_results_run{1..4}.json`, `AV/seek/seek_paired_results.json`.
- Scripts: `AV/tools/analyze_master.py`, `poster_vs_frames.py`, `seq_quality.py`, `seek_test.cjs`, `seek_paired.cjs`.
