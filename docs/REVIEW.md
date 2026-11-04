# Application review — 2026-11-04

This pass covers Endless Cockpit and Biofeedback Path Cockpit, including their shared scenery and cadence motion. Autonomic Telemetry is a separately maintained application linked from this collection; its engine was not audited here. The review concentrates on sensor freshness, recording/replay, saved routes, exports and input state.

## Repairs

| App | Problem | Result |
| --- | --- | --- |
| Biofeedback | Stopping video recording accessed a cleared recorder. | Each take keeps its own recorder/chunks and releases its canvas capture tracks after export. |
| Biofeedback | A recording that began before the demo could save synthetic readings with a non-synthetic label. | Provenance accumulates throughout recording, including a replay of synthetic data. |
| Biofeedback | A no-contact heart packet left the previous heart rate looking live until a timeout. | Contact loss clears the live reading and derived values immediately. |
| Biofeedback | Trainer packets without a cadence field refreshed the age of the previous cadence. | Only actual cadence measurements refresh cadence freshness. |
| Both | Malformed session data could enter replay, poison state or never reach an end. | Structure, times and supported values are checked before replacing the current source. |
| Biofeedback | Ghost distance used the lifetime odometer and replay did not restore its starting route/settings. | New recordings capture the starting state and use distance relative to recording start. Older ghost recordings are normalized. |
| Both | Switching windows while holding the pedal could miss the release event and keep pedaling. | Focus loss or a hidden page releases held manual input. Leaving Biofeedback Ride mode also releases it. |
| Biofeedback | Its methods link still pointed into the former repository and returned 404. | The link points to this repository's methods document. |

## Shared scenes and motion

The cockpits now use one renderer and route catalog for eight scenes: Golden coast, Tropical preserve, Meadow lanes, New England Autumn, Red canyon, Rainbow orbit, Misty pines and Snake Way. New England Autumn replaces the Alpine lake choice with a lakeside road, colorful woodland and rocky bluffs. Misty pines retains the original Biofeedback environment, now also available in Endless. Snake Way adds a scaled road with raised spines above golden clouds. Watch and Train retain their weather and breathing/fog controls and their existing signal calculations.

The shared cadence module preserves Biofeedback's 18 m/s nominal speed, 0.32-second response, braking, curve, grade multiplier and input priority. Endless no longer uses the separate faster Bluetooth response or adds cadence/Space light bars and velocity surges. Its speed, distance and visual travel now follow the same cadence equations as Biofeedback; heart-rate grade-load remains specific to Biofeedback. EEG drive keeps its separate control and 7 m/s maximum.

New recordings identify their scene catalog and motion version. Older Biofeedback files retain the original scene catalog and renderer; older Endless files retain their 7 m/s nominal replay scale. Historical cadence files cannot reconstruct every input response because they saved smoothed cadence without sensor type. The deterministic cadence suite checks numerical parity, source precedence and render-frame grouping; current browser and motion results belong in [VALIDATION.md](VALIDATION.md).

## Optional Muse S Athena drive

Biofeedback Ride now also offers Brainwaves as a separate power source. It uses the existing local Autonomic bridge, an eyes-open personal EEG reference and explicit quality gates. Higher experimental EEG control raises speed and steadiness without a heart or cadence sensor; invalid signals coast to a stop. This is a game mapping, not a validated mental-clarity measure. See [setup](EEG_SETUP.md) and [method](BIOFEEDBACK.md).

## Next improvements worth doing

1. **A scenery playlist and favorites.** Let riders choose which environments automatic cycling visits, and keep a preferred route seed as a bookmark. This would give the current every-mile switch more personal control.
2. **Route previews with useful choices.** Show a small elevation/curvature profile and offer flatter or hillier routes within each environment. Keep their simulated nature explicit; these apps do not control trainer resistance.
3. **Sparing ambient movement.** Slowly moving birds or small wildlife moments would make the static, seeded environments feel more alive. Keep density low and repeat the motion checks before adding them broadly.
4. **Real-device rides.** Test an actual heart strap and cadence/FTMS trainer through disconnects, stopped pedaling, lost skin contact, backgrounding and reconnecting. The automated packet tests cannot establish real hardware compatibility or riding comfort.

Measured checks and limits are in [VALIDATION.md](VALIDATION.md). This review describes the repository changes and does not establish deployment status.
