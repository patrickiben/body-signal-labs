# Biofeedback Path Cockpit

A road whose weather, grade and fog follow your body. Heart and cadence input run directly in Chrome or Edge. Optional Muse S brainwave drive uses the local Mac bridge. It is not a medical device.

Cadence is **measured** when a sensor reports it. Everything about your state is **inferred**, and the page labels it so. It replaces the older local page `Biofeedback_Path_Cockpit.html`, whose arousal weather always came from a hidden synthetic script.

## Shared scenery

The main screen and the Route sheet offer the same nine environments as Endless Cockpit: Golden coast, Tropical, Meadow lanes, Autumn Lake, Red canyon, Rainbow orbit, Misty ridges, Snake Way and Tron grid. Autumn Lake replaces the alpine-lake choice with lakeside woodland, red/orange/gold foliage, evergreens and rocky bluffs. Snake Way is a pale, scaled serpent road with raised spines above golden clouds. Misty ridges keeps the original Biofeedback mountain road, mist, teal edges and drifting lights.

The shared renderer and route functions live in `src/cyclingscene.js`. Watch's inferred weather and Train's breathing/fog controls retain their existing signal calculations. Scene choice does not change which measurements or inference rules those modes use. These are stylized procedural environments, not recorded places.

## What drives what

| Signal | Mode | Effect | Kind |
|---|---|---|---|
| Cadence | default drive | Speed and zoom, through the same curve as Endless Cockpit | Measured from a sensor; the slider, pedal button and workout are labeled manual |
| Muse S EEG balance | Ride with Brainwaves | Calibrated speed and steadiness, with no cadence requirement | Experimental game proxy, not measured mental clarity |
| Inferred arousal index | Watch | The gas cloud grows wider, brighter and warmer, the sky charges toward dusk by up to 0.2, and warp rises by up to 0.5 | Inferred |
| Heart rate above baseline | Ride with cadence | Up to 4.5% of apparent grade, which slows you. Shown apart from the road's own grade. The zoom never changes | Inferred |
| Swing at pace | Train | Clarity lifts the fog. A held clarity of 0.6 brings dawn | Proxy |
| Heart rate history | Signal view and land-scene horizons | The last two minutes of heart rate remain available for inspection | Measured |
| Heart rate | cadence modes | A subtle brightness pulse follows the reported rate; reduced motion removes it | Measured rate, not measured beat timing |

## Sensors

Web Bluetooth, read directly by the page:

- **Heart Rate service (0x180D, 0x2A37).** Rate, plus beat intervals in 1/1024 s if the sensor sends them, and the skin-contact flag.
- **Hume Band.** The same two commands as Autonomic Telemetry's `bridge/hume.py` (service `fff0`, write `fff6`, notify `fff7`), renewed every 20 seconds. Rate only. A reply of zero is warm-up, not 0 bpm. This direct path has not been run against a real band.
- **Cycling Speed and Cadence (0x2A5B)** and **Fitness Machine indoor bike data (0x2AD2)**. Smart trainers also support FTMS control point (`0x2AD9`), syncing real-time procedural road grade to trainer resistance in 0.1% slope increments. A crank that stops sends the same event time again, so cadence reads zero after 2 seconds with no new crank event.

Each sensor's state is one of: not connected, waiting for you to choose, connecting, **permission denied** (the browser refused), **no sensor found** (nothing chosen, or Bluetooth off), **connected with no reading** (silence, warm-up, no skin contact, or a speed-only sensor), live, disconnected, or could not connect. A browser without Web Bluetooth, a plain http page and the desktop app's window each say so before any click.

## Features from beat intervals

Over the last 32 seconds: at least 20 intervals. Intervals outside 333 to 1500 ms, or more than 25% from the window's median, are dropped and never repaired. If more than a tenth drop, the window is rejected. RMSSD uses only adjacent kept pairs, and an RMSSD above 250 ms is treated as artifact. SDNN is the sample standard deviation of the kept intervals. These follow Autonomic's optical gates in `bridge/features.py`, with dropping in place of rejecting the window for one bad beat.

## The index

The index is Autonomic Telemetry's engine, `multivariate-1`, copied unchanged into `src/vendor/autonomic/` from autonomic-telemetry at 8a2f1c9. Its rules are in [Autonomic's methods](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md): a personal reference from 120 seconds of quiet data, fixed coverage, a five-second median, and tiers at 25, 46 and 68. With a strap that reports beat intervals the profile is heart rate, pulse RMSSD and pulse SDNN, 75 of 100 nominal points. With a rate-only sensor it is the explicitly limited heart-rate profile.

Pedaling raises heart rate on its own, so any cadence above 15 rpm is passed to the engine as movement, and the engine withholds the index rather than reading exercise as arousal. Waiting, stale and held estimates take the index off the sky, which drifts back to ambient.

## Ride

Grade-load is `clamp((HR − baseline) / full, 0, 1) × 4.5%`. The baseline is your reference's mean heart rate when one exists, and otherwise the lowest 10-second mean since the sensor connected. Full is +60 bpm by default and adjustable. Speed is `motion × 18 m/s × clamp(1 − 5 × (route grade + grade-load), 0.6, 1.35)`, and zoom is `motion × max zoom`, so nothing inferred touches the zoom.

