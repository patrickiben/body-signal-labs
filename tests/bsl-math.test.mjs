import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const M = require(path.join(ROOT, 'src', 'bsl-math.js'));

test('1. Spatial and topological engine verifies 20 exercise epochs, 10 metrics, LOO, and 3x3 ladder', () => {
  assert.equal(M.DEFAULT_PHYSIOLOGICAL_NODES.length, 20, '20 exercise/biofeedback epochs');
  assert.equal(M.DEFAULT_PHYSIOLOGICAL_NODES[0].id, 'E01_WARM_SPIN');
  const res = M.runCRTDesignAndInference(M.DEFAULT_PHYSIOLOGICAL_NODES, {
    nPerm: 30,
    nSimRep: 28,
    spilloverStrength: 0.35,
    deltaTrue: -0.45
  });

  assert.equal(res.activeScore.rawMetrics.length, 10, 'All 10 metrics M1..M10 computed');
  for (let m = 0; m < 10; m++) {
    assert.ok(Number.isFinite(res.activeScore.rawMetrics[m]), `Metric M${m + 1} is finite`);
  }

  const wSum = res.looAblation.reduce((a, r) => a + r.weightFused, 0);
  assert.ok(Math.abs(wSum - 1.0) < 1e-9, `Fused weights sum to 1.0 (got ${wSum})`);

  assert.equal(res.looAblation.length, 10, '10 LOO ablation rows');
  for (const row of res.looAblation) {
    assert.ok(row.spearmanRho > 0.72, `LOO Spearman rho for ${row.metricId} > 0.72 (got ${row.spearmanRho})`);
  }

  assert.equal(res.operatingCharacteristics.length, 9, '3x3 design x estimator ladder has 9 cells');
  const srNaive = res.operatingCharacteristics.find(r => r.design === 'SR' && r.estimator === 'naive');
  const crrAdj = res.operatingCharacteristics.find(r => r.design === 'CRR' && r.estimator === 'adjusted');
  assert.ok(crrAdj.rmse < srNaive.rmse, `CRR+adjusted RMSE (${crrAdj.rmse}) beats SR+naive (${srNaive.rmse})`);
  assert.ok(res.designPoolsSummary.CRR.meanLeakage < res.designPoolsSummary.SR.meanLeakage);
});

test('2. VAR+(1), GFEVD, directedness nulls and latent-planner interdiction across all 5 cockpit regimes', () => {
  const regimes = [
    'fog_clearing_resonance',
    'steady_endurance_cruising',
    'threshold_grade_climb',
    'hiit_cadence_surge',
    'post_sprint_hrr_cooldown'
  ];
  for (const reg of regimes) {
    const scen = M.buildAutonomicCouplingSeries(reg);
    assert.equal(scen.Y[0].length, 10, `10 cockpit channels for ${reg}`);
  }

  const lsa = M.runFullLSAAnalysis('hiit_cadence_surge', {
    nullDraws: 24,
    budget: 1.5,
    seeds: 6
  });

  for (const row of lsa.varFit.Phi) {
    for (const val of row) assert.ok(val >= 0, 'VAR+(1) entry non-negative');
  }
  assert.ok(lsa.varFit.spectralRadius > 0.25 && lsa.varFit.spectralRadius < 1.35);

  for (let i = 0; i < 10; i++) {
    const rSum = lsa.gfevd.theta[i].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(rSum - 1.0) < 1e-6, `GFEVD row ${i} sums to 1.0`);
  }
  const netSum = lsa.gfevd.NET.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(netSum) < 1e-6, `NET directional spillovers sum to 0`);

  assert.ok(lsa.directednessNulls.symmetrizationNull.totalDirectedFlow <= lsa.directednessNulls.observed.totalDirectedFlow + 1e-6);
  assert.ok(lsa.directednessNulls.nulls.timeReversal, 'Time-reversal control present');

  const sum = lsa.interdiction.summary;
  assert.ok(sum['learned-MPC'].mean < sum['none'].mean, 'JEPA learned-MPC reduces load vs none');
  assert.ok(sum['learned-MPC'].mean < sum['greedy'].mean, 'JEPA learned-MPC beats greedy');
  assert.ok(lsa.interdiction.directedVsSymmetricAdvantage.advantageGainPts > 0);
});

