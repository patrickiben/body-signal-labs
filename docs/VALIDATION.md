# Validation

Checked between 2026-11-02 and 2026-11-08 in Chrome 156 on an Apple M4 Max Mac. **No real cadence sensor or heart-rate strap has connected to either cockpit yet.** The checks a person can do with real gear are listed at the end. Autonomic Telemetry is validated in [its own repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/VALIDATION.md).

A browser test cannot pair a real Bluetooth device, and a page that opens Chrome's device list closes headless Chrome, so every sensor state below uses a stub of `navigator.bluetooth` that sends real packet bytes through the page's own parsers.

## Tropical flicker and the phone title row, 2026-11-08

**The build deployed on 2026-11-07 (a600a02) failed `tests/flash_check.py` in Tropical.** In three runs against the live site, the worst region flashing more than three times a second was 36–46% in Endless Cockpit (Clear, held at golden hour) and 39–50% in Biofeedback Path Cockpit (Ride, high feedback), with and without reduced motion, against the 25% limit. The 2026-11-07 change that made Tropical's motion blur match the other routes had removed its travel exposure, so dense fronds crossing bright sky flashed. Flicker results recorded further down describe earlier builds.

Tropical's foliage is again integrated over a travel exposure, now 60 ms, about a third of the earlier 160 ms, so it stays closer to the other routes' look. On the Tropical cases, 160 ms measured at most 1.2%, 60 ms at most 5.2% over two runs, and 30 ms up to 23.4%, too close to the limit. The same exposure on every route was tried and dropped: it softened roadside detail on routes that do not flash. At speed, Tropical's nearest palms read softer in a still frame than on the other routes; that blur is what keeps them from flashing.

The full suite then passed all 64 cases. Tropical's worst region is now 0.4–4.0%. The worst case overall is 18.2% (Biofeedback, Meadow lanes, high feedback, reduced motion), a route this change does not touch, and no whole-frame count exceeded 1.

On upright phones, Biofeedback's Ride and Train switch sat in the title row, over the app's name and into Try a demo. It now has its own row under the title, and the scenes and the demo's reading move down with it. `tests/layout_check.py` now fails when the switch covers the name, Try a demo, the full-screen button or the scenes: on the 2026-11-07 build it reports 12 problems at three phone sizes, and on this build none at any of its sizes.

The link-preview descriptions and three documents said eight scenes; there are nine, with Tron grid.

## Shared scenery and cadence motion, 2026-11-04

Both cockpits now offer eight scenes, including the preserved Misty ridges mountain road, Autumn Lake in the former Alpine lake slot, and Snake Way above golden clouds. The shared renderer has no traveling road-light bands. Both apps use Biofeedback's existing cadence motion equations; EEG propulsion remains separate.

- `tests/cadence_motion.cjs`: **12/12** checks against the preserved Biofeedback equations, including 432 input-priority combinations, a 100-second variable-cadence/grade trajectory and identical fixed-step results across six rendering frame rates.
- `tests/session_regressions.cjs`: **35/35** checks, including explicit scene catalogs, legacy imports, rejection of incompatible scene-set imports during recording, and missing-baseline recording/replay. Legacy Biofeedback files keep their original renderer. Older Endless files retain their six numeric IDs and former speed scale; scene 3 follows the requested Autumn replacement.
- `tests/shared_scenery_states.py`: **52/52** browser checks. All 16 app/scene combinations rendered, all eight route/grade arrays matched, and 240 actual simulation steps in each scene produced identical cadence state across the apps (maximum difference zero). Real session downloads, replay, the Ghost Deck, Train and EEG modes passed.
- `tests/brainwave_states.py`: **22/22** existing EEG browser checks passed after integration. The **26** EEG controller and **15** bridge HTTP checks also passed.
- Independent route review compared 32 JavaScript/GLSL coefficient pairs and 3,840 blended positions, with zero arithmetic difference. Final scene images were captured from the built pages; the Autumn canopy and cloud sea are stylized procedural scenery.

