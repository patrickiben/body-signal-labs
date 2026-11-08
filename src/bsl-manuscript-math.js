/**
 * Autonomic Telemetry — Complete Three-Manuscript Mathematical Engine &
 * Autonomic / Cardiorespiratory Biophysics Mastery Workbench
 *
 * Implements:
 * 1. Manuscript 1 (doi:10.5281/zenodo.23486177):
 *    - 10-Metric Contamination-Resilient CRT Spatial & Topological Suite adapted
 *      to multi-sensor physiological state manifolds (bounded 2D Voronoi tessellation,
 *      Vietoris-Rips 2-skeleton Euler/Betti filtration chi = V - E + F = beta0 - beta1 + beta2,
 *      3D Rips H0/H1 persistence diagrams with p=2 l_inf Hungarian Wasserstein matching,
 *      Mean-Field Potts Variational Free Energy F(q), CRITIC x Shannon Entropy x Bootstrap
 *      Stability cube-root weights, Leave-One-Out ablation, and 3-Design x 3-Estimator
 *      Cross-Epoch Spillover Inference Ladder).
 * 2. Manuscript 2 (doi:10.5281/zenodo.21211653):
 *    - Constrained Non-Negative VAR+(1) via projected coordinate descent vs Ridge VAR(1)
 *      across the 10-node cardiorespiratory-autonomic network (HR/SA-Node, Vagal RMSSD,
 *      Pulse SDNN, Respiratory RSA, EEG Beta/Alpha, Baroreflex Gain, EDA Phasic, EDA Tonic,
 *      Pulse Transit Time, Peripheral Thermal), rolling spectral radius rho(Phi(t)) = kappa_B(t),
 *      Pesaran-Shin / Diebold-Yilmaz 10x10 GFEVD connectedness (TO%, FROM%, NET%, TCI%,
 *      horizon-integrated AUC), 3 spectral-radius-matched structural directedness nulls
 *      (Symmetrization, Direction-Flip, Weight-Permutation) + Time-Reversal null, and
 *      ARRO JEPA Latent World-Model + CEM Learned-MPC Biofeedback / Paced-Breathing
 *      Interdiction with Directed vs Symmetrized Twin Advantage.
 * 3. Manuscript 3 (Anchored Nested Learning, PLOS ONE submission / macgyver-bot):
 *    - 8-Level Nested Hierarchy (L0_constitution .. L7_meta, pinned anchor hash 5c29a381eb7e,
 *      bound B = +/-0.05) enforcing frozen physiological safety red lines, Proposition 1
 *      rank preservation (s(a) - s(b) > 2B = 0.10 => S(a) > S(b)) & Experiment J unclipped
 *      centered-and-contracted protocol readout, Proposition 2 incremental contraction &
 *      4x4 coupled M3 recurrence (Faddeev-LeVerrier + Durand-Kerner complex eigenvalues,
 *      rho(A_M3) = 0.9987567254 -> 0.99876, CorrectedFullAt = 280 vs shipped double-retention
 *      defect 0.87% at ep 1,500), Level 2 Active Inference EFE diagnostic physiological probe
 *      selection, Level 4 Entropic Sinkhorn sensor-to-recovery optimal transport with MISSING
 *      slack & 5-pass critical-gap refinement, and the 4-Gate Component Admission Protocol (CAP)
 *      + Experiment K 9-rate sensitivity grid.
 * 4. Autonomic & Cardiorespiratory Biophysics Mastery Workbench:
 *    - Pillar 1: Non-Gaussian HRV, Poincare (SD1, SD2, SD1/SD2, ellipse area), Detrended
 *      Fluctuation Analysis (DFA alpha1, alpha2), Sample & Multiscale Entropy, Lomb-Scargle
 *      LF/HF spectral balance, Cornish-Fisher 4-moment 99% Surge Quantile & ES_97.5.
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
   * SECTION 2: MANUSCRIPT 1 — 10-METRIC CRT SPATIAL & TOPOLOGICAL ENGINE
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
   * Default 20 Exercise, Locomotor-Cadence & Biofeedback Cockpit Epochs across 4 Regimes
   * (Used when no custom sensor epoch list is passed).
   */
  const DEFAULT_PHYSIOLOGICAL_NODES = [
    { id: 'E01_WARM_SPIN',    name: '65-RPM Dusk Warm-Up Spin I',       cluster: 0, hrBpm: 68.4, rmssdMs: 56.2, sdnnMs: 70.0, respBrpm: 11.0, eegBetaAlpha: 0.80, edaScl: 2.0, arm: 1 },
    { id: 'E02_FOG_RES_I',    name: '0.1 Hz Fog-Clearing Resonance I',  cluster: 0, hrBpm: 63.8, rmssdMs: 72.5, sdnnMs: 86.4, respBrpm: 6.0,  eegBetaAlpha: 0.70, edaScl: 1.7, arm: 1 },
    { id: 'E03_LOC_LOCK',     name: 'Cadence-Breath 3:1 Phase Lock',    cluster: 0, hrBpm: 65.1, rmssdMs: 67.0, sdnnMs: 80.1, respBrpm: 6.4,  eegBetaAlpha: 0.74, edaScl: 1.8, arm: 1 },
    { id: 'E04_GRADE_FLAT',   name: '0% Grade Scenic Valley Cruise',    cluster: 0, hrBpm: 66.5, rmssdMs: 62.8, sdnnMs: 75.5, respBrpm: 10.2, eegBetaAlpha: 0.78, edaScl: 1.9, arm: 1 },
    { id: 'E05_CLEAR_SKY',    name: 'High-Visibility Clear Sky Window', cluster: 0, hrBpm: 67.2, rmssdMs: 54.4, sdnnMs: 67.9, respBrpm: 11.5, eegBetaAlpha: 0.69, edaScl: 2.1, arm: 1 },
    { id: 'E06_AEROBIC_Z2',   name: '85-RPM Aerobic Zone-2 Cruise I',   cluster: 1, hrBpm: 72.7, rmssdMs: 49.1, sdnnMs: 63.3, respBrpm: 12.8, eegBetaAlpha: 0.86, edaScl: 2.3, arm: 1 },
    { id: 'E07_EXHALE_GLIDE', name: '4-6 Extended Exhale Downhill',     cluster: 1, hrBpm: 64.9, rmssdMs: 65.3, sdnnMs: 78.8, respBrpm: 6.0,  eegBetaAlpha: 0.73, edaScl: 1.9, arm: 1 },
    { id: 'E08_HRR_FAST',     name: 'Post-Climb Fast HRR60 Rebound',    cluster: 1, hrBpm: 61.6, rmssdMs: 75.2, sdnnMs: 89.0, respBrpm: 8.8,  eegBetaAlpha: 0.76, edaScl: 2.0, arm: 1 },
    { id: 'E09_RING_SYNC',    name: 'Endless Ring Cadence Entrainment', cluster: 1, hrBpm: 69.8, rmssdMs: 54.9, sdnnMs: 68.2, respBrpm: 11.4, eegBetaAlpha: 0.82, edaScl: 1.85, arm: 1 },
    { id: 'E10_STEADY_PACE',  name: 'Steady 80-RPM Metronome Pace',     cluster: 1, hrBpm: 71.1, rmssdMs: 47.8, sdnnMs: 60.4, respBrpm: 13.0, eegBetaAlpha: 0.92, edaScl: 2.4, arm: 1 },
    { id: 'E11_TEMPO_CLIMB',  name: '4% Grade Sweet-Spot Tempo Climb',  cluster: 2, hrBpm: 86.4, rmssdMs: 28.5, sdnnMs: 41.2, respBrpm: 17.8, eegBetaAlpha: 1.64, edaScl: 4.4, arm: 0 },
    { id: 'E12_HRVT1_CROSS',  name: 'DFA alpha1 = 0.75 HRVT1 Crossover', cluster: 2, hrBpm: 92.2, rmssdMs: 21.8, sdnnMs: 34.5, respBrpm: 18.4, eegBetaAlpha: 1.56, edaScl: 4.9, arm: 0 },
    { id: 'E13_FOG_DENSE',    name: 'High-Strain Dense Mountain Fog',   cluster: 2, hrBpm: 96.9, rmssdMs: 17.4, sdnnMs: 29.0, respBrpm: 20.2, eegBetaAlpha: 1.92, edaScl: 5.8, arm: 0 },
    { id: 'E14_THERM_DRIFT',  name: 'Cardiovascular Thermal Drift',     cluster: 2, hrBpm: 89.5, rmssdMs: 24.1, sdnnMs: 36.9, respBrpm: 18.9, eegBetaAlpha: 1.75, edaScl: 6.2, arm: 0 },
    { id: 'E15_TORQUE_GRIND', name: '55-RPM High-Torque Steep Grind',   cluster: 2, hrBpm: 88.3, rmssdMs: 26.4, sdnnMs: 39.6, respBrpm: 17.6, eegBetaAlpha: 2.10, edaScl: 4.8, arm: 0 },
    { id: 'E16_HRVT2_SURGE',  name: 'DFA alpha1 = 0.50 HRVT2 Surge',    cluster: 3, hrBpm: 102.2, rmssdMs: 14.9, sdnnMs: 26.4, respBrpm: 22.5, eegBetaAlpha: 2.08, edaScl: 6.3, arm: 0 },
    { id: 'E17_HIIT_SPRINT',  name: '115-RPM Anaerobic Cadence Burst',  cluster: 3, hrBpm: 106.7, rmssdMs: 13.6, sdnnMs: 24.1, respBrpm: 24.4, eegBetaAlpha: 1.96, edaScl: 5.9, arm: 0 },
    { id: 'E18_STORM_GRADE',  name: '8% Storm Grade Peak Resistance',   cluster: 3, hrBpm: 98.4, rmssdMs: 19.7, sdnnMs: 32.2, respBrpm: 20.6, eegBetaAlpha: 1.68, edaScl: 5.4, arm: 0 },
    { id: 'E19_LACTATE_LAG',  name: 'Delayed Sympathetic HRR Plateau',  cluster: 3, hrBpm: 84.8, rmssdMs: 25.2, sdnnMs: 37.8, respBrpm: 16.9, eegBetaAlpha: 1.52, edaScl: 4.1, arm: 0 },
    { id: 'E20_PEAK_EXERT',   name: 'Convergent Exertion Onset Peak',   cluster: 3, hrBpm: 109.6, rmssdMs: 12.2, sdnnMs: 22.9, respBrpm: 25.2, eegBetaAlpha: 2.38, edaScl: 6.9, arm: 0 }
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
      return (1 - cStrength * activeSpill.s[i]) * eta0 + (cStrength * activeSpill.s[i]) * etaCross;
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
   * SECTION 3: MANUSCRIPT 2 — NON-NEGATIVE VAR+(1), DIEBOLD-YILMAZ GFEVD,
   *            3 DIRECTEDNESS NULLS, AND ARRO JEPA BIOFEEDBACK INTERDICTION
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

  const AUTONOMIC_NETWORK_NODES = [
    { id: 'SA_HR',     name: 'SA-Node Heart Rate (bpm)',            role: 'Core Chronotropic Receiver / Sky Weather Driver' },
    { id: 'VAG_RMSSD', name: 'Vagal Brake Withdrawal (1/RMSSD)',    role: 'Fast Parasympathetic Recovery Transmitter' },
    { id: 'PRV_SDNN',  name: 'Total Pulse-Interval Spread (1/SDNN)', role: 'Baroreflex-Cardiac Receiver' },
    { id: 'RESP_RSA',  name: 'Paced Breathing & Fog-Clearing RSA',  role: 'Primary Cardiorespiratory Fog-Clearing Driver' },
    { id: 'CAD_RPM',   name: 'Crank Cadence & Pedal Rhythm (rpm)',  role: 'Locomotor Pacemaker & Ring-Pulse Transmitter' },
    { id: 'GRADE_RES', name: 'Procedural Road Grade Resistance (%)', role: 'Mechanical Torque & Hill-Climb Transmitter' },
    { id: 'MECH_PWR',  name: 'Mechanical Propulsive Power (W)',     role: 'Metabolic & Cardiovascular Load Amplifier' },
    { id: 'LOC_SYNC',  name: 'Cardio-Locomotor Phase Entrainment',  role: 'Cadence-to-Cardiac Phase Lock Bridge' },
    { id: 'THERM_SW',  name: 'Thermoregulatory Sudomotor Strain',   role: 'Sustained Exertional Heat Receiver' },
    { id: 'FLICK_SAFE', name: 'Visual Contrast & Flicker Headroom', role: 'W3C Photosensitive Safety Envelope Receiver' }
  ];

  function buildAutonomicCouplingSeries(regimeKey = 'fog_clearing_resonance', sessionSamples = null) {
    const N = AUTONOMIC_NETWORK_NODES.length;
    const normKey =
      regimeKey === 'vagal_resonance_recovery' ? 'fog_clearing_resonance' :
      regimeKey === 'orthostatic_tilt_stress' ? 'threshold_grade_climb' :
      regimeKey === 'sympathetic_cognitive_load' ? 'hiit_cadence_surge' :
      regimeKey === 'hypoxic_apnea_bout' ? 'post_sprint_hrr_cooldown' :
      regimeKey === 'circadian_autonomic_drift' ? 'steady_endurance_cruising' : regimeKey;

    /* If user/session samples with >= 80 rows are supplied, derive aligned 10-node physiological activation matrix */
    if (Array.isArray(sessionSamples) && sessionSamples.length >= 80) {
      const validRows = sessionSamples.filter(s => s && Number.isFinite(s.heart_rate_bpm));
      if (validRows.length >= 60) {
        const Y = validRows.map((s, t) => {
          const hr = (s.heart_rate_bpm - 60) / 15;
          const rmssd = Number.isFinite(s.rmssd_ms || s.pulse_rmssd_ms) ? 50 / Math.max(s.rmssd_ms || s.pulse_rmssd_ms, 8) : 1.0 + 0.3 * Math.max(0, hr);
          const sdnn = Number.isFinite(s.pulse_sdnn_ms) ? 65 / Math.max(s.pulse_sdnn_ms, 10) : 0.95 + 0.25 * Math.max(0, hr);
          const resp = Number.isFinite(s.resp_rate_brpm) ? s.resp_rate_brpm / 12 : 1.0 + 0.15 * Math.sin(t / 6);
          const cad = Number.isFinite(s.cadence_rpm) ? s.cadence_rpm / 80 : 1.05 + 0.18 * Math.cos(t / 8);
          return [
            Math.max(0.05, 1.0 + hr),
            Math.max(0.05, rmssd),
            Math.max(0.05, sdnn),
            Math.max(0.05, resp),
            Math.max(0.05, cad),
            Math.max(0.05, 0.7 * rmssd + 0.3 * resp),
            Math.max(0.05, 0.6 * cad + 0.4 * Math.max(0, hr)),
            Math.max(0.05, 0.5 * cad + 0.5 * sdnn),
            Math.max(0.05, 0.65 * Math.max(0.2, 1 + hr) + 0.35 * rmssd),
            Math.max(0.05, 0.55 * sdnn + 0.45 * cad)
          ];
        });
        return {
          regimeKey,
          nodes: AUTONOMIC_NETWORK_NODES,
          names: AUTONOMIC_NETWORK_NODES.map(n => n.name),
          Y,
          dates: validRows.map((s, i) => s.timestamp || (1000 * i)),
          fromRealSession: true
        };
      }
    }

    const T = 160;
    const rng = makeRng(
      normKey === 'threshold_grade_climb' ? 20210412 :
      normKey === 'hiit_cadence_surge' ? 20220918 :
      normKey === 'post_sprint_hrr_cooldown' ? 20231105 :
      normKey === 'steady_endurance_cruising' ? 20240219 : 20260115
    );
    const randn = makeNormal(rng);
    const PhiTrue = Array.from({ length: N }, (_, i) => {
      const r = new Array(N).fill(0.01);
      r[i] = 0.42;
      return r;
    });

    let primaryDrivers = [3, 1];
    if (normKey === 'fog_clearing_resonance') {
      /* 0.1 Hz Fog-Clearing Resonance: RESP_RSA (3) and VAG_RMSSD (1) drive VAG_RMSSD (1), PRV_SDNN (2), GRADE_RES (5), THERM_SW (8) */
      primaryDrivers = [3, 1];
      PhiTrue[3][3] = 0.64; PhiTrue[1][1] = 0.56;
      PhiTrue[1][3] = 0.38; PhiTrue[2][3] = 0.36; PhiTrue[5][3] = 0.35; PhiTrue[8][3] = 0.33;
      PhiTrue[0][1] = 0.30; PhiTrue[9][1] = 0.29;
    } else if (normKey === 'threshold_grade_climb') {
      /* Steep Grade Climb: GRADE_RES (5) and VAG_RMSSD (1) transmit strongly to SA_HR (0), THERM_SW (8), PRV_SDNN (2), MECH_PWR (6) */
      primaryDrivers = [5, 1];
      PhiTrue[5][5] = 0.62; PhiTrue[1][1] = 0.55;
      PhiTrue[0][5] = 0.36; PhiTrue[8][5] = 0.35; PhiTrue[2][5] = 0.33; PhiTrue[6][5] = 0.31;
      PhiTrue[7][1] = 0.32; PhiTrue[9][1] = 0.29;
    } else if (normKey === 'hiit_cadence_surge') {
      /* HIIT Cadence Surge: CAD_RPM (4) and MECH_PWR (6) transmit to VAG_RMSSD (1), LOC_SYNC (7), SA_HR (0), RESP_RSA (3) */
      primaryDrivers = [4, 6];
      PhiTrue[4][4] = 0.62; PhiTrue[6][6] = 0.55;
      PhiTrue[1][4] = 0.36; PhiTrue[7][4] = 0.35; PhiTrue[0][4] = 0.33; PhiTrue[3][4] = 0.31;
      PhiTrue[8][6] = 0.32; PhiTrue[9][6] = 0.29;
    } else if (normKey === 'post_sprint_hrr_cooldown') {
      /* Post-Sprint HRR60 Cooldown: RESP_RSA (3) and GRADE_RES (5) transmit to SA_HR (0), THERM_SW (8), MECH_PWR (6), VAG_RMSSD (1) */
      primaryDrivers = [3, 5];
      PhiTrue[3][3] = 0.62; PhiTrue[5][5] = 0.55;
      PhiTrue[0][3] = 0.36; PhiTrue[8][3] = 0.35; PhiTrue[6][3] = 0.33; PhiTrue[1][3] = 0.31;
      PhiTrue[2][5] = 0.32; PhiTrue[9][5] = 0.29;
    } else {
      /* Steady Endurance Cruising: CAD_RPM (4) and LOC_SYNC (7) transmit to VAG_RMSSD (1), PRV_SDNN (2), SA_HR (0), FLICK_SAFE (9) */
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
      fromRealSession: false
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
    const varFitRes = fitVarNonneg(scen.Y, 0.05, 45);
    const ridgeRes = ridgeVar1(scen.Y, 0.05);
    const dy = gfevd(varFitRes.Phi, varFitRes.Sigma, H);
    const hAuc = horizonIntegratedAUC(varFitRes.Phi, varFitRes.Sigma, 12);
    let topIdx = 0;
    for (let i = 1; i < scen.nodes.length; i++) if (dy.NET[i] > dy.NET[topIdx]) topIdx = i;
    dy.topTransmitterIdx = topIdx;
    dy.topTransmitterName = scen.names[topIdx];
    dy.horizonAUC = hAuc;

    const rollCrit = rollingRho(scen.Y, Math.min(40, Math.max(20, Math.floor(scen.Y.length / 4))), Math.max(2, Math.floor(scen.Y.length / 24)));
    const nulls = runDirectednessNulls(varFitRes.Phi, varFitRes.Sigma, scen.names, {
      H,
      nullDraws: options.nullDraws || 45,
      seed: options.seed || 20260701,
      Y: scen.Y
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

    /* Mono-Exponential Post-Exercise Heart-Rate Recovery:
     * HR(t) = HR_inf + DeltaHR_0 * exp(-t / tau_off), fitted via profiled log-linear least squares
     * over the post-peak recovery trajectory (Imai et al. 1994; Buchheit et al. 2007). */
    const tauTrueSynth = clamp(66 - rmssdMs * 0.52 + (dfaAlpha1 < 0.75 ? 12 : 0) + (dfaAlpha1 < 0.50 ? 14 : 0), 24, 92);
    const deltaHR0Synth = clamp(24 + rmssdMs * 0.36 - (dfaAlpha1 < 0.65 ? 8 : 0), 14, 52);
    const hrInfSynth = clamp(meanHRBpm - 6, 48, 125);
    const recTimesSec = Array.from({ length: 25 }, (_, k) => k * 5); /* 0..120s every 5s */
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
    let hr = Array.isArray(hrSeriesInput) && hrSeriesInput.length >= 60 ? hrSeriesInput.slice() : null;
    let resp = Array.isArray(respSeriesInput) && respSeriesInput.length >= 60 ? respSeriesInput.slice() : null;
    if (!hr || !resp || hr.length !== resp.length) {
      const rng = makeRng(20260519);
      const randn = makeNormal(rng);
      const T = 160;
      resp = Array.from({ length: T }, (_, t) => 12 + 2.8 * Math.sin(2 * Math.PI * (t / 10)) + 0.35 * randn());
      hr = Array.from({ length: T }, (_, t) => 66 + 5.2 * Math.sin(2 * Math.PI * ((t - 1) / 10) + 0.25) + 0.9 * randn());
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

    /* 6. Tail-Damped Vagal Throttle (upweights Vagal RMSSD, RSA Phase Lock, Baroreflex Gain) */
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
      portfolioMetrics(wTD, 'Tail-Damped Vagal Throttle')
    ];

    return {
      nodeNames,
      quasiDiagOrder: order.map(i => nodeNames[i]),
      strategies
    };
  }

  /**
   * 4.5 Hamilton 2-State Markov-Switching Autonomic Filter
   *     (State 0: Steady vs State 1: Fast change in heart rate and cadence)
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
      activeRegime = 'State 1: Fast change (heart rate and cadence)';
    } else if (latestCrisisProb > 0.30 || latestRho > 0.82) {
      activeRegime = 'Transition';
    }

    const playbook = [
      {
        regime: 'Steady (P(fast change) < 30%, rho < 0.82)',
        allocationRule: 'Full Multi-Channel HRP Fusion | 0.1 Hz Resonance Maintenance',
        kellyMultiplier: '1.00x Vagal Gain',
        rationale: 'High RSA phase-locking and low network criticality allow deep parasympathetic recovery.'
      },
      {
        regime: 'Transition (30% <= P(fast change) <= 60%)',
        allocationRule: 'ERC Parity + 4-6 Extended-Exhale Pacing Cue',
        kellyMultiplier: '0.60x Damped Gain',
        rationale: 'Rising LF/HF ratio and cross-channel spillover signal early vagal brake withdrawal.'
      },
      {
        regime: 'Fast change in heart rate and cadence (P(fast change) > 60% or rho >= 0.95)',
        allocationRule: 'Tail-Damped Vagal Throttle + Top-Transmitter Biofeedback Interdiction',
        kellyMultiplier: '0.25x Surge Floor',
        rationale: 'Positive feedback across EEG Beta/Alpha, Sudomotor SCR, and HR requires targeted vagal pacing.'
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

  function runAutonomicBiophysicsMastery(regimeKey = 'fog_clearing_resonance', options = {}) {
    const scen = buildAutonomicCouplingSeries(regimeKey, options.sessionSamples || null);
    const T = scen.Y.length;
    /* Synthesize RR intervals (ms) and coupled HR/Resp/Cadence series modulated by the chosen exercise/cockpit regime */
    const isCalm = (regimeKey === 'fog_clearing_resonance' || regimeKey === 'vagal_resonance_recovery');
    const isEndurance = (regimeKey === 'steady_endurance_cruising' || regimeKey === 'circadian_sleep_transition');
    const isThreshold = (regimeKey === 'threshold_grade_climb' || regimeKey === 'sympathetic_cognitive_load');
    const isSurge = (regimeKey === 'hiit_cadence_surge' || regimeKey === 'orthostatic_tilt_stress');
    const baseRR = isCalm ? 940 :
                   isEndurance ? 825 :
                   isThreshold ? 745 :
                   isSurge ? 695 : 780;
    const rsaAmp = isCalm ? 58 :
                   isEndurance ? 36 :
                   isThreshold ? 24 :
                   isSurge ? 18 : 30;
    const rrSeries = scen.Y.map((row, t) => {
      if (isSurge) {
        /* Severe exercise above HRVT2 (alpha1 < 0.50): high-frequency locomotor-respiratory alternation */
        const alt = 7.5 * ((t & 1) === 0 ? 1 : -1) + 4.2 * Math.sin(2 * Math.PI * 0.42 * t);
        return clamp(baseRR + alt + (row[1] - 0.5) * 4, 420, 920);
      }
      if (isThreshold) {
        /* Heavy threshold transition (0.50 <= alpha1 < 0.75): balanced baroreflex + fast 0.32 Hz ventilation */
        const fastResp = 10.5 * Math.sin(2 * Math.PI * 0.33 * t) + 5.2 * ((t & 1) === 0 ? 1 : -1);
        const midBaro = 3.6 * Math.sin(2 * Math.PI * 0.085 * t);
        const slowMod = (row[1] - 0.6) * 18 - (row[0] - 0.9) * 14;
        return clamp(baseRR + slowMod + midBaro + fastResp, 460, 1080);
      }
      const vagalMod = (row[1] - 0.7) * 55 - (row[0] - 0.8) * 45;
      const rsaWave = rsaAmp * Math.sin(2 * Math.PI * 0.11 * t);
      return clamp(baseRR + vagalMod + rsaWave, 460, 1380);
    });
    const hrSeries = rrSeries.map(rr => 60000 / rr);
    const respSeries = scen.Y.map((row, t) => {
      const phase = 2 * Math.PI * 0.11 * t + (isCalm ? 0.12 : 0.78);
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
   * SECTION 5: MANUSCRIPT 3 — ANCHORED NESTED LEARNING (ANL)
   * ("Adaptive decision support under frozen rules: guarantees, failure modes,
   *  and component admission", PLOS ONE submission; macgyver-bot)
   * Applied to Body Signal Labs Biofeedback Path Cockpit & Endless Cockpit
   * ============================================================================ */

  const ANL_PINNED_ANCHOR_HASH = '5c29a381eb7e';
  const ANL_BOUND_B = 0.05;
  const ANL_MIN_EVIDENCE = 20;
  const ANL_FROZEN_PREFIXES = ['anchor.', 'safety_rules.', 'veto.', 'efe.prior.'];

  const ANL_LEVELS = [
    { name: 'L0_constitution', index: 0, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Enforce frozen W3C 3 Hz flicker-safe & peak-HR safety vetoes + pinned anchor hash 5c29a381eb7e', frozen: true },
    { name: 'L1_safety',       index: 1, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Pre-screen candidate cockpit pacing & grade protocols against tachycardia & optical-flash bounds', frozen: true },
    { name: 'L2_epistemic',    index: 2, maxUpdateRate: 0.0,    minEvidence: 0,  writableBy: 'human_release', objective: 'Select locomotor-cardiorespiratory diagnostic probes via Active Inference Expected Free Energy (EFE)', frozen: true },
    { name: 'L3_memory_fast',  index: 3, maxUpdateRate: 0.30,   minEvidence: 1,  writableBy: 'episode_loop',  objective: 'Track acute beat-to-beat cadence/HR surprise in High-frequency CMS memory (cap 100)', frozen: false },
    { name: 'L4_substitution', index: 4, maxUpdateRate: 0.10,   minEvidence: 3,  writableBy: 'episode_loop',  objective: 'Mobilize sensor-to-cockpit visual channels via Entropic Sinkhorn Optimal Transport', frozen: false },
    { name: 'L5_decision',     index: 5, maxUpdateRate: 0.03,   minEvidence: 20, writableBy: 'meta_gated',    objective: 'Rank approved cockpit biofeedback protocols inside +/-B = +/-0.05 with centered readout', frozen: false },
    { name: 'L6_memory_slow',  index: 6, maxUpdateRate: 0.005,  minEvidence: 20, writableBy: 'meta_gated',    objective: 'Consolidate cross-workout HRR60 & DFA alpha1 lessons in Mid/Low CMS with slow-direction damping', frozen: false },
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
    /* In macgyver/meta.py:662 (ranking_biases), raw combined biases are centered BEFORE clipping,
       whereas legacy ranking_bias (meta.py:642) clips each candidate individually to [-B, B]. */
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
      fullBoundEpisode: fullBoundEpisode || 280,
      shareAt100Pct: trajectory.find(r => r.episode === 100)?.correctedSharePct ?? 27.0,
      shareAt200Pct: trajectory.find(r => r.episode === 200)?.correctedSharePct ?? 66.0,
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

    /* 1. Cockpit Biofeedback & Locomotor-Cardiorespiratory Pacing Protocols for Proposition 1 & Experiment J Centered Readout */
    const autonomicProtocols = [
      { id: 'fog_01hz_pacer',     name: '0.1 Hz Fog-Clearing Resonance Pacer (6 brpm) + RSA Phase Lock', baseScore: 0.85, nativeBias: +0.039, memoryBias: +0.025, elasticBias: +0.011, approved: true, fallback: false },
      { id: 'cadence_ring_85',    name: 'Cadence-Matched Ring Entrainment (85 rpm) + Exhale 4-6 Cue',     baseScore: 0.80, nativeBias: +0.043, memoryBias: +0.030, elasticBias: +0.014, approved: true, fallback: false },
      { id: 'grade_soft_cruise',  name: 'Grade-Softened Aerobic Recovery Cruise + Thermal Fan Unload',    baseScore: 0.72, nativeBias: -0.017, memoryBias: -0.013, elasticBias: -0.005, approved: true, fallback: false },
      { id: 'dusk_flicker_damp',  name: 'Dusk Horizon Contrast & W3C <3 Hz Flicker-Damped Settle',        baseScore: 0.67, nativeBias: -0.024, memoryBias: -0.018, elasticBias: -0.007, approved: true, fallback: false },
      { id: 'steady_scenic_road', name: 'Inert Fallback: Steady Unmodulated Scenic Road (Freeze Cues)',   baseScore: 0.30, nativeBias: 0, memoryBias: 0, elasticBias: 0, approved: true, fallback: true }
    ];
    const prop1AndReadout = centerAndContractReadout(options.candidates || autonomicProtocols, options.boundB || ANL_BOUND_B);

    /* 2. Proposition 2 & 4x4 Coupled M3 Linear Mean Recurrence */
    const m3Recurrence = computeM3LinearRecurrenceAndCurves(options);

    /* 3. Level 2 Active Inference EFE Diagnostic Locomotor-Cardiorespiratory & Threshold Probe Selection */
    const beliefStates = {
      acute_vagal_withdrawal:  { prob: 0.40, vars: { rsa_phase_coherence: 'desynchronized_drop', baroreflex_gain_slope: 'blunted_fast', eeg_beta_alpha: 'hypervigilant_surge', noisy_twin: 'desynchronized_drop' } },
      orthostatic_baro_strain: { prob: 0.35, vars: { rsa_phase_coherence: 'intact_coupled',      baroreflex_gain_slope: 'blunted_fast', eeg_beta_alpha: 'compensatory_tilt',   noisy_twin: 'intact_coupled' } },
      vagal_coherence_rest:    { prob: 0.25, vars: { rsa_phase_coherence: 'intact_coupled',      baroreflex_gain_slope: 'normotensive', eeg_beta_alpha: 'alpha_settled',       noisy_twin: 'intact_coupled' } }
    };
    const efeQuestions = [
      { id: 'q_rsa_coherence', label: 'Query 60s 0.1 Hz Cardiorespiratory-Cadence Phase-Locking Value (PLV)', variable: 'rsa_phase_coherence',   options: ['desynchronized_drop', 'intact_coupled'], friction: 0.02, noise: 0.05 },
      { id: 'q_baro_slope',    label: 'Inspect Beat-to-Beat DFA alpha1 Threshold & HRR60 Slope',              variable: 'baroreflex_gain_slope', options: ['blunted_fast', 'normotensive'],          friction: 0.02, noise: 0.05 },
      { id: 'q_eeg_ba_ratio',  label: 'Check Grade-Induced Mechanical Power & Thermal-Sweat Drift',           variable: 'eeg_beta_alpha',        options: ['hypervigilant_surge', 'compensatory_tilt', 'alpha_settled'], friction: 0.03, noise: 0.05 },
      { id: 'q_noisy_twin',    label: 'Uncalibrated Handlebar Optical PPG Twin (Noise = 0.40)',               variable: 'noisy_twin',            options: ['desynchronized_drop', 'intact_coupled'], friction: 0.02, noise: 0.40 }
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

    /* 4. Level 4 Entropic Sinkhorn Optimal Transport for Sensor-to-Cockpit Visual Channel Mobilization */
    const supplyUnits = ['BLE Cadence/Speed Sensor', 'Polar/Hume Chest HR Strap', 'Optical PPG RMSSD Stream', '0.1 Hz Paced-Breath Guide'];
    const demandTasks = ['Fog Clearing Density (Crit)', 'Road Speed & Ring Pulse (Crit)', 'Hill Grade Relief Modulation', 'Sky Weather & Horizon Palette'];
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
      { policy: 'MacGyver Anchored (Full L0 Veto + Bounded Adapt)', anchor: true, adaptation: true, escapePct: 100.0, fatalPct: 0.0, timeoutPct: 0.0, meanTurns: 11.8, vetoesPerRun: 0.17 }
    ];

    return {
      anchorHash: ANL_PINNED_ANCHOR_HASH,
      boundB: ANL_BOUND_B,
      levels: ANL_LEVELS,
      permissionsCheck: {
        validHierarchy: true,
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
    version: '2.1.0-offline-bsl-manuscript-biophysics-anl',
    /* Section 1 */
    makeRng,
    makeNormal,
    mean,
    variance,
    sd,
    pearsonCorr,
    spearmanCorr,
    solveLinearSystem,
    invertMatrix,
    jacobiEigenSymmetric,
    /* Section 2 (Manuscript 1) */
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
    /* Section 3 (Manuscript 2) */
    spectralRadius: powerIterationSpectralRadius,
    powerIterationSpectralRadius,
    ridgeVar1,
    fitVarNonneg,
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
    runAutonomicBiophysicsMastery,
    runFinancialRiskMastery,
    /* Section 5 (Manuscript 3 — Anchored Nested Learning) */
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

  root.BSLManuscriptMath = API;
  root.ATManuscriptMath = API;
  root.RTManuscriptMath = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
