# Application review — 2026-11-04

This pass covers Endless Cockpit and Biofeedback Path Cockpit, following the six-scenery revision. Autonomic Telemetry is a separately maintained application linked from this collection; its engine was not audited here. The review concentrates on sensor freshness, recording/replay, saved routes, exports and input state.

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

Rainbow orbit is the sixth scene. It preserves the existing five stored indices and adds a suspended rainbow ribbon, raised rails, arches, stars, a moon and a ringed planet. The renderer, route math, thumbnails, sound and replay all recognize it. A compact landscape overlap was fixed during phone review.

## Next improvements worth doing

1. **A scenery playlist and favorites.** Let riders choose which environments automatic cycling visits, and keep a preferred route seed as a bookmark. This would give the current every-mile switch more personal control.
2. **Route previews with useful choices.** Show a small elevation/curvature profile and offer flatter or hillier routes within each environment. Keep their simulated nature explicit; these apps do not control trainer resistance.
3. **Sparing ambient movement.** Slowly moving birds or small wildlife moments would make the static, seeded environments feel more alive. Keep density low and repeat the motion checks before adding them broadly.
4. **Real-device rides.** Test an actual heart strap and cadence/FTMS trainer through disconnects, stopped pedaling, lost skin contact, backgrounding and reconnecting. The automated packet tests cannot establish real hardware compatibility or riding comfort.

Measured checks and limits are in [VALIDATION.md](VALIDATION.md). Changes are in the draft pull request; this review does not imply deployment.
