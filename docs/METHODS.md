# Methods

Everything in Endless Cockpit is a stated rule. Nothing is learned, and it uses no model. Biofeedback Path Cockpit's methods are in [its own page](BIOFEEDBACK.md), and Autonomic Telemetry's in [its repository](https://github.com/patrickiben/autonomic-telemetry/blob/main/docs/METHODS.md).

## Shared cycling scenes

Both cockpits use the nine-scene catalog and renderer in `src/cyclingscene.js`: Golden coast, Tropical, Meadow lanes, Autumn Lake, Red canyon, Rainbow orbit, Misty ridges, Snake Way and Tron grid. The coast has open water and rock stacks; Tropical has a rolling forest floor; the meadows have field banks; Autumn Lake has a lake, rocky bluffs and deciduous woodland mixed with evergreens; the canyon has stepped walls. Misty ridges retains the original Biofeedback mountain road. Rainbow orbit crosses open space, and Snake Way follows a scaled, spiny road above golden clouds. Autumn Lake occupies the former Alpine lake slot.

Scene weights blend evaluated route positions. Width, curvature, wavelength and elevation vary by landscape, and the camera, terrain shader, elevation preview and grade calculation use those same parameters. Biofeedback retains Watch's inferred weather and Train's breathing/fog controls without changing their signal model.

Palms, broadleaf vegetation, flowers, conifers, autumn trees, farm buildings, cacti and occasional small wildlife are seeded world-space shapes with perspective and terrain occlusion. They are stylized procedural geometry rather than photographic assets. Roadside rails are ray-intersected 3D segments. Objects are evaluated over bounded distances so travel does not accumulate an ever-growing scene. Endless thumbnails use the same renderer and route camera.

Flower clusters and occasional perched or ground birds and lizards stay at fixed seeded positions beside the route. Wildlife is static; passing it creates parallax, without an animal behavior simulation. All landscapes share a fixed placement grid so scene transitions do not reseed these details. Smaller flowers and wildlife are evaluated only near their roadside bounds, and their colors use the landscape's existing lighting and fog.

Land roads and terrain are raymarched height fields. Rainbow orbit and Snake Way separately intersect a finite road ribbon: a ray that misses one crossing keeps searching for later hills, leaving space or clouds visible outside the track. Rainbow orbit has raised rails and sparse arch frames; Snake Way has a pale scaled surface and raised spines beside it. The rainbow runs along the road, while its stars, moon and ringed planet stay fixed in sky direction. Fine star coverage is filtered by pixel size; the orbit stars do not blink on a timer.

The scene passes through a feedback loop like Milkdrop's: the last frame is zoomed toward the vanishing point, slightly warped, and mixed under the new frame. Only emitters leave long trails, tracked in the alpha channel, so the sun and sky never smear over the land.

## Cadence motion

Both apps use the pure functions in `src/cadence-motion.js`, preserving Biofeedback's cadence motion. Simulation runs at 1/120-second steps independently of rendering. Cadence approaches the selected target with a 0.32-second time constant for both Bluetooth and manual input; a small final decay brings it to exact zero. The mapping is:

```text
motion = clamp((rpm − idle) / max(1, top − idle), 0, 1) ^ (1 / gamma)
zoom = motion × maxZoom
speed = motion × 18 m/s × clamp(1 − 5 × grade, 0.6, 1.35)
```

Defaults are idle 25 rpm, top 95 rpm, gamma 1.6 and maxZoom 0.018. The nominal top speed is 18 m/s before grade (about 40.3 mph), matching Biofeedback. This is simulated travel, not measured bicycle speed. Biofeedback adds its separately labeled heart-rate grade-load to route grade; Endless uses route grade alone. The grade multiplier affects speed, never the cadence-to-zoom curve. At rest, visual position drifts at 2.2 m/s in Ride, weighted by `1 − motion`; that drift never adds to the distance counter. Biofeedback Train retains its 1.5 m/s idle drift.

Replay cadence has priority. Otherwise a running demo or live sensor supplies cadence, followed by a steady manual setting, the held pedal at 88 rpm, and Biofeedback's manual workout. A fresh reported zero is a stopped source, not permission to switch to manual input. Endless uses sensor readings only while they are less than three seconds old; after signal loss, an active manual setting can take over. Its held Space/pedal input uses the same smooth response; it adds no camera kick, surge velocity or cadence-triggered road-light bars. The Endless horizon ridge is procedural noise, not a measurement.

Biofeedback's optional EEG drive remains separate: it uses its own 7 m/s maximum and signal-quality handling, without cadence, heart grade-load or idle drift. See [Biofeedback methods](BIOFEEDBACK.md).

The [cadence regression suite](../tests/cadence_motion.cjs) compares the shared implementation with the preserved Biofeedback equations, including acceleration, braking, grade, input priority and fixed-step travel grouped into different rendering frame rates.

## Endless presentation

Known software WebGL renderers start with an approximately 80,000-pixel scenery buffer and smaller thumbnails; interface text stays at screen resolution. Sustained slow frames reduce scenery resolution promptly, including on devices that hide renderer metadata. Hardware renderers retain the normal starting budget.

The default Clear look keeps the scenery legible, with low feedback and no floating motes. Dreamy and Wild retain the more abstract light treatments.

With New scenery every mile on, the next of the nine scenes blends in each time driven distance passes another mile. A stopped ride keeps its scene, and a replay keeps its recorded scene changes. A blend takes six seconds; choosing a scene mid-blend starts from the currently blended route. Thumbnails use the road renderer and current time of day, with a smaller rendering budget on known software renderers.

## What is stored

A ride file holds cadence ten times a second, a starting route/settings snapshot, and scene, time-of-day and route changes. It holds no audio and no other reading. Video capture runs only if you tick it, and saves to your own computer. The scene, time of day, look and the every-mile switch stay in the browser's local storage, so the next visit starts where the last one ended.

New exports identify the shared catalog as `cycling-scenes@1` and the cadence mapping as `routeStart.motionVersion: "biofeedback-cadence@1"`. Endless recordings without that motion marker retain their former 7 m/s nominal scale during replay. Recorded cadence was already smoothed; replay timing and re-smoothing can still change traveled distance, and old recordings do not encode sensor-specific response times. This is compatibility playback, not exact reconstruction. Biofeedback recordings without the new scene-catalog marker keep their original five-scene catalog and renderer; their scene numbers are not reinterpreted as the new environments.

## Safety

A limiter in the final pass tracks local average luminance on a grid 128 cells wide, allowing changes of 0.36 per second in either direction, or 0.16 with reduced motion. It adjusts the finished picture from those regional averages. This does not bound every pixel: moving high-contrast silhouettes can still change rapidly within a region, so the rendered result must be measured. Reduced motion also calms camera rotation, bob and visual feedback.

Endless Cockpit caps this adjustment's brightness gain at 1: it can dim the image but cannot brighten passing foliage. The previous gain of up to 4 could amplify moving contrast into bright flashes. Foliage edges use projected pixel coverage, with fine leaflet patterns fading toward their average once too small to resolve. In Tropical, that footprint also grows with actual riding speed and projected leaf motion, a 60 ms travel exposure: nearby foliage softens at high speed while stationary foliage stays crisp. The dense canopy against bright sky needs it. Removed on 2026-11-07 to match the other routes' look, Tropical flashed far above the WCAG 2.2 limit; it was restored on 2026-11-08 at about a third of the earlier 160 ms, which keeps Tropical close to the other routes and still passes with a wide margin. The other routes do not flash and do not use it. Tropical layers use alpha-over composition and conservative bounds to avoid cutting holes or edges into overlapping canopies. The road does not receive this additional foliage filtering. Biofeedback retains its existing brightness-gain setting.

`tests/flash_check.py` measures sampled rendered cases using the WCAG 2.2 general flash definition. Results apply to the recorded scene, speed and settings; earlier tests of the former 7 m/s Endless build do not validate every combination at the shared 18 m/s scale. See the dated results and limitations in [Validation](VALIDATION.md).