Both cockpits use `src/cadence-motion.js` for cadence motion, at a fixed 1/120-second step. Cadence approaches its target with a 0.32-second time constant for sensor and manual input alike, with a small final decay to exact zero. Grade-load approaches its target over two seconds. The idle visual drift is 2.2 m/s in Watch/Ride and 1.5 m/s in Train, weighted down as driven motion rises; it never adds to the distance counter. Replay cadence takes priority, then a running demo or live sensor, then Ride's steady setting, held pedal at 88 rpm, and manual workout. Heart grade-load is specific to Biofeedback; Endless uses the road grade alone.

## Brainwaves drive

Choose **Brainwaves** in Ride and follow [EEG setup](EEG_SETUP.md). This drive uses the bridge’s EEG beta/alpha ratio and quality fields, independently of heart rate, optical pulse and cadence. The bridge checks four-second EEG windows and requires at least two eligible standard channels. The app collects 20 distinct eligible samples, at least 950 ms apart, into an eyes-open personal reference. In log(beta/alpha) space, its fixed center is the median and its scale is 1.4826 × MAD with a floor of 0.15. The bounded game score is `clamp(0.5 + (center − logRatio) / (6 × scale), 0, 1)`. Zero beta is floored at 0.000001 only for the logarithm. Lower beta/alpha relative to that reference increases the game score. The reference is not a mental-state classifier. Eye closure and muscle activity can affect this ratio.

EEG drive uses a separate 7 m/s maximum, with a two-second rise and 1.5-second fall toward the target control. Higher control also reduces camera roll/bob and visual feedback. It does not use heart grade-load, cadence, a manual pedal or ambient road drift.

Only fresh, eligible EEG contributes. Changing the channel/protocol reference requires calibration again. Calibration pauses when data is unusable, and signal loss makes the ride smoothly coast to a stop with a reason. The game score and synthetic/replay provenance are shown separately from cadence. The optional bridge serves the cockpit and stream under the same private local address; no public CORS endpoint or cloud EEG service is added.

## Train

The pacer breathes in for 40% of each breath, 6 breaths a minute by default (4 seconds in, 6 out, as in Autonomic's Rest), from 4.5 to 7. There is no breath sensor. The swing is read at the pacer's own frequency: heart rate over the last two breaths is resampled at 4 Hz, a level, a straight-line drift and a sine at the pacer's frequency are fitted together by least squares, and the swing is twice the sine's amplitude. Fitting the drift alone first would absorb part of the sine. On known inputs it reads a 10 bpm swing as 9.97, a pure drift as 0, and a swing at twice the pace as 0.85.

Clarity is `clamp(swing / full, 0, 1)`, with full at 10 bpm by default and adjustable. Above 0.6, the hold counts up. Below it, the hold falls at half speed, and nothing fails. Dawn rises in 45 seconds while above and falls in 90 while below. Sixty seconds of hold completes the set. With no fresh heart rate, nothing counts either way.

## The demo

A stated script, sent as real packet bytes through the same parsers: a rest that rises toward an arc and recovers over 72 seconds in Watch, heart rate that follows the demo's interval workout in Ride, and a heart-rate swing at the pacer's frequency that grows over 40 seconds in Train. The demo's reference is formed by running 126 seconds of synthetic rest through the same engine before the first frame. The page labels it "Demo · synthetic signals, not your body" the whole time, and a recorded demo session is marked synthetic.

## Sessions and the Ghost Deck

A session file holds cadence ten times a second, distance twice a second, and heart rate, RMSSD, SDNN, the index, the swing, clarity, the hold and dawn once a second, with the mode, scene and route seed. It is your own record, not a medical record, and nothing leaves the computer unless you share it. Completed rides can also be exported directly as standard Training Center XML (`.tcx`) files containing timestamped speed, cadence, elevation and heart-rate tracks compatible with Strava, Garmin Connect, and Apple Health. Replay plays back what was computed, without re-running the model. New files include the starting route, cadence mapping and baseline/settings. Their distance begins at zero when recording starts. The Ghost Deck restores that start and races the recorded distance as a light on the road, with the gap in meters. Older files are rebased to zero and label their starting position as approximate. A ride saved by the older page also replays and races, marked synthetic.

New files identify the shared scene catalog as `cycling-scenes@1`. Files saved before that marker use the original five-scene Biofeedback catalog and `PathScene` renderer, preserving their numeric scene meanings. Re-recording one of those replays retains its original catalog. Recorded EEG game-control values and synthetic labels remain separate from cadence.

## Not verified

No real heart-rate strap, Hume Band or cadence sensor has connected to this page. The device states were driven by a fake Bluetooth stack that sends real packet bytes (`tests/bio_states.py`), and the refusal and plain-http states by real Chrome. The swing and clarity thresholds are game settings. Nothing here has been validated against any physiological outcome, and no expert has reviewed it.
