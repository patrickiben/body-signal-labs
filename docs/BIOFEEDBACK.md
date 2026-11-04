# Biofeedback Path Cockpit

A road whose weather, grade and fog follow your body. It runs in Chrome or Edge with no helper app, and it is not a medical device.

Cadence is **measured** when a sensor reports it. Everything about your state is **inferred**, and the page labels it so. It replaces the older local page `Biofeedback_Path_Cockpit.html`, whose arousal weather always came from a hidden synthetic script.

## What drives what

| Signal | Mode | Effect | Kind |
|---|---|---|---|
| Cadence | all | Speed and zoom, through the same curve as Endless Cockpit | Measured from a sensor; the slider, pedal button and workout are labeled manual |
| Inferred arousal index | Watch | The gas cloud grows wider, brighter and warmer, the sky charges toward dusk by up to 0.2, and warp rises by up to 0.5 | Inferred |
| Heart rate above baseline | Ride | Up to 4.5% of apparent grade, which slows you. Shown apart from the road's own grade. The zoom never changes | Inferred |
| Swing at pace | Train | Clarity lifts the fog. A held clarity of 0.6 brings dawn | Proxy |
| Heart rate history | all | The horizon ridge is the last two minutes, newest in the middle | Measured |
| Heart rate | all | Rings of light run down the road at the current rate | Measured rate, not beat timing |

## Sensors

Web Bluetooth, read directly by the page:

- **Heart Rate service (0x180D, 0x2A37).** Rate, plus beat intervals in 1/1024 s if the sensor sends them, and the skin-contact flag.
- **Hume Band.** The same two commands as Autonomic Telemetry's `bridge/hume.py` (service `fff0`, write `fff6`, notify `fff7`), renewed every 20 seconds. Rate only. A reply of zero is warm-up, not 0 bpm. This direct path has not been run against a real band.
- **Cycling Speed and Cadence (0x2A5B)** and **Fitness Machine indoor bike data (0x2AD2)**. A crank that stops sends the same event time again, so cadence reads zero after 2.5 seconds with no new crank event.

Each sensor's state is one of: not connected, waiting for you to choose, connecting, **permission denied** (the browser refused), **no sensor found** (nothing chosen, or Bluetooth off), **connected with no reading** (silence, warm-up, no skin contact, or a speed-only sensor), live, disconnected, or could not connect. A browser without Web Bluetooth, a plain http page and the desktop app's window each say so before any click.

## Features from beat intervals

Over the last 32 seconds: at least 20 intervals. Intervals outside 333 to 1500 ms, or more than 25% from the window's median, are dropped and never repaired. If more than a tenth drop, the window is rejected. RMSSD uses only adjacent kept pairs, and an RMSSD above 250 ms is treated as artifact. SDNN is the sample standard deviation of the kept intervals. These follow Autonomic's optical gates in `bridge/features.py`, with dropping in place of rejecting the window for one bad beat.

## The index

The index is Autonomic Telemetry's engine, `multivariate-1`, copied unchanged into `src/vendor/autonomic/` from autonomic-telemetry at 8a2f1c9. Its rules are in [Autonomic's methods](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md): a personal reference from 120 seconds of quiet data, fixed coverage, a five-second median, and tiers at 25, 46 and 68. With a strap that reports beat intervals the profile is heart rate, pulse RMSSD and pulse SDNN, 75 of 100 nominal points. With a rate-only sensor it is the explicitly limited heart-rate profile.

Pedaling raises heart rate on its own, so any cadence above 15 rpm is passed to the engine as movement, and the engine withholds the index rather than reading exercise as arousal. Waiting, stale and held estimates take the index off the sky, which drifts back to ambient.

## Ride

Grade-load is `clamp((HR − baseline) / full, 0, 1) × 4.5%`. The baseline is your reference's mean heart rate when one exists, and otherwise the lowest 10-second mean since the sensor connected. Full is +60 bpm by default and adjustable. Speed is `motion × 18 m/s × clamp(1 − 5 × (route grade + grade-load), 0.6, 1.35)`, and zoom is `motion × max zoom`, so nothing inferred touches the zoom.

## Train

The pacer breathes in for 40% of each breath, 6 breaths a minute by default (4 seconds in, 6 out, as in Autonomic's Rest), from 4.5 to 7. There is no breath sensor. The swing is read at the pacer's own frequency: heart rate over the last two breaths is resampled at 4 Hz, a level, a straight-line drift and a sine at the pacer's frequency are fitted together by least squares, and the swing is twice the sine's amplitude. Fitting the drift alone first would absorb part of the sine. On known inputs it reads a 10 bpm swing as 9.97, a pure drift as 0, and a swing at twice the pace as 0.85.

Clarity is `clamp(swing / full, 0, 1)`, with full at 10 bpm by default and adjustable. Above 0.6, the hold counts up. Below it, the hold falls at half speed, and nothing fails. Dawn rises in 45 seconds while above and falls in 90 while below. Sixty seconds of hold completes the set. With no fresh heart rate, nothing counts either way.

## The demo

A stated script, sent as real packet bytes through the same parsers: a rest that rises toward an arc and recovers over 72 seconds in Watch, heart rate that follows the demo's interval workout in Ride, and a heart-rate swing at the pacer's frequency that grows over 40 seconds in Train. The demo's reference is formed by running 126 seconds of synthetic rest through the same engine before the first frame. The page labels it "Demo · synthetic signals, not your body" the whole time, and a recorded demo session is marked synthetic.

## Sessions and the Ghost Deck

A session file holds cadence ten times a second, distance twice a second, and heart rate, RMSSD, SDNN, the index, the swing, clarity, the hold and dawn once a second, with the mode, scene and route seed. It is your own record, not a medical record, and nothing leaves the computer unless you share it. Replay plays back what was computed, without re-running the model. New files include the starting route, cadence mapping and baseline/settings. Their distance begins at zero when recording starts. The Ghost Deck restores that start and races the recorded distance as a light on the road, with the gap in meters. Older files are rebased to zero and label their starting position as approximate. A ride saved by the older page also replays and races, marked synthetic.

## Not verified

No real heart-rate strap, Hume Band or cadence sensor has connected to this page. The device states were driven by a fake Bluetooth stack that sends real packet bytes (`tests/bio_states.py`), and the refusal and plain-http states by real Chrome. The swing and clarity thresholds are game settings. Nothing here has been validated against any physiological outcome, and no expert has reviewed it.
