# Methods

Everything in Endless Cockpit is a stated rule. Nothing is learned, and it uses no model. Biofeedback Path Cockpit's methods are in [its own page](BIOFEEDBACK.md), and Autonomic Telemetry's in [its repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md).

## Endless Cockpit

The road and its hills are a raymarched height field. The scene passes through a feedback loop like Milkdrop's: the last frame is zoomed toward the vanishing point, slightly warped, and mixed under the new frame. Only emitters leave long trails, tracked in the alpha channel, so the sun and sky never smear over the land.

`motion01(rpm)` maps cadence to a 0 to 1 motion value with a set idle, top and response curve. Zoom per frame is exactly that value times the maximum. The road's grade changes speed by a factor from 0.6 to 1.35 after the mapping, so the curve stays truthful. Motion runs on a fixed 1/120 s step, so a replay lands in the same place at any frame rate. Distance counts driven speed only, never the slow drift shown at rest.

Cadence comes from a Bluetooth CSC or FTMS sensor, the hold-to-pedal button at 88 rpm, or a steady setting, in that order. A sensor reading older than 3 seconds counts as stopped. Each full crank revolution sends one ring of light down the road, and the road's dashes are spaced one per revolution. The ridge on the horizon is stated value noise that drifts past as you ride. It is not a measurement.

## What is stored

A ride file holds cadence ten times a second, with scene and route changes. It holds no audio and no other reading. Video capture runs only if you tick it, and saves to your own computer. Settings stay in the browser's local storage.

## Safety

A limiter in the final pass holds each region of the finished picture, on a grid 128 cells wide, to a change of 0.36 in relative luminance per second, in either direction, whatever caused it. A 10% swing therefore takes more than a quarter of a second, which keeps a large area under three flashes a second by construction. Small sparks barely move a region's mean, so they stay instant. The limit tightens to 0.16 under the system's reduced-motion setting, which also removes the crash flash and reduces the camera's shake, surge and rotation.

Endless Cockpit's far range is slow procedural noise, and its rings of light fade before they reach the horizon, where they would stack.

`tests/flash_check.py` measures the result on the rendered page with the WCAG 2.2 general flash definition. See [Validation](VALIDATION.md).
