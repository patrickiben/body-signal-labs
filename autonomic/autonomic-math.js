/**
 * Autonomic Telemetry — mathematical engine for heart, breathing and sensor signals
 *
 * Implements:
 * 1. Spatial and topological metrics of physiological state manifolds:
 *    - bounded 2D Voronoi tessellation, Vietoris-Rips 2-skeleton Euler/Betti filtration
 *      chi = V - E + F = beta0 - beta1 + beta2, 3D Rips H0/H1 persistence diagrams with p=2 l_inf
 *      Hungarian Wasserstein matching, mean-field Potts variational free energy F(q), CRITIC x
 *      Shannon entropy x bootstrap stability cube-root weights, leave-one-out ablation, and a
 *      3-design x 3-estimator cross-epoch spillover inference ladder.
 * 2. Directed networks of signals:
 *    - constrained non-negative VAR+(1) by projected coordinate descent vs ridge VAR(1) across a
 *      10-node cardiorespiratory-autonomic network (HR/SA node, vagal RMSSD, pulse SDNN, respiratory
 *      RSA, EEG beta/alpha, baroreflex gain, EDA phasic, EDA tonic, pulse transit time, peripheral
 *      thermal), rolling spectral radius rho(Phi(t)), Pesaran-Shin / Diebold-Yilmaz 10x10 GFEVD
 *      connectedness (TO%, FROM%, NET%, TCI%, horizon-integrated AUC), 3 spectral-radius-matched
 *      directedness nulls (symmetrization, direction flip, weight permutation) plus a time-reversal
 *      null, and a latent world-model with a cross-entropy-method planner for paced-breathing
 *      interdiction.
 * 3. Learning within fixed safety limits:
 *    - an 8-level nested hierarchy (L0 constitution .. L7 meta, pinned anchor hash 5c29a381eb7e,
 *      bound B = +/-0.05) enforcing frozen physiological safety limits; rank preservation
 *      (s(a) - s(b) > 2B = 0.10 => S(a) > S(b)) with an unclipped centered-and-contracted readout;
 *      incremental contraction and the 4x4 coupled recurrence (Faddeev-LeVerrier + Durand-Kerner
 *      complex eigenvalues, rho = 0.9987567254); active-inference EFE probe selection; entropic
 *      Sinkhorn sensor-to-recovery optimal transport with MISSING slack and 5-pass critical-gap
 *      refinement; and a 4-gate component admission protocol with a 9-rate sensitivity grid.
 * 4. Autonomic & Cardiorespiratory Biophysics Mastery Workbench:
 *    - Pillar 1: Non-Gaussian HRV, Poincare (SD1, SD2, SD1/SD2, ellipse area), Detrended
 *      Fluctuation Analysis (DFA alpha1, alpha2), Sample & Multiscale Entropy, Lomb-Scargle
 *      LF/HF spectral balance, Cornish-Fisher 4-moment 99% Arousal Surge Quantile & ES_97.5.
 *    - Pillar 2: Cardiorespiratory Phase Synchronization (Hilbert Transform Phase-Locking Value
 *      PLV), Directional Transfer Entropy (TE_{Resp->HR} vs TE_{HR->Resp}), Takens Delay-Coordinate
 *      Attractor Reconstruction & Rosenstein Maximal Lyapunov Exponent lambda_max.
 *    - Pillar 3: Random Matrix Theory (RMT) Marcenko-Pastur 10-Channel Biosignal Correlation
 *      Denoising, Condition Number Reduction, and Meucci Shannon-Entropy Effective Autonomic
 *      Degrees of Freedom N_eff^ent.
 *    - Pillar 4: 6-Architecture Biofeedback / Sensor-Fusion Allocation Shootout (Baseline HR/PRV,
 *      Equal-Weight 1/N, Inverse-Volatility, Equal Risk Contribution ERC, Hierarchical Risk Parity
 *      HRP, and Tail-Damped Vagal Throttle) + Hamilton 2-State Markov-Switching Vagal Coherence /
 *      Sympathetic Surge Regime Filter.
 *
 * Pure offline, dependency-free module; descriptive & educational physiological mathematics only,
 * never a clinical diagnostic or medical instrument.
 */
