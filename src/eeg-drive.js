/* Optional Muse EEG game control. The Mac bridge computes beta/alpha from
   actual EEG; this controller calibrates a personal game mapping, not a
   mental-state measurement. No HR, optical, or cadence input is consumed.
   Loading this file performs no network activity. */
(function (global) {
  'use strict';
  const FRESH_MS = 5000, REFERENCE_SAMPLES = 20, SAMPLE_SPACING_MS = 950;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const median = values => {
    const a = [...values].sort((x, y) => x - y), i = a.length >> 1;
    return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
  };
  const text = (value, fallback) => typeof value === 'string' && value.trim() ? value.slice(0, 350) : fallback;

  function createEEGDrive(options = {}) {
    const config = options.config === undefined ? global.__BODY_EEG_RELAY__ : options.config;
    // Only a root-relative private path is accepted: never an arbitrary URL,
    // protocol-relative address, query, fragment, or redirect to another host.
    const available = !!(config && /^\/[A-Za-z0-9_-]{1,128}\/$/.test(config.base) &&
      typeof config.session === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(config.session) &&
      (config.simulated === undefined || typeof config.simulated === 'boolean'));
    const settings = available ? {base: config.base, session: config.session, simulated: config.simulated === true} : null;
    const now = options.now || (() => Date.now());
    const fetcher = options.fetch || (global.fetch && global.fetch.bind(global));
    const Events = options.EventSource || global.EventSource;
    const initialMessage = available ? 'Connect Muse, then keep your eyes open for a personal EEG reference.' :
      'Open the cockpit from the optional Mac EEG bridge to connect Muse.';
    const real = {available, phase: 'disconnected', message: initialMessage, transport: false,
      devices: [], deviceName: '', simulated: !!settings?.simulated, ratio: null,
      quality: {valid: false, reason: initialMessage}, baseline: null, progress: 0, score: null};
    const state = {...real, drive: 0}; // Stable public object; consumers read, not replace it.
    let active = false, stream = null, timer = null, generation = 0, action = 0;
    let offsetUpper = null, syncAt = null, lastSync = null, syncing = false, sequence = -1, lastContact = null;
    let sourceKey = null, samples = [], lastSampleStamp = null, lastFeatureStamp = null, featureAt = null;
    let demoOn = false, demoTime = 0, output = 0;
    const reads = new Set();

    function publish() {
      if (!demoOn) Object.assign(state, real, {drive: output});
      else Object.assign(state, real, {phase: 'ready', message: 'Demo EEG · synthetic brainwave ride; no headset measurement.',
        simulated: true, ratio: Math.exp((0.5 - state.score) * 0.9),
        quality: {valid: true, reason: 'Synthetic EEG demonstration.', source_kind: 'synthetic'},
        baseline: null, progress: 1, score: state.score, drive: output});
    }
    function invalidate(reason, phase = 'waiting') {
      real.phase = phase; real.message = reason; real.ratio = null; real.score = null;
      real.quality = {...real.quality, valid: false, reason}; featureAt = null;
      publish();
    }
    function resetReference(reason) {
      samples = []; lastSampleStamp = null; real.baseline = null; real.progress = 0; real.score = null;
      if (reason) { real.message = reason; real.phase = 'calibrating'; }
    }
    function resetInput(reason) {
      resetReference(); sourceKey = null; lastFeatureStamp = null;
      invalidate(reason, 'disconnected');
    }
    function stopTransport() {
      active = false; generation++; action++;
      if (stream) { stream.onmessage = stream.onerror = null; stream.close(); stream = null; }
      if (timer !== null) global.clearInterval(timer);
      timer = null; reads.forEach(controller => controller.abort()); reads.clear();
      real.transport = false; offsetUpper = syncAt = lastSync = lastContact = null; syncing = false; sequence = -1;
    }
    function failSession() {
      stopTransport(); resetInput('The Mac bridge session changed. Open its new cockpit link.');
      real.phase = 'error'; publish();
    }
    async function request(path, init = {}, isRead = false) {
      const controller = typeof global.AbortController === 'function' ? new global.AbortController() : null;
      if (isRead && controller) reads.add(controller);
      const timeout = controller ? global.setTimeout(() => controller.abort(), 10000) : null;
      try {
        const response = await fetcher(settings.base + path, {cache: 'no-store', credentials: 'same-origin',
          redirect: 'error', ...init, ...(controller ? {signal: controller.signal} : {})});
        if (!response.ok) throw Error('The Mac EEG bridge could not complete that request.');
        return response;
      } finally {
        if (timeout !== null) global.clearTimeout(timeout);
        if (controller) reads.delete(controller);
      }
    }
    function devices(payload) {
      if (!payload || typeof payload !== 'object') return;
      if (Array.isArray(payload.devices)) real.devices = payload.devices.filter(d => d && d.kind === 'muse' &&
        typeof d.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(d.id)).slice(0, 50)
        .map(d => ({id: d.id, name: text(d.name, 'Muse')}));
      if (payload.error) invalidate(text(payload.error, 'Bluetooth scan failed.'), 'error');
      else if (payload.scanning && !real.quality.valid) { real.phase = 'waiting'; real.message = 'Looking for nearby Muse headbands…'; }
      publish();
    }
    function status(payload) {
      if (!payload || payload.device !== 'muse') return;
      if (typeof payload.deviceName === 'string' && payload.deviceName !== real.deviceName) {
        if (real.deviceName) resetInput('Muse changed. A new eyes-open EEG reference is needed.');
        real.deviceName = text(payload.deviceName, 'Muse');
      }
      const phase = payload.phase || payload.state;
      if (phase === 'disconnected' || phase === 'idle') resetInput(text(payload.message, 'Muse disconnected.'));
      else if (phase === 'error') { resetInput(text(payload.message, 'Muse could not connect.')); real.phase = 'error'; }
      else if (phase === 'stale') invalidate(text(payload.message, 'Waiting for fresh Muse EEG.'), 'stale');
      else if (['connecting', 'waiting', 'streaming'].includes(phase) && !real.quality.valid) {
        real.phase = 'waiting'; real.message = text(payload.message, 'Waiting for eligible Muse EEG.');
      }
      publish();
    }
    function snapshot(payload) {
      if (!payload || payload.session !== settings.session || payload.simulated !== settings.simulated) { failSession(); return false; }
      for (const device of Object.values(payload.devices || {})) status(device);
      devices(payload.discovery);
      return true;
    }
    async function synchronize(g) {
      if (syncing) return false;
      syncing = true; const begin = now(); lastSync = begin;
      try {
        const response = await request('api/state', {}, true), payload = await response.json();
        if (!active || generation !== g) return false;
        if (!Number.isFinite(payload.server_now) || !snapshot(payload)) {
          if (active) failSession(); return false;
        }
        // Request START overestimates age by outbound transit; response arrival
        // would make delayed data look fresher. Mac/browser clock skew cancels.
        offsetUpper = payload.server_now - begin; syncAt = now();
        return true;
      } finally { if (generation === g) syncing = false; }
    }
    function age(stamp) { return Number.isFinite(stamp) && offsetUpper !== null ? now() + offsetUpper - stamp : Infinity; }
    function fresh(stamp) { const value = age(stamp); return value >= -100 && value <= FRESH_MS; }
    function clockReady() { return syncAt !== null && now() >= syncAt && now() - syncAt <= 60000; }

    function features(payload) {
      if (!payload || payload.type !== 'features') return;
      const q = payload.quality?.eeg_beta_alpha;
      const reason = text(q?.reason, 'Waiting for eligible EEG from at least two channels.');
      if (!clockReady() || !fresh(payload.received_at) || !q || !fresh(q.received_at) || q.received_at > payload.received_at + 100) {
        invalidate('EEG is stale or its timestamp cannot be verified. ' + reason, 'stale'); return;
      }
      const channels = q.channels, kind = settings.simulated ? 'synthetic' : 'device-reported';
      const source = typeof q.source === 'string' ? /^muse:(classic|athena):eeg:([0-3](?:,[0-3]){1,3})$/.exec(q.source) : null;
      const validChannels = Array.isArray(channels) && channels.length >= 2 && channels.length <= 4 &&
        channels.every(c => Number.isInteger(c) && c >= 0 && c <= 3) && new Set(channels).size === channels.length;
      const sorted = validChannels ? [...channels].sort().join(',') : '';
      if (q.valid !== true) { invalidate(reason); return; }
      if (payload.source !== kind || q.source_kind !== kind) {
        invalidate('EEG source labeling does not match this bridge session.', 'error'); return;
      }
      if (!validChannels || !source || [...source[2].split(',')].sort().join(',') !== sorted ||
          q.sample_rate_hz !== 256 || q.window_seconds !== 4 || !Number.isFinite(payload.eeg_beta_alpha) ||
          payload.eeg_beta_alpha < 0 || payload.eeg_beta_alpha > 50) {
        invalidate('The EEG channel metadata or ratio is not eligible. ' + reason); return;
      }
      const key = source[1] + ':' + sorted + ':' + kind;
      let changed = false;
      if (sourceKey !== null && key !== sourceKey) {
        resetReference('EEG channels or protocol changed. Keep your eyes open for a new reference.');
        lastFeatureStamp = null; changed = true;
      }
      // New event envelopes cannot rejuvenate an old supporting EEG window.
      if (lastFeatureStamp !== null && q.received_at <= lastFeatureStamp) return;
      sourceKey = key; lastFeatureStamp = q.received_at;
      featureAt = now() - Math.max(0, age(q.received_at));
      real.ratio = payload.eeg_beta_alpha;
      real.quality = {...q, channels: [...channels], received_at: featureAt, origin_received_at: q.received_at};
      // A small positive floor makes a valid zero-beta window finite. The
      // logarithm and fixed robust scale are declared game-design choices.
      const value = Math.log(Math.max(0.000001, real.ratio));
      if (!real.baseline && !demoOn && (lastSampleStamp === null || q.received_at - lastSampleStamp >= SAMPLE_SPACING_MS)) {
        samples.push(value); lastSampleStamp = q.received_at;
        real.progress = Math.min(1, samples.length / REFERENCE_SAMPLES);
        if (samples.length >= REFERENCE_SAMPLES) {
          const center = median(samples), spread = Math.max(0.15, 1.4826 * median(samples.map(v => Math.abs(v - center))));
          real.baseline = {center, spread, ratio: Math.exp(center), samples: samples.length, source: key};
        }
      }
      if (real.baseline) {
        real.score = clamp(0.5 + (real.baseline.center - value) / (6 * real.baseline.spread), 0, 1);
        real.phase = 'ready'; real.message = settings.simulated ? 'Synthetic bridge EEG · experimental game mapping.' :
          'Live EEG · experimental game mapping relative to your eyes-open reference.';
      } else {
        real.score = null; real.phase = 'calibrating';
        real.message = changed ? 'EEG channels or protocol changed. A new eyes-open reference has started.' :
          `Keep your eyes open and sit still · ${samples.length} of ${REFERENCE_SAMPLES} eligible EEG samples.`;
      }
      publish();
    }
    async function control(command, id) {
      if (!active || !settings) return false;
      const g = generation, a = ++action;
      try {
        await request('api/control', {method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({action: command, ...(command === 'scan' ? {} : {device: 'muse'}), ...(id ? {id} : {})})});
        return active && generation === g && action === a;
      } catch (error) {
        if (active && generation === g && action === a) invalidate(text(error.message, 'The Mac EEG bridge could not be reached.'), 'error');
        return false;
      }
    }
    function expire() {
      if (!active) return;
      if (lastContact !== null && now() - lastContact > 4500) {
        real.transport = false;
        if (real.phase !== 'error') invalidate('The Mac EEG connection paused. Waiting for fresh data.', 'stale');
      } else if (real.quality.valid && (featureAt === null || now() < featureAt - 100 || now() - featureAt > FRESH_MS || !clockReady())) {
        invalidate('EEG is stale. Waiting for a fresh eligible window.', 'stale');
      }
    }
    function maintain() {
      expire();
      if (active && !syncing && (lastSync === null || now() - lastSync >= 30000)) {
        const g = generation;
        synchronize(g).catch(() => { if (active && generation === g) invalidate('The Mac EEG bridge could not be reached.', 'stale'); });
      }
    }
    async function start() {
      if (!available) { invalidate(initialMessage, 'disconnected'); return false; }
      if (!fetcher || !Events) { invalidate('This browser cannot open the local EEG event stream.', 'error'); return false; }
      if (active) return stream ? scan() : false;
      stopTransport(); active = true; const g = generation;
      invalidate('Connecting to the Mac EEG bridge…');
      try {
        if (!await synchronize(g) || !active || generation !== g) return false;
        lastContact = now();
        stream = new Events(settings.base + 'api/events');
        stream.onmessage = event => {
          if (!active || generation !== g) return;
          let message; try { message = JSON.parse(event.data); } catch (_) { return; }
          if (!message || typeof message !== 'object') return;
          if (message.session !== settings.session) { if (message.kind === 'hello') failSession(); return; }
          if (!clockReady() || !fresh(message.server_sent_at)) return;
          if (message.kind === 'hello') {
            if (!snapshot(message.payload)) return;
            if (Number.isSafeInteger(message.sequence)) sequence = Math.max(sequence, message.sequence);
          } else if (message.kind !== 'heartbeat') {
            if (!Number.isSafeInteger(message.sequence) || message.sequence <= sequence) return;
            sequence = message.sequence;
          }
          lastContact = now(); real.transport = true;
          if (message.kind === 'features') features(message.payload);
          else if (message.kind === 'status') status(message.payload);
          else if (message.kind === 'devices') devices(message.payload);
          publish();
        };
        stream.onerror = () => {
          if (!active || generation !== g) return;
          real.transport = false; invalidate('The Mac EEG connection paused. Waiting to reconnect.', 'stale');
        };
        timer = global.setInterval(maintain, 1000);
        return await scan();
      } catch (error) {
        if (active && generation === g) { stopTransport(); invalidate(text(error.message, 'Could not connect to the Mac EEG bridge.'), 'error'); }
        return false;
      }
    }
    async function scan() { return control('scan'); }
    async function pair(id) {
      const device = real.devices.find(d => d.id === id);
      if (!active || !device) return false;
      resetInput('Connecting Muse. A new eyes-open EEG reference will start when its signal is eligible.');
      real.deviceName = device.name; real.phase = 'waiting'; publish();
      return control('connect', id);
    }
    async function disconnect() {
      const wasActive = active;
      // Issue the explicit device stop before closing the local stream. Control
      // requests have their own timeout and remain deliverable during cleanup.
      const pending = wasActive ? request('api/control', {method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'disconnect', device: 'muse'})}).then(() => true, () => false) : Promise.resolve(true);
      stopTransport(); resetInput('Muse disconnected.'); real.deviceName = ''; publish();
      const g = generation, stopped = await pending;
      if (!stopped && !active && generation === g) {
        real.message = 'Cockpit disconnected. Could not confirm the Muse stop; disconnect it in the Mac bridge.';
        real.quality = {...real.quality, reason: real.message}; publish();
      }
      return stopped;
    }
    function calibrate() {
      if (demoOn || !active) return false;
      resetReference('Keep your eyes open and sit still for 20 eligible EEG samples.');
      lastSampleStamp = lastFeatureStamp; // Reusing the current frame cannot advance the new reference.
      publish(); return true;
    }
    function tick(dt, demo = false) {
      const seconds = Number.isFinite(dt) ? clamp(dt, 0, 5) : 0;
      if (!!demo !== demoOn) { demoOn = !!demo; demoTime = 0; }
      expire();
      let target = real.quality.valid && real.baseline && real.phase === 'ready' ? real.score : 0;
      if (demoOn) {
        demoTime += seconds;
        state.score = target = clamp(0.58 + 0.22 * Math.sin(demoTime / 8) + 0.07 * Math.sin(demoTime / 2.7), 0, 1);
      }
      const tau = target > output ? 2 : 1.5;
      output += (target - output) * (1 - Math.exp(-seconds / tau));
      if (target === 0 && output < 0.0001) output = 0;
      publish(); return output;
    }
    return {state, start, scan, pair, disconnect, calibrate, tick};
  }
  global.createEEGDrive = createEEGDrive;
})(typeof window === 'undefined' ? globalThis : window);