Release-specific motion captures and responsive-layout results are recorded in [PR #2](https://github.com/patrickiben/body-signal-labs/pull/2). The dated sections below describe earlier builds; their lower-speed motion results do not validate the new cadence scale.

## Muse S Athena Brainwaves drive, 2026-11-04

The optional local launcher reuses Autonomic Telemetry at `6c3ce294a1623649593f2871b364a9053c719ec0`; that dependency checkout was not modified. The isolated `.venv-eeg` requirements installed successfully, and a real-mode launcher boot served the cockpit and reported sequence zero without scanning or connecting, then shut down cleanly. No physical Muse was connected to this cockpit.

- `tests/eeg_drive.cjs`: **26/26** deterministic checks, including private-path configuration, request-start clock alignment, delayed/stale/duplicate frames, reference changes, spaced calibration samples, synthetic isolation, disconnect failures and cleanup.
- `tests/test_brainwave_bridge.py`: **15/15** checks using the actual upstream HTTP handler and a controlled engine. Private paths, configuration order, Host/Origin refusal, traversal/source/symlink denial, same-session events and sibling navigation passed.
- `tests/brainwave_relay.py`: **14/14** checks over the real launcher → HTTP/SSE → browser path, without replacing fetch, EventSource or configuration injection. Eligible synthetic Athena-format fixtures completed a 20-sample reference in 19.36 seconds and drove 2.22 → 5.26 m/s while cadence stayed zero and HR/RMSSD stayed unavailable. Zero-ratio recording/replay, stale-data coast and Disconnect passed. This validates transport and game-control integration, not a headset or mental-state inference.
- `tests/brainwave_states.py`: **22/22** browser state checks cover no automatic pairing, literal device names, calibration, score/speed/steadiness ordering, exclusion of cadence/heart/manual propulsion, source-specific HUD, demo, session provenance, legacy cadence replay, invalid import rejection and recorded coasting.
- Six additional EEG layouts passed from 320 × 568 to 1440 × 900, including 568 × 320 landscape and Connect-sheet controls. Manual screenshot review caught and corrected a compact header overlap and low-contrast HUD labels over a bright horizon. README/home imagery was captured from the labeled built-in EEG demo.
- Two nine-second high-control motion captures, with Wild and Dreamy at maximum, passed under normal and reduced motion. Worst regions above three flashes per second were **1.5%** and **2.4%** against the 25% screen, with **0 whole-frame flashes**. These sampled cases do not cover saturated red flashes or establish personal comfort.

Live EEG is a calibrated spectral game proxy. The bridge's software quality gates do not verify contact, remove every artifact or establish mental clarity. A real Athena session remains the final hardware check.

## Follow-up reliability review, 2026-11-04

The failure cases and further product ideas are recorded in [REVIEW.md](REVIEW.md). `tests/session_regressions.cjs` passed **20/20** deterministic checks covering contact loss, missing versus zero cadence fields, synthetic provenance, malformed session rejection, recording isolation, relative ghost distance and route restoration. The full existing Biofeedback browser state suite passed **45/45**. `tests/pedal_focus.py` passed for both cockpits, covering keyboard/pointer focus loss and hidden pages, plus leaving Biofeedback Ride mode.

`tests/bio_sessions.py` verified mixed-source labeling, invalid import rejection without stopping the demo, relative distance, restored replay/ghost starting state and a real browser video download. The 3,699,487-byte recording was identified as VP9 at 1280 × 800. Sensor packets remain simulated; no new physical-device claim follows from these results. The Node regressions now run in CI.

## Rainbow orbit, 2026-11-04

Rainbow orbit is appended as scene 5, preserving the existing five scene indices. Its finite rainbow ribbon, open space, ringed planet, moon and raised rails were inspected in rendered browser captures. The route/camera calculation, thumbnails, optional ride sound and saved/replayed scene state all include the sixth scene.

The updated state suite passed **34/34** checks, including six visible phone tiles, selection, persistence and automatic wrapping from orbit to coast. The scenery suite rendered all six routes at four travel positions; tested 15 long-distance transition paths and three interrupted transitions; checked mixed land/space frames; restored both alpine and orbit recordings; and produced an actual browser video download. This review caught and corrected a mixed-scene road-height mismatch and aligned the ribbon's bounded ray search with its 680 m fade distance.

All **16 responsive layouts passed**: the existing 14 across both cockpits plus 320 × 568 and 568 × 320 Endless layouts. The compact landscape check caught an options/readouts overlap, now corrected. All six scene choices stay visible.

The motion suite passed **28/28 cases** across normal and reduced motion. The six orbit-specific cases had 0% of regions above three flashes per second; the overall maximum was **21.4%**, below the 25% threshold. The maximum whole-frame count was **1**, below 3. These sampled cases do not establish personal motion comfort or cover saturated red flashes.

All four pages passed the software-rendered smoke suite. A separate SwiftShader orbit ride produced a varied, nonblank frame with no page errors, adapting to a 188 × 106 scenery buffer; interface text remains at screen resolution. The low-resolution fallback is a compatibility path, not evidence of high frame rates on software renderers.

## Scenery revision, 2026-11-03

The five environments were reviewed as rendered screenshots, including riding with the welcome text hidden. They now have distinct landforms, objects and route profiles rather than palette changes alone. The coast screenshot in the home page and README was recaptured from this build.

- `tests/endless_states.py`: **33/33 passed**, including cadence, demo, recording/replay, scenery controls, phone touch and stubbed Bluetooth states.
- `tests/layout_check.py`: **14/14 layouts passed** across both cockpits. All five scenery choices and all nine options stay on screen.
- `tests/scenery_states.py`: all five worlds rendered at 40, 600, 1800 and 4000 metres without blank frames or shader errors; route profiles and widths differ. Long-distance scenery blends at 1.6, 10 and 100 km stay monotonic, and interrupted blends keep the current route position. A saved route restored its starting scene, seed, position, distance and cadence mapping. A real browser MediaRecorder run produced a 1.2 MB, 1440 × 900 VP9 WebM download after Stop; ffmpeg decoded every frame without errors.
- `FLASH_PAGES=endless-cockpit.html python3 tests/flash_check.py`: passed in normal and reduced motion, with the demo disabled before the test verifies cadence above 125 rpm. Worst region above three general flashes per second was **14.7%**, below the test's 25% limit. Whole-frame flashes: **0**. The measured runs rendered at 45.4–60.1 fps on this Mac's Chrome/Metal path; that is not a performance guarantee for other hardware.

The first GitHub Linux/SwiftShader run stalled with the hardware scenery budget. The software-rendering fallback now starts near 80,000 scenery pixels and reacts to two consecutive long frames. A local SwiftShader probe confirmed that path (327 × 245 scenery pixels); the UI remains at full resolution.

This does not validate real Bluetooth gear, saturated red flashes, or personal motion comfort. The shapes are stylized procedural geometry, with world-space roadside silhouettes, rather than photographic locations. Earlier results below describe their dated builds.

### Tropical preserve and wildlife follow-up

The former pine trail is now a tropical nature preserve, with palms, broadleaf understory, orange/red bracts, pink flowers and burgundy leaves. Its occasional perched birds and small lizards were inspected in actual browser captures. The other four routes have smaller flower accents and sparse birds or desert lizards. Wildlife is static and seeded beside the route. Alpine conifers remain separate.

The updated build passed all 33 state checks, all 14 responsive layouts with the tropical route selected, and the five-world scenery, long-distance transition and recording checks. All four pages passed the SwiftShader smoke suite. A separate software-rendered tropical ride reached 70 rpm with a 267 × 150 scenery buffer, a nonblank frame and no page errors. README and home screenshots were recaptured from this build.

The smoke suite now checks actual canvas pixels as well as moving readouts. A separate comparison found the shared renderer's default output pixel-identical to the previous build through brightness transitions and resizes, including its RGBA8 fallback. Biofeedback's ambient and demo scenes remained nonblank and varied, with no page or GL errors.

Dense moving foliage exposed a limitation of the regional brightness adjustment: its upward gain amplified contrast and could make leaves flash. The final build combines projected-pixel foliage coverage, a 7 m/s base touring pace and an Endless-only gain cap of 1. The Clear view remains sharp.

The expanded flicker suite captures before analyzing and stops its timers between cases. It checks the demo, top-cadence scene changes, day/night changes in all five worlds, and tropical daylight/night held steady in both Clear and Wild, under normal and reduced motion. All **22 cases passed**: the worst region above three flashes per second was **21.4%** against the test's 25% limit, with **0 whole-frame flashes**. Clear held daylight measured 12.3% with normal motion and 17.5% with reduced motion. This is a measured screen for these cases, not a guarantee for every route or of personal motion comfort; saturated red flashes are not tested.

## Endless Cockpit

Endless Cockpit takes its speed from cadence only. `tests/endless_states.py` drives it on the rendered page.

| State | How it was produced |
|---|---|
| At rest | Real |
| Pedaling by hand | A real held Space key |
| Steady cadence | A real slider |
| Demo, and ending it | Real clicks |
| A ride recorded and replayed | Recorded in the page and played back |
| No Web Bluetooth | **Stubbed**, by removing the API |
| Chooser closed with no sensor | **Stubbed** |
| Sensor connected, sending nothing | **Stubbed** |
| Live sensor at 80 rpm | **Stubbed**, with real CSC Measurement bytes |
| Sensor disconnects | **Stubbed** |
| Scene tiles, time of day and looks | Real clicks; each tile's picture is read back and must not be blank |
| New scenery every mile, on and off | Real riding at a steady cadence, with the next change brought close |
| Remembered on the next visit | A real reload |
| A phone upright and held sideways | Phone-sized pages with touch; a finger held on the pedal button |

All 33 checks passed on 2026-11-03, including that the page says nothing about drums, MIDI or tempo, carries no drum engine, and shows the suite bar with itself as the current page. These checks found one defect, fixed on 2026-11-03: a sensor that connected in the page's first three seconds, before sending anything, read as live at 0 rpm. The check now connects right after load, where the old code failed every time.

Known answers: the zoom curve is 0 below idle and 1 at the top, the grade's effect on speed is bounded, and distance does not count the idle drift.

## Biofeedback Path Cockpit

`tests/bio_states.py` passed 45 of 45 checks on 2026-11-03, in this repository's build.

| State | How it was produced |
|---|---|
| Fresh visit, ambient | Real |
| Permission denied | Real. A permissions policy blocks Bluetooth, and Chrome refuses before any list opens |
| Plain http page | Real, through a local host mapping |
| Demo in all three modes, recording, replay, Ghost Deck, reduced motion, phone width | Real clicks |
| No Web Bluetooth | **Stubbed**, as Safari and Firefox would be |
| No sensor chosen, Bluetooth off | **Stubbed** |
| Connected with no reading, no skin contact, live with beat intervals, quiet again, unplugged | **Stubbed** |
| Hume warm-up, reading and refusal; crank and smart-trainer cadence; a stopped crank; a speed-only sensor | **Stubbed** the same way |

In the desktop app's window the API exists but every request is refused, so the page says before any click that it cannot connect sensors there.

Known answers: heart-rate packets in 8 and 16 bits with beat intervals, crank cadence across the 16-bit rollover, smart-trainer half-rpm units, the Hume start and stop checksums byte for byte against Autonomic's bridge, RMSSD of a known series, a rejected window, the swing of a known 10 bpm sine (9.97), the pacer's 40% inhale, grade-load, clarity, and the engine's version.

## Flicker

`tests/flash_check.py` records the rendered page's brightness on every frame and applies the WCAG 2.2 general flash definition: a flash is a pair of opposing changes of at least 10% of maximum relative luminance, with the darker image below 0.80, and the limit is three a second over no more than 25% of a 10 degree field. Each third of the screen stands in for that field. It runs each page's demo and its hardest cases, with and without reduced motion. Endless Cockpit's are top cadence (130 rpm) in the Wild look while the scene changes every 2 seconds, and the time of day flipping between golden hour and night every 1.5 seconds, faster than anyone would tap it. Biofeedback Path Cockpit has no hits to stack, so its hardest cases are the demo in Ride and in Train.

Worst share of any region flashing more than three times a second, on 2026-11-03. The limit is 25%:

| Page | Demo | Hardest | Demo, reduced motion | Hardest, reduced motion |
|---|---|---|---|---|
| Endless Cockpit | 2% | 6.3% changing scenes, 7.1% flipping the time of day | 2% | 6.3% changing scenes, 8.3% flipping the time of day |
| Biofeedback Path Cockpit | 0% | 16.3% in Ride, 0% in Train | 0.4% | 0.8% in Ride, 0% in Train |

The scene changes found a flaw on 2026-11-03: a scene chosen before the last blend finished jumped back to that blend's start. With scenes changing every 2 seconds that read as 21% under reduced motion. A new choice now blends from what is on screen, and the same case reads 6.3%.

The whole frame never flashed in any of these runs. It is a screen, not a certificate. It does not test saturated red flashes, and it says nothing about comfort.

An earlier build of this road was published on 2026-11-02 before this check existed, and it failed the check badly. It was live for about two hours before the limiter described in [Methods](METHODS.md) replaced it. The check stays in this folder so that does not recur.

## Layout

`tests/layout_check.py` renders both cockpits at seven sizes: a desktop, a short laptop window, three phones upright and two held sideways, with touch on the phones. Every control must be fully on screen, even one inside a row that could be swiped, the top controls and the welcome text must not run into the bottom stack, and the page must never scroll sideways. All 14 renders passed on 2026-11-03.

**The first public build failed this.** Held sideways, a phone showed only the demo button and half of the pedal button, because the frame kept a minimum height of 540 pixels and cut off the rest. Its text also told phone users to hold Space. Both were fixed on 2026-11-03, and on a 360-pixel phone Biofeedback's long name no longer pushes the full-screen button off the screen. The first version of the scenery then put the scenes and options in rows you had to swipe, so an upright phone showed three of the five scenes and five of the nine options. The check let that pass because it excused swipeable rows, and it no longer does: the scenes now sit five across with names underneath, and the options fit on two rows.

## The smoke test

`tests/smoke.py`, which CI runs on every push under software rendering, checks that each cockpit boots ambient, labels its demo, moves under it, carries no drum engine and shows the suite bar, and that the home page and field guide load with the bar.

## The app harness

`App_Validation_Harness/web_gate.py` (`endless_cockpit`, `biofeedback_path_cockpit_web`). Gates that need a person are PARTIAL until the author signs. A0, A4 and A8 need the author, A5 and A9's keyboard pass need a person, and A6 runs only on the deployed pages. Neither page is OWNER-APPROVED yet.

## What only real gear can show

Endless Cockpit, with a cadence sensor:
1. The sensor appears in Chrome's chooser and connects.
2. The cadence readout matches the sensor's own app.
3. Stopping the crank brings the road to rest within about three seconds.

Biofeedback Path Cockpit, with a heart-rate strap:
1. The strap appears in Chrome's chooser and connects.
2. The heart rate matches the strap's own app, and a strap that reports beat intervals says so.
3. The index starts only after 120 seconds of quiet data.

## Not tested

Firefox, Edge, Safari, any phone hardware, a real Hume Band on the direct path, and long-duration video recording. Phone width was checked by layout only; short Chrome video capture and file decoding passed in the scenery revision.