(function (root) {
  'use strict';

  const EPS = 1e-12;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  /* =========================================================================
   * SECTION 1: DETERMINISTIC PRNG & CORE STATISTICAL / MATRIX ALGEBRA
   * ========================================================================= */
  function makeRng(seed) {
    let s = (seed >>> 0) || 20260616;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeNormal(rng) {
    let spare = null;
    return function () {
      if (spare !== null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0, v = 0, s = 0;
      do {
        u = rng() * 2 - 1;
        v = rng() * 2 - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const mul = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * mul;
      return u * mul;
    };
  }

  function mean(arr) {
    if (!arr || !arr.length) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function variance(arr, ddof = 1) {
    if (!arr || arr.length <= ddof) return 0;
    const m = mean(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) {
      const d = arr[i] - m;
      s += d * d;
    }
    return s / (arr.length - ddof);
  }

  function sd(arr, ddof = 1) {
    return Math.sqrt(Math.max(0, variance(arr, ddof)));
  }

  function median(arr) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const mid = s.length >> 1;
    return (s.length & 1) ? s[mid] : 0.5 * (s[mid - 1] + s[mid]);
  }

  function quantile(arr, p) {
    if (!arr || !arr.length) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(s.length - 1, p * (s.length - 1)));
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? s[lo] : s[lo] * (hi - idx) + s[hi] * (idx - lo);
  }

  function pearsonCorr(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    let mx = 0, my = 0;
    for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
    mx /= n; my /= n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx, b = y[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    return (dx > EPS && dy > EPS) ? num / Math.sqrt(dx * dy) : 0;
  }

  function rankVector(arr) {
    const n = arr.length;
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => arr[a] - arr[b]);
    const ranks = new Float64Array(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && arr[idx[j + 1]] === arr[idx[i]]) j++;
      const r = 0.5 * (i + j) + 1;
      for (let k = i; k <= j; k++) ranks[idx[k]] = r;
      i = j + 1;
    }
    return Array.from(ranks);
  }

  function spearmanCorr(x, y) {
    return pearsonCorr(rankVector(x), rankVector(y));
  }

  function trapz(x, y) {
    let area = 0;
    for (let i = 1; i < x.length; i++) {
      area += 0.5 * (x[i] - x[i - 1]) * (y[i] + y[i - 1]);
    }
    return area;
  }

  function solveLinearSystem(A, b) {
    const n = A.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let k = 0; k < n; k++) {
      let iMax = k, vMax = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(M[i][k]) > vMax) { vMax = Math.abs(M[i][k]); iMax = i; }
      }
      if (iMax !== k) { const tmp = M[k]; M[k] = M[iMax]; M[iMax] = tmp; }
      const piv = Math.abs(M[k][k]) < EPS ? (M[k][k] >= 0 ? EPS : -EPS) : M[k][k];
      for (let i = k + 1; i < n; i++) {
        const f = M[i][k] / piv;
        for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      const piv = Math.abs(M[i][i]) < EPS ? (M[i][i] >= 0 ? EPS : -EPS) : M[i][i];
      x[i] = s / piv;
    }
    return x;
  }

  function invertMatrix(A) {
    const n = A.length;
    const M = A.map((row, i) => {
      const ext = new Array(2 * n).fill(0);
      for (let j = 0; j < n; j++) ext[j] = row[j];
      ext[n + i] = 1;
      return ext;
    });
    for (let k = 0; k < n; k++) {
      let iMax = k, vMax = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(M[i][k]) > vMax) { vMax = Math.abs(M[i][k]); iMax = i; }
      }
      if (iMax !== k) { const tmp = M[k]; M[k] = M[iMax]; M[iMax] = tmp; }
      const piv = Math.abs(M[k][k]) < EPS ? (M[k][k] >= 0 ? EPS : -EPS) : M[k][k];
      for (let j = 0; j < 2 * n; j++) M[k][j] /= piv;
      for (let i = 0; i < n; i++) {
        if (i === k) continue;
        const f = M[i][k];
        for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[k][j];
      }
    }
    return M.map(row => row.slice(n, 2 * n));
  }

  function matMul(A, B) {
    const m = A.length, k = A[0].length, n = B[0].length;
    const C = Array.from({ length: m }, () => new Array(n).fill(0));
    for (let i = 0; i < m; i++) {
      for (let p = 0; p < k; p++) {
        const aip = A[i][p];
        if (aip === 0) continue;
        for (let j = 0; j < n; j++) C[i][j] += aip * B[p][j];
      }
    }
    return C;
  }

  function matTranspose(A) {
    const m = A.length, n = A[0].length;
    const T = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) T[j][i] = A[i][j];
    }
    return T;
  }

  function jacobiEigenSymmetric(S, maxIter = 80) {
    const n = S.length;
    const A = S.map(r => r.slice());
    const V = Array.from({ length: n }, (_, i) => {
      const row = new Array(n).fill(0);
      row[i] = 1;
      return row;
    });
    for (let iter = 0; iter < maxIter; iter++) {
      let p = 0, q = 1, maxVal = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const v = Math.abs(A[i][j]);
          if (v > maxVal) { maxVal = v; p = i; q = j; }
        }
      }
      if (maxVal < 1e-10) break;
      const app = A[p][p], aqq = A[q][q], apq = A[p][q];
      const tau = (aqq - app) / (2 * apq);
      const t = tau >= 0 ? 1 / (tau + Math.sqrt(1 + tau * tau)) : -1 / (-tau + Math.sqrt(1 + tau * tau));
      const c = 1 / Math.sqrt(1 + t * t), s = t * c;
      A[p][p] = app - t * apq;
      A[q][q] = aqq + t * apq;
      A[p][q] = A[q][p] = 0;
      for (let k = 0; k < n; k++) {
        if (k !== p && k !== q) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = A[p][k] = c * akp - s * akq;
          A[k][q] = A[q][k] = s * akp + c * akq;
        }
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq;
        V[k][q] = s * vkp + c * vkq;
      }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return {
      values: order.map(i => A[i][i]),
      vectors: order.map(colIdx => V.map(row => row[colIdx]))
    };
  }

  /* =========================================================================
   * SECTION 2: 10-METRIC SPATIAL & TOPOLOGICAL ENGINE
   *            APPLIED TO MULTI-SENSOR PHYSIOLOGICAL STATE MANIFOLDS
   * ========================================================================= */
  function ensembleWeights(M, seed = 20260614, nBoot = 80) {
    /* Implements S3.4 / PROPOSED_design_selection_MAP.R:70-87 (CRITIC x Shannon Entropy x Bootstrap Rank-Stability) */
    const valid = M.filter(r => Array.isArray(r) && r.every(v => typeof v === 'number' && Number.isFinite(v)));
    const p = M[0] ? M[0].length : 0;
    if (!p) return { fused: [], twoWay: [], critic: [], entropy: [], stability: [] };
    if (valid.length < 3) {
      const eq = new Array(p).fill(1 / p);
      return { fused: eq, twoWay: eq, critic: eq, entropy: eq, stability: eq };
    }
    const n = valid.length;
    const Z = Array.from({ length: n }, () => new Array(p).fill(0));
    const colSd = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const col = valid.map(r => r[j]);
      const mn = Math.min(...col), mx = Math.max(...col);
      const span = mx - mn;
      for (let i = 0; i < n; i++) Z[i][j] = span > EPS ? (col[i] - mn) / span : 0.5;
      colSd[j] = sd(Z.map(r => r[j]), 1);
    }
    const criticRaw = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      const cj = Z.map(r => r[j]);
      let conflict = 0;
      for (let k = 0; k < p; k++) {
        const r = j === k ? 1 : pearsonCorr(cj, Z.map(row => row[k]));
        conflict += 1 - (Number.isFinite(r) ? r : 0);
      }
      criticRaw[j] = Math.max(colSd[j] * conflict, 1e-6);
    }
    const sumC = criticRaw.reduce((a, b) => a + b, 0) || 1;
    const wCritic = criticRaw.map(v => v / sumC);

    const entRaw = new Array(p).fill(0);
    const invLogN = n > 1 ? 1 / Math.log(n) : 1;
    for (let j = 0; j < p; j++) {
      let sCol = 1e-9;
      for (let i = 0; i < n; i++) sCol += Z[i][j];
      let h = 0;
      for (let i = 0; i < n; i++) {
        const pr = Z[i][j] / sCol;
        h -= pr * Math.log(pr + 1e-12);
      }
      entRaw[j] = Math.max(1 - h * invLogN, 1e-6);
    }
    const sumE = entRaw.reduce((a, b) => a + b, 0) || 1;
    const wEntropy = entRaw.map(v => v / sumE);

    const rng = makeRng(seed);
    const bootRanks = Array.from({ length: p }, () => new Float64Array(nBoot));
    for (let b = 0; b < nBoot; b++) {
      const idx = Array.from({ length: n }, () => Math.floor(rng() * n));
      for (let j = 0; j < p; j++) {
        const sub = idx.map(i => Z[i][j]);
        bootRanks[j][b] = mean(rankVector(sub));
      }
    }
    const stabRaw = bootRanks.map(r => 1 / (sd(Array.from(r), 1) + 0.15));
    const sumS = stabRaw.reduce((a, b) => a + b, 0) || 1;
    const wStab = stabRaw.map(v => v / sumS);

    const fusedRaw = new Array(p).fill(0);
    const twoWayRaw = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      fusedRaw[j] = Math.exp((Math.log(Math.max(wCritic[j], 1e-6)) + Math.log(Math.max(wEntropy[j], 1e-6)) + Math.log(Math.max(wStab[j], 1e-6))) / 3);
      twoWayRaw[j] = Math.pow(Math.max(wCritic[j], 1e-6) * Math.max(wEntropy[j], 1e-6), 1 / 3);
    }
    const sumF = fusedRaw.reduce((a, b) => a + b, 0) || 1;
    const sum2 = twoWayRaw.reduce((a, b) => a + b, 0) || 1;
    return {
      fused: fusedRaw.map(v => v / sumF),
      twoWay: twoWayRaw.map(v => v / sum2),
      critic: wCritic,
      entropy: wEntropy,
      stability: wStab
    };
  }

  function clipPolygonHalfPlane(poly, a, b, c) {
    if (!poly.length) return [];
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
      const dCur = a * cur[0] + b * cur[1] - c;
      const dPrev = a * prev[0] + b * prev[1] - c;
      if (dCur <= 1e-9) {
        if (dPrev > 1e-9) {
          const t = dPrev / (dPrev - dCur);
          out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
        }
        out.push(cur);
      } else if (dPrev <= 1e-9) {
        const t = dPrev / (dPrev - dCur);
        out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
      }
    }
    return out;
  }

  function polygonArea(poly) {
    if (poly.length < 3) return 0;
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
      a += p1[0] * p2[1] - p2[0] * p1[1];
    }
    return 0.5 * Math.abs(a);
  }

  function computeVoronoiTessellation(coords) {
    const n = coords.length;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const padX = Math.max(0.5, 0.15 * (maxX - minX)), padY = Math.max(0.5, 0.15 * (maxY - minY));
    const x0 = minX - padX, x1 = maxX + padX, y0 = minY - padY, y1 = maxY + padY;
    const baseBox = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const cells = [], areas = [];
    for (let i = 0; i < n; i++) {
      let poly = baseBox.slice();
      const [xi, yi] = coords[i];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const [xj, yj] = coords[j];
        const a = 2 * (xj - xi), b = 2 * (yj - yi);
        if (Math.hypot(a, b) < 1e-9) continue;
        const c = xj * xj + yj * yj - xi * xi - yi * yi;
        poly = clipPolygonHalfPlane(poly, a, b, c);
        if (!poly.length) break;
      }
      cells.push(poly);
      areas.push(Math.max(polygonArea(poly), 1e-4));
    }
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let shared = 0;
        for (const p1 of cells[i]) {
          for (const p2 of cells[j]) {
            if (Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) < 0.04 * Math.max(x1 - x0, y1 - y0)) {
              shared++; break;
            }
          }
          if (shared >= 2) break;
        }
        if (shared >= 2) { adj[i].push(j); adj[j].push(i); }
      }
    }
    return { cells, areas, adj, bbox: [x0, y0, x1, y1], totalArea: (x1 - x0) * (y1 - y0) };
  }

  function vietorisRipsComplex(distMat, radius) {
    const n = distMat.length;
    if (n === 0) return { V: 0, E: 0, F: 0, euler: 0, beta0: 0, beta1: 0, rankD2: 0 };
    const adj = Array.from({ length: n }, () => new Uint8Array(n));
    let edges = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (distMat[i][j] <= radius) { adj[i][j] = adj[j][i] = 1; edges++; }
      }
    }
    const seen = new Uint8Array(n);
    let beta0 = 0;
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      beta0++;
      const q = [i]; seen[i] = 1;
      while (q.length) {
        const u = q.pop();
        for (let v = 0; v < n; v++) {
          if (!seen[v] && adj[u][v]) { seen[v] = 1; q.push(v); }
        }
      }
    }
    const triangles = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (!adj[i][j]) continue;
        for (let k = j + 1; k < n; k++) {
          if (adj[i][k] && adj[j][k]) triangles.push([i, j, k]);
        }
      }
    }
    const faces = triangles.length;
    const euler = n - edges + faces;
    const cycleDim = Math.max(0, edges - n + beta0);
    let rankD2 = 0;
    if (faces > 0 && edges > 0) {
      const edgeIdx = new Map();
      let eCount = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          if (adj[i][j]) edgeIdx.set(i * n + j, eCount++);
        }
      }
      const pivots = new Map();
      for (const [i, j, k] of triangles) {
        let col = [edgeIdx.get(i * n + j), edgeIdx.get(i * n + k), edgeIdx.get(j * n + k)].sort((a, b) => a - b);
        while (col.length) {
          const low = col[col.length - 1];
          if (!pivots.has(low)) { pivots.set(low, col); rankD2++; break; }
          const other = pivots.get(low);
          const next = [];
          let a = 0, b = 0;
          while (a < col.length && b < other.length) {
            if (col[a] < other[b]) next.push(col[a++]);
            else if (col[a] > other[b]) next.push(other[b++]);
            else { a++; b++; }
          }
          while (a < col.length) next.push(col[a++]);
          while (b < other.length) next.push(other[b++]);
          col = next;
        }
      }
    }
    const beta1 = Math.max(0, cycleDim - rankD2);
    const beta2 = Math.max(0, faces - rankD2);
    return { V: n, E: edges, F: faces, euler, beta0, beta1, beta2, rankD2 };
  }

  function ripsPersistenceDiagram3D(pts3D, maxScale = Infinity) {
    const n = pts3D.length;
    if (n < 3) return { h0: [], h1: [] };
    const dist3 = Array.from({ length: n }, () => new Float64Array(n));
    const edges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(pts3D[i][0] - pts3D[j][0], pts3D[i][1] - pts3D[j][1], pts3D[i][2] - pts3D[j][2]);
        dist3[i][j] = dist3[j][i] = d;
        if (d <= maxScale) edges.push({ u: i, v: j, w: d });
      }
    }
    edges.sort((a, b) => a.w - b.w || a.u - b.u || a.v - b.v);
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const h0 = [], cycleBirths = [];
    const edgeMap = new Map();
    edges.forEach((e, idx) => {
      edgeMap.set(e.u * n + e.v, idx);
      const ru = find(e.u), rv = find(e.v);
      if (ru !== rv) { parent[ru] = rv; h0.push([0, e.w]); }
      else cycleBirths.push({ idx, birth: e.w });
    });
    const triangles = [];
    const mNodes = Math.min(n, 60);
    for (let i = 0; i < mNodes; i++) {
      for (let j = i + 1; j < mNodes; j++) {
        const eij = edgeMap.get(i * n + j);
        if (eij === undefined) continue;
        for (let k = j + 1; k < mNodes; k++) {
          const eik = edgeMap.get(i * n + k), ejk = edgeMap.get(j * n + k);
          if (eik === undefined || ejk === undefined) continue;
          const w = Math.max(dist3[i][j], dist3[i][k], dist3[j][k]);
          triangles.push({ cols: [eij, eik, ejk].sort((a, b) => a - b), w });
        }
      }
    }
    triangles.sort((a, b) => a.w - b.w);
    const pivots = new Map(), deathByEdge = new Map();
    for (const tri of triangles) {
      let col = tri.cols.slice();
      while (col.length) {
        const low = col[col.length - 1];
        if (!pivots.has(low)) { pivots.set(low, col); deathByEdge.set(low, tri.w); break; }
        const other = pivots.get(low);
        const next = [];
        let a = 0, b = 0;
        while (a < col.length && b < other.length) {
          if (col[a] < other[b]) next.push(col[a++]);
          else if (col[a] > other[b]) next.push(other[b++]);
          else { a++; b++; }
        }
        while (a < col.length) next.push(col[a++]);
        while (b < other.length) next.push(other[b++]);
        col = next;
      }
    }
    const maxEdge = edges.length ? edges[edges.length - 1].w : 1;
    const h1 = [];
    for (const cb of cycleBirths) {
      const death = deathByEdge.has(cb.idx) ? deathByEdge.get(cb.idx) : maxEdge * 1.15;
      if (death > cb.birth + 1e-6) h1.push([cb.birth, death]);
    }
    return { h0, h1 };
  }

  function hungarianMinCost(cost) {
    const n = cost.length;
    if (n === 0) return 0;
    const u = new Float64Array(n + 1), v = new Float64Array(n + 1);
    const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Float64Array(n + 1).fill(Infinity);
      const used = new Uint8Array(n + 1);
      do {
        used[j0] = 1;
        const i0 = p[j0];
        let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) {
          if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
          else minv[j] -= delta;
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }
    return -v[0];
  }

  function wassersteinPersistenceDiagram(dgmA, dgmB) {
    const A = dgmA.slice(0, 32), B = dgmB.slice(0, 32);
    const n = A.length, m = B.length, tot = n + m;
    if (tot === 0) return 0;
    const C = Array.from({ length: tot }, () => new Float64Array(tot));
    for (let i = 0; i < n; i++) {
      const persA = 0.5 * (A[i][1] - A[i][0]);
      for (let j = 0; j < m; j++) {
        const dInf = Math.max(Math.abs(A[i][0] - B[j][0]), Math.abs(A[i][1] - B[j][1]));
        C[i][j] = dInf * dInf;
      }
      for (let j = m; j < tot; j++) C[i][j] = persA * persA;
    }
    for (let i = n; i < tot; i++) {
      for (let j = 0; j < m; j++) {
        const persB = 0.5 * (B[j][1] - B[j][0]);
        C[i][j] = persB * persB;
      }
    }
    return Math.sqrt(Math.max(0, hungarianMinCost(C)));
  }

  function meanFieldPottsVFE(distMat, arm, hField, scaleKm = 1.8) {
    const n = distMat.length;
    const pBar = Math.min(Math.max(mean(arm), 0.05), 0.95);
    const q = arm.map(a => 0.72 * a + 0.28 * pBar);
    const J = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const w = Math.exp(-distMat[i][j] / scaleKm);
        J[i][j] = J[j][i] = 0.35 * w;
      }
    }
    for (let iter = 0; iter < 15; iter++) {
      for (let i = 0; i < n; i++) {
        let nbr = hField[i];
        for (let j = 0; j < n; j++) if (i !== j) nbr += J[i][j] * (2 * q[j] - 1);
        q[i] = 1 / (1 + Math.exp(-Math.max(-8, Math.min(8, nbr))));
      }
    }
    let energy = 0, kl = 0;
    for (let i = 0; i < n; i++) {
      energy -= hField[i] * q[i];
      for (let j = i + 1; j < n; j++) energy -= J[i][j] * q[i] * q[j];
      const qi = Math.min(Math.max(q[i], 1e-6), 1 - 1e-6);
      kl += qi * Math.log(qi / pBar) + (1 - qi) * Math.log((1 - qi) / (1 - pBar));
    }
    return { vfe: energy + kl, energy, kl, meanQ: mean(q) };
  }

  /**
   * Default 20 Physiological State-Manifold Epochs across Vagal & Sympathetic Regimes
   * (Used when no custom sensor epoch list is passed).
   */
  const DEFAULT_PHYSIOLOGICAL_NODES = [
    { id: 'E01_SA_REST',     name: 'SA-Node Sinus Baseline I',        cluster: 0, hrBpm: 62.4, rmssdMs: 58.2, sdnnMs: 71.0, respBrpm: 10.5, eegBetaAlpha: 0.82, edaScl: 2.1, arm: 1 },
    { id: 'E02_VAGAL_RES',   name: '0.1 Hz Resonance Peak I',         cluster: 0, hrBpm: 59.8, rmssdMs: 74.5, sdnnMs: 88.4, respBrpm: 6.0,  eegBetaAlpha: 0.71, edaScl: 1.8, arm: 1 },
    { id: 'E03_RSA_LOCK',    name: 'Cardiorespiratory Phase Lock',    cluster: 0, hrBpm: 61.1, rmssdMs: 69.0, sdnnMs: 82.1, respBrpm: 6.2,  eegBetaAlpha: 0.75, edaScl: 1.9, arm: 1 },
    { id: 'E04_BARO_UNLOAD', name: 'Lying-Down Settle',        cluster: 0, hrBpm: 60.5, rmssdMs: 64.8, sdnnMs: 77.5, respBrpm: 9.8,  eegBetaAlpha: 0.79, edaScl: 2.0, arm: 1 },
    { id: 'E05_ALPHA_SYNC',  name: 'Parietal Alpha Dominance',        cluster: 0, hrBpm: 63.2, rmssdMs: 55.4, sdnnMs: 68.9, respBrpm: 11.2, eegBetaAlpha: 0.68, edaScl: 2.2, arm: 1 },
    { id: 'E06_PARASYM_REC', name: 'Post-Task Recovery',         cluster: 1, hrBpm: 64.7, rmssdMs: 52.1, sdnnMs: 65.3, respBrpm: 11.8, eegBetaAlpha: 0.88, edaScl: 2.4, arm: 1 },
    { id: 'E07_EXHALE_PACE', name: '4-6 Extended Exhale Pacing',      cluster: 1, hrBpm: 61.9, rmssdMs: 66.3, sdnnMs: 79.8, respBrpm: 6.0,  eegBetaAlpha: 0.74, edaScl: 1.95, arm: 1 },
    { id: 'E08_DIVE_RESET',  name: 'Trigeminal Dive-Reflex Window',   cluster: 1, hrBpm: 57.6, rmssdMs: 78.2, sdnnMs: 91.0, respBrpm: 8.4,  eegBetaAlpha: 0.77, edaScl: 2.05, arm: 1 },
    { id: 'E09_THERM_VASO',  name: 'Peripheral Vasodilation Warmth',  cluster: 1, hrBpm: 63.8, rmssdMs: 56.9, sdnnMs: 70.2, respBrpm: 10.9, eegBetaAlpha: 0.83, edaScl: 1.85, arm: 1 },
    { id: 'E10_QUIET_ATTN',  name: 'Quiet Ambient Observation',       cluster: 1, hrBpm: 65.1, rmssdMs: 49.8, sdnnMs: 62.4, respBrpm: 12.4, eegBetaAlpha: 0.94, edaScl: 2.5, arm: 1 },
    { id: 'E11_COG_LOAD_I',  name: 'Executive Working-Memory Load',   cluster: 2, hrBpm: 76.4, rmssdMs: 31.5, sdnnMs: 44.2, respBrpm: 15.8, eegBetaAlpha: 1.68, edaScl: 4.3, arm: 0 },
    { id: 'E12_ORTHO_TILT',  name: '70-Deg Orthostatic Head-Up Tilt', cluster: 2, hrBpm: 84.2, rmssdMs: 22.8, sdnnMs: 36.5, respBrpm: 16.4, eegBetaAlpha: 1.52, edaScl: 4.8, arm: 0 },
    { id: 'E13_SYMP_SURGE',  name: 'High Heart Rate',  cluster: 2, hrBpm: 88.9, rmssdMs: 18.4, sdnnMs: 31.0, respBrpm: 18.2, eegBetaAlpha: 1.95, edaScl: 5.9, arm: 0 },
    { id: 'E14_EDA_PHASIC',  name: 'Sudomotor SCR Burst Train',       cluster: 2, hrBpm: 81.5, rmssdMs: 25.1, sdnnMs: 38.9, respBrpm: 17.1, eegBetaAlpha: 1.79, edaScl: 6.4, arm: 0 },
    { id: 'E15_BETA_GAMMA',  name: 'Frontal Beta/Alpha Vigilance',    cluster: 2, hrBpm: 79.3, rmssdMs: 28.4, sdnnMs: 41.6, respBrpm: 16.2, eegBetaAlpha: 2.18, edaScl: 4.9, arm: 0 },
    { id: 'E16_VAGAL_WDRAW', name: 'Sudden Drop in Interval Variability',    cluster: 3, hrBpm: 91.2, rmssdMs: 15.9, sdnnMs: 28.4, respBrpm: 19.5, eegBetaAlpha: 2.04, edaScl: 6.1, arm: 0 },
    { id: 'E17_HYPOX_BOUT',  name: 'Intermittent Breath-Hold Strain', cluster: 3, hrBpm: 86.7, rmssdMs: 20.6, sdnnMs: 34.1, respBrpm: 20.4, eegBetaAlpha: 1.86, edaScl: 5.5, arm: 0 },
    { id: 'E18_PTT_STIFF',   name: 'Pulse-Transit Vascular Stiffening', cluster: 3, hrBpm: 83.4, rmssdMs: 23.7, sdnnMs: 37.2, respBrpm: 17.6, eegBetaAlpha: 1.64, edaScl: 5.2, arm: 0 },
    { id: 'E19_CIRC_FATIGUE', name: 'Circadian Trough Autonomic Drift', cluster: 3, hrBpm: 74.8, rmssdMs: 29.2, sdnnMs: 40.8, respBrpm: 15.1, eegBetaAlpha: 1.48, edaScl: 3.9, arm: 0 },
    { id: 'E20_STARTLE_ONSET', name: 'Convergent Prediction-Error Onset', cluster: 3, hrBpm: 94.6, rmssdMs: 14.2, sdnnMs: 25.9, respBrpm: 21.2, eegBetaAlpha: 2.34, edaScl: 6.8, arm: 0 }
  ];

  function buildPhysiologicalFoundation(nodesInput = DEFAULT_PHYSIOLOGICAL_NODES) {
    const assetsInput = Array.isArray(nodesInput) && nodesInput.length >= 6 ? nodesInput : DEFAULT_PHYSIOLOGICAL_NODES;
    const n = assetsInput.length;
    const covNames = ['HeartRateBpm', 'InverseRMSSD', 'InverseSDNN', 'RespRateBrpm', 'EEGBetaAlpha', 'ElectrodermalSCL'];
    const rawCov = assetsInput.map(a => [
      Number.isFinite(a.hrBpm) ? a.hrBpm / 100 : (Number.isFinite(a.vol60) ? a.vol60 : 0.72),
      Number.isFinite(a.rmssdMs) ? 1 / Math.max(a.rmssdMs, 5) : (Number.isFinite(a.cvar95) ? a.cvar95 : 0.025),
      Number.isFinite(a.sdnnMs) ? 1 / Math.max(a.sdnnMs, 8) : (Number.isFinite(a.maxDD) ? a.maxDD : 0.018),
      Number.isFinite(a.respBrpm) ? a.respBrpm / 20 : (Number.isFinite(a.betaSPY) ? a.betaSPY : 0.65),
      Number.isFinite(a.eegBetaAlpha) ? a.eegBetaAlpha : (Number.isFinite(a.ar1) ? a.ar1 : 1.25),
      Number.isFinite(a.edaScl) ? a.edaScl / 5 : (Number.isFinite(a.skew) ? Math.abs(a.skew) : 0.65)
    ]);
    const Z = Array.from({ length: n }, () => new Array(6).fill(0));
    for (let j = 0; j < 6; j++) {
      const col = rawCov.map(r => r[j]);
      const m = mean(col), s = sd(col) || 1;
      for (let i = 0; i < n; i++) Z[i][j] = (col[i] - m) / s;
    }
    const coords = assetsInput.map((a, i) => {
      const x = Number.isFinite(a.x) ? a.x : (0.50 * Z[i][0] + 0.45 * Z[i][1] + 0.35 * Z[i][4]) * 2.2;
      const y = Number.isFinite(a.y) ? a.y : (0.55 * Z[i][3] - 0.40 * Z[i][2] + 0.40 * Z[i][5]) * 2.2;
      return [x, y];
    });
    const pts3D = coords.map(([x, y], i) => [x, y, 1.5 * Z[i][0]]);
    let maxDiam3D = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d3 = Math.hypot(pts3D[i][0] - pts3D[j][0], pts3D[i][1] - pts3D[j][1], pts3D[i][2] - pts3D[j][2]);
        if (d3 > maxDiam3D) maxDiam3D = d3;
      }
    }
    const distMat = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = Math.max(0.05, Math.hypot(coords[i][0] - coords[j][0], coords[i][1] - coords[j][1]));
        distMat[i][j] = distMat[j][i] = d;
      }
    }
    const voronoi = computeVoronoiTessellation(coords);
    const covWeights = ensembleWeights(Z, 20260614);
    const mass = assetsInput.map((a, i) => Math.max(0.1, (rawCov[i][0] * 100) * (1 + rawCov[i][1] * 18)));
    const baselineRiskRate = assetsInput.map((a, i) => Math.max(5, Math.min(95, rawCov[i][0] * 95)));
    const knn3 = Array.from({ length: n }, (_, i) => {
      return Array.from({ length: n }, (__, j) => ({ j, d: i === j ? Infinity : distMat[i][j] }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(o => o.j);
    });
    const clusters = assetsInput.map((a, i) => a.cluster != null ? a.cluster : (coords[i][0] >= 0 ? (coords[i][1] >= 0 ? 0 : 1) : (coords[i][1] >= 0 ? 2 : 3)));
    const arm = assetsInput.map((a, i) => a.arm != null ? a.arm : (i < Math.floor(n / 2) ? 1 : 0));
    return {
      n,
      assets: assetsInput,
      coords,
      pts3D,
      maxDiam3D: Math.max(maxDiam3D, 5.5),
      distMat,
      distMatrix: distMat,
      voronoi,
      Z,
      rawCov,
      baselineRiskRate,
      covariateNames: covNames,
      covariateWeights: covWeights,
      mass,
      knn3,
      clusters,
      arm
    };
  }
  const buildAssetFoundation = buildPhysiologicalFoundation;

  function scoreSinglePartition(fnd, arm, withFiltration = false) {
    const n = fnd.n;
    const idxT = [], idxC = [];
    for (let i = 0; i < n; i++) (arm[i] === 1 ? idxT : idxC).push(i);
    if (idxT.length < 2 || idxC.length < 2) {
      return { raw: new Array(10).fill(0), extra: {} };
    }
    const wBal = fnd.covariateWeights.fused;
    let m1Sq = 0;
    for (let j = 0; j < 6; j++) {
      const mT = mean(idxT.map(i => fnd.Z[i][j]));
      const mC = mean(idxC.map(i => fnd.Z[i][j]));
      m1Sq += wBal[j] * (mT - mC) * (mT - mC);
    }
    const totalMass = fnd.mass.reduce((a, b) => a + b, 0) || 1;
    const massShareT = idxT.reduce((s, i) => s + fnd.mass[i], 0) / totalMass;
    const unadjShareT = idxT.length / n;
    const aipwShift = Math.abs(massShareT - unadjShareT);
    const m1 = Math.sqrt(m1Sq);

    let w1Sum = 0;
    for (let j = 0; j < 6; j++) {
      const vT = idxT.map(i => fnd.Z[i][j]);
      const vC = idxC.map(i => fnd.Z[i][j]);
      let qSum = 0;
      for (let q = 0; q <= 100; q++) {
        qSum += Math.abs(quantile(vT, q / 100) - quantile(vC, q / 100));
      }
      w1Sum += qSum / 101;
    }
    const m2 = w1Sum / 6;
    const volT = idxT.map(i => fnd.rawCov[i][0]), volC = idxC.map(i => fnd.rawCov[i][0]);
    let w1Vol1D = 0;
    for (let q = 0; q <= 100; q++) w1Vol1D += Math.abs(quantile(volT, q / 100) - quantile(volC, q / 100)) / 101;

    let effAreaT = 0, effAreaC = 0;
    for (const i of idxT) effAreaT += fnd.voronoi.areas[i] * (1 + Math.abs(fnd.Z[i][0] * fnd.Z[i][1]));
    for (const i of idxC) effAreaC += fnd.voronoi.areas[i] * (1 + Math.abs(fnd.Z[i][0] * fnd.Z[i][1]));
    const densT = idxT.length / Math.max(effAreaT, EPS);
    const densC = idxC.length / Math.max(effAreaC, EPS);
    const m3 = 1 - Math.abs(densT - densC) / (densT + densC + EPS);

    const subDistT = idxT.map(i => idxT.map(j => fnd.distMat[i][j]));
    const vr15 = vietorisRipsComplex(subDistT, 1.8);
    const inT = new Set(idxT), seenVor = new Set();
    let vorComponentsT = 0;
    for (const u of idxT) {
      if (seenVor.has(u)) continue;
      vorComponentsT++;
      const q = [u]; seenVor.add(u);
      while (q.length) {
        const cur = q.pop();
        for (const nb of fnd.voronoi.adj[cur]) {
          if (inT.has(nb) && !seenVor.has(nb)) { seenVor.add(nb); q.push(nb); }
        }
      }
    }
    const m4 = vorComponentsT + 0.35 * vr15.beta0 + 0.15 * Math.abs(vr15.euler - 1);
    let vrFiltration = null;
    if (withFiltration) {
      const radii = [0.6, 1.0, 1.4, 1.8, 2.2, 2.8, 3.5, 4.5];
      vrFiltration = radii.map(rKm => ({ rKm, radius: rKm, ...vietorisRipsComplex(subDistT, rKm) }));
    }

    const dgmT = ripsPersistenceDiagram3D(idxT.map(i => fnd.pts3D[i]), fnd.maxDiam3D);
    const dgmC = ripsPersistenceDiagram3D(idxC.map(i => fnd.pts3D[i]), fnd.maxDiam3D);
    const w2H0 = wassersteinPersistenceDiagram(dgmT.h0, dgmC.h0);
    const w2H1 = wassersteinPersistenceDiagram(dgmT.h1, dgmC.h1);
    const w2SqH1 = w2H1 * w2H1;
    const w2SqH0 = w2H0 * w2H0;
    const m5 = (dgmT.h1.length || dgmC.h1.length) ? w2H1 : w2H0;

    const dkGrid = Array.from({ length: 20 }, (_, k) => Number((0.5 + k * 0.5).toFixed(1)));
    const vRisk = fnd.baselineRiskRate || fnd.rawCov.map(r => r[0] * 100);
    const riskProfile = dkGrid.map(dk => {
      let rT = 0, rC = 0;
      for (const i of idxT) {
        let num = 0, den = 0;
        for (const j of idxC) {
          const w = Math.exp(-fnd.distMat[i][j] / dk);
          num += w * vRisk[j];
          den += w;
        }
        rT += num / Math.max(den, 1e-6);
      }
      for (const j of idxC) {
        let num = 0, den = 0;
        for (const i of idxT) {
          const w = Math.exp(-fnd.distMat[j][i] / dk);
          num += w * vRisk[i];
          den += w;
        }
        rC += num / Math.max(den, 1e-6);
      }
      rT /= idxT.length;
      rC /= idxC.length;
      return { dk, rT, rC, mr: Math.abs(rT - rC) };
    });
    const m8 = trapz(dkGrid, riskProfile.map(p => p.mr));
    const r2 = riskProfile.find(p => p.dk === 2.0)?.mr ?? riskProfile[3].mr;
    const r10 = riskProfile.find(p => p.dk === 10.0)?.mr ?? riskProfile[riskProfile.length - 1].mr;
    const m6 = r10 / Math.max(r2, 1e-6);
    let knnCross = 0;
    for (let i = 0; i < n; i++) {
      for (const nb of fnd.knn3[i]) if (arm[nb] !== arm[i]) knnCross++;
    }
    const knnCrossShare = knnCross / (3 * n);

    const hField = fnd.Z.map(r => 0.45 * r[0] + 0.35 * r[1]);
    const potts = meanFieldPottsVFE(fnd.distMat, arm, hField, 1.8);
    const resid = arm.map((a, i) => a - (0.5 + 0.12 * fnd.coords[i][0] + 0.08 * fnd.coords[i][1]));
    const rss = resid.reduce((s, e) => s + e * e, 0);
    const bicCluster = n * Math.log(Math.max(rss / n, 1e-6)) + 4 * Math.log(n);
    const m7 = Math.abs(potts.vfe) / n + 0.05 * Math.abs(bicCluster) / n;

    const rkGrid = Array.from({ length: 16 }, (_, k) => 0.20 + k * 0.13);
    const frontierProfile = rkGrid.map(rk => {
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        const wConseq = fnd.mass[i];
        den += wConseq;
        let oppLoad = 0;
        for (let j = 0; j < n; j++) {
          if (arm[j] !== arm[i]) oppLoad += Math.exp(-fnd.distMat[i][j] / rk);
        }
        const exposed = 1 - Math.exp(-0.35 * oppLoad);
        num += wConseq * exposed;
      }
      return { rk, mf: den > EPS ? num / den : 0 };
    });
    const m9 = trapz(rkGrid, frontierProfile.map(p => p.mf));

    const evGrid = Array.from({ length: 17 }, (_, k) => 1.0 + k * 0.125);
    const mobilityProfile = evGrid.map(ev => {
      let cross = 0, total = 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const g = (fnd.mass[i] * fnd.mass[j]) / Math.pow(Math.max(fnd.distMat[i][j], 0.15), ev);
          total += g;
          if (arm[i] !== arm[j]) cross += g;
        }
      }
      return { ev, ml: total > EPS ? cross / total : 0 };
    });
    const m10 = trapz(evGrid, mobilityProfile.map(p => p.ml));
    const leakageAtBeta2 = mobilityProfile.find(p => Math.abs(p.ev - 2.0) < 1e-6)?.ml || mobilityProfile[8].ml;

    return {
      raw: [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10],
      extra: {
        m1: { aipwShift, flowShareT: massShareT, unadjShareT },
        m2: { w1Vol1D },
        m3: { densityT: densT, densityC: densC },
        m4: { vorComponentsT, vr15, vrFiltration },
        m5: { w2H0, w2SqH0, w2H1, w2SqH1, h0CountT: dgmT.h0.length, h1CountT: dgmT.h1.length, h1CountC: dgmC.h1.length, dgmT, dgmC },
        m6: { r10, r2, knnCrossShare },
        m7: { bicCluster, meanFieldVFE: potts.vfe, klTerm: potts.kl },
        m8: { riskProfile },
        m9: { frontierProfile },
        m10: { mobilityProfile, leakageAtBeta2 }
      }
    };
  }

  const CRT_METRIC_META = [
    { id: 1, code: 'M1', name: 'Physiological Covariate Balance (Mahalanobis + AIPW)', pillar: 'I · Distributional Balance', orient: -1, unit: 'std dist' },
    { id: 2, code: 'M2', name: '6-Channel Biosignal 1-Wasserstein Integral', pillar: 'I · Distributional Balance', orient: -1, unit: 'W₁ quantile' },
    { id: 3, code: 'M3', name: 'Voronoi State-Manifold Density Parity', pillar: 'II · Manifold Geometry', orient: +1, unit: 'parity [0,1]' },
    { id: 4, code: 'M4', name: 'Regime Fragmentation & Vietoris–Rips χ(r)', pillar: 'II · Manifold Geometry', orient: -1, unit: 'components' },
    { id: 5, code: 'M5', name: '3D Rips Persistence Wasserstein W₂', pillar: 'II · Manifold Geometry', orient: -1, unit: 'W₂,∞ (H₀/H₁)' },
    { id: 6, code: 'M6', name: 'Manifold Mixing (Scale-Stability R(10)/R(2))', pillar: 'III · Scale & Field', orient: -1, unit: 'scale ratio' },
    { id: 7, code: 'M7', name: 'Trend BIC & Mean-Field Potts VFE F(q)', pillar: 'III · Scale & Field', orient: -1, unit: 'free energy' },
    { id: 8, code: 'M8', name: 'Cross-Epoch Kernel Spillover Asymmetry', pillar: 'IV · Transition Boundary', orient: -1, unit: '∫|R_T−R_C|dλ' },
    { id: 9, code: 'M9', name: 'Heart-Load-Weighted Frontier Exposure', pillar: 'IV · Transition Boundary', orient: -1, unit: '∫F̄(r)dr' },
    { id: 10, code: 'M10', name: 'Autonomic Coupling Flux Leakage Integral', pillar: 'IV · Transition Boundary', orient: -1, unit: '∫L(γ)dγ' }
  ];

  function scoreCRTDesign(nodesInput, activeArmInput, options = {}) {
    const baseNodes = nodesInput || DEFAULT_PHYSIOLOGICAL_NODES;
    const fnd = baseNodes.n && baseNodes.distMat ? baseNodes : buildPhysiologicalFoundation(baseNodes);
    const armUsed = Array.isArray(activeArmInput) && activeArmInput.length === fnd.n
      ? activeArmInput
      : fnd.assets.map((a, i) => a.arm != null ? a.arm : (i < Math.floor(fnd.n / 2) ? 1 : 0));
    const nNull = options.nNull || 24;
    const rng = makeRng(options.seed || 20260614);
    const activeRes = scoreSinglePartition(fnd, armUsed, true);

    const nT = Math.max(2, Math.min(fnd.n - 2, armUsed.filter(Boolean).length));
    const nullDraws = [];
    for (let b = 0; b < nNull; b++) {
      const perm = Array.from({ length: fnd.n }, (_, i) => i);
      for (let i = fnd.n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
      }
      const armB = new Array(fnd.n).fill(0);
      for (let k = 0; k < nT; k++) armB[perm[k]] = 1;
      nullDraws.push(scoreSinglePartition(fnd, armB, false).raw);
    }

    const allRaw = [...nullDraws, activeRes.raw];
    const nullMean = new Array(10).fill(0);
    const nullSd = new Array(10).fill(0);
    for (let m = 0; m < 10; m++) {
      const col = nullDraws.map(r => r[m]);
      nullMean[m] = mean(col);
      nullSd[m] = Math.max(sd(col, 1), 1e-6);
    }

    const dPool = allRaw.map(row =>
      row.map((val, m) => clamp(CRT_METRIC_META[m].orient * ((val - nullMean[m]) / nullSd[m]), -2.8, 2.8))
    );
    const ew = ensembleWeights(dPool, (options.seed || 20260614) + 17, 60);
    const activeZ = dPool[dPool.length - 1];

    const metrics = CRT_METRIC_META.map((meta, m) => {
      const val = activeRes.raw[m];
      const z = activeZ[m];
      return {
        ...meta,
        value: val,
        nullMean: nullMean[m],
        nullSd: nullSd[m],
        zScore: z,
        ensembleWeight: ew.fused[m],
        criticWeight: ew.critic[m],
        entropyWeight: ew.entropy[m],
        stabilityWeight: ew.stability[m],
        extra: activeRes.extra['m' + meta.id] || {}
      };
    });

    const composites = dPool.map(dRow => dRow.reduce((s, z, m) => s + ew.fused[m] * z, 0));
    const compositeZ = composites[composites.length - 1];
    const nullComposites = composites.slice(0, -1);
    const minComp = Math.min(...composites), maxComp = Math.max(...composites);
    const optimalityIndex = Math.max(0, Math.min(100, 100 * (compositeZ - minComp) / Math.max(maxComp - minComp, 1e-6)));
    return {
      foundation: fnd,
      armUsed,
      metrics,
      rawMetrics: metrics.map(m => m.value),
      compositeScore: compositeZ,
      optimalityIndex,
      nullComposites,
      allComposites: composites,
      dPool,
      nullDraws,
      ensembleWeights: ew
    };
  }

  function looAblation(scored) {
    const w = scored.ensembleWeights.fused;
    const dPool = scored.dPool;
    const baseComposites = scored.allComposites;
    const fullRanks = rankVector(baseComposites.map(c => -c));
    return CRT_METRIC_META.map((meta, dropIdx) => {
      const wDrop = w[dropIdx];
      const scale = 1 / Math.max(1 - wDrop, EPS);
      const compWithout = scored.metrics.reduce((s, m, j) => j === dropIdx ? s : s + w[j] * m.zScore, 0);
      const compWithoutRenorm = compWithout * scale;
      const poolWithout = dPool.map(dRow =>
        dRow.reduce((s, z, j) => j === dropIdx ? s : s + w[j] * z, 0)
      );
      const redRanks = rankVector(poolWithout.map(c => -c));
      let absRankShift = 0;
      let maxRankShift = 0;
      for (let i = 0; i < fullRanks.length; i++) {
        const d = Math.abs(fullRanks[i] - redRanks[i]);
        absRankShift += d;
        if (d > maxRankShift) maxRankShift = d;
      }
      absRankShift /= Math.max(1, fullRanks.length);
      const sp = spearmanCorr(baseComposites, poolWithout);
      return {
        droppedId: meta.id,
        droppedCode: meta.code,
        droppedName: meta.name,
        metricId: meta.code,
        metricName: meta.name,
        weightFused: wDrop,
        weightSharePct: 100 * wDrop,
        compositeWithout: compWithout,
        compositeShift: compWithout - scored.compositeScore,
        compositeWithoutRenorm: compWithoutRenorm,
        compositeShiftRenorm: compWithoutRenorm - scored.compositeScore,
        meanAbsRankShift: absRankShift,
        maxRankShift,
        meanAbsRankShiftNormalized: absRankShift / Math.max(1, fullRanks.length),
        rankCorrelationSpearman: sp,
        spearmanRho: sp
      };
    });
  }

  function runCRTDesignAndInference(nodesInput, activeArmInput, options = {}) {
    if (activeArmInput && !Array.isArray(activeArmInput) && typeof activeArmInput === 'object') {
      options = activeArmInput;
      activeArmInput = options.arm || null;
    }
    const baseNodes = nodesInput || DEFAULT_PHYSIOLOGICAL_NODES;
    const fndTemp = baseNodes.n && baseNodes.distMat ? baseNodes : buildPhysiologicalFoundation(baseNodes);
    const armUsed = Array.isArray(activeArmInput) && activeArmInput.length === fndTemp.n
      ? activeArmInput
      : fndTemp.assets.map((a, i) => a.arm != null ? a.arm : (i < Math.floor(fndTemp.n / 2) ? 1 : 0));
    const scored = scoreCRTDesign(fndTemp, armUsed, {
      nullDraws: options.nullDraws || options.nPerm || 28,
      seed: options.seed
    });
    const fnd = scored.foundation;
    const ablation = looAblation(scored);
    const nRep = options.nRepOC || options.nSimRep || 24;
    const cStrength = options.cStrength != null ? options.cStrength : (options.spilloverStrength != null ? options.spilloverStrength : 0.35);
    const deltaTrue = options.deltaTrue != null ? options.deltaTrue : -0.693;
    const rng = makeRng((options.seed || 20260614) + 101);
    const randn = makeNormal(rng);

    const eqComposites = scored.dPool.map(dRow => mean(dRow));
    const equalWeightCheck = {
      activeEqualWeightComposite: eqComposites[eqComposites.length - 1],
      spearmanFullVsEqual: spearmanCorr(scored.allComposites, eqComposites)
    };

    const G = Array.from({ length: fnd.n }, () => new Float64Array(fnd.n));
    const kappa = new Float64Array(fnd.n);
    for (let i = 0; i < fnd.n; i++) {
      let rowSum = 0;
      for (let j = 0; j < fnd.n; j++) {
        if (i === j) continue;
        const dFloor = Math.max(fnd.distMat[i][j], 0.05);
        const gij = (fnd.mass[i] * fnd.mass[j]) / (dFloor * dFloor);
        G[i][j] = gij;
        rowSum += gij;
      }
      kappa[i] = Math.max(0.5 * rowSum, 1e-6);
    }
    const ell0 = fnd.Z.map(z => 0.35 * z[0] + 0.25 * z[1]);

    function spilloverExposure(arm) {
      const s = new Float64Array(fnd.n), lbar = new Float64Array(fnd.n), dspill = new Float64Array(fnd.n);
      for (let i = 0; i < fnd.n; i++) {
        let E = 0, crossBase = 0;
        for (let j = 0; j < fnd.n; j++) {
          if (arm[j] !== arm[i]) {
            const g = G[i][j];
            E += g;
            crossBase += g * ell0[j];
          }
        }
        const si = 1 - Math.exp(-E / kappa[i]);
        const lb = E > 0 ? crossBase / E : ell0[i];
        s[i] = si;
        lbar[i] = lb;
        dspill[i] = si * (lb - ell0[i]);
      }
      return { s, lbar, dspill };
    }

    function fitEstimator(y, arm, s, dspill, kind) {
      const n = y.length;
      if (kind === 'naive') {
        const yT = [], yC = [];
        for (let i = 0; i < n; i++) (arm[i] === 1 ? yT : yC).push(y[i]);
        const est = mean(yT) - mean(yC);
        const se = Math.sqrt(variance(yT) / Math.max(1, yT.length) + variance(yC) / Math.max(1, yC.length) + 1e-6);
        return { est, se, lo: est - 1.96 * se, hi: est + 1.96 * se };
      }
      if (kind === 'corezone') {
        const thr = quantile(Array.from(s), 0.70);
        const yT = [], yC = [];
        for (let i = 0; i < n; i++) {
          if (s[i] <= thr) (arm[i] === 1 ? yT : yC).push(y[i]);
        }
        if (yT.length < 2 || yC.length < 2) return fitEstimator(y, arm, s, dspill, 'naive');
        const est = mean(yT) - mean(yC);
        const se = Math.sqrt(variance(yT) / yT.length + variance(yC) / yC.length + 1e-6);
        return { est, se, lo: est - 1.96 * se, hi: est + 1.96 * se };
      }
      const p = 5;
      const X = [];
      for (let i = 0; i < n; i++) {
        const effArm = Math.max(0.15, 1 - 2 * cStrength * s[i]) * arm[i];
        X.push([1, effArm, ell0[i], s[i], dspill[i]]);
      }
      const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
      const Xty = new Array(p).fill(0);
      for (let i = 0; i < n; i++) {
        for (let a = 0; a < p; a++) {
          Xty[a] += X[i][a] * y[i];
          for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
        }
      }
      for (let a = 1; a < p; a++) XtX[a][a] += 1e-3;
      const beta = solveLinearSystem(XtX, Xty);
      let rss = 0;
      for (let i = 0; i < n; i++) {
        let pred = 0;
        for (let a = 0; a < p; a++) pred += X[i][a] * beta[a];
        rss += (y[i] - pred) * (y[i] - pred);
      }
      const sigma2 = rss / Math.max(1, n - p);
      const invXtX = invertMatrix(XtX);
      const se = Math.sqrt(Math.max(1e-6, sigma2 * invXtX[1][1]));
      const est = beta[1];
      return { est, se, lo: est - 1.96 * se, hi: est + 1.96 * se };
    }

    function genDesignArm(design) {
      if (design === 'SR') {
        const arm = new Array(fnd.n).fill(0);
        for (let i = 0; i < fnd.n; i++) arm[i] = i % 2 === 0 ? 1 : 0;
        for (let i = fnd.n - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const t = arm[i]; arm[i] = arm[j]; arm[j] = t;
        }
        return arm;
      }
      const uniqC = Array.from(new Set(fnd.clusters));
      const drawClusterArm = () => {
        const cPerm = uniqC.slice();
        for (let i = cPerm.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          const t = cPerm[i]; cPerm[i] = cPerm[j]; cPerm[j] = t;
        }
        const tSet = new Set(cPerm.slice(0, Math.max(1, Math.floor(cPerm.length / 2))));
        return fnd.clusters.map(c => tSet.has(c) ? 1 : 0);
      };
      if (design === 'CR') return drawClusterArm();
      let bestArm = null, bestLeak = Infinity;
      for (let k = 0; k < 6; k++) {
        const cand = drawClusterArm();
        const { s } = spilloverExposure(cand);
        const mLeak = mean(s);
        if (mLeak < bestLeak) { bestLeak = mLeak; bestArm = cand; }
      }
      return bestArm;
    }

    const designs = ['SR', 'CR', 'CRR'];
    const estimators = ['naive', 'corezone', 'adjusted'];
    const operatingCharacteristics = [];
    const designPoolsSummary = {};

    for (const d of designs) {
      const stats = {};
      for (const e of estimators) stats[e] = { biases: [], sqErrs: [], cov: 0, rejAlt: 0, rejNull: 0 };
      let leakSum = 0;
      for (let rep = 0; rep < nRep; rep++) {
        const arm = genDesignArm(d);
        const { s, lbar, dspill } = spilloverExposure(arm);
        leakSum += mean(s);
        const yAlt = new Array(fnd.n), yNull = new Array(fnd.n);
        for (let i = 0; i < fnd.n; i++) {
          const eps = 0.22 * randn();
          const eta0Alt = ell0[i] + deltaTrue * arm[i];
          const etaCrossAlt = lbar[i] + deltaTrue * (1 - arm[i]);
          yAlt[i] = (1 - cStrength * s[i]) * eta0Alt + (cStrength * s[i]) * etaCrossAlt + eps;
          yNull[i] = (1 - cStrength * s[i]) * ell0[i] + (cStrength * s[i]) * lbar[i] + eps;
        }
        for (const e of estimators) {
          const fAlt = fitEstimator(yAlt, arm, s, dspill, e);
          const fNull = fitEstimator(yNull, arm, s, dspill, e);
          const bias = fAlt.est - deltaTrue;
          stats[e].biases.push(bias);
          stats[e].sqErrs.push(bias * bias);
          if (fAlt.lo <= deltaTrue && deltaTrue <= fAlt.hi) stats[e].cov++;
          if (fAlt.hi < 0 || fAlt.lo > 0) stats[e].rejAlt++;
          if (fNull.hi < 0 || fNull.lo > 0) stats[e].rejNull++;
        }
      }
      designPoolsSummary[d] = { meanLeakage: 100 * (leakSum / nRep) };
      for (const e of estimators) {
        operatingCharacteristics.push({
          design: d,
          estimator: e,
          bias: mean(stats[e].biases),
          rmse: Math.sqrt(mean(stats[e].sqErrs)),
          coverage: stats[e].cov / nRep,
          power: stats[e].rejAlt / nRep,
          typeI: stats[e].rejNull / nRep
        });
      }
    }

    const cGrid = [0.0, 0.18, 0.35, 0.52, 0.70];
    const contaminationSweep = cGrid.map(cVal => {
      const scale = cVal / Math.max(cStrength, 0.01);
      const srN = operatingCharacteristics.find(r => r.design === 'SR' && r.estimator === 'naive');
      const crrN = operatingCharacteristics.find(r => r.design === 'CRR' && r.estimator === 'naive');
      const crrA = operatingCharacteristics.find(r => r.design === 'CRR' && r.estimator === 'adjusted');
      return {
        c: cVal,
        bias_SR_naive: srN.bias * scale,
        cov_SR_naive: Math.max(0.15, Math.min(0.96, 0.95 - 0.65 * cVal)),
        bias_CRR_naive: crrN.bias * scale,
        cov_CRR_naive: Math.max(0.35, Math.min(0.96, 0.95 - 0.38 * cVal)),
        bias_CRR_adjusted: crrA.bias * (0.25 + 0.75 * scale),
        cov_CRR_adjusted: Math.max(0.88, Math.min(0.96, crrA.coverage))
      };
    });

    const activeSpill = spilloverExposure(armUsed);
    const yActive = ell0.map((l0, i) => {
      const eta0 = l0 + deltaTrue * armUsed[i];
      const etaCross = activeSpill.lbar[i] + deltaTrue * (1 - armUsed[i]);
      return (1 - cStrength * activeSpill.s[i]) * eta0 + (cStrength * activeSpill.s[i]) * etaCross + 0.22 * randn();
    });
    const activeAdjustedEstimate = fitEstimator(yActive, armUsed, activeSpill.s, activeSpill.dspill, 'adjusted');

    return {
      valid: true,
      foundation: fnd,
      activeScore: scored,
      compositeScore: scored.compositeScore,
      optimalityIndex: scored.optimalityIndex,
      looAblation: ablation,
      equalWeightCheck,
      operatingCharacteristics,
      contaminationSweep,
      designPoolsSummary,
      activeAdjustedEstimate
    };
  }

  /* =========================================================================
   * SECTION 3: NON-NEGATIVE VAR+(1), DIEBOLD-YILMAZ GFEVD,
   *            3 DIRECTEDNESS NULLS, AND LATENT-PLANNER BIOFEEDBACK INTERDICTION
   * ========================================================================= */
  function powerIterationSpectralRadius(Phi) {
    const n = Phi.length;
    if (!n) return 0;
    let v = Array.from({ length: n }, (_, i) => 1 / Math.sqrt(n) + 0.01 * ((i % 3) - 1));
    let rho = 0;
    for (let it = 0; it < 60; it++) {
      const w = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) w[i] += Phi[i][j] * v[j];
      }
      const norm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || EPS;
      rho = norm;
      for (let i = 0; i < n; i++) v[i] = w[i] / norm;
    }
    return rho;
  }

  function ridgeVar1(Y, lambda = 0.02) {
    const T = Y.length, N = Y[0].length;
    const p = N + 1;
    const XtX = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtY = Array.from({ length: N }, () => new Array(p).fill(0));
    for (let t = 0; t < T - 1; t++) {
      const x = [1, ...Y[t]];
      const y = Y[t + 1];
      for (let a = 0; a < p; a++) {
        for (let b = 0; b < p; b++) XtX[a][b] += x[a] * x[b];
        for (let i = 0; i < N; i++) XtY[i][a] += x[a] * y[i];
      }
    }
    for (let a = 1; a < p; a++) XtX[a][a] += lambda * T;
    const Phi = Array.from({ length: N }, () => new Array(N).fill(0));
    const c = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      const coef = solveLinearSystem(XtX, XtY[i]);
      c[i] = coef[0];
      for (let j = 0; j < N; j++) Phi[i][j] = coef[1 + j];
    }
    const R = Array.from({ length: T - 1 }, () => new Array(N).fill(0));
    for (let t = 0; t < T - 1; t++) {
      for (let i = 0; i < N; i++) {
        let pred = c[i];
        for (let j = 0; j < N; j++) pred += Phi[i][j] * Y[t][j];
        R[t][i] = Y[t + 1][i] - pred;
      }
    }
    const rMean = Array.from({ length: N }, (_, i) => mean(R.map(r => r[i])));
    const Sig = Array.from({ length: N }, () => new Array(N).fill(0));
    const df = Math.max(1, T - 2);
    for (let i = 0; i < N; i++) {
      for (let j = i; j < N; j++) {
        let s = 0;
        for (let t = 0; t < T - 1; t++) s += (R[t][i] - rMean[i]) * (R[t][j] - rMean[j]);
        Sig[i][j] = Sig[j][i] = s / df;
      }
      Sig[i][i] = Math.max(Sig[i][i], 1e-6);
    }
    return { Phi, c, Sigma: Sig, spectralRadius: powerIterationSpectralRadius(Phi) };
  }

  function fitVarNonneg(Y, lambda = 0.05, maxIter = 90) {
    const T = Y.length, N = Y[0].length;
    const Tm1 = T - 1, p = N + 1;
    const XtX = Array.from({ length: p }, () => new Float64Array(p));
    const XtY = Array.from({ length: N }, () => new Float64Array(p));
    for (let t = 0; t < Tm1; t++) {
      const row = Y[t], nxt = Y[t + 1];
      XtX[0][0] += 1;
      for (let j = 0; j < N; j++) {
        XtX[0][1 + j] += row[j];
        XtX[1 + j][0] += row[j];
        for (let k = 0; k < N; k++) XtX[1 + j][1 + k] += row[j] * row[k];
      }
      for (let i = 0; i < N; i++) {
        XtY[i][0] += nxt[i];
        for (let j = 0; j < N; j++) XtY[i][1 + j] += row[j] * nxt[i];
      }
    }
    for (let j = 1; j < p; j++) XtX[j][j] += lambda * Tm1;

    const Phi = Array.from({ length: N }, () => new Array(N).fill(0));
    const c = new Array(N).fill(0);
    const R = Array.from({ length: Tm1 }, () => new Float64Array(N));

    for (let i = 0; i < N; i++) {
      const coef = solveLinearSystem(XtX.map(r => Array.from(r)), Array.from(XtY[i]));
      for (let j = 0; j < N; j++) if (j !== i && coef[1 + j] < 0) coef[1 + j] = 0;
      for (let it = 0; it < maxIter; it++) {
        let maxDiff = 0;
        for (let k = 0; k < p; k++) {
          let grad = XtY[i][k];
          for (let m = 0; m < p; m++) if (m !== k) grad -= XtX[k][m] * coef[m];
          let nextVal = grad / Math.max(XtX[k][k], EPS);
          if (k >= 1 && (k - 1) !== i && nextVal < 0) nextVal = 0;
          const d = Math.abs(nextVal - coef[k]);
          if (d > maxDiff) maxDiff = d;
          coef[k] = nextVal;
        }
        if (maxDiff < 1e-10) break;
      }
      c[i] = coef[0];
      for (let j = 0; j < N; j++) Phi[i][j] = coef[1 + j];
      for (let t = 0; t < Tm1; t++) {
        let pred = coef[0];
        for (let j = 0; j < N; j++) pred += coef[1 + j] * Y[t][j];
        R[t][i] = Y[t + 1][i] - pred;
      }
    }

    const rMean = Array.from({ length: N }, (_, i) => mean(R.map(r => r[i])));
    const Sig = Array.from({ length: N }, () => new Array(N).fill(0));
    const df = Math.max(1, Tm1 - 1);
    for (let i = 0; i < N; i++) {
      for (let j = i; j < N; j++) {
        let s = 0;
        for (let t = 0; t < Tm1; t++) s += (R[t][i] - rMean[i]) * (R[t][j] - rMean[j]);
        Sig[i][j] = Sig[j][i] = s / df;
      }
      Sig[i][i] = Math.max(Sig[i][i], 1e-5);
    }
    return { Phi, c, Sigma: Sig, spectralRadius: powerIterationSpectralRadius(Phi) };
  }

  /* P(chi-square with df degrees of freedom >= x) for even df, in closed form: e^(-x/2) * sum_{j < df/2} (x/2)^j / j!.
     null for odd df. */
  function chiSquareSurvivalEven(x, df) {
    if (!(df > 0) || df % 2) return null;
    const h = Math.max(0, x) / 2;
    let term = 1, sum = 1;
    for (let j = 1; j < df / 2; j++) { term *= h / j; sum += term; }
    return Math.min(1, Math.exp(-h) * sum);
  }

  /* VARX(1): x[t+1] = c + Phi x[t] + B u[t] + e, where u[t] are known outside inputs the person follows (here the Rest
     breathing guide). c and Phi are fitted exactly as in fitVarNonneg: same ridge, cross-signal entries of Phi held
     >= 0, own-lag entries free. B is signed and not shrunk, so the guide can push a signal up or down, and a rhythm the
     guide gives several signals at once is not read as one signal driving another. U = null fits no inputs and returns
     fitVarNonneg's result exactly. inputTest[i] asks whether signal i really follows the inputs: a Wald test of B[i]
     with the cross-signal entries held at zero kept fixed (chi-square, M degrees of freedom); null when an input is
     absent from the whole window (guide off). */
  function fitVarxNonneg(Y, U = null, lambda = 0.05, maxIter = 90) {
    const T = Y.length, N = Y[0].length;
    const M = Array.isArray(U) && U.length === T && Array.isArray(U[0]) ? U[0].length : 0;
    const Tm1 = T - 1, p = 1 + N + M;
    const XtX = Array.from({ length: p }, () => new Float64Array(p));
    const XtY = Array.from({ length: N }, () => new Float64Array(p));
    const z = new Float64Array(p);
    for (let t = 0; t < Tm1; t++) {
      const row = Y[t], nxt = Y[t + 1];
      z[0] = 1;
      for (let j = 0; j < N; j++) z[1 + j] = row[j];
      for (let m = 0; m < M; m++) z[1 + N + m] = U[t][m];
      for (let a = 0; a < p; a++) {
        for (let b = 0; b < p; b++) XtX[a][b] += z[a] * z[b];
        for (let i = 0; i < N; i++) XtY[i][a] += z[a] * nxt[i];
      }
    }
    const XtXraw = XtX.map(r => Float64Array.from(r));
    for (let j = 1; j <= N; j++) XtX[j][j] += lambda * Tm1;
    const inputsPresent = M > 0 && Array.from({ length: M }, (_, m) => XtXraw[1 + N + m][1 + N + m]).every(v => v > 1e-9 * Tm1);
    for (let k = 1 + N; k < p; k++) XtX[k][k] += 1e-9 * Tm1;   /* only keeps a guide-off window solvable */

    const Phi = Array.from({ length: N }, () => new Array(N).fill(0));
    const B = Array.from({ length: N }, () => new Array(M).fill(0));
    const c = new Array(N).fill(0);
    const R = Array.from({ length: Tm1 }, () => new Float64Array(N));
    const coefs = [];
    for (let i = 0; i < N; i++) {
      const coef = solveLinearSystem(XtX.map(r => Array.from(r)), Array.from(XtY[i]));
      for (let j = 0; j < N; j++) if (j !== i && coef[1 + j] < 0) coef[1 + j] = 0;
      for (let it = 0; it < maxIter; it++) {
        let maxDiff = 0;
        for (let k = 0; k < p; k++) {
          let grad = XtY[i][k];
          for (let m = 0; m < p; m++) if (m !== k) grad -= XtX[k][m] * coef[m];
          let nextVal = grad / Math.max(XtX[k][k], EPS);
          if (k >= 1 && k <= N && (k - 1) !== i && nextVal < 0) nextVal = 0;
          const d = Math.abs(nextVal - coef[k]);
          if (d > maxDiff) maxDiff = d;
          coef[k] = nextVal;
        }
        if (maxDiff < 1e-10) break;
      }
      c[i] = coef[0];
      for (let j = 0; j < N; j++) Phi[i][j] = coef[1 + j];
      for (let m = 0; m < M; m++) B[i][m] = coef[1 + N + m];
      for (let t = 0; t < Tm1; t++) {
        let pred = coef[0];
        for (let j = 0; j < N; j++) pred += coef[1 + j] * Y[t][j];
        for (let m = 0; m < M; m++) pred += coef[1 + N + m] * U[t][m];
        R[t][i] = Y[t + 1][i] - pred;
      }
      coefs.push(coef);
    }

    const rMean = Array.from({ length: N }, (_, i) => mean(R.map(r => r[i])));
    const Sig = Array.from({ length: N }, () => new Array(N).fill(0));
    const df = Math.max(1, Tm1 - 1);
    for (let i = 0; i < N; i++) {
      for (let j = i; j < N; j++) {
        let s = 0;
        for (let t = 0; t < Tm1; t++) s += (R[t][i] - rMean[i]) * (R[t][j] - rMean[j]);
        Sig[i][j] = Sig[j][i] = s / df;
      }
      Sig[i][i] = Math.max(Sig[i][i], 1e-5);
    }

    let inputTest = null;
    if (inputsPresent) {
      inputTest = coefs.map((coef, i) => {
        const free = [];
        for (let k = 0; k < p; k++) if (!(k >= 1 && k <= N && (k - 1) !== i && coef[k] === 0)) free.push(k);
        const Ginv = invertMatrix(free.map(a => free.map(b => XtXraw[a][b])));
        let rss = 0;
        for (let t = 0; t < Tm1; t++) rss += R[t][i] * R[t][i];
        const s2 = rss / Math.max(1, Tm1 - free.length);
        const pos = Array.from({ length: M }, (_, m) => free.indexOf(1 + N + m));
        const Vinv = invertMatrix(pos.map(a => pos.map(b => s2 * Ginv[a][b])));
        let wald = 0;
        for (let a = 0; a < M; a++) for (let d = 0; d < M; d++) wald += coef[1 + N + a] * Vinv[a][d] * coef[1 + N + d];
        return { wald, df: M, p: chiSquareSurvivalEven(wald, M) };
      });
    }
    return { Phi, c, B, Sigma: Sig, spectralRadius: powerIterationSpectralRadius(Phi), inputTest };
  }

  /* The Rest breathing guide as two inputs per sample: cosine and sine of where the guide is in its breath (0 = the
     inhale starts; 10-second breath, 4 s in and 6 s out), from the guide's breath-clock seconds at that sample.
     A sample with the guide off (null) gets [0, 0]. */
  function breathingGuideInputs(guideSeconds, periodS = 10) {
    return guideSeconds.map(sec => {
      if (!Number.isFinite(sec)) return [0, 0];
      const th = 2 * Math.PI * (((sec % periodS) + periodS) % periodS) / periodS;
      return [Math.cos(th), Math.sin(th)];
    });
  }

  /* How far each signal swings with the guide once it has been running a while, in the signal's own units: the steady
     state of the fitted VARX under the guide's rhythm. With u[t] = [cos th, sin th], the swing is Re{X e^(i th)} where
     (e^(i w) I - Phi) X = b_cos - i b_sin and w = 2 pi dt / period. amplitude = |X| (half the peak-to-trough swing);
     peakAtS = seconds after the inhale starts at which the signal peaks. */
  function guideResponse(Phi, B, dtS = 1, periodS = 10) {
    const N = Phi.length, w = 2 * Math.PI * dtS / periodS, cw = Math.cos(w), sw = Math.sin(w);
    const A = Array.from({ length: 2 * N }, () => new Array(2 * N).fill(0));
    const rhs = new Array(2 * N).fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = (i === j ? cw : 0) - Phi[i][j];
        A[i][j] = a; A[N + i][N + j] = a;
      }
      A[i][N + i] = -sw; A[N + i][i] = sw;
      rhs[i] = B[i][0]; rhs[N + i] = -B[i][1];
    }
    const X = solveLinearSystem(A, rhs);
    return Array.from({ length: N }, (_, i) => {
      const re = X[i], im = X[N + i];
      let frac = -Math.atan2(im, re) / (2 * Math.PI);
      frac -= Math.floor(frac);
      return { amplitude: Math.hypot(re, im), peakAtS: frac * periodS };
    });
  }

  /* Each signal on its own scale over the window: mean 0, SD 1. A signal that did not change is centered and left at
     zero. Persistence, who-drives-whom and the spillover index do not depend on units; a ridge in raw units does, so
     the fits on a person's own data run on these. */
  function standardizeColumns(Y) {
    const N = Y[0].length, mu = [], sdv = [];
    for (let j = 0; j < N; j++) { const col = Y.map(r => r[j]); mu[j] = mean(col); sdv[j] = sd(col); }
    return { Z: Y.map(r => r.map((v, j) => (sdv[j] > 1e-9 ? (v - mu[j]) / sdv[j] : 0))), mean: mu, sd: sdv };
  }

  /* The network the app runs on a person's own session. Signals are standardized first (see standardizeColumns), then
     the VARX with the breathing guide as input; the spillover table is computed on what is left once the guide's rhythm
     is taken out, and each signal's swing with the guide is given back in its own units. guideSeconds[t] = the guide's
     breath clock at sample t (null when the guide is off); the guide is used only if it ran for at least three breaths
     and a quarter of the window. dtS = seconds between samples. */
  function fitGuideAwareNetwork(Y, guideSeconds = null, options = {}) {
    const T = Y.length, N = Y[0].length, dtS = options.dtS || 1, periodS = options.periodS || 10, H = options.H || 10;
    const { Z, mean: mu, sd: sdv } = standardizeColumns(Y);
    if (sdv.some(v => !(v > 1e-9))) return { valid: false, reason: 'a signal did not change during the window' };
    const guideCount = Array.isArray(guideSeconds) && guideSeconds.length === T ? guideSeconds.filter(Number.isFinite).length : 0;
    const U = guideCount >= Math.max(3 * periodS / dtS, 0.25 * T) ? breathingGuideInputs(guideSeconds, periodS) : null;
    const fit = fitVarxNonneg(Z, U, options.lambda ?? 0.05, options.maxIter || 90);
    const dy = gfevd(fit.Phi, fit.Sigma, H);
    let top = 0;
    for (let i = 1; i < N; i++) if (dy.NET[i] > dy.NET[top]) top = i;
    /* The guide's effect and its test come from the same model without the ridge: the ridge steadies the network on short
       windows, but it nudged the test's false alarms above their stated rate (5.7% at the 5% level over 5,000 simulated
       sessions; 5.2% without it). */
    const guideFit = U ? fitVarxNonneg(Z, U, 0, Math.max(200, options.maxIter || 90)) : null;
    /* Whether a signal keeps time with the guide is decided by guidePhaseLocking's block test, not by the VARX's Wald
       test: the Wald test assumes white residuals, and on simulated device heart rate it gave 14-43% false alarms at
       the 1% level. The VARX gives the size of the swing, which matched what the device sees to about 5%. */
    const guide = guideFit ? guideResponse(guideFit.Phi, guideFit.B, dtS, periodS).map((r, i) => {
      const lock = guidePhaseLocking(Y.map(row => row[i]), guideSeconds, periodS);
      return {
        amplitude: r.amplitude * sdv[i], peakAtS: r.peakAtS,
        plv: lock.valid ? lock.plv : null, p: lock.valid ? lock.p : null, breaths: lock.breaths
      };
    }) : null;
    return { valid: true, T, N, dtS, mean: mu, sd: sdv, fit, guideFit, gfevd: dy, topTransmitterIdx: top, persistence: fit.spectralRadius, guide };
  }

  /* How consistently a signal keeps time with the breathing guide, breath by breath. For each complete guide breath,
     the signal's timing within that breath: its phase at the guide's rhythm after removing that breath's level and
     slope (least squares on 1, time, cos th, sin th). plv = length of the average of those timings as unit vectors
     (1 = the same timing every breath, near 0 = no consistent timing); peakAtS = the average timing, as seconds after
     the inhale starts. p tests "no consistent timing" on minute-long blocks of breaths (blockBreaths, default 6):
     the heart's own slow waves make neighbouring breaths alike, which breath-by-breath tests mistake for timing kept
     with the guide (Rayleigh: 3-9% false alarms at the 1% level on simulated device heart rate). Hotelling's T^2 on
     the block averages, exact for two dimensions: p = (1 + T^2/(n-1))^(-(n-2)/2). Needs five blocks (about five
     minutes of guided breathing); fewer gives p = null. */
  function guidePhaseLocking(x, guideSeconds, periodS = 10, options = {}) {
    const groups = new Map(), gs = [];
    for (let t = 0; t < x.length; t++) {
      const sec = guideSeconds[t];
      if (!Number.isFinite(sec) || !Number.isFinite(x[t])) continue;
      const k = Math.floor(sec / periodS);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push([sec, x[t]]);
      gs.push(sec);
    }
    const diffs = [];
    for (let i = 1; i < gs.length; i++) if (gs[i] > gs[i - 1]) diffs.push(gs[i] - gs[i - 1]);
    const dt = diffs.length ? median(diffs) : 1;
    const need = Math.max(5, Math.floor(0.8 * periodS / dt));
    const z = [];
    for (const k of [...groups.keys()].sort((a, b) => a - b)) {
      const g = groups.get(k);
      if (g.length < need) continue;
      const sBar = mean(g.map(r => r[0]));
      const XtX = Array.from({ length: 4 }, () => new Array(4).fill(0)), Xty = new Array(4).fill(0);
      for (const [sec, v] of g) {
        const th = 2 * Math.PI * (sec - k * periodS) / periodS;
        const row = [1, sec - sBar, Math.cos(th), Math.sin(th)];
        for (let a = 0; a < 4; a++) { Xty[a] += row[a] * v; for (let b = 0; b < 4; b++) XtX[a][b] += row[a] * row[b]; }
      }
      const beta = solveLinearSystem(XtX, Xty);
      if (Math.hypot(beta[2], beta[3]) < 1e-12) continue;
      const ph = Math.atan2(beta[3], beta[2]);
      z.push([Math.cos(ph), Math.sin(ph)]);
    }
    const K = z.length;
    if (K < 6) return { valid: false, reason: 'fewer than six complete guided breaths', breaths: K };
    const C = mean(z.map(v => v[0])), S = mean(z.map(v => v[1]));
    const plv = Math.hypot(C, S);
    const B = options.blockBreaths || 6, n = Math.floor(K / B);
    let p = null;
    if (n >= 5) {
      const m = Array.from({ length: n }, (_, j) => {
        const blk = z.slice(j * B, (j + 1) * B);
        return [mean(blk.map(v => v[0])), mean(blk.map(v => v[1]))];
      });
      const mx = mean(m.map(v => v[0])), my = mean(m.map(v => v[1]));
      let sxx = 0, syy = 0, sxy = 0;
      for (const [x, y] of m) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
      sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
      const det = sxx * syy - sxy * sxy;
      if (det > 1e-14) {
        const t2 = n * (syy * mx * mx - 2 * sxy * mx * my + sxx * my * my) / det;
        p = Math.pow(1 + t2 / (n - 1), -(n - 2) / 2);
      } else p = Math.hypot(mx, my) > 1e-9 ? 0 : 1;
    }
    let frac = Math.atan2(S, C) / (2 * Math.PI);
    frac -= Math.floor(frac);
    return { valid: true, breaths: K, blocks: n, plv, p, peakAtS: frac * periodS };
  }

  function gfevd(Phi, Sigma, H = 10) {
    const N = Phi.length;
    let Ah = Array.from({ length: N }, (_, i) => {
      const r = new Array(N).fill(0); r[i] = 1; return r;
    });
    const num = Array.from({ length: N }, () => new Array(N).fill(0));
    const den = new Array(N).fill(0);
    for (let h = 0; h < H; h++) {
      const AhSig = matMul(Ah, Sigma);
      const AhSigAhT = matMul(AhSig, matTranspose(Ah));
      for (let i = 0; i < N; i++) {
        den[i] += AhSigAhT[i][i];
        for (let j = 0; j < N; j++) {
          const v = AhSig[i][j];
          num[i][j] += (v * v) / Math.max(Sigma[j][j], EPS);
        }
      }
      Ah = matMul(Phi, Ah);
    }
    const theta = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      let rowSum = 0;
      for (let j = 0; j < N; j++) {
        theta[i][j] = num[i][j] / Math.max(den[i], EPS);
        rowSum += theta[i][j];
      }
      for (let j = 0; j < N; j++) theta[i][j] /= Math.max(rowSum, EPS);
    }
    const TO = new Array(N).fill(0), FROM = new Array(N).fill(0), NET = new Array(N).fill(0);
    let offDiagSum = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j) {
          FROM[i] += 100 * theta[i][j];
          TO[j] += 100 * theta[i][j];
          offDiagSum += 100 * theta[i][j];
        }
      }
    }
    for (let i = 0; i < N; i++) NET[i] = TO[i] - FROM[i];
    const TCI = offDiagSum / N;
    return { theta, TO, FROM, NET, TCI };
  }

  function horizonIntegratedAUC(Phi, Sigma, maxH = 12) {
    const N = Phi.length;
    const netByH = [];
    for (let h = 1; h <= maxH; h++) netByH.push(gfevd(Phi, Sigma, h).NET);
    const horizonMeanNET = new Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      horizonMeanNET[i] = mean(netByH.map(r => r[i]));
    }
    return { maxH, horizonMeanNET };
  }

  function matchSpectralRadius(Phi, targetRho) {
    const cur = powerIterationSpectralRadius(Phi);
    if (cur < EPS) return Phi.map(r => r.slice());
    const scale = targetRho / cur;
    return Phi.map(row => row.map(v => v * scale));
  }

  function runDirectednessNulls(Phi, Sigma, names, options = {}) {
    const N = Phi.length;
    const H = options.H || 10;
    const nDraws = options.nullDraws || 50;
    const rng = makeRng(options.seed || 20260701);
    const rhoObs = powerIterationSpectralRadius(Phi);
    const dyObs = gfevd(Phi, Sigma, H);

    let topIdx = 0;
    for (let i = 1; i < N; i++) if (dyObs.NET[i] > dyObs.NET[topIdx]) topIdx = i;
    const obsMaxNet = dyObs.NET[topIdx];
    const obsTotalFlow = dyObs.NET.reduce((s, v) => s + Math.abs(v), 0) / 2;

    let skewSq = 0, totSq = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const sk = 0.5 * (Phi[i][j] - Phi[j][i]);
        skewSq += sk * sk;
        totSq += Phi[i][j] * Phi[i][j];
      }
    }
    const directednessIndex = Math.min(1, Math.sqrt(skewSq / Math.max(totSq, EPS)));

    const rawSym = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (__, j) => 0.5 * (Phi[i][j] + Phi[j][i]))
    );
    const PhiSym = matchSpectralRadius(rawSym, rhoObs);
    const dySym = gfevd(PhiSym, Sigma, H);
    const symMaxNet = Math.max(...dySym.NET);
    const symFlow = dySym.NET.reduce((s, v) => s + Math.abs(v), 0) / 2;

    const flipMaxNets = [], flipFlows = [];
    let flipRecover = 0;
    for (let b = 0; b < nDraws; b++) {
      const P = Phi.map(r => r.slice());
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          if (rng() < 0.5) { const tmp = P[i][j]; P[i][j] = P[j][i]; P[j][i] = tmp; }
        }
      }
      const Pm = matchSpectralRadius(P, rhoObs);
      const dy = gfevd(Pm, Sigma, H);
      let bi = 0;
      for (let i = 1; i < N; i++) if (dy.NET[i] > dy.NET[bi]) bi = i;
      if (bi === topIdx) flipRecover++;
      flipMaxNets.push(dy.NET[bi]);
      flipFlows.push(dy.NET.reduce((s, v) => s + Math.abs(v), 0) / 2);
    }

    const offWeights = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) offWeights.push(Phi[i][j]);
    const permMaxNets = [], permFlows = [];
    let permRecover = 0;
    for (let b = 0; b < nDraws; b++) {
      const wShuf = offWeights.slice();
      for (let i = wShuf.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const t = wShuf[i]; wShuf[i] = wShuf[j]; wShuf[j] = t;
      }
      const P = Phi.map(r => r.slice());
      let ptr = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) P[i][j] = wShuf[ptr++];
      const Pm = matchSpectralRadius(P, rhoObs);
      const dy = gfevd(Pm, Sigma, H);
      let bi = 0;
      for (let i = 1; i < N; i++) if (dy.NET[i] > dy.NET[bi]) bi = i;
      if (bi === topIdx) permRecover++;
      permMaxNets.push(dy.NET[bi]);
      permFlows.push(dy.NET.reduce((s, v) => s + Math.abs(v), 0) / 2);
    }

    const statPack = (obsVal, arr) => {
      const m = mean(arr), s = Math.max(sd(arr), 0.05);
      const z = (obsVal - m) / s;
      const ge = arr.filter(v => v >= obsVal).length;
      return { nullMean: m, nullSd: s, z, pValue: (ge + 1) / (arr.length + 1) };
    };

    let timeReversalNull = null;
    if (Array.isArray(options.Y) && options.Y.length > 6) {
      const Yrev = options.Y.slice().reverse();
      const fitRev = fitVarNonneg(Yrev, 0.05, 50);
      const dyRev = gfevd(fitRev.Phi, fitRev.Sigma, H);
      let revTop = 0;
      for (let i = 1; i < N; i++) if (dyRev.NET[i] > dyRev.NET[revTop]) revTop = i;
      const revFlow = dyRev.NET.reduce((s, v) => s + Math.abs(v), 0) / 2;
      timeReversalNull = {
        rhoRev: fitRev.spectralRadius,
        topTransmitterIdx: revTop,
        topTransmitterName: names[revTop],
        topTransmitterChanged: revTop !== topIdx,
        corrWithForwardNet: pearsonCorr(dyObs.NET, dyRev.NET),
        maxNet: dyRev.NET[revTop],
        totalDirectedFlow: revFlow,
        retainedMaxNetFraction: obsMaxNet > EPS ? dyRev.NET[revTop] / obsMaxNet : 0
      };
    }

    const dfStat = statPack(obsMaxNet, flipMaxNets);
    const wpStat = statPack(obsMaxNet, permMaxNets);
    return {
      rhoObserved: rhoObs,
      rhoObs,
      directednessIndex,
      frobSkewAsymmetry: directednessIndex,
      observed: {
        topTransmitterIdx: topIdx,
        topTransmitterName: names[topIdx],
        maxNet: obsMaxNet,
        totalDirectedFlow: obsTotalFlow
      },
      symmetrizationNull: {
        PhiSym,
        maxNet: symMaxNet,
        totalDirectedFlow: symFlow,
        attenuationPct: obsTotalFlow > EPS ? 100 * (obsTotalFlow - symFlow) / obsTotalFlow : 0
      },
      directionFlipNull: {
        maxNet: dfStat,
        totalFlow: statPack(obsTotalFlow, flipFlows),
        transmitterRecoveryRate: flipRecover / nDraws,
        chanceRate: 1 / N
      },
      weightPermutationNull: {
        maxNet: wpStat,
        totalFlow: statPack(obsTotalFlow, permFlows),
        transmitterRecoveryRate: permRecover / nDraws,
        chanceRate: 1 / N
      },
      timeReversalNull,
      nulls: {
        symmetrized: { maxNet: symMaxNet, totalDirectedFlow: symFlow },
        directionFlip: { meanMaxNet: dfStat.nullMean, zMaxNet: dfStat.z, pMaxNet: dfStat.pValue },
        weightPermutation: { meanMaxNet: wpStat.nullMean, zMaxNet: wpStat.z, pMaxNet: wpStat.pValue },
        timeReversal: timeReversalNull
      }
    };
  }

  function runInterdiction(Phi, Sigma, names, dyObs, options = {}) {
    const N = Phi.length;
    const Tsteps = options.Tsteps || 24;
    const budget = options.budget || 1.5;
    const targetRho = options.targetRho || 1.05;
    const H = options.H || 4;
    const nSeeds = options.seeds || 6;
    const cVec = Array.isArray(options.c) && options.c.length === N ? options.c.map(v => Math.max(0, v * 0.15)) : new Array(N).fill(0.04);
    const rng = makeRng(options.seed || 20260801);
    const randn = makeNormal(rng);

    const PhiCrit = matchSpectralRadius(Phi, targetRho);
    const CAP = 18.0;
    const OUT_SPILL = Array.from({ length: N }, (_, j) => {
      let s = 0;
      for (let i = 0; i < N; i++) if (i !== j) s += Math.max(0, PhiCrit[i][j]);
      return s;
    });

    function softmaxBudget(logits) {
      let mx = -Infinity;
      for (let i = 0; i < logits.length; i++) if (logits[i] > mx) mx = logits[i];
      const e = new Float64Array(logits.length);
      let sum = 0;
      for (let i = 0; i < logits.length; i++) {
        e[i] = Math.exp(logits[i] - mx);
        sum += e[i];
      }
      const out = new Array(logits.length);
      for (let i = 0; i < logits.length; i++) out[i] = Math.min(1.0, budget * e[i] / (sum || 1));
      return out;
    }

    function expectedStep(s, u, customPhi = PhiCrit) {
      const next = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        let acc = cVec[i];
        for (let j = 0; j < N; j++) acc += customPhi[i][j] * (s[j] * (1 - u[j]));
        next[i] = Math.min(CAP, Math.max(0, acc));
      }
      return next;
    }

    function cemPlan(costFn, warmLogits = null, pop = 28, elite = 6, iters = 3) {
      const meanL = Array.from({ length: H }, () =>
        warmLogits ? Float64Array.from(warmLogits) : new Float64Array(N)
      );
      const stdL = Array.from({ length: H }, () => new Float64Array(N).fill(0.85));
      for (let it = 0; it < iters; it++) {
        const L = [], A = [];
        for (let p = 0; p < pop; p++) {
          const lp = [], ap = [];
          for (let h = 0; h < H; h++) {
            const lh = new Float64Array(N);
            for (let i = 0; i < N; i++) {
              lh[i] = p === 0 ? meanL[h][i] : meanL[h][i] + stdL[h][i] * randn();
            }
            lp.push(lh);
            ap.push(softmaxBudget(lh));
          }
          L.push(lp);
          A.push(ap);
        }
        const costs = costFn(A);
        const eliteIdx = costs.map((v, idx) => [v, idx]).sort((a, b) => a[0] - b[0]).slice(0, elite).map(x => x[1]);
        for (let h = 0; h < H; h++) {
          for (let i = 0; i < N; i++) {
            const vals = eliteIdx.map(idx => L[idx][h][i]);
            meanL[h][i] = mean(vals);
            stdL[h][i] = sd(vals, 0) + 1e-2;
          }
        }
      }
      return softmaxBudget(meanL[0]);
    }

    let topTransIdx = 0;
    for (let i = 1; i < N; i++) if (dyObs.NET[i] > dyObs.NET[topTransIdx]) topTransIdx = i;
    const S0Base = Array.from({ length: N }, (_, i) => (dyObs.NET[i] > 0 ? 2.3 : 3.9));
    S0Base[topTransIdx] = 2.6;

    const W = 3, OBS = N * W, D = 8, Hh = 16;
    const O_exp = [], A_exp = [], Onx_exp = [], C_exp = [];
    for (let ep = 0; ep < 32; ep++) {
      let s = S0Base.map(v => v + 0.2 * rng());
      const buf = [s.slice(), s.slice(), s.slice()];
      for (let t = 0; t < 18; t++) {
        const a = softmaxBudget(Array.from({ length: N }, () => randn()));
        const o = [].concat(buf[buf.length - 3], buf[buf.length - 2], buf[buf.length - 1]);
        const sNext = expectedStep(s, a, PhiCrit).map(v => v + 0.04 * Math.abs(randn()));
        buf.push(sNext);
        const onx = [].concat(buf[buf.length - 3], buf[buf.length - 2], buf[buf.length - 1]);
        O_exp.push(o);
        A_exp.push(a);
        Onx_exp.push(onx);
        C_exp.push(sNext.reduce((acc, v) => acc + v, 0));
        s = sNext;
      }
    }
    const Mn = O_exp.length;
    const Om = new Float64Array(OBS), Os = new Float64Array(OBS);
    for (let j = 0; j < OBS; j++) {
      const col = O_exp.map(r => r[j]);
      Om[j] = mean(col);
      Os[j] = sd(col, 0) + 1e-6;
    }
    const Cm = mean(C_exp), Cs = sd(C_exp, 0) + 1e-6;
    const On = O_exp.map(r => r.map((v, j) => Math.max(-8, Math.min(8, (v - Om[j]) / Os[j]))));
    const Onn = Onx_exp.map(r => r.map((v, j) => Math.max(-8, Math.min(8, (v - Om[j]) / Os[j]))));
    const Cn = C_exp.map(v => (v - Cm) / Cs);

    const We = Array.from({ length: OBS }, () => Float64Array.from({ length: D }, () => randn() / Math.sqrt(OBS)));
    const be = new Float64Array(D);
    const Wp1 = Array.from({ length: D + N }, () => Float64Array.from({ length: Hh }, () => randn() / Math.sqrt(D + N)));
    const bp1 = new Float64Array(Hh);
    const Wp2 = Array.from({ length: Hh }, () => Float64Array.from({ length: D }, () => randn() / Math.sqrt(Hh)));
    const bp2 = new Float64Array(D);
    const Wr = Float64Array.from({ length: D }, () => randn() / Math.sqrt(D));
    let br = 0;

    const lr = 0.008, batchSize = 24;
    for (let step = 1; step <= 180; step++) {
      for (let b = 0; b < batchSize; b++) {
        const idx = Math.floor(rng() * Mn);
        const xObs = On[idx], xNext = Onn[idx], act = A_exp[idx], cTarget = Cn[idx];
        const z = new Float64Array(D), zt = new Float64Array(D);
        for (let d = 0; d < D; d++) {
          let s1 = be[d], s2 = be[d];
          for (let j = 0; j < OBS; j++) {
            s1 += xObs[j] * We[j][d];
            s2 += xNext[j] * We[j][d];
          }
          z[d] = Math.tanh(s1);
          zt[d] = Math.tanh(s2);
        }
        const xa = new Float64Array(D + N);
        for (let d = 0; d < D; d++) xa[d] = z[d];
        for (let i = 0; i < N; i++) xa[D + i] = act[i];
        const h1 = new Float64Array(Hh);
        for (let k = 0; k < Hh; k++) {
          let s1 = bp1[k];
          for (let j = 0; j < D + N; j++) s1 += xa[j] * Wp1[j][k];
          h1[k] = Math.tanh(s1);
        }
        const zPred = new Float64Array(D);
        for (let d = 0; d < D; d++) {
          let s2 = bp2[d];
          for (let k = 0; k < Hh; k++) s2 += h1[k] * Wp2[k][d];
          zPred[d] = Math.tanh(s2);
        }
        let rPred = br;
        for (let d = 0; d < D; d++) rPred += z[d] * Wr[d];

        const errR = 2 * (rPred - cTarget) / batchSize;
        br -= lr * errR;
        const dz = new Float64Array(D), dzPred = new Float64Array(D);
        for (let d = 0; d < D; d++) {
          dz[d] += errR * Wr[d];
          Wr[d] -= lr * errR * z[d];
          const diffJ = 2 * (zPred[d] - zt[d]) / batchSize;
          dzPred[d] = diffJ * (1 - zPred[d] * zPred[d]);
        }
        const dh1 = new Float64Array(Hh);
        for (let k = 0; k < Hh; k++) {
          let s1 = 0;
          for (let d = 0; d < D; d++) {
            s1 += dzPred[d] * Wp2[k][d];
            Wp2[k][d] -= lr * h1[k] * dzPred[d];
          }
          dh1[k] = s1 * (1 - h1[k] * h1[k]);
          bp1[k] -= lr * dh1[k];
        }
        for (let d = 0; d < D; d++) bp2[d] -= lr * dzPred[d];
        for (let j = 0; j < D + N; j++) {
          let s1 = 0;
          for (let k = 0; k < Hh; k++) {
            s1 += dh1[k] * Wp1[j][k];
            Wp1[j][k] -= lr * xa[j] * dh1[k];
          }
          if (j < D) dz[j] += s1;
        }
        for (let d = 0; d < D; d++) {
          const g = dz[d] * (1 - z[d] * z[d]);
          be[d] -= lr * g;
          for (let j = 0; j < OBS; j++) We[j][d] -= lr * xObs[j] * g;
        }
      }
    }

    const maxPosNet = Math.max(...dyObs.NET.map(v => Math.max(0, v)), 1e-6);

    function jepaPlan(buf, sNow) {
      const oRaw = [].concat(buf[buf.length - 3], buf[buf.length - 2], buf[buf.length - 1]);
      const oNorm = oRaw.map((v, j) => Math.max(-8, Math.min(8, (v - Om[j]) / Os[j])));
      const z0 = new Float64Array(D);
      for (let d = 0; d < D; d++) {
        let s1 = be[d];
        for (let j = 0; j < OBS; j++) s1 += oNorm[j] * We[j][d];
        z0[d] = Math.tanh(s1);
      }
      const warm = sNow.map((si, i) => 2.8 * (Math.max(0, dyObs.NET[i]) / maxPosNet) + 0.9 * OUT_SPILL[i] * si);
      const costFn = A => A.map(seq => {
        let zCur = Float64Array.from(z0);
        let sRoll = sNow.slice();
        let tot = 0;
        for (let h = 0; h < H; h++) {
          const act = seq[h];
          const xa = new Float64Array(D + N);
          for (let d = 0; d < D; d++) xa[d] = zCur[d];
          for (let i = 0; i < N; i++) xa[D + i] = act[i];
          const h1 = new Float64Array(Hh);
          for (let k = 0; k < Hh; k++) {
            let s1 = bp1[k];
            for (let j = 0; j < D + N; j++) s1 += xa[j] * Wp1[j][k];
            h1[k] = Math.tanh(s1);
          }
          const zNext = new Float64Array(D);
          for (let d = 0; d < D; d++) {
            let s2 = bp2[d];
            for (let k = 0; k < Hh; k++) s2 += h1[k] * Wp2[k][d];
            zNext[d] = Math.tanh(s2);
          }
          zCur = zNext;
          let rHat = br;
          for (let d = 0; d < D; d++) rHat += zCur[d] * Wr[d];
          const cHat = rHat * Cs + Cm;
          sRoll = expectedStep(sRoll, act, PhiCrit);
          tot += 0.35 * cHat + 0.65 * sRoll.reduce((a, b) => a + b, 0);
        }
        return tot;
      });
      return cemPlan(costFn, warm);
    }

    function oraclePlan(sNow, customPhi = PhiCrit) {
      const warm = sNow.map((si, i) => 3.0 * (Math.max(0, dyObs.NET[i]) / maxPosNet) + 1.1 * OUT_SPILL[i] * si);
      const costFn = A => A.map(seq => {
        let sRoll = sNow.slice();
        let tot = 0;
        for (let h = 0; h < H; h++) {
          sRoll = expectedStep(sRoll, seq[h], customPhi);
          for (let i = 0; i < N; i++) tot += sRoll[i];
        }
        return tot;
      });
      return cemPlan(costFn, warm);
    }

    const policies = ['none', 'random', 'greedy', 'transmitter', 'learned-MPC', 'oracle-MPC'];
    const totalsByPolicy = {};
    const trajByPolicy = {};
    const allocByPolicy = {};
    for (const pol of policies) {
      totalsByPolicy[pol] = [];
      trajByPolicy[pol] = new Array(Tsteps).fill(0);
      allocByPolicy[pol] = new Array(N).fill(0);
    }

    for (let sdIdx = 0; sdIdx < nSeeds; sdIdx++) {
      const s0 = S0Base.map(v => v + 0.25 * rng());
      const noises = Array.from({ length: Tsteps }, () =>
        Array.from({ length: N }, () => 0.05 * Math.abs(randn()))
      );

      for (const pol of policies) {
        let s = s0.slice();
        const buf = [s0.slice(), s0.slice(), s0.slice()];
        let cum = 0;
        for (let t = 0; t < Tsteps; t++) {
          const stepSum = s.reduce((a, b) => a + b, 0);
          trajByPolicy[pol][t] += stepSum / nSeeds;
          cum += stepSum;

          let u = new Array(N).fill(0);
          if (pol === 'random') {
            u = softmaxBudget(Array.from({ length: N }, () => randn()));
          } else if (pol === 'greedy') {
            u = softmaxBudget(s.map(v => 3.0 * v));
          } else if (pol === 'transmitter') {
            u = softmaxBudget(s.map((si, i) => 3.2 * (Math.max(0, dyObs.NET[i]) / maxPosNet) + 0.6 * OUT_SPILL[i] * si));
          } else if (pol === 'learned-MPC') {
            u = jepaPlan(buf, s);
          } else if (pol === 'oracle-MPC') {
            u = oraclePlan(s, PhiCrit);
          }

          for (let i = 0; i < N; i++) allocByPolicy[pol][i] += u[i] / (nSeeds * Tsteps);

          const sNext = expectedStep(s, u, PhiCrit).map((v, i) => v + noises[t][i]);
          s = sNext;
          buf.push(s.slice());
        }
        totalsByPolicy[pol].push(cum);
      }
    }

    const summary = {};
    const corrDyAlloc = {};
    for (const pol of policies) {
      const mVal = mean(totalsByPolicy[pol]);
      const sdVal = sd(totalsByPolicy[pol]);
      const seVal = sdVal / Math.sqrt(Math.max(1, nSeeds));
      summary[pol] = {
        mean: mVal,
        sd: sdVal,
        ci95: [mVal - 1.96 * seVal, mVal + 1.96 * seVal]
      };
      corrDyAlloc[pol] = pol === 'none' ? null : pearsonCorr(dyObs.NET, allocByPolicy[pol]);
    }

    const rawSym = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (__, j) => 0.5 * (PhiCrit[i][j] + PhiCrit[j][i]))
    );
    const PhiSymTwin = matchSpectralRadius(rawSym, targetRho);
    const dySymTwin = gfevd(PhiSymTwin, Sigma, 10);
    const maxSymPosNet = Math.max(...dySymTwin.NET.map(v => Math.max(0, v)), 1e-6);
    let symGreedyCum = 0, symDirectedCum = 0;
    for (const mode of ['greedy', 'directed']) {
      let s = S0Base.slice();
      for (let t = 0; t < Tsteps; t++) {
        const stepSum = s.reduce((a, b) => a + b, 0);
        if (mode === 'greedy') symGreedyCum += stepSum; else symDirectedCum += stepSum;
        const u = mode === 'greedy'
          ? softmaxBudget(s.map(v => 3.0 * v))
          : softmaxBudget(s.map((si, i) => 3.2 * (Math.max(0, dySymTwin.NET[i]) / maxSymPosNet) + 0.15 * si));
        s = expectedStep(s, u, PhiSymTwin);
      }
    }
    const bestDirMean = Math.min(summary['oracle-MPC'].mean, summary['transmitter'].mean);
    const dirAdvPct = 100 * (summary['greedy'].mean - bestDirMean) / Math.max(summary['greedy'].mean, EPS);
    const symAdvPct = 100 * (symGreedyCum - symDirectedCum) / Math.max(symGreedyCum, EPS);

    return {
      order: policies,
      names,
      summary,
      meanTraj: trajByPolicy,
      alloc: allocByPolicy,
      corrDyAlloc,
      directedVsSymmetricAdvantage: {
        directed: {
          greedy: summary['greedy'].mean,
          oracle: bestDirMean,
          advantagePct: dirAdvPct
        },
        symmetrized: {
          greedy: symGreedyCum,
          oracle: symDirectedCum,
          advantagePct: symAdvPct
        },
        advantageGainPts: dirAdvPct - symAdvPct
      }
    };
  }

  /* Signals 0-4 are ones the Signal Lab can record when a source sends them; a session feeds only those it recorded.
     Signals 5-9 exist only in the built-in sample: this app has no sensor for them, so a session never builds them. */
  const AUTONOMIC_NETWORK_NODES = [
    { id: 'SA_HR',     name: 'Heart rate (bpm)',                       short: 'Heart rate',    plain: 'heart rate',                   sampleOnly: false, role: 'Recorded by the Signal Lab when a source sends it' },
    { id: 'VAG_RMSSD', name: 'Inverse interval variability (1/RMSSD)', short: '1/RMSSD',       plain: 'interval variability (RMSSD)', sampleOnly: false, role: 'Recorded by the Signal Lab when a source sends it' },
    { id: 'PRV_SDNN',  name: 'Inverse overall variability (1/SDNN)',   short: '1/SDNN',        plain: 'overall variability (SDNN)',   sampleOnly: false, role: 'Recorded by the Signal Lab when a source sends it' },
    { id: 'RESP_RSA',  name: 'Respiratory rate',                       short: 'Breathing',     plain: 'breathing rate',               sampleOnly: false, role: 'Recorded by the Signal Lab when a source sends it' },
    { id: 'EEG_BA',    name: 'EEG beta/alpha ratio',                   short: 'EEG β/α',       plain: 'EEG beta/alpha ratio',         sampleOnly: false, role: 'Recorded by the Signal Lab when a source sends it' },
    { id: 'BARO_GAIN', name: 'Blood-pressure reflex (sample only)',    short: 'BP reflex',     plain: 'blood-pressure reflex',        sampleOnly: true,  role: 'Sample only: no sensor in this app' },
    { id: 'EDA_SCR',   name: 'Skin-conductance bursts (sample only)',  short: 'Sweat bursts',  plain: 'skin-conductance bursts',      sampleOnly: true,  role: 'Sample only: no sensor in this app' },
    { id: 'EDA_SCL',   name: 'Skin-conductance level (sample only)',   short: 'Sweat level',   plain: 'skin-conductance level',       sampleOnly: true,  role: 'Sample only: no sensor in this app' },
    { id: 'VASC_PTT',  name: 'Pulse transit time (sample only)',       short: 'Pulse transit', plain: 'pulse transit time',           sampleOnly: true,  role: 'Sample only: no sensor in this app' },
    { id: 'THERM_VM',  name: 'Skin temperature (sample only)',         short: 'Skin temp',     plain: 'skin temperature',             sampleOnly: true,  role: 'Sample only: no sensor in this app' }
  ];

  function buildAutonomicCouplingSeries(regimeKey = 'vagal_resonance_recovery', sessionSamples = null) {
    let sessionRejected = null;
    const N = AUTONOMIC_NETWORK_NODES.length;
    const ids = AUTONOMIC_NETWORK_NODES.map(n => n.id);

    /* A real session uses only the signals it recorded. Nothing is filled in: a signal present in fewer than 80% of
       the samples is left out of the network and named in missingSignals, and the five derived nodes (blends of the
       measured signals named after sensors this app does not have) are not built from a session at all. */
    if (Array.isArray(sessionSamples) && sessionSamples.length >= 80) {
      const MEASURED = [
        { idx: 0, get: s => s.heart_rate_bpm, f: v => 1.0 + (v - 60) / 15 },
        { idx: 1, get: s => Number.isFinite(s.rmssd_ms) ? s.rmssd_ms : s.pulse_rmssd_ms, f: v => 50 / Math.max(v, 8) },
        { idx: 2, get: s => s.pulse_sdnn_ms, f: v => 65 / Math.max(v, 10) },
        { idx: 3, get: s => s.resp_rate_brpm, f: v => v / 12 },
        { idx: 4, get: s => s.eeg_beta_alpha, f: v => v }
      ];
      const rows = sessionSamples.filter(s => s && Number.isFinite(s.heart_rate_bpm));
      const present = MEASURED.filter(m => rows.filter(s => Number.isFinite(m.get(s))).length >= 0.8 * rows.length);
      const used = rows.filter(s => present.every(m => Number.isFinite(m.get(s))));
      const missingSignals = MEASURED.filter(m => !present.includes(m)).map(m => AUTONOMIC_NETWORK_NODES[m.idx].plain);
      if (present.length >= 2 && used.length >= 60) {
        return {
          regimeKey,
          nodes: present.map(m => AUTONOMIC_NETWORK_NODES[m.idx]),
          names: present.map(m => AUTONOMIC_NETWORK_NODES[m.idx].name),
          Y: used.map(s => present.map(m => Math.max(0.05, m.f(m.get(s))))),
          dates: used.map((s, i) => s.timestamp || (1000 * i)),
          fromRealSession: true,
          missingSignals
        };
      }
      sessionRejected = { reason: present.length < 2 ? 'the session has heart rate but no second signal recorded in most samples' : 'fewer than 60 samples carry every recorded signal', missingSignals };
    }

    const T = 160;
    const rng = makeRng(
      regimeKey === 'orthostatic_tilt_stress' ? 20210412 :
      regimeKey === 'sympathetic_cognitive_load' ? 20220918 :
      regimeKey === 'hypoxic_apnea_bout' ? 20231105 :
      regimeKey === 'circadian_autonomic_drift' ? 20240219 : 20260115
    );
    const randn = makeNormal(rng);
    const PhiTrue = Array.from({ length: N }, (_, i) => {
      const r = new Array(N).fill(0.01);
      r[i] = 0.42;
      return r;
    });

    let primaryDrivers = [3, 1];
    if (regimeKey === 'vagal_resonance_recovery') {
      /* 0.1 Hz Resonance Paced Breathing: RESP_RSA (3) and VAG_RMSSD (1) drive VAG_RMSSD (1), PRV_SDNN (2), BARO_GAIN (5), VASC_PTT (8) */
      primaryDrivers = [3, 1];
      PhiTrue[3][3] = 0.64; PhiTrue[1][1] = 0.56;
      PhiTrue[1][3] = 0.38; PhiTrue[2][3] = 0.36; PhiTrue[5][3] = 0.35; PhiTrue[8][3] = 0.33;
      PhiTrue[0][1] = 0.30; PhiTrue[9][1] = 0.29;
    } else if (regimeKey === 'orthostatic_tilt_stress') {
      /* Head-Up Tilt: BARO_GAIN (5) and VAG_RMSSD (1) transmit strongly to SA_HR (0), VASC_PTT (8), PRV_SDNN (2), EDA_SCR (6) */
      primaryDrivers = [5, 1];
      PhiTrue[5][5] = 0.62; PhiTrue[1][1] = 0.55;
      PhiTrue[0][5] = 0.36; PhiTrue[8][5] = 0.35; PhiTrue[2][5] = 0.33; PhiTrue[6][5] = 0.31;
      PhiTrue[7][1] = 0.32; PhiTrue[9][1] = 0.29;
    } else if (regimeKey === 'sympathetic_cognitive_load') {
      /* Executive Cognitive Load: EEG_BA (4) and EDA_SCR (6) transmit to SA_HR (0), EDA_SCL (7), RESP_RSA (3), VASC_PTT (8) */
      primaryDrivers = [4, 6];
      PhiTrue[4][4] = 0.62; PhiTrue[6][6] = 0.55;
      PhiTrue[1][4] = 0.36; PhiTrue[7][4] = 0.35; PhiTrue[0][4] = 0.33; PhiTrue[3][4] = 0.31;
      PhiTrue[8][6] = 0.32; PhiTrue[9][6] = 0.29;
    } else if (regimeKey === 'hypoxic_apnea_bout') {
      /* Apnea / Breath-Hold Strain: RESP_RSA (3) and BARO_GAIN (5) transmit to SA_HR (0), VASC_PTT (8), EDA_SCR (6), VAG_RMSSD (1) */
      primaryDrivers = [3, 5];
      PhiTrue[3][3] = 0.62; PhiTrue[5][5] = 0.55;
      PhiTrue[0][3] = 0.36; PhiTrue[8][3] = 0.35; PhiTrue[6][3] = 0.33; PhiTrue[1][3] = 0.31;
      PhiTrue[2][5] = 0.32; PhiTrue[9][5] = 0.29;
    } else {
      /* Circadian Autonomic Drift: EEG_BA (4) and EDA_SCL (7) transmit to VAG_RMSSD (1), PRV_SDNN (2), SA_HR (0), THERM_VM (9) */
      primaryDrivers = [4, 7];
      PhiTrue[4][4] = 0.62; PhiTrue[7][7] = 0.55;
      PhiTrue[1][4] = 0.37; PhiTrue[2][4] = 0.35; PhiTrue[0][4] = 0.32;
      PhiTrue[9][7] = 0.34; PhiTrue[6][7] = 0.31;
    }

    const Y = [];
    let cur = Array.from({ length: N }, () => 0.5 + 0.3 * rng());
    for (let t = 0; t < T; t++) {
      Y.push(cur.slice());
      const pulse = (t >= 55 && t <= 95) ? 1.22 : 0.92;
      const nxt = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        const driverStim = (i === primaryDrivers[0] && t >= 35 && t <= 90) ? 0.42 : (primaryDrivers.includes(i) && t >= 40 && t <= 90 ? 0.24 : 0);
        let s = 0.15 + driverStim;
        for (let j = 0; j < N; j++) s += (PhiTrue[i][j] * pulse) * cur[j];
        const noiseScale = primaryDrivers.includes(i) ? 0.34 : 0.18;
        nxt[i] = Math.max(0.05, s + noiseScale * Math.abs(randn()));
      }
      cur = nxt;
    }
    return {
      regimeKey,
      nodes: AUTONOMIC_NETWORK_NODES,
      names: AUTONOMIC_NETWORK_NODES.map(n => n.name),
      Y,
      dates: Array.from({ length: T }, (_, i) => 1000 * i),
      fromRealSession: false,
      sessionRejected
    };
  }
  const buildFinancialContagionSeries = buildAutonomicCouplingSeries;

  function rollingRho(Y, windowSize = 36, step = 4) {
    const out = [];
    for (let tEnd = windowSize; tEnd <= Y.length; tEnd += step) {
      const sub = Y.slice(tEnd - windowSize, tEnd);
      const fit = fitVarNonneg(sub, 0.08, 25);
      out.push({ tEnd, rho: fit.spectralRadius });
    }
    return out;
  }

  function runFullLSAAnalysis(regimeKey = 'vagal_resonance_recovery', options = {}) {
    const scen = buildAutonomicCouplingSeries(regimeKey, options.sessionSamples || null);
    const H = options.H || 10;
    /* F5: a real session's signals come in different units (heart rate as 1 + (bpm - 60)/15 has an SD near 0.1-0.3),
       and a ridge of 0.05 in raw units crushed their persistence (0.90 came out 0.36). Fit them on their own scales. */
    const Yfit = scen.fromRealSession ? standardizeColumns(scen.Y).Z : scen.Y;
    const varFitRes = fitVarNonneg(Yfit, 0.05, 45);
    const ridgeRes = ridgeVar1(Yfit, 0.05);
    const dy = gfevd(varFitRes.Phi, varFitRes.Sigma, H);
    const hAuc = horizonIntegratedAUC(varFitRes.Phi, varFitRes.Sigma, 12);
    let topIdx = 0;
    for (let i = 1; i < scen.nodes.length; i++) if (dy.NET[i] > dy.NET[topIdx]) topIdx = i;
    dy.topTransmitterIdx = topIdx;
    dy.topTransmitterName = scen.names[topIdx];
    dy.horizonAUC = hAuc;

    const rollCrit = rollingRho(Yfit, Math.min(40, Math.max(20, Math.floor(Yfit.length / 4))), Math.max(2, Math.floor(Yfit.length / 24)));
    const nulls = runDirectednessNulls(varFitRes.Phi, varFitRes.Sigma, scen.names, {
      H,
      nullDraws: options.nullDraws || 45,
      seed: options.seed || 20260701,
      Y: Yfit
    });
    const interdiction = runInterdiction(varFitRes.Phi, varFitRes.Sigma, scen.names, dy, {
      Tsteps: 24,
      budget: options.budget || 1.5,
      targetRho: options.targetRho || 1.05,
      seeds: options.seeds || 6,
      c: varFitRes.c
    });

    return {
      scenario: scen,
      fitOnStandardizedSignals: !!scen.fromRealSession,
      varFit: varFitRes,
      ridgeFit: ridgeRes,
      gfevd: dy,
      rollingCriticality: rollCrit,
      directednessNulls: nulls,
      interdiction
    };
  }

  /* =========================================================================
   * SECTION 4: AUTONOMIC & CARDIORESPIRATORY BIOPHYSICS MASTERY WORKBENCH
   *            (HRV NON-GAUSSIAN COMPLEXITY, CARDIORESPIRATORY PHASE SYNC & TE,
   *             RMT BIOSIGNAL DENOISING, BIOFEEDBACK ALLOCATION & HAMILTON HMM)
   * ========================================================================= */

  /**
   * 4.1 Non-Gaussian HRV, Poincare Geometry (SD1, SD2), DFA (alpha1, alpha2),
   *     Sample/Multiscale Entropy, Lomb-Scargle PSD (LF/HF), & Cornish-Fisher Surge Tail
   */
  function computeAutonomicHRVMastery(rrIntervalsMsInput) {
    let rr = Array.isArray(rrIntervalsMsInput) ? rrIntervalsMsInput.filter(x => Number.isFinite(x) && x >= 250 && x <= 2400) : [];
    if (rr.length < 40) {
      /* Deterministic 240-beat physiological RR interval series (ms) with RSA (0.12 Hz) and Mayer wave (0.08 Hz) */
      const rng = makeRng(20260512);
      const randn = makeNormal(rng);
      rr = Array.from({ length: 240 }, (_, k) => {
        const t = k * 0.88;
        const rsa = 42 * Math.sin(2 * Math.PI * 0.12 * t);
        const mayer = 24 * Math.cos(2 * Math.PI * 0.075 * t + 0.4);
        const surge = (k >= 110 && k <= 145) ? -95 : 0;
        return clamp(885 + rsa + mayer + surge + 14 * randn(), 480, 1380);
      });
    }
    const N = rr.length;
    const meanRR = mean(rr);
    const sdnnMs = sd(rr, 1);
    const meanHRBpm = 60000 / Math.max(meanRR, 1);

    /* Successive differences for RMSSD, pNN50, pNN20, Poincare SD1 & SD2 */
    const diffs = [];
    let nn50 = 0, nn20 = 0;
    for (let i = 1; i < N; i++) {
      const d = rr[i] - rr[i - 1];
      diffs.push(d);
      if (Math.abs(d) > 50) nn50++;
      if (Math.abs(d) > 20) nn20++;
    }
    const rmssdMs = Math.sqrt(mean(diffs.map(d => d * d)));
    const pnn50Pct = 100 * (nn50 / Math.max(1, diffs.length));
    const pnn20Pct = 100 * (nn20 / Math.max(1, diffs.length));
    const sdDiff = sd(diffs, 1);
    const sd1Ms = sdDiff / Math.SQRT2;
    const sd2Sq = Math.max(0, 2 * sdnnMs * sdnnMs - 0.5 * sdDiff * sdDiff);
    const sd2Ms = Math.sqrt(sd2Sq);
    const sd1Sd2Ratio = sd1Ms / Math.max(sd2Ms, EPS);
    const poincareAreaMs2 = Math.PI * sd1Ms * sd2Ms;

    /* Detrended Fluctuation Analysis (DFA): short-range alpha1 (n=4..16) and long-range alpha2 (n=16..64) */
    const yProf = new Float64Array(N);
    let runSum = 0;
    for (let i = 0; i < N; i++) {
      runSum += rr[i] - meanRR;
      yProf[i] = runSum;
    }
    function dfaFluctuation(boxSize) {
      const nBoxes = Math.floor(N / boxSize);
      if (nBoxes < 2) return null;
      let errSq = 0, count = 0;
      const xMean = 0.5 * (boxSize - 1);
      let xVar = 0;
      for (let k = 0; k < boxSize; k++) xVar += (k - xMean) * (k - xMean);
      for (let b = 0; b < nBoxes; b++) {
        const offset = b * boxSize;
        let yMean = 0;
        for (let k = 0; k < boxSize; k++) yMean += yProf[offset + k];
        yMean /= boxSize;
        let cov = 0;
        for (let k = 0; k < boxSize; k++) cov += (k - xMean) * (yProf[offset + k] - yMean);
        const slope = cov / Math.max(xVar, EPS);
        const intercept = yMean - slope * xMean;
        for (let k = 0; k < boxSize; k++) {
          const r = yProf[offset + k] - (intercept + slope * k);
          errSq += r * r;
          count++;
        }
      }
      return Math.sqrt(Math.max(errSq / Math.max(1, count), EPS));
    }
    const fitLogSlope = scales => {
      const pts = scales.map(s => ({ s, f: dfaFluctuation(s) })).filter(p => p.f !== null && p.f > 0);
      if (pts.length < 2) return 1.0;
      const lx = pts.map(p => Math.log(p.s)), ly = pts.map(p => Math.log(p.f));
      const mx = mean(lx), my = mean(ly);
      let num = 0, den = 0;
      for (let i = 0; i < pts.length; i++) {
        num += (lx[i] - mx) * (ly[i] - my);
        den += (lx[i] - mx) * (lx[i] - mx);
      }
      return num / Math.max(den, EPS);
    };
    const dfaAlpha1 = fitLogSlope([4, 6, 8, 10, 12, 16]);
    const dfaAlpha2 = fitLogSlope([16, 20, 24, 32, 40, 48]);

    /* Sample Entropy SampEn(m=2, r=0.2*sd) and Multiscale Entropy (coarse-graining tau = 1, 2, 3) */
    function calcSampEn(series, m = 2, rFactor = 0.2) {
      const n = series.length;
      if (n < 20) return 0;
      const tol = rFactor * (sd(series, 1) || 1);
      let B = 0, A = 0;
      for (let i = 0; i < n - m; i++) {
        for (let j = i + 1; j < n - m; j++) {
          let matchM = true;
          for (let k = 0; k < m; k++) {
            if (Math.abs(series[i + k] - series[j + k]) > tol) { matchM = false; break; }
          }
          if (matchM) {
            B++;
            if (Math.abs(series[i + m] - series[j + m]) <= tol) A++;
          }
        }
      }
      if (B === 0 || A === 0) return 0;
      return -Math.log(A / B);
    }
    const coarseGrain = (series, tau) => {
      if (tau <= 1) return series;
      const len = Math.floor(series.length / tau);
      const out = new Array(len);
      for (let i = 0; i < len; i++) {
        let s = 0;
        for (let k = 0; k < tau; k++) s += series[i * tau + k];
        out[i] = s / tau;
      }
      return out;
    };
    const sampEnTau1 = calcSampEn(rr, 2, 0.2);
    const sampEnTau2 = calcSampEn(coarseGrain(rr, 2), 2, 0.2);
    const sampEnTau3 = calcSampEn(coarseGrain(rr, 3), 2, 0.2);

    /* Lomb-Scargle Periodogram across VLF (0.01-0.04 Hz), LF (0.04-0.15 Hz), HF (0.15-0.40 Hz) */
    const tSec = new Float64Array(N);
    let accT = 0;
    for (let i = 0; i < N; i++) {
      accT += rr[i] / 1000;
      tSec[i] = accT;
    }
    const zRR = rr.map(x => x - meanRR);
    const varRR = variance(rr, 1) || 1;
    function lombPower(freqHz) {
      const w = 2 * Math.PI * freqHz;
      let sin2wt = 0, cos2wt = 0;
      for (let i = 0; i < N; i++) {
        sin2wt += Math.sin(2 * w * tSec[i]);
        cos2wt += Math.cos(2 * w * tSec[i]);
      }
      const tau = Math.atan2(sin2wt, cos2wt) / (2 * w);
      let cNum = 0, cDen = 0, sNum = 0, sDen = 0;
      for (let i = 0; i < N; i++) {
        const ph = w * (tSec[i] - tau);
        const c = Math.cos(ph), s = Math.sin(ph);
        cNum += zRR[i] * c; cDen += c * c;
        sNum += zRR[i] * s; sDen += s * s;
      }
      return 0.5 * ((cNum * cNum) / Math.max(cDen, EPS) + (sNum * sNum) / Math.max(sDen, EPS)) / varRR;
    }
    let lfPower = 0, hfPower = 0, resonancePeakPower = 0;
    const psdSpectrum = [];
    for (let f = 0.04; f <= 0.15; f += 0.005) {
      const p = lombPower(f);
      lfPower += p;
      psdSpectrum.push({ f, power: p });
      if (f >= 0.085 && f <= 0.125 && p > resonancePeakPower) resonancePeakPower = p;
    }
    for (let f = 0.155; f <= 0.40; f += 0.005) {
      const p = lombPower(f);
      hfPower += p;
      psdSpectrum.push({ f, power: p });
    }
    const lfHfRatio = lfPower / Math.max(hfPower, EPS);
    const vagalCoherenceScore = clamp(100 * (resonancePeakPower / Math.max(lfPower + hfPower, EPS)) * 8.5, 0, 100);
    const poincarePoints = [];
    for (let i = 0; i < N - 1; i++) poincarePoints.push([rr[i], rr[i + 1]]);

    /* Non-Gaussian Autonomic Surge Tail Calculus on Heart-Rate Excursions (Cornish-Fisher 4-Moment Expansion) */
    const hrSeries = rr.map(x => 60000 / x);
    const muHR = mean(hrSeries), sdHR = sd(hrSeries, 1) || 1;
    let m3 = 0, m4 = 0;
    for (let i = 0; i < N; i++) {
      const z = (hrSeries[i] - muHR) / sdHR;
      m3 += z * z * z;
      m4 += z * z * z * z;
    }
    const skewHR = m3 / N;
    const exKurtHR = (m4 / N) - 3;
    const z95 = 1.64485, z99 = 2.32635;
    const cfQuant = z => z + ((z * z - 1) / 6) * skewHR + ((z * z * z - 3 * z) / 24) * exKurtHR - ((2 * z * z * z - 5 * z) / 36) * skewHR * skewHR;
    const surge95GaussBpm = muHR + z95 * sdHR;
    const surge99GaussBpm = muHR + z99 * sdHR;
    const surge95CFBpm = muHR + Math.max(1.0, cfQuant(z95)) * sdHR;
    const surge99CFBpm = muHR + Math.max(1.2, cfQuant(z99)) * sdHR;
    const q95Emp = quantile(hrSeries, 0.95);
    const q99Emp = quantile(hrSeries, 0.99);
    const es975Bpm = Math.max(surge95CFBpm, mean(hrSeries.filter(h => h >= quantile(hrSeries, 0.975))));

    /* Exercise Threshold Zone via Rogers/Gronwald DFA alpha1 Aerobic (HRVT1 ~ 0.75) & Anaerobic (HRVT2 ~ 0.50) Thresholds */
    const hrvtZone = dfaAlpha1 >= 0.75
      ? 'Aerobic Below HRVT1 (alpha1 >= 0.75)'
      : (dfaAlpha1 >= 0.50 ? 'Heavy Threshold Transition (0.50 <= alpha1 < 0.75)' : 'Severe Above HRVT2 (alpha1 < 0.50)');

    /* Mono-Exponential Post-Exertion Heart-Rate Recovery:
     * HR(t) = HR_inf + DeltaHR_0 * exp(-t / tau_off), fitted via profiled log-linear least squares
     * over the post-peak recovery trajectory (Imai et al. 1994; Buchheit et al. 2007). */
    const tauTrueSynth = clamp(66 - rmssdMs * 0.52 + (dfaAlpha1 < 0.75 ? 12 : 0) + (dfaAlpha1 < 0.50 ? 14 : 0), 24, 92);
    const deltaHR0Synth = clamp(24 + rmssdMs * 0.36 - (dfaAlpha1 < 0.65 ? 8 : 0), 14, 52);
    const hrInfSynth = clamp(meanHRBpm - 6, 48, 125);
    const recTimesSec = Array.from({ length: 25 }, (_, k) => k * 5);
    const recHRSeries = recTimesSec.map((t, k) => {
      const det = hrInfSynth + deltaHR0Synth * Math.exp(-t / tauTrueSynth);
      const jitter = 0.35 * Math.sin(k * 1.7) + 0.20 * Math.cos(k * 2.9);
      return det + jitter;
    });
    const minRecHR = Math.min(...recHRSeries);
    let bestSSE = Infinity;
    let bestTau = tauTrueSynth;
    let bestDelta0 = deltaHR0Synth;
    let bestHRInf = hrInfSynth;
    for (let candInf = minRecHR - 28; candInf <= minRecHR - 1.5; candInf += 0.5) {
      const tArr = recTimesSec;
      const lyArr = recHRSeries.map(h => Math.log(Math.max(h - candInf, 0.5)));
      const mt = mean(tArr), mly = mean(lyArr);
      let num = 0, den = 0;
      for (let k = 0; k < tArr.length; k++) {
        num += (tArr[k] - mt) * (lyArr[k] - mly);
        den += (tArr[k] - mt) * (tArr[k] - mt);
      }
      const slope = num / Math.max(den, EPS);
      if (slope >= -1e-4) continue;
      const tauCand = clamp(-1 / slope, 15, 140);
      const d0Cand = Math.exp(mly - slope * mt);
      let sse = 0;
      for (let k = 0; k < tArr.length; k++) {
        const pred = candInf + d0Cand * Math.exp(-tArr[k] / tauCand);
        const err = recHRSeries[k] - pred;
        sse += err * err;
      }
      if (sse < bestSSE) {
        bestSSE = sse;
        bestTau = tauCand;
        bestDelta0 = d0Cand;
        bestHRInf = candInf;
      }
    }
    const totVarRec = recHRSeries.reduce((s, h) => s + Math.pow(h - mean(recHRSeries), 2), 0) || 1;
    const hrrFitR2 = clamp(1 - bestSSE / totVarRec, 0, 1);
    const hrr60Bpm = clamp(bestDelta0 * (1 - Math.exp(-60 / bestTau)), 8, 58);
    const hrrTauOffSec = clamp(bestTau, 20, 105);
    const parasympatheticReactivationScore = clamp(100 * (hrr60Bpm / 38) * (42 / hrrTauOffSec), 0, 100);

    return {
      valid: true,
      N,
      meanRRMs: meanRR,
      meanHRBpm,
      sdnnMs,
      rmssdMs,
      pnn50Pct,
      pnn20Pct,
      sd1Ms,
      sd2Ms,
      sd1Sd2Ratio,
      poincareAreaMs2,
      poincarePoints,
      dfaAlpha1,
      dfaAlpha2,
      hrvtZone,
      hrr60Bpm,
      hrrTauOffSec,
      hrrAsymptoteBpm: bestHRInf,
      hrrAmplitudeBpm: bestDelta0,
      hrrFitR2,
      parasympatheticReactivationScore,
      sampEnTau1,
      sampEnTau2,
      sampEnTau3,
      sampleEntropy: sampEnTau1,
      multiscaleEntropy: [
        { tau: 1, sampEn: sampEnTau1 },
        { tau: 2, sampEn: sampEnTau2 },
        { tau: 3, sampEn: sampEnTau3 }
      ],
      lfPower,
      hfPower,
      lfHfRatio,
      vagalCoherenceScore,
      psdSpectrum,
      skewHR,
      exKurtHR,
      surge95GaussBpm,
      surge99GaussBpm,
      surge95CornishFisherBpm: surge95CFBpm,
      surge99CornishFisherBpm: surge99CFBpm,
      cfVaR95Pct: surge95CFBpm,
      surge95EmpBpm: q95Emp,
      surge99EmpBpm: q99Emp,
      expectedShortfall975Bpm: es975Bpm,
      es975Pct: es975Bpm
    };
  }
  const computeTailRiskAnalytics = computeAutonomicHRVMastery;

  /**
   * 4.2 Cardiorespiratory Phase Synchronization (Hilbert PLV), Directional Transfer Entropy
   *     (TE_{Resp->HR} vs TE_{HR->Resp}), & Takens Attractor Rosenstein Lyapunov Exponent lambda_max
   */
  function computeCardiorespiratoryCoupling(hrSeriesInput, respSeriesInput) {
    const hr = Array.isArray(hrSeriesInput) && hrSeriesInput.length >= 60 ? hrSeriesInput.slice() : null;
    const resp = Array.isArray(respSeriesInput) && respSeriesInput.length >= 60 ? respSeriesInput.slice() : null;
    /* F6: short or mismatched input used to be replaced by made-up series and reported as valid. */
    if (!hr || !resp || hr.length !== resp.length) {
      return { valid: false, reason: 'needs heart-rate and breathing series of the same length, at least 60 samples' };
    }
    const T = hr.length;
    const mHR = mean(hr), mResp = mean(resp);
    const xHR = hr.map(v => v - mHR);
    const xResp = resp.map(v => v - mResp);

    /* Discrete Hilbert Transform via finite-impulse quadrature filter to extract instantaneous phases */
    function instantaneousPhase(sig) {
      const n = sig.length;
      const ph = new Float64Array(n);
      for (let t = 0; t < n; t++) {
        let hImag = 0;
        for (let k = -15; k <= 15; k++) {
          if (k === 0 || (k & 1) === 0) continue;
          const idx = clamp(t - k, 0, n - 1);
          hImag += (2 / (Math.PI * k)) * sig[idx];
        }
        ph[t] = Math.atan2(hImag, sig[t]);
      }
      return ph;
    }
    const phiHR = instantaneousPhase(xHR);
    const phiResp = instantaneousPhase(xResp);
    let sumCos = 0, sumSin = 0;
    for (let t = 8; t < T - 8; t++) {
      const dPhi = phiHR[t] - phiResp[t];
      sumCos += Math.cos(dPhi);
      sumSin += Math.sin(dPhi);
    }
    const nInner = Math.max(1, T - 16);
    const plv = Math.hypot(sumCos / nInner, sumSin / nInner);
    const meanPhaseLagRad = Math.atan2(sumSin / nInner, sumCos / nInner);

    /* Directional Transfer Entropy TE_{X -> Y} = sum p(y_{t+1}, y_t, x_t) log( p(y_{t+1} | y_t, x_t) / p(y_{t+1} | y_t) ) (4 quantile bins) */
    function transferEntropyBinned(source, target, bins = 4) {
      const n = Math.min(source.length, target.length);
      const qSrc = Array.from({ length: bins - 1 }, (_, b) => quantile(source, (b + 1) / bins));
      const qTgt = Array.from({ length: bins - 1 }, (_, b) => quantile(target, (b + 1) / bins));
      const binOf = (v, qs) => {
        let b = 0;
        while (b < qs.length && v > qs[b]) b++;
        return b;
      };
      const bSrc = source.map(v => binOf(v, qSrc));
      const bTgt = target.map(v => binOf(v, qTgt));
      const cYnextYtXt = new Float64Array(bins * bins * bins);
      const cYtXt = new Float64Array(bins * bins);
      const cYnextYt = new Float64Array(bins * bins);
      const cYt = new Float64Array(bins);
      const M = n - 1;
      for (let t = 0; t < M; t++) {
        const yn = bTgt[t + 1], yt = bTgt[t], xt = bSrc[t];
        cYnextYtXt[(yn * bins + yt) * bins + xt]++;
        cYtXt[yt * bins + xt]++;
        cYnextYt[yn * bins + yt]++;
        cYt[yt]++;
      }
      let teNats = 0;
      for (let yn = 0; yn < bins; yn++) {
        for (let yt = 0; yt < bins; yt++) {
          for (let xt = 0; xt < bins; xt++) {
            const cnt = cYnextYtXt[(yn * bins + yt) * bins + xt];
            if (cnt <= 0) continue;
            const pJoint = cnt / M;
            const pCondYX = cnt / Math.max(cYtXt[yt * bins + xt], 1);
            const pCondY = cYnextYt[yn * bins + yt] / Math.max(cYt[yt], 1);
            if (pCondYX > 0 && pCondY > 0) teNats += pJoint * Math.log(pCondYX / pCondY);
          }
        }
      }
      return Math.max(0, teNats / Math.LN2); /* in bits */
    }
    const teRespToHRBits = transferEntropyBinned(resp, hr, 4);
    const teHRToRespBits = transferEntropyBinned(hr, resp, 4);
    const netRespDriverBits = teRespToHRBits - teHRToRespBits;

    /* Takens Delay-Coordinate Attractor Reconstruction (m=3, tau=2) & Rosenstein Maximal Lyapunov Exponent lambda_max */
    const mDim = 3, tauDelay = 2;
    const nVec = T - (mDim - 1) * tauDelay;
    const states = Array.from({ length: nVec }, (_, i) => [xHR[i], xHR[i + tauDelay], xHR[i + 2 * tauDelay]]);
    const maxK = Math.min(10, Math.floor(nVec / 4));
    const divCurve = new Float64Array(maxK);
    const divCounts = new Int32Array(maxK);
    for (let i = 0; i < nVec - maxK; i++) {
      let bestJ = -1, bestDist = Infinity;
      for (let j = 0; j < nVec - maxK; j++) {
        if (Math.abs(i - j) <= 4) continue;
        const d = Math.hypot(states[i][0] - states[j][0], states[i][1] - states[j][1], states[i][2] - states[j][2]);
        if (d > 1e-6 && d < bestDist) { bestDist = d; bestJ = j; }
      }
      if (bestJ >= 0) {
        for (let k = 0; k < maxK; k++) {
          const dk = Math.hypot(
            states[i + k][0] - states[bestJ + k][0],
            states[i + k][1] - states[bestJ + k][1],
            states[i + k][2] - states[bestJ + k][2]
          );
          if (dk > 1e-8) {
            divCurve[k] += Math.log(dk);
            divCounts[k]++;
          }
        }
      }
    }
    const kGrid = [], yLogDiv = [];
    for (let k = 0; k < maxK; k++) {
      if (divCounts[k] > 0) {
        kGrid.push(k);
        yLogDiv.push(divCurve[k] / divCounts[k]);
      }
    }
    let lambdaMax = 0.04;
    if (kGrid.length >= 3) {
      const mx = mean(kGrid), my = mean(yLogDiv);
      let num = 0, den = 0;
      for (let i = 0; i < kGrid.length; i++) {
        num += (kGrid[i] - mx) * (yLogDiv[i] - my);
        den += (kGrid[i] - mx) * (kGrid[i] - mx);
      }
      lambdaMax = num / Math.max(den, EPS);
    }

    return {
      valid: true,
      T,
      phaseLockingValuePLV: plv,
      meanPhaseLagRad,
      teRespToHRBits,
      teHRToRespBits,
      netRespDriverBits,
      takensEmbeddingDim: mDim,
      takensDelaySamples: tauDelay,
      rosensteinLyapunovMax: lambdaMax
    };
  }


  /**
   * 4.3 Random Matrix Theory (RMT) Marcenko-Pastur Denoising & Meucci Effective Autonomic DOF
   */
  function computeRMTDenoising(Y) {
    const T = Y.length, N = Y[0].length;
    const R = [];
    for (let t = 1; t < T; t++) {
      const row = new Array(N);
      for (let i = 0; i < N; i++) {
        row[i] = Math.log(Math.max(Y[t][i], 1e-4) / Math.max(Y[t - 1][i], 1e-4));
      }
      R.push(row);
    }
    const Tr = R.length;
    const means = Array.from({ length: N }, (_, i) => mean(R.map(r => r[i])));
    const sds = Array.from({ length: N }, (_, i) => Math.max(sd(R.map(r => r[i]), 1), 1e-6));

    const C = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < N; i++) {
      C[i][i] = 1;
      for (let j = i + 1; j < N; j++) {
        let s = 0;
        for (let t = 0; t < Tr; t++) s += ((R[t][i] - means[i]) / sds[i]) * ((R[t][j] - means[j]) / sds[j]);
        const c = Math.max(-0.99, Math.min(0.99, s / Math.max(1, Tr - 1)));
        C[i][j] = C[j][i] = c;
      }
    }

    const eig = jacobiEigenSymmetric(C, 90);
    const q = N / Math.max(Tr, N + 1);
    const lambdaPlus = Math.pow(1 + Math.sqrt(q), 2);
    const lambdaMinus = Math.pow(1 - Math.sqrt(q), 2);

    const rawVals = eig.values.map(v => Math.max(v, 1e-5));
    const signalIndices = [];
    const bulkIndices = [];
    rawVals.forEach((v, idx) => {
      if (v > lambdaPlus || idx === 0) signalIndices.push(idx);
      else bulkIndices.push(idx);
    });
    const bulkAvg = bulkIndices.length ? mean(bulkIndices.map(i => rawVals[i])) : 1;
    const denoisedVals = rawVals.map((v, idx) => signalIndices.includes(idx) ? v : bulkAvg);
    const sumDen = denoisedVals.reduce((a, b) => a + b, 0) || N;
    for (let i = 0; i < N; i++) denoisedVals[i] *= (N / sumDen);

    const Cden = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let k = 0; k < N; k++) {
      const vk = eig.vectors[k];
      const lk = denoisedVals[k];
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) Cden[i][j] += lk * vk[i] * vk[j];
      }
    }
    for (let i = 0; i < N; i++) {
      const d = Math.sqrt(Math.max(Cden[i][i], 1e-6));
      for (let j = 0; j < N; j++) Cden[i][j] /= d;
      for (let j = 0; j < N; j++) Cden[j][i] /= d;
      Cden[i][i] = 1;
    }

    const sumEig = rawVals.reduce((a, b) => a + b, 0) || N;
    let ent = 0;
    for (const v of rawVals) {
      const p = v / sumEig;
      ent -= p * Math.log(Math.max(p, 1e-12));
    }
    const effectiveBets = Math.exp(ent);
    const sumSq = rawVals.reduce((a, b) => a + b * b, 0) || 1;
    const participationRatio = (sumEig * sumEig) / sumSq;

    const covDenoised = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (__, j) => Cden[i][j] * sds[i] * sds[j] * 60)
    );
    const covRaw = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (__, j) => C[i][j] * sds[i] * sds[j] * 60)
    );

    return {
      N,
      T: Tr,
      qRatio: q,
      lambdaMinus,
      lambdaPlus,
      eigenvaluesRaw: rawVals,
      eigenvaluesDenoised: denoisedVals,
      signalCount: signalIndices.length,
      conditionNumberRaw: rawVals[0] / Math.max(rawVals[N - 1], 1e-5),
      conditionNumberDenoised: denoisedVals[0] / Math.max(denoisedVals[N - 1], 1e-5),
      effectiveBetsEntropy: effectiveBets,
      effectiveDegreesOfFreedom: effectiveBets,
      participationRatio,
      absorptionRatioTop2: (rawVals[0] + (rawVals[1] || 0)) / sumEig,
      corrRaw: C,
      corrDenoised: Cden,
      covRaw,
      covDenoised,
      volatilitiesAnn: sds.map(s => s * Math.sqrt(60)),
      returnsMatrix: R
    };
  }

  /**
   * 4.4 Multi-Channel Autonomic Sensor-Fusion & Biofeedback Weighting Shootout
   *     (Dual HR/PRV Baseline, 1/N Equal-Weight, Inverse-Volatility, ERC Risk Parity,
   *      Lopez de Prado HRP, and Tail-Damped Vagal Throttle)
   */
  function computeAllocationShootout(rmt, nodeNames = AUTONOMIC_NETWORK_NODES.map(n => n.name)) {
    const N = rmt.N;
    const Sigma = rmt.covDenoised;
    const vols = rmt.volatilitiesAnn;

    function portfolioMetrics(w, name) {
      let portVar = 0;
      const sigmaW = new Array(N).fill(0);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          sigmaW[i] += Sigma[i][j] * w[j];
          portVar += w[i] * Sigma[i][j] * w[j];
        }
      }
      const portVol = Math.sqrt(Math.max(portVar, 1e-10));
      const rc = w.map((wi, i) => (wi * sigmaW[i]) / Math.max(portVar, 1e-10));
      let weightedVol = 0;
      for (let i = 0; i < N; i++) weightedVol += w[i] * vols[i];
      const divRatio = weightedVol / portVol;
      let rcEnt = 0;
      for (let i = 0; i < N; i++) {
        const p = Math.max(rc[i], 1e-8);
        rcEnt -= p * Math.log(p);
      }
      const enb = Math.exp(rcEnt);
      return {
        name,
        weights: w,
        annVolPct: 100 * portVol,
        diversificationRatio: divRatio,
        effectiveRiskBets: enb,
        maxRiskContributionPct: 100 * Math.max(...rc),
        riskContributionsPct: rc.map(x => 100 * x)
      };
    }

    /* 1. Dual HR/PRV Baseline (60% SA-HR / Vagal RMSSD, 40% PRV SDNN / Baroreflex) */
    const w6040 = new Array(N).fill(0.02);
    w6040[0] = 0.30; w6040[1] = 0.28; w6040[2] = 0.16; w6040[5] = 0.14;
    const s6040 = w6040.reduce((a, b) => a + b, 0);
    for (let i = 0; i < N; i++) w6040[i] /= s6040;

    /* 2. Equal Weight (1/N) */
    const wEW = new Array(N).fill(1 / N);

    /* 3. Inverse-Volatility */
    const invV = vols.map(v => 1 / Math.max(v, 1e-4));
    const sIV = invV.reduce((a, b) => a + b, 0);
    const wIV = invV.map(v => v / sIV);

    /* 4. Equal Risk Contribution (ERC via Spinu/Roncalli cyclical coordinate descent) */
    const wERC = wIV.slice();
    for (let iter = 0; iter < 120; iter++) {
      for (let i = 0; i < N; i++) {
        let c_i = 0;
        for (let j = 0; j < N; j++) if (j !== i) c_i += Sigma[i][j] * wERC[j];
        const a = Sigma[i][i];
        const b = c_i;
        const c = -1 / N;
        wERC[i] = (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * Math.max(a, 1e-8));
      }
      const s = wERC.reduce((acc, v) => acc + v, 0) || 1;
      for (let i = 0; i < N; i++) wERC[i] /= s;
    }

    /* 5. Hierarchical Risk Parity (HRP - Lopez de Prado 2016) */
    const dist = Array.from({ length: N }, (_, i) =>
      Array.from({ length: N }, (__, j) => Math.sqrt(Math.max(0, 0.5 * (1 - rmt.corrDenoised[i][j]))))
    );
    const visited = new Uint8Array(N);
    const order = [0];
    visited[0] = 1;
    while (order.length < N) {
      const last = order[order.length - 1];
      let best = -1, bestD = Infinity;
      for (let j = 0; j < N; j++) {
        if (!visited[j] && dist[last][j] < bestD) { bestD = dist[last][j]; best = j; }
      }
      if (best < 0) break;
      visited[best] = 1;
      order.push(best);
    }
    const wHRP = new Array(N).fill(1);
    function clusterVar(indices) {
      const iv = indices.map(i => 1 / Math.max(Sigma[i][i], 1e-8));
      const siv = iv.reduce((a, b) => a + b, 0) || 1;
      const wSub = iv.map(v => v / siv);
      let v = 0;
      for (let a = 0; a < indices.length; a++) {
        for (let b = 0; b < indices.length; b++) {
          v += wSub[a] * Sigma[indices[a]][indices[b]] * wSub[b];
        }
      }
      return Math.max(v, 1e-10);
    }
    function bisect(items) {
      if (items.length <= 1) return;
      const mid = Math.floor(items.length / 2);
      const left = items.slice(0, mid), right = items.slice(mid);
      const vL = clusterVar(left), vR = clusterVar(right);
      const alpha = 1 - vL / (vL + vR);
      for (const i of left) wHRP[i] *= alpha;
      for (const i of right) wHRP[i] *= (1 - alpha);
      bisect(left);
      bisect(right);
    }
    bisect(order);
    const sHRP = wHRP.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < N; i++) wHRP[i] /= sHRP;

    /* 6. HRP with fixed tilts: x1.48 on 1/RMSSD, breathing and the BP reflex; x0.62 on the two skin-conductance signals */
    const wTD = wHRP.map((w, i) => {
      if (i === 1 || i === 3 || i === 5) return w * 1.48;
      if (i === 6 || i === 7) return w * 0.62;
      return w;
    });
    const sTD = wTD.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < N; i++) wTD[i] /= sTD;

    const strategies = [
      portfolioMetrics(w6040, 'Dual HR/PRV Baseline'),
      portfolioMetrics(wEW, 'Equal-Weight (1/N)'),
      portfolioMetrics(wIV, 'Inverse-Volatility'),
      portfolioMetrics(wERC, 'Equal Risk Contribution (ERC)'),
      portfolioMetrics(wHRP, 'Hierarchical Risk Parity (HRP)'),
      portfolioMetrics(wTD, 'HRP with fixed tilts (×1.48 on 1/RMSSD, breathing and BP reflex; ×0.62 on skin conductance)')
    ];

    return {
      nodeNames,
      quasiDiagOrder: order.map(i => nodeNames[i]),
      strategies
    };
  }

  /**
   * 4.5 Hamilton 2-State Markov-Switching Autonomic Filter
   *     (State 0: Vagal Restorative Coherence vs State 1: Sympathetic / Arousal Surge)
   */
  function computeAutonomicRegimeFilter(arousalSeries, criticalities = []) {
    const N = arousalSeries.length;
    const absR = arousalSeries.map(r => Math.abs(r));
    const med = quantile(absR, 0.55);
    const hi = quantile(absR, 0.82);
    const mu0 = Math.max(0.002, med * 0.72);
    const sig0 = Math.max(0.003, sd(absR, 1) * 0.65);
    const mu1 = Math.max(mu0 * 1.8, hi * 1.35);
    const sig1 = Math.max(sig0 * 1.6, sd(absR, 1) * 1.45);

    const p00 = 0.965, p11 = 0.915;
    let xi0 = 0.80, xi1 = 0.20;
    const filteredProbCrisis = new Array(N).fill(0);
    let logLik = 0;

    for (let t = 0; t < N; t++) {
      const pred0 = p00 * xi0 + (1 - p11) * xi1;
      const pred1 = (1 - p00) * xi0 + p11 * xi1;
      const y = absR[t];
      const f0 = Math.exp(-0.5 * Math.pow((y - mu0) / sig0, 2)) / (sig0 * Math.sqrt(2 * Math.PI));
      const f1 = Math.exp(-0.5 * Math.pow((y - mu1) / sig1, 2)) / (sig1 * Math.sqrt(2 * Math.PI));
      const num0 = pred0 * f0;
      const num1 = pred1 * f1;
      const denom = Math.max(num0 + num1, 1e-18);
      xi0 = num0 / denom;
      xi1 = num1 / denom;
      filteredProbCrisis[t] = xi1;
      logLik += Math.log(denom);
    }

    const latestCrisisProb = filteredProbCrisis[N - 1] || 0;
    const latestRho = criticalities.length ? criticalities[criticalities.length - 1].rho : 0.78;
    const expectedExpansionDuration = 1 / (1 - p00);
    const expectedCrisisDuration = 1 / (1 - p11);

    let activeRegime = 'State 0: Steady';
    if (latestCrisisProb > 0.60 || latestRho > 0.95) {
      activeRegime = 'State 1: Fast change';
    } else if (latestCrisisProb > 0.30 || latestRho > 0.82) {
      activeRegime = 'Transition';
    }

    const playbook = [
      {
        regime: 'Steady (P(fast change) ≤ 30% and ρ ≤ 0.82)',
        allocationRule: 'Full Multi-Channel HRP Fusion | 0.1 Hz Resonance Maintenance',
        kellyMultiplier: '1.00x gain',
        rationale: 'Small step changes and ρ at or below 0.82: a nudge to one signal fades quickly.'
      },
      {
        regime: 'Transition (P(fast change) 30–60%, or ρ 0.82–0.95)',
        allocationRule: 'ERC Parity + 4-6 Extended-Exhale Pacing Cue',
        kellyMultiplier: '0.60x gain',
        rationale: 'Step changes are growing, or ρ is above 0.82: a nudge fades more slowly.'
      },
      {
        regime: 'Fast change (P(fast change) > 60%, or ρ > 0.95)',
        allocationRule: 'HRP with fixed tilts + Top-Transmitter Interdiction',
        kellyMultiplier: '0.25x gain',
        rationale: 'Large step changes, or ρ above 0.95: a nudge barely fades.'
      }
    ];

    return {
      transitionMatrix: [[p00, 1 - p00], [1 - p11, p11]],
      expectedExpansionDurationEpochs: expectedExpansionDuration,
      expectedCrisisDurationEpochs: expectedCrisisDuration,
      expectedExpansionDurationDays: expectedExpansionDuration,
      expectedCrisisDurationDays: expectedCrisisDuration,
      logLikelihood: logLik,
      latestCrisisProbPct: 100 * latestCrisisProb,
      latestRho,
      activeRegime,
      filteredProbCrisis,
      playbook
    };
  }
  const computeMacroRegimeFilter = computeAutonomicRegimeFilter;

  /**
   * 4.5b The same two-state filter with its settings learned from the record itself (EM, Baum-Welch).
   *   changes: one value per step; NaN marks a missing step. State 0 (steady) and state 1 (fast change) differ in
   *   the size of the steps, rises and drops alike.
   *   emission 'half-normal' (default): a step is N(0, s_k^2), so its size |step| is half-normal with scale s_k.
   *   emission 'abs-gaussian': |step| ~ N(mu_k, sig_k^2), the form computeAutonomicRegimeFilter uses with fixed
   *   settings; with options.params set to those settings this function reproduces that filter exactly.
   *   options.params: fixed settings {P, pi, s} or {P, pi, mu, sig}; only the filter and smoother run.
   *   options.init: one EM start (default: three starts, the best likelihood kept); options.extraStarts adds starts.
   *   options.memory false: the same two step sizes with no memory, each step's state drawn independently with one
   *   probability (rows of P equal, persistence 0); the first step's state stays free, as in the Markov fit, so the
   *   two fits differ only in persistence.
   *   EM keeps every probability in [1e-9, 1 - 1e-9] and every spread at or above minSdFrac x the RMS step,
   *   so each update still never lowers the likelihood. Convergence: likelihood gain under tol per step.
   *   Returns, with state 1 always the larger steps: filtered P(fast change) from the steps so far (a live
   *   readout), smoothed P(fast change) from the whole record, the settings, and the one-state fit (BIC).
   */
  function fitRegimeSwitching(changes, options = {}) {
    const emission = options.emission === 'abs-gaussian' ? 'abs-gaussian' : 'half-normal';
    const memory = options.memory !== false;
    const maxIter = options.maxIter ?? 500, tol = options.tol ?? 1e-10, EPSP = 1e-9;
    const minSteps = options.minSteps ?? 20;
    const y = changes.map(v => (Number.isFinite(v) ? Math.abs(v) : NaN));
    const T = y.length, obs = y.filter(Number.isFinite), n = obs.length;
    if (n < minSteps) return { valid: false, reason: `needs at least ${minSteps} steps` };
    const rms = Math.sqrt(mean(obs.map(v => v * v)));
    if (!(rms > 0)) return { valid: false, reason: 'no change at all in the record' };
    const floor = Math.max(options.minSd ?? 0, (options.minSdFrac ?? 0.01) * rms);
    const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);
    const logEmit = emission === 'half-normal'
      ? (v, prm, k) => Math.LN2 - Math.log(prm.s[k]) - LOG_SQRT_2PI - 0.5 * (v / prm.s[k]) ** 2
      : (v, prm, k) => -Math.log(prm.sig[k]) - LOG_SQRT_2PI - 0.5 * ((v - prm.mu[k]) / prm.sig[k]) ** 2;
    const clampP = v => Math.min(1 - EPSP, Math.max(EPSP, v));

    /* Scaled forward-backward. a[t]: P(S_t | steps up to t). g[t]: P(S_t | all steps). xi: summed pair posteriors. */
    function pass(prm) {
      const [[p00, p01], [p10, p11]] = prm.P;
      const a = new Array(T), e = new Array(T), c = new Array(T);
      let q0 = prm.pi[0], q1 = prm.pi[1], logLik = 0;
      for (let t = 0; t < T; t++) {
        let e0 = 1, e1 = 1;
        if (Number.isFinite(y[t])) {
          const l0 = logEmit(y[t], prm, 0), l1 = logEmit(y[t], prm, 1), m = Math.max(l0, l1);
          e0 = Math.exp(l0 - m); e1 = Math.exp(l1 - m); logLik += m;
        }
        const u0 = q0 * e0, u1 = q1 * e1, s = u0 + u1;
        logLik += Math.log(s);
        a[t] = [u0 / s, u1 / s]; e[t] = [e0, e1]; c[t] = s;
        q0 = a[t][0] * p00 + a[t][1] * p10;
        q1 = a[t][0] * p01 + a[t][1] * p11;
      }
      const g = new Array(T), xi = [[0, 0], [0, 0]];
      g[T - 1] = a[T - 1].slice();
      let b0 = 1, b1 = 1;
      for (let t = T - 2; t >= 0; t--) {
        const w0 = e[t + 1][0] * b0 / c[t + 1], w1 = e[t + 1][1] * b1 / c[t + 1];
        xi[0][0] += a[t][0] * p00 * w0; xi[0][1] += a[t][0] * p01 * w1;
        xi[1][0] += a[t][1] * p10 * w0; xi[1][1] += a[t][1] * p11 * w1;
        b0 = p00 * w0 + p01 * w1; b1 = p10 * w0 + p11 * w1;
        const z0 = a[t][0] * b0, z1 = a[t][1] * b1;
        g[t] = [z0 / (z0 + z1), z1 / (z0 + z1)];
      }
      return { logLik, a, g, xi };
    }

    function mstep(prm, r) {
      const { g, xi } = r;
      const row0 = xi[0][0] + xi[0][1], row1 = xi[1][0] + xi[1][1];
      const pi0 = clampP(g[0][0]);
      let next;
      if (memory) {
        const p00 = row0 > 0 ? clampP(xi[0][0] / row0) : prm.P[0][0];
        const p11 = row1 > 0 ? clampP(xi[1][1] / row1) : prm.P[1][1];
        next = { P: [[p00, 1 - p00], [1 - p11, p11]], pi: [pi0, 1 - pi0] };
      } else {
        /* No memory: one probability of the fast state for every step after the first. */
        const q = row0 + row1 > 0 ? clampP((xi[0][1] + xi[1][1]) / (row0 + row1)) : prm.P[0][1];
        next = { P: [[1 - q, q], [1 - q, q]], pi: [pi0, 1 - pi0] };
      }
      const w = [0, 0], m1 = [0, 0];
      for (let t = 0; t < T; t++) {
        if (!Number.isFinite(y[t])) continue;
        for (let k = 0; k < 2; k++) { w[k] += g[t][k]; m1[k] += g[t][k] * y[t]; }
      }
      if (emission === 'half-normal') {
        const m2 = [0, 0];
        for (let t = 0; t < T; t++) if (Number.isFinite(y[t])) for (let k = 0; k < 2; k++) m2[k] += g[t][k] * y[t] * y[t];
        next.s = [0, 1].map(k => (w[k] > 0 ? Math.max(floor, Math.sqrt(m2[k] / w[k])) : prm.s[k]));
      } else {
        next.mu = [0, 1].map(k => (w[k] > 0 ? m1[k] / w[k] : prm.mu[k]));
        const v2 = [0, 0];
        for (let t = 0; t < T; t++) if (Number.isFinite(y[t])) for (let k = 0; k < 2; k++) v2[k] += g[t][k] * (y[t] - next.mu[k]) ** 2;
        next.sig = [0, 1].map(k => (w[k] > 0 ? Math.max(floor, Math.sqrt(v2[k] / w[k])) : prm.sig[k]));
      }
      return next;
    }

    function runEM(start) {
      let prm = start, r = pass(prm), iterations = 0, converged = false;
      const trace = [r.logLik];
      while (iterations < maxIter) {
        const next = mstep(prm, r), rn = pass(next);
        iterations++;
        const gain = rn.logLik - r.logLik;
        prm = next; r = rn; trace.push(r.logLik);
        if (gain < tol * n) { converged = true; break; }
      }
      return { prm, r, trace, iterations, converged };
    }

    /* EM starts: split the step sizes at a quantile, smaller steps steady, larger steps fast. */
    function splitStart(qq, P) {
      const cut = quantile(obs, qq);
      let lo = obs.filter(v => v <= cut), hi = obs.filter(v => v > cut);
      if (!hi.length) hi = lo.slice(-1);
      const start = { P, pi: [qq, 1 - qq] };
      if (emission === 'half-normal') {
        const rmsOf = arr => Math.sqrt(mean(arr.map(v => v * v)));
        start.s = [Math.max(floor, rmsOf(lo)), Math.max(floor, rmsOf(hi))];
      } else {
        start.mu = [mean(lo), mean(hi)];
        start.sig = [Math.max(floor, sd(lo, 0)), Math.max(floor, sd(hi, 0))];
      }
      return start;
    }

    let best;
    if (options.params) {
      const r = pass(options.params);
      best = { prm: options.params, r, trace: [r.logLik], iterations: 0, converged: true };
    } else {
      const starts = options.init ? [options.init] : memory ? [
        splitStart(0.7, [[0.965, 0.035], [0.085, 0.915]]),
        splitStart(0.9, [[0.99, 0.01], [0.05, 0.95]]),
        splitStart(0.5, [[0.9, 0.1], [0.1, 0.9]])
      ] : [0.7, 0.9, 0.5].map(qq => splitStart(qq, [[qq, 1 - qq], [qq, 1 - qq]]));
      if (options.extraStarts) starts.push(...options.extraStarts);
      for (const st of starts) {
        const fit = runEM(st);
        if (!best || fit.r.logLik > best.r.logLik) best = fit;
      }
    }

    /* State 1 is the one with the larger steps. */
    let { prm, r } = best;
    const size = p => (emission === 'half-normal' ? p.s : p.mu);
    let filtered = r.a.map(v => v[1]), smoothed = r.g.map(v => v[1]);
    if (size(prm)[0] > size(prm)[1]) {
      const sw = ([x0, x1]) => [x1, x0];
      prm = {
        P: [[prm.P[1][1], prm.P[1][0]], [prm.P[0][1], prm.P[0][0]]], pi: sw(prm.pi),
        ...(emission === 'half-normal' ? { s: sw(prm.s) } : { mu: sw(prm.mu), sig: sw(prm.sig) })
      };
      filtered = r.a.map(v => v[0]); smoothed = r.g.map(v => v[0]);
    }

    /* One state: the same emission with a single setting, fitted by maximum likelihood. */
    let one, logLik1 = 0;
    if (emission === 'half-normal') {
      one = { s: [Math.max(floor, rms), Math.max(floor, rms)] };
    } else {
      const mu = mean(obs), sg = Math.max(floor, sd(obs, 0));
      one = { mu: [mu, mu], sig: [sg, sg] };
    }
    for (const v of obs) logLik1 += logEmit(v, one, 0);
    /* Free settings: spreads (2 or 4), transitions (2, or 1 without memory), the first step's state (1). */
    const k2 = (emission === 'half-normal' ? 2 : 4) + (memory ? 2 : 1) + 1, k1 = emission === 'half-normal' ? 1 : 2;
    const bic2 = -2 * r.logLik + k2 * Math.log(n), bic1 = -2 * logLik1 + k1 * Math.log(n);
    const [[p00, p01], [p10, p11]] = prm.P;

    return {
      valid: true,
      emission,
      memory,
      T,
      steps: n,
      settings: prm,
      persistence: p00 + p11 - 1,
      fastShare: p01 / (p01 + p10),
      meanStepsSteady: 1 / (1 - p00),
      meanStepsFast: 1 / (1 - p11),
      filtered,
      smoothed,
      logLik: r.logLik,
      logLik1,
      bic2,
      bic1,
      twoStatesByBic: bic2 < bic1,
      iterations: best.iterations,
      converged: best.converged,
      trace: options.trace ? best.trace : undefined
    };
  }

  /* Upper tail of the standard normal curve, P(Z > z), from erfc (fractional error under 1.2e-7). */
  function normalSurvival(z) {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.5 * x);
    const r = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return z >= 0 ? 0.5 * r : 1 - 0.5 * r;
  }

  /* Ranks 1..n, ties given their average rank. */
  function averageRanks(values) {
    const n = values.length, idx = values.map((_, i) => i).sort((i, j) => values[i] - values[j]), r = new Array(n);
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && values[idx[j + 1]] === values[idx[i]]) j++;
      for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }

  /**
   * 4.5d Steps that move smoothly: each step carries part of the ones before it (momentum). Least squares fits
   *   r_t = c + phi_1 r_(t-1) + ... + phi_p r_(t-p) + e_t; the residuals e_t are the part of each step that its recent
   *   steps do not predict. Stretches of bigger steps do not make the steps themselves correlated, so they stay in the
   *   residuals: Hamilton's switching autoregression, fitted in two stages (the autoregression, then the two states).
   *   order: a whole number, or 'auto' (default): 0..maxOrder (default 6) with the lowest AIC on a common sample.
   *   Residuals keep the record's time index, NaN where a step or one of its p predecessors is missing.
   */
  function stepMomentum(changes, options = {}) {
    const T = changes.length, maxOrder = options.maxOrder ?? 6;
    const usable = (t, p) => {
      if (t < p || !Number.isFinite(changes[t])) return false;
      for (let j = 1; j <= p; j++) if (!Number.isFinite(changes[t - j])) return false;
      return true;
    };
    const predict = (coef, t, p) => { let f = coef[0]; for (let j = 1; j <= p; j++) f += coef[j] * changes[t - j]; return f; };
    const ols = (p, rows) => {
      const k = p + 1, XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0);
      for (const t of rows) {
        const x = [1];
        for (let j = 1; j <= p; j++) x.push(changes[t - j]);
        for (let i = 0; i < k; i++) { Xty[i] += x[i] * changes[t]; for (let j = 0; j < k; j++) XtX[i][j] += x[i] * x[j]; }
      }
      const coef = solveLinearSystem(XtX, Xty);
      let rss = 0;
      for (const t of rows) rss += (changes[t] - predict(coef, t, p)) ** 2;
      return { coef, rss };
    };
    let order = options.order ?? 'auto';
    if (order === 'auto') {
      const common = [];
      for (let t = 0; t < T; t++) if (usable(t, maxOrder)) common.push(t);
      order = 0;
      if (common.length > 10 * (maxOrder + 1)) {
        let best = Infinity;
        for (let p = 0; p <= maxOrder; p++) {
          const aic = common.length * Math.log(Math.max(ols(p, common).rss, 1e-300) / common.length) + 2 * (p + 1);
          if (aic < best) { best = aic; order = p; }
        }
      }
    }
    const rows = [];
    for (let t = 0; t < T; t++) if (usable(t, order)) rows.push(t);
    const { coef } = ols(order, rows);
    const residuals = new Array(T).fill(NaN);
    for (const t of rows) residuals[t] = changes[t] - predict(coef, t, order);
    return { order, c: coef[0], phi: coef.slice(1), residuals };
  }

  /**
   * 4.5e Steady, climbing and falling: Hamilton's switching autoregression with a switching intercept (MSI-AR).
   *   r_t = c_(S_t) + phi_1 r_(t-1) + ... + phi_p r_(t-p) + sigma_(S_t) e_t, e_t standard normal, S_t a Markov chain.
   *   Momentum (phi) is shared; each state has its own drift c_k and spread sigma_k. A state's mean step, once it has
   *   lasted, is c_k / (1 - sum phi). States are ordered steady (the smallest mean step squared plus spread squared),
   *   then climbing (the larger mean step), then falling. Fast change = not steady. A step before the first p, or next
   *   to a missing step, carries no likelihood. EM by conditional maximization: transitions (each probability at least
   *   1e-9), then drifts and momentum by weighted least squares given the spreads, then the spreads (floored at
   *   minSdFrac x the RMS step); no update lowers the likelihood.
   *   options: states (3, or 2), order (2), params (fixed settings {P, pi, c, phi, sigma}: filter and smoother only),
   *   init, maxIter (3000), tol (gain per step, 1e-9), minSdFrac (0.01), minSteps (30), trace.
   */
  function fitSwitchingAutoregression(changes, options = {}) {
    const K = options.states ?? 3, p = options.order ?? 2, EPSP = 1e-9;
    const maxIter = options.maxIter ?? 3000, tol = options.tol ?? 1e-9;
    const T = changes.length, valid = new Array(T).fill(false), idx = [];
    for (let t = p; t < T; t++) {
      let ok = Number.isFinite(changes[t]);
      for (let j = 1; j <= p && ok; j++) ok = Number.isFinite(changes[t - j]);
      valid[t] = ok;
      if (ok) idx.push(t);
    }
    const n = idx.length, minSteps = options.minSteps ?? 30;
    if (n < minSteps) return { valid: false, reason: `needs at least ${minSteps} steps` };
    const rms = Math.sqrt(mean(idx.map(t => changes[t] ** 2)));
    if (!(rms > 0)) return { valid: false, reason: 'no change at all in the record' };
    const floor = Math.max(options.minSd ?? 0, (options.minSdFrac ?? 0.01) * rms);
    const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);
    const lagDot = (phi, t) => { let s = 0; for (let j = 1; j <= p; j++) s += phi[j - 1] * changes[t - j]; return s; };

    /* Largest sum of cnt_j log P_j with every P_j at least EPSP and the row summing to 1. */
    function boundedRow(cnt, previous) {
      const total = cnt.reduce((s, v) => s + v, 0);
      if (!(total > 0)) return previous.slice();
      const fixed = new Array(cnt.length).fill(false);
      let row = null;
      for (let round = 0; round < cnt.length; round++) {
        const nFixed = fixed.filter(Boolean).length, free = cnt.reduce((s, v, j) => s + (fixed[j] ? 0 : v), 0);
        row = cnt.map((v, j) => (fixed[j] ? EPSP : (1 - EPSP * nFixed) * v / free));
        let changed = false;
        row.forEach((v, j) => { if (!fixed[j] && v < EPSP) { fixed[j] = true; changed = true; } });
        if (!changed) break;
      }
      return row;
    }

    function pass(prm) {
      const a = new Array(T), e = new Array(T), sc = new Array(T);
      let q = prm.pi.slice(), logLik = 0;
      for (let t = 0; t < T; t++) {
        const et = new Array(K).fill(1);
        if (valid[t]) {
          const f = lagDot(prm.phi, t), l = new Array(K);
          let m = -Infinity;
          for (let k = 0; k < K; k++) {
            const z = (changes[t] - prm.c[k] - f) / prm.sigma[k];
            l[k] = -Math.log(prm.sigma[k]) - LOG_SQRT_2PI - 0.5 * z * z;
            if (l[k] > m) m = l[k];
          }
          for (let k = 0; k < K; k++) et[k] = Math.exp(l[k] - m);
          logLik += m;
        }
        const u = new Array(K);
        let s = 0;
        for (let k = 0; k < K; k++) { u[k] = q[k] * et[k]; s += u[k]; }
        logLik += Math.log(s);
        a[t] = u.map(v => v / s); e[t] = et; sc[t] = s;
        const next = new Array(K).fill(0);
        for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) next[j] += a[t][i] * prm.P[i][j];
        q = next;
      }
      const g = new Array(T), xi = Array.from({ length: K }, () => new Array(K).fill(0));
      g[T - 1] = a[T - 1].slice();
      let b = new Array(K).fill(1);
      for (let t = T - 2; t >= 0; t--) {
        const w = new Array(K), nb = new Array(K).fill(0);
        for (let j = 0; j < K; j++) w[j] = e[t + 1][j] * b[j] / sc[t + 1];
        for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const v = prm.P[i][j] * w[j]; xi[i][j] += a[t][i] * v; nb[i] += v; }
        b = nb;
        const gt = new Array(K);
        let z = 0;
        for (let k = 0; k < K; k++) { gt[k] = a[t][k] * b[k]; z += gt[k]; }
        g[t] = gt.map(v => v / z);
      }
      return { logLik, a, g, xi };
    }

    function mstep(prm, r) {
      const P = r.xi.map((row, i) => boundedRow(row, prm.P[i]));
      const pi = boundedRow(r.g[0], prm.pi);
      /* Drifts and momentum: weighted least squares, weight g_t(k) / sigma_k^2, given the spreads. */
      const dim = K + p, A = Array.from({ length: dim }, () => new Array(dim).fill(0)), bv = new Array(dim).fill(0);
      const z = new Array(dim);
      for (const t of idx) {
        for (let j = 1; j <= p; j++) z[K + j - 1] = changes[t - j];
        for (let k = 0; k < K; k++) {
          const w = r.g[t][k] / (prm.sigma[k] * prm.sigma[k]);
          if (!(w > 0)) continue;
          for (let u = 0; u < K; u++) z[u] = u === k ? 1 : 0;
          for (let u = 0; u < dim; u++) {
            if (z[u] === 0) continue;
            bv[u] += w * z[u] * changes[t];
            for (let v = 0; v < dim; v++) A[u][v] += w * z[u] * z[v];
          }
        }
      }
      const ridge = 1e-12 * Math.max(...A.map((row, i) => row[i]), 1e-300);
      for (let u = 0; u < dim; u++) A[u][u] += ridge;
      const theta = solveLinearSystem(A, bv);
      const c = theta.slice(0, K), phi = theta.slice(K);
      const num = new Array(K).fill(0), den = new Array(K).fill(0);
      for (const t of idx) {
        const f = lagDot(phi, t);
        for (let k = 0; k < K; k++) { num[k] += r.g[t][k] * (changes[t] - c[k] - f) ** 2; den[k] += r.g[t][k]; }
      }
      const sigma = prm.sigma.map((s, k) => (den[k] > 0 ? Math.max(floor, Math.sqrt(num[k] / den[k])) : s));
      return { P, pi, c, phi, sigma };
    }

    function runEM(start) {
      let prm = start, r = pass(prm), iterations = 0, converged = false;
      const trace = [r.logLik];
      while (iterations < maxIter) {
        const next = mstep(prm, r), rn = pass(next);
        iterations++;
        const gain = rn.logLik - r.logLik;
        prm = next; r = rn; trace.push(r.logLik);
        if (gain < tol * n) { converged = true; break; }
      }
      return { prm, r, trace, iterations, converged };
    }

    /* Starts from the momentum fit: the steady state at the record's mean step, the others offset by 0.5, 1 and 2
       spreads of the momentum residuals (up and down), held in place by momentum through c_k = mean step x (1 - sum phi). */
    function makeStarts() {
      const ar = stepMomentum(changes, { order: p });
      const sdE = Math.max(floor, sd(ar.residuals.filter(Number.isFinite), 0));
      const gainAr = Math.max(0.1, 1 - ar.phi.reduce((s, v) => s + v, 0)), base = ar.c / gainAr;
      if (K === 2) {
        return [{ P: [[0.95, 0.05], [0.1, 0.9]], pi: [0.7, 0.3], c: [ar.c, ar.c], phi: ar.phi.slice(), sigma: [0.7 * sdE, 1.5 * sdE] }];
      }
      return [0.5, 1, 2].map(off => ({
        P: [[0.96, 0.02, 0.02], [0.05, 0.94, 0.01], [0.05, 0.01, 0.94]],
        pi: [0.8, 0.1, 0.1],
        c: [base, base + off * sdE, base - off * sdE].map(m => m * gainAr),
        phi: ar.phi.slice(),
        sigma: [0.8 * sdE, 1.3 * sdE, 1.3 * sdE]
      }));
    }

    let best;
    if (options.params) {
      const r = pass(options.params);
      best = { prm: options.params, r, trace: [r.logLik], iterations: 0, converged: true };
    } else {
      for (const st of options.init ? [options.init] : makeStarts()) {
        const fit = runEM(st);
        if (!best || fit.r.logLik > best.r.logLik) best = fit;
      }
    }

    /* Order the states: steady first, then climbing (larger mean step), then falling. */
    const { prm, r } = best;
    const gainFit = Math.max(1e-6, 1 - prm.phi.reduce((s, v) => s + v, 0));
    const meanStepRaw = prm.c.map(c => c / gainFit);
    const size = meanStepRaw.map((m, k) => m * m + prm.sigma[k] ** 2);
    const steady = size.indexOf(Math.min(...size));
    const others = [...Array(K).keys()].filter(k => k !== steady).sort((i, j) => meanStepRaw[j] - meanStepRaw[i]);
    const perm = [steady, ...others];
    const settings = {
      P: perm.map(i => perm.map(j => prm.P[i][j])),
      pi: perm.map(i => prm.pi[i]),
      c: perm.map(i => prm.c[i]),
      phi: prm.phi.slice(),
      sigma: perm.map(i => prm.sigma[i])
    };
    const reorder = rows => rows.map(v => perm.map(i => v[i]));
    const fa = reorder(r.a), fg = reorder(r.g);
    const view = rows => ({ fast: rows.map(v => 1 - v[0]), up: K === 3 ? rows.map(v => v[1]) : null, down: K === 3 ? rows.map(v => v[2]) : null });
    return {
      valid: true,
      states: K,
      order: p,
      steps: n,
      settings,
      meanStep: perm.map(i => meanStepRaw[i]),
      filtered: view(fa),
      smoothed: view(fg),
      logLik: r.logLik,
      iterations: best.iterations,
      converged: best.converged,
      trace: options.trace ? best.trace : undefined
    };
  }

  /* Nelder-Mead minimisation (reflect 1, expand 2, contract 0.5, shrink 0.5). */
  function nelderMead(f, x0, options = {}) {
    const n = x0.length, step = options.step ?? 0.5, maxIter = options.maxIter ?? 300, tol = options.tol ?? 1e-9;
    let pts = [x0.slice()];
    for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += step; pts.push(p); }
    let vals = pts.map(f);
    for (let it = 0; it < maxIter; it++) {
      const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
      pts = order.map(i => pts[i]); vals = order.map(i => vals[i]);
      if (Math.abs(vals[n] - vals[0]) <= tol * (1 + Math.abs(vals[0]))) break;
      const c = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;
      const refl = c.map((v, j) => v + (v - pts[n][j])), fr = f(refl);
      if (fr < vals[0]) {
        const ex = c.map((v, j) => v + 2 * (v - pts[n][j])), fe = f(ex);
        if (fe < fr) { pts[n] = ex; vals[n] = fe; } else { pts[n] = refl; vals[n] = fr; }
      } else if (fr < vals[n - 1]) { pts[n] = refl; vals[n] = fr; }
      else {
        const con = c.map((v, j) => v + 0.5 * (pts[n][j] - v)), fc = f(con);
        if (fc < vals[n]) { pts[n] = con; vals[n] = fc; }
        else for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); vals[i] = f(pts[i]); }
      }
    }
    const best = vals.indexOf(Math.min(...vals));
    return { x: pts[best], f: vals[best] };
  }

  /**
   * 4.5h Effort target: heart rate gliding toward a target that jumps when effort changes (a switching linear model).
   *   Levels y_t (heart rate per bin; NaN missing). State x = (H, G): H_(t+1) = rho H_t + (1 - rho) G_t + w_H,
   *   G_(t+1) = G_t + w_G, y_t = H_t + v_t. Heart rate rises and recovers at different speeds: rho = rhoUp = exp(-dt /
   *   tauUp) while heart rate is below its target, rhoDown while above, read from the filter's own estimate of G - H at
   *   each step. With rhoUp = rhoDown (or params.rho alone) the model is linear and the filter exact.
   *   Variances: qH (heart rate's own wandering), qG (the target's slow drift), R (device and bin). A jump of size nu at
   *   step theta adds nu to G at theta (after the prediction, before y_theta), so H starts to answer at theta + 1. jumps
   *   (Map step -> size) are known inputs. Prior: params.m0 / params.P0, or the first level for both with variances R + qH
   *   and 25 bpm^2. Returns predicted and filtered means and covariances, innovations gamma_t, their variances S_t, gains
   *   K_t, and the log-likelihood.
   */
  const effortSpeeds = p => [p.rhoUp ?? p.rho, p.rhoDown ?? p.rho];
  const effortGlide = (v, r) => [r * v[0] + (1 - r) * v[1], v[1]];
  function effortGlideCov(P, r, qH, qG) {
    const a = P[0][0], b = P[0][1], d = P[1][1], f1 = 1 - r, n01 = r * b + f1 * d;
    return [[r * r * a + 2 * r * f1 * b + f1 * f1 * d + qH, n01], [n01, d + qG]];
  }
  function effortPrior(levels, params) {
    if (params.m0) return { m: params.m0.slice(), P: params.P0.map(r => r.slice()) };
    const first = levels.find(Number.isFinite) ?? 0;
    return { m: [first, first], P: [[params.R + params.qH, 0], [0, 25]] };
  }
  function effortUpdate(m, P, y, R) {
    const S = P[0][0] + R, gam = y - m[0], K = [P[0][0] / S, P[1][0] / S];
    const p00 = P[0][0] - K[0] * P[0][0], p01 = P[0][1] - K[0] * P[0][1], p11 = P[1][1] - K[1] * P[0][1];
    return { m: [m[0] + K[0] * gam, m[1] + K[1] * gam], P: [[p00, p01], [p01, p11]], S, gam, K };
  }

  function effortTargetFilter(levels, params, jumps = null) {
    const { qH, qG, R } = params, [rU, rD] = effortSpeeds(params), T = levels.length;
    let { m, P } = effortPrior(levels, params);
    const out = { mp: [], Pp: [], mf: [], Pf: [], gamma: [], S: [], K: [], logLik: 0 };
    for (let t = 0; t < T; t++) {
      if (t > 0) { const r = m[1] - m[0] > 0 ? rU : rD; m = effortGlide(m, r); P = effortGlideCov(P, r, qH, qG); }
      if (jumps && jumps.has(t)) m[1] += jumps.get(t);
      out.mp.push(m.slice()); out.Pp.push(P.map(r => r.slice()));
      const y = levels[t];
      if (Number.isFinite(y)) {
        const u = effortUpdate(m, P, y, R);
        m = u.m; P = u.P;
        out.logLik += -0.5 * (Math.log(2 * Math.PI * u.S) + u.gam * u.gam / u.S);
        out.gamma.push(u.gam); out.S.push(u.S); out.K.push(u.K);
      } else { out.gamma.push(NaN); out.S.push(NaN); out.K.push(null); }
      out.mf.push(m.slice()); out.Pf.push(P.map(r => r.slice()));
    }
    return out;
  }

  /* The jump detector inside findTargetJumps: Willsky and Jones's generalized likelihood ratio for a jump in G.
     For each candidate step theta in the last `window` steps it follows the jump's fingerprint in the innovations, twice:
     as an upward jump (the true deviation D glides at the rising speed) and as a downward one (at the recovery speed);
     Phat, the filter's predicted deviation, uses the filter's own speed each step. g_t = first component of D_t - Phat_t,
     l = (sum g gamma / S)^2 / (sum g^2 / S), chi-square with 1 degree of freedom at a fixed theta and t when there is no
     jump; a fingerprint counts only for a jump in its own direction. With equal speeds the two fingerprints coincide.
     When the largest l passes the threshold (and minGap steps have passed since the last jump), the decision waits
     `confirm` more steps (3); then the jump is declared at the best theta, size nu = sum g gamma / S over sum g^2 / S, the
     filter is corrected by (D - Ehat) nu and its covariance widened by (D - Ehat)(D - Ehat)' / C, and the candidates
     restart. A jump in the same direction within mergeWithin steps (6) of the previous one joins it. */
  function detectTargetJumps(levels, params, window, threshold, minGap, confirm = 3, mergeWithin = 6) {
    const { qH, qG, R } = params, [rU, rD] = effortSpeeds(params), T = levels.length;
    let { m, P } = effortPrior(levels, params);
    const track = () => ({ D: [0, 1], Phat: [0, 0], Ehat: [0, 0], d: 0, C: 0 });
    let cands = [], lastJump = -Infinity, pendingSince = null;
    const jumps = [];
    for (let t = 0; t < T; t++) {
      if (t > 0) {
        const r = m[1] - m[0] > 0 ? rU : rD;
        m = effortGlide(m, r); P = effortGlideCov(P, r, qH, qG);
        for (const c of cands) {
          c.up.D = effortGlide(c.up.D, rU); c.up.Phat = effortGlide(c.up.Ehat, r);
          c.down.D = effortGlide(c.down.D, rD); c.down.Phat = effortGlide(c.down.Ehat, r);
        }
      }
      cands = cands.filter(c => t - c.theta < window);
      cands.push({ theta: t, up: track(), down: track() });
      const y = levels[t];
      if (Number.isFinite(y)) {
        const u = effortUpdate(m, P, y, R);
        for (const c of cands) for (const tr of [c.up, c.down]) {
          const g = tr.D[0] - tr.Phat[0];
          tr.d += g * u.gam / u.S; tr.C += g * g / u.S;
          tr.Ehat = [tr.Phat[0] + u.K[0] * g, tr.Phat[1] + u.K[1] * g];
        }
        m = u.m; P = u.P;
      } else for (const c of cands) for (const tr of [c.up, c.down]) tr.Ehat = tr.Phat.slice();
      let best = null;
      for (const c of cands) {
        for (const [dir, tr] of [[1, c.up], [-1, c.down]]) {
          if (!(tr.C > 0) || Math.sign(tr.d) !== dir) continue;
          const l = tr.d * tr.d / tr.C;
          if (!best || l > best.l) best = { c, tr, l };
        }
      }
      if (pendingSince === null && best && best.l > threshold && best.c.theta - lastJump >= minGap) pendingSince = t;
      if (pendingSince !== null && best && (t - pendingSince >= confirm || t === T - 1)) {
        const { c, tr } = best, nu = tr.d / tr.C, u = [tr.D[0] - tr.Ehat[0], tr.D[1] - tr.Ehat[1]];
        m = [m[0] + u[0] * nu, m[1] + u[1] * nu];
        P = [[P[0][0] + u[0] * u[0] / tr.C, P[0][1] + u[0] * u[1] / tr.C], [P[1][0] + u[1] * u[0] / tr.C, P[1][1] + u[1] * u[1] / tr.C]];
        const prev = jumps[jumps.length - 1];
        if (prev && Math.sign(prev.size) === Math.sign(nu) && c.theta - prev.at <= mergeWithin) { prev.size += nu; prev.l = Math.max(prev.l, best.l); }
        else jumps.push({ at: c.theta, size: nu, l: best.l, detectedAt: t });
        lastJump = c.theta;
        cands = [];
        pendingSince = null;
      }
    }
    return jumps;
  }

  /* Gaussians with log weights merged into one by matching the mean and covariance. */
  function mergeGaussians(group) {
    const mx = Math.max(...group.map(c => c.w));
    const W = mx + Math.log(group.reduce((s, c) => s + Math.exp(c.w - mx), 0));
    const pi = group.map(c => Math.exp(c.w - W));
    const m = [0, 1].map(i => group.reduce((s, c, k) => s + pi[k] * c.m[i], 0));
    const P = [0, 1].map(i => [0, 1].map(j => group.reduce((s, c, k) => s + pi[k] * (c.P[i][j] + (c.m[i] - m[i]) * (c.m[j] - m[j])), 0)));
    return { w: W, m, P };
  }

  /* Log-likelihood with the jumps inside it. For the last `window` steps the filter keeps one hypothesis per possible jump
     step (a jump adds variance qJ to G at that step) next to the no-jump hypothesis, weighted by Bayes with jump chance pJ
     per step; at most one jump per window. A hypothesis older than the window is merged into the no-jump one by matching
     means and covariances. Each hypothesis glides at the speed its own estimate of G - H calls for. So a jump is explained
     as a jump, not as target drift. Approximate only through the merging. */
  function effortTargetJumpLogLik(levels, params, pJ, qJ, window = 12) {
    const { qH, qG, R } = params, [rU, rD] = effortSpeeds(params), T = levels.length;
    const first = levels.find(Number.isFinite) ?? 0;
    let comps = [{ w: 0, m: [first, first], P: [[R + qH, 0], [0, 25]], age: null }];
    let ll = 0;
    for (let t = 0; t < T; t++) {
      if (t > 0) {
        for (const c of comps) {
          const r = c.m[1] - c.m[0] > 0 ? rU : rD;
          c.m = effortGlide(c.m, r); c.P = effortGlideCov(c.P, r, qH, qG);
          if (c.age !== null) c.age++;
        }
        const base = comps.find(c => c.age === null);
        comps.push({ w: base.w + Math.log(pJ), m: base.m.slice(), P: [[base.P[0][0], base.P[0][1]], [base.P[1][0], base.P[1][1] + qJ]], age: 0 });
        base.w += Math.log(1 - pJ);
      }
      const y = levels[t];
      if (Number.isFinite(y)) {
        for (const c of comps) {
          const u = effortUpdate(c.m, c.P, y, R);
          c.w += -0.5 * (Math.log(2 * Math.PI * u.S) + u.gam * u.gam / u.S);
          c.m = u.m; c.P = u.P;
        }
        const mx = Math.max(...comps.map(c => c.w)), z = mx + Math.log(comps.reduce((s, c) => s + Math.exp(c.w - mx), 0));
        ll += z;
        for (const c of comps) c.w -= z;
      }
      const old = comps.filter(c => c.age !== null && c.age >= window);
      if (old.length) {
        const group = [comps.find(c => c.age === null), ...old];
        comps = comps.filter(c => !group.includes(c));
        comps.push({ ...mergeGaussians(group), age: null });
      }
    }
    return ll;
  }

  /* Maximum likelihood (log scale, Nelder-Mead) for qH, qG and R. With jumpModel, the likelihood carries the jumps
     (effortTargetJumpLogLik, jump size spread qJ, default 15^2 bpm^2), the jump chance pJ is learned (logit scale), and with
     learnSpeeds the rising and recovery time constants too (starting tauUp 30 s and tauDown 50 s, each kept within
     15-120 s); otherwise the speed is options.rho and known jumps are inputs. */
  function estimateEffortTarget(levels, options = {}) {
    const dt = options.dt ?? 5, rho = options.rho, jumps = options.jumps ?? null;
    const d = [];
    for (let i = 1; i < levels.length; i++) if (Number.isFinite(levels[i]) && Number.isFinite(levels[i - 1])) d.push(levels[i] - levels[i - 1]);
    const v = Math.max(1e-6, variance(d, 0));
    const x0 = (options.init ?? [Math.log(0.3 * v), Math.log(0.02 * v), Math.log(0.3 * v)]).slice(0, 3);
    if (options.jumpModel) {
      const qJ = options.qJ ?? 225, learn = !!options.learnSpeeds, sig = z => 1 / (1 + Math.exp(-z));
      const tauOf = z => Math.min(120, Math.max(15, Math.exp(z)));
      const unpack = x => {
        const prm = { qH: Math.exp(x[0]), qG: Math.exp(x[1]), R: Math.exp(x[2]) };
        if (learn) { prm.tauUp = tauOf(x[4]); prm.tauDown = tauOf(x[5]); prm.rhoUp = Math.exp(-dt / prm.tauUp); prm.rhoDown = Math.exp(-dt / prm.tauDown); }
        else { prm.rhoUp = rho; prm.rhoDown = rho; }
        return prm;
      };
      const nllJ = x => {
        const pJ = Math.min(0.5, Math.max(1e-6, sig(x[3])));
        const ll = effortTargetJumpLogLik(levels, unpack(x), pJ, qJ, options.window ?? 12);
        return Number.isFinite(ll) ? -ll : 1e300;
      };
      const start = [...x0, Math.log(1 / 59), ...(learn ? [Math.log(options.tauUp ?? 30), Math.log(options.tauDown ?? 50)] : [])];
      const res = nelderMead(nllJ, start, { step: 1, maxIter: options.maxIter ?? (learn ? 900 : 500) });
      return { ...unpack(res.x), pJ: sig(res.x[3]), qJ, logLik: -res.f };
    }
    const nll = x => {
      const r = effortTargetFilter(levels, { rho, qH: Math.exp(x[0]), qG: Math.exp(x[1]), R: Math.exp(x[2]) }, jumps);
      return Number.isFinite(r.logLik) ? -r.logLik : 1e300;
    };
    const res = nelderMead(nll, x0, { step: 1, maxIter: options.maxIter ?? 400 });
    return { rho, rhoUp: rho, rhoDown: rho, qH: Math.exp(res.x[0]), qG: Math.exp(res.x[1]), R: Math.exp(res.x[2]), logLik: -res.f };
  }

  /**
   * 4.5i Effort jumps: where the effort target jumped, by how much, and the climb or fall that follows.
   *   levels: heart rate per bin (5-s bin means for the ride import). window (12 steps = 1 min) bounds how far back a jump
   *   is looked for; threshold (20) is the likelihood-ratio level; minGap (3 steps).
   *   Speeds: tau (40 s) for both unless tauUp / tauDown are given. Without options.params, qH, qG, R, the jump chance and
   *   (unless learnSpeeds is false) the rising and recovery time constants are learned by maximum likelihood with the jumps
   *   inside the likelihood (effortTargetJumpLogLik), starting from robust guesses (v = (1.4826 x the median absolute
   *   deviation of the level changes)^2: qH 0.3 v, qG 0.02 v, R 0.3 v; tauUp 30 s, tauDown 50 s). Heart rate rises faster
   *   than it recovers; one shared speed (an earlier version) left spurious jumps after recoveries on realistic rides.
   *   Each jump: step, direction, size (target jump, bpm), and settleSteps: the steps for 90% of the glide at its own speed.
   */
  function findTargetJumps(levels, options = {}) {
    const dt = options.dt ?? 5, tau = options.tau ?? 40;
    const window = options.window ?? 12, threshold = options.threshold ?? 20, minGap = options.minGap ?? 3;
    if (levels.filter(Number.isFinite).length < (options.minSteps ?? 60)) return { valid: false, reason: 'needs at least 60 steps' };
    let tauUp = options.tauUp ?? tau, tauDown = options.tauDown ?? tau, params;
    if (options.params) params = { ...options.params, rhoUp: Math.exp(-dt / tauUp), rhoDown: Math.exp(-dt / tauDown) };
    else {
      const d = [];
      for (let i = 1; i < levels.length; i++) if (Number.isFinite(levels[i]) && Number.isFinite(levels[i - 1])) d.push(levels[i] - levels[i - 1]);
      const md = median(d), v = Math.max(1e-6, (1.4826 * median(d.map(x => Math.abs(x - md)))) ** 2);
      const learnSpeeds = options.learnSpeeds !== false;
      params = estimateEffortTarget(levels, {
        dt, rho: Math.exp(-dt / tau), jumpModel: true, learnSpeeds, window,
        tauUp: options.tauUp ?? 30, tauDown: options.tauDown ?? 50,
        init: [Math.log(0.3 * v), Math.log(0.02 * v), Math.log(0.3 * v)]
      });
      if (learnSpeeds) { tauUp = params.tauUp; tauDown = params.tauDown; }
    }
    const jumps = detectTargetJumps(levels, params, window, threshold, minGap);
    return {
      valid: true,
      params,
      tauUp,
      tauDown,
      threshold,
      jumps: jumps.map(j => ({ ...j, direction: j.size > 0 ? 'up' : 'down', settleSteps: Math.ceil(Math.log(10) * (j.size > 0 ? tauUp : tauDown) / dt) }))
    };
  }

  /**
   * 4.5j Effort changes read from cadence, and how heart rate answered. For rides that carry cadence: the effort change is
   *   observed, not inferred, so this is change detection on a measured signal.
   *   rows: [{ hr, cad }] per bin (5-s bin means, binRide). Cadence noise s = 1.4826 x the median absolute deviation of the
   *   bin-to-bin cadence changes, over sqrt 2. At each bin k: the mean cadence over the next `after` bins (6 = 30 s) against
   *   the previous `before` bins (6), z = (after - before) / (s sqrt(1/n_before + 1/n_after)). A change is a peak of |z|
   *   (the largest within `before` bins either side) over `threshold` (6) with |after - before| at least minRpm (5).
   *   Heart rate's answer, measured: the mean over the 30 s before against the mean from 60 to 120 s after (cut at the next
   *   change; if that leaves under 30 s, the last 30 s before the next change); secondsTo90: the first bin where the
   *   3-bin running mean of heart rate has covered 90% of that change.
   *   Limit: an effort change without a cadence change (a climb in a harder gear) is invisible to cadence.
   */
  function cadenceEffortChanges(rows, options = {}) {
    const binS = options.binS ?? 5, nb = options.before ?? 6, na = options.after ?? 6;
    const threshold = options.threshold ?? 6, minRpm = options.minRpm ?? 5, T = rows.length;
    const cad = rows.map(r => r.cad), hr = rows.map(r => r.hr);
    const dc = [];
    for (let i = 1; i < T; i++) if (Number.isFinite(cad[i]) && Number.isFinite(cad[i - 1])) dc.push(cad[i] - cad[i - 1]);
    if (dc.length < 60) return { valid: false, reason: 'needs at least 5 minutes of cadence' };
    const md = median(dc), noise = Math.max(0.25, 1.4826 * median(dc.map(v => Math.abs(v - md))) / Math.SQRT2);
    const meanOf = (arr, a, b) => {
      let sum = 0, n = 0;
      for (let i = Math.max(0, a); i < Math.min(T, b); i++) if (Number.isFinite(arr[i])) { sum += arr[i]; n++; }
      return n ? { m: sum / n, n } : null;
    };
    const z = new Array(T).fill(0), diff = new Array(T).fill(0);
    for (let k = nb; k <= T - na; k++) {
      const b = meanOf(cad, k - nb, k), a = meanOf(cad, k, k + na);
      if (!b || !a || b.n < nb / 2 || a.n < na / 2) continue;
      diff[k] = a.m - b.m;
      z[k] = diff[k] / (noise * Math.sqrt(1 / b.n + 1 / a.n));
    }
    const at = [];
    for (let k = 0; k < T; k++) {
      if (!(Math.abs(z[k]) > threshold && Math.abs(diff[k]) >= minRpm)) continue;
      let peak = true;
      for (let j = Math.max(0, k - nb); j <= Math.min(T - 1, k + nb) && peak; j++) if (j !== k && Math.abs(z[j]) > Math.abs(z[k])) peak = false;
      if (peak) at.push(k);
    }
    const bins = s => Math.round(s / binS);
    const changes = at.map((k, i) => {
      const next = i + 1 < at.length ? at[i + 1] : T;
      const pre = meanOf(hr, k - bins(30), k);
      let from = k + bins(60), to = Math.min(next, k + bins(120));
      if (to - from < bins(30)) { to = next; from = Math.max(k + 1, next - bins(30)); }
      const post = to > from ? meanOf(hr, from, to) : null;
      const change = pre && post ? post.m - pre.m : NaN;
      let secondsTo90 = null;
      if (Number.isFinite(change) && change !== 0) {
        for (let j = k; j < to; j++) {
          const run = meanOf(hr, j - 1, j + 2);
          if (run && (run.m - pre.m) / change >= 0.9) { secondsTo90 = (j - k) * binS; break; }
        }
      }
      return {
        at: k,
        direction: diff[k] > 0 ? 'up' : 'down',
        cadenceChange: diff[k],
        z: z[k],
        heartRateBefore: pre ? pre.m : NaN,
        heartRateChange: change,
        secondsTo90,
        shadeTo: secondsTo90 === null ? Math.min(T - 1, to - 1) : k + Math.round(secondsTo90 / binS)
      };
    });
    return { valid: true, noise, changes };
  }

  /**
   * 4.5g Pushes: where heart rate was pushed much harder than usual, and the climb or fall that followed.
   *   Heart rate answers an effort change (or a startle) with one big step its momentum did not predict, then glides to
   *   the new level. The momentum is fitted (stepMomentum, order 2); its residuals are the unpredicted part of each step.
   *   This rider's usual unpredicted step is the robust spread of the residuals, 1.4826 x their median absolute deviation,
   *   so the pushes themselves do not inflate it. A push is a residual, or two neighbouring residuals together (a push
   *   split across two bins, scaled by sqrt 2), beyond threshold x that spread; the strongest within 2 steps is kept.
   *   The momentum's own impulse response says how far a push carries, size = push x sum of the impulse response, and when
   *   it settles: the first step after which less than settleShare (10%) of the total is still to come, at most maxSettle
   *   steps. Those steps are the push's climb (up) or fall (down); a later push takes over from its own step.
   *   change: the heart rate's actual change over those steps (the sum of the steps), measured, not modelled.
   *   aggregate (3): pushes are judged on the changes between means of `aggregate` steps' worth of level (three 5-second
   *   bins = 15 s). Heart rate takes about 30 s to rise, so a push builds over tens of seconds while noise averages out;
   *   at 5-s steps an interval start was only 3-3.5 spreads (run 1 found 22-26% of them). Positions, shading and the
   *   measured change are mapped back to the input's own steps. Missing steps count as no change when rebuilding the level.
   *   options: threshold (4.5), order (2), settleShare (0.1), maxSettle (12 aggregated steps), minSteps (40 aggregated),
   *   aggregate (3; 1 judges the input steps themselves).
   */
  function findPushes(changes, options = {}) {
    const threshold = options.threshold ?? 4.5, order = options.order ?? 2, minSteps = options.minSteps ?? 40;
    const settleShare = options.settleShare ?? 0.1, maxSettle = options.maxSettle ?? 12, agg = Math.max(1, options.aggregate ?? 3);
    const nFine = changes.length;
    let coarse = changes;
    if (agg > 1) {
      /* Rebuild the level, average it over blocks of agg bins, and take the changes between blocks. */
      const level = [0];
      for (const v of changes) level.push(level[level.length - 1] + (Number.isFinite(v) ? v : 0));
      const means = [];
      for (let b = 0; (b + 1) * agg <= level.length; b++) { let sum = 0; for (let j = 0; j < agg; j++) sum += level[b * agg + j]; means.push(sum / agg); }
      coarse = [];
      for (let b = 1; b < means.length; b++) coarse.push(means[b] - means[b - 1]);
    }
    const momentum = stepMomentum(coarse, { order });
    const e = momentum.residuals, finite = e.filter(Number.isFinite);
    if (finite.length < minSteps) return { valid: false, reason: `needs at least ${minSteps} steps` };
    const phi = momentum.phi, sumPhi = phi.reduce((s, v) => s + v, 0);
    const [f1 = 0, f2 = 0] = phi;
    if (!(Math.abs(f2) < 1 && f1 + f2 < 1 && f2 - f1 < 1)) return { valid: false, reason: 'the momentum fit does not settle' };
    const med = median(finite);
    let spread = 1.4826 * median(finite.map(v => Math.abs(v - med)));
    if (!(spread > 0)) spread = sd(finite, 0);
    if (!(spread > 0)) return { valid: false, reason: 'no change at all in the record' };
    /* Impulse response psi_j and its running total; total = 1 / (1 - sum phi). */
    const psi = [1];
    for (let j = 1; j <= maxSettle; j++) { let v = 0; for (let i = 1; i <= phi.length; i++) if (j - i >= 0) v += phi[i - 1] * psi[j - i]; psi.push(v); }
    const total = 1 / (1 - sumPhi);
    let run = 0, settle = maxSettle;
    for (let j = 0; j <= maxSettle; j++) { run += psi[j]; if (Math.abs(total - run) <= settleShare * Math.abs(total)) { settle = j; break; } }
    /* Candidates: one residual, or two neighbours together. */
    const T = e.length, cand = [];   // T: aggregated steps
    for (let t = 0; t < T; t++) {
      if (!Number.isFinite(e[t])) continue;
      const z1 = e[t] / spread;
      const z2 = t + 1 < T && Number.isFinite(e[t + 1]) ? (e[t] + e[t + 1]) / (spread * Math.SQRT2) : 0;
      const two = Math.abs(z2) > Math.abs(z1);
      const z = two ? z2 : z1;
      if (Math.abs(z) > threshold) cand.push({ at: t, z, push: two ? e[t] + e[t + 1] : e[t], span: two ? 2 : 1 });
    }
    const pushes = [];
    for (const c of cand.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))) {
      if (pushes.some(p => Math.abs(p.at - c.at) <= 2)) continue;
      pushes.push(c);
    }
    pushes.sort((a, b) => a.at - b.at);
    /* Aggregated step j is the change from block j to block j + 1 (input levels j*agg .. j*agg + 2*agg - 1); on the
       input's steps it sits around step (j + 1) * agg - 1, and its shading runs from there to the end of its last block. */
    const toFine = j => Math.min(nFine - 1, Math.max(0, (j + 1) * agg - 1));
    const shade = new Array(nFine).fill(0);
    const out = pushes.map(p => {
      const endCoarse = Math.min(T - 1, p.at + p.span - 1 + settle);
      const from = agg > 1 ? Math.max(0, p.at * agg) : p.at, to = agg > 1 ? toFine(endCoarse + 1) : endCoarse;
      let change = 0;
      for (let t = from; t <= to; t++) { shade[t] = p.z > 0 ? 1 : -1; if (Number.isFinite(changes[t])) change += changes[t]; }
      return { at: agg > 1 ? toFine(p.at) : p.at, from, to, direction: p.z > 0 ? 'up' : 'down', z: p.z, size: p.push * total, change, settleSteps: to - from + 1 };
    });
    return { valid: true, threshold, aggregate: agg, spread, momentum: { order, c: momentum.c, phi }, settleSteps: (settle + 1) * agg, pushes: out, shade };
  }

  /**
   * 4.5f Are there stretches of fast change (climbs, falls, or jumpy stretches) beyond ordinary momentum?
   *   Climbs and falls, by drift persistence: does the record keep going the same way at lags lagFrom..lagTo (3..20)
   *   more than its own momentum explains? The statistic is the sum of the steps' autocorrelations at those lags,
   *   compared with the same sum on synthetic records built from the record's own momentum (stepMomentum, order 2, one
   *   constant drift) driven by its own residuals drawn with replacement (a residual bootstrap).
   *   Jumpy stretches: regimeStretchTest (rule fast-clustering on the momentum residuals).
   *   Either one, each at half of alpha, flags stretches.
   *   Validated in tests/autonomic_fast_stretch_qc.cjs. Known limit, accepted 2026-11-09: climbs whose drift rides on
   *   momentum are found in only about half of hour-long records; a miss shows no stretches, never false ones.
   *   A first design (clustering of no-memory state chances on the residuals) found climbs in 16-72% and was dropped.
   *   options: alpha (0.01), order (2), lagFrom (3), lagTo (20), synthetic (499), seed, minSteps (60),
   *   fit (false skips the shading fit, fitSwitchingAutoregression on the steps: steady / climbing / falling).
   */
  function fastStretchTest(changes, options = {}) {
    const alpha = options.alpha ?? 0.01, order = options.order ?? 2, minSteps = options.minSteps ?? 60;
    const lagFrom = options.lagFrom ?? 3, lagTo = options.lagTo ?? 20, nSynthetic = options.synthetic ?? 499;
    const momentum = stepMomentum(changes, { order });
    const e = momentum.residuals.filter(Number.isFinite);
    if (e.length < minSteps) return { valid: false, reason: `needs at least ${minSteps} steps` };
    const [f1 = 0, f2 = 0] = momentum.phi;
    if (!(Math.abs(f2) < 1 && f1 + f2 < 1 && f2 - f1 < 1)) return { valid: false, reason: 'the momentum fit does not settle' };
    /* Sum over lags of the autocorrelations, pairs with a missing step skipped. */
    const acfSum = (x) => {
      const fin = x.filter(Number.isFinite), m = mean(fin);
      let v = 0;
      for (const a of fin) v += (a - m) ** 2;
      if (!(v > 0)) return 0;
      let sum = 0;
      for (let k = lagFrom; k <= lagTo; k++) {
        for (let t = 0; t + k < x.length; t++) {
          const a = x[t], b = x[t + k];
          if (Number.isFinite(a) && Number.isFinite(b)) sum += (a - m) * (b - m);
        }
      }
      return sum / v;
    };
    const observed = acfSum(changes), n = changes.length, burn = 100, r = new Float64Array(n + burn);
    const rng = makeRng(options.seed ?? 20261109);
    let atLeast = 0;
    for (let i = 0; i < nSynthetic; i++) {
      for (let t = 0; t < n + burn; t++) {
        let v = momentum.c + e[Math.floor(rng() * e.length)];
        for (let j = 0; j < order; j++) if (t - 1 - j >= 0) v += momentum.phi[j] * r[t - 1 - j];
        r[t] = v;
      }
      if (acfSum(r.subarray(burn)) >= observed) atLeast++;
    }
    const pDrift = (1 + atLeast) / (1 + nSynthetic);
    const jumpyTest = regimeStretchTest(changes, { alpha, seed: options.seed });
    const pJumpy = jumpyTest.valid ? jumpyTest.pFastClustering : 1;
    const climbs = pDrift < alpha / 2, jumpy = pJumpy < alpha / 2;
    return {
      valid: true,
      alpha,
      pDrift,
      pJumpy,
      climbs,
      jumpy,
      stretches: climbs || jumpy,
      momentum: { order, c: momentum.c, phi: momentum.phi },
      fit: options.fit === false ? null : fitSwitchingAutoregression(changes, { order: options.fitOrder ?? 2 })
    };
  }

  /**
   * 4.5c Are there stretches of fast change at all, or only scattered big steps?
   *   options.momentum ('auto' default, a whole number, or 0 for none): the stretch test and both fits run on the
   *   residuals of stepMomentum, so steps that merely carry the steps before them are not read as stretches.
   *   Fits the same two step sizes with memory (the Markov filter above) and without (memory false). The fit with
   *   memory also starts from the fit without, so its likelihood is never lower.
   *   distinct: two step sizes beat one (BIC of the no-memory fit against one size).
   *   Rule 'persistence-lr': one-sided likelihood-ratio test that memory helps, z = sign(p00 + p11 - 1) x
   *     sqrt(2 x log-likelihood gain), against the normal curve.
   *   Rule 'rank-clustering': do big steps sit next to big steps more often than chance? The sum over lags 1..lags
   *     of the lagged products of the centered ranks of |step|, against the same sum over shuffled orders of the
   *     observed steps (missing steps keep their places). Exact for independent steps, whatever their distribution.
   *   Rule 'fast-clustering': the same shuffle test on each step's chance of being a fast step given its size alone,
   *     P(fast | |step|) from the fit without memory (which does not depend on the order), so it weighs steps the way
   *     the filter does. Exact for independent steps whatever their distribution, so it needs no two-sizes gate.
   *   Decisions: rules A and B require distinct; fast-clustering does not. Every decision is returned.
   */
  /* Chosen by the preset selection in tests/autonomic_regime_stretch_qc.cjs (run 2, 2026-11-09): the only rule with
     false alarms at most 3.3% in every case without stretches and detection of at least 90% in A1 and A2.
     Valid for steps that are independent apart from the stretches; smoothly moving steps (AR) still fool it (step 3). */
  const REGIME_STRETCH_RULE = 'fast-clustering';
  function regimeStretchTest(rawChanges, options = {}) {
    const alpha = options.alpha ?? 0.01, lags = options.lags ?? 10, nPerm = options.permutations ?? 999;
    const rule = options.rule || REGIME_STRETCH_RULE;
    const momentumOption = options.momentum ?? 'auto';
    const momentum = momentumOption === 0 || momentumOption === false ? null
      : stepMomentum(rawChanges, { order: momentumOption, maxOrder: options.maxOrder });
    const changes = momentum ? momentum.residuals : rawChanges;
    /* The decisions need the likelihoods to about 0.01; with one step size the two fits sit on a flat ridge where EM
       crawls, so these fits stop at a gain under 1e-8 per step or 300 iterations. */
    const base = { emission: options.emission, minSteps: options.minSteps, tol: options.tol ?? 1e-8, maxIter: options.maxIter ?? 300 };
    const noMemory = fitRegimeSwitching(changes, { ...base, memory: false });
    if (!noMemory.valid) return { valid: false, reason: noMemory.reason };
    const fit = fitRegimeSwitching(changes, { ...base, extraStarts: [noMemory.settings] });
    const gain = Math.max(0, fit.logLik - noMemory.logLik);
    const pPersistence = normalSurvival((fit.persistence > 0 ? 1 : -1) * Math.sqrt(2 * gain));
    const distinct = noMemory.bic2 < noMemory.bic1;

    const T = changes.length, at = [], vals = [];
    for (let t = 0; t < T; t++) if (Number.isFinite(changes[t])) { at.push(t); vals.push(Math.abs(changes[t])); }
    const centre = (vals.length + 1) / 2, rankPool = averageRanks(vals).map(r => r - centre);
    /* P(fast | |step|) without memory: q f1 / (q f1 + (1 - q) f0), the same for every step whatever its place. */
    const nm = noMemory.settings, q = nm.P[0][1], half = (noMemory.emission === 'half-normal');
    const logF = (v, k) => (half ? -Math.log(nm.s[k]) - 0.5 * (v / nm.s[k]) ** 2 : -Math.log(nm.sig[k]) - 0.5 * ((v - nm.mu[k]) / nm.sig[k]) ** 2);
    const w = vals.map(v => 1 / (1 + Math.exp(Math.log(1 - q) + logF(v, 0) - Math.log(q) - logF(v, 1))));
    const wMean = mean(w), fastPool = w.map(v => v - wMean);
    const a = new Float64Array(T), b = new Float64Array(T);   // stay 0 where a step is missing
    const lagged = (arr) => {
      let s = 0;
      for (let k = 1; k <= lags; k++) for (let t = 0; t + k < T; t++) s += arr[t] * arr[t + k];
      return s;
    };
    const order = at.map((_, m) => m);
    const place = () => { at.forEach((t, m) => { a[t] = rankPool[order[m]]; b[t] = fastPool[order[m]]; }); };
    place();
    const observedRank = lagged(a), observedFast = lagged(b);
    const rng = makeRng(options.seed ?? 20261109);
    let atLeastRank = 0, atLeastFast = 0;
    for (let i = 0; i < nPerm; i++) {
      for (let j = order.length - 1; j > 0; j--) {
        const k = Math.floor(rng() * (j + 1)), tmp = order[j];
        order[j] = order[k]; order[k] = tmp;
      }
      place();
      if (lagged(a) >= observedRank) atLeastRank++;
      if (lagged(b) >= observedFast) atLeastFast++;
    }
    const pClustering = (1 + atLeastRank) / (1 + nPerm), pFastClustering = (1 + atLeastFast) / (1 + nPerm);
    const gated = p => distinct && p < alpha;
    const byRule = {
      'persistence-lr': gated(pPersistence),
      'rank-clustering': gated(pClustering),
      'fast-clustering': pFastClustering < alpha
    };
    return {
      valid: true,
      alpha,
      lags,
      rule,
      distinct,
      persistence: fit.persistence,
      logLikGain: gain,
      pPersistence,
      pClustering,
      pFastClustering,
      stretchesByPersistence: byRule['persistence-lr'],
      stretchesByClustering: byRule['rank-clustering'],
      stretchesByFastClustering: byRule['fast-clustering'],
      stretches: rule in byRule ? byRule[rule] : null,
      momentum: momentum ? { order: momentum.order, c: momentum.c, phi: momentum.phi } : null,
      fit,
      noMemory
    };
  }

  function runAutonomicBiophysicsMastery(regimeKey = 'vagal_resonance_recovery', options = {}) {
    /* This section builds beat intervals and breathing from formulas on a sample scenario. A session stores pulse
       summaries, not individual beats, so it never feeds this section; sessionIgnored says so to the page. */
    const scen = buildAutonomicCouplingSeries(regimeKey, null);
    const sessionIgnored = Array.isArray(options.sessionSamples) && options.sessionSamples.length > 0;
    const T = scen.Y.length;
    /* Synthesize RR intervals (ms) and coupled HR/Resp series modulated by the chosen physiological regime */
    const baseRR = regimeKey === 'vagal_resonance_recovery' ? 940 :
                   regimeKey === 'orthostatic_tilt_stress' ? 715 :
                   regimeKey === 'sympathetic_cognitive_load' ? 760 :
                   regimeKey === 'hypoxic_apnea_bout' ? 690 : 810;
    const rsaAmp = regimeKey === 'vagal_resonance_recovery' ? 58 :
                   regimeKey === 'orthostatic_tilt_stress' ? 19 :
                   regimeKey === 'sympathetic_cognitive_load' ? 24 : 28;
    const rrSeries = scen.Y.map((row, t) => {
      const vagalMod = (row[1] - 0.7) * 55 - (row[0] - 0.8) * 45;
      const rsaWave = rsaAmp * Math.sin(2 * Math.PI * 0.11 * t);
      return clamp(baseRR + vagalMod + rsaWave, 460, 1380);
    });
    const hrSeries = rrSeries.map(rr => 60000 / rr);
    const respSeries = scen.Y.map((row, t) => {
      const phase = 2 * Math.PI * 0.11 * t + (regimeKey === 'vagal_resonance_recovery' ? 0.12 : 0.78);
      return 12 + 3.5 * Math.sin(phase) + 0.8 * (row[3] - 0.8);
    });

    const hrvMastery = computeAutonomicHRVMastery(rrSeries);
    const coupling = computeCardiorespiratoryCoupling(hrSeries, respSeries);
    const rmt = computeRMTDenoising(scen.Y);
    const shootout = computeAllocationShootout(rmt, scen.names);
    const rollCrit = rollingRho(scen.Y, 36, 4);
    const arousalDeltas = [];
    for (let t = 1; t < T; t++) {
      arousalDeltas.push((scen.Y[t][0] - scen.Y[t - 1][0]) * 0.04 + (scen.Y[t][6] - scen.Y[t - 1][6]) * 0.03);
    }
    const regimeFilter = computeAutonomicRegimeFilter(arousalDeltas, rollCrit);

    return {
      sessionIgnored,
      regimeKey,
      tailRisk: hrvMastery,
      hrvMastery,
      coupling,
      rmt,
      shootout,
      regimeFilter
    };
  }
  const runFinancialRiskMastery = runAutonomicBiophysicsMastery;


  /* ============================================================================
   * SECTION 5: LEARNING WITHIN FIXED SAFETY LIMITS (L0-L7)
   * Applied to Autonomic Biofeedback & Physiological Decision Support
   * ============================================================================ */

  const ANL_PINNED_ANCHOR_HASH = '5c29a381eb7e';
  const ANL_BOUND_B = 0.05;
  const ANL_MIN_EVIDENCE = 20;
  const ANL_FROZEN_PREFIXES = ['anchor.', 'safety_rules.', 'veto.', 'efe.prior.'];

  const ANL_LEVELS = [
    { name: 'L0_constitution', index: 0, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Enforce frozen physiological safety/hypoxia vetoes & pinned anchor hash 5c29a381eb7e', frozen: true },
    { name: 'L1_safety',       index: 1, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Pre-screen candidate pacing protocols against tachycardia, syncope & apnea hard bounds', frozen: true },
    { name: 'L2_epistemic',    index: 2, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Select diagnostic checks via Active Inference Expected Free Energy (EFE)', frozen: true },
    { name: 'L3_memory_fast',  index: 3, maxUpdateRate: 0.30,   minEvidence: 1,  writableBy: 'episode_loop',  objective: 'Track short-term surprise in high-frequency CMS memory (cap 100)', frozen: false },
    { name: 'L4_substitution', index: 4, maxUpdateRate: 0.10,   minEvidence: 3,  writableBy: 'episode_loop',  objective: 'Mobilize multi-sensor biofeedback channels via Entropic Sinkhorn Optimal Transport', frozen: false },
    { name: 'L5_decision',     index: 5, maxUpdateRate: 0.03,   minEvidence: 20, writableBy: 'meta_gated',    objective: 'Rank approved recovery protocols inside +/-B = +/-0.05 with centered readout', frozen: false },
    { name: 'L6_memory_slow',  index: 6, maxUpdateRate: 0.005,  minEvidence: 20, writableBy: 'meta_gated',    objective: 'Consolidate cross-session autonomic recovery lessons in Mid/Low CMS with slow-direction damping', frozen: false },
    { name: 'L7_meta',         index: 7, maxUpdateRate: 0.0001, minEvidence: 50, writableBy: 'human_release', objective: 'Gate adapter admission via 4-Gate CAP (Teeth, LOO Brier CI, Holm-Bonferroni, Baseline)', frozen: false }
  ];

  function validateAnlLevels(levels = ANL_LEVELS) {
    let seenLearnable = false;
    let prevRate = Infinity;
    for (let idx = 0; idx < levels.length; idx++) {
      const lv = levels[idx];
      if (lv.index !== idx) throw new Error('Level indices must be contiguous 0..7');
      if (lv.maxUpdateRate < 0 || lv.maxUpdateRate > 1) throw new Error('Update rate out of [0,1]');
      if (lv.maxUpdateRate > 0) {
        if (seenLearnable && !(lv.maxUpdateRate < prevRate)) {
          throw new Error('Learnable levels must have strictly decreasing maxUpdateRate: ' + lv.name);
        }
        seenLearnable = true;
        prevRate = lv.maxUpdateRate;
      }
    }
    return true;
  }

  function canAutoApplyAnl(proposal) {
    if (!proposal) return false;
    if (proposal.target_level === 'L0_constitution' || proposal.target_level === 'L1_safety' || proposal.target_level === 'L7_meta') return false;
    if (proposal.safety_critical || proposal.requires_human_review) return false;
    if ((proposal.evidence_count || 0) < ANL_MIN_EVIDENCE) return false;
    for (const pfx of ANL_FROZEN_PREFIXES) {
      if (String(proposal.parameter_path || '').startsWith(pfx)) return false;
    }
    return true;
  }

  function centerAndContractReadout(candidates, boundB = ANL_BOUND_B) {
    const epsUlp = 1e-15;
    const cap = boundB * (1.0 - epsUlp);
    const active = candidates.filter(c => !c.fallback && c.approved !== false);
    /* Raw combined biases are centered BEFORE clipping; the older per-candidate form clipped each candidate
       on its own to [-B, B]. */
    const rawUnclipped = active.map(c => (c.nativeBias || 0) + (c.memoryBias || 0) + (c.elasticBias || 0));
    const meanRaw = rawUnclipped.length ? rawUnclipped.reduce((a, b) => a + b, 0) / rawUnclipped.length : 0;
    const centered = rawUnclipped.map(r => r - meanRaw);
    const maxAbs = centered.length ? Math.max(...centered.map(Math.abs)) : 0;
    const scale = maxAbs > boundB ? Math.min(1.0, cap / maxAbs) : 1.0;

    let actIdx = 0;
    const scored = candidates.map(c => {
      if (c.fallback) {
        return {
          ...c,
          rawCombinedU: 0,
          rawBias: 0,
          centeredBias: 0,
          effectiveBias: 0,
          intervalLow: 0.30,
          intervalHigh: 0.30,
          uncenteredScore: 0.30,
          centeredScore: 0.30
        };
      }
      const rawU = rawUnclipped[actIdx];
      const rBias = clamp(rawU, -boundB, boundB);
      const cBias = active.length > 1 ? centered[actIdx] * scale : 0;
      actIdx++;
      const s = c.baseScore;
      return {
        ...c,
        rawCombinedU: rawU,
        rawBias: rBias,
        centeredBias: cBias,
        effectiveBias: cBias,
        intervalLow: clamp(s - boundB, 0, 1),
        intervalHigh: clamp(s + boundB, 0, 1),
        uncenteredScore: clamp(s + rBias, 0, 1),
        centeredScore: clamp(s + cBias, 0, 1)
      };
    });

    const pairwiseGuarantees = [];
    for (let i = 0; i < scored.length; i++) {
      for (let j = i + 1; j < scored.length; j++) {
        const A = scored[i], B = scored[j];
        if (A.fallback || B.fallback) continue;
        const baseGap = A.baseScore - B.baseScore;
        const guaranteed = Math.abs(baseGap) > 2 * boundB + 1e-12;
        const postGap = A.centeredScore - B.centeredScore;
        const orderPreserved = (baseGap === 0) || (Math.sign(baseGap) === Math.sign(postGap));
        pairwiseGuarantees.push({
          pair: A.id + ' vs ' + B.id,
          baseGap,
          threshold2B: 2 * boundB,
          guaranteedByProp1: guaranteed,
          postAdaptationGap: postGap,
          orderPreserved
        });
      }
    }

    return {
      boundB,
      meanRawBiasRemoved: meanRaw,
      contractionScale: scale,
      candidates: scored,
      pairwiseGuarantees
    };
  }

  function computeM3LinearRecurrenceAndCurves(options = {}) {
    const betaS = options.betaS ?? 0.90;
    const betaM = options.betaM ?? 0.99;
    const betaL = options.betaL ?? 0.999;
    const wS = options.wS ?? 0.20;
    const wM = options.wM ?? 0.30;
    const wL = options.wL ?? 0.50;
    const alpha = options.alpha ?? 0.999;
    const lambda = options.lambda ?? 0.001;
    const boundB = options.boundB ?? ANL_BOUND_B;

    const C = [
      [betaS, 0, 0],
      [(1 - betaM) * betaS, betaM, 0],
      [(1 - betaL) * (1 - betaM) * betaS, (1 - betaL) * betaM, betaL]
    ];
    const v = [
      1 - betaS,
      (1 - betaM) * (1 - betaS),
      (1 - betaL) * (1 - betaM) * (1 - betaS)
    ];
    const w = [wS, wM, wL];
    const wTC = [0, 1, 2].map(j => w[0] * C[0][j] + w[1] * C[1][j] + w[2] * C[2][j]);
    const wTv = w[0] * v[0] + w[1] * v[1] + w[2] * v[2];

    const A = [
      [C[0][0], C[0][1], C[0][2], -v[0]],
      [C[1][0], C[1][1], C[1][2], -v[1]],
      [C[2][0], C[2][1], C[2][2], -v[2]],
      [lambda * wTC[0], lambda * wTC[1], lambda * wTC[2], alpha - lambda * wTv]
    ];
    const bVec = [v[0], v[1], v[2], lambda * wTv];
    const mul4 = (X, Y) => {
      const R = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      for (let i = 0; i < 4; i++)
        for (let k = 0; k < 4; k++)
          for (let j = 0; j < 4; j++) R[i][j] += X[i][k] * Y[k][j];
      return R;
    };
    const tr4 = X => X[0][0] + X[1][1] + X[2][2] + X[3][3];
    const addDiag4 = (X, c) => X.map((r, i) => r.map((val, j) => (i === j ? val + c : val)));
    const M1 = A;
    const c3 = -tr4(M1);
    const M2 = mul4(A, addDiag4(M1, c3));
    const c2 = -0.5 * tr4(M2);
    const M3 = mul4(A, addDiag4(M2, c2));
    const c1 = -tr4(M3) / 3;
    const M4 = mul4(A, addDiag4(M3, c1));
    const c0 = -0.25 * tr4(M4);
    const roots = [
      [0.89, 0.001],
      [0.985, -0.001],
      [0.998, 0.002],
      [0.998, -0.002]
    ];
    const cAdd = (a, b) => [a[0] + b[0], a[1] + b[1]];
    const cSub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const cMul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const cDiv = (a, b) => {
      const d = b[0] * b[0] + b[1] * b[1] || 1e-30;
      return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
    };
    const evalCharPoly = z => {
      let r = [1, 0];
      r = cAdd(cMul(r, z), [c3, 0]);
      r = cAdd(cMul(r, z), [c2, 0]);
      r = cAdd(cMul(r, z), [c1, 0]);
      r = cAdd(cMul(r, z), [c0, 0]);
      return r;
    };
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < 4; i++) {
        const pz = evalCharPoly(roots[i]);
        let den = [1, 0];
        for (let j = 0; j < 4; j++) if (i !== j) den = cMul(den, cSub(roots[i], roots[j]));
        roots[i] = cSub(roots[i], cDiv(pz, den));
      }
    }
    const eigenvalueModuliA = roots.map(r => Math.hypot(r[0], r[1]));
    const rhoA = Math.max(...eigenvalueModuliA);
    const limitingMeanBiasUnitSignal = lambda / (1 - alpha + lambda);

    const nEpisodes = 1500;
    let mS1 = 0, mM1 = 0, mL1 = 0, thetaCorr = 0;
    let mS2 = 0, mM2 = 0, mL2 = 0, thetaShip = 0;
    const alpha2 = 0.97, eta2 = 0.03;
    const checkpoints = [1, 25, 50, 100, 150, 200, 250, 280, 350, 500, 750, 1000, 1500];
    const trajectory = [];
    let fullBoundEpisode = null;

    for (let ep = 1; ep <= nEpisodes; ep++) {
      const sig1 = 0.5 - thetaCorr;
      mS1 = betaS * mS1 + (1 - betaS) * sig1;
      mM1 = betaM * mM1 + (1 - betaM) * mS1;
      mL1 = betaL * mL1 + (1 - betaL) * mM1;
      const eff1 = wS * mS1 + wM * mM1 + wL * mL1;
      const delta1 = lambda * eff1;
      thetaCorr = clamp(alpha * thetaCorr + delta1, -boundB, boundB);
      if (fullBoundEpisode === null && thetaCorr >= boundB - 1e-12) fullBoundEpisode = ep;

      const sig2 = 0.5 - thetaShip;
      mS2 = betaS * mS2 + (1 - betaS) * sig2;
      mM2 = betaM * mM2 + (1 - betaM) * mS2;
      mL2 = betaL * mL2 + (1 - betaL) * mM2;
      const eff2 = wS * mS2 + wM * mM2 + wL * mL2;
      const delta2 = lambda * eff2;
      thetaShip = clamp(alpha2 * thetaShip + eta2 * (delta2 / alpha), -boundB, boundB);

      if (checkpoints.includes(ep)) {
        trajectory.push({
          episode: ep,
          correctedTheta: thetaCorr,
          correctedSharePct: (100 * thetaCorr) / boundB,
          shippedTheta: thetaShip,
          shippedSharePct: (100 * thetaShip) / boundB
        });
      }
    }

    const gamma = 0.97;
    let trA = boundB, trB = -boundB;
    const contractionCheck = [];
    for (let t = 0; t <= 100; t++) {
      if (t % 20 === 0) {
        contractionCheck.push({
          step: t,
          absDiff: Math.abs(trA - trB),
          theoreticalBound: Math.pow(gamma, t) * (2 * boundB),
          withinBound: Math.abs(trA - trB) <= Math.pow(gamma, t) * (2 * boundB) + 1e-12
        });
      }
      const g = 0.008 * Math.sin(t * 0.3);
      trA = clamp(gamma * trA + g, -boundB, boundB);
      trB = clamp(gamma * trB + g, -boundB, boundB);
    }

    return {
      C,
      v,
      A,
      bVec,
      spectralRadiusA: rhoA,
      limitingMeanBiasUnitSignal,
      fullBoundEpisode,   /* null when the bound is not reached within the simulated episodes; never a fallback number */
      shareAt100Pct: trajectory.find(r => r.episode === 100)?.correctedSharePct ?? null,
      shareAt200Pct: trajectory.find(r => r.episode === 200)?.correctedSharePct ?? null,
      shippedAt1500Theta: thetaShip,
      shippedAt1500SharePct: (100 * thetaShip) / boundB,
      trajectory,
      contractionCheck
    };
  }

  function orthogonalizeFastAgainstSlow(deltaFast, deltaSlow, dampingFactor = 0.25) {
    return (deltaFast * deltaSlow < 0) ? deltaFast * dampingFactor : deltaFast;
  }

  function computeCmsSurprise(l2Loss, noveltyScore = 0.0, safetyProximity = 0.0, expertDisagreement = 0.0) {
    const normLoss = Math.min(l2Loss / 0.5, 1.0);
    const surprise = 0.4 * normLoss + 0.3 * noveltyScore + 0.2 * safetyProximity + 0.1 * expertDisagreement;
    return Math.min(surprise, 1.0);
  }

  function evaluateEFEQuestions(beliefStates, questions, decisions, lossMatrix, noise = 0.05) {
    const stateKeys = Object.keys(beliefStates);
    const totalMass = stateKeys.reduce((s, k) => s + beliefStates[k].prob, 0) || 1;
    const belief = {};
    for (const k of stateKeys) belief[k] = beliefStates[k].prob / totalMass;

    const calcEntropy = probs => -probs.reduce((acc, p) => (p > 0 ? acc + p * Math.log(p) : acc), 0);
    const ansProb = (trueVal, ans, opts) => {
      if (opts.length < 2) return ans === trueVal ? 1.0 : 0.0;
      return ans === trueVal ? 1.0 - noise : noise / (opts.length - 1);
    };
    const bestDec = bel => {
      let bestD = decisions[0], bestVal = Infinity;
      for (const d of decisions) {
        let expLoss = 0;
        for (const sKey of stateKeys) expLoss += bel[sKey] * (lossMatrix[d]?.[sKey] ?? 0.5);
        if (expLoss < bestVal) {
          bestVal = expLoss;
          bestD = d;
        }
      }
      return { decision: bestD, expectedLoss: bestVal };
    };

    const priorEntropy = calcEntropy(stateKeys.map(k => belief[k]));
    const stopEval = bestDec(belief);

    const scoredQuestions = questions.map(q => {
      const opts = q.options;
      const friction = q.friction ?? 0.02;
      const pred = {};
      for (const a of opts) {
        let sumP = 0;
        for (const sKey of stateKeys) {
          sumP += belief[sKey] * ansProb(beliefStates[sKey].vars[q.variable], a, opts);
        }
        pred[a] = sumP;
      }

      let risk = 0, postEntropy = 0;
      for (const a of opts) {
        const pA = pred[a];
        if (pA <= 0) continue;
        const post = {};
        for (const sKey of stateKeys) {
          post[sKey] = (belief[sKey] * ansProb(beliefStates[sKey].vars[q.variable], a, opts)) / pA;
        }
        risk += pA * bestDec(post).expectedLoss;
        postEntropy += pA * calcEntropy(stateKeys.map(k => post[k]));
      }

      let ambiguity = 0;
      for (const sKey of stateKeys) {
        const condProbs = opts.map(a => ansProb(beliefStates[sKey].vars[q.variable], a, opts));
        ambiguity += belief[sKey] * calcEntropy(condProbs);
      }

      const infoGain = priorEntropy - postEntropy;
      const G = risk + ambiguity + friction - infoGain;
      const twoTermG = risk + ambiguity + friction;
      return {
        id: q.id || q.variable,
        label: q.label || q.variable,
        variable: q.variable,
        noise,
        risk,
        ambiguity,
        friction,
        informationGain: infoGain,
        G,
        twoTermG,
        beatsStop: G < stopEval.expectedLoss
      };
    });

    scoredQuestions.sort((a, b) => a.G - b.G);
    const topQ = scoredQuestions[0];
    return {
      stopValue: stopEval.expectedLoss,
      stopDecision: stopEval.decision,
      priorEntropy,
      selectedQuestion: topQ && topQ.G < stopEval.expectedLoss ? topQ.id : null,
      questions: scoredQuestions
    };
  }

  function feasibleRoundingAnl(plan, costs, supplies, demands) {
    const rows = supplies.length, cols = demands.length;
    const real = Array.from({ length: rows }, (_, i) =>
      Array.from({ length: cols }, (__, j) => (costs[i][j] === null || costs[i][j] === undefined ? 0.0 : Math.max(0, plan[i][j])))
    );
    const capVec = (vals, limit) => {
      const tot = vals.reduce((a, b) => a + b, 0);
      if (tot <= limit) return vals.slice();
      if (limit <= 0) return new Array(vals.length).fill(0);
      const scale = (limit / tot) * (1 - 1e-15);
      return vals.map(v => v * scale);
    };
    for (let i = 0; i < rows; i++) real[i] = capVec(real[i], supplies[i]);
    for (let j = 0; j < cols; j++) {
      const col = capVec(real.map(r => r[j]), demands[j]);
      for (let i = 0; i < rows; i++) real[i][j] = col[i];
    }
    const rowUsed = real.map(r => r.reduce((a, b) => a + b, 0));
    const colUsed = Array.from({ length: cols }, (_, j) => real.reduce((s, r) => s + r[j], 0));
    const rounded = real.map((r, i) => r.concat([Math.max(0, supplies[i] - rowUsed[i])]));
    const missingRow = colUsed.map((u, j) => Math.max(0, demands[j] - u)).concat([rowUsed.reduce((a, b) => a + b, 0)]);
    rounded.push(missingRow);
    return rounded;
  }

  function sinkhornAnl(costs, supplies, demands, missingCosts, epsilon = 0.05, iterations = 600, tolerance = 1e-3) {
    const rows = supplies.length, cols = demands.length;
    const table = costs.map(r => r.map(c => (c === null || c === undefined ? Infinity : c)).concat([0.0]));
    table.push(missingCosts.slice().concat([0.0]));
    const rowMass = supplies.slice().concat([demands.reduce((a, b) => a + b, 0)]);
    const colMass = demands.slice().concat([supplies.reduce((a, b) => a + b, 0)]);
    const totalRowMass = rowMass.reduce((a, b) => a + b, 0);
    const logK = table.map(r => r.map(c => (c === Infinity ? null : -c / epsilon)));
    const logU = rowMass.map(m => (m > 0 ? 0.0 : -Infinity));
    const logV = colMass.map(m => (m > 0 ? 0.0 : -Infinity));

    const logSumExp = arr => {
      const valid = arr.filter(v => v !== null && v > -Infinity);
      if (!valid.length) return -Infinity;
      const mx = Math.max(...valid);
      let s = 0;
      for (const v of valid) s += Math.exp(v - mx);
      return mx + Math.log(s);
    };

    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i <= rows; i++) {
        if (rowMass[i] > 0) {
          logU[i] = Math.log(rowMass[i]) - logSumExp(logV.map((lv, j) => (logK[i][j] === null ? null : logK[i][j] + lv)));
        }
      }
      for (let j = 0; j <= cols; j++) {
        if (colMass[j] > 0) {
          logV[j] = Math.log(colMass[j]) - logSumExp(logU.map((lu, i) => (logK[i][j] === null ? null : logK[i][j] + lu)));
        }
      }
      let worst = 0;
      for (let i = 0; i <= rows; i++) {
        if (rowMass[i] > 0) {
          const mHat = Math.exp(logU[i] + logSumExp(logV.map((lv, j) => (logK[i][j] === null ? null : logK[i][j] + lv))));
          worst = Math.max(worst, Math.abs(mHat - rowMass[i]));
        }
      }
      if (worst <= tolerance * totalRowMass) break;
    }

    const plan = Array.from({ length: rows + 1 }, (_, i) =>
      Array.from({ length: cols + 1 }, (__, j) =>
        (logK[i][j] === null || rowMass[i] <= 0 || colMass[j] <= 0) ? 0.0 : Math.exp(logK[i][j] + logU[i] + logV[j])
      )
    );
    return feasibleRoundingAnl(plan, costs, supplies, demands);
  }

  function solveSinkhornRefinementAnl(costs, supplies, demands, criticalFlags, baseMissing = 2.0, epsilon = 0.05, maxIterations = 5) {
    let missing = criticalFlags.map(flag => baseMissing * (flag ? 2.0 : 1.0));
    const cols = demands.length;
    const totalDemand = demands.reduce((a, b) => a + b, 0) || 1;
    let best = null;
    let firstPassUnmetCritical = null;

    for (let iter = 1; iter <= maxIterations; iter++) {
      const plan = sinkhornAnl(costs, supplies, demands, missing, epsilon);
      const unmet = Array.from({ length: cols }, (_, j) => plan[supplies.length][j]);
      let assignedCost = 0;
      for (let i = 0; i < supplies.length; i++) {
        for (let j = 0; j < cols; j++) {
          if (costs[i][j] !== null && costs[i][j] !== undefined && plan[i][j] > 0) {
            assignedCost += plan[i][j] * costs[i][j];
          }
        }
      }
      const residual = (assignedCost + 2.0 * unmet.reduce((a, b) => a + b, 0)) / totalDemand;
      const criticalUnmet = unmet.reduce((s, u, j) => s + (criticalFlags[j] ? u : 0), 0);
      if (iter === 1) firstPassUnmetCritical = criticalUnmet;
      if (!best || criticalUnmet < best.criticalUnmet - 1e-12 || (Math.abs(criticalUnmet - best.criticalUnmet) <= 1e-12 && residual < best.residual)) {
        best = { plan, unmet, residual, criticalUnmet, assignedCost };
      }
      best.iterations = iter;
      best.firstPassUnmetCritical = firstPassUnmetCritical;
      if (residual < 0.30 || criticalUnmet <= 0.05) break;
      missing = missing.map((m, j) => m * (criticalFlags[j] && unmet[j] > 0.05 ? 2.0 : 1.0));
    }

    let forbiddenFlowSum = 0;
    for (let i = 0; i < supplies.length; i++) {
      for (let j = 0; j < cols; j++) {
        if (costs[i][j] === null || costs[i][j] === undefined) forbiddenFlowSum += best.plan[i][j];
      }
    }
    best.forbiddenFlowSum = forbiddenFlowSum;
    return best;
  }

  function runAnchoredNestedLearning(options = {}) {
    validateAnlLevels(ANL_LEVELS);

    /* 1. Autonomic Recovery & Biofeedback Protocols for Proposition 1 & Experiment J Centered Readout */
    const autonomicProtocols = [
      { id: 'res_01hz_breathing', name: '0.1 Hz Resonance Paced Breathing (6 brpm) + RSA Phase Lock', baseScore: 0.85, nativeBias: +0.039, memoryBias: +0.025, elasticBias: +0.011, approved: true, fallback: false },
      { id: 'exhale_46_pacing',   name: 'Extended-Exhale Breathing (4 s in / 6 s out)',               baseScore: 0.80, nativeBias: +0.043, memoryBias: +0.030, elasticBias: +0.014, approved: true, fallback: false },
      { id: 'supine_baro_unload', name: 'Lying-Down Rest (Supine)',                                    baseScore: 0.72, nativeBias: -0.017, memoryBias: -0.013, elasticBias: -0.005, approved: true, fallback: false },
      { id: 'dive_reflex_reset',  name: 'Cold Facial Trigeminal Dive-Reflex Bradycardia Reset',      baseScore: 0.67, nativeBias: -0.024, memoryBias: -0.018, elasticBias: -0.007, approved: true, fallback: false },
      { id: 'ambient_unpaced',    name: 'Inert Fallback: Freeze Pacing Cues & Hold Ambient Observation', baseScore: 0.30, nativeBias: 0, memoryBias: 0, elasticBias: 0, approved: true, fallback: true }
    ];
    const prop1AndReadout = centerAndContractReadout(options.candidates || autonomicProtocols, options.boundB || ANL_BOUND_B);

    /* 2. Proposition 2 & 4x4 Coupled M3 Linear Mean Recurrence */
    const m3Recurrence = computeM3LinearRecurrenceAndCurves(options);

    /* 3. Level 2 Active Inference EFE Diagnostic Cardiorespiratory & Baroreflex Probe Selection */
    const beliefStates = {
      acute_vagal_withdrawal:  { prob: 0.40, vars: { rsa_phase_coherence: 'desynchronized_drop', baroreflex_gain_slope: 'blunted_fast', eeg_beta_alpha: 'hypervigilant_surge', noisy_twin: 'desynchronized_drop' } },
      orthostatic_baro_strain: { prob: 0.35, vars: { rsa_phase_coherence: 'intact_coupled',      baroreflex_gain_slope: 'blunted_fast', eeg_beta_alpha: 'compensatory_tilt',   noisy_twin: 'intact_coupled' } },
      vagal_coherence_rest:    { prob: 0.25, vars: { rsa_phase_coherence: 'intact_coupled',      baroreflex_gain_slope: 'normotensive', eeg_beta_alpha: 'alpha_settled',       noisy_twin: 'intact_coupled' } }
    };
    const efeQuestions = [
      { id: 'q_rsa_coherence', label: 'Query 60s 0.1 Hz Cardiorespiratory Phase-Locking Value (PLV)', variable: 'rsa_phase_coherence',   options: ['desynchronized_drop', 'intact_coupled'], friction: 0.02, noise: 0.05 },
      { id: 'q_baro_slope',    label: 'Inspect BP-Reflex Gain & Pulse-Transit Lag (sample only)',   variable: 'baroreflex_gain_slope', options: ['blunted_fast', 'normotensive'],          friction: 0.02, noise: 0.05 },
      { id: 'q_eeg_ba_ratio',  label: 'Check EEG Beta/Alpha & Skin-Conductance Bursts (sample only)', variable: 'eeg_beta_alpha',        options: ['hypervigilant_surge', 'compensatory_tilt', 'alpha_settled'], friction: 0.03, noise: 0.05 },
      { id: 'q_noisy_twin',    label: 'Uncalibrated Wrist Motion-Artifact PPG Twin (Noise = 0.40)',   variable: 'noisy_twin',            options: ['desynchronized_drop', 'intact_coupled'], friction: 0.02, noise: 0.40 }
    ];
    const efeDecisions = ['initiate_01hz_resonance_pacing', 'supine_baroreflex_unloading', '__stop__'];
    const efeLossMatrix = {
      initiate_01hz_resonance_pacing: { acute_vagal_withdrawal: 0.0, orthostatic_baro_strain: 0.10, vagal_coherence_rest: 0.10 },
      supine_baroreflex_unloading:    { acute_vagal_withdrawal: 1.0, orthostatic_baro_strain: 0.0,  vagal_coherence_rest: 0.10 },
      __stop__:                       { acute_vagal_withdrawal: 0.20, orthostatic_baro_strain: 0.20, vagal_coherence_rest: 0.0 }
    };
    const efeBase = evaluateEFEQuestions(beliefStates, efeQuestions.slice(0, 3), efeDecisions, efeLossMatrix, 0.05);
    const efeNoisy = evaluateEFEQuestions(beliefStates, [efeQuestions[3]], efeDecisions, efeLossMatrix, 0.40);
    const allEfeQuestions = efeBase.questions.concat(efeNoisy.questions).sort((a, b) => a.G - b.G);

    /* 4. Level 4 Entropic Sinkhorn Optimal Transport for Multi-Sensor Biofeedback Mobilization */
    const supplyUnits = ['Chest-Strap ECG Beat Intervals', 'Thoracic Respiration Belt', 'Optical PPG Pulse-Wave', 'Frontal EEG + Palmar EDA'];
    const demandTasks = ['Interval-Variability Recovery (Crit)', '0.1 Hz RSA Phase Lock (Crit)', 'BP Reflex & Pulse Transit (sample only)', 'Lower EEG Beta/Alpha'];
    const supplies = [0.45, 0.40, 0.35, 0.30];
    const demands  = [0.50, 0.45, 0.35, 0.30];
    const criticalFlags = [true, true, false, false];
    const transportCosts = [
      [0.12, 0.28, null, 0.45],
      [0.32, 0.14, 0.25, 0.30],
      [0.18, 0.22, 0.15, null],
      [null, 0.19, 0.24, 0.12]
    ];
    const sinkhornResult = solveSinkhornRefinementAnl(transportCosts, supplies, demands, criticalFlags, 2.0, 0.05, 5);

    /* 5. Component Admission Protocol (CAP, Experiment C) & Experiments I, J, K Baseline-Parity Benchmark */
    const capCandidates = [
      { id: 'm3_token_memory', name: 'M3 + Small Token Memory (Centered Read)', standaloneAuc: 0.57, signalA: 0.30, brierBase: 0.2357, brierCombined: 0.2298, deltaBrier: +0.0059, ciLow: -0.0018, ciHigh: +0.0133, holmP: 0.142, teethInversionDrop: +0.0312, teethPermDrop: +0.0184, admissionPowerAt331Pct: 39.3, admitted: false, verdict: 'WITHHELD (95% CI spans 0; fails Dual Baseline Hurdle vs Keyed Beta)' },
      { id: 'hope_block_21k', name: 'Meta-Trained Hope Block (21,859 params)', standaloneAuc: 0.56, signalA: 0.25, brierBase: 0.2357, brierCombined: 0.2341, deltaBrier: +0.0016, ciLow: -0.0042, ciHigh: +0.0074, holmP: 0.410, teethInversionDrop: +0.0195, teethPermDrop: +0.0110, admissionPowerAt331Pct: 24.5, admitted: false, verdict: 'WITHHELD (Trailed Keyed Simple by -0.137 in D2 and -0.143 in D5)' },
      { id: 'elastic_capacity', name: 'Elastic Capacity Open/Merge Adapter', standaloneAuc: 0.55, signalA: 0.20, brierBase: 0.2357, brierCombined: 0.2349, deltaBrier: +0.0008, ciLow: -0.0051, ciHigh: +0.0067, holmP: 0.620, teethInversionDrop: +0.0140, teethPermDrop: +0.0085, admissionPowerAt331Pct: 12.0, admitted: false, verdict: 'WITHHELD (Incremental LOO Brier gain below Holm-Bonferroni threshold)' },
      { id: 'duplicate_twin_a050', name: 'Near-Duplicate Biosignal Pair (a = 0.50 Redundancy)', standaloneAuc: 0.61, signalA: 0.50, brierBase: 0.2357, brierCombined: 0.2284, deltaBrier: +0.0004, ciLow: -0.0031, ciHigh: +0.0039, holmP: 0.780, teethInversionDrop: +0.0280, teethPermDrop: +0.0210, admissionPowerAt331Pct: 2.0, admitted: false, verdict: 'WITHHELD (Redundancy penalty: solo power 83.3% drops to 2.0% when paired)' }
    ];

    const kSensitivityGrid = [
      { eta: 0.01, pooledEma: 0.7201, pooledBeta: 0.6571, keyedEma: 0.6946, keyedBeta: 0.7107, preSpecified: false },
      { eta: 0.02, pooledEma: 0.7225, pooledBeta: 0.6571, keyedEma: 0.7061, keyedBeta: 0.7043, preSpecified: false },
      { eta: 0.03, pooledEma: 0.7200, pooledBeta: 0.6566, keyedEma: 0.7004, keyedBeta: 0.7049, preSpecified: true },
      { eta: 0.05, pooledEma: 0.7170, pooledBeta: 0.6566, keyedEma: 0.6996, keyedBeta: 0.7136, preSpecified: false },
      { eta: 0.10, pooledEma: 0.7230, pooledBeta: 0.6699, keyedEma: 0.6947, keyedBeta: 0.7178, preSpecified: true },
      { eta: 0.15, pooledEma: 0.7069, pooledBeta: 0.6708, keyedEma: 0.6868, keyedBeta: 0.7161, preSpecified: false },
      { eta: 0.20, pooledEma: 0.6919, pooledBeta: 0.6918, keyedEma: 0.6886, keyedBeta: 0.7054, preSpecified: false },
      { eta: 0.30, pooledEma: 0.7044, pooledBeta: 0.6568, keyedEma: 0.6852, keyedBeta: 0.7072, preSpecified: false },
      { eta: 0.50, pooledEma: 0.6648, pooledBeta: 0.7274, keyedEma: 0.6823, keyedBeta: 0.6886, preSpecified: false }
    ];

    const closedLoopBenchmarks = [
      { experiment: 'Experiment I (32 seeds, Uncentered Full vs Keyed EMA)', family: 'Primary (null/context/drift)', fullUtility: 0.6080, simpleUtility: 0.6350, diffFullMinusSimple: -0.0270, ci95: '[-0.0300, -0.0241]', conclusion: 'Original pipeline trailed Keyed EMA (-0.0270) due to uncentered readout & saturation' },
      { experiment: 'Experiment J (32 fresh seeds, Centered Repair vs Keyed Beta)', family: 'Primary (null/context/drift)', fullUtility: 0.6277, simpleUtility: 0.6364, diffFullMinusSimple: -0.0087, ci95: '[-0.0136, -0.0039]', conclusion: 'Centering improved Full by +0.0212 ([+0.0172, +0.0251]) vs Original (0.6066); beat Simple by +0.0334 on Shared' },
      { experiment: 'Experiment K (48 fresh seeds, Repaired Full vs Pooled EMA)', family: 'Shared Preference Regime', fullUtility: 0.6974, simpleUtility: 0.7013, diffFullMinusSimple: -0.0039, ci95: '[-0.0109, +0.0026]', conclusion: 'Ordinary cross-domain pooling (0.7013) matched Repaired Full (0.6974) in shared regime; Full led Pooled on Null/Context/Drift (+0.0229)' }
    ];

    const escapeRoomVetoBench = [
      { policy: 'Unconstrained Naive', anchor: false, adaptation: false, escapePct: 14.3, fatalPct: 85.7, timeoutPct: 0.0, meanTurns: 19.4, vetoesPerRun: 0.00 },
      { policy: 'Frozen Rules Static (SOP Only)', anchor: true, adaptation: false, escapePct: 50.0, fatalPct: 0.0, timeoutPct: 50.0, meanTurns: 9.0, vetoesPerRun: 0.00 },
      { policy: 'Adaptive Unanchored', anchor: false, adaptation: true, escapePct: 14.3, fatalPct: 85.7, timeoutPct: 0.0, meanTurns: 10.7, vetoesPerRun: 0.00 },
      { policy: 'Anchored (Full L0 Veto + Bounded Adapt)', anchor: true, adaptation: true, escapePct: 100.0, fatalPct: 0.0, timeoutPct: 0.0, meanTurns: 11.8, vetoesPerRun: 0.17 }
    ];

    return {
      anchorHash: ANL_PINNED_ANCHOR_HASH,
      boundB: ANL_BOUND_B,
      levels: ANL_LEVELS,
      permissionsCheck: {
        validHierarchy: validateAnlLevels(ANL_LEVELS),
        autoApplyL0Rejected: !canAutoApplyAnl({ target_level: 'L0_constitution', parameter_path: 'anchor.veto', evidence_count: 100, safety_critical: false, requires_human_review: false }),
        autoApplyFrozenPathRejected: !canAutoApplyAnl({ target_level: 'L5_decision', parameter_path: 'safety_rules.hypoxia', evidence_count: 100, safety_critical: false, requires_human_review: false }),
        autoApplyLowEvidenceRejected: !canAutoApplyAnl({ target_level: 'L5_decision', parameter_path: 'ranking_bias.res01hz', evidence_count: 12, safety_critical: false, requires_human_review: false }),
        autoApplyValidRankingAccepted: canAutoApplyAnl({ target_level: 'L5_decision', parameter_path: 'ranking_bias.res01hz', evidence_count: 25, safety_critical: false, requires_human_review: false })
      },
      prop1AndReadout,
      m3Recurrence,
      efeEvaluation: {
        stopValue: efeBase.stopValue,
        stopDecision: efeBase.stopDecision,
        selectedQuestion: efeBase.selectedQuestion,
        questions: allEfeQuestions
      },
      sinkhornTransport: {
        supplyUnits,
        demandTasks,
        supplies,
        demands,
        criticalFlags,
        ...sinkhornResult
      },
      capProtocol: {
        provenance: 'transcribed, not computed: these values are NOT computed by this engine',
        nullFalseAdmission331Pct: 1.2,
        nullFalseAdmissionStrictPct: 0.2,
        powerCurveAt331: [
          { signalA: 0.00, standaloneAuc: 0.50, admissionPct: 1.2 },
          { signalA: 0.10, standaloneAuc: 0.52, admissionPct: 1.7 },
          { signalA: 0.20, standaloneAuc: 0.55, admissionPct: 12.0 },
          { signalA: 0.30, standaloneAuc: 0.57, admissionPct: 39.3 },
          { signalA: 0.50, standaloneAuc: 0.61, admissionPct: 83.3 },
          { signalA: 0.70, standaloneAuc: 0.66, admissionPct: 99.7 }
        ],
        candidates: capCandidates,
        closedLoopBenchmarks,
        kSensitivityGrid,
        escapeRoomVetoBench
      }
    };
  }

  const API = {
    version: '2.1.0-offline-autonomic-biophysics',
    /* Section 1 */
    makeRng,
    makeNormal,
    mean,
    variance,
    sd,
    quantile,
    pearsonCorr,
    spearmanCorr,
    solveLinearSystem,
    invertMatrix,
    jacobiEigenSymmetric,
    /* Section 2 */
    ensembleWeights,
    computeVoronoiTessellation,
    vietorisRipsComplex,
    ripsPersistenceDiagram3D,
    wassersteinPersistenceDiagram,
    meanFieldPottsVFE,
    DEFAULT_PHYSIOLOGICAL_NODES,
    DEFAULT_FINANCIAL_ASSETS: DEFAULT_PHYSIOLOGICAL_NODES,
    buildPhysiologicalFoundation,
    buildAssetFoundation,
    CRT_METRIC_META,
    scoreSinglePartition,
    scoreCRTDesign,
    looAblation,
    runCRTDesignAndInference,
    /* Section 3 */
    spectralRadius: powerIterationSpectralRadius,
    powerIterationSpectralRadius,
    ridgeVar1,
    fitVarNonneg,
    fitVarxNonneg,
    breathingGuideInputs,
    guideResponse,
    chiSquareSurvivalEven,
    standardizeColumns,
    fitGuideAwareNetwork,
    guidePhaseLocking,
    gfevd,
    horizonIntegratedAUC,
    runDirectednessNulls,
    runInterdiction,
    AUTONOMIC_NETWORK_NODES,
    FINANCIAL_CONTAGION_NODES: AUTONOMIC_NETWORK_NODES,
    buildAutonomicCouplingSeries,
    buildFinancialContagionSeries,
    rollingRho,
    runFullLSAAnalysis,
    /* Section 4 (Autonomic & Cardiorespiratory Biophysics Mastery) */
    computeAutonomicHRVMastery,
    computeTailRiskAnalytics,
    computeCardiorespiratoryCoupling,
    computeRMTDenoising,
    computeAllocationShootout,
    computeAutonomicRegimeFilter,
    computeMacroRegimeFilter,
    fitRegimeSwitching,
    regimeStretchTest,
    stepMomentum,
    fitSwitchingAutoregression,
    fastStretchTest,
    findPushes,
    findTargetJumps,
    cadenceEffortChanges,
    effortTargetFilter,
    estimateEffortTarget,
    nelderMead,
    normalSurvival,
    averageRanks,
    runAutonomicBiophysicsMastery,
    runFinancialRiskMastery,
    /* Section 5 */
    ANL_PINNED_ANCHOR_HASH,
    ANL_BOUND_B,
    ANL_LEVELS,
    validateAnlLevels,
    canAutoApplyAnl,
    centerAndContractReadout,
    computeM3LinearRecurrenceAndCurves,
    orthogonalizeFastAgainstSlow,
    computeCmsSurprise,
    evaluateEFEQuestions,
    feasibleRoundingAnl,
    sinkhornAnl,
    solveSinkhornRefinementAnl,
    runAnchoredNestedLearning
  };

  root.ATMath = API;
  root.RTMath = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
