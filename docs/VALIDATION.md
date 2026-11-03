# Validation

Checked on 2026-11-02 and 2026-11-03 in Chrome 156 on an Apple M4 Max Mac. **No real cadence sensor or heart-rate strap has connected to either cockpit yet.** The checks a person can do with real gear are listed at the end. Autonomic Telemetry is validated in [its own repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/VALIDATION.md).

A browser test cannot pair a real Bluetooth device, and a page that opens Chrome's device list closes headless Chrome, so every sensor state below uses a stub of `navigator.bluetooth` that sends real packet bytes through the page's own parsers.

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

All 19 checks passed on 2026-11-03, including that the page says nothing about drums, MIDI or tempo, carries no drum engine, and shows the suite bar with itself as the current page. These checks found one defect, fixed on 2026-11-03: a sensor that connected in the page's first three seconds, before sending anything, read as live at 0 rpm. The check now connects right after load, where the old code failed every time.

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

`tests/flash_check.py` records the rendered page's brightness on every frame and applies the WCAG 2.2 general flash definition: a flash is a pair of opposing changes of at least 10% of maximum relative luminance, with the darker image below 0.80, and the limit is three a second over no more than 25% of a 10 degree field. Each third of the screen stands in for that field. It runs each page's demo and its hardest case, with and without reduced motion. Endless Cockpit's hardest case is a steady 130 rpm. Biofeedback Path Cockpit has no hits to stack, so its hardest cases are the demo in Ride and in Train.

Worst share of any region flashing more than three times a second, on 2026-11-03. The limit is 25%:

| Page | Demo | Hardest | Demo, reduced motion | Hardest, reduced motion |
|---|---|---|---|---|
| Endless Cockpit | 2% | 7% | 2% | 7% |
| Biofeedback Path Cockpit | 0% | 15.5% in Ride, 0% in Train | 0.4% | 13.5% in Ride, 0% in Train |

The whole frame never flashed in any of these runs. It is a screen, not a certificate. It does not test saturated red flashes, and it says nothing about comfort.

An earlier build of this road was published on 2026-11-02 before this check existed, and it failed the check badly. It was live for about two hours before the limiter described in [Methods](METHODS.md) replaced it. The check stays in this folder so that does not recur.

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

Firefox, Edge, Safari, any phone hardware, a real Hume Band on the direct path, and video capture end to end. Phone width was checked by layout only.
