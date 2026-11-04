/* endless.js: Endless Cockpit. A procedural road that keeps pace with your pedaling.
   Eight landscapes have their own terrain, roadside objects and route profiles, with an optional dream-feedback loop.
   Cadence sets the speed; scenery stays free of traveling light bars.
   Plants and occasional wildlife have fixed seeded world positions across the landscapes; animals are static. */
(function () {
  'use strict';
  const { createGL, createPost, FS_HEAD, srgb } = GLKit;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const RM = matchMedia('(prefers-reduced-motion: reduce)');

  const { BIOMES, WORLD_KEYS, NUMS, SCENE_FS, MOTE_VS, MOTE_FS, DREAM_FS, landAt } = CyclingScene;

  /* ---- the same road in JS and GLSL, so the camera, the grade readout and the picture agree ---- */
  const S = {
    rpm: 0, demo: false, demoT: 0, bleT: -1e12, bt: 'idle', btName: '', speed: 0, dist: 0, vis: 40, zoom: 0, grade: 0, gradeLoad: 0, roll: 0,
    map: { idle: 25, max: 95, maxZoom: 0.018, gamma: 1.6 }, dream: 0.15, wild: 0.1, seed: 0,
    pedal: false, steady: null, ble: null, bleName: '', biome: 0, biomeNext: 0, biomeT: 1, dusk: 0.3, ambient: 2.2, motionVersion: CadenceMotion.VERSION,
  };
  const M_PER_MI = 1609.34;
  const pathX = (z, b) => CyclingScene.pathX(z, S.seed, b || sceneNow());
  const roadY = (z, b) => CyclingScene.roadY(z, S.seed, b || sceneNow());
  const gradeAt = (z) => CyclingScene.gradeAt(z, S.seed, sceneNow());
  const gradeFactor = CadenceMotion.gradeFactor;
  const motion01 = (rpm) => CadenceMotion.motion01(rpm, S.map);

  /* ---- shaders ---- */

  /* ---- page ---- */
  const hudHtml = `
    <div class="gauge"><span class="k">Speed</span><span class="v"><span id="g-speed">0.0</span><small>mph</small></span></div>
    <div class="gauge hero"><span class="k">Cadence</span><span class="v" id="g-hero">--</span></div>
    <div class="gauge"><span class="k">Distance</span><span class="v"><span id="g-dist">0.00</span><small>mi</small></span></div>`;

  const routeSheet = `
    <div class="row-actions"><button class="pill" id="ride-sound">Ride sound: off</button></div>
    <div class="sig-title"><span>Route ahead</span><span id="grade-read">grade 0%</span></div>
    <canvas class="sig-canvas" id="elstrip" width="880" height="110" role="img" aria-label="Elevation of the procedural route ahead"></canvas>
    <p class="note">The route is procedural and seeded, not a real GPS track.</p>

    <details open><summary>Look</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Dream, how much of the last frame stays</span><b id="dream-v"></b></div><input type="range" id="dream" min="0" max="100"></label>
      <label class="field"><div class="row"><span>Wildness, warp and color split</span><b id="wild-v"></b></div><input type="range" id="wild" min="0" max="100"></label>
    </div></details>

    <details id="mapping"><summary>Cadence to motion</summary><div class="controls-grid" style="padding:10px 0 0">
      <label class="field"><div class="row"><span>Idle cadence, no motion below</span><b id="v-idle"></b></div><input type="range" id="m-idle" min="0" max="60"></label>
      <label class="field"><div class="row"><span>Top cadence, full speed above</span><b id="v-max"></b></div><input type="range" id="m-max" min="60" max="130"></label>
      <label class="field"><div class="row"><span>Zoom per frame at top speed</span><b id="v-zoom"></b></div><input type="range" id="m-zoom" min="4" max="40"></label>
      <label class="field"><div class="row"><span>Response curve</span><b id="v-gamma"></b></div><input type="range" id="m-gamma" min="60" max="320"></label>
      <div class="sig-title" style="margin:6px 0 0"><span>Cadence to zoom</span><span>live dot</span></div>
      <canvas class="sig-canvas" id="curve" width="880" height="170" role="img" aria-label="Transfer curve from cadence to zoom, with the live value"></canvas>
    </div></details>`;

  const TOD = [
    { v: null, label: 'Moving', title: 'A four-minute cycle from golden hour to night' },
    { v: 0.18, label: 'Golden hour', short: 'Golden' }, { v: 0.55, label: 'Dusk' }, { v: 1, label: 'Night' },
  ];
  const LOOKS = { clear: { label: 'Clear', dream: 0.15, wild: 0.1 }, dreamy: { label: 'Dreamy', dream: 0.55, wild: 0.35 }, wild: { label: 'Wild', dream: 0.78, wild: 0.85 } };
  const sceneBar = `
    <div class="scenebar chrome" id="scenebar">
      <div class="scene-tiles" id="scene-tiles" role="group" aria-label="Scenery">
        ${BIOMES.map((b, i) => `<button class="scene-tile" data-b="${i}" aria-pressed="${i === 0}" title="${b.description}"><canvas width="336" height="196" aria-hidden="true" style="background:linear-gradient(${b.skyTop},${b.skyHz} 54%,${b.ground} 55%)"></canvas><span>${b.name}</span></button>`).join('')}
      </div>
      <p class="route-caption" id="route-caption">${BIOMES[0].description}</p>
      <div class="scene-row">
        <div class="seg" role="group" aria-label="Time of day">${TOD.map((t, i) => `<button data-tod="${i}" aria-pressed="${i === 0}"${t.title ? ` title="${t.title}"` : ''}${t.short ? ` aria-label="${t.label}"><span class="long">${t.label}</span><span class="short">${t.short}</span>` : `>${t.label}`}</button>`).join('')}</div>
        <div class="seg" role="group" aria-label="Look">${Object.entries(LOOKS).map(([k, l]) => `<button data-look="${k}" aria-pressed="${k === 'clear'}">${l.label}</button>`).join('')}</div>
        <button class="seg-solo" id="auto-scene" aria-pressed="true" aria-label="Auto scenery: new scenery every mile" title="A new scene blends in after each mile you ride"><span class="long">New scenery every mile</span><span class="short">Auto scenery</span></button>
        <button class="seg-solo" id="new-route">New route</button>
      </div>
    </div>`;

  const connectHtml = `
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>
      <div class="device-info" id="bt-info" data-tone="idle">
        <strong>Cadence sensor <span class="dot"></span></strong>
        <p class="state" id="bt-state">Not connected</p>
        <p class="why" id="bt-why">A Bluetooth cadence sensor or smart trainer connects straight from Chrome or Edge.</p>
      </div>
      <button class="pill" id="ble-connect">Connect</button>
    </div>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M7 17l10-10M7 7h10v10"/></svg>
      <div class="device-info">
        <strong>No sensor</strong>
        <p class="why">Hold Space, or the Hold to pedal button, to pedal at 88 rpm. Or set a steady cadence below.</p>
      </div>
    </div>
    <div class="controls-grid">
      <label class="field"><div class="row"><span>Steady cadence</span><b id="steady-v">off</b></div><input type="range" id="steady" min="0" max="120" value="0"></label>
    </div>
    <div class="device-card">
      <svg viewBox="0 0 24 24" aria-hidden="true" class="ic"><path d="M7 5v14l11-7z"/></svg>
      <div class="device-info">
        <strong>Just looking</strong>
        <p class="why">The demo is a synthetic interval ride. It is labeled on screen the whole time.</p>
      </div>
      <button class="pill" id="demo-sheet-ride">Run demo</button>
    </div>`;

  const about = `
    <p class="sheet-intro">Everything you see here is a stated rule. There is no model and no server.</p>
    <table class="maptable"><tbody>
      <tr><th>Cadence</th><td>Sets the speed, and the zoom of the picture each frame, through the curve under Route.</td></tr>
      <tr><th>Scenery</th><td>Eight shared routes, with clear road surfaces and no traveling light bars.</td></tr>
      <tr><th>Grade</th><td>The procedural road's slope changes your speed by up to 40%, never the zoom curve.</td></tr>
      <tr><th>Distance</th><td>Counts only the speed your cadence makes, never the slow drift at rest.</td></tr>
      <tr><th>Scenery</th><td>Eight shared routes: Golden coast, Tropical preserve, Meadow lanes, New England Autumn, Red canyon, Rainbow orbit, Misty pines and Snake Way. With New scenery every mile on, the next one blends in after each mile you ride, counted only while your cadence moves the road.</td></tr>
      <tr><th>Time of day</th><td>A four-minute cycle from golden hour to night, or held where you choose.</td></tr>
      <tr><th>Look</th><td>Clear, Dreamy and Wild set how much of the last frame stays and how much it warps. The sliders under Scenery fine-tune both.</td></tr>
    </tbody></table>
    <p class="note">Keys: hold <b>Space</b> to pedal · <b>D</b> demo · <b>C</b> connect · <b>B</b> next scene · <b>T</b> time of day · <b>F</b> full screen · <b>H</b> hide controls.</p>`;

  const sessionHtml = `
    <div class="row-actions">
      <button class="pill primary" id="rec-toggle">Start recording</button>
      <button class="pill" id="replay-load">Replay a ride file</button>
      <button class="pill" id="replay-stop" hidden>Stop replay</button>
      <button class="pill" id="snapshot">Save a picture</button>
      <input type="file" id="replay-file" accept="application/json,.json" hidden>
    </div>
    <label class="check"><input type="checkbox" id="rec-video"> Also save a video of the screen, with the ride sound if it is on</label>
    <p class="note" id="rec-status" role="status">Not recording.</p>`;

  const aboutHtml = `${about}
    <details><summary>Safety and privacy</summary>
      <p>A limiter slows large changes in brightness. The automated flicker check measures this build against the WCAG general-flash threshold. That is a measured screen, not a medical guarantee. If flashing or moving light affects you, take care, and turn on your system's reduced-motion setting, which tightens the limiter and calms the camera.</p>
      <p>Cadence is read in this browser and never sent anywhere. The page makes no network requests after it loads. Your scene and settings stay in this browser's storage.</p>
    </details>
    <details><summary>Ideas credited</summary>
      <p>No outside code is included. The feedback loop follows the idea of Milkdrop's warp, as in <a href="https://github.com/jberg/butterchurn" rel="noopener">Butterchurn</a> (MIT).</p>
    </details>
    <p class="note"><a href="field-guide.html#endless">Read the field guide</a> · <a href="__REPO_URL__" rel="noopener">Source</a></p>`;

  const ride = createRide();
  const COARSE = matchMedia('(hover: none) and (pointer: coarse)').matches;      // a phone or tablet: no Space key to hold
  const BANDS = 64;
  const brand = '<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M12 3 4 25M12 3l8 22M12 9v3M12 15v3M12 21v4"/></svg>';
  const btView = () => {
    if (S.bt === 'live' || S.bt === 'connected') {
      const fresh = performance.now() - S.bleT < 3000;
      return fresh ? ['good', `Sensor · ${Math.round(S.ble || 0)} rpm`, `Live · ${Math.round(S.ble || 0)} rpm`, S.btName] : ['warn', 'Sensor · no cadence yet', 'Connected · no cadence yet', `${S.btName}. Start pedaling. Some sensors send nothing until the crank turns.`];
    }
    return {
      idle: ['idle', 'Sensor · not connected', 'Not connected', 'A Bluetooth cadence sensor or smart trainer connects straight from Chrome or Edge.'],
      unsupported: ['bad', 'Sensor · no Bluetooth here', 'No Web Bluetooth in this browser', 'Chrome or Edge on a computer can connect a sensor. Pedal by hand here instead.'],
      requesting: ['wait', 'Sensor · choosing', 'Choose a sensor in the browser prompt', ''],
      'no-choice': ['warn', 'Sensor · none chosen', 'No sensor chosen', 'The prompt closed without a sensor. Wake the sensor by turning the crank, then try again.'],
      failed: ['bad', 'Sensor · could not connect', 'Could not connect', S.btWhy || 'The sensor did not answer. Turn the crank to wake it and try again.'],
      lost: ['bad', 'Sensor · disconnected', 'Sensor disconnected', `${S.btName || 'The sensor'} went away. Connect again when it is back.`],
    }[S.bt];
  };
  const source = () => {
    if (S.demo) return ['demo', 'Demo · a synthetic ride, not your cadence'];
    if (ride.replayOn) return ['replay', 'Replay · a recorded ride, not live'];
    const v = btView();
    if (S.bt === 'live' || S.bt === 'connected') return [v[0] === 'good' ? 'live' : 'open', v[2]];
    if (S.pedal) return ['live', 'Pedaling by hand'];
    if (S.steady != null) return ['live', `Steady cadence · ${S.steady} rpm`];
    return ['ambient', 'Ambient · no cadence'];
  };
  const toggleDemo = () => { S.demo = !S.demo; S.demoT = 0; if (S.demo && ride.replayOn) ride.stopReplay(); renderStates(); };
  const shell = mountChrome({
    id: 'endless-cockpit', name: 'Endless Cockpit', brand,
    intro: { eyebrow: 'Endless Cockpit · a road that keeps your pace', title: 'Ride as far as you like.', subtitle: COARSE ? 'Connect a cadence sensor, or hold the pedal button. No helper app, no server.' : 'Connect a cadence sensor, or hold Space to pedal. No helper app, no server.' },
    stage: sceneBar,
    hud: hudHtml,
    badges: `
      <button class="source-badge" id="source-badge" data-source="ambient" title="Open the cadence settings"><span class="dot" aria-hidden="true"></span><span id="source-label">Ambient · no cadence</span></button>
      <button class="chip chrome" id="chip-sensor" data-tone="idle"><span class="dot" aria-hidden="true"></span><span id="chip-sensor-text">Sensor · not connected</span></button>`,
    truth: 'Procedural road with no model. Your cadence sets the speed, and nothing leaves this browser.',
    sheets: [
      { id: 'connect', label: 'Connect', icon: 'connect', title: 'Bring your ride.', intro: 'Speed comes from your cadence: a Bluetooth sensor, the pedal button, or a steady setting.', html: connectHtml },
      { id: 'route', label: 'Scenery', icon: 'route', title: 'Fine-tune the road.', intro: 'Scenes, time of day and looks are on the main screen. These fine-tune how it looks and moves, and never change the readings.', html: routeSheet },
      { id: 'session', label: 'Session', icon: 'session', title: 'Keep what you rode.', intro: 'A ride file holds your cadence, scene and route over time. Nothing leaves this computer unless you share the file.', html: sessionHtml },
      { id: 'about', label: 'About', icon: 'about', title: 'What drives what.', html: aboutHtml },
    ],
    onOpenSheet: (name) => { if (name === 'route') { drawElStrip(); drawCurve(); } },
    toggleDemo,
    onKey: (e, key) => { if (key === 'b') nextBiome(); else if (key === 't') setTod((S.tod + 1) % TOD.length); },
  });
  ['source-badge', 'chip-sensor'].forEach((id) => $(id).addEventListener('click', () => shell.openSheet('connect')));

  /* ---- what the page says about its source, in the same words everywhere ---- */
  function renderStates() {
    const [src, label] = source(), v = btView();
    const badge = $('source-badge');
    if (badge.dataset.source !== src) badge.dataset.source = src;
    if ($('source-label').textContent !== label) $('source-label').textContent = label;
    const chip = $('chip-sensor');
    if (chip.dataset.tone !== v[0]) chip.dataset.tone = v[0];
    if ($('chip-sensor-text').textContent !== v[1]) $('chip-sensor-text').textContent = v[1];
    $('demo-button').textContent = S.demo ? 'End demo' : 'Try a demo';
    $('bt-info').dataset.tone = v[0]; $('bt-state').textContent = v[2]; $('bt-why').textContent = v[3];
    $('ble-connect').textContent = S.bt === 'live' || S.bt === 'connected' ? 'Connected' : S.bt === 'idle' ? 'Connect' : 'Try again';
    $('ble-connect').disabled = S.bt === 'unsupported' || S.bt === 'requesting';
    $('demo-sheet-ride').textContent = S.demo ? 'End demo' : 'Run demo';
    $('replay-stop').hidden = !ride.replayOn;
    const spoken = `${label}.`;
    if ($('sr-status').textContent !== spoken) $('sr-status').textContent = spoken;
  }
  ride.on('state', renderStates);

  /* ---- per frame: the frame's own state, ten times a second ---- */
  let lastText = 0;
  function pageFrame(now) {
    const playing = S.demo || ride.replayOn || S.rpm > 2;
    document.body.classList.toggle('playing', playing);
    shell.quietTick(now, playing);
    if (now - lastText > 120) { lastText = now; renderStates(); }
  }

  const cv = $('stage');
  const G = createGL(cv);
  // A CPU WebGL renderer cannot afford the hardware pixel budget even for its
  // first frame. UI remains full resolution; only the scenery is scaled.
  const softwareRenderer = (() => {
    if (!G) return false;
    const g = G.gl, ext = g.getExtension('WEBGL_debug_renderer_info');
    const renderer = g.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '';
    return /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(renderer);
  })();
  const sceneBudget = softwareRenderer ? 80000 : 1.35e6;
  const minScale = (softwareRenderer ? 20000 : 60000) / sceneBudget;
  const maxScale = softwareRenderer ? 1 : 1.9;
  let gl, Post, pScene, pDream, pMote, tNoise, tSpec;
  let scene, dreamA, dreamB, rw = 0, rh = 0, frameIdx = 0, lastScale = 1;
  const specBytes = new Uint8Array(BANDS), ridge = new Float32Array(BANDS);

  ride.on('recording', () => {
    ride.noteLane('routeStart', { biome: S.biomeNext, seed: S.seed, tod: S.tod, vis: S.vis, dist: S.dist, map: { ...S.map }, ...(S.motionVersion ? { motionVersion: S.motionVersion } : {}) });
  });
  ride.on('lane', (l) => {
    if (l.name === 'routeStart') {
      const v = l.value;
      if (!v || typeof v !== 'object') return;
      S.motionVersion = v.motionVersion || null;
      if (BIOMES[v.biome]) setBiome(v.biome, true);
      if (TOD[v.tod]) setTod(v.tod, true);
      for (const k of ['seed','vis','dist']) if (Number.isFinite(v[k])) S[k] = v[k];
      const limits = { idle: [0,60], max: [60,130], maxZoom: [.004,.04], gamma: [.6,3.2] };
      if (v.map) for (const k of Object.keys(limits)) if (Number.isFinite(v.map[k])) S.map[k] = clamp(v.map[k], ...limits[k]);
      for (const [id,key,scale,label,suffix] of [['idle','idle',1,'v-idle',' rpm'],['max','max',1,'v-max',' rpm'],['zoom','maxZoom',1000,'v-zoom','%'],['gamma','gamma',100,'v-gamma','']]) {
        const input = $('m-'+id); input.value = S.map[key]*scale; shell.syncRange(input);
        $(label).textContent = (id==='zoom' ? (S.map[key]*100).toFixed(1) : id==='gamma' ? S.map[key].toFixed(2) : S.map[key]) + suffix;
      }
      S.nextSceneAt = S.dist + M_PER_MI;
      thumbAt = 0;
    }
    else if (l.name === 'rpm') S.replayRpm = l.value;
    else if (l.name === 'biome') setBiome(l.value);
    else if (l.name === 'seed') { S.seed = l.value; thumbAt = 0; }
    else if (l.name === 'tod') setTod(l.value, true);
  });
  ride.on('replay', (on) => { S.motionVersion = on ? null : CadenceMotion.VERSION; if (!on) S.replayRpm = null; });

  /* ---- scenery: eight scenes, the time of day and a look, all on the main screen, and remembered ---- */
  const SAVE_KEY = 'endless-cockpit-scenery';
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ b: S.biomeNext, tod: S.tod, look: S.look, dream: S.dream, wild: S.wild, auto: S.autoScene })); } catch (e) { /* storage can be off */ } };
  const pressOnly = (sel, on) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(on(b))));
  function setBiome(i, instant) {
    if (!BIOMES[i] || (i === S.biomeNext && !instant)) return;
    S.fromMix = instant ? null : sceneNow();
    S.biome = instant ? i : S.biomeNext; S.biomeNext = i; S.biomeT = instant ? 1 : 0;
    ride.noteLane('biome', i);
    pressOnly('.scene-tile', (b) => +b.dataset.b === i);
    document.body.style.setProperty('--accent', BIOMES[i].edge);
    $('route-caption').textContent = BIOMES[i].description;
    save();
  }
  function nextBiome() { setBiome((S.biomeNext + 1) % BIOMES.length); }
  function setTod(i, quiet) {
    S.tod = i; S.duskHold = TOD[i].v;
    pressOnly('[data-tod]', (b) => +b.dataset.tod === i);
    ride.noteLane('tod', i);
    if (!quiet) shell.toast(`Time of day · ${TOD[i].label}`);
    save();
  }
  function setLook(k, quiet) {
    const L = LOOKS[k];
    if (!quiet) shell.toast(`Look · ${L.label}`);
    S.look = k; S.dream = L.dream; S.wild = L.wild;
    ['dream', 'wild'].forEach((id) => { const r = $(id); if (!r) return; r.value = Math.round(S[id] * 100); shell.syncRange(r); $(`${id}-v`).textContent = `${r.value}%`; });
    pressOnly('[data-look]', (b) => b.dataset.look === k);
    save();
  }
  function setAuto(on) {
    S.autoScene = on; S.nextSceneAt = S.dist + M_PER_MI;
    $('auto-scene').setAttribute('aria-pressed', String(on));
    save();
  }
  $('scene-tiles').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b) setBiome(+b.dataset.b); });
  document.querySelectorAll('[data-tod]').forEach((b) => b.addEventListener('click', () => setTod(+b.dataset.tod)));
  document.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => setLook(b.dataset.look)));
  $('auto-scene').addEventListener('click', () => setAuto(!S.autoScene));
  $('new-route').addEventListener('click', () => { S.seed = (Math.random() * 40) | 0; thumbAt = 0; ride.noteLane('seed', S.seed); shell.toast('New route'); });
  S.tod = 0; S.look = 'clear'; S.autoScene = true; S.nextSceneAt = M_PER_MI;
  document.body.style.setProperty('--accent', BIOMES[0].edge);

  /* ---- sheet controls ---- */
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
  ['dream', 'wild'].forEach((id) => $(id).addEventListener('input', () => { S.look = null; pressOnly('[data-look]', () => false); save(); }));
  // A visit picks up where the last one left off.
  (() => {
    let v = null;
    try { v = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { /* storage can be off */ }
    if (!v) return;
    if (BIOMES[v.b]) setBiome(v.b, true);
    if (TOD[v.tod]) setTod(v.tod, true);
    if (LOOKS[v.look]) setLook(v.look, true);
    else if (typeof v.dream === 'number' && typeof v.wild === 'number') { setLook('dreamy', true); S.look = null; S.dream = clamp(v.dream, 0, 1); S.wild = clamp(v.wild, 0, 1); pressOnly('[data-look]', () => false); ['dream', 'wild'].forEach((id) => { const r = $(id); r.value = Math.round(S[id] * 100); shell.syncRange(r); $(`${id}-v`).textContent = `${r.value}%`; }); }
    if (typeof v.auto === 'boolean') setAuto(v.auto);
  })();
  bind('m-idle', () => S.map.idle, (v) => { S.map.idle = v; }, (v) => `${v} rpm`, 'v-idle');
  bind('m-max', () => S.map.max, (v) => { S.map.max = v; }, (v) => `${v} rpm`, 'v-max');
  bind('m-zoom', () => S.map.maxZoom * 1000, (v) => { S.map.maxZoom = v / 1000; }, (v) => `${(v / 10).toFixed(1)}%`, 'v-zoom');
  bind('m-gamma', () => S.map.gamma * 100, (v) => { S.map.gamma = v / 100; }, (v) => (v / 100).toFixed(2), 'v-gamma');
  bind('steady', () => 0, (v) => { S.steady = v > 0 ? v : null; }, (v) => (v > 0 ? `${v} rpm` : 'off'), 'steady-v');
  $('demo-sheet-ride').addEventListener('click', () => { S.demo = !S.demo; S.demoT = 0; if (S.demo) $('connect-sheet').close(); });

  /* the pedal button lives on the stage */
  const pedalBtn = document.createElement('button');
  pedalBtn.className = 'pill primary chrome'; pedalBtn.id = 'pedal'; pedalBtn.textContent = 'Hold to pedal';
  document.querySelector('.dock-wrap').insertBefore(pedalBtn, document.querySelector('.badges'));
  const pedalOn = () => { S.pedal = true; pedalBtn.classList.add('on'); };
  const pedalOff = () => { S.pedal = false; pedalBtn.classList.remove('on'); };
  pedalBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); pedalOn(); });
  pedalBtn.addEventListener('contextmenu', (e) => e.preventDefault());     // a long press on a phone is pedaling, not a menu
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => pedalBtn.addEventListener(ev, pedalOff));
  addEventListener('keydown', (e) => { if (e.code === 'Space' && !e.repeat && !e.target.closest('dialog[open], input, select, button')) { e.preventDefault(); pedalOn(); } });
  addEventListener('keyup', (e) => { if (e.code === 'Space') pedalOff(); });
  addEventListener('blur', pedalOff);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pedalOff(); });
  /* ---- recording and replay: cadence, scene and route, with an optional video of the screen ---- */
  let recorder = null;
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  $('rec-toggle').addEventListener('click', () => {
    if (!ride.recording) {
      ride.startRecording('endless-cockpit', S.demo);
      if ($('rec-video').checked && cv.captureStream && window.MediaRecorder) {
        const st = cv.captureStream(60);
        const sound = rideSoundStream();
        if (sound) sound.getAudioTracks().forEach((t) => st.addTrack(t));
        const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m));
        const chunks = [];
        const activeRecorder = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 14e6 } : {});
        recorder = activeRecorder;
        activeRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        activeRecorder.onstop = () => {
          shell.download(new Blob(chunks, { type: activeRecorder.mimeType }), `endless-cockpit-${stamp()}.${(activeRecorder.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);
          st.getVideoTracks().forEach((track) => track.stop());
        };
        activeRecorder.start(1000);
      }
      $('rec-toggle').textContent = 'Stop and save';
      $('session-button').classList.add('rec');
      $('rec-status').textContent = 'Recording. Ride, then press Stop and save.';
    } else {
      const s = ride.stopRecording();
      if (recorder) { recorder.stop(); recorder = null; }
      shell.download(new Blob([JSON.stringify(s)], { type: 'application/json' }), `endless-cockpit-ride-${stamp()}.json`);
      $('rec-toggle').textContent = 'Start recording';
      $('session-button').classList.remove('rec');
      $('rec-status').textContent = `Saved ${Math.round(s.durationMs / 1000)} s of riding.`;
    }
  });
  $('replay-load').addEventListener('click', () => $('replay-file').click());
  $('replay-stop').addEventListener('click', () => ride.stopReplay());
  $('replay-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const s = JSON.parse(await f.text());
      S.demo = false;
      ride.startReplay(s);
      $('rec-status').textContent = `Replaying a ride from ${new Date(s.created).toLocaleString()}.`;
      $('session-sheet').close();
    } catch (err) { $('rec-status').textContent = `That file could not be replayed: ${err.message}`; }
  });
  $('snapshot').addEventListener('click', () => snap((blob) => shell.download(blob, `endless-cockpit-${stamp()}.png`)));

  /* ---- Bluetooth cadence, ported unchanged from the first version: CSC and FTMS ---- */
  let lastCrankRev = null, lastCrankT = null;
  function onCSC(e) {
    const dv = e.target.value, flags = dv.getUint8(0);
    let off = 1;
    if (flags & 0x01) off += 6;
    if (flags & 0x02) {
      const crankRev = dv.getUint16(off, true); off += 2;
      const crankT = dv.getUint16(off, true);
      if (lastCrankRev != null) {
        let dRev = crankRev - lastCrankRev; if (dRev < 0) dRev += 65536;
        let dT = crankT - lastCrankT; if (dT < 0) dT += 65536;
        const secs = dT / 1024;
        if (secs > 0 && S.bt !== 'lost') { const rpm = (dRev / secs) * 60; if (rpm < 250) { S.ble = rpm; S.bleT = performance.now(); S.bt = 'live'; } }
        if (dRev === 0 && secs > 1.5) { S.ble = 0; S.bleT = performance.now(); }
      }
      lastCrankRev = crankRev; lastCrankT = crankT;
    }
  }
  function onFTMS(e) {
    const dv = e.target.value, flags = dv.getUint16(0, true);
    let off = 2;
    if (!(flags & 0x0001)) off += 2;
    if (flags & 0x0002) off += 2;
    if (flags & 0x0004 && S.bt !== 'lost') { const cad = dv.getUint16(off, true) * 0.5; if (cad >= 0 && cad < 250) { S.ble = cad; S.bleT = performance.now(); S.bt = 'live'; } }
  }
  $('ble-connect').addEventListener('click', async () => {
    if (!navigator.bluetooth) { S.bt = 'unsupported'; return; }
    try {
      S.bt = 'requesting';
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: ['cycling_speed_and_cadence'] }, { services: ['fitness_machine'] }], optionalServices: ['cycling_speed_and_cadence', 'fitness_machine'] });
      S.btName = dev.name || 'Cadence sensor';
      const gatt = await dev.gatt.connect();
      let svc, ch, kind;
      try { svc = await gatt.getPrimaryService('cycling_speed_and_cadence'); ch = await svc.getCharacteristic('csc_measurement'); kind = 'csc'; } catch (e) { svc = await gatt.getPrimaryService('fitness_machine'); ch = await svc.getCharacteristic('indoor_bike_data'); kind = 'ftms'; }
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', kind === 'csc' ? onCSC : onFTMS);
      S.ble = 0; S.bleT = -1e12; S.bt = 'connected';     // no reading yet: a zero time would look fresh for the page's first 3 s
      dev.addEventListener('gattserverdisconnected', () => { S.ble = null; S.bt = 'lost'; });
    } catch (err) {
      S.ble = null;
      if (err.name === 'NotFoundError') S.bt = 'no-choice';
      else { S.bt = 'failed'; S.btWhy = `The sensor did not connect: ${err.message}`; }
    }
  });
  if (!navigator.bluetooth) S.bt = 'unsupported';

  /* ---- ride sound: cadence-driven atoms, ported from the first version, off by default ---- */
  const ATOMS = [[98, 130.81, 196, 246.94, 293.66, 392, 493.88], [110, 146.83, 220, 277.18, 329.63, 440, 554.37], [130.81, 164.81, 196, 261.63, 392, 523.25, 659.25], [123.47, 164.81, 246.94, 329.63, 493.94, 659.25, 987.77], [82.41, 110, 164.81, 220, 277.18, 329.63, 415.3], [146.83, 196, 246.94, 293.66, 392, 493.88, 587.33]];
  let AC = null, sndOn = false, sndGain = null, sndDest = null, nextGrain = 0;
  const rideSoundStream = () => (sndOn && sndDest ? sndDest.stream : null);
  function curAtoms() { const a = ATOMS[S.biome], b = ATOMS[S.biomeNext], t = S.biomeT; return a.map((v, i) => lerp(v, b[i], t)); }
  function grainTick() {
    if (!AC || !sndOn) return;
    const rate = Math.min(24, (S.rpm / 130) * 24);
    if (nextGrain < AC.currentTime) nextGrain = AC.currentTime + 0.02;
    if (rate < 0.5) { nextGrain = AC.currentTime + 0.08; return; }
    const atoms = curAtoms();
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
  $('ride-sound').addEventListener('click', function () {
    if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); sndGain = AC.createGain(); sndGain.gain.value = 0; sndGain.connect(AC.destination); sndDest = AC.createMediaStreamDestination(); sndGain.connect(sndDest); setInterval(grainTick, 45); }
    if (AC.state === 'suspended') AC.resume();
    sndOn = !sndOn;
    this.textContent = `Ride sound: ${sndOn ? 'on' : 'off'}`; this.classList.toggle('on', sndOn);
    sndGain.gain.linearRampToValueAtTime(sndOn ? 0.5 : 0, AC.currentTime + 0.25);
  });

  /* ---- small canvases in the Route sheet ---- */
  function drawElStrip() {
    const c = $('elstrip').getContext('2d'), w = 880, h = 110;
    c.clearRect(0, 0, w, h);
    const pts = [], span = 1400;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i <= 200; i++) { const y = roadY(S.vis + (i / 200) * span); pts.push(y); lo = Math.min(lo, y); hi = Math.max(hi, y); }
    const Y = (v) => h - 14 - ((v - lo) / Math.max(1, hi - lo)) * (h - 34);
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.lineTo(w, h); c.lineTo(0, h); c.closePath();
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `${BIOMES[S.biomeNext].edge}66`); g.addColorStop(1, `${BIOMES[S.biomeNext].edge}05`);
    c.fillStyle = g; c.fill();
    c.beginPath(); pts.forEach((v, i) => { const x = (i / 200) * w; if (i) c.lineTo(x, Y(v)); else c.moveTo(x, Y(v)); });
    c.strokeStyle = BIOMES[S.biomeNext].edge; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(4, Y(pts[0]), 4.5, 0, 6.3); c.fill();
    $('grade-read').textContent = `grade ${(S.grade * 100 >= 0 ? '+' : '') + (S.grade * 100).toFixed(1)}%`;
  }
  function drawCurve() {
    const c = $('curve').getContext('2d'), w = 880, h = 170;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(191,194,236,.16)'; c.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => { c.beginPath(); c.moveTo(0, f * h); c.lineTo(w, f * h); c.stroke(); });
    const X = (rpm) => (rpm / 130) * w, Y = (m) => h - 10 - m * (h - 20);
    c.beginPath();
    for (let r = 0; r <= 130; r += 1) { const y = Y(motion01(r)); if (r) c.lineTo(X(r), y); else c.moveTo(X(r), y); }
    c.strokeStyle = BIOMES[S.biomeNext].edge; c.lineWidth = 2.4; c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(X(clamp(S.rpm, 0, 130)), Y(motion01(S.rpm)), 6, 0, 6.3); c.fill();
    c.fillStyle = 'rgba(238,237,251,.7)'; c.font = '19px ui-sans-serif,-apple-system,sans-serif';
    c.fillText(`${Math.round(S.rpm)} rpm → ${(S.zoom * 100).toFixed(2)}% a frame`, 14, 28);
  }

  /* ---- snapshot ---- */
  let wantSnap = null;
  function snap(done) { wantSnap = done; }

  /* ---- motion: fixed step, so a replay lands in the same place at any frame rate ---- */
  function targetRpm(h) {
    let sourceRpm = null;
    if (S.demo) { S.demoT += h; sourceRpm = CadenceMotion.workoutRpm(S.demoT); }
    else if (S.ble != null && performance.now() - S.bleT < 3000) sourceRpm = S.ble;
    return CadenceMotion.target({ replayRpm: S.replayRpm, sourceRpm, steady: S.steady, pedal: S.pedal }, h).rpm;
  }
  let acc = 0, rpmAcc = 0;
  const H = CadenceMotion.STEP;
  function step() {
    const q = CadenceMotion.step({ rpm: S.rpm, targetRpm: targetRpm(H), dt: H, map: S.map, grade: gradeAt(S.vis),
      maxSpeed: ride.replayOn && !S.motionVersion ? 7 : CadenceMotion.MAX_SPEED });
    S.rpm = q.rpm; S.zoom = q.zoom; S.grade = q.grade; S.gradeLoad = q.gradeLoad; S.speed = q.speed;
    S.dist += q.distanceDelta;
    S.vis += q.visualDelta;
  }

  /* ---- one scene's sky and land at a time of day: the road and the scene tiles both draw from this ---- */
  // The scene on screen right now, frozen, so a new choice blends from it instead of jumping back to a scene's start.
  function sceneNow() {
    const a = S.fromMix || BIOMES[S.biome], b = BIOMES[S.biomeNext], t = S.biomeT * S.biomeT * (3 - 2 * S.biomeT);
    const m = { c: {} };
    Object.keys(b.c).forEach((k) => { m.c[k] = a.c[k].map((v, i) => lerp(v, b.c[k][i], t)); });
    NUMS.forEach((k) => { m[k] = lerp(a[k], b[k], t); });
    return m;
  }
  /* ---- the camera on the road at z, looking ahead along it, toward the low sun ---- */
  function camAt(z, roll, b) {
    const cx = pathX(z, b), cy = roadY(z, b) + 1.65 + .95 * (b || sceneNow()).snake, look = 26;
    let fx = pathX(z + look, b) - cx, fy = roadY(z + look, b) + 1.1 - cy, fz = look;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = fz, ry = 0, rz = -fx;
    const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    let ux = -ry * fz + rz * fy, uy = rx * fz - rz * fx, uz = ry * fx - rx * fy;
    if (uy < 0) { ux = -ux; uy = -uy; uz = -uz; }
    const cr = Math.cos(roll), sr = Math.sin(roll);
    return { cx, cy, fwd: [fx, fy, fz], right: [rx * cr + ux * sr, ry * cr + uy * sr, rz * cr + uz * sr], up: [ux * cr - rx * sr, uy * cr - ry * sr, uz * cr - rz * sr] };
  }

  /* ---- scene tiles: each scene drawn small by the road's own shader, at the current time of day ---- */
  const THUMB_FS = FS_HEAD + `
uniform sampler2D uScene; uniform float uExposure;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.); }
void main(){ vec3 c=aces(texture(uScene,vUv).rgb*uExposure); vec2 q=vUv-.5; c*=1.-.45*smoothstep(.25,.95,dot(q,q)*2.1); o=vec4(pow(c,vec3(1./2.2)),1.); }`;
  let pThumb = null, thumbHDR = null, thumbLDR = null, thumbPx = null, thumbAt = 0, thumbDusk = -1;
  function drawThumbs(now) {
    const small = softwareRenderer || lastScale < .2, TW = small ? 144 : 336, TH = small ? 84 : 196;
    if (!pThumb) pThumb = G.program(THUMB_FS);
    if (!thumbHDR || thumbHDR.w !== TW) {
      if (thumbHDR) { G.freeTarget(thumbHDR); G.freeTarget(thumbLDR); }
      thumbHDR = G.target(TW, TH);
      thumbLDR = G.target(TW, TH, { internal: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE }); thumbPx = new Uint8Array(TW * TH * 4);
    }
    const z = S.vis + 60, tiles = document.querySelectorAll('.scene-tile canvas');
    gl.disable(gl.BLEND);
    BIOMES.forEach((b, i) => {
      const cam = camAt(z, 0, b);
      G.into(thumbHDR); G.bindTex(0, tNoise); G.bindTex(1, tSpec);
      G.use(pScene, Object.assign({ uN: 0, uS: 1, uRes: [TW, TH], uT: now / 1000, uFocal: 1.08, uBeat: 6, uSeed: S.seed, uCam: [cam.cx, cam.cy, z], uRight: cam.right, uUp: cam.up, uFwd: cam.fwd, uSpark: 0 }, landAt(b, b, 1, S.dusk)));
      G.draw();
      G.into(thumbLDR); G.bindTex(0, thumbHDR.tex);
      G.use(pThumb, { uScene: 0, uExposure: 0.98 + S.dusk * 0.25 });
      G.draw();
      gl.readPixels(0, 0, TW, TH, gl.RGBA, gl.UNSIGNED_BYTE, thumbPx);
      tiles[i].width = TW; tiles[i].height = TH;
      const c = tiles[i].getContext('2d'), img = c.createImageData(TW, TH);
      for (let y = 0; y < TH; y++) img.data.set(thumbPx.subarray((TH - 1 - y) * TW * 4, (TH - y) * TW * 4), y * TW * 4);     // GL rows run bottom up
      c.putImageData(img, 0, 0);
    });
    thumbAt = now; thumbDusk = S.dusk;
  }

  /* ---- frame ---- */
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
    Post.resize(rw, rh, 5);
  }

  let last = performance.now(), slow = 0, fast = 0, stalled = 0, fails = 0;
  function render(now) {
    requestAnimationFrame(render);
    try {
      const frameMs = now - last, dtMs = Math.min(100, frameMs);
      last = now;
      ride.tick(now);
      pageFrame(now);
      if (!G || gl.isContextLost()) return;

      acc += dtMs / 1000;
      let n = 0;
      while (acc >= H && n < 24) { step(); acc -= H; n++; }
      if (n === 24) acc = 0;
      rpmAcc += dtMs;
      if (rpmAcc > 100) { rpmAcc = 0; ride.noteLane('rpm', +S.rpm.toFixed(1)); }
      if (S.biomeT < 1) { S.biomeT = Math.min(1, S.biomeT + dtMs / 6000); if (S.biomeT === 1) S.fromMix = null; }
      if (S.autoScene && !ride.replayOn && S.dist >= S.nextSceneAt) {
        S.nextSceneAt = S.dist + M_PER_MI;
        nextBiome();
        shell.toast(`New scenery · ${BIOMES[S.biomeNext].name}`);
      }
      if (frameIdx > 2 && (!thumbAt || (now - thumbAt > 4000 && Math.abs(S.dusk - thumbDusk) > 0.04 && !document.body.classList.contains('quiet')))) drawThumbs(now);
      S.dusk = S.duskHold != null ? S.dusk + (S.duskHold - S.dusk) * Math.min(1, dtMs / 900) : RM.matches ? S.dusk : 0.5 - 0.5 * Math.cos((now / 1000 / 240 + 0.14) * Math.PI * 2);

      // React to sustained stalls before waiting 90 expensive frames. This also
      // covers browsers that hide renderer metadata and genuinely weak GPUs.
      if (frameMs > 120) stalled++; else stalled = 0;
      if (frameMs > 26) slow++; else if (frameMs < 20) fast++;
      frameIdx++;
      if (stalled >= 2 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .5); resize();
        stalled = 0; slow = 0; fast = 0;
      } else if (frameIdx % 15 === 0 && slow > 10 && lastScale > minScale) {
        lastScale = Math.max(minScale, lastScale * .75); resize();
        slow = 0; fast = 0;
      } else if (frameIdx % 90 === 0) {
        if (fast > 80 && lastScale < maxScale) { lastScale = Math.min(maxScale, lastScale * 1.2); resize(); }
        slow = 0; fast = 0;
      }

      /* uniforms */
      const land = landAt(S.fromMix || BIOMES[S.biome], BIOMES[S.biomeNext], S.biomeT, S.dusk);
      const z = S.vis;
      const curveRoll = RM.matches ? 0 : clamp((pathX(z + 12) - 2 * pathX(z + 6) + pathX(z)) * 0.012, -0.07, 0.07);
      S.roll += (curveRoll - S.roll) * Math.min(1, dtMs / 200);
      const cam = camAt(z, S.roll), right = cam.right, up = cam.up, fwd = cam.fwd;
      const camX = cam.cx, camY = cam.cy + (RM.matches ? 0 : Math.sin(S.vis * 0.9) * 0.018 * motion01(S.rpm));
      const focal = 1.08;

      for (let i = 0; i < BANDS; i++) {
        // A far range that drifts past as you ride: stated value noise, not a measurement.
        const x = i * 0.23 + S.vis * 0.0012 + S.seed;
        const n = 0.5 * Math.sin(x * 1.7) + 0.3 * Math.sin(x * 3.1 + 1.3) + 0.2 * Math.sin(x * 6.3 + 2.1);
        ridge[i] = 0.16 + 0.12 * n + 0.08 * motion01(S.rpm);
        specBytes[i] = Math.round(Math.max(0, Math.min(1, ridge[i])) * 255);
      }
      G.bindTex(1, tSpec);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BANDS, 1, gl.RED, gl.UNSIGNED_BYTE, specBytes);

      const beatLen = Math.max(6, (S.rpm > 5 ? 60 / S.rpm : 0.6) * Math.max(10, S.speed));   // one dash per revolution

      /* scene */
      gl.disable(gl.BLEND);
      G.into(scene);
      G.bindTex(0, tNoise); G.bindTex(1, tSpec);
      G.use(pScene, Object.assign({
        uN: 0, uS: 1, uRes: [rw, rh], uT: now / 1000, uFocal: focal, uBeat: beatLen, uSeed: S.seed,
        uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd,
        uSpark: 0.12 * motion01(S.rpm),
      }, land));
      G.draw();

      /* motes */
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      G.use(pMote, { uCam: [camX, camY, z], uRight: right, uUp: up, uFwd: fwd, uFocal: focal, uAsp: rw / rh, uZ: z, uPx: rh * 0.09, uSeed: S.seed, uSpeedN: motion01(S.rpm), uSpark: .12 * land.uMisty, uShimmer: .1 * land.uMisty, uEdge: land.uEdge, uRouteA: land.uRouteA, uRouteB: land.uRouteB, uRouteC: land.uRouteC, uRouteD: land.uRouteD, uRouteE: land.uRouteE });
      if(S.look !== 'clear' || land.uMisty > .001) gl.drawArrays(gl.POINTS, 0, Math.round(650 + 850 * land.uMisty));
      gl.disable(gl.BLEND);

      /* feedback */
      const asp = rw / rh;
      const vpP = [pathX(z + 90) - camX, roadY(z + 90) + 1 - camY, 90];
      const cz = vpP[0] * fwd[0] + vpP[1] * fwd[1] + vpP[2] * fwd[2];
      const vp = [0.5 + ((vpP[0] * right[0] + vpP[1] * right[1] + vpP[2] * right[2]) * focal) / cz / asp / 2, 0.5 + ((vpP[0] * up[0] + vpP[1] * up[1] + vpP[2] * up[2]) * focal) / cz / 2];
      const fpsScale = dtMs / 16.67;
      const zoomNow = RM.matches ? S.zoom * 0.4 : 1 - Math.pow(1 - (S.zoom + 0.0012), fpsScale);
      G.into(dreamB);
      G.bindTex(0, scene.tex); G.bindTex(1, dreamA.tex);
      G.use(pDream, { uScene: 0, uPrev: 1, uVP: vp, uZoom: zoomNow, uDream: RM.matches ? S.dream * 0.5 : S.dream, uWild: S.wild, uT: now / 1000 });
      G.draw();
      const tmp = dreamA; dreamA = dreamB; dreamB = tmp;

      /* bloom and grade */
      const bloom = Post.bloom(dreamA.tex, 1.15);
      Post.finish(dreamA.tex, bloom, {
        uBloomK: 0.25, uExposure: 0.98 + S.dusk * 0.25,
        uFlash: 0, uFlashC: [1, 0.93, 0.82], uGrain: 0.022, uT: now / 1000, uVig: 0.25, uSat: 1.02, rate: RM.matches ? 0.16 : 0.36, maxGain: 1,
      }, dtMs / 1000);

      if (lumaRec) lumaRec(now);
      if (wantSnap) { const done = wantSnap; wantSnap = null; cv.toBlob((blob) => done(blob), 'image/png'); }

      /* readouts */
      if (frameIdx % 6 === 0) {
        $('g-speed').textContent = ((S.speed * 3600) / M_PER_MI).toFixed(1);
        $('g-dist').textContent = (S.dist / M_PER_MI).toFixed(2);
        const heroVal = S.rpm > 0.5 ? Math.round(S.rpm) : '--';
        $('g-hero').textContent = heroVal;
        if ($('route-sheet').open) { drawElStrip(); drawCurve(); }
      }
    } catch (e) {
      if (fails++ < 3) console.error(e);
    }
  }

  /* ---- boot ---- */
  if (!G) {
    shell.glFail('This page draws with WebGL2, which this browser did not provide. The cadence readings below still work.');
    const idle = (now) => { requestAnimationFrame(idle); ride.tick(now); pageFrame(now); };
    requestAnimationFrame(idle);
  } else {
    gl = G.gl;
    try {
      Post = createPost(G);
      pScene = G.program(SCENE_FS);
      pDream = G.program(DREAM_FS);
      pMote = G.program(MOTE_FS, MOTE_VS);
      tNoise = G.noiseTexture(20261102);
      tSpec = G.tex(BANDS, 1, { internal: gl.R8, format: gl.RED, type: gl.UNSIGNED_BYTE });
      resize();
      addEventListener('resize', resize);
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); shell.glFail('The graphics context was lost. Reload the page to get the picture back.'); });
      requestAnimationFrame(render);
    } catch (e) {
      console.error(e);
      shell.glFail(`The picture could not start on this graphics card: ${String(e.message).slice(0, 140)}`);
    }
  }

  // For the flicker check: record the picture's brightness on a small grid, on every frame, straight after it is drawn.
  let lumaRec = null;
  function recordLuma(ms) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true }), frames = [], t0 = performance.now();
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';        // a true area average, not a few sampled pixels
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
    S, ride, BIOMES, pathX, roadY, gradeAt, motion01, step, sceneNow, recordLuma, setBiome, nextBiome, setTod, setLook, setAuto, drawThumbs,
    get renderInfo() { return { softwareRenderer, width: rw, height: rh, pixelBudget: sceneBudget * lastScale }; },
    pixel() {
      const c = document.createElement('canvas'); c.width = 32; c.height = 18;
      const g = c.getContext('2d');
      return new Promise((res) => { wantSnap = (blob) => { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, 32, 18); const d = g.getImageData(0, 0, 32, 18).data; let sum = 0, min = 1e9, max = 0; const grid = []; for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722; sum += l; min = Math.min(min, l); max = Math.max(max, l); grid.push(l); } res({ mean: sum / (d.length / 4), min, max, grid }); }; im.src = URL.createObjectURL(blob); }; });
    },
  };
})();
