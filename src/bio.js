/* bio.js: the sensors, the features and the inference, with no pictures in it.
   Real sensors, the demo and a session replay all end in the same readings. The page labels the source separately.
   The index comes from Autonomic Telemetry's own engine, multivariate-1, unchanged (src/vendor/autonomic). */
(function (global) {
  'use strict';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const HUME = { service: '0000fff0-0000-1000-8000-00805f9b34fb', write: '0000fff6-0000-1000-8000-00805f9b34fb', notify: '0000fff7-0000-1000-8000-00805f9b34fb', renewMs: 20000 };
  const FRESH_MS = 5000, QUIET_MS = 8000, CRANK_STOP_MS = 2500, RR_WINDOW_MS = 32000, PEDALING_RPM = 15, INHALE_SHARE = 0.4;

  /* ---- pure functions, so known answers can test them ---- */
  const BioMath = {
    // Heart Rate Measurement, 0x2A37. Beat intervals arrive in 1/1024 s.
    parseHeartRate(dv) {
      const flags = dv.getUint8(0);
      const wide = flags & 0x01;
      let off = 1;
      const bpm = wide ? dv.getUint16(off, true) : dv.getUint8(off);
      off += wide ? 2 : 1;
      const contact = flags & 0x04 ? !!(flags & 0x02) : null;
      if (flags & 0x08) off += 2;
      const rr = [];
      if (flags & 0x10) for (; off + 1 < dv.byteLength; off += 2) rr.push((dv.getUint16(off, true) * 1000) / 1024);
      return { bpm, rr, contact };
    },
    // CSC Measurement, 0x2A5B: optional wheel data, then optional crank data.
    parseCSC(dv) {
      const flags = dv.getUint8(0);
      let off = 1;
      if (flags & 0x01) off += 6;
      if (!(flags & 0x02)) return null;
      return { crankRev: dv.getUint16(off, true), crankT: dv.getUint16(off + 2, true) };
    },
    crankRpm(prev, cur) {
      let dRev = cur.crankRev - prev.crankRev; if (dRev < 0) dRev += 65536;
      let dT = cur.crankT - prev.crankT; if (dT < 0) dT += 65536;
      if (dT === 0) return null;
      const rpm = (dRev / (dT / 1024)) * 60;
      return rpm < 250 ? rpm : null;
    },
    // Indoor Bike Data, 0x2AD2. Instantaneous cadence is in 0.5 rpm units.
    parseFTMS(dv) {
      const flags = dv.getUint16(0, true);
      let off = 2;
      if (!(flags & 0x0001)) off += 2;
      if (flags & 0x0002) off += 2;
      if (!(flags & 0x0004)) return null;
      const rpm = dv.getUint16(off, true) * 0.5;
      return rpm < 250 ? rpm : null;
    },
    // Hume Band: the same two commands as Autonomic's bridge/hume.py. Rate only, with no beat intervals.
    humeCommand(start) {
      const p = new Uint8Array(16);
      p[0] = 0x28; p[1] = 0x02; p[2] = start ? 1 : 0;
      p[15] = p.slice(0, 15).reduce((s, x) => s + x, 0) & 0xff;
      return p;
    },
    decodeHume(dv) {
      const d = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
      if (!d.length || d[0] !== 0x28) return null;
      if (d.length === 2 && d[1] === 0xff) throw new Error('The band refused the live heart measurement.');
      if (d.length !== 16 || (d.slice(0, 15).reduce((s, x) => s + x, 0) & 0xff) !== d[15]) throw new Error('The band sent a damaged reading.');
      if (d[1] === 0xff) throw new Error('The band refused the live heart measurement.');
      return d[1] === 2 && d[2] !== 0 ? d[2] : null;
    },
    // RMSSD and SDNN over a window of intervals. Bad beats are dropped, never repaired.
    intervalFeatures(rr) {
      if (rr.length < 20) return { valid: false, reason: `Needs 20 beat intervals, has ${rr.length}.` };
      const m = median(rr);
      const ok = rr.map((v) => v >= 1000 / 3 && v <= 1500 && Math.abs(v - m) <= 0.25 * m);
      const kept = rr.filter((_, i) => ok[i]);
      if (kept.length < 20 || kept.length < 0.9 * rr.length) return { valid: false, reason: 'Too many beat intervals were out of range in this window.' };
      let sum = 0, n = 0;
      for (let i = 1; i < rr.length; i++) if (ok[i] && ok[i - 1]) { sum += (rr[i] - rr[i - 1]) ** 2; n++; }
      const rmssd = Math.sqrt(sum / Math.max(1, n)), avg = mean(kept);
      if (rmssd > 250) return { valid: false, reason: 'RMSSD above 250 ms is treated as artifact.' };
      const sdnn = Math.sqrt(kept.reduce((s, v) => s + (v - avg) ** 2, 0) / (kept.length - 1));
      return { valid: true, rmssd, sdnn, n: kept.length };
    },
    // How far heart rate swings at the pacer's own frequency, peak to trough, over the last two breaths.
    swingAtPace(samples, perMin, tNowSec) {
      const f = perMin / 60, span = 2 / f, from = tNowSec - span;
      const s = samples.filter((p) => p.t >= from - 1 && p.t <= tNowSec);
      if (s.length < 8 || s[0].t > from + 0.25 / f) return null;
      for (let i = 1; i < s.length; i++) if (s[i].t - s[i - 1].t > 6) return null;
      const n = Math.round(span * 4), y = new Float64Array(n);
      let j = 0;
      for (let i = 0; i < n; i++) {
        const t = from + (i + 0.5) / 4;
        while (j < s.length - 2 && s[j + 1].t < t) j++;
        const a = s[j], b = s[Math.min(j + 1, s.length - 1)];
        y[i] = b.t > a.t ? a.hr + ((b.hr - a.hr) * clamp((t - a.t) / (b.t - a.t), 0, 1)) : a.hr;
      }
      // Fit a level, a straight-line drift and a sine at the pacer's frequency together, then read the sine's size.
      const A = [0, 1, 2, 3].map(() => [0, 0, 0, 0, 0]);
      for (let i = 0; i < n; i++) {
        const w = (2 * Math.PI * f * (i + 0.5)) / 4, x = [1, (i - (n - 1) / 2) / n, Math.cos(w), Math.sin(w)];
        for (let r = 0; r < 4; r++) { for (let c = 0; c < 4; c++) A[r][c] += x[r] * x[c]; A[r][4] += x[r] * y[i]; }
      }
      for (let c = 0; c < 4; c++) {
        let piv = c;
        for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        [A[c], A[piv]] = [A[piv], A[c]];
        if (Math.abs(A[c][c]) < 1e-9) return null;
        for (let r = 0; r < 4; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j < 5; j++) A[r][j] -= k * A[c][j]; }
      }
      return 2 * Math.hypot(A[2][4] / A[2][2], A[3][4] / A[3][3]);
    },
    breathAt(tSec, perMin) {
      const f = ((tSec * perMin) / 60) % 1;
      const inhale = f < INHALE_SHARE;
      const g = inhale ? f / INHALE_SHARE : (f - INHALE_SHARE) / (1 - INHALE_SHARE);
      return { f, inhale, ee: inhale ? (1 - Math.cos(Math.PI * g)) / 2 : (1 + Math.cos(Math.PI * g)) / 2 };
    },
    clarity(swing, fullAt) { return swing == null ? null : clamp(swing / fullAt, 0, 1); },
    gradeLoad(hr, base, fullOver) { return hr == null || base == null ? 0 : clamp((hr - base) / fullOver, 0, 1); },
    encodeHeart(bpm, rrMs) {
      const b = new DataView(new ArrayBuffer(2 + rrMs.length * 2));
      b.setUint8(0, rrMs.length ? 0x16 : 0x06); b.setUint8(1, Math.round(bpm));          // contact reported and present
      rrMs.forEach((v, i) => b.setUint16(2 + i * 2, Math.round((v * 1024) / 1000), true));
      return b;
    },
    encodeCSC(crankRev, crankT) {
      const b = new DataView(new ArrayBuffer(5));
      b.setUint8(0, 0x02); b.setUint16(1, crankRev & 0xffff, true); b.setUint16(3, crankT & 0xffff, true);
      return b;
    },
  };

  /* ---- Bluetooth refusals, in words a visitor can act on ---- */
  function readBtError(e) {
    const m = (e && e.message) || '';
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || /permission|blocked|denied|disabled/i.test(m))) return ['denied', 'The browser refused Bluetooth for this page. Allow it in the site settings, then try again.'];
    if (e && e.name === 'NotFoundError') {
      if (/adapter|not available|powered/i.test(m)) return ['no-device', 'Bluetooth is off, or this computer has none. Turn it on in the system settings.'];
      return ['no-device', 'No sensor was chosen. Wake it, free it from any other app, then try again.'];
    }
    if (e && e.name === 'NetworkError') return ['failed', 'The sensor dropped the connection. Try again.'];
    return ['failed', m ? `Could not connect: ${m}` : 'Could not connect.'];
  }

  function createBio() {
    const listeners = {};
    const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return bio; };
    const emit = (ev, data) => { (listeners[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

    const hr = { state: 'idle', detail: '', kind: '', label: '', bpm: null, beats: false, noContact: false, warming: false, lastAt: 0, count: 0, quietMs: 0, connected: false };
    const cadence = { state: 'idle', detail: '', kind: '', label: '', rpm: null, lastAt: 0, lastMoveAt: 0, count: 0, quietMs: 0, connected: false };
    const now_ = { hr: null, rmssd: null, sdnn: null, idx: null, phase: 'waiting', label: '', reason: '', coverage: '', limited: false, progress: 0, seconds: 0, trend: 'steady', reference: null, baseHr: null, baseFrom: '', swing: null, components: [], events: [], weights: null, multiplier: 1, raw: null, base: null, history: [], beatsNote: '' };

    let hrDevice = null, cadDevice = null, humeTimer = null, humeChar = null, demo = null, replay = null, session = null;
    let beatLog = [], hrSeries = [], lastHrWall = 0, lastRrWall = 0, rrSeen = false, rrWarm = false, lastPrevCrank = null, lastFeed = 0, lastSnap = 0, lastLow = 0, lowHr = null, recent10 = [];
    let features = { valid: false, reason: 'No beat intervals yet.' };
    const hist = new Float32Array(64);                       // heart rate in 2 s bins, newest first, for the horizon
    let histAcc = 0, beatPhase = 0, lastTick = performance.now();

    const synthetic = () => !!demo;
    const makeEngine = (syn) => global.TelemetryMultivariate.create(syn ? { synthetic: true, now: () => (demo && demo.clock != null ? demo.clock : Date.now()) } : {});
    let liveEngine = makeEngine(false), engine = liveEngine;

    const bio = {
      on, hr, cadence, now: now_, hist, BioMath,
      mode: 'watch',
      pace: { rate: 6, on: true, t0: performance.now() },
      fullSwing: 10, fullOver: 60,
      setMode(m) { if (m === 'train' && demo) demo.trainT0 = performance.now(); bio.mode = m; },
      get demoOn() { return !!demo; },
      get replayOn() { return !!replay; },
      get recording() { return !!session; },
      get syntheticReplay() { return !!(replay && replay.s.synthetic); },
      get supported() { return !!navigator.bluetooth; },
      get pedaling() { return (cadence.rpm || 0) > PEDALING_RPM; },
      get beatPhase() { return beatPhase; },
      get features() { return features; },
      breath() {
        if (!bio.pace.on) return { f: 0, inhale: false, ee: 0.35, paused: true };
        return BioMath.breathAt((performance.now() - bio.pace.t0) / 1000, bio.pace.rate);
      },
      setPace(r) {
        // Keep the breath where it is when the rate changes, so the guide does not jump.
        const t = (performance.now() - bio.pace.t0) / 1000, phase = (t * bio.pace.rate) / 60;
        bio.pace.rate = r; bio.pace.t0 = performance.now() - ((phase * 60) / r) * 1000;
      },
      togglePace() {
        bio.pace.on = !bio.pace.on;
        if (bio.pace.on) bio.pace.t0 = performance.now();
        return bio.pace.on;
      },
      resetReference() { engine.resetReference('Reference cleared. A new one starts now.'); lowHr = null; recent10 = []; emit('state'); },
    };

    // The desktop app's window has the API but no device list, and refuses every request, so say so before any click.
    const appWindow = /QtWebEngine/.test(navigator.userAgent);
    const initialBt = () => (appWindow ? 'unsupported' : !window.isSecureContext ? 'insecure' : navigator.bluetooth ? 'idle' : 'unsupported');
    hr.state = initialBt(); cadence.state = initialBt();
    if (appWindow) hr.detail = cadence.detail = 'This app window cannot show the Bluetooth list. Open the page in Chrome or Edge to connect a sensor. The demo works here.';
    const setHr = (state, detail) => { const ch = hr.state !== state || hr.detail !== (detail || ''); hr.state = state; hr.detail = detail || ''; if (ch) emit('state'); };
    const setCad = (state, detail) => { const ch = cadence.state !== state || cadence.detail !== (detail || ''); cadence.state = state; cadence.detail = detail || ''; if (ch) emit('state'); };

    /* ---- readings: every source lands here ---- */
    function takeHeart(p) {
      const t = performance.now(), wall = Date.now();
      hr.noContact = p.contact === false || p.bpm === 0;
      if (hr.noContact) return;
      hr.bpm = p.bpm; hr.count++; lastHrWall = wall;
      if (p.rr.length) {
        rrSeen = true; hr.beats = true; lastRrWall = wall;
        let at = t;
        const stamps = new Array(p.rr.length);
        for (let i = p.rr.length - 1; i >= 0; i--) { stamps[i] = at; at -= p.rr[i]; }
        p.rr.forEach((ms, i) => { beatLog.push({ t: stamps[i], rr: ms }); if (ms > 250 && ms < 2000) hrSeries.push({ t: stamps[i] / 1000, hr: 60000 / ms }); });
      } else if (!rrSeen) hrSeries.push({ t: t / 1000, hr: p.bpm });
      emit('heart');
    }
    function deviceHeart(p) {
      hr.noContact = p.contact === false || p.bpm === 0;
      if (hr.noContact) return;
      hr.lastAt = performance.now(); hr.deviceBpm = p.bpm; hr.warming = false; hr.reportsBeats = hr.reportsBeats || p.rr.length > 0;
      if (hr.connected && hr.state !== 'live') setHr('live');
      if (!demo && !replay) takeHeart(p);
    }
    function takeCadence(rpm, moved) {
      if (moved) cadence.lastMoveAt = performance.now();
      if (rpm != null) cadence.rpm = rpm;
      cadence.count++;
    }
    function deviceCadence() {
      cadence.lastAt = performance.now();
      if (cadence.connected && cadence.state !== 'live') setCad('live');
    }

    /* ---- connecting ---- */
    function btRefused(set) { set(window.isSecureContext ? 'unsupported' : 'insecure'); }
    function dropHr() { clearInterval(humeTimer); humeTimer = null; humeChar = null; hr.connected = false; hr.bpm = null; hr.deviceBpm = null; hr.beats = false; hr.reportsBeats = false; hr.noContact = false; rrSeen = false; rrWarm = false; beatLog = []; features = { valid: false, reason: 'No beat intervals yet.' }; }
    bio.connectHeart = async (kind) => {
      if (!navigator.bluetooth) { btRefused(setHr); return; }
      setHr('choosing');
      try {
        const opts = kind === 'hume'
          ? { filters: ['Hume', '2301B', '2301b', 'X3B', 'x3b'].map((namePrefix) => ({ namePrefix })), optionalServices: [HUME.service] }
          : { filters: [{ services: ['heart_rate'] }] };
        const device = await navigator.bluetooth.requestDevice(opts);
        if (hrDevice && hrDevice.gatt && hrDevice.gatt.connected) { hrDevice.gatt.disconnect(); }
        dropHr();
        hrDevice = device; hr.kind = kind; hr.label = device.name || 'Heart-rate sensor';
        setHr('connecting');
        device.addEventListener('gattserverdisconnected', () => { if (hrDevice !== device) return; dropHr(); setHr('lost'); });
        const gatt = await device.gatt.connect();
        if (kind === 'hume') {
          const svc = await gatt.getPrimaryService(HUME.service);
          const write = await svc.getCharacteristic(HUME.write), notify = await svc.getCharacteristic(HUME.notify);
          notify.addEventListener('characteristicvaluechanged', (e) => {
            try { const v = BioMath.decodeHume(e.target.value); if (v != null) deviceHeart({ bpm: v, rr: [], contact: null }); } catch (err) { setHr('failed', err.message); }
          });
          await notify.startNotifications();
          hr.connected = true; hr.warming = true; humeChar = write;
          await write.writeValue(BioMath.humeCommand(true));
          humeTimer = setInterval(() => { write.writeValue(BioMath.humeCommand(true)).catch(() => {}); }, HUME.renewMs);
        } else {
          const svc = await gatt.getPrimaryService('heart_rate');
          const ch = await svc.getCharacteristic('heart_rate_measurement');
          ch.addEventListener('characteristicvaluechanged', (e) => deviceHeart(BioMath.parseHeartRate(e.target.value)));
          await ch.startNotifications();
          hr.connected = true;
        }
        hr.connectedAt = performance.now();
        setHr('no-signal');
      } catch (e) { const [s, d] = readBtError(e); dropHr(); setHr(s, d); }
    };
    bio.disconnectHeart = async () => {
      const d = hrDevice; hrDevice = null;
      if (humeChar) { try { await humeChar.writeValue(BioMath.humeCommand(false)); } catch (e) { /* the band may already be gone */ } }
      dropHr();
      if (d && d.gatt && d.gatt.connected) d.gatt.disconnect();
      setHr('idle');
    };
    bio.connectCadence = async () => {
      if (!navigator.bluetooth) { btRefused(setCad); return; }
      setCad('choosing');
      try {
        const device = await navigator.bluetooth.requestDevice({ filters: [{ services: ['cycling_speed_and_cadence'] }, { services: ['fitness_machine'] }], optionalServices: ['cycling_speed_and_cadence', 'fitness_machine'] });
        if (cadDevice && cadDevice.gatt && cadDevice.gatt.connected) cadDevice.gatt.disconnect();
        cadDevice = device; cadence.label = device.name || 'Cadence sensor'; lastPrevCrank = null; cadence.rpm = null;
        setCad('connecting');
        device.addEventListener('gattserverdisconnected', () => { if (cadDevice !== device) return; cadence.connected = false; cadence.rpm = null; setCad('lost'); });
        const gatt = await device.gatt.connect();
        let ch, kind;
        try { const svc = await gatt.getPrimaryService('cycling_speed_and_cadence'); ch = await svc.getCharacteristic('csc_measurement'); kind = 'csc'; } catch (e) { const svc = await gatt.getPrimaryService('fitness_machine'); ch = await svc.getCharacteristic('indoor_bike_data'); kind = 'ftms'; }
        cadence.kind = kind;
        ch.addEventListener('characteristicvaluechanged', (e) => {
          deviceCadence();
          if (demo || replay) return;
          if (kind === 'csc') takeCrank(BioMath.parseCSC(e.target.value)); else takeTrainer(BioMath.parseFTMS(e.target.value));
        });
        await ch.startNotifications();
        cadence.connected = true; cadence.connectedAt = performance.now();
        setCad('no-signal');
      } catch (e) { const [s, d] = readBtError(e); cadence.connected = false; setCad(s, d); }
    };
    bio.disconnectCadence = () => {
      const d = cadDevice; cadDevice = null; cadence.connected = false; cadence.rpm = null;
      if (d && d.gatt && d.gatt.connected) d.gatt.disconnect();
      setCad('idle');
    };
    function takeCrank(c) {
      if (!c) { if (cadence.connected) setCad('no-signal', 'This sensor reports wheel speed only, with no crank data.'); return; }
      if (lastPrevCrank) {
        const moved = c.crankT !== lastPrevCrank.crankT;
        const rpm = moved ? BioMath.crankRpm(lastPrevCrank, c) : null;
        takeCadence(rpm, moved);
      } else takeCadence(null, false);
      lastPrevCrank = c;
    }
    function takeTrainer(rpm) { takeCadence(rpm, rpm != null && rpm > 0); }

    /* ---- features and the model ---- */
    function readFeatures(t) {
      beatLog = beatLog.filter((b) => t - b.t <= RR_WINDOW_MS);
      features = BioMath.intervalFeatures(beatLog.map((b) => b.rr));
      if (features.valid) rrWarm = true;
    }
    function sourceName() { return demo ? 'Synthetic demo' : `${hr.label} (${hr.kind === 'hume' ? 'Hume protocol' : 'Bluetooth heart rate'})`; }
    function feedEngine() {
      const wall = demo ? demo.clock || Date.now() : Date.now();
      const fresh = wall - lastHrWall <= FRESH_MS && hr.bpm != null;
      const moving = bio.pedaling;
      const frame = {
        type: 'features', source: demo ? 'synthetic' : 'device-reported', received_at: wall,
        heart_rate_bpm: fresh ? hr.bpm : null, pulse_rmssd_ms: features.valid ? features.rmssd : null, pulse_sdnn_ms: features.valid ? features.sdnn : null, motion: moving ? 0.5 : null,
        quality: {
          heart_rate_bpm: { valid: fresh, received_at: lastHrWall, source: sourceName(), reason: fresh ? '' : 'No fresh heart rate.' },
          pulse_rmssd_ms: { valid: features.valid, received_at: lastRrWall, source: `${sourceName()} beat intervals`, reason: features.reason || '' },
          pulse_sdnn_ms: { valid: features.valid, received_at: lastRrWall, source: `${sourceName()} beat intervals`, reason: features.reason || '' },
          ...(moving ? { motion: { valid: true, received_at: wall, source: 'Cadence' } } : {}),
        },
      };
      // A strap that reports beat intervals needs one full window first, or the reference would restart when they arrive.
      if (rrSeen && !rrWarm) return;
      engine.ingest(frame);
    }
    function readSnapshot() {
      const s = engine.snapshot();
      const R = s.reference;
      now_.phase = s.phase; now_.idx = s.value; now_.label = s.label; now_.coverage = s.coverage; now_.limited = s.limited;
      now_.progress = R.progress; now_.seconds = R.seconds; now_.trend = s.trend.direction; now_.reference = R.ready ? R.stats : null;
      now_.components = s.components.filter((x) => x.included); now_.events = s.events; now_.weights = s.weights; now_.multiplier = s.modifierMultiplier; now_.raw = s.rawScore; now_.base = s.baseScore; now_.history = s.history;
      now_.reason = s.reason;
    }

    /* ---- the demo: real packets through the real parsers, from a stated script ---- */
    function preroll() {
      // A rest period, run ahead of time through the same engine, so the demo has a reference from its first second.
      const end = Date.now(), noise = (s) => (Math.random() - 0.5) * 2 * s;
      for (let i = 0; i < 126; i++) {
        const at = end - (126 - i) * 1000; demo.clock = at;
        const q = (v) => ({ valid: true, received_at: at, source: v, reason: 'Invented demonstration feature; no wearable measurement.' });
        engine.ingest({ type: 'features', source: 'synthetic', received_at: at, heart_rate_bpm: 66 + noise(1.5), pulse_rmssd_ms: 45 + noise(2.5), pulse_sdnn_ms: 34 + noise(2.5), motion: null, quality: { heart_rate_bpm: q('Synthetic demo'), pulse_rmssd_ms: q('Synthetic demo beat intervals'), pulse_sdnn_ms: q('Synthetic demo beat intervals') } });
      }
      demo.clock = null;
    }
    function demoArc(t) { const a = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 72); return Math.pow(a, 1.3); }
    function demoHeart(t, D) {
      if (bio.mode === 'train') {
        const T = (performance.now() - (D.trainT0 || D.t0)) / 1000;
        const gain = 1 + Math.max(0, 6.5 - bio.pace.rate) * 0.25;
        const sw = (3 + Math.min(1, T / 40) * 11) * gain;
        const ph = (((performance.now() - bio.pace.t0) / 1000) * bio.pace.rate) / 60;
        return { hr: 63 + 0.5 * sw * Math.sin(2 * Math.PI * (ph - 0.15)), rmssd: 26 };
      }
      if (bio.mode === 'ride') {
        const target = 66 + Math.max(0, (cadence.rpm || 0) - 15) * 0.82;
        D.rideHr += (target - D.rideHr) * (1 - Math.exp(-0.06 / 18));
        return { hr: D.rideHr, rmssd: 13 };
      }
      const a = demoArc(t);
      return { hr: 66 + 9 * a + 0.8 * Math.sin(t / 3.7), rmssd: 45 - 21 * a };
    }
    function demoStep(t) {
      const D = demo, sec = (t - D.t0) / 1000;
      while (D.nextBeat <= sec) {
        const h = demoHeart(D.nextBeat, D), sd = h.rmssd / Math.SQRT2;
        const rr = 60000 / h.hr + (Math.random() + Math.random() + Math.random() - 1.5) * 1.414 * sd;
        D.pending.push(rr); D.bpm = h.hr; D.nextBeat += rr / 1000;
      }
      if (sec - D.lastPkt >= 1) {
        D.lastPkt = sec;
        takeHeart(BioMath.parseHeartRate(BioMath.encodeHeart(D.bpm, D.pending)));
        D.pending = [];
      }
      if (bio.mode === 'ride' && sec - D.lastCrank >= 1) {
        const w = sec % 40, rpm = w < 12 ? 62 : w < 24 ? 92 : w < 30 ? 108 : 48, dt = sec - D.lastCrank;
        D.lastCrank = sec;
        D.revs += (rpm / 60) * dt;
        D.crankClock += dt * 1024;
        takeCrank(BioMath.parseCSC(BioMath.encodeCSC(Math.floor(D.revs), Math.floor(D.crankClock))));
      } else if (bio.mode !== 'ride') {
        cadence.rpm = null; lastPrevCrank = null;
      }
    }
    bio.startDemo = () => {
      if (replay) bio.stopReplay();
      const t = performance.now();
      demo = { t0: t, nextBeat: 0, pending: [], lastPkt: -1, lastCrank: 0, revs: 0, crankClock: 0, bpm: 66, rideHr: 68, clock: null, trainT0: bio.mode === 'train' ? t : null };
      beatLog = []; hrSeries = []; rrSeen = true; rrWarm = true; lowHr = null; recent10 = []; cadence.rpm = null; lastPrevCrank = null; hr.bpm = 66; hr.beats = true;
      engine = makeEngine(true);
      preroll();
      // The same synthetic rest fills the beat window and the horizon, so the demo reads from its first second.
      for (let at = t - RR_WINDOW_MS; at < t;) { const rr = 60000 / 66 + (Math.random() + Math.random() + Math.random() - 1.5) * 45; beatLog.push({ t: at, rr }); hrSeries.push({ t: at / 1000, hr: 60000 / rr }); at += rr; }
      hist.forEach((_, i) => { hist[i] = 66 + 1.2 * Math.sin(i * 0.7) + 0.6 * Math.sin(i * 1.9); });
      lastHrWall = Date.now(); lastRrWall = lastHrWall; readFeatures(t);
      emit('state'); emit('demo', true);
    };
    bio.stopDemo = () => {
      if (!demo) return;
      demo = null; engine = liveEngine;
      hr.bpm = hr.state === 'live' ? hr.deviceBpm : null; hr.beats = hr.reportsBeats; rrSeen = hr.reportsBeats; cadence.rpm = null; lastPrevCrank = null; beatLog = []; hrSeries = []; hist.fill(0); features = { valid: false, reason: 'No beat intervals yet.' }; rrWarm = false; lowHr = null; recent10 = []; lastHrWall = 0;
      Object.assign(now_, { hr: null, rmssd: null, sdnn: null, idx: null, swing: null, baseHr: null, baseFrom: '' });
      emit('state'); emit('demo', false);
    };

    /* ---- recording and replay ---- */
    bio.startRecording = (appName) => { session = { t0: performance.now(), app: appName, created: new Date().toISOString(), lanes: {}, synthetic: !!demo }; emit('state'); };
    bio.noteLane = (name, value) => { if (session) (session.lanes[name] = session.lanes[name] || []).push([Math.round(performance.now() - session.t0), value]); };
    bio.stopRecording = () => {
      if (!session) return null;
      const s = session; session = null;
      emit('state');
      return { schema: 'body-signal-labs/biofeedback-session@1', app: s.app, created: s.created, durationMs: Math.round(performance.now() - s.t0), synthetic: s.synthetic, note: 'Readings once a second and cadence ten times a second. Inferred values are inferred, not measured. Not a medical record.', lanes: s.lanes };
    };
    bio.readSession = (raw) => {
      if (raw && /\/biofeedback-session@1$/.test(raw.schema || '')) return raw;
      // A ride saved by the old page. Its body signals were always the synthetic script.
      if (raw && raw.timeline && Array.isArray(raw.timeline.rpm) && raw.timeline.rpm.length) {
        const dt = (raw.timeline.dt || 0.1) * 1000, au = raw.autoTimeline || {}, ad = (au.dt || 1) * 1000, m = raw.meta || {};
        const lane = (a, f) => (Array.isArray(a) ? a.map((v, i) => [Math.round(i * ad), f ? f(v) : v]) : []);
        const lanes = { rpm: raw.timeline.rpm.map((v, i) => [Math.round(i * dt), v]), idx: lane(au.idx), hr: lane(au.HR), clarity: lane(au.clarity), dawn: lane(au.dawn), mode: [[0, raw.mode === 'train' || raw.mode === 'ride' ? raw.mode : 'watch']], biome: [[0, ((m.promptIdx || 0) % 5 + 5) % 5]], seed: [[0, m.route && typeof m.route.seed === 'number' ? m.route.seed % 40 : 0]] };
        return { schema: 'body-signal-labs/biofeedback-session@1', app: 'biofeedback-path-cockpit', created: raw.createdAt, durationMs: raw.timeline.rpm.length * dt, synthetic: true, note: 'Converted from a ride saved by the older page.', lanes };
      }
      throw new Error('This is not a session file from this page.');
    };
    bio.startReplay = (raw) => {
      const s = bio.readSession(raw);
      if (demo) bio.stopDemo();
      replay = { s, t0: performance.now(), lanes: Object.entries(s.lanes || {}).map(([k, v]) => ({ k, v, i: 0 })) };
      hist.fill(0); hrSeries = [];
      emit('state'); emit('replay', true);
    };
    bio.stopReplay = () => {
      if (!replay) return;
      replay = null;
      Object.assign(now_, { hr: null, rmssd: null, idx: null, swing: null, phase: 'waiting' });
      cadence.rpm = cadence.connected ? cadence.rpm : null; hist.fill(0);
      emit('state'); emit('replay', false);
    };
    function stepReplay(t) {
      const R = replay, at = t - R.t0;
      R.lanes.forEach((l) => {
        while (l.i < l.v.length && l.v[l.i][0] <= at) {
          const value = l.v[l.i++][1];
          if (l.k === 'hr') { now_.hr = value; if (value) hrSeries.push({ t: t / 1000, hr: value }); } else if (l.k === 'rmssd') now_.rmssd = value;
          else if (l.k === 'sdnn') now_.sdnn = value;
          else if (l.k === 'idx') { now_.idx = value; now_.phase = value == null ? 'held' : 'ready'; now_.label = value == null ? '' : value >= 68 ? 'Elevated model response' : value >= 46 ? 'Raised model response' : value >= 25 ? 'Mild model response' : 'Low model response'; now_.reason = 'Replaying what the model computed when this was recorded.'; now_.coverage = 'From a recording'; } else if (l.k === 'swing') now_.swing = value;
          emit('lane', { name: l.k, value });
        }
      });
      if (at >= R.s.durationMs) bio.stopReplay();
    }

    /* ---- once a frame ---- */
    bio.tick = (t) => {
      const dt = Math.min(0.1, (t - lastTick) / 1000); lastTick = t;
      if (demo) demoStep(t);
      if (replay) stepReplay(t);

      // heart-rate source states
      if (hr.connected) {
        hr.quietMs = t - Math.max(hr.lastAt, hr.connectedAt || 0);
        if (hr.state === 'live' && t - hr.lastAt > FRESH_MS) { hr.bpm = null; hr.deviceBpm = null; setHr('no-signal'); }
      }
      if (cadence.connected) {
        cadence.quietMs = t - Math.max(cadence.lastAt, cadence.connectedAt || 0);
        if (cadence.state === 'live' && t - cadence.lastAt > QUIET_MS) { cadence.rpm = null; setCad('no-signal'); }
      }
      // A crank that stops sends the same event time again, so a stop has to be read from the silence.
      if (!replay && lastPrevCrank && cadence.rpm && t - cadence.lastMoveAt > CRANK_STOP_MS) cadence.rpm = 0;

      hrSeries = hrSeries.filter((p) => t / 1000 - p.t <= 130);
      if (!replay && t - lastFeed >= 1000) {
        lastFeed = t;
        readFeatures(t);
        if (demo || hr.connected) feedEngine();
      }
      if (!replay && t - lastSnap >= 500) {
        lastSnap = t;
        readSnapshot();
        const fresh = (demo || hr.state === 'live') && hr.bpm != null;
        now_.hr = fresh ? hr.bpm : null;
        now_.rmssd = fresh && features.valid ? features.rmssd : null;
        now_.sdnn = fresh && features.valid ? features.sdnn : null;
        if (fresh && t - lastLow >= 1000) {
          lastLow = t;
          recent10.push(hr.bpm); if (recent10.length > 10) recent10.shift();
          if (recent10.length === 10) { const m = mean(recent10); lowHr = lowHr == null ? m : Math.min(lowHr, m); }
        }
        const refHr = now_.reference && now_.reference.heart_rate_bpm ? now_.reference.heart_rate_bpm.mean : null;
        now_.baseHr = refHr != null ? refHr : lowHr;
        now_.baseFrom = refHr != null ? 'your reference' : lowHr != null ? 'your lowest 10 seconds' : '';
        now_.swing = hrSeries.length ? BioMath.swingAtPace(hrSeries, bio.pace.rate, t / 1000) : null;
      }
      // the rate-paced rings on the road, and the horizon's history
      const rate = now_.hr || 0;
      if (rate > 0) { beatPhase += (dt * rate) / 60; if (beatPhase >= 1) { beatPhase -= 1; emit('beat'); } }
      histAcc += dt;
      if (histAcc >= 2) { histAcc = 0; hist.copyWithin(1, 0, hist.length - 1); hist[0] = now_.hr || 0; }
    };
    bio.series = () => hrSeries;
    bio.beats = () => beatLog;
    return bio;
  }

  global.BioMath = BioMath;
  global.createBio = createBio;
})(window);
