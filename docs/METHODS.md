# Methods

Everything in Endless Cockpit is a stated rule. Nothing is learned, and it uses no model. Biofeedback Path Cockpit's methods are in [its own page](BIOFEEDBACK.md), and Autonomic Telemetry's in [its repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md).

## Endless Cockpit

The five terrestrial landscapes have separate terrain functions, blended with normalized scene weights: the coast cuts down to a sea plane and adds isolated rock stacks; the tropical preserve has a low rolling forest floor; the meadows have broad field banks; the alpine route opens onto a lake between distant ridges; and the canyon has stepped walls. Rainbow orbit adds a sixth route with a finite-width skyway over open space. The road's width, curvature, wavelength and elevation amplitude also vary by landscape. The camera, terrain shader, elevation preview and cadence-derived grade use the same route parameters.

Palms, broadleaf vegetation, colorful flowers, alpine pines, round country trees, farm buildings, cacti and occasional small wildlife are seeded world-space silhouettes with perspective, parallax and terrain occlusion. They are stylized procedural shapes rather than photorealistic assets. Roadside rails are ray-intersected 3D segments. Objects are evaluated over a bounded distance so riding indefinitely does not grow memory. Scene thumbnails use the same renderer and the correct camera for each route.

Flower clusters and occasional perched or ground birds and lizards stay at fixed seeded positions beside the route. Wildlife is static; passing it creates parallax, without an animal behavior simulation. All landscapes share a fixed placement grid so scene transitions do not reseed these details. Smaller flowers and wildlife are evaluated only near their roadside bounds, and their colors use the landscape's existing lighting and fog.

Terrestrial roads and terrain are a raymarched height field. Rainbow orbit separately intersects a finite ribbon: a ray that misses one crossing keeps searching for later hills, leaving stars visible outside the track. Its road fades by 680 m, with raised capsule rails and sparse arch frames evaluated over bounded distances. The rainbow runs along the road, while stars, a moon and the ringed planet stay fixed in sky direction. Fine star coverage is filtered by pixel size; stars do not blink on a timer.

The scene passes through a feedback loop like Milkdrop's: the last frame is zoomed toward the vanishing point, slightly warped, and mixed under the new frame. Only emitters leave long trails, tracked in the alpha channel, so the sun and sky never smear over the land.

`motion01(rpm)` maps cadence to a 0 to 1 motion value with a set idle, top and response curve. Zoom per frame is exactly that value times the maximum. The road's grade changes speed by a factor from 0.6 to 1.35 after the mapping, so the curve stays truthful. Motion runs on a fixed 1/120 s step. Ride files now include the starting scene, route seed, visual position, distance, time of day and cadence mapping. Playback reproduces those settings and the recorded cadence; timing, smoothing and older files can still produce a different traveled distance. Distance counts driven speed only, never the slow drift shown at rest.

The base visual speed reaches 7 m/s (about 15.7 mph) at the top of the cadence mapping, before the grade factor. This touring pace replaces the previous 18 m/s cap so nearby planting and wildlife remain readable. The displayed speed, accumulated distance and camera travel use the same driven speed. It is a procedural pace, not a measurement of real bicycle speed.

Cadence comes from a Bluetooth CSC or FTMS sensor, the hold-to-pedal button at 88 rpm, or a steady setting, in that order. A sensor reading older than 3 seconds counts as stopped. On the five land routes, each full crank revolution sends one ring of light down the road, and dashes are spaced one per revolution. Rainbow orbit keeps continuous color bands and steady edge lighting. The ridge on the horizon is stated value noise that drifts past as you ride. It is not a measurement.

Known software WebGL renderers start with an approximately 80,000-pixel scenery buffer and smaller thumbnails; interface text stays at screen resolution. Sustained slow frames reduce scenery resolution promptly, including on devices that hide renderer metadata. Hardware renderers retain the normal starting budget.

The default Clear look keeps the scenery legible, with low feedback and no floating motes. Dreamy and Wild retain the more abstract light treatments.

With New scenery every mile on, the next of the six scenes blends in each time the distance ridden passes another mile. Distance counts only the speed your cadence makes, so a stopped ride keeps its scene, and a replay keeps the scenes it recorded. A blend takes six seconds, and a scene chosen mid-blend starts from what is on screen, so the picture never jumps. The scene tiles are drawn by the road's own shader at 336 by 196 pixels, sharp on 2x and 3x screens, at the current time of day, and redrawn when the sky has moved on.

## What is stored

A ride file holds cadence ten times a second, a starting route/settings snapshot, and scene, time-of-day and route changes. It holds no audio and no other reading. Video capture runs only if you tick it, and saves to your own computer. The scene, time of day, look and the every-mile switch stay in the browser's local storage, so the next visit starts where the last one ended.

## Safety

A limiter in the final pass tracks local average luminance on a grid 128 cells wide, allowing changes of 0.36 per second in either direction, or 0.16 with reduced motion. It adjusts the finished picture from those regional averages. This does not bound every pixel: moving high-contrast silhouettes can still change rapidly within a region, so the rendered result must be measured. Reduced motion also removes the crash flash and reduces the camera's shake, surge and rotation.

Endless Cockpit caps this adjustment's brightness gain at 1: it can dim the image but cannot brighten passing foliage. The previous gain of up to 4 could amplify moving contrast into bright flashes. Foliage edges use projected pixel coverage, with fine leaflet patterns fading toward their average once too small to resolve. These changes keep the Clear view sharp. Biofeedback retains its existing gain setting.

Endless Cockpit's far range is slow procedural noise, and its rings of light fade before they reach the horizon, where they would stack.

`tests/flash_check.py` measures the result on the rendered page with the WCAG 2.2 general flash definition. See [Validation](VALIDATION.md).
