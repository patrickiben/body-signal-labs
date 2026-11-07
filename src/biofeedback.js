/* biofeedback.js: Biofeedback Path Cockpit. A road whose weather, grade and fog follow your body.
   Cadence sets the speed and is measured when a sensor reports it. Everything about your state is inferred, and says so.
   Watch: the index paints the sky. Ride: heart rate adds grade-load. Train: the swing at your breathing pace lifts the fog. */
(function () {
  'use strict';
  const { createGL, createPost } = GLKit;
  const { BIOMES, SCENE_FS, MOTE_VS, MOTE_FS, DREAM_FS, ORBIT_VS, ORBIT_FS } = CyclingScene;
  const SCENE_CATALOG = 'cycling-scenes@1';
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const S = {
    mode: 'watch', rpm: 0, speed: 0, dist: 0, vis: 40, zoom: 0, grade: 0, gradeLoad: 0, surge: 0, roll: 0, tilt: 0.34,
    map: { idle: 25, max: 95, maxZoom: 0.018, gamma: 1.6 }, dream: 0.0, wild: 0.0, seed: 0,
    pedal: false, steady: null, auto: false, autoT: 0, biome: 6, biomeNext: 6, biomeT: 1, fromMix: null, sceneCatalog: SCENE_CATALOG, dusk: 0.74, duskHold: null,
    drivePower: 'cadence', eegDrive: 0, eegScore: null, eegRatio: null, eegValid: false, eegSimulated: false, replayEEG: null, eegBusy: false, motionCalm: 1, effectiveWild: 0,
    load: 0, clarity: 0, dawn: 0, holdT: 0, complete: false, replayRpm: null, ghost: null, ghostGap: null, orbitC: [0, 0.36], orbitA: 0, pulse: 0,
    spaceLattice: false, tod: 0, look: 'clear', autoScene: true, nextSceneAt: 1609.34, stoppedTime: 4, demoRide: false,
  };
  const EEG_MAX_SPEED = 7;
  const MAX_SPEED = CadenceMotion.MAX_SPEED, M_PER_MI = 1609.34, AROUSAL_WILD = 0.5, DUSK_BIAS = 0.2, GRADE_LOAD_MAX = 0.045, CLARITY_TARGET = 0.6, SET_SECONDS = 60;
  const legacyScene = () => S.sceneCatalog !== SCENE_CATALOG;
  const sceneCatalog = () => legacyScene() ? PathScene.BIOMES : BIOMES;
  const currentBiome = (i = S.biomeNext) => sceneCatalog()[i];
  function sceneNow() {
    const t = S.biomeT * S.biomeT * (3 - 2 * S.biomeT);
    return CyclingScene.mixScene(S.fromMix || currentBiome(S.biome), currentBiome(), t);
  }
  const pathX = (z, s) => legacyScene() ? 14 * Math.sin(z * 0.0113 + 1 + S.seed) + 6.5 * Math.sin(z * 0.0271 + 2.2 + S.seed * 1.7) : CyclingScene.pathX(z, S.seed, s || sceneNow());
  const roadY = (z, s) => legacyScene() ? 7 * Math.sin(z * 0.0071 + 0.4 + S.seed) + 3.4 * Math.sin(z * 0.0193 + 1.9 + S.seed * 2.3) + 1.1 * Math.sin(z * 0.0471 + 3.1) : CyclingScene.roadY(z, S.seed, s || sceneNow());
  const gradeAt = (z) => (roadY(z + 3) - roadY(z - 3)) / 6;
  const gradeFactor = CadenceMotion.gradeFactor;
  const motion01 = (rpm) => CadenceMotion.motion01(rpm, S.map);
  function camAt(z, roll, b) {
    const s = b || sceneNow();
    const cx = pathX(z, s), cy = roadY(z, s) + 1.65 + .95 * (s.snake || 0), look = 26;
    let fx = pathX(z + look, s) - cx, fy = roadY(z + look, s) + 1.1 - cy, fz = look;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = fz, ry = 0, rz = -fx;
    const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    let ux = -ry * fz + rz * fy, uy = rx * fz - rz * fx, uz = ry * fx - rx * fy;
    if (uy < 0) { ux = -ux; uy = -uy; uz = -uz; }
    const cr = Math.cos(roll), sr = Math.sin(roll);
    return { cx, cy, fwd: [fx, fy, fz], right: [rx * cr + ux * sr, ry * cr + uy * sr, rz * cr + uz * sr], up: [ux * cr - rx * sr, uy * cr - ry * sr, uz * cr - rz * sr] };
  }

  const bio = createBio();
  const eeg = createEEGDrive();
  const brand = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 3 4 25M12 3l8 22M12 11v3M12 18v3"/><path d="M4 8.5h3.2l1.3-2.4 1.8 5 1.3-2.6h8.4"/></svg>';

  /* ---- the sheets ---- */
  const connectSheet = `
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/><path d="M6.5 12.5h3l1.5-2.5 2 4 1.2-1.5h3.3"/></svg>
      <div class="device-info" id="hr-info" data-tone="idle">
        <strong>Heart-rate sensor <span class="dot"></span></strong>
        <p class="state" id="hr-state">Not connected</p>
        <p class="why" id="hr-why"></p>
      </div>
      <button class="pill" id="hr-connect">Connect</button>
    </div>
    <div class="controls-grid">
      <button class="pill quiet-pill" id="hume-connect">Hume Band instead, experimental</button>
    </div>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><circle cx="7" cy="16" r="3.5"/><circle cx="17" cy="16" r="3.5"/><path d="m7 16 4-7h4l2 7M9 9h4M11 16l4-7"/></svg>
      <div class="device-info" id="cad-info" data-tone="idle">
        <strong>Cadence sensor <span class="dot"></span></strong>
        <p class="state" id="cad-state">Not connected</p>
        <p class="why" id="cad-why"></p>
      </div>
      <button class="pill" id="cad-connect">Connect</button>
    </div>
    <section class="eeg-connect" aria-labelledby="eeg-title">
      <div class="device-info" id="eeg-info" data-tone="idle"><strong id="eeg-title">Muse S / Athena brainwaves <span class="dot"></span></strong>
        <p class="state" id="eeg-state">Not connected</p><p class="why" id="eeg-why"></p></div>
      <p class="note">An EEG balance game control, calibrated to you. Use Brainwaves in Ride without a cadence sensor.</p>
      <p class="note" id="eeg-setup">Muse S needs the optional private relay. <a href="docs/EEG_SETUP.md">Set up the Muse S connection</a>. The synthetic preview works without it.</p>
      <div class="row-actions"><button class="pill" id="eeg-start">Find Muse S</button><button class="pill" id="eeg-scan">Scan again</button><button class="pill" id="eeg-disconnect">Disconnect</button></div>
      <label class="field">Headset<select id="eeg-device"><option value="">No Muse found yet</option></select></label>
      <div class="row-actions"><button class="pill primary" id="eeg-pair">Pair selected headset</button><button class="pill" id="eeg-calibrate">New personal reference</button></div>
      <p class="note" id="eeg-reference">Keep your eyes open and sit still for 20 eligible samples (~20 seconds) after the initial 4-second EEG buffer.</p>
      <progress id="eeg-progress" max="1" value="0" aria-label="EEG personal reference progress"></progress>
      <p class="note" id="eeg-quality" role="status">No usable EEG data yet.</p><p class="note" id="eeg-transport"></p>
    </section>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M7 5v14l11-7z"/></svg>
      <div class="device-info">
        <strong>No sensor here</strong>
        <p class="why">The demo is a synthetic body and crank. With Brainwaves selected in Ride, it also previews a clearly labeled synthetic EEG control. Body and crank samples use the same parsers and inference engine. The EEG preview simulates only the game control, with no headset reference claimed. All demo data is labeled on screen.</p>
      </div>
      <button class="pill" id="demo-sheet">Run demo</button>
    </div>
    <details id="sensor-help"><summary>Which sensors work</summary>
      <ol>
        <li><b>Heart rate.</b> Anything offering the standard Bluetooth Heart Rate service should appear in the list. A sensor that reports beat intervals adds RMSSD and SDNN. One that reports rate alone gives an explicitly limited estimate.</li>
        <li><b>Hume Band.</b> Uses the same two commands as Autonomic's Mac bridge, sent directly. Rate only, with about 15 seconds of warm-up.</li>
        <li><b>Muse S.</b> Brainwave-only Ride uses EEG features from the optional private Autonomic relay. <a href="docs/EEG_SETUP.md">Connection setup</a>. Pairing is always your choice.</li>
        <li><b>Cadence.</b> A Bluetooth cadence sensor or a smart trainer. A speed-only sensor has no crank data and reads as no signal.</li>
        <li><b>Browser.</b> Direct Bluetooth needs Chrome or Edge, on https or localhost. Safari and Firefox have no Web Bluetooth. The desktop app's window cannot show the Bluetooth list, so connect from a browser.</li>
      </ol>
    </details>`;

  const routeSheet = `
    <div class="field"><div class="row"><span>Scene</span><b id="scene-name">Misty ridges</b></div><div class="row-actions" id="biome-row" role="group" aria-label="Scenery"></div><p class="note" id="scene-description"></p></div>
    <label class="field" style="margin-top:12px">Time of day, in Watch and Ride<select id="tod"><option value="auto">Set by the mode</option><option value="0.18">Golden hour</option><option value="0.36">Sunset</option><option value="0.55">Dusk</option><option value="1">Night</option></select></label>
    <div class="row-actions"><button class="pill" id="new-route">New route</button><button class="pill" id="ride-sound">Ride sound: off</button></div>
    <div class="sig-title"><span>Route ahead</span><span id="grade-read">grade 0%</span></div>
    <canvas class="sig-canvas" id="elstrip" width="880" height="110" role="img" aria-label="Elevation of the procedural route ahead"></canvas>
    <p class="note">The route is procedural and seeded, not a real GPS track.</p>

    <details id="ride-controls"><summary>Ride without a sensor</summary><div class="controls-grid" style="padding:10px 0 0">
      <p class="note" style="margin:0">These move the road by hand, and the page labels them manual. They are not your cadence.</p>
      <div class="row-actions"><button class="pill" id="auto-ride">Interval workout: off</button></div>
      <label class="field"><div class="row"><span>Steady cadence</span><b id="steady-v">off</b></div><input type="range" id="steady" min="0" max="120" value="0"></label>
    </div></details>

    <details id="load-controls"><summary>Grade-load and clarity</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Full grade-load at this far above your baseline</span><b id="full-over-v"></b></div><input type="range" id="full-over" min="20" max="100" step="5"></label>
      <label class="field"><div class="row"><span>Full clarity at this heart-rate swing</span><b id="full-swing-v"></b></div><input type="range" id="full-swing" min="6" max="16"></label>
      <p class="note" style="margin:0">Yours to set. These are game settings, not physiological limits.</p>
    </div></details>

    <details id="look"><summary>Look</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Dream, how much of the last frame stays</span><b id="dream-v"></b></div><input type="range" id="dream" min="0" max="100"></label>
      <label class="field"><div class="row"><span>Wildness, warp and color split</span><b id="wild-v"></b></div><input type="range" id="wild" min="0" max="100"></label>
    </div></details>

    <details><summary>Rainbow orbit</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="check"><input type="checkbox" id="space-lattice"> Space corridor frames on Rainbow orbit</label>
      <p class="note" style="margin:0">Echoes Autonomic Console's Rest light frames along the floating track. Off by default to keep the road calm.</p>
    </div></details>

    <details id="mapping"><summary>Cadence to motion</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Idle cadence, no motion below</span><b id="v-idle"></b></div><input type="range" id="m-idle" min="0" max="60"></label>
      <label class="field"><div class="row"><span>Top cadence, full speed above</span><b id="v-max"></b></div><input type="range" id="m-max" min="60" max="130"></label>
      <label class="field"><div class="row"><span>Zoom per frame at top speed</span><b id="v-zoom"></b></div><input type="range" id="m-zoom" min="4" max="40"></label>
      <label class="field"><div class="row"><span>Response curve</span><b id="v-gamma"></b></div><input type="range" id="m-gamma" min="60" max="320"></label>
      <div class="sig-title" style="margin:6px 0 0"><span>Cadence to zoom</span><span>live dot</span></div>
      <canvas class="sig-canvas" id="curve" width="880" height="170" role="img" aria-label="Transfer curve from cadence to zoom, with the live value"></canvas>
    </div></details>`;

  const sessionSheet = `
    <div class="row-actions">
      <button class="pill primary" id="rec-toggle">Start recording</button>
      <button class="pill" id="export-tcx">Export TCX</button>
      <button class="pill" id="replay-load">Replay a session file</button>
      <button class="pill" id="replay-stop" hidden>Stop replay</button>
      <button class="pill" id="snapshot">Save a picture</button>
      <input type="file" id="replay-file" accept="application/json,.json" hidden>
    </div>
    <label class="check"><input type="checkbox" id="rec-video"> Also save a video of the screen</label>
    <p class="note" id="rec-status" role="status">Not recording.</p>
    <div id="session-analysis"></div>
    <details id="ghost-deck" open><summary>Ghost Deck</summary><div class="controls-grid" style="padding:10px 0 0">
      <p class="note" style="margin:0">Race an earlier ride on the same hills. It runs ahead of you or behind you as a light on the road.</p>
      <div class="row-actions">
        <button class="pill" id="ghost-last" disabled>Race your last ride</button>
        <button class="pill" id="ghost-load">Race a session file</button>
        <button class="pill" id="ghost-stop" hidden>Stop the race</button>
        <input type="file" id="ghost-file" accept="application/json,.json" hidden>
      </div>
      <p class="note" id="ghost-status" role="status" style="margin:0">No ghost loaded.</p>
    </div></details>`;

  const signalSheet = `
    <div class="statgrid">
      <div class="stat"><span class="k">Heart rate</span><span class="v" id="sig-hr">-</span><span class="n" id="sig-hr-n">no source yet</span></div>
      <div class="stat"><span class="k">RMSSD</span><span class="v" id="sig-rmssd">-</span><span class="n" id="sig-rmssd-n">from beat intervals</span></div>
      <div class="stat"><span class="k">SDNN</span><span class="v" id="sig-sdnn">-</span><span class="n">from the same intervals</span></div>
      <div class="stat"><span class="k">Index</span><span class="v" id="sig-idx">-</span><span class="n" id="sig-idx-n">inferred, not measured</span></div>
      <div class="stat"><span class="k">Reference</span><span class="v" id="sig-ref">-</span><span class="n" id="sig-ref-n">120 s of quiet data</span></div>
      <div class="stat"><span class="k">Swing at pace</span><span class="v" id="sig-swing">-</span><span class="n">a proxy, peak to trough</span></div>
      <div class="stat"><span class="k">Cadence</span><span class="v" id="sig-cad">-</span><span class="n" id="sig-cad-n">no source yet</span></div>
      <div class="stat"><span class="k">Frame rate</span><span class="v" id="sig-fps">-</span><span class="n" id="sig-quality">-</span></div>
    </div>
    <div class="sig-title"><span>Heart rate over the last two minutes</span><span id="sig-hr-range">bpm</span></div>
    <canvas class="sig-canvas" id="sig-trace" width="1400" height="240" role="img" aria-label="Heart rate over the last two minutes"></canvas>
    <div class="sig-title"><span>Beat intervals over the last 32 seconds</span><span id="sig-rr-note">milliseconds</span></div>
    <canvas class="sig-canvas" id="sig-rr" width="1400" height="170" role="img" aria-label="Beat intervals over the last 32 seconds"></canvas>
    <div class="sig-title"><span>Inferred index over the last ten minutes</span><span>lines at 25, 46 and 68</span></div>
    <canvas class="sig-canvas" id="sig-index" width="1400" height="190" role="img" aria-label="Inferred index over the last ten minutes, with the tier boundaries"></canvas>
    <div class="sig-title"><span>How the number is built</span><span id="sig-cover">no reference yet</span></div>
    <table class="maptable" id="sig-table"><thead><tr><th>Channel</th><th>Now</th><th>Reference</th><th>Weight</th><th>Adds</th></tr></thead><tbody id="sig-rows"><tr><td colspan="5">No fixed profile yet.</td></tr></tbody></table>
    <p class="note" id="sig-sum"></p>
    <div class="sig-title"><span>Observed convergence</span><span>not a diagnosis, and not a cause</span></div>
    <div id="sig-events" class="note">None so far.</div>
    <div class="row-actions"><button class="pill" id="ref-reset">Start a new reference</button></div>`;

  const about = `
    <p class="sheet-intro">Every link from your body to the picture is a stated rule. Cadence is measured when a sensor reports it. Everything about your state is inferred.</p>
    <table class="maptable"><tbody>
      <tr><th>Cadence</th><td>Sets speed and zoom unless Brainwaves is selected in Ride. <span class="ep ep-measured">Measured</span> from a sensor only. The slider, the pedal button and the workout are labeled manual.</td></tr>
      <tr><th>Inferred arousal</th><td>Watch only. A higher index makes the gas cloud wider, brighter and warmer, charges the sky toward dusk and adds warp. <span class="ep ep-inferred">Inferred</span> It means intensity, not a feeling.</td></tr>
      <tr><th>EEG balance</th><td>Brainwaves in Ride only. Lower beta/alpha relative to your eyes-open reference of 20 eligible samples gives a higher 0–100 game-control score. That direction is a game rule, not a validated mental-state interpretation. A higher control makes the road faster and steadier; this does not measure mental clarity, attention or health. Missing or poor-quality data gently stops the ride. <span class="ep ep-proxy">Proxy</span></td></tr>
      <tr><th>Heart rate</th><td>Cadence-powered Ride only. Heart rate above your baseline adds up to 4.5% of apparent grade and slows you, shown apart from the road's own grade. The zoom never changes. <span class="ep ep-inferred">Inferred</span></td></tr>
      <tr><th>Swing at pace</th><td>Train only. How far heart rate swings at the pacer's own frequency, over the last two breaths. It lifts the fog. Hold it for 60 seconds and dawn breaks. <span class="ep ep-proxy">Proxy</span></td></tr>
      <tr><th>Horizon</th><td>On the land scenes, the ridge on the horizon shows the last two minutes, newest in the middle. Heartbeats add a subtle brightness pulse; there are no traveling light bands across the road.</td></tr>
      <tr><th>Road</th><td>Nine scenes share the same choices as Endless Cockpit, including the original Misty ridges and Tron grid. Hills and grade are procedural and seeded. Cadence acceleration and coasting use the same motion rules in both apps. <span class="ep ep-proc">Procedural</span></td></tr>
    </tbody></table>
    <p class="note">Keys: hold <b>Space</b> to pedal · <b>1-9</b> scenes · <b>R</b> / <b>B</b> next route · <b>T</b> time of day · <b>L</b> clarity · <b>Z</b> zen mode · <b>Middle click</b> random combo · <b>D</b> demo · <b>C</b> connect · <b>F</b> full screen · <b>H</b> hide controls.</p>
    <details id="is-not" open><summary>What this is, and is not</summary>
      <p><b>Not a medical device.</b> It diagnoses nothing and treats nothing, and it does not detect or predict any condition.</p>
      <p>Inferred arousal is a personal, reference-relative heuristic. It is not measured, and it is not a stress reading. A charged sky is not a verdict about you.</p>
      <p>Train is a paced-breathing practice game, not therapy or treatment. Clarity is a heart-rate proxy, not a score of your health. The page has no breath sensor: it reads the swing at the pacer's frequency.</p>
      <p>A session file is your own record of a ride, not a medical record. Pedaling raises heart rate on its own, so the index waits while you pedal.</p>
    </details>
    <details id="the-model"><summary>The model</summary>
      <p>The index is Autonomic Telemetry's own engine, <code>multivariate-1</code>, unchanged. It forms a personal reference from 120 seconds of quiet data, then scores your shift from it. 0 is your reference, and 25, 46 and 68 are its tier boundaries. These are engineering choices, not clinical cutoffs.</p>
      <p>Heart rate alone is an explicitly limited one-channel profile. If a channel in the reference goes missing, the number is withheld rather than rescaled. It has no validation against any outcome.</p>
      <p>Beat intervals outside 333 to 1500 ms, or more than 25% from the window's median, are dropped and never repaired. If more than a tenth drop, the window is rejected.</p>
      <p class="note" style="margin-bottom:0"><a href="../autonomic-telemetry/docs/METHODS.md">Autonomic's methods</a> · <a href="docs/BIOFEEDBACK.md" rel="noopener">This page's methods</a></p>
    </details>
    <details id="safety"><summary>Safety and privacy</summary>
      <p>Changes in brightness are smoothed. If moving light troubles you, turn on your system's reduced-motion setting: the page then calms the camera and removes the pulse.</p>
      <p>Stop if paced breathing makes you dizzy. Do not ride with your eyes on a screen outdoors.</p>
      <p>Heart rate and cadence are analyzed in this browser. Optional Muse S features arrive from your configured private relay only after you choose Find Muse S; no public service receives them. No session is saved unless you press record.</p>
    </details>
    <details id="credits"><summary>Ideas and code credited</summary>
      <p>The Hume commands follow <a href="https://github.com/brendangooden/j2208-band-tools" rel="noopener">j2208-band-tools</a> (MIT), through Autonomic's bridge. The feedback loop follows <a href="https://github.com/jberg/butterchurn" rel="noopener">Butterchurn</a> (MIT), as an idea only.</p>
    </details>
    <p class="note"><a href="field-guide.html#biofeedback">Read the field guide</a> · <a href="__REPO_URL__" rel="noopener">Source</a></p>`;

  const hudHtml = `
    <div class="hud-set" data-for="watch" hidden>
      <div class="gauge"><span class="k">Heart rate</span><span class="v"><span id="w-hr">--</span><small>bpm</small></span></div>
      <div class="gauge"><span class="k">RMSSD</span><span class="v"><span id="w-rmssd">--</span><small>ms</small></span></div>
      <div class="gauge"><span class="k">Trend</span><span class="v word" id="w-trend">--</span></div>
    </div>
    <div class="hud-set" data-for="ride">
      <div class="gauge"><span class="k">Route grade <span class="ep ep-proc">Procedural</span></span><span class="v"><span id="g-grade">0.0</span><small>%</small></span></div>
      <div class="gauge"><span class="k">Speed</span><span class="v"><span id="g-speed">0.0</span><small>mph</small></span></div>
      <div class="gauge hero"><span class="k"><span id="g-power-label">Cadence</span> <span class="ep" id="ep-cad">Manual</span></span><span class="v" id="g-rpm">--</span></div>
      <div class="gauge"><span class="k">Distance</span><span class="v"><span id="g-dist">0.00</span><small>mi</small></span></div>
      <div class="gauge"><span class="k"><span id="g-load-label">Grade-load</span> <span class="ep ep-inferred" id="g-load-tag">Inferred</span></span><span class="v"><span id="g-load">--</span><small id="g-load-u">%</small></span></div>
      <div class="gauge" id="g-ghost-wrap" hidden><span class="k">Ghost</span><span class="v"><span id="g-ghost">--</span><small>m</small></span></div>
    </div>
    <div class="hud-set" data-for="train" hidden>
      <div class="train-panel">
        <div class="tp-row"><span class="k">Clarity <span class="ep ep-proxy">Proxy</span></span><b id="t-clarity">--</b><span class="tp-hold" id="t-hold">0:00 of 1:00</span></div>
        <div class="tp-bar"><i id="t-bar"></i><u></u></div>
        <div class="tp-row tp-controls">
          <label class="tp-pace"><span>Pace</span><input type="range" id="pace" min="4.5" max="7" step="0.5" value="6" aria-label="Breaths a minute"><b id="pace-v">6.0</b><span>a minute</span></label>
          <button class="pill" id="pace-toggle">Pause</button>
          <button class="pill" id="set-again" hidden>Another set</button>
        </div>
      </div>
    </div>`;

  const TOD = [
    { v: null, label: 'Moving', title: 'A four-minute cycle from golden hour to night (Key: T)' },
    { v: 0.18, label: 'Golden hour', short: 'Golden', title: 'Hold sky at golden hour (Key: T)' },
    { v: 0.36, label: 'Sunset', title: 'Hold sky at sunset (Key: T)' },
    { v: 0.55, label: 'Dusk', title: 'Hold sky at dusk (Key: T)' },
    { v: 1, label: 'Night', title: 'Hold sky at night (Key: T)' },
  ];
  const LOOKS = {
    clear: { label: 'Clear', dream: 0.0, wild: 0.0, title: 'Crisp, unwarped road view (Key: L)' },
    dreamy: { label: 'Dreamy', dream: 0.62, wild: 0.25, title: 'Soft frame persistence and atmospheric glow (Key: L)' },
    wild: { label: 'Wild', dream: 0.86, wild: 1.0, title: 'Amplified chromatic warp and dream trails (Key: L)' },
  };
  const sceneBar = `
    <div class="scenebar chrome" id="scenebar">
      <div class="scene-tiles" id="scene-tiles" role="group" aria-label="Scenery">
        ${BIOMES.map((b, i) => `<button class="scene-tile" data-b="${i}" aria-pressed="${i === S.biomeNext}" title="${b.name} (Key: ${i + 1}) — ${b.description}"><canvas width="336" height="196" aria-hidden="true" style="background:linear-gradient(${b.skyTop},${b.skyHz} 54%,${b.ground} 55%)"></canvas><span>${b.name}</span></button>`).join('')}
      </div>
      <p class="route-caption" id="route-caption">${BIOMES[S.biomeNext].description}</p>
      <div class="scene-row">
        <div class="seg" role="group" aria-label="Time of day">${TOD.map((t, i) => `<button data-tod="${i}" aria-pressed="${i === 0}"${t.title ? ` title="${t.title}"` : ''}${t.short ? ` aria-label="${t.label}"><span class="long">${t.label}</span><span class="short">${t.short}</span>` : `>${t.label}`}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Look">${Object.entries(LOOKS).map(([k, l]) => `<button data-look="${k}" aria-pressed="${k === 'clear'}" title="${l.title}">${l.label}</button>`).join('')}</div>
        <button class="seg-solo" id="auto-scene" aria-pressed="true" aria-label="Auto scenery: new scenery every mile" title="A new scene blends in after each mile you ride"><span class="long">New scenery every mile</span><span class="short">Auto scenery</span></button>
        <button class="seg-solo" id="new-route" title="Generate a new procedural road layout (Keys: R / B for next scene · Middle-click for random combo)">New route</button>
      </div>
    </div>`;

  const stage = `
    ${sceneBar}
    <div class="reading" id="reading" hidden>
      <p class="eyebrow">Inferred arousal · personal</p>
      <div class="read-num" id="read-num">--</div>
      <p class="read-tier" id="read-tier"></p>
      <div class="read-scale" id="read-scale"><i id="read-dot"></i><u id="read-fill"></u></div>
      <p class="read-sub" id="read-sub"></p>
      <p class="read-sub" id="read-cov"></p>
      <button class="read-more" id="read-more">Experimental · reference and signals ↗</button>
    </div>
    <div class="breath" id="breath" hidden>
      <span class="breath-cue" id="breath-cue">Breathe in</span>
      <span class="breath-note" id="breath-note"></span>
    </div>`;

  const shell = mountChrome({
    id: 'biofeedback-path-cockpit', name: 'Biofeedback Path Cockpit', brand,
    modes: [
      { id: 'ride', label: 'Ride', title: 'Ride mode: cadence or brainwaves drive road speed; stopping automatically settles into Watch' },
      { id: 'train', label: 'Train', title: 'Train mode: paced-breathing practice game where heart-rate swing lifts the fog' },
    ], mode: 'watch', modeLabel: 'What your body changes',
    intro: {
      watch: { eyebrow: 'Watch · weather from your signals', title: 'The sky follows your signals.', subtitle: 'Inferred, never measured. Connect a heart-rate sensor, or run the demo.' },
      ride: { eyebrow: 'Ride · cadence sets the speed', title: 'Your legs set the speed.', subtitle: 'Cadence is measured from a sensor. When you stop, the sky watches your signals.' },
      train: { eyebrow: 'Train · a paced-breathing practice game', title: 'Breathe the fog away.', subtitle: 'Follow the ring. A sensor reads how your heart rate swings with it. Not therapy.' },
    },
    onMode: (m) => setMode(m),
    stage, hud: hudHtml,
    beforeBadges: `
      <div class="ride-power chrome" id="ride-power" role="group" aria-label="Ride power"><span>Ride power</span><button class="pill" data-power="cadence" aria-pressed="true" title="Drive road speed from a Bluetooth cadence sensor, smart trainer, or manual pedaling">Cadence</button><button class="pill" data-power="brainwaves" aria-pressed="false" title="Drive road speed from Muse S EEG balance or synthetic preview">Brainwaves</button></div>
      <button class="pill primary chrome" id="pedal" title="Hold with mouse/touch or hold Spacebar to pedal at 88 rpm">Hold to pedal</button>`,
    badges: `
      <button class="source-badge" id="source-badge" data-source="ambient" title="Open the sensor settings"><span class="dot" aria-hidden="true"></span><span id="source-label">Ambient · no sensor connected</span></button>
      <button class="chip chrome" id="chip-hr" data-tone="idle"><span class="dot" aria-hidden="true"></span><span id="chip-hr-text">Heart rate · not connected</span></button>
      <button class="chip chrome" id="chip-eeg" data-tone="idle" hidden><span class="dot" aria-hidden="true"></span><span id="chip-eeg-text">EEG · not connected</span></button>
      <button class="chip chrome" id="chip-cad" data-tone="idle"><span class="dot" aria-hidden="true"></span><span id="chip-cad-text">Cadence · not connected</span></button>`,
    truth: '',
    sheets: [
      { id: 'connect', label: 'Connect', icon: 'connect', title: 'Bring your signals.', intro: 'Heart rate paints the weather and the grade. Cadence sets the speed. Either works directly in a compatible browser. Muse S brainwave control uses an optional private relay.', html: connectSheet },
      { id: 'route', label: 'Route', icon: 'route', title: 'Choose the road.', intro: 'Scenes, time of day and looks are on the main screen. These fine-tune how it looks and moves, and never change the readings.', html: routeSheet },
      { id: 'session', label: 'Session', icon: 'session', title: 'Keep what you rode.', intro: 'A session file holds cadence, heart rate, inferred values and any recorded EEG game control. EEG control is a derived proxy, not a measured mental state. Nothing leaves this computer unless you share the file.', html: sessionSheet },
      { id: 'signal', label: 'Signal', icon: 'signal', title: 'What the page reads.', wide: true, html: signalSheet },
      { id: 'about', label: 'About', icon: 'about', title: 'What drives what.', html: about },
    ],
    onOpenSheet: (name) => { if (name === 'signal') drawSignal(); if (name === 'route') { drawElStrip(); drawCurve(); } },
    toggleDemo,
    onKey: (e, key) => {
      if (key >= '1' && key <= '9') {
        const idx = +key - 1;
        if (BIOMES[idx]) { chooseBiome(idx); shell.toast(`Scenery · ${BIOMES[idx].name}`); }
      } else if (key === 'b' || key === 'r') {
        nextBiome();
      } else if (key === 't') {
        nextTod();
      } else if (key === 'l') {
        nextLook();
      }
    },
  });

  function toggleDemo() {
    if (bio.demoOn) {
      bio.stopDemo();
      S.demoRide = false;
    } else {
      S.demoRide = false;
      bio.startDemo();
    }
    renderStates();
  }

  /* ---- modes ---- */
  const TRUTH = {
    watch: 'Inferred arousal is a personal heuristic, not a medical measurement.',
    ride: 'Speed follows cadence. When stopped, the sky reflects heart signals. Grade-load is inferred from heart rate, and is not a fitness measure. Not a medical device.',
    train: 'A paced-breathing practice game, not therapy or treatment. Clarity is a heart-rate proxy. Not a medical device.',
  };
  function setMode(m) {
    S.mode = m;
    if (m === 'ride') {
      S.stoppedTime = 0;
      if (bio.demoOn) S.demoRide = true;
    } else {
      S.demoRide = false;
    }
    bio.setMode(m);
    if (m !== 'ride') pedalOff();
    S.holdT = 0; S.dawn = 0; S.complete = false; S.clarity = 0;
    document.querySelectorAll('.hud-set').forEach((h) => { h.hidden = h.dataset.for !== m; });
    $('pedal').hidden = m !== 'ride';
    $('truth').textContent = TRUTH[m];
    document.body.dataset.mode = m;
    if (m === 'ride') { $('ride-controls').open = true; }
    bio.noteLane('mode', m);
    renderStates();
  }
  addEventListener('keydown', (e) => { if (e.code === 'Space' && S.mode === 'ride' && S.drivePower === 'cadence' && !e.repeat && !e.target.closest('dialog[open], input, select, button')) { e.preventDefault(); pedalOn(); } });
  addEventListener('keyup', (e) => { if (e.code === 'Space') pedalOff(); });
  function pedalOn() { if (brainRide()) return; S.pedal = true; S.auto = false; syncAuto(); $('pedal').classList.add('on'); }
  function pedalOff() { S.pedal = false; $('pedal').classList.remove('on'); }
  addEventListener('blur', pedalOff);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pedalOff(); });
  $('pedal').addEventListener('pointerdown', (e) => { e.preventDefault(); pedalOn(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => $('pedal').addEventListener(ev, pedalOff));

  /* ---- what each source says, in the same words everywhere ---- */
  const BT_TEXT = {
    idle: ['idle', 'Not connected', ''],
    choosing: ['wait', 'Waiting for you to choose', 'Choose your sensor in the browser list.'],
    connecting: ['wait', 'Connecting', ''],
    denied: ['bad', 'Permission denied', ''],
    'no-device': ['bad', 'No sensor found', ''],
    unsupported: ['bad', 'Not supported in this browser', 'Web Bluetooth needs Chrome or Edge. Safari and Firefox do not have it. The demo still works here.'],
    insecure: ['bad', 'Needs a secure page', 'Web Bluetooth runs only on https or localhost.'],
    lost: ['bad', 'Device disconnected', 'Connect it again to continue.'],
    failed: ['bad', 'Could not connect', ''],
  };
  function heartView() {
    const h = bio.hr;
    if (h.state === 'live') return { tone: 'good', chip: `Heart rate · ${h.deviceBpm} bpm`, state: `Signal · ${h.deviceBpm} bpm`, why: `${h.label} · ${h.reportsBeats ? 'reports beat intervals' : 'rate only, so no RMSSD or SDNN, and a limited estimate'}` };
    if (h.state === 'no-signal') {
      const q = `for ${Math.round(h.quietMs / 1000)} s`;
      const hint = h.noContact ? 'The sensor reports no skin contact. Wet the strap and put it on.' : h.warming ? 'The band is warming up, which takes about 15 seconds.' : 'Put it on. Wet a strap\'s contacts.';
      return { tone: 'warn', chip: 'Heart rate · no signal', state: `Connected · no reading ${q}`, why: `${h.label}. ${hint}` };
    }
    const t = BT_TEXT[h.state] || BT_TEXT.idle;
    return { tone: t[0], chip: `Heart rate · ${t[1].toLowerCase()}`, state: t[1], why: h.detail || t[2] || 'Press Connect, then choose your strap or band in the browser list.' };
  }
  function cadenceView() {
    const c = bio.cadence;
    if (c.state === 'live') { const v = bio.demoOn || bio.replayOn ? '' : ` · ${Math.round(c.rpm || 0)} rpm`; return { tone: 'good', chip: `Cadence${v || ' · signal'}`, state: `Signal${v}`, why: `${c.label} · ${c.kind === 'ftms' ? 'smart trainer' : 'crank sensor'}` }; }
    if (c.state === 'no-signal') return { tone: 'warn', chip: 'Cadence · no signal', state: `Connected · no reading for ${Math.round(c.quietMs / 1000)} s`, why: `${c.label}. ${c.detail || 'Turn the cranks. Most sensors stay silent until they move.'}` };
    const t = BT_TEXT[c.state] || BT_TEXT.idle;
    return { tone: t[0], chip: `Cadence · ${t[1].toLowerCase()}`, state: t[1], why: c.detail || t[2] || 'Press Connect, then choose your sensor or trainer in the browser list.' };
  }
  const manualRide = () => S.mode === 'ride' && S.drivePower === 'cadence' && (S.steady != null || S.pedal || S.auto);
  function sourceView() {
    if (brainRide()) {
      const q = eegReading();
      if (bio.replayOn) return ['replay', q.simulated || bio.syntheticReplay ? 'Replay · EEG control includes synthetic data' : 'Replay · recorded EEG game control'];
      if (bio.demoOn) return ['demo', 'Demo · synthetic EEG preview, not your brainwaves'];
      if (q.simulated) return ['demo', q.valid ? 'Synthetic bridge · EEG game control, not headset data' : `Synthetic bridge · ${q.phase} · no usable EEG control`];
      if (q.valid) return ['live', 'Brainwaves · Muse S · EEG balance proxy'];
      return ['open', `Brainwaves · ${eeg.state.phase} · coasting to a stop`];
    }
    if (bio.demoOn) return ['demo', 'Demo · synthetic signals, not your body'];
    if (bio.replayOn) return ['replay', bio.syntheticReplay ? 'Replay · recording includes synthetic signals' : 'Replay · a recorded session, not live'];
    const h = bio.hr.state === 'live', c = bio.cadence.state === 'live';
    if (h && c) return ['live', 'Live · heart rate and cadence from your sensors'];
    if (h) return ['live', 'Live · heart rate from your sensor'];
    if (c) return ['live', 'Live · cadence from your sensor'];
    if (bio.hr.state === 'no-signal' || bio.cadence.state === 'no-signal') return ['open', 'Connected · no signal'];
    if (manualRide()) return ['manual', 'Manual cadence · no sensor'];
    return ['ambient', 'Ambient · no sensor connected'];
  }
  function cadenceTag() {
    if (brainRide()) return [bio.replayOn ? 'Recorded proxy' : S.eegSimulated ? 'Demo proxy' : 'Proxy', 'ep-proxy'];
    if (bio.demoOn) return ['Demo', 'ep-demo'];
    if (bio.replayOn) return ['Recorded', 'ep-proc'];
    if (bio.cadence.state === 'live') return ['Measured', 'ep-measured'];
    return ['Manual', 'ep-proc'];
  }

  function renderStates() {
    if (!$('hr-state')) return;
    const a = heartView(), c = cadenceView(), [src, label] = sourceView();
    const badge = $('source-badge');
    if (badge.dataset.source !== src) badge.dataset.source = src;
    if ($('source-label').textContent !== label) $('source-label').textContent = label;
    $('chip-hr').dataset.tone = a.tone; $('chip-cad').dataset.tone = c.tone;
    $('chip-hr-text').textContent = a.chip; $('chip-cad-text').textContent = c.chip;
    $('hr-info').dataset.tone = a.tone; $('cad-info').dataset.tone = c.tone;
    $('hr-state').textContent = a.state; $('hr-why').textContent = a.why;
    $('cad-state').textContent = c.state; $('cad-why').textContent = c.why;
    const hOpen = bio.hr.connected, cOpen = bio.cadence.connected, hs = bio.hr.state, cs = bio.cadence.state;
    const verb = (open, s) => (open ? 'Disconnect' : s === 'choosing' || s === 'connecting' ? 'Waiting' : s === 'idle' ? 'Connect' : 'Try again');
    $('hr-connect').textContent = verb(hOpen, hs); $('cad-connect').textContent = verb(cOpen, cs);
    const stuck = (s) => s === 'unsupported' || s === 'insecure' || s === 'choosing' || s === 'connecting';
    $('hr-connect').disabled = stuck(hs); $('cad-connect').disabled = stuck(cs); $('hume-connect').disabled = stuck(hs) || hOpen;
    const spoken = `Heart rate: ${hs.replace('-', ' ')}. Cadence: ${cs.replace('-', ' ')}. ${src === 'demo' ? 'Demo running.' : src === 'replay' ? 'Replay running.' : ''}`;
    if ($('sr-status').textContent !== spoken) $('sr-status').textContent = spoken;
    $('connect-button').classList.toggle('connected', hOpen || cOpen);
    $('demo-button').textContent = bio.demoOn ? 'End demo' : 'Try a demo';
    $('demo-sheet').textContent = bio.demoOn ? 'End demo' : 'Run demo';
    $('replay-stop').hidden = !bio.replayOn;
    const [tag, cls] = cadenceTag(), ep = $('ep-cad');
    if (ep.textContent !== tag) { ep.textContent = tag; ep.className = `ep ${cls}`; }
    renderEEG();
  }
  const brainRide = () => S.mode === 'ride' && S.drivePower === 'brainwaves';
  function setDrivePower(power, quiet) {
    if (!['cadence', 'brainwaves'].includes(power) || (bio.replayOn && !quiet)) return;
    if (power === S.drivePower) { renderStates(); return; }
    S.drivePower = power; S.rpm = 0; S.gradeLoad = 0; S.surge = 0; S.pulse = 0;
    pedalOff();
    if (!quiet) bio.noteLane('drivePower', power);
    renderStates();
  }
  function eegReading() {
    if (bio.replayOn && brainRide()) return S.replayEEG || { score: null, drive: 0, ratio: null, valid: false, simulated: bio.syntheticReplay, phase: 'waiting', reason: 'Waiting for recorded EEG control.' };
    const q = eeg.state;
    return { score: q.score, drive: q.drive, ratio: q.ratio, valid: !!(q.quality && q.quality.valid && q.phase === 'ready'), simulated: !!q.simulated, phase: q.phase, reason: q.quality && q.quality.reason || q.message || '' };
  }
  function updateEEG(dt) {
    const liveDrive = eeg.tick(dt, bio.demoOn && brainRide());
    const q = eegReading();
    S.eegScore = q.valid && Number.isFinite(q.score) ? q.score : null;
    S.eegValid = q.valid; S.eegRatio = q.ratio; S.eegSimulated = q.simulated;
    // Playback uses the saved control, including its already-smoothed coast.
    // Quality still withholds the displayed score; re-filtering would change the ride.
    if (bio.replayOn && brainRide()) S.eegDrive = clamp(q.drive, 0, 1);
    else S.eegDrive = clamp(Number.isFinite(liveDrive) ? liveDrive : 0, 0, 1);
    if (S.eegDrive < .0005) S.eegDrive = 0;
  }
  function renderEEG() {
    const q = eeg.state, active = brainRide(), reading = eegReading();
    $('ride-power').hidden = S.mode !== 'ride';
    document.querySelectorAll('[data-power]').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.power === S.drivePower)); b.disabled = bio.replayOn; });
    $('pedal').hidden = S.mode !== 'ride' || active;
    $('ride-controls').hidden = active; $('mapping').hidden = active;
    $('g-power-label').textContent = active ? 'EEG control / 100' : 'Cadence';
    $('g-load-label').textContent = active ? 'EEG signal' : 'Grade-load';
    $('g-load-tag').hidden = active;
    $('chip-cad').hidden = active; $('chip-eeg').hidden = !active;
    $('chip-eeg').dataset.tone = reading.valid ? 'good' : 'warn';
    $('chip-eeg-text').textContent = bio.replayOn ? 'EEG · recorded proxy' : reading.simulated ? bio.demoOn ? 'EEG · synthetic preview' : 'EEG · synthetic bridge' : reading.valid ? 'EEG · personal reference ready' : `EEG · ${q.phase}`;
    $('truth').textContent = active ? 'An EEG balance game control, calibrated to you. Higher control makes a faster, steadier ride. Not a measure of mental clarity.' : TRUTH[S.mode];
    if (active) {
      $('intro-eyebrow').textContent = 'Ride · brainwave control'; $('intro-title').textContent = 'Let the EEG balance move the road.';
      $('intro-sub').textContent = 'Use Muse S with a personal reference. No pedaling is needed, or try a labeled synthetic preview.';
    } else if (S.mode === 'ride') {
      $('intro-eyebrow').textContent = 'Ride · cadence sets the speed'; $('intro-title').textContent = 'Your legs set the speed.';
      $('intro-sub').textContent = 'Cadence is measured from a sensor. Grade-load is inferred from heart rate.';
    }
    $('eeg-state').textContent = q.deviceName ? `${q.deviceName} · ${q.phase}` : `Muse S · ${q.phase}`;
    $('eeg-why').textContent = q.message || 'Connect the configured private relay to look for Muse S.';
    $('eeg-quality').textContent = q.quality && q.quality.reason || 'No usable EEG data yet.';
    $('eeg-transport').textContent = `Relay · ${q.transport === true ? 'connected' : q.transport || 'disconnected'}`;
    $('eeg-info').dataset.tone = q.phase === 'ready' ? 'good' : q.phase === 'error' ? 'bad' : 'warn';
    const devices = q.devices || [], key = JSON.stringify(devices.map((d) => [d.id, d.name]));
    if ($('eeg-device').dataset.devices !== key) {
      const select = $('eeg-device'), chosen = select.value; select.replaceChildren();
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = devices.length ? 'Choose your Muse S' : 'No Muse found yet'; select.appendChild(empty);
      devices.forEach((d) => { const option = document.createElement('option'); option.value = d.id; option.textContent = d.name; select.appendChild(option); });
      if (devices.some((d) => d.id === chosen)) select.value = chosen;
      select.dataset.devices = key;
    }
    $('eeg-start').disabled = !q.available || S.eegBusy;
    $('eeg-scan').disabled = !q.available || S.eegBusy;
    $('eeg-pair').disabled = !$('eeg-device').value || S.eegBusy || bio.replayOn;
    $('eeg-disconnect').disabled = !q.available || q.phase === 'disconnected' || S.eegBusy;
    $('eeg-calibrate').disabled = !q.deviceName || q.simulated || S.eegBusy || bio.replayOn;
    const progress = clamp(q.progress || 0, 0, 1);
    $('eeg-progress').value = progress;
    $('eeg-reference').textContent = q.simulated ? bio.demoOn ? 'Synthetic preview. No headset calibration is claimed.' : `Synthetic bridge data · ${Math.floor(progress * 20)} of 20 eligible samples. No real headset reference is claimed.` : q.phase === 'calibrating' ? `Eyes open, sit still · ${Math.floor(progress * 20)} of 20 eligible samples` : q.baseline ? 'Personal reference ready. Recalibrate after changing headset fit.' : 'Allow a 4-second EEG buffer, then keep your eyes open and sit still for 20 eligible samples (~20 seconds).';
    $('eeg-setup').hidden = !!q.available;
  }
  async function eegAction(action) {
    if (S.eegBusy) return;
    S.eegBusy = true; renderStates();
    try { await action(); } catch (err) { $('eeg-why').textContent = err.message || 'The EEG connection could not complete.'; }
    finally { S.eegBusy = false; renderStates(); }
  }

  bio.on('state', renderStates);
  ['source-badge', 'chip-hr', 'chip-cad', 'chip-eeg'].forEach((id) => $(id).addEventListener('click', () => shell.openSheet('connect')));
  $('read-more').addEventListener('click', () => shell.openSheet('signal'));
  $('hr-connect').addEventListener('click', () => (bio.hr.connected ? bio.disconnectHeart() : bio.connectHeart('standard')));
  $('hume-connect').addEventListener('click', () => bio.connectHeart('hume'));
  $('cad-connect').addEventListener('click', () => (bio.cadence.connected ? bio.disconnectCadence() : bio.connectCadence()));
  $('demo-sheet').addEventListener('click', () => { toggleDemo(); if (bio.demoOn) $('connect-sheet').close(); });
  document.querySelectorAll('[data-power]').forEach((b) => b.addEventListener('click', () => setDrivePower(b.dataset.power)));
  $('eeg-start').addEventListener('click', () => eegAction(() => eeg.start()));
  $('eeg-scan').addEventListener('click', () => eegAction(() => eeg.scan()));
  $('eeg-device').addEventListener('change', renderStates);
  $('eeg-pair').addEventListener('click', () => eegAction(() => eeg.pair($('eeg-device').value)));
  $('eeg-disconnect').addEventListener('click', () => eegAction(() => eeg.disconnect()));
  $('eeg-calibrate').addEventListener('click', () => eegAction(() => eeg.calibrate()));
  $('ref-reset').addEventListener('click', () => { bio.resetReference(); shell.toast('Your reference starts again now.'); });

  /* ---- Route sheet ---- */
  function selectedSceneIndex() {
    return legacyScene() ? BIOMES.findIndex((b) => b.name === currentBiome().name || (currentBiome().name === 'Misty pines' && b.id === 'misty-pines')) : S.biomeNext;
  }
  function chooseBiome(i) {
    if (legacyScene()) {
      if (bio.recording) { shell.toast('Stop this legacy recording before choosing a new scene.'); return; }
      if (bio.replayOn) bio.stopReplay();
      stopGhost();
      S.sceneCatalog = SCENE_CATALOG;
      setBiome(i, true);
    } else setBiome(i);
  }
  function setBiome(i, instant) {
    if (!sceneCatalog()[i] || (i === S.biomeNext && !instant)) return;
    S.fromMix = instant ? null : sceneNow();
    S.biome = instant ? i : S.biomeNext; S.biomeNext = i; S.biomeT = instant ? 1 : 0;
    bio.noteLane('biome', i);
    document.querySelectorAll('#biome-row button, .scene-tile').forEach((b) => {
      const on = +b.dataset.b === selectedSceneIndex();
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.body.style.setProperty('--accent', currentBiome().edge);
    if ($('scene-name')) $('scene-name').textContent = currentBiome().name;
    const desc = currentBiome().description || 'Original scene from this recording.';
    if ($('scene-description')) $('scene-description').textContent = desc;
    const cap = $('route-caption'); if (cap) cap.textContent = desc;
    thumbAt = 0;
  }
  $('biome-row').innerHTML = BIOMES.map((b, i) => `<button class="pill${i === S.biomeNext ? ' on' : ''}" data-b="${i}" aria-pressed="${i === S.biomeNext}" title="${b.description}"><span class="scene-swatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-1px;background:linear-gradient(${b.skyTop},${b.ground})"></span>${b.name}</button>`).join('');
  $('biome-row').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) chooseBiome(+b.dataset.b); });
  const scTiles = $('scene-tiles');
  if (scTiles) scTiles.addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) chooseBiome(+b.dataset.b); });
  document.querySelectorAll('[data-tod]').forEach((b) => b.addEventListener('click', () => setTod(+b.dataset.tod)));
  document.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
  const autoSceneBtn = $('auto-scene');
  if (autoSceneBtn) autoSceneBtn.addEventListener('click', () => setAuto(!S.autoScene));
  $('scene-description').textContent = currentBiome().description;
  $('tod').addEventListener('change', (e) => { S.duskHold = e.target.value === 'auto' ? null : +e.target.value; thumbAt = 0; });
  $('new-route').addEventListener('click', () => { S.seed = (Math.random() * 40) | 0; thumbAt = 0; bio.noteLane('seed', S.seed); shell.toast('New route'); });
  const sl = $('space-lattice');
  if (sl) {
    sl.checked = !!S.spaceLattice;
    sl.addEventListener('change', (e) => { S.spaceLattice = e.target.checked; });
  }
  document.body.style.setProperty('--accent', currentBiome().edge);

  function syncLookInputs() {
    const dr = $('dream'), wr = $('wild');
    if (dr) { dr.value = Math.round(S.dream * 100); shell.syncRange(dr); $('dream-v').textContent = `${dr.value}%`; }
    if (wr) { wr.value = Math.round(S.wild * 100); shell.syncRange(wr); $('wild-v').textContent = `${wr.value}%`; }
  }
  function setLook(name) {
    if (!LOOKS[name]) return;
    S.look = name; S.dream = LOOKS[name].dream; S.wild = LOOKS[name].wild;
    document.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === name)));
    syncLookInputs();
  }
  let pThumb = null, thumbHDR = null, thumbLDR = null, thumbPx = null, thumbAt = 0, thumbDusk = -1;
  function setTod(i) {
    S.tod = i; S.duskHold = TOD[i].v;
    document.querySelectorAll('[data-tod]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.tod === i)));
    if ($('tod')) $('tod').value = TOD[i].v == null ? 'auto' : String(TOD[i].v);
    thumbAt = 0;
  }
  function setAuto(on) {
    S.autoScene = on; S.nextSceneAt = S.dist + M_PER_MI;
    const btn = $('auto-scene');
    if (btn) btn.setAttribute('aria-pressed', String(on));
  }
  function nextBiome() {
    const nextIdx = (selectedSceneIndex() + 1) % BIOMES.length;
    chooseBiome(nextIdx);
    shell.toast(`Scenery · ${BIOMES[nextIdx].name}`);
  }
  function nextTod() {
    const nextIdx = ((S.tod || 0) + 1) % TOD.length;
    setTod(nextIdx);
    shell.toast(`Time of day · ${TOD[nextIdx].label}`);
  }
  function nextLook() {
    const keys = Object.keys(LOOKS);
    const curIdx = keys.indexOf(S.look || 'clear');
    const nextKey = keys[(curIdx + 1) % keys.length];
    setLook(nextKey);
    shell.toast(`Look · ${LOOKS[nextKey].label}`);
  }
  function randomCombo() {
    const randBiome = (Math.random() * BIOMES.length) | 0;
    const randTod = (Math.random() * TOD.length) | 0;
    const lookKeys = Object.keys(LOOKS);
    const randLook = lookKeys[(Math.random() * lookKeys.length) | 0];
    chooseBiome(randBiome);
    setTod(randTod);
    setLook(randLook);
    shell.toast(`Random: ${BIOMES[randBiome].name} · ${TOD[randTod].label} · ${LOOKS[randLook].label}`);
  }
  const onMiddleClick = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      randomCombo();
    }
  };
  window.addEventListener('auxclick', onMiddleClick);
  window.addEventListener('pointerdown', onMiddleClick);

  const bind = (id, get, set, fmt, label) => {
    const r = $(id);
    r.value = get();
    shell.syncRange(r);
    const lab = $(label);
    if (lab) lab.textContent = fmt(+r.value);
    r.addEventListener('input', () => { shell.syncRange(r); set(+r.value); if (lab) lab.textContent = fmt(+r.value); drawCurve(); });
  };
  bind('dream', () => S.dream * 100, (v) => { S.dream = v / 100; }, (v) => `${Math.round(v)}%`, 'dream-v');
  bind('wild', () => S.wild * 100, (v) => { S.wild = v / 100; }, (v) => `${Math.round(v)}%`, 'wild-v');
  ['dream', 'wild'].forEach((id) => $(id).addEventListener('input', () => { S.look = null; document.querySelectorAll('[data-look]').forEach((b) => b.setAttribute('aria-pressed', 'false')); }));
  bind('m-idle', () => S.map.idle, (v) => { S.map.idle = v; }, (v) => `${v} rpm`, 'v-idle');
  bind('m-max', () => S.map.max, (v) => { S.map.max = v; }, (v) => `${v} rpm`, 'v-max');
  bind('m-zoom', () => S.map.maxZoom * 1000, (v) => { S.map.maxZoom = v / 1000; }, (v) => `${(v / 10).toFixed(1)}%`, 'v-zoom');
  bind('m-gamma', () => S.map.gamma * 100, (v) => { S.map.gamma = v / 100; }, (v) => (v / 100).toFixed(2), 'v-gamma');
  bind('steady', () => 0, (v) => { S.steady = v > 0 ? v : null; if (v > 0) S.auto = false; syncAuto(); }, (v) => (v > 0 ? `${v} rpm` : 'off'), 'steady-v');
  bind('full-over', () => bio.fullOver, (v) => { bio.fullOver = v; }, (v) => `+${v} bpm`, 'full-over-v');
  bind('full-swing', () => bio.fullSwing, (v) => { bio.fullSwing = v; }, (v) => `${v} bpm`, 'full-swing-v');
  bind('pace', () => bio.pace.rate, (v) => { bio.setPace(v); }, (v) => v.toFixed(1), 'pace-v');
  function syncAuto() { $('auto-ride').textContent = `Interval workout: ${S.auto ? 'on' : 'off'}`; $('auto-ride').classList.toggle('on', S.auto); }
  $('auto-ride').addEventListener('click', () => { S.auto = !S.auto; S.autoT = 0; if (S.auto) { $('steady').value = 0; shell.syncRange($('steady')); S.steady = null; $('steady-v').textContent = 'off'; } syncAuto(); });
  $('pace-toggle').addEventListener('click', function () { const on = bio.togglePace(); this.textContent = on ? 'Pause' : 'Resume'; });
  $('set-again').addEventListener('click', () => { S.holdT = 0; S.dawn = 0; S.complete = false; });

  /* ---- ride sound: cadence-driven atoms, the same as Endless Cockpit, off by default ---- */
  const ATOMS = [[98, 130.81, 196, 246.94, 293.66, 392, 493.88], [110, 146.83, 220, 277.18, 329.63, 440, 554.37], [130.81, 164.81, 196, 261.63, 392, 523.25, 659.25], [123.47, 164.81, 246.94, 329.63, 493.94, 659.25, 987.77], [82.41, 110, 164.81, 220, 277.18, 329.63, 415.3]];
  const SCENE_ATOMS = [ATOMS[0], ATOMS[1], ATOMS[2], ATOMS[3], ATOMS[4], [130.81, 164.81, 196, 261.63, 329.63, 392, 523.25], ATOMS[1], [146.83, 196, 220, 293.66, 392, 440, 587.33], [110, 130.81, 164.81, 196, 220, 261.63, 329.63]];
  let AC = null, sndOn = false, sndGain = null, nextGrain = 0;
  let windGain = null, windFilter = null, noiseSrc = null;
  function grainTick() {
    if (!AC || !sndOn) return;
    const rate = Math.min(24, (S.rpm / 130) * 24);
    if (nextGrain < AC.currentTime) nextGrain = AC.currentTime + 0.02;
    // Aerodynamic wind rush modulated by road speed
    if (windGain && windFilter) {
      const speedMph = (S.speed * 3600) / M_PER_MI;
      const targetGain = clamp(speedMph / 28, 0, 1) * 0.22;
      const targetFreq = 140 + clamp(speedMph / 30, 0, 1) * 460;
      windGain.gain.setTargetAtTime(targetGain, AC.currentTime, 0.08);
      windFilter.frequency.setTargetAtTime(targetFreq, AC.currentTime, 0.08);
    }
    if (rate < 0.5) { nextGrain = AC.currentTime + 0.08; return; }
    const palette = legacyScene() ? ATOMS : SCENE_ATOMS;
    const a = palette[S.biome] || palette[0], b = palette[S.biomeNext] || palette[0], atoms = a.map((v, i) => lerp(v, b[i], S.biomeT));
    let budget = 0;
    while (nextGrain < AC.currentTime + 0.12 && budget < 8) {
      const t = nextGrain, o = AC.createOscillator(), g = AC.createGain();
      o.type = S.wild > 0.6 ? 'triangle' : 'sine';
      o.frequency.value = atoms[(Math.random() * atoms.length) | 0] * (1 + (Math.random() - 0.5) * 0.012);
      const dur = 0.07 + Math.random() * 0.1, peak = 0.1 + S.wild * 0.06;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(g).connect(sndGain); o.start(t); o.stop(t + dur + 0.01);
      nextGrain += 1 / rate; budget++;
    }
  }
  function ensureAudio() {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      sndGain = AC.createGain(); sndGain.gain.value = 0; sndGain.connect(AC.destination);
      try {
        const buf = AC.createBuffer(1, Math.round(AC.sampleRate * 2), AC.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
        noiseSrc = AC.createBufferSource();
        noiseSrc.buffer = buf;
        noiseSrc.loop = true;
        windFilter = AC.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 160;
        windGain = AC.createGain();
        windGain.gain.value = 0;
        noiseSrc.connect(windFilter).connect(windGain).connect(sndGain);
        noiseSrc.start();
      } catch (e) {}
      setInterval(grainTick, 45);
    }
    if (AC.state === 'suspended') AC.resume();
  }
  $('ride-sound').addEventListener('click', function () {
    ensureAudio();
    sndOn = !sndOn;
    this.textContent = `Ride sound: ${sndOn ? 'on' : 'off'}`; this.classList.toggle('on', sndOn);
    sndGain.gain.linearRampToValueAtTime(sndOn ? 0.5 : 0, AC.currentTime + 0.25);
  });

  /* ---- sessions, replay and the Ghost Deck ---- */
  let recorder = null, lastRide = null, recordBaseDist = 0;
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const num = (v, d) => (v == null ? null : +v.toFixed(d));
  $('rec-toggle').addEventListener('click', () => {
    if (!bio.recording) {
      recordBaseDist = S.dist;
      bio.startRecording('biofeedback-path-cockpit', sessionStart(), S.sceneCatalog);
      bio.noteLane('mode', S.mode); bio.noteLane('biome', S.biomeNext); bio.noteLane('seed', S.seed);
      bio.noteLane('dist', 0); bio.noteLane('vis', S.vis); bio.noteLane('rpm', S.rpm);
      bio.noteLane('baseHr', bio.now.baseHr); bio.noteLane('drivePower', S.drivePower);
      if (S.drivePower === 'brainwaves') bio.noteLane('eeg', eegReading());
      let videoWarning = '';
      if ($('rec-video').checked && cv.captureStream && window.MediaRecorder) {
        let capture = null;
        try {
          capture = cv.captureStream(60);
          const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
          const chunks = [], activeRecorder = new MediaRecorder(capture, mime ? { mimeType: mime, videoBitsPerSecond: 14e6 } : {});
          recorder = activeRecorder;
          // This option captures video only; it never owns the ride sound's
          // persistent audio tracks. Chunks and cleanup belong to this recorder.
          activeRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
          activeRecorder.onstop = () => {
            try {
              if (chunks.length) shell.download(new Blob(chunks, { type: activeRecorder.mimeType }), `biofeedback-path-cockpit-${stamp()}.${(activeRecorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);
            } finally { capture.getTracks().forEach((track) => track.stop()); }
          };
          activeRecorder.onerror = () => { capture.getTracks().forEach((track) => track.stop()); if (recorder === activeRecorder) recorder = null; $('rec-status').textContent = 'Video capture stopped. The session is still recording.'; };
          activeRecorder.start(1000);
        } catch (err) {
          if (capture) capture.getTracks().forEach((track) => track.stop());
          recorder = null; videoWarning = ' Video could not start; the session will still save.';
        }
      }
      $('rec-toggle').textContent = 'Stop and save';
      $('session-button').classList.add('rec');
      $('rec-status').textContent = 'Recording. Ride, then press Stop and save.' + videoWarning;
    } else {
      bio.noteLane('dist', Math.max(0, S.dist - recordBaseDist)); bio.noteLane('vis', S.vis);
      const s = bio.stopRecording();
      if (recorder) { const active = recorder; recorder = null; if (active.state !== 'inactive') active.stop(); }
      lastRide = s; $('ghost-last').disabled = false;
      shell.download(new Blob([JSON.stringify(s)], { type: 'application/json' }), `biofeedback-path-cockpit-session-${stamp()}.json`);
      $('rec-toggle').textContent = 'Start recording';
      $('session-button').classList.remove('rec');
      $('rec-status').textContent = `Saved ${mmss(s.durationMs / 1000)} of readings${s.synthetic ? ', marked as synthetic' : ''}.`;
      renderAnalysis(s);
    }
  });
  const rideSamples = [];
  let lastSampleT = 0;
  function recordSample() {
    const now = performance.now();
    if (now - lastSampleT < 1000) return;
    lastSampleT = now;
    if (S.dist > 0 || S.rpm > 0.5 || S.speed > 0.1) {
      rideSamples.push({
        t: new Date().toISOString(),
        dist: S.dist,
        rpm: S.rpm,
        speed: S.speed,
        alt: roadY(S.vis),
        hr: bio.now.hr != null ? bio.now.hr : null,
      });
      if (rideSamples.length > 7200) rideSamples.shift();
    }
  }
  function exportTCX() {
    if (!rideSamples.length) {
      rideSamples.push({
        t: new Date().toISOString(),
        dist: S.dist,
        rpm: S.rpm,
        speed: S.speed,
        alt: roadY(S.vis),
        hr: bio.now.hr != null ? bio.now.hr : null,
      });
    }
    const startTime = rideSamples[0].t;
    const totalSecs = Math.max(1, Math.round((new Date(rideSamples[rideSamples.length - 1].t) - new Date(startTime)) / 1000));
    const maxSpd = rideSamples.reduce((m, p) => Math.max(m, p.speed || 0), 0);
    const totalDist = rideSamples[rideSamples.length - 1].dist;
    const pointsXml = rideSamples.map((p) => `
          <Trackpoint>
            <Time>${p.t}</Time>
            <DistanceMeters>${p.dist.toFixed(1)}</DistanceMeters>
            <Cadence>${Math.round(p.rpm)}</Cadence>
            <AltitudeMeters>${(p.alt || 0).toFixed(1)}</AltitudeMeters>
            ${p.hr ? `<HeartRateBpm><Value>${Math.round(p.hr)}</Value></HeartRateBpm>` : ''}
            <Extensions>
              <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
                <Speed>${(p.speed || 0).toFixed(2)}</Speed>
              </TPX>
            </Extensions>
          </Trackpoint>`).join('');
    const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${totalSecs}</TotalTimeSeconds>
        <DistanceMeters>${totalDist.toFixed(1)}</DistanceMeters>
        <MaximumSpeed>${maxSpd.toFixed(2)}</MaximumSpeed>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${pointsXml}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
    shell.download(new Blob([tcx], { type: 'application/vnd.garmin.tcx+xml' }), `biofeedback-ride-${stamp()}.tcx`);
    shell.toast('Exported TCX for Strava / Garmin');
  }
  $('export-tcx').addEventListener('click', exportTCX);
  function renderAnalysis(s) {
    const col = (name) => (s.lanes[name] || []).map((p) => p[1]).filter((v) => v != null);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const rpm = avg(col('rpm').filter((v) => v > 1)), hr = avg(col('hr')), dist = col('dist'), peak = col('idx');
    $('session-analysis').innerHTML = `
      <div class="statgrid">
        <div class="stat"><span class="k">Length</span><span class="v">${mmss(s.durationMs / 1000)}</span></div>
        <div class="stat"><span class="k">Distance</span><span class="v">${dist.length ? ((dist[dist.length - 1] - (s.distanceRelative ? 0 : dist[0])) / M_PER_MI).toFixed(2) : '0.00'} mi</span></div>
        <div class="stat"><span class="k">Cadence</span><span class="v">${rpm ? `${Math.round(rpm)} rpm` : 'none'}</span><span class="n">mean while moving</span></div>
        <div class="stat"><span class="k">Heart rate</span><span class="v">${hr ? `${Math.round(hr)} bpm` : 'none'}</span><span class="n">mean</span></div>
        <div class="stat"><span class="k">Index</span><span class="v">${peak.length ? Math.round(Math.max(...peak)) : 'none'}</span><span class="n">highest, inferred</span></div>
      </div>`;
  }
  async function readFile(input) { const f = input.files[0]; input.value = ''; return f ? JSON.parse(await f.text()) : null; }
  $('replay-load').addEventListener('click', () => $('replay-file').click());
  $('replay-stop').addEventListener('click', () => bio.stopReplay());
  $('replay-file').addEventListener('change', async (e) => {
    try {
      const raw = await readFile(e.target); if (!raw) return;
      const s = bio.readSession(raw);
      startReplay(s);
      renderAnalysis(s);
      $('rec-status').textContent = `Replaying a session from ${new Date(s.created).toLocaleString()}${s.synthetic ? '. Its signals are synthetic' : ''}.`;
      $('session-sheet').close();
    } catch (err) { $('rec-status').textContent = `That file could not be replayed: ${err.message}`; }
  });
  function sessionStart() {
    return { vis: S.vis, seed: S.seed, biome: S.biomeNext, mode: S.mode, drivePower: S.drivePower || 'cadence', dist: S.dist, rpm: S.rpm,
      map: { ...S.map }, gradeLoad: S.gradeLoad, baseHr: bio.now.baseHr, fullOver: bio.fullOver,
      fullSwing: bio.fullSwing, pace: bio.pace.rate, hold: S.holdT, dawn: S.dawn };
  }
  function checkRecordingSceneSet(s) {
    if (bio.recording && (s.sceneCatalog || 'biofeedback-pathscene@1') !== S.sceneCatalog) {
      throw new Error('Stop recording before loading a session with a different scene set.');
    }
  }
  function restoreStart(s, ghost) {
    checkRecordingSceneSet(s);
    const first = (name, fallback) => s.lanes[name] && s.lanes[name].length ? s.lanes[name][0][1] : fallback;
    const v = s.start;
    S.sceneCatalog = s.sceneCatalog || 'biofeedback-pathscene@1';
    S.drivePower = v && v.drivePower || first('drivePower', 'cadence');
    S.replayEEG = null; S.eegDrive = 0; S.eegScore = null; S.eegValid = false; S.eegSimulated = false;
    S.vis = v ? v.vis : 40; S.seed = v ? v.seed : first('seed', 0);
    setBiome(v ? v.biome : first('biome', legacyScene() ? 1 : 6), true);
    shell.setMode(ghost ? 'ride' : v ? v.mode : first('mode', 'watch'));
    S.dist = 0; S.gradeLoad = ghost ? 0 : v && v.gradeLoad || 0;
    S.rpm = ghost ? 0 : v && v.rpm || 0; S.replayRpm = ghost ? null : S.rpm;
    S.holdT = ghost ? 0 : v && v.hold || 0; S.dawn = ghost ? 0 : v && v.dawn || 0; S.complete = S.holdT >= SET_SECONDS;
    if (v) {
      Object.assign(S.map, v.map);
      if (v.fullOver != null) bio.fullOver = v.fullOver;
      if (v.fullSwing != null) bio.fullSwing = v.fullSwing;
      if (v.pace != null) bio.setPace(v.pace);
      for (const [id, value] of [['m-idle', S.map.idle], ['m-max', S.map.max], ['m-zoom', S.map.maxZoom * 1000], ['m-gamma', S.map.gamma * 100], ['full-over', bio.fullOver], ['full-swing', bio.fullSwing], ['pace', bio.pace.rate]]) {
        $(id).value = value; $(id).dispatchEvent(new Event('input'));
      }
    }
  }
  function startReplay(raw) {
    const s = bio.readSession(raw); // Reject the entire file before changing the current ride.
    checkRecordingSceneSet(s);
    stopGhost(); restoreStart(s, false);
    bio.startReplay(s);
    S.replayDistanceBase = s.distanceRelative ? 0 : s.lanes.dist && s.lanes.dist.length ? s.lanes.dist[0][1] : 0;
  }
  bio.on('lane', (l) => {
    if (l.name === 'rpm') S.replayRpm = l.value;
    else if (l.name === 'drivePower') setDrivePower(l.value, true);
    else if (l.name === 'eeg') S.replayEEG = l.value;
    else if (l.name === 'biome') setBiome(l.value);
    else if (l.name === 'mode' && l.value !== S.mode) shell.setMode(l.value);
    else if (l.name === 'seed') S.seed = l.value;
    else if (l.name === 'dist') S.dist = Math.max(0, l.value - (S.replayDistanceBase || 0));
    else if (l.name === 'vis') S.vis = l.value;
    else if (l.name === 'clarity') S.replayClarity = l.value;
    else if (l.name === 'hold') S.holdT = l.value;
    else if (l.name === 'dawn') { S.dawn = l.value; S.complete = l.value >= 1; }
  });
  bio.on('replay', (on) => { if (!on) { S.replayRpm = null; S.replayClarity = null; S.replayEEG = null; } renderStates(); });

  function ghostFrom(s) {
    const lanes = s.lanes || {};
    let dist = lanes.dist && lanes.dist.map((p) => [p[0], p[1] - (s.distanceRelative ? 0 : lanes.dist[0][1])]);
    if (!dist || !dist.length) {
      // A ride saved by the older page has cadence only, so the ghost's distance comes from the same mapping with no hills.
      const rpm = lanes.rpm || []; let d = 0;
      dist = rpm.map((p, i) => { if (i) d += motion01(rpm[i - 1][1]) * MAX_SPEED * ((p[0] - rpm[i - 1][0]) / 1000); return [p[0], d]; });
    }
    if (!dist.length) throw new Error('This file holds no ride to race.');
    return { dist, i: 0, t0: performance.now(), end: s.durationMs, total: dist[dist.length - 1][1], seed: s.start ? s.start.seed : lanes.seed && lanes.seed.length ? lanes.seed[0][1] : 0, session: s };
  }
  function startGhost(s) {
    const g = ghostFrom(bio.readSession(s));
    checkRecordingSceneSet(g.session);
    if (bio.replayOn) bio.stopReplay();
    restoreStart(g.session, true); S.ghost = g;
    $('g-ghost-wrap').hidden = false; $('ghost-stop').hidden = false;
    $('ghost-status').textContent = `Racing a ride of ${(g.total / M_PER_MI).toFixed(2)} mi over ${mmss(g.end / 1000)}. ${s.start ? 'Same route start and cadence mapping.' : 'Earlier file: starting position is approximate.'} Your distance restarted at zero.`;
  }
  function stopGhost() {
    S.ghost = null; S.ghostGap = null;
    $('g-ghost-wrap').hidden = true; $('ghost-stop').hidden = true;
    $('ghost-status').textContent = 'No ghost loaded.';
  }
  function ghostDistance(now) {
    const g = S.ghost, at = now - g.t0, d = g.dist;
    while (g.i < d.length - 2 && d[g.i + 1][0] <= at) g.i++;
    const a = d[g.i], b = d[Math.min(g.i + 1, d.length - 1)];
    return b[0] > a[0] ? a[1] + (b[1] - a[1]) * clamp((at - a[0]) / (b[0] - a[0]), 0, 1) : a[1];
  }
  $('ghost-last').addEventListener('click', () => {
    if (!lastRide) return;
    try { startGhost(lastRide); $('session-sheet').close(); }
    catch (err) { $('ghost-status').textContent = `That ride cannot be raced: ${err.message}`; }
  });
  $('ghost-load').addEventListener('click', () => $('ghost-file').click());
  $('ghost-stop').addEventListener('click', stopGhost);
  $('ghost-file').addEventListener('change', async (e) => {
    try { const raw = await readFile(e.target); if (!raw) return; startGhost(bio.readSession(raw)); $('session-sheet').close(); } catch (err) { $('ghost-status').textContent = `That file cannot be raced: ${err.message}`; }
  });
  $('snapshot').addEventListener('click', () => { wantSnap = (blob) => shell.download(blob, `biofeedback-path-cockpit-${stamp()}.png`); });

  /* ---- small canvases ---- */
  const accent = () => currentBiome().edge;
  function drawElStrip() {
    const c = $('elstrip').getContext('2d'), w = 880, h = 110;
    c.clearRect(0, 0, w, h);
    const pts = [], span = 1400;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 200; i++) { const y = roadY(S.vis + (i / 200) * span); pts.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const Y = (v) => h - 14 - ((v - lo) / Math.max(1, hi - lo)) * (h - 34);
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `${accent()}66`); g.addColorStop(1, `${accent()}05`);
    c.fillStyle = g; c.fill();
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.strokeStyle = accent(); c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(4, Y(pts[0]), 4.5, 0, 6.3); c.fill();
    $('grade-read').textContent = `grade ${(S.grade * 100 >= 0 ? '+' : '') + (S.grade * 100).toFixed(1)}%`;
  }
  function drawCurve() {
    const c = $('curve').getContext('2d'), w = 880, h = 170, edge = accent();
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(191,194,236,.16)'; c.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => { c.beginPath(); c.moveTo(0, f * h); c.lineTo(w, f * h); c.stroke(); });
    const X = (rpm) => (rpm / 130) * w, Y = (m) => h - 10 - m * (h - 20);
    c.beginPath();
    for (let r = 0; r <= 130; r += 1) { const y = Y(motion01(r)); if (r) c.lineTo(X(r), y); else c.moveTo(X(r), y); }
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `${edge}44`); g.addColorStop(1, `${edge}04`);
    c.fillStyle = g; c.fill();
    c.beginPath();
    for (let r = 0; r <= 130; r += 1) { const y = Y(motion01(r)); if (r) c.lineTo(X(r), y); else c.moveTo(X(r), y); }
    c.strokeStyle = edge; c.lineWidth = 2.4; c.stroke();
    const dotX = X(clamp(S.rpm, 0, 130)), dotY = Y(motion01(S.rpm));
    c.fillStyle = `${edge}44`; c.beginPath(); c.arc(dotX, dotY, 11, 0, 6.3); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(dotX, dotY, 5.5, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(238,237,251,.78)'; c.font = '19px ui-sans-serif,-apple-system,sans-serif';
    c.fillText(`${Math.round(S.rpm)} rpm → ${(S.zoom * 100).toFixed(2)}% a frame`, 14, 28);
  }

  /* ---- the Signal sheet ---- */
  const LABEL = 'rgba(238,237,251,.75)', GRID = 'rgba(191,194,236,.14)', LINE = '#b8b7ff';
  const hover = {};
  ['sig-trace', 'sig-rr', 'sig-index'].forEach((id) => {
    const cvs = $(id);
    cvs.addEventListener('pointermove', (e) => { const r = cvs.getBoundingClientRect(); hover[id] = (e.clientX - r.left) / r.width; });
    cvs.addEventListener('pointerleave', () => { hover[id] = null; });
  });
  // One line, one axis, thin marks and a recessive grid. Hover names the value.
  function lineChart(id, pts, xSpan, opt) {
    const cvs = $(id), c = cvs.getContext('2d'), w = cvs.width, h = cvs.height, pad = 40, top = 14;
    c.fillStyle = '#0b0f1c'; c.fillRect(0, 0, w, h);
    c.font = '19px ui-sans-serif, -apple-system, sans-serif';
    const ys = pts.map((p) => p[1]);
    let lo = opt.lo != null ? opt.lo : Math.min(...ys), hi = opt.hi != null ? opt.hi : Math.max(...ys);
    if (opt.floor && hi - lo < opt.floor) { const m = (hi + lo) / 2; lo = m - opt.floor / 2; hi = m + opt.floor / 2; }
    const X = (x) => w - ((xSpan - x) / xSpan) * (w - 96), Y = (v) => h - pad + 12 - ((v - lo) / Math.max(1e-6, hi - lo)) * (h - pad + 12 - top);
    (opt.marks || [lo, hi]).forEach((v) => {
      c.fillStyle = GRID; c.fillRect(0, Y(v), w, 1);
      c.fillStyle = LABEL; c.fillText(opt.fmt ? opt.fmt(v) : Math.round(v), 12, Y(v) - 6 < 18 ? Y(v) + 21 : Y(v) - 6);
    });
    if (!pts.length) { c.fillStyle = LABEL; c.fillText(opt.empty, 110, h / 2); return; }
    c.beginPath();
    pts.forEach((p, i) => { const x = X(p[0]), y = Y(p[1]); if (opt.breakIf && i && opt.breakIf(pts[i - 1], p)) c.moveTo(x, y); else if (i) c.lineTo(x, y); else c.moveTo(x, y); });
    c.strokeStyle = LINE; c.lineWidth = 2.4; c.lineJoin = 'round'; c.stroke();
    if (hover[id] != null) {
      const hx = hover[id] * w; let best = pts[0];
      pts.forEach((p) => { if (Math.abs(X(p[0]) - hx) < Math.abs(X(best[0]) - hx)) best = p; });
      c.fillStyle = 'rgba(238,237,251,.45)'; c.fillRect(X(best[0]), top, 1.5, h - top - 16);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(X(best[0]), Y(best[1]), 6, 0, 6.3); c.fill();
      c.fillStyle = '#eeedfb'; c.font = '21px ui-sans-serif, -apple-system, sans-serif';
      const text = `${opt.fmt ? opt.fmt(best[1]) : Math.round(best[1])}, ${Math.round(xSpan - best[0])} s ago`, tw = c.measureText(text).width;
      c.fillText(text, clamp(X(best[0]) + 12, 8, w - tw - 8), top + 22);
    }
  }
  function drawSignal() {
    const n = bio.now, t = performance.now() / 1000;
    const trace = bio.series().filter((p) => t - p.t <= 120).map((p) => [120 - (t - p.t), p.hr]);
    lineChart('sig-trace', trace, 120, { floor: 12, empty: 'No heart rate yet.', breakIf: (a, b) => b[0] - a[0] > 6 });
    const rr = bio.beats().map((b) => [32 - (t - b.t / 1000), b.rr]).filter((p) => p[0] >= 0);
    lineChart('sig-rr', rr, 32, { floor: 60, empty: bio.hr.connected && !bio.hr.reportsBeats ? 'This sensor reports rate only, so there are no beat intervals.' : 'No beat intervals yet.' });
    const nowMs = Date.now();
    const idx = (n.history || []).map((p) => [600 - (nowMs - p.timestamp) / 1000, p.value]).filter((p) => p[0] >= 0);
    lineChart('sig-index', idx, 600, { lo: 0, hi: 100, marks: [0, 25, 46, 68], empty: n.phase === 'calibrating' ? 'Forming your reference.' : 'No index yet.', breakIf: (a, b) => b[0] - a[0] > 6 });
  }
  function renderSignal() {
    const n = bio.now, set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
    const src = bio.demoOn || bio.replayOn || bio.hr.connected;
    set('sig-hr', n.hr != null ? `${Math.round(n.hr)} bpm` : src ? 'no reading' : 'no sensor');
    set('sig-hr-n', bio.demoOn ? 'synthetic demo' : bio.replayOn ? 'from a recording' : bio.hr.state === 'live' ? bio.hr.label : 'no source yet');
    set('sig-rmssd', n.rmssd != null ? `${Math.round(n.rmssd)} ms` : 'no intervals');
    set('sig-rmssd-n', n.rmssd != null ? 'from beat intervals' : (bio.hr.connected || bio.demoOn) ? (bio.features.reason || 'not available') : 'from beat intervals');
    set('sig-sdnn', n.sdnn != null ? `${Math.round(n.sdnn)} ms` : 'no intervals');
    set('sig-idx', n.idx != null ? String(Math.round(n.idx)) : n.phase === 'calibrating' ? 'forming' : 'not yet');
    set('sig-idx-n', n.idx != null ? `${n.label}, inferred` : 'inferred, not measured');
    set('sig-ref', n.reference ? 'ready' : n.phase === 'calibrating' ? `${mmss(n.seconds)} of 2:00` : 'not started');
    set('sig-ref-n', n.reference ? 'fixed until the source changes' : '120 s of quiet data');
    set('sig-swing', n.swing != null ? `${n.swing.toFixed(1)} bpm` : 'no reading');
    const rpm = S.rpm;
    set('sig-cad', rpm > 0.5 ? `${Math.round(rpm)} rpm` : bio.cadence.state === 'live' || bio.demoOn ? 'stopped' : 'no source');
    set('sig-cad-n', cadenceTag()[0].toLowerCase());
    set('sig-fps', `${Math.round(fps)} fps`);
    set('sig-quality', `${rw} x ${rh} render`);
    const near = (id) => $(id);
    if (near('sig-hr-range')) set('sig-hr-range', n.baseHr != null ? `bpm · baseline ${Math.round(n.baseHr)} from ${n.baseFrom}` : 'bpm');
    set('sig-rr-note', bio.hr.connected && !bio.hr.reportsBeats ? 'rate only' : 'milliseconds');
    set('sig-cover', n.coverage || 'no reference yet');
    const rows = (n.components || []).map((c) => `<tr><th>${shell.esc(c.label)}</th><td>${c.value != null ? `${(+c.value).toFixed(c.key === 'turbulence' ? 2 : 0)} ${shell.esc(c.unit)}` : 'none'}</td><td>${c.reference != null ? (+c.reference).toFixed(0) : 'forming'}</td><td>${c.effectiveWeight != null ? (+c.effectiveWeight).toFixed(0) : '-'}</td><td>${c.contribution != null ? `+${(+c.contribution).toFixed(1)}` : 'none'}</td></tr>`).join('');
    const key = rows || '<tr><td colspan="5">No fixed profile yet.</td></tr>';
    if ($('sig-rows').dataset.key !== key) { $('sig-rows').dataset.key = key; $('sig-rows').innerHTML = key; }
    set('sig-sum', n.base != null ? `Sum ${n.base.toFixed(1)} × modifier ${n.multiplier.toFixed(3)} = ${n.raw.toFixed(1)}, then the median of the last five seconds = ${Math.round(n.idx)}. ${n.reason}` : (n.reason || ''));
    const ev = (n.events || []).slice(-6).reverse();
    const evKey = ev.length ? ev.map((e) => `<div class="ev"><b>${new Date(e.timestamp).toLocaleTimeString()}</b> ${e.classification}: ${e.drivers.map((d) => ({ heart_rate_bpm: 'heart rate up', pulse_rmssd_ms: 'RMSSD down', resp_rate_brpm: 'breathing up' }[d] || d)).join(', ')}. Peak surprise ${e.peak.toFixed(1)}${e.recoveryMs != null ? `, settled in ${Math.round(e.recoveryMs / 1000)} s` : ', still open'}.</div>`).join('') : 'None so far.';
    if ($('sig-events').dataset.key !== evKey) { $('sig-events').dataset.key = evKey; $('sig-events').innerHTML = evKey; }
  }

  /* ---- what the center of the screen says ---- */
  function renderReading() {
    const n = bio.now, h = bio.hr, reading = $('reading');
    const hasSource = bio.demoOn || bio.replayOn || h.connected;
    const isWatch = S.mode === 'watch' || (S.mode === 'ride' && S.stoppedTime >= 2.5 && !(bio.demoOn && S.demoRide));
    const show = isWatch && hasSource;
    reading.hidden = !show;
    let tier, sub = '', cov = '', pct = null, fill = null;
    if (n.phase === 'ready' && n.idx != null) {
      tier = n.label; pct = clamp(n.idx, 0, 100);
      sub = '0 to 100 · shift from your reference';
      cov = `${bio.demoOn ? 'Synthetic demo · ' : bio.replayOn ? 'Recorded · ' : ''}${n.coverage}`;
    } else if (bio.pedaling) {
      tier = 'On hold while you pedal'; sub = 'Pedaling raises heart rate on its own, so the index waits.';
    } else if (n.phase === 'calibrating') {
      tier = 'Forming your reference'; fill = n.progress;
      sub = `${mmss(n.seconds)} of 2:00 · sit comfortably`; cov = n.coverage;
    } else if (h.connected && !bio.demoOn && h.reportsBeats && !bio.features.valid && !n.reference) {
      tier = 'Collecting beat intervals'; sub = bio.features.reason;
    } else if (n.phase === 'held') {
      tier = 'On hold'; sub = n.reason;
    } else if (n.phase === 'stale') {
      tier = 'Signal paused'; sub = n.reason;
    } else if (h.state === 'no-signal') {
      tier = 'No signal yet'; sub = heartView().why;
    } else { tier = 'Waiting for a reading'; sub = 'The first reading starts your reference.'; }
    const numText = pct != null ? String(Math.round(n.idx)) : '--';
    const set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
    set('read-num', numText); set('read-tier', tier); set('read-sub', sub); set('read-cov', cov);
    $('read-dot').style.left = `${pct != null ? pct : 0}%`; $('read-dot').hidden = pct == null;
    $('read-fill').style.width = `${fill != null ? fill * 100 : 0}%`; $('read-fill').hidden = fill == null;
    $('read-scale').classList.toggle('forming', fill != null);
    $('read-scale').hidden = pct == null && fill == null;
  }
  function renderHud() {
    const n = bio.now, set = (id, v) => { const e = $(id); if (e.textContent !== v) e.textContent = v; };
    set('w-hr', n.hr != null ? String(Math.round(n.hr)) : '--');
    set('w-rmssd', n.rmssd != null ? String(Math.round(n.rmssd)) : '--');
    set('w-trend', n.phase === 'ready' ? n.trend : '--');
    const quietHud = S.mode === 'watch' && n.hr == null;
    document.querySelector('.hud-set[data-for=watch]').classList.toggle('empty', quietHud);
    set('g-speed', ((S.speed * 3600) / M_PER_MI).toFixed(1));
    set('g-dist', (S.dist / M_PER_MI).toFixed(2));
    set('g-rpm', brainRide() ? S.eegScore == null ? '--' : String(Math.round(S.eegScore * 100)) : S.rpm > 0.5 ? String(Math.round(S.rpm)) : '--');
    set('g-grade', `${S.grade * 100 >= 0 ? '+' : ''}${(S.grade * 100).toFixed(1)}`);
    if (brainRide()) { set('g-load', S.eegValid ? 'ready' : 'coast'); set('g-load-u', ''); }
    else if (n.hr != null && n.baseHr != null) { set('g-load', `+${(S.gradeLoad * 100).toFixed(1)}`); set('g-load-u', '%'); } else { set('g-load', '--'); set('g-load-u', n.hr != null ? 'base' : 'no HR'); }
    if (S.ghost) { const g = Math.round(S.ghostGap || 0); set('g-ghost', `${g > 0 ? '+' : ''}${g}`); }
    // Train
    const cl = S.mode === 'train' ? (bio.replayOn ? S.replayClarity : BioMath.clarity(n.swing, bio.fullSwing)) : null;
    set('t-clarity', cl != null ? cl.toFixed(2) : '--');
    $('t-bar').style.width = `${(cl || 0) * 100}%`;
    set('t-hold', `${mmss(Math.min(SET_SECONDS, S.holdT))} of ${mmss(SET_SECONDS)}`);
    $('set-again').hidden = !S.complete;
    const br = bio.breath(), cue = $('breath-cue'), note = $('breath-note');
    $('breath').hidden = S.mode !== 'train';
    if (S.mode === 'train') {
      const c = br.paused ? 'Paused' : br.inhale ? 'Breathe in' : 'Breathe out';
      if (cue.textContent !== c) cue.textContent = c;
      const hasSource = bio.demoOn || bio.replayOn || bio.hr.connected;
      let msg = '';
      if (S.complete) msg = 'Set complete. Dawn broke, and the path is clear.';
      else if (!hasSource) msg = 'The pacer runs without a sensor. Clarity needs one.';
      else if (n.hr == null) msg = 'Signal unclear. This stretch counts neither way.';
      else if (n.swing == null) msg = 'Reading the first two breaths.';
      else if (cl >= CLARITY_TARGET) msg = 'Holding. Stay with it.';
      if (note.textContent !== msg) note.textContent = msg;
    }
  }

  /* ---- motion: fixed simulation steps; saved positions anchor replay to its recorded route ---- */
  function targetRpm(h) {
    const next = CadenceMotion.target({ replayRpm: S.replayRpm,
      sourceRpm: bio.demoOn || bio.cadence.state === 'live' ? bio.cadence.rpm || 0 : null,
      manualEnabled: S.mode === 'ride', steady: S.steady, pedal: S.pedal, auto: S.auto, autoT: S.autoT }, h);
    S.autoT = next.autoT;
    return next.rpm;
  }
  let acc = 0;
  const H = CadenceMotion.STEP;
  function step() {
    const n = bio.now;
    if (brainRide()) {
      // This branch consumes no heart rate, cadence, manual pedal or grade-load.
      S.rpm = 0; S.grade = gradeAt(S.vis); S.gradeLoad = 0; S.surge = 0; S.pulse = 0;
      S.speed = S.eegDrive * EEG_MAX_SPEED;
      S.zoom = S.eegDrive * S.map.maxZoom * .35;
      S.dist += S.speed * H; S.vis += S.speed * H;
      return;
    }
    const loadT = S.mode === 'ride' ? BioMath.gradeLoad(n.hr, n.baseHr, bio.fullOver) * GRADE_LOAD_MAX : 0;
    const q = CadenceMotion.step({ rpm: S.rpm, targetRpm: targetRpm(H), dt: H, map: S.map,
      grade: gradeAt(S.vis), gradeLoad: S.gradeLoad, gradeLoadTarget: loadT, idleDrift: S.mode === 'train' ? 1.5 : 2.2 });
    for (const key of ['rpm', 'zoom', 'grade', 'gradeLoad', 'speed']) S[key] = q[key];
    S.dist += q.distanceDelta; S.vis += q.visualDelta;
    S.surge *= Math.exp(-H / 0.28);
    recordSample();
  }

  /* ---- graphics ---- */
  const cv = $('stage');
  const G = createGL(cv);
  const softwareRenderer = (() => {
    if (!G) return false;
    const g = G.gl, ext = g.getExtension('WEBGL_debug_renderer_info');
    return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '');
  })();
  const sceneBudget = softwareRenderer ? 80000 : 1.35e6;
  const minScale = (softwareRenderer ? 20000 : 60000) / sceneBudget;
  const maxScale = softwareRenderer ? 1 : 1.9;
  let gl, Post, pScene, pLegacyScene, pLegacyMote, pDream, pMote, pOrbit, tNoise, tRidge;
  let scene, dreamA, dreamB, rw = 0, rh = 0, frameIdx = 0, lastScale = 1, wantSnap = null, fps = 0, fpsN = 0, fpsT = performance.now();
  const ridge = new Uint8Array(64), ridgeF = new Float32Array(64);
  const ringData = new Float32Array(12 * 4), rings = [];
  bio.on('beat', () => {
    if (RM.matches || brainRide()) return;
    S.pulse = 1;
    rings.push({ z: S.vis + 2, t: performance.now(), v: 0.34, k: 0 });
    if (rings.length > 12) rings.shift();
  });

  /* ---- scene tiles: each scene drawn small by the road's own shader, at the current time of day ---- */
  const THUMB_FS = '#version 300 es\nprecision highp float;\nin vec2 vUv;\nout vec4 o;\n' + `
uniform sampler2D uScene; uniform float uExposure;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){ vec3 c=aces(texture(uScene,vUv).rgb*uExposure); vec2 q=vUv-.5; c*=1.-.45*smoothstep(.25,.95,dot(q,q)*2.1); o=vec4(pow(c,vec3(1./2.2)),1.); }`;
  function drawThumbs(now) {
    if (!G || !pScene) return;
    const small = softwareRenderer || lastScale < .2, TW = small ? 144 : 336, TH = small ? 84 : 196;
    if (!pThumb) pThumb = G.program(THUMB_FS);
    if (!thumbHDR || thumbHDR.w !== TW) {
      if (thumbHDR) { G.freeTarget(thumbHDR); G.freeTarget(thumbLDR); }
      thumbHDR = G.target(TW, TH);
      thumbLDR = G.target(TW, TH, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }); thumbPx = new Uint8Array(TW * TH * 4);
    }
    const z = S.vis + 60, td = S.duskHold != null ? S.duskHold : S.dusk, tiles = document.querySelectorAll('.scene-tile canvas');
    if (!tiles.length) return;
    gl.disable(gl.BLEND);
    BIOMES.forEach((b, i) => {
      const cam = camAt(z, 0, b);
      G.into(thumbHDR); G.bindTex(0, tNoise); G.bindTex(1, tRidge);
      G.use(pScene, Object.assign({ uN: 0, uS: 1, uRes: [TW, TH], uT: now / 1000, uFocal: 1.08, uBeat: 6, uSeed: S.seed, uCam: [cam.cx, cam.cy, z], uRight: cam.right, uUp: cam.up, uFwd: cam.fwd, uSpark: 0, uTravelSpeed: 0, uLattice: S.spaceLattice ? 1.0 : 0.0 }, CyclingScene.landAt(b, b, 1, td)));
      G.draw();
      G.into(thumbLDR); G.bindTex(0, thumbHDR.tex);
      G.use(pThumb, { uScene: 0, uExposure: 0.98 + td * 0.25 });
      G.draw();
      gl.readPixels(0, 0, TW, TH, gl.RGBA, gl.UNSIGNED_BYTE, thumbPx);
      tiles[i].width = TW; tiles[i].height = TH;
      const c = tiles[i].getContext('2d'), img = c.createImageData(TW, TH);
      for (let y = 0; y < TH; y++) img.data.set(thumbPx.subarray((TH - 1 - y) * TW * 4, (TH - y) * TW * 4), y * TW * 4);
      c.putImageData(img, 0, 0);
    });
    thumbAt = now; thumbDusk = td; last = performance.now();
  }

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.max(320, Math.min(3840, Math.round(cv.clientWidth * dpr))), Hh = Math.max(240, Math.min(2160, Math.round(cv.clientHeight * dpr)));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    const budget = sceneBudget * lastScale, asp = W / Hh;
    let h = Math.round(Math.sqrt(budget / asp)), w = Math.round(h * asp);
    if (w > W) { w = W; h = Hh; }
    if (w === rw && h === rh) return;
    rw = w; rh = h;
    [scene, dreamA, dreamB].forEach((T) => T && G.freeTarget(T));
    scene = G.target(rw, rh); dreamA = G.target(rw, rh); dreamB = G.target(rw, rh);
    if (thumbHDR) { G.freeTarget(thumbHDR); G.freeTarget(thumbLDR); thumbHDR = null; thumbLDR = null; }
    Post.resize(rw, rh, 5);
  }

  function noteLanes(now) {
    if (!bio.recording) return;
    if (now - noteLanes.fast > 100) { noteLanes.fast = now; bio.noteLane('rpm', +S.rpm.toFixed(1)); if (brainRide()) bio.noteLane('eeg', eegReading()); }
    if (now - noteLanes.mid > 500) { noteLanes.mid = now; bio.noteLane('dist', +Math.max(0, S.dist - recordBaseDist).toFixed(1)); bio.noteLane('vis', +S.vis.toFixed(3)); }
    if (now - noteLanes.slow > 1000) {
      noteLanes.slow = now;
      const n = bio.now;
      [['hr', num(n.hr, 1)], ['baseHr', num(n.baseHr, 1)], ['rmssd', num(n.rmssd, 1)], ['sdnn', num(n.sdnn, 1)], ['idx', num(n.idx, 1)], ['swing', num(n.swing, 2)], ['clarity', +S.clarity.toFixed(3)], ['hold', +S.holdT.toFixed(1)], ['dawn', +S.dawn.toFixed(3)]].forEach(([k, v]) => bio.noteLane(k, v));
    }
  }
  noteLanes.fast = noteLanes.mid = noteLanes.slow = 0;

  let last = performance.now(), slow = 0, fast = 0, stalled = 0, fails = 0, lastText = 0;
  function render(now) {
    requestAnimationFrame(render);
    try {
      const frameMs = now - last, dtMs = Math.min(100, frameMs), dt = dtMs / 1000;
      last = now;
      bio.tick(now); updateEEG(dt);
      fpsN++; if (now - fpsT > 500) { fps = (fpsN * 1000) / (now - fpsT); fpsN = 0; fpsT = now; }

      const n = bio.now;
      const playing = bio.demoOn || bio.replayOn || bio.hr.connected || bio.cadence.connected || manualRide() || brainRide();
      document.body.classList.toggle('playing', playing);
      shell.quietTick(now, bio.demoOn || (brainRide() ? S.eegValid : bio.hr.state === 'live' || bio.cadence.state === 'live'));

      if (now - lastText > 120) {
        lastText = now;
        renderStates(); renderReading(); renderHud();
        if ($('signal-sheet').open) { renderSignal(); drawSignal(); }
        if ($('route-sheet').open && frameIdx % 3 === 0) { drawElStrip(); drawCurve(); }
      }
      if (!G || gl.isContextLost()) return;

      acc += dt;
      let steps = 0;
      while (acc >= H && steps < 24) { step(); acc -= H; steps++; }
      if (steps === 24) acc = 0;
      noteLanes(now);
      if (S.biomeT < 1) { S.biomeT = Math.min(1, S.biomeT + dtMs / 6000); if (S.biomeT === 1) S.fromMix = null; }

      if (S.autoScene && !bio.replayOn && S.dist >= S.nextSceneAt) {
        S.nextSceneAt = S.dist + M_PER_MI;
        nextBiome();
        const mi = Math.max(1, Math.round(S.dist / M_PER_MI));
        shell.toast(`New scenery · ${BIOMES[S.biomeNext].name} (Mile ${mi})`);
      }
      if (frameIdx > 2 && (!thumbAt || (!S.pedal && S.rpm < 5 && now - thumbAt > 4000 && Math.abs(S.dusk - thumbDusk) > 0.04 && !document.body.classList.contains('quiet')))) drawThumbs(now);

      // When stopped on the bike for a few seconds, or before pedaling starts,
      // the cockpit settles into Watch: the camera looks up into the sky, and the weather
      // reflects your physiological signals. When you pedal or ride, it looks ahead down the road.
      const stoppedNow = S.rpm < 5 && S.speed < 0.2 && !S.pedal && !brainRide() && !(bio.demoOn && S.demoRide);
      if (stoppedNow) {
        S.stoppedTime = (S.stoppedTime || 0) + dt;
      } else {
        S.stoppedTime = 0;
      }
      const isWatch = S.mode === 'watch' || (S.mode === 'ride' && S.stoppedTime >= 2.5 && !(bio.demoOn && S.demoRide));
      if (S.mode === 'ride' || S.mode === 'watch') bio.mode = isWatch ? 'watch' : 'ride';

      const loadT = isWatch && n.phase === 'ready' && n.idx != null ? clamp(n.idx / 100, 0, 1) : 0;
      S.load += (loadT - S.load) * (1 - Math.exp(-dt / 2.5));
      // Train: the swing at pace lifts the fog. A hold that is lost decays at half rate, and nothing here can fail.
      if (S.mode === 'train') {
        const c = bio.replayOn ? (S.replayClarity != null ? S.replayClarity : 0) : BioMath.clarity(n.swing, bio.fullSwing);
        const clean = !bio.replayOn && c != null && n.hr != null && bio.pace.on;
        if (clean) {
          const above = c >= CLARITY_TARGET;
          S.holdT = Math.max(0, S.holdT + (above ? dt : -dt * 0.5));
          S.dawn = clamp(S.dawn + dt * (above ? 1 / 45 : -1 / 90), 0, 1);
          if (S.holdT >= SET_SECONDS) S.complete = true;
          if (S.complete) { S.holdT = SET_SECONDS; S.dawn = 1; }
        }
        S.clarity += ((c || 0) - S.clarity) * (1 - Math.exp(-dt / 1.6));
      } else { S.clarity *= Math.exp(-dt / 1.6); }
      const train = S.mode === 'train', ride = S.mode === 'ride';

      // Adapt the render size to the machine. The readings never depend on this.
      if (frameMs > 120) stalled++; else stalled = 0;
      if (frameMs > 26) slow++; else if (frameMs < 20) fast++;
      frameIdx++;
      if (stalled >= 2 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .5); resize(); stalled = 0; slow = 0; fast = 0;
      } else if (frameIdx % 15 === 0 && slow > 10 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .75); resize(); slow = 0; fast = 0;
      } else if (frameIdx % 90 === 0) {
        if (fast > 80 && lastScale < maxScale) { lastScale = Math.min(maxScale, lastScale * 1.2); resize(); }
        slow = 0; fast = 0;
      }

      /* uniforms */
      const a = S.fromMix || currentBiome(S.biome), b = currentBiome(), t = S.biomeT * S.biomeT * (3 - 2 * S.biomeT);
      const mix3 = (k) => a.c[k].map((v, i) => lerp(v, b.c[k][i], t));
      const mixN = (k) => lerp(a[k], b[k], t);
      const blendedScene = legacyScene() ? null : sceneNow();
      const routeUniforms = blendedScene ? CyclingScene.routeUniforms(blendedScene) : {};
      const cycle = RM.matches ? 0.3 : 0.5 - 0.5 * Math.cos((now / 1000 / 240 + 0.14) * Math.PI * 2);
      const duskT = train ? lerp(0.94, 0.06, S.dawn) : isWatch ? (S.duskHold != null ? S.duskHold : 0.74) + S.load * DUSK_BIAS : (S.duskHold != null ? S.duskHold : cycle);
      S.dusk += (clamp(duskT, 0, 1) - S.dusk) * Math.min(1, dtMs / 1400);
      const dusk = S.dusk, night = dusk * dusk;
      const haze = train ? (1 - S.dawn) * (1 - 0.55 * S.clarity) : 0;
      const land = legacyScene() ? null : CyclingScene.landAt(S.fromMix || currentBiome(S.biome), currentBiome(), S.biomeT, dusk);
      const skyTop = land ? land.uSkyTop : mix3('skyTop').map((v, i) => lerp(v, [0.004, 0.006, 0.024][i], dusk * 0.94));
      const skyHz = land ? land.uSkyHz : mix3('skyHz').map((v, i) => lerp(v, [0.1, 0.045, 0.11][i], dusk * 0.92));
      const fogBase = land ? land.uFog : mix3('fog').map((v) => v * (1 - dusk * 0.86));
      const hrWarmth = n.hr ? clamp((n.hr - 120) / 50, 0, 1) : 0;
      const fogC = fogBase.map((v, i) => lerp(v, [0.42, 0.22, 0.26][i], hrWarmth * 0.16)).map((v, i) => lerp(v, [0.17, 0.2, 0.28][i], haze * 0.8));
      const sunC = land ? (train ? land.uSunC.map((v) => v * (night > 0.5 ? 0.5 : 1)) : land.uSunC) : mix3('sun').map((v, i) => lerp(v, [0.26, 0.29, 0.44][i], night * 0.96 * (train ? 0.5 : 1)));
      const groundC = land ? land.uGround : mix3('ground');
      const rockC = land ? land.uRock : mix3('rock');
      const sunEl = train ? lerp(0.015, 0.2, S.dawn) : (land ? land.uSunDir[1] : Math.max(0.035, mixN('sunEl') * (1 - dusk * 0.7)));

      // Camera on the road. When stopped in watch mode, camera tilts up to watch the sky.
      // In active ride, it looks ahead down the road. In train, it sits between.
      const tall = cv.clientHeight > cv.clientWidth;
      const targetTilt = train ? (tall ? -0.1 : 0.16) : isWatch ? (tall ? 0.3 : 0.36) : (tall ? -0.04 : 0.02);
      S.tilt += (targetTilt - S.tilt) * Math.min(1, dtMs / 1100);
      const z = S.vis, cx = pathX(z), cy = roadY(z) + 1.55 + (blendedScene ? .95 * blendedScene.snake : 0), look = 26;
      const tx = pathX(z + look), ty = roadY(z + look) + 1.0 + look * S.tilt;
      let fx = tx - cx, fy = ty - cy, fz = look;
      const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
      S.motionCalm = brainRide() ? 1 - .85 * S.eegDrive : 1;
      const curveRoll = RM.matches ? 0 : S.motionCalm * clamp((pathX(z + 12) - 2 * pathX(z + 6) + cx) * (0.016 + 0.012 * (brainRide() ? S.eegDrive : motion01(S.rpm))), -0.075, 0.075);
      S.roll += (curveRoll - S.roll) * Math.min(1, dtMs / 200);
      let rx = fz, rz = -fx;
      const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
      let ux = rz * fy, uy = rx * fz - rz * fx, uz = -rx * fy;
      if (uy < 0) { ux = -ux; uy = -uy; uz = -uz; }
      const cr = Math.cos(S.roll), sr = Math.sin(S.roll);
      const right = [rx * cr + ux * sr, uy * sr, rz * cr + uz * sr];
      const up = [ux * cr - rx * sr, uy * cr, uz * cr - rz * sr];
      const camX = cx, camY = cy + (RM.matches ? 0 : Math.sin(S.vis * 0.9) * 0.009 * (brainRide() ? S.motionCalm : motion01(S.rpm)));
      const fwd = [fx, fy, fz];
      const sunAz = train ? Math.atan2(tx - cx, look) : mixN('sunAz');
      const sd = (() => { const x = Math.sin(sunAz), z2 = Math.cos(sunAz), y = sunEl, l = Math.hypot(x, y, z2); return [x / l, y / l, z2 / l]; })();
      const speed01 = clamp(S.speed / 14, 0, 1);
      const focal = RM.matches ? 1.08 : (1.08 - speed01 * 0.04), asp = rw / rh;

      for (let i = 0; i < 12; i++) {
        const r = rings[rings.length - 1 - i], o = i * 4;
        if (r) { ringData[o] = r.z; ringData[o + 1] = (now - r.t) / 1000; ringData[o + 2] = r.v; ringData[o + 3] = r.k; } else { ringData[o + 2] = 0; }
      }
      // The horizon is the last two minutes of heart rate, newest in the middle.
      let lo = 1e9, hi = 0;
      for (let i = 0; i < 64; i++) if (bio.hist[i] > 0) { lo = Math.min(lo, bio.hist[i]); hi = Math.max(hi, bio.hist[i]); }
      const span = Math.max(14, hi - lo);
      const ease = 1 - Math.exp(-dt / 1.1);
      for (let i = 0; i < 64; i++) {
        let sum = 0, w = 0;
        for (let k = -3; k <= 3; k++) { const v = bio.hist[clamp(i + k, 0, 63)]; if (v > 0) { const kw = 4 - Math.abs(k); sum += v * kw; w += kw; } }
        ridgeF[i] += ((w ? 0.07 + ((sum / w - lo) / span) * 0.26 : 0) - ridgeF[i]) * ease;
        ridge[i] = Math.round(clamp(ridgeF[i], 0, 1) * 255);
      }
      G.bindTex(1, tRidge);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, ridge);

      const beatLen = Math.max(6, (n.hr ? 60 / n.hr : 0.8) * Math.max(10, S.speed));
      const m = brainRide() ? S.eegDrive : motion01(S.rpm);
      S.pulse *= Math.exp(-dt / 0.24);
      const br = bio.breath();
      const nebulaAmt = smooth(0.26, 0.72, dusk) * (ride ? (S.look !== 'clear' ? 0.42 : 0) : train ? 0.32 * (1 - S.dawn) : 1);

      /* scene */
      gl.disable(gl.BLEND);
      G.into(scene);
      G.bindTex(0, tNoise); G.bindTex(1, tRidge);
      let ghostU = [0, 0, 0, 0];
      if (S.ghost) {
        const gd = ghostDistance(now);
        S.ghostGap = gd - S.dist;
        const gz = S.vis + S.ghostGap;
        ghostU = [pathX(gz), roadY(gz) + 1.15, gz, smooth(2, 12, S.ghostGap) * (1 - smooth(350, 620, S.ghostGap))];
      }
      if (legacyScene() && !pLegacyScene) {
        pLegacyScene = G.program(PathScene.SCENE_FS);
        pLegacyMote = G.program(PathScene.MOTE_FS, PathScene.MOTE_VS);
      }
      G.use(legacyScene() ? pLegacyScene : pScene, {
        ...routeUniforms,
        uLattice: S.spaceLattice ? 1.0 : 0.0,
        uN: 0, uS: 1, uRes: [rw, rh], uT: now / 1000, uFocal: focal, uBeat: beatLen, uSeed: S.seed,
        uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd,
        uSkyTop: skyTop, uSkyHz: skyHz, uSunC: sunC, uGround: groundC, uRock: rockC, uFog: fogC, uEdge: mix3('edge'), uSunDir: sd,
        uAmp: mixN('amp'), uRidge: mixN('ridge'), uSea: mixN('sea'), uSnow: mixN('snow'), uStrata: mixN('strata'), uGrid: mixN('grid'), uTrees: mixN('trees'), uDusk: dusk, uFogK: mixN('fogK') * (1 + haze * 7),
        uSpark: 0.12, uShimmer: 0.1, uAurora: S.look === 'clear' ? 0 : S.load * S.load * 0.26, uTravelSpeed: S.speed,
        uRing: ringData,
        uHaze: haze, uWeather: S.load, uWarm: smooth(0.16, 0.74, S.load), uBreath: br.ee, uBreathOn: train ? 1 : 0, uNebula: nebulaAmt, uGhost: ghostU,
      });
      G.draw();

      /* motes */
      if (S.look !== 'clear') {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        G.use(legacyScene() ? pLegacyMote : pMote, { ...routeUniforms, uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd, uFocal: focal, uAsp: asp, uZ: z, uPx: rh * 0.09, uSeed: S.seed, uSpark: 0.12, uShimmer: 0.1, uSpeedN: m, uEdge: mix3('edge') });
        gl.drawArrays(gl.POINTS, 0, Math.round(650 + 850 * (land ? land.uMisty : 1)));
        gl.disable(gl.BLEND);
      }

      /* feedback */
      const vpP = [pathX(z + 90) - camX, roadY(z + 90) + 1 - cy, 90];
      const cz = vpP[0] * fwd[0] + vpP[1] * fwd[1] + vpP[2] * fwd[2];
      const vp = [0.5 + ((vpP[0] * right[0] + vpP[1] * right[1] + vpP[2] * right[2]) * focal) / cz / asp / 2, 0.5 + ((vpP[0] * up[0] + vpP[1] * up[1] + vpP[2] * up[2]) * focal) / cz / 2];
      const fpsScale = dtMs / 16.67;
      const zoomNow = RM.matches ? S.zoom * 0.4 : 1 - Math.pow(1 - (S.zoom + (brainRide() || S.look === 'clear' ? 0 : 0.0012)), fpsScale);
      const wildEff = brainRide() ? (S.eegValid ? (S.wild || 0.35) * S.motionCalm : 0) : (S.look === 'clear' ? 0 : (train ? S.wild * (1 - S.clarity) : clamp(S.wild + S.load * AROUSAL_WILD, 0, 1)));
      S.effectiveWild = wildEff;
      G.into(dreamB);
      G.bindTex(0, scene.tex); G.bindTex(1, dreamA.tex);
      G.use(pDream, { uScene: 0, uPrev: 1, uVP: vp, uZoom: zoomNow, uDream: brainRide() ? (RM.matches ? (S.dream || 0.55) * 0.5 : (S.dream || 0.55)) * (1 - .7 * S.eegDrive) : (S.look === 'clear' ? 0 : ((RM.matches ? S.dream * 0.5 : S.dream) * (brainRide() ? 1 - .7 * S.eegDrive : 1))), uWild: wildEff, uT: now / 1000 });
      G.draw();
      const tmp = dreamA; dreamA = dreamB; dreamB = tmp;

      /* bloom and grade */
      const bloom = Post.bloom(dreamA.tex, 1.15);
      Post.finish(dreamA.tex, bloom, {
        uBloomK: S.look === 'clear' ? 0.22 : (0.22 + S.dream * 0.16 + S.load * 0.14),
        uExposure: 0.98 + dusk * 0.25,
        uFlash: 0, uFlashC: [1, 0.93, 0.82], uGrain: 0.022, uT: now / 1000,
        uVig: S.look === 'clear' ? 0.25 : (0.25 + S.load * 0.15),
        uSat: S.look === 'clear' ? 1.02 : (1.02 + wildEff * 0.22), rate: RM.matches ? 0.16 : 0.36, maxGain: 1,
      }, dt);

      /* the dotted orbit, over the finished picture */
      const scale = Math.min(1, asp * 1.15);
      let sunNdc = [0, 0];
      { const d = sd[0] * fwd[0] + sd[1] * fwd[1] + sd[2] * fwd[2]; if (d > 0.05) sunNdc = [((sd[0] * right[0] + sd[1] * right[1] + sd[2] * right[2]) * focal) / d / asp, ((sd[0] * up[0] + sd[1] * up[1] + sd[2] * up[2]) * focal) / d]; }
      const cT = train ? [sunNdc[0], sunNdc[1]] : [0, asp < 1 ? 0.3 : 0.27];
      S.orbitC = S.orbitC.map((v, i) => lerp(v, cT[i], Math.min(1, dtMs / 500)));
      const aT = (ride && !isWatch) ? 0 : train ? 0.95 : (bio.demoOn || bio.replayOn || bio.hr.connected ? 0.85 : 0.42);
      S.orbitA += (aT - S.orbitA) * Math.min(1, dtMs / 500);
      if (S.orbitA > 0.01) {
        const R = train ? lerp(0.2, 0.37, br.ee) * scale : 0.6 * scale;
        G.into(null);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        G.use(pOrbit, { uC: S.orbitC, uR: R, uAsp: asp, uT: now / 1000, uA: S.orbitA, uPx: Math.max(1.5, (cv.height / 900) * 2.1), uSquash: train ? 1 : 0.8 });
        gl.drawArrays(gl.POINTS, 0, train ? 620 : 900);
        gl.disable(gl.BLEND);
      }
      // The cue sits inside the breathing ring, wherever the sun has drifted to.
      if (train) {
        const bx = (S.orbitC[0] * 0.5 + 0.5) * cv.clientWidth;
        const sb = $('scenebar'), dw = document.querySelector('.dock-wrap');
        const minY = (sb ? sb.getBoundingClientRect().bottom : 80) + 32;
        const maxY = (dw ? dw.getBoundingClientRect().top : cv.clientHeight - 160) - 48;
        const rawY = (0.5 - S.orbitC[1] * 0.5) * cv.clientHeight;
        const by = maxY > minY ? clamp(rawY, minY, maxY) : rawY;
        $('breath').style.transform = `translate(${bx.toFixed(1)}px, ${by.toFixed(1)}px)`;
        $('breath').classList.toggle('on-light', S.dawn > 0.42);
      }

      if (lumaRec) lumaRec(now);
      if (wantSnap) { const done = wantSnap; wantSnap = null; cv.toBlob((blob) => done(blob), 'image/png'); }
    } catch (e) {
      if (fails++ < 3) console.error(e);
    }
  }

  /* ---- boot ---- */
  shell.setMode(S.mode);
  renderReading(); renderHud();
  if (!G) {
    shell.glFail('This page draws with WebGL2, which this browser did not provide. The sensors below still report their state.');
    const idle = (now) => { requestAnimationFrame(idle); bio.tick(now); if (now - lastText > 120) { lastText = now; renderStates(); renderReading(); renderHud(); if ($('signal-sheet').open) { renderSignal(); drawSignal(); } } };
    requestAnimationFrame(idle);
  } else {
    gl = G.gl;
    try {
      Post = createPost(G);
      pScene = G.program(SCENE_FS);
      pDream = G.program(DREAM_FS);
      pMote = G.program(MOTE_FS, MOTE_VS);
      pOrbit = G.program(ORBIT_FS, ORBIT_VS);
      tNoise = G.noiseTexture(20261102);
      tRidge = G.tex(64, 1, { internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE });
      resize();
      addEventListener('resize', resize);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); shell.glFail('The graphics context was lost. Reload the page to get the picture back.'); });
      requestAnimationFrame(render);
    } catch (e) {
      console.error(e);
      shell.glFail(`The picture could not start on this graphics card: ${String(e.message).slice(0, 140)}`);
    }
  }

  // For the flicker check: the picture's brightness on a small grid, every frame, straight after it is drawn.
  let lumaRec = null;
  function recordLuma(ms) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true }), frames = [], t0 = performance.now();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    return new Promise((res) => {
      lumaRec = (now) => {
        g.drawImage(cv, 0, 0, 64, 36);
        const d = g.getImageData(0, 0, 64, 36).data, grid = [];
        for (let i = 0; i < d.length; i += 4) grid.push(+(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]).toFixed(1));
        frames.push({ t: +(now - t0).toFixed(1), grid });
        if (now - t0 > ms) { lumaRec = null; res(frames); }
      };
    });
  }

  /* for the checks: read what is really on the canvas and in the engine */
  window.__app = {
    S, bio, eeg, setDrivePower, BioMath, BIOMES, pathX, roadY, gradeAt, gradeFactor, motion01, CLARITY_TARGET, recordLuma,
    setBiome, chooseBiome, nextBiome, setTod, setLook, setAuto, drawThumbs, sceneNow, step, sessionStart, startReplay, restoreStart,
    get renderInfo() { return { softwareRenderer, width: rw, height: rh, pixelBudget: sceneBudget * lastScale }; },
    pixel() {
      const c = document.createElement('canvas'); c.width = 32; c.height = 18;
      const g = c.getContext('2d');
      return new Promise((res) => { wantSnap = (blob) => { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data; let sum = 0, min = 1e9, max = 0; const grid = []; for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722; sum += l; min = Math.min(min, l); max = Math.max(max, l); grid.push(l); } res({ mean: sum / (d.length / 4), min, max, grid }); }; im.src = URL.createObjectURL(blob); }; });
    },
  };
})();