test('3. Learning within fixed safety limits (L0-L7) verifies frozen vetoes, Prop 1 & 2, EFE, Sinkhorn, and CAP', () => {
  const anl = M.runAnchoredNestedLearning();

  assert.equal(anl.anchorHash, '5c29a381eb7e');
  assert.equal(anl.levels.length, 8);
  assert.equal(anl.permissionsCheck.validHierarchy, true);
  assert.equal(anl.permissionsCheck.autoApplyL0Rejected, true);
  assert.equal(anl.permissionsCheck.autoApplyFrozenPathRejected, true);
  assert.equal(anl.permissionsCheck.autoApplyLowEvidenceRejected, true);
  assert.equal(anl.permissionsCheck.autoApplyValidRankingAccepted, true);

  for (const c of anl.prop1AndReadout.candidates) {
    if (c.fallback) {
      assert.equal(c.centeredScore, 0.30);
    } else {
      assert.ok(Math.abs(c.centeredBias) < anl.boundB + 1e-12);
    }
  }
  for (const pg of anl.prop1AndReadout.pairwiseGuarantees) {
    assert.equal(pg.orderPreserved, true, `Order preserved for ${pg.pair}`);
  }

  assert.ok(Math.abs(anl.m3Recurrence.spectralRadiusA - 0.998761) < 0.0005);
  assert.equal(anl.m3Recurrence.fullBoundEpisode, 280);
  assert.ok(anl.m3Recurrence.shippedAt1500SharePct < 1.5);

  const qRsa = anl.efeEvaluation.questions.find(q => q.id === 'q_rsa_coherence');
  const qTwin = anl.efeEvaluation.questions.find(q => q.id === 'q_noisy_twin');
  assert.ok(qRsa.G < qTwin.G, 'Clean PLV probe beats noisy handlebar PPG twin');

  assert.equal(anl.sinkhornTransport.forbiddenFlowSum, 0);
  assert.ok(anl.sinkhornTransport.criticalUnmet <= 0.05);
});

test('4. Exercise & Cardiorespiratory Biophysics Mastery verifies DFA alpha1 HRVT zones, HRR60, PLV, RMT, and Hamilton Filter', () => {
  const calm = M.runAutonomicBiophysicsMastery('fog_clearing_resonance');
  const thresh = M.runAutonomicBiophysicsMastery('threshold_grade_climb');
  const hiit = M.runAutonomicBiophysicsMastery('hiit_cadence_surge');

  assert.ok(calm.hrvMastery.sd1Ms > 5);
  assert.ok(calm.hrvMastery.dfaAlpha1 >= 0.75, `Calm alpha1 (${calm.hrvMastery.dfaAlpha1}) >= 0.75 (Below HRVT1)`);
  assert.ok(calm.hrvMastery.hrvtZone.includes('Below HRVT1'));
  assert.ok(thresh.hrvMastery.dfaAlpha1 >= 0.50 && thresh.hrvMastery.dfaAlpha1 < 0.75, `Threshold alpha1 (${thresh.hrvMastery.dfaAlpha1}) in [0.50, 0.75)`);
  assert.ok(thresh.hrvMastery.hrvtZone.includes('Threshold Transition'));
  assert.ok(hiit.hrvMastery.dfaAlpha1 < 0.50, `HIIT alpha1 (${hiit.hrvMastery.dfaAlpha1}) < 0.50 (Above HRVT2)`);
  assert.ok(hiit.hrvMastery.hrvtZone.includes('Above HRVT2'));

  assert.ok(calm.hrvMastery.hrrFitR2 > 0.95, `Mono-exponential HRR fit R2 (${calm.hrvMastery.hrrFitR2}) > 0.95`);
  assert.ok(calm.hrvMastery.hrr60Bpm >= 8 && calm.hrvMastery.hrr60Bpm <= 58);
  assert.ok(calm.hrvMastery.hrrTauOffSec >= 20 && calm.hrvMastery.hrrTauOffSec <= 105);
  assert.ok(calm.hrvMastery.hrr60Bpm > hiit.hrvMastery.hrr60Bpm, 'Calm vagal HRR60 exceeds HIIT surge HRR60');
  assert.ok(calm.hrvMastery.rmssdMs > hiit.hrvMastery.rmssdMs, 'Calm resonance RMSSD exceeds HIIT surge RMSSD');

  assert.ok(calm.coupling.phaseLockingValuePLV >= 0 && calm.coupling.phaseLockingValuePLV <= 1);
  assert.ok(calm.rmt.conditionNumberDenoised <= calm.rmt.conditionNumberRaw);
  assert.equal(calm.shootout.strategies.length, 6);
  assert.equal(calm.regimeFilter.playbook.length, 3);
});
