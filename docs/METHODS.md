# Methods

Everything in Endless Cockpit is a stated rule. Nothing is learned, and it uses no model. Biofeedback Path Cockpit's methods are in [its own page](BIOFEEDBACK.md), and Autonomic Telemetry's in [its repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md).

## Endless Cockpit

Each landscape has a separate terrain function, blended with normalized scene weights: the coast cuts down to a sea plane and adds isolated rock stacks; the forest has a low rolling floor; the meadows have broad field banks; the alpine route opens onto a lake between distant ridges; and the canyon has stepped walls. The road's width, curvature, wavelength and elevation amplitude also vary by landscape. The camera, terrain shader, elevation preview and cadence-derived grade use the same route parameters.

Tall pines, round country trees, farm buildings and cacti are seeded world-space silhouettes with perspective, parallax and terrain occlusion. They are stylized procedural shapes rather than photorealistic assets. Roadside rails are ray-intersected 3D segments. Objects are evaluated over a bounded distance so riding indefinitely does not grow memory. Scene thumbnails use the same renderer and the correct camera for each route.

The road and terrain are a raymarched height field. The scene passes through a feedback loop like Milkdrop's: the last frame is zoomed toward the vanishing point, slightly warped, and mixed under the new frame. Only emitters leave long trails, tracked in the alpha channel, so the sun and sky never smear over the land.

`motion01(rpm)` maps cadence to a 0 to 1 motion value with a set idle, top and response curve. Zoom per frame is exactly that value times the maximum. The road's grade changes speed by a factor from 0.6 to 1.35 after the mapping, so the curve stays truthful. Motion runs on a fixed 1/120 s step. Ride files now include the starting scene, route seed, visual position, distance, time of day and cadence mapping. Playback reproduces those settings and the recorded cadence; timing, smoothing and older files can still produce a different traveled distance. Distance counts driven speed only, never the slow drift shown at rest.

Cadence comes from a Bluetooth CSC or FTMS sensor, the hold-to-pedal button at 88 rpm, or a steady setting, in that order. A sensor reading older than 3 seconds counts as stopped. Each full crank revolution sends one ring of light down the road, and the road's dashes are spaced one per revolution. The ridge on the horizon is stated value noise that drifts past as you ride. It is not a measurement.

Known software WebGL renderers start with an approximately 80,000-pixel scenery buffer and smaller thumbnails; interface text stays at screen resolution. Sustained slow frames reduce scenery resolution promptly, including on devices that hide renderer metadata. Hardware renderers retain the normal starting budget.

The default Clear look keeps the scenery legible, with low feedback and no floating motes. Dreamy and Wild retain the more abstract light treatments.

With New scenery every mile on, the next of the five scenes blends in each time the distance ridden passes another mile. Distance counts only the speed your cadence makes, so a stopped ride keeps its scene, and a replay keeps the scenes it recorded. A blend takes six seconds, and a scene chosen mid-blend starts from what is on screen, so the picture never jumps. The scene tiles are drawn by the road's own shader at 336 by 196 pixels, sharp on 2x and 3x screens, at the current time of day, and redrawn when the sky has moved on.

## What is stored

A ride file holds cadence ten times a second, a starting route/settings snapshot, and scene, time-of-day and route changes. It holds no audio and no other reading. Video capture runs only if you tick it, and saves to your own computer. The scene, time of day, look and the every-mile switch stay in the browser's local storage, so the next visit starts where the last one ended.

## Safety

A limiter in the final pass holds each region of the finished picture, on a grid 128 cells wide, to a change of 0.36 in relative luminance per second, in either direction, whatever caused it. A 10% swing therefore takes more than a quarter of a second, which keeps a large area under three flashes a second by construction. Small sparks barely move a region's mean, so they stay instant. The limit tightens to 0.16 under the system's reduced-motion setting, which also removes the crash flash and reduces the camera's shake, surge and rotation.

Endless Cockpit's far range is slow procedural noise, and its rings of light fade before they reach the horizon, where they would stack.

`tests/flash_check.py` measures the result on the rendered page with the WCAG 2.2 general flash definition. See [Validation](VALIDATION.md).
