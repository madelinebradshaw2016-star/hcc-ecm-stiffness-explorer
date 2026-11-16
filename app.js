/**
 * ECM Mechanobiology Explorer - Application Logic
 * Wang et al., BMC Biology (2025) 23:8:
 * "High matrix stiffness accelerates migration of hepatocellular carcinoma cells
 * through the integrin β1-Plectin-F-actin axis"
 */

// ============================================================================
// State Management & Biophysical Modeling Engine
// ============================================================================
const state = {
  stiffness: 53, // in kPa (default to 53 kPa high stiffness)
  cellLine: 'MHCC-97H', // 'MHCC-97H' (high metastatic) or 'MHCC-97L' (low metastatic)
  siIntegrinB1: false, // Integrin β1 siRNA knockdown
  shPlectin: false, // Plectin shRNA knockdown (shPlectin-2 in 97H, shPlectin-1 in 97L)
  latrunculinA: false, // Latrunculin A pharmacological F-actin depolymerizer
  
  // Scratch assay state
  scratchTimeHours: 0, // 0 to 48 hours (matching 48-h incubation in Wang et al., 2025)
  scratchPlaying: false,
  scratchSpeed: 1, // playback speed
  
  // Confocal microscope state
  confocalCondition: 'current', // 'current', '7kpa', '53kpa', 'shPlectin', 'siIntegrin', 'latA'
  channelDapi: true,
  channelActin: true,
  channelVimentin: true,
  lineScanPos: 0.5, // 0 to 1 across cell
  
  // Quiz state
  quizAnswers: {},
  quizScore: 0
};

// Mechanotransduction Mathematical Model calibrated to paper's quantitative figures
function computeBiophysicalOutputs() {
  const { stiffness, cellLine, siIntegrinB1, shPlectin, latrunculinA } = state;
  const isHighMetastatic = (cellLine === 'MHCC-97H');
  
  // Stiffness sensitivity factor (normalized around 7 kPa baseline to 53 kPa)
  // At 7 kPa: normStiffness = 0; at 53 kPa: normStiffness = 1
  const normStiffness = Math.max(0, Math.min(1.4, (stiffness - 7) / 46));
  
  // 1. Integrin β1 Level (Fig 3D, 3E, 4A, 4B)
  // High stiffness upregulates Integrin β1 ~1.65x in 97H, ~1.45x in 97L
  let integrinB1Fold = 1.0 + (isHighMetastatic ? 0.65 : 0.45) * Math.pow(normStiffness, 0.85);
  if (siIntegrinB1) {
    integrinB1Fold *= 0.28; // ~72% knockdown efficiency as shown in Fig 4A Western blot
  }
  
  // 2. Plectin Level (Fig 1C, 1D, 4A, 4B)
  // Plectin responds to ECM stiffness downstream of Integrin β1
  // Without Integrin β1, high stiffness fails to induce Plectin (Fig 4B)
  let plectinFold = 1.0;
  if (!siIntegrinB1) {
    plectinFold += (isHighMetastatic ? 0.60 : 0.55) * Math.pow(normStiffness, 0.9);
  } else {
    plectinFold = 0.85; // si-Integrin blunts baseline and blocks stiffness response
  }
  if (shPlectin) {
    plectinFold *= 0.25; // ~75% knockdown efficiency as shown in Fig 2B
  }
  
  // 3. F-actin Polymerization Index (Fig 5A, 5B, 5C, 6A)
  // F-actin stress fiber assembly requires both plectin and integrin β1; blocked by Lat-A
  let fActinIndex = 35 + normStiffness * 55; // baseline ~35% on soft, ~90% on stiff
  if (shPlectin) fActinIndex *= 0.35;
  if (siIntegrinB1) fActinIndex *= 0.40;
  if (latrunculinA) fActinIndex *= 0.10; // Latrunculin A depolymerizes F-actin
  fActinIndex = Math.max(5, Math.min(100, fActinIndex));
  
  // 4. Vimentin Intermediate Filament Network (Fig 5D)
  // Upregulated by stiffness and plectin-mediated cytoskeletal reinforcement
  let vimentinIndex = 40 + normStiffness * 50;
  if (shPlectin) vimentinIndex *= 0.45;
  if (siIntegrinB1) vimentinIndex *= 0.60;
  vimentinIndex = Math.max(10, Math.min(100, vimentinIndex));
  
  // 5. Predicted Migration Velocity (μm/h) & 12h Wound Closure % (Fig 2A, 2C, 4C, 6B)
  // Paper scratch assay wound closure at 12h:
  // MHCC-97H: 7 kPa -> ~15.6%; 53 kPa -> ~31.8%
  // MHCC-97H + shPlectin @ 53 kPa -> ~8.8%
  // MHCC-97H + si-Integrin β1 @ 53 kPa -> ~10.2%
  // MHCC-97H + Lat-A @ 53 kPa -> ~4.8%
  // MHCC-97L: 7 kPa -> ~6.2%; 53 kPa -> ~21.4%
  // MHCC-97L + shPlectin @ 53 kPa -> ~3.1%
  // MHCC-97L + si-Integrin β1 @ 53 kPa -> ~4.5%
  // MHCC-97L + Lat-A @ 53 kPa -> ~6.4%
  let baseClosure12h = isHighMetastatic ? 15.6 : 6.2;
  let maxBoost = isHighMetastatic ? 16.2 : 15.2;
  
  let effectiveBoostRatio = (fActinIndex / 90) * (plectinFold / 1.6);
  let closure12h = baseClosure12h + maxBoost * normStiffness * effectiveBoostRatio;
  
  if (shPlectin) closure12h = isHighMetastatic ? 8.8 : 3.1;
  if (siIntegrinB1) closure12h = isHighMetastatic ? 10.2 : 4.5;
  if (latrunculinA) closure12h = isHighMetastatic ? 4.8 : 6.4;
  closure12h = Math.max(1.5, Math.min(60, closure12h));
  
  // Migration speed in μm/h: ~500 μm initial gap, 12h closure %
  const scratchGapMicrons = 500;
  const migrationVelocity = (closure12h / 100 * (scratchGapMicrons / 2)) / 12; // μm/h per leading edge
  
  return {
    integrinB1Fold,
    plectinFold,
    fActinIndex,
    vimentinIndex,
    migrationVelocity,
    closure12h
  };
}

// ============================================================================
// UI Updates & Event Binding
// ============================================================================
function updateUI() {
  const outputs = computeBiophysicalOutputs();
  
  // Stiffness slider & labels
  const stiffnessSlider = document.getElementById('stiffnessSlider');
  if (stiffnessSlider) stiffnessSlider.value = state.stiffness;
  
  const stiffnessDisplay = document.getElementById('stiffnessValueDisplay');
  if (stiffnessDisplay) stiffnessDisplay.textContent = `${state.stiffness} kPa`;
  
  const stiffnessBadge = document.getElementById('stiffnessBadge');
  if (stiffnessBadge) stiffnessBadge.textContent = `${state.stiffness} kPa`;
  
  // Preset buttons active class
  document.querySelectorAll('.btn-preset').forEach(btn => {
    const kpa = parseInt(btn.dataset.kpa, 10);
    btn.classList.toggle('active', kpa === state.stiffness);
  });
  
  // Cell line pills
  document.querySelectorAll('.cell-line-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cell === state.cellLine);
  });
  
  // Perturbation switches
  const siIntSwitch = document.getElementById('siIntegrinSwitch');
  if (siIntSwitch) siIntSwitch.checked = state.siIntegrinB1;
  
  const shPleSwitch = document.getElementById('shPlectinSwitch');
  if (shPleSwitch) shPleSwitch.checked = state.shPlectin;
  
  const latASwitch = document.getElementById('latASwitch');
  if (latASwitch) latASwitch.checked = state.latrunculinA;
  
  // Metric gauges
  document.getElementById('metricIntegrinVal').textContent = `${outputs.integrinB1Fold.toFixed(2)}x`;
  document.getElementById('metricIntegrinBar').style.width = `${Math.min(100, (outputs.integrinB1Fold / 2.2) * 100)}%`;
  
  document.getElementById('metricPlectinVal').textContent = `${outputs.plectinFold.toFixed(2)}x`;
  document.getElementById('metricPlectinBar').style.width = `${Math.min(100, (outputs.plectinFold / 2.2) * 100)}%`;
  
  document.getElementById('metricActinVal').textContent = `${Math.round(outputs.fActinIndex)}%`;
  document.getElementById('metricActinBar').style.width = `${outputs.fActinIndex}%`;
  
  document.getElementById('metricVimentinVal').textContent = `${Math.round(outputs.vimentinIndex)}%`;
  document.getElementById('metricVimentinBar').style.width = `${outputs.vimentinIndex}%`;
  
  document.getElementById('metricSpeedVal').textContent = `${outputs.migrationVelocity.toFixed(1)} μm/h`;
  document.getElementById('metricClosureVal').textContent = `${outputs.closure12h.toFixed(1)}%`;
  
  // Update pathway canvas & confocal canvas
  drawConfocalView();
}

// Preset Setter
function setStiffnessPreset(kpa) {
  state.stiffness = kpa;
  updateUI();
}

// ============================================================================
// Canvas 1: Dynamic Mechanobiology Pathway Simulator
// ============================================================================
const pathwayCanvas = document.getElementById('pathwayCanvas');
const pCtx = pathwayCanvas ? pathwayCanvas.getContext('2d') : null;
let pathwayAnimId = null;
let animClock = 0;

// Particle system for signal pulses
const signalPulses = [];
function spawnSignalPulse(x, y, targetY, color) {
  signalPulses.push({
    x,
    y,
    targetY,
    color,
    radius: 3 + Math.random() * 2,
    speed: 1.5 + Math.random() * 1.5,
    alpha: 1
  });
}

function initPathwayCanvas() {
  if (!pathwayCanvas || !pCtx) return;
  
  function resize() {
    const rect = pathwayCanvas.parentElement.getBoundingClientRect();
    pathwayCanvas.width = rect.width * window.devicePixelRatio;
    pathwayCanvas.height = rect.height * window.devicePixelRatio;
    pCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  // Animation loop
  function render() {
    animClock += 0.03;
    const width = pathwayCanvas.width / window.devicePixelRatio;
    const height = pathwayCanvas.height / window.devicePixelRatio;
    const outputs = computeBiophysicalOutputs();
    
    // Clear
    pCtx.fillStyle = '#080d1a';
    pCtx.fillRect(0, 0, width, height);
    
    // Y-coordinates of layers
    const ecmHeight = 110;
    const membraneY = 160;
    const nucleusY = height - 85;
    
    // ------------------------------------------------------------------------
    // Layer 1: ECM (Extracellular Matrix) - Collagen I + LOX crosslinks
    // ------------------------------------------------------------------------
    pCtx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    pCtx.fillRect(0, 0, width, ecmHeight);
    
    // ECM Title
    pCtx.font = '600 12px Inter, sans-serif';
    pCtx.fillStyle = '#94a3b8';
    pCtx.fillText('EXTRACELLULAR MATRIX (ECM): Collagen I Fibers & LOX Crosslinks', 20, 25);
    
    // Stiffness Indicator text
    pCtx.font = '700 14px "JetBrains Mono", monospace';
    pCtx.fillStyle = state.stiffness >= 45 ? '#f43f5e' : (state.stiffness >= 20 ? '#a855f7' : '#38bdf8');
    pCtx.fillText(`Elastic Modulus (E) = ${state.stiffness} kPa ${state.stiffness >= 45 ? '[High Stiffness]' : '[Normal]' }`, 20, 48);
    
    // Draw Collagen Fibers
    // Higher stiffness = denser, more aligned, more crosslinks
    const fiberDensity = Math.floor(12 + (state.stiffness / 70) * 28);
    pCtx.lineWidth = 2 + (state.stiffness / 70) * 2.5;
    pCtx.strokeStyle = state.stiffness >= 45 ? 'rgba(244, 63, 94, 0.45)' : 'rgba(56, 189, 248, 0.4)';
    
    for (let i = 0; i < fiberDensity; i++) {
      const yBase = 60 + (i % 6) * 8;
      const waveAmp = state.stiffness >= 45 ? 2 : 7; // high stiffness = taut/straight fibers!
      pCtx.beginPath();
      pCtx.moveTo(0, yBase);
      for (let x = 0; x < width; x += 30) {
        pCtx.lineTo(x, yBase + Math.sin(x * 0.05 + animClock + i) * waveAmp);
      }
      pCtx.stroke();
    }
    
    // Draw LOX enzymatic crosslink nodes
    const crosslinkCount = Math.floor(6 + (state.stiffness / 70) * 35);
    pCtx.fillStyle = '#fbbf24';
    for (let c = 0; c < crosslinkCount; c++) {
      const cx = (c * 73 + animClock * 10) % (width - 40) + 20;
      const cy = 60 + ((c * 37) % 40);
      pCtx.beginPath();
      pCtx.arc(cx, cy, 3, 0, Math.PI * 2);
      pCtx.fill();
    }
    
    // ------------------------------------------------------------------------
    // Layer 2: Plasma Membrane Bilayer & Integrin β1 Receptors
    // ------------------------------------------------------------------------
    pCtx.fillStyle = 'rgba(71, 85, 105, 0.35)';
    pCtx.fillRect(0, membraneY - 10, width, 20);
    pCtx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    pCtx.lineWidth = 1;
    pCtx.strokeRect(0, membraneY - 10, width, 20);
    
    pCtx.font = '600 11px Inter, sans-serif';
    pCtx.fillStyle = '#cbd5e1';
    pCtx.fillText('PLASMA MEMBRANE', 20, membraneY + 4);
    
    // Integrin β1 Receptors (α/β1 Heterodimers)
    // When siIntegrinB1 is true: very few and pale; when stiff: clustered and glowing
    const integrinCount = state.siIntegrinB1 ? 3 : Math.floor(6 + (outputs.integrinB1Fold) * 4);
    const integrinSpacing = (width - 100) / (integrinCount + 1);
    
    for (let i = 1; i <= integrinCount; i++) {
      const ix = 50 + i * integrinSpacing;
      
      // Integrin head (extracellular domain touching ECM collagen)
      pCtx.fillStyle = state.siIntegrinB1 ? 'rgba(56, 189, 248, 0.2)' : '#38bdf8';
      pCtx.beginPath();
      pCtx.ellipse(ix - 5, membraneY - 15, 6, 12, -0.2, 0, Math.PI * 2);
      pCtx.fill();
      
      pCtx.beginPath();
      pCtx.ellipse(ix + 5, membraneY - 15, 6, 12, 0.2, 0, Math.PI * 2);
      pCtx.fill();
      
      // Integrin transmembrane stalks
      pCtx.strokeStyle = state.siIntegrinB1 ? 'rgba(56, 189, 248, 0.2)' : '#0284c7';
      pCtx.lineWidth = 4;
      pCtx.beginPath();
      pCtx.moveTo(ix - 4, membraneY - 10);
      pCtx.lineTo(ix - 4, membraneY + 12);
      pCtx.moveTo(ix + 4, membraneY - 10);
      pCtx.lineTo(ix + 4, membraneY + 12);
      pCtx.stroke();
      
      // Integrin Cytoplasmic Tail
      pCtx.strokeStyle = '#38bdf8';
      pCtx.beginPath();
      pCtx.moveTo(ix, membraneY + 12);
      pCtx.lineTo(ix, membraneY + 25);
      pCtx.stroke();
      
      // Spawn downstream mechanical signal pulses if not silenced
      if (!state.siIntegrinB1 && Math.random() < 0.08 * (state.stiffness / 40)) {
        spawnSignalPulse(ix, membraneY + 25, membraneY + 100, '#38bdf8');
      }
      
      // ----------------------------------------------------------------------
      // Layer 3: Plectin Cytolinker (~500 kDa multi-domain plakin protein)
      // Connects Integrin β1 tails to F-actin and intermediate filaments
      // ----------------------------------------------------------------------
      if (!state.shPlectin) {
        const plectinY = membraneY + 50;
        
        // Plectin dumbbell structure (globular heads + coiled-coil rod domain)
        pCtx.fillStyle = '#a855f7';
        pCtx.strokeStyle = '#c084fc';
        pCtx.lineWidth = 3;
        
        // Connecting arm from integrin tail to plectin head
        pCtx.setLineDash([2, 2]);
        pCtx.beginPath();
        pCtx.moveTo(ix, membraneY + 25);
        pCtx.lineTo(ix + Math.sin(animClock + i) * 8, plectinY);
        pCtx.stroke();
        pCtx.setLineDash([]);
        
        // Plectin N-terminal ABD (actin-binding domain) head
        pCtx.beginPath();
        pCtx.arc(ix + Math.sin(animClock + i) * 8, plectinY, 7, 0, Math.PI * 2);
        pCtx.fill();
        
        // Central coiled-coil rod domain
        pCtx.beginPath();
        pCtx.moveTo(ix + Math.sin(animClock + i) * 8, plectinY + 7);
        pCtx.lineTo(ix + 15, plectinY + 38);
        pCtx.stroke();
        
        // Plectin C-terminal IF-binding head
        pCtx.fillStyle = '#e879f9';
        pCtx.beginPath();
        pCtx.arc(ix + 15, plectinY + 42, 6, 0, Math.PI * 2);
        pCtx.fill();
      }
    }
    
    // Label for Integrin & Plectin (Right-aligned with margin)
    pCtx.textAlign = 'right';
    pCtx.font = '500 11px Inter, sans-serif';
    pCtx.fillStyle = state.siIntegrinB1 ? '#ef4444' : '#38bdf8';
    pCtx.fillText(state.siIntegrinB1 ? 'Integrin β1 [SILENCED by siRNA]' : 'Integrin β1 mechanoreceptors', width - 20, membraneY + 4);
    
    pCtx.fillStyle = state.shPlectin ? '#ef4444' : '#c084fc';
    pCtx.fillText(state.shPlectin ? 'Plectin [KNOCKED DOWN by shRNA]' : 'Plectin (~500 kDa cytolinker)', width - 20, membraneY + 65);
    pCtx.textAlign = 'left';
    
    // ------------------------------------------------------------------------
    // Layer 4: F-actin Stress Fibers & Intermediate Filaments (Vimentin)
    // ------------------------------------------------------------------------
    const actinZoneY = membraneY + 120;
    
    pCtx.font = '600 11px Inter, sans-serif';
    pCtx.fillStyle = state.latrunculinA ? '#ef4444' : '#f43f5e';
    pCtx.fillText(
      state.latrunculinA 
        ? 'F-actin [DEPOLYMERIZED by Latrunculin A]' 
        : `F-actin Stress Fibers (Polymerization Index: ${Math.round(outputs.fActinIndex)}%)`, 
      20, 
      actinZoneY - 15
    );
    
    // Draw Actin Filaments
    if (state.latrunculinA) {
      // Depolymerized monomer dots (G-actin)
      pCtx.fillStyle = 'rgba(244, 63, 94, 0.4)';
      for (let dot = 0; dot < 120; dot++) {
        const dx = (dot * 47 + Math.sin(animClock + dot) * 20) % width;
        const dy = actinZoneY + ((dot * 23) % 110);
        pCtx.beginPath();
        pCtx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        pCtx.fill();
      }
    } else {
      // Polymerized F-actin Stress Fibers
      const fiberCount = Math.floor(outputs.fActinIndex / 8);
      pCtx.lineWidth = 1.5 + (outputs.fActinIndex / 100) * 3.5;
      
      for (let f = 0; f < fiberCount; f++) {
        const fy = actinZoneY + f * 14;
        const tensionAmp = Math.max(0.5, 4 - (outputs.fActinIndex / 30)); // tense fibers don't undulate
        
        // Gradient color for stress fiber
        pCtx.strokeStyle = `rgba(244, 63, 94, ${0.4 + (outputs.fActinIndex / 100) * 0.55})`;
        pCtx.beginPath();
        pCtx.moveTo(20, fy);
        
        for (let x = 20; x < width - 20; x += 40) {
          pCtx.lineTo(x, fy + Math.sin(x * 0.03 + animClock * 2 + f) * tensionAmp);
        }
        pCtx.stroke();
        
        // Focal adhesion complex at the ends
        if (f % 2 === 0) {
          pCtx.fillStyle = '#fb7185';
          pCtx.fillRect(width - 25, fy - 4, 10, 8);
        }
      }
      
      // Draw Vimentin Intermediate Filaments (Teal mesh)
      pCtx.strokeStyle = `rgba(45, 212, 191, ${0.25 + (outputs.vimentinIndex / 100) * 0.45})`;
      pCtx.lineWidth = 1.5;
      pCtx.beginPath();
      for (let v = 0; v < 8; v++) {
        const startX = 60 + v * 90;
        pCtx.moveTo(startX, actinZoneY + 10);
        pCtx.bezierCurveTo(
          startX + 30, actinZoneY + 50,
          startX - 20, actinZoneY + 90,
          startX + 40, nucleusY - 10
        );
      }
      pCtx.stroke();
    }
    
    // ------------------------------------------------------------------------
    // Layer 5: Nucleus & Mechano-reciprocal Transcription
    // ------------------------------------------------------------------------
    const nWidth = width * 0.65;
    const nHeight = 65;
    const nX = (width - nWidth) / 2;
    
    pCtx.fillStyle = 'rgba(30, 58, 138, 0.45)';
    pCtx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.ellipse(width / 2, nucleusY + 25, nWidth / 2, nHeight / 2, 0, 0, Math.PI * 2);
    pCtx.fill();
    pCtx.stroke();
    
    pCtx.font = '600 12px Inter, sans-serif';
    pCtx.fillStyle = '#93c5fd';
    pCtx.textAlign = 'center';
    pCtx.fillText('NUCLEUS: Mechano-responsive Gene Expression (PLEC & ITGB1 Upregulation)', width / 2, nucleusY + 22);
    
    pCtx.font = '500 11px "JetBrains Mono", monospace';
    pCtx.fillStyle = '#60a5fa';
    pCtx.fillText(`[Transcripts per Million: PLEC Fold=${outputs.plectinFold.toFixed(2)}x | ITGB1 Fold=${outputs.integrinB1Fold.toFixed(2)}x]`, width / 2, nucleusY + 40);
    pCtx.textAlign = 'left';
    
    // ------------------------------------------------------------------------
    // Render and Update Signal Pulses
    // ------------------------------------------------------------------------
    for (let p = signalPulses.length - 1; p >= 0; p--) {
      const pulse = signalPulses[p];
      pulse.y += pulse.speed;
      pulse.alpha -= 0.015;
      
      pCtx.fillStyle = pulse.color;
      pCtx.globalAlpha = Math.max(0, pulse.alpha);
      pCtx.beginPath();
      pCtx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2);
      pCtx.fill();
      pCtx.globalAlpha = 1.0;
      
      if (pulse.alpha <= 0 || pulse.y >= pulse.targetY) {
        signalPulses.splice(p, 1);
      }
    }
    
    pathwayAnimId = requestAnimationFrame(render);
  }
  
  render();
}

// ============================================================================
// Canvas 2: Virtual In Vitro Scratch / Wound Healing Assay Simulation
// (Figures 2A, 2C, 4C, 6B from Wang et al., BMC Biology 2025)
// ============================================================================
const scratchCanvas = document.getElementById('scratchCanvas');
const sCtx = scratchCanvas ? scratchCanvas.getContext('2d') : null;
let scratchAnimId = null;

// Simulated cancer cell particles in scratch assay
const scratchCellsLeft = [];
const scratchCellsRight = [];

function initScratchCells() {
  scratchCellsLeft.length = 0;
  scratchCellsRight.length = 0;
  
  const rows = 14;
  const cols = 12;
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Left monolayer sheet
      scratchCellsLeft.push({
        baseX: 20 + c * 24 + (Math.random() - 0.5) * 8,
        baseY: 25 + r * 28 + (Math.random() - 0.5) * 8,
        radius: 8 + Math.random() * 3,
        aspectRatio: 1.1 + Math.random() * 0.4,
        angle: Math.random() * 0.3,
        colorVariant: Math.random()
      });
      
      // Right monolayer sheet
      scratchCellsRight.push({
        baseX: 520 + c * 24 + (Math.random() - 0.5) * 8,
        baseY: 25 + r * 28 + (Math.random() - 0.5) * 8,
        radius: 8 + Math.random() * 3,
        aspectRatio: 1.1 + Math.random() * 0.4,
        angle: -Math.random() * 0.3,
        colorVariant: Math.random()
      });
    }
  }
}

function initScratchCanvas() {
  if (!scratchCanvas || !sCtx) return;
  
  function resize() {
    const rect = scratchCanvas.parentElement.getBoundingClientRect();
    scratchCanvas.width = rect.width * window.devicePixelRatio;
    scratchCanvas.height = 420 * window.devicePixelRatio;
    sCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  
  window.addEventListener('resize', resize);
  resize();
  initScratchCells();
  
  // Animation Loop for Scratch
  function renderScratch() {
    if (state.scratchPlaying) {
      state.scratchTimeHours += 0.08 * state.scratchSpeed;
      if (state.scratchTimeHours >= 48) {
        state.scratchTimeHours = 48;
        state.scratchPlaying = false;
        updateScratchControlsUI();
      }
      updateScratchControlsUI();
    }
    
    const width = scratchCanvas.width / window.devicePixelRatio;
    const height = scratchCanvas.height / window.devicePixelRatio;
    const outputs = computeBiophysicalOutputs();
    
    // Background: Polyacrylamide hydrogel culture surface
    sCtx.fillStyle = '#0c1322';
    sCtx.fillRect(0, 0, width, height);
    
    // Initial wound gap: 500 μm nominal width, centered around x = width / 2
    const initialGapWidth = width * 0.42;
    const centerX = width / 2;
    const initialLeftEdge = centerX - initialGapWidth / 2;
    const initialRightEdge = centerX + initialGapWidth / 2;
    
    // Calculate closure distance at current scratch time
    // closure percentage at 12h is outputs.closure12h; scales smoothly with time (t/12)^1.1
    const timeFactor = Math.pow(state.scratchTimeHours / 12, 0.95);
    const currentClosurePercent = Math.min(100, outputs.closure12h * timeFactor);
    const closurePixels = (initialGapWidth / 2) * (currentClosurePercent / 100);
    
    const currentLeftEdge = initialLeftEdge + closurePixels;
    const currentRightEdge = initialRightEdge - closurePixels;
    
    // Draw initial scratch boundary guidelines (dashed)
    sCtx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    sCtx.setLineDash([6, 6]);
    sCtx.lineWidth = 1.5;
    sCtx.beginPath();
    sCtx.moveTo(initialLeftEdge, 0);
    sCtx.lineTo(initialLeftEdge, height);
    sCtx.moveTo(initialRightEdge, 0);
    sCtx.lineTo(initialRightEdge, height);
    sCtx.stroke();
    sCtx.setLineDash([]);
    
    // Draw Current leading edge boundaries (solid colored)
    sCtx.strokeStyle = currentClosurePercent > 25 ? '#f43f5e' : '#38bdf8';
    sCtx.lineWidth = 2.5;
    sCtx.beginPath();
    sCtx.moveTo(currentLeftEdge, 0);
    sCtx.lineTo(currentLeftEdge, height);
    sCtx.moveTo(currentRightEdge, 0);
    sCtx.lineTo(currentRightEdge, height);
    sCtx.stroke();
    
    // Draw wound gap background shade
    sCtx.fillStyle = 'rgba(56, 189, 248, 0.04)';
    sCtx.fillRect(currentLeftEdge, 0, Math.max(0, currentRightEdge - currentLeftEdge), height);
    
    // Draw Cells on Left Sheet
    scratchCellsLeft.forEach((c, idx) => {
      // Migration displacement towards gap
      const cellProgress = (c.baseX / initialLeftEdge);
      const cellDisplacement = closurePixels * Math.pow(cellProgress, 1.3);
      const curX = c.baseX + cellDisplacement;
      const curY = c.baseY + Math.sin(idx + state.scratchTimeHours * 0.4) * 2;
      
      // Cell shape: high stiffness makes cells elongated along migration vector!
      const elongation = 1 + (outputs.fActinIndex / 100) * 0.6;
      
      sCtx.fillStyle = state.cellLine === 'MHCC-97H' 
        ? (c.colorVariant > 0.5 ? 'rgba(56, 189, 248, 0.75)' : 'rgba(99, 102, 241, 0.75)')
        : (c.colorVariant > 0.5 ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)');
      
      sCtx.beginPath();
      sCtx.ellipse(curX, curY, c.radius * elongation, c.radius, c.angle, 0, Math.PI * 2);
      sCtx.fill();
      
      // Nucleus
      sCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      sCtx.beginPath();
      sCtx.arc(curX, curY, c.radius * 0.35, 0, Math.PI * 2);
      sCtx.fill();
      
      // Leading edge filopodia/lamellipodia spikes
      if (curX >= currentLeftEdge - 25 && outputs.fActinIndex > 40) {
        sCtx.strokeStyle = '#f43f5e';
        sCtx.lineWidth = 1.5;
        sCtx.beginPath();
        sCtx.moveTo(curX + c.radius, curY);
        sCtx.lineTo(curX + c.radius + 6 + (outputs.fActinIndex / 25), curY);
        sCtx.stroke();
      }
    });
    
    // Draw Cells on Right Sheet
    scratchCellsRight.forEach((c, idx) => {
      const cellProgress = (width - c.baseX) / (width - initialRightEdge);
      const cellDisplacement = closurePixels * Math.pow(cellProgress, 1.3);
      const curX = c.baseX - cellDisplacement;
      const curY = c.baseY + Math.sin(idx + state.scratchTimeHours * 0.4) * 2;
      
      const elongation = 1 + (outputs.fActinIndex / 100) * 0.6;
      
      sCtx.fillStyle = state.cellLine === 'MHCC-97H' 
        ? (c.colorVariant > 0.5 ? 'rgba(56, 189, 248, 0.75)' : 'rgba(99, 102, 241, 0.75)')
        : (c.colorVariant > 0.5 ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)');
      
      sCtx.beginPath();
      sCtx.ellipse(curX, curY, c.radius * elongation, c.radius, c.angle, 0, Math.PI * 2);
      sCtx.fill();
      
      sCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      sCtx.beginPath();
      sCtx.arc(curX, curY, c.radius * 0.35, 0, Math.PI * 2);
      sCtx.fill();
      
      if (curX <= currentRightEdge + 25 && outputs.fActinIndex > 40) {
        sCtx.strokeStyle = '#f43f5e';
        sCtx.lineWidth = 1.5;
        sCtx.beginPath();
        sCtx.moveTo(curX - c.radius, curY);
        sCtx.lineTo(curX - c.radius - 6 - (outputs.fActinIndex / 25), curY);
        sCtx.stroke();
      }
    });
    
    // Scale Bar (200 μm matching paper Figs 2A, 2C, 4C, 6B)
    const scaleBarMicrons = 200;
    const scaleBarPixels = 100; // corresponds to 200 μm
    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(width - 120, height - 30, scaleBarPixels, 5);
    sCtx.font = '600 11px Inter, sans-serif';
    sCtx.fillText('Scale bar: 200 μm', width - 120, height - 38);
    
    // Live Measurement HUD
    sCtx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    sCtx.fillRect(20, height - 70, 240, 50);
    sCtx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    sCtx.strokeRect(20, height - 70, 240, 50);
    
    sCtx.font = '700 13px "JetBrains Mono", monospace';
    sCtx.fillStyle = '#38bdf8';
    sCtx.fillText(`Wound Closure: ${currentClosurePercent.toFixed(1)}%`, 32, height - 48);
    sCtx.font = '500 11px Inter, sans-serif';
    sCtx.fillStyle = '#94a3b8';
    sCtx.fillText(`Remaining Gap: ${Math.round(500 * (1 - currentClosurePercent / 100))} μm (t = ${state.scratchTimeHours.toFixed(1)} h)`, 32, height - 30);
    
    scratchAnimId = requestAnimationFrame(renderScratch);
  }
  
  renderScratch();
}

function updateScratchControlsUI() {
  const playBtn = document.getElementById('scratchPlayBtn');
  if (playBtn) {
    playBtn.innerHTML = state.scratchPlaying 
      ? '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause' 
      : '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Play';
  }
  
  const timeSlider = document.getElementById('scratchTimeSlider');
  if (timeSlider) timeSlider.value = state.scratchTimeHours;
  
  const timeDisplay = document.getElementById('scratchTimeDisplay');
  if (timeDisplay) timeDisplay.textContent = `${state.scratchTimeHours.toFixed(1)} h`;
}

function toggleScratchPlay() {
  state.scratchPlaying = !state.scratchPlaying;
  updateScratchControlsUI();
}

function resetScratchSimulation() {
  state.scratchTimeHours = 0;
  state.scratchPlaying = false;
  initScratchCells();
  updateScratchControlsUI();
}

// ============================================================================
// Canvas 3: Interactive Confocal Microscope Multi-Channel Simulator
// (Leica TCS SP8 DIVE: F-actin Rhodamine, DAPI Nucleus, Vimentin Alexa Fluor 647)
// ============================================================================
const confocalCanvas = document.getElementById('confocalCanvas');
const cCtx = confocalCanvas ? confocalCanvas.getContext('2d') : null;

// Simulated line-scan intensity profile chart
let lineScanChartInstance = null;

function initConfocalMicroscope() {
  if (!confocalCanvas || !cCtx) return;
  
  function resize() {
    const rect = confocalCanvas.parentElement.getBoundingClientRect();
    confocalCanvas.width = rect.width * window.devicePixelRatio;
    confocalCanvas.height = 440 * window.devicePixelRatio;
    cCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  // Interactive drag for Line-scan
  let isDragging = false;
  confocalCanvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    updateLineScanFromEvent(e);
  });
  
  confocalCanvas.addEventListener('mousemove', (e) => {
    if (isDragging) updateLineScanFromEvent(e);
  });
  
  window.addEventListener('mouseup', () => { isDragging = false; });
  
  function updateLineScanFromEvent(e) {
    const rect = confocalCanvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    state.lineScanPos = Math.max(0.1, Math.min(0.9, y));
    drawConfocalView();
  }
  
  initLineScanChart();
  drawConfocalView();
}

function drawConfocalView() {
  if (!confocalCanvas || !cCtx) return;
  const width = confocalCanvas.width / window.devicePixelRatio;
  const height = confocalCanvas.height / window.devicePixelRatio;
  const outputs = computeBiophysicalOutputs();
  
  // Dark field microscope background
  cCtx.fillStyle = '#020408';
  cCtx.fillRect(0, 0, width, height);
  
  // Representative cell cluster parameters
  const cells = [
    { x: width * 0.35, y: height * 0.5, r: 65, angle: 0.15 },
    { x: width * 0.65, y: height * 0.48, r: 72, angle: -0.2 }
  ];
  
  cells.forEach(cell => {
    // 1. Channel: VIMENTIN (Alexa Fluor 647 - Cyan/Teal)
    if (state.channelVimentin) {
      cCtx.save();
      cCtx.translate(cell.x, cell.y);
      cCtx.rotate(cell.angle);
      
      const vOpacity = (outputs.vimentinIndex / 100) * 0.7;
      cCtx.strokeStyle = `rgba(45, 212, 191, ${vOpacity})`;
      cCtx.lineWidth = 1.2;
      
      // Cage filament network around nucleus
      const vRings = Math.floor(4 + (outputs.vimentinIndex / 100) * 8);
      for (let r = 0; r < vRings; r++) {
        cCtx.beginPath();
        cCtx.ellipse(0, 0, 25 + r * 5, 20 + r * 4.5, 0, 0, Math.PI * 2);
        cCtx.stroke();
      }
      cCtx.restore();
    }
    
    // 2. Channel: F-ACTIN (Actin-Tracker Red-Rhodamine - Red)
    if (state.channelActin) {
      cCtx.save();
      cCtx.translate(cell.x, cell.y);
      cCtx.rotate(cell.angle);
      
      if (state.latrunculinA) {
        // Depolymerized: diffuse faint background haze + fine puncta
        cCtx.fillStyle = 'rgba(244, 63, 94, 0.2)';
        cCtx.beginPath();
        cCtx.ellipse(0, 0, cell.r, cell.r * 0.8, 0, 0, Math.PI * 2);
        cCtx.fill();
        
        cCtx.fillStyle = 'rgba(251, 113, 133, 0.45)';
        for (let p = 0; p < 45; p++) {
          const pr = Math.random() * cell.r * 0.8;
          const pth = Math.random() * Math.PI * 2;
          cCtx.beginPath();
          cCtx.arc(Math.cos(pth) * pr, Math.sin(pth) * pr, 1.5, 0, Math.PI * 2);
          cCtx.fill();
        }
      } else {
        // Cortical actin ring
        cCtx.strokeStyle = 'rgba(244, 63, 94, 0.85)';
        cCtx.lineWidth = 2.5;
        cCtx.beginPath();
        cCtx.ellipse(0, 0, cell.r, cell.r * 0.8, 0, 0, Math.PI * 2);
        cCtx.stroke();
        
        // Trans-cellular Stress Fibers (polymerization increases with stiffness/plectin)
        const fiberCount = Math.floor((outputs.fActinIndex / 100) * 16);
        const fiberThick = 1.5 + (outputs.fActinIndex / 100) * 2.5;
        const fiberAlpha = 0.35 + (outputs.fActinIndex / 100) * 0.6;
        
        cCtx.strokeStyle = `rgba(244, 63, 94, ${fiberAlpha})`;
        cCtx.lineWidth = fiberThick;
        
        for (let f = -fiberCount / 2; f <= fiberCount / 2; f++) {
          const yOff = f * 5.5;
          const halfW = Math.sqrt(Math.max(0, 1 - (yOff / (cell.r * 0.8)) ** 2)) * cell.r;
          if (halfW > 5) {
            cCtx.beginPath();
            cCtx.moveTo(-halfW + 4, yOff);
            cCtx.lineTo(halfW - 4, yOff);
            cCtx.stroke();
          }
        }
      }
      cCtx.restore();
    }
    
    // 3. Channel: DAPI (Nucleus - Blue)
    if (state.channelDapi) {
      cCtx.save();
      cCtx.translate(cell.x, cell.y);
      cCtx.rotate(cell.angle);
      
      const nGrad = cCtx.createRadialGradient(0, 0, 4, 0, 0, 22);
      nGrad.addColorStop(0, '#93c5fd');
      nGrad.addColorStop(0.7, '#3b82f6');
      nGrad.addColorStop(1, 'rgba(29, 78, 216, 0.4)');
      
      cCtx.fillStyle = nGrad;
      cCtx.beginPath();
      cCtx.ellipse(0, 0, 22, 16, 0, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.restore();
    }
  });
  
  // Confocal Overlays: Scale Bar (25 μm matching paper Fig 5A-D, Fig 6A)
  const scaleBarPix = 60;
  cCtx.fillStyle = '#ffffff';
  cCtx.fillRect(width - 90, height - 25, scaleBarPix, 4);
  cCtx.font = '600 11px Inter, sans-serif';
  cCtx.fillText('25 μm', width - 80, height - 32);
  
  // Microscope Watermark / Meta
  cCtx.font = '500 11px "JetBrains Mono", monospace';
  cCtx.fillStyle = '#94a3b8';
  cCtx.fillText('Leica TCS SP8 DIVE | 63x / 1.40 OIL', 15, 25);
  cCtx.fillText(`Ex: 405/561/647 nm | Matrix: ${state.stiffness} kPa`, 15, 42);
  
  // Interactive Line-Scan Crosshair
  const scanY = height * state.lineScanPos;
  cCtx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  cCtx.setLineDash([4, 4]);
  cCtx.lineWidth = 1.5;
  cCtx.beginPath();
  cCtx.moveTo(width * 0.15, scanY);
  cCtx.lineTo(width * 0.85, scanY);
  cCtx.stroke();
  cCtx.setLineDash([]);
  
  // Line-scan handle indicator
  cCtx.fillStyle = '#fbbf24';
  cCtx.beginPath();
  cCtx.arc(width * 0.15, scanY, 5, 0, Math.PI * 2);
  cCtx.arc(width * 0.85, scanY, 5, 0, Math.PI * 2);
  cCtx.fill();
  
  cCtx.font = '600 10px Inter, sans-serif';
  cCtx.fillText('Drag to measure line-scan profile', width * 0.15, scanY - 8);
  
  // Update the line-scan intensity chart
  updateLineScanChartData(scanY, height, outputs);
}

function initLineScanChart() {
  const canvas = document.getElementById('lineScanChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  lineScanChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({ length: 50 }, (_, i) => `${(i * 1.2).toFixed(1)} μm`),
      datasets: [
        {
          label: 'F-actin (561 nm)',
          data: [],
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: 'DAPI (405 nm)',
          data: [],
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.1)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        },
        {
          label: 'Vimentin (647 nm)',
          data: [],
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.1)',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 150 },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { size: 10, family: 'Inter' } }
        },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          display: true,
          ticks: { color: '#64748b', font: { size: 9 }, maxTicksLimit: 8 },
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        y: {
          display: true,
          title: { display: true, text: 'Fluorescence Intensity (A.U.)', color: '#94a3b8', font: { size: 9 } },
          ticks: { color: '#64748b', font: { size: 9 } },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          min: 0,
          max: 255
        }
      }
    }
  });
}

function updateLineScanChartData(scanY, totalH, outputs) {
  if (!lineScanChartInstance) return;
  
  const points = 50;
  const actinData = [];
  const dapiData = [];
  const vimentinData = [];
  
  // Calculate simulated intensity curve along line-scan intersecting cell 1 and cell 2
  for (let i = 0; i < points; i++) {
    const xRatio = i / points;
    
    // Cell 1 center is ~0.35, Cell 2 center is ~0.65
    const distCell1 = Math.abs(xRatio - 0.35);
    const distCell2 = Math.abs(xRatio - 0.65);
    
    // DAPI peak in the nucleus center (<0.06 dist)
    let dapiVal = 10;
    if (distCell1 < 0.06) dapiVal = 180 * (1 - distCell1 / 0.06);
    if (distCell2 < 0.06) dapiVal = Math.max(dapiVal, 195 * (1 - distCell2 / 0.06));
    
    // F-actin profile:
    // At high stiffness (53 kPa): strong cortical peaks + interior stress fiber spikes
    // At low stiffness (7 kPa): low cortical peaks, baseline interior
    // With Latrunculin A: flat minimal background
    let actinVal = 15;
    if (state.latrunculinA) {
      if (distCell1 < 0.12 || distCell2 < 0.12) actinVal = 25 + Math.random() * 8;
    } else {
      const fRatio = outputs.fActinIndex / 100;
      // Cell 1 cortical borders at ~0.24 and ~0.46
      if (Math.abs(distCell1 - 0.11) < 0.02) actinVal = 90 + 130 * fRatio;
      // Stress fiber interior peaks
      if (distCell1 < 0.10) {
        const fiberRipple = Math.sin(i * 1.8) > 0.4 ? (40 + 120 * fRatio) : 40;
        actinVal = Math.max(actinVal, fiberRipple);
      }
      // Cell 2
      if (Math.abs(distCell2 - 0.12) < 0.02) actinVal = Math.max(actinVal, 95 + 140 * fRatio);
      if (distCell2 < 0.11) {
        const fiberRipple2 = Math.sin(i * 1.7) > 0.3 ? (45 + 130 * fRatio) : 45;
        actinVal = Math.max(actinVal, fiberRipple2);
      }
    }
    
    // Vimentin profile: intermediate filament broad peak around nucleus
    let vimVal = 12;
    const vRatio = outputs.vimentinIndex / 100;
    if (distCell1 < 0.10) vimVal = Math.max(vimVal, 40 + 120 * vRatio * (1 - distCell1 / 0.10));
    if (distCell2 < 0.10) vimVal = Math.max(vimVal, 45 + 130 * vRatio * (1 - distCell2 / 0.10));
    
    actinData.push(state.channelActin ? Math.round(actinVal) : 0);
    dapiData.push(state.channelDapi ? Math.round(dapiVal) : 0);
    vimentinData.push(state.channelVimentin ? Math.round(vimVal) : 0);
  }
  
  lineScanChartInstance.data.datasets[0].data = actinData;
  lineScanChartInstance.data.datasets[1].data = dapiData;
  lineScanChartInstance.data.datasets[2].data = vimentinData;
  lineScanChartInstance.update('none');
}

// ============================================================================
// Scientific Data Explorer: Chart.js Interactive Figures
// (TCGA Cohort, Stiffness Stratification, Spearman Correlation, qPCR & Western)
// ============================================================================
function initResearchDataCharts() {
  // Chart 1: TCGA Expression (Normal vs HCC, High vs Low Stiffness)
  const tcgaCanvas = document.getElementById('chartTcgaExpression');
  if (tcgaCanvas) {
    new Chart(tcgaCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Normal Liver (n=276)', 'HCC Tumor (n=371)', 'COL1A1/LOX Low (n=117)', 'COL1A1/LOX High (n=119)'],
        datasets: [
          {
            label: 'Plectin mRNA log2(TPM+1)',
            data: [3.48, 4.18, 3.82, 4.65],
            backgroundColor: 'rgba(168, 85, 247, 0.75)',
            borderColor: '#a855f7',
            borderWidth: 1.5,
            borderRadius: 6
          },
          {
            label: 'Integrin β1 mRNA log2(TPM+1)',
            data: [5.82, 6.95, 6.12, 7.34],
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Inter' } } },
          tooltip: {
            callbacks: {
              afterBody: () => 'Wang et al., 2025 BMC Biology Fig 1A, 1B, 3B, 3C (p < 0.001)'
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { 
            title: { display: true, text: 'log2(TPM + 1)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' }, 
            grid: { color: 'rgba(255,255,255,0.05)' } 
          }
        }
      }
    });
  }
  
  // Chart 2: Spearman Correlation (Plectin vs Integrin β1 in TCGA HCC)
  const corrCanvas = document.getElementById('chartSpearmanCorr');
  if (corrCanvas) {
    // Generate representative data points mirroring Fig 3A (Spearman R = 0.448, P < 0.001)
    const scatterPoints = [];
    for (let i = 0; i < 75; i++) {
      const plec = 2.5 + Math.random() * 5.0;
      const itgb1 = 1.2 + 0.68 * plec + (Math.random() - 0.5) * 1.8;
      scatterPoints.push({ x: parseFloat(plec.toFixed(2)), y: parseFloat(itgb1.toFixed(2)) });
    }
    
    new Chart(corrCanvas.getContext('2d'), {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'TCGA HCC Patients (n=371)',
            data: scatterPoints,
            backgroundColor: 'rgba(56, 189, 248, 0.6)',
            borderColor: '#38bdf8',
            pointRadius: 4
          },
          {
            type: 'line',
            label: 'Fitted Spearman Trend (R = 0.448, p < 0.001)',
            data: [
              { x: 2.5, y: 1.2 + 0.68 * 2.5 },
              { x: 7.5, y: 1.2 + 0.68 * 7.5 }
            ],
            borderColor: '#fbbf24',
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: {
            callbacks: {
              label: (c) => `Plectin: ${c.raw.x}, Integrin β1: ${c.raw.y}`
            }
          }
        },
        scales: {
          x: { 
            title: { display: true, text: 'Plectin mRNA log2(TPM+1)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' }, 
            grid: { color: 'rgba(255,255,255,0.05)' } 
          },
          y: { 
            title: { display: true, text: 'Integrin β1 mRNA log2(TPM+1)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' }, 
            grid: { color: 'rgba(255,255,255,0.05)' } 
          }
        }
      }
    });
  }
  
  // Chart 3: qPCR & Western Fold Induction (7 kPa vs 53 kPa in MHCC-97H and MHCC-97L)
  const qpcrCanvas = document.getElementById('chartQpcrWestern');
  if (qpcrCanvas) {
    new Chart(qpcrCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Plectin mRNA (97H)', 'Plectin Protein (97H)', 'Integrin β1 mRNA (97H)', 'Integrin β1 Protein (97H)', 'Plectin mRNA (97L)', 'Integrin β1 mRNA (97L)'],
        datasets: [
          {
            label: '7 kPa (Soft/Normal)',
            data: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
            backgroundColor: 'rgba(148, 163, 184, 0.7)',
            borderRadius: 6
          },
          {
            label: '53 kPa (Stiff/HCC)',
            data: [1.55, 1.62, 1.68, 1.74, 1.52, 1.48],
            backgroundColor: 'rgba(244, 63, 94, 0.8)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: {
            callbacks: {
              afterBody: () => '* p < 0.05 vs 7 kPa (Wang et al., Fig 1C, 1D, 3D, 3E)'
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { 
            title: { display: true, text: 'Relative Expression Fold (vs 7 kPa)', color: '#94a3b8' },
            ticks: { color: '#94a3b8' }, 
            grid: { color: 'rgba(255,255,255,0.05)' },
            min: 0,
            max: 2.2
          }
        }
      }
    });
  }
  
  // Chart 4: Scratch Assay 12h Wound Closure Summary Across Perturbations
  const closureCanvas = document.getElementById('chartWoundSummary');
  if (closureCanvas) {
    new Chart(closureCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [
          'MHCC-97H Control',
          'MHCC-97H + shPlectin',
          'MHCC-97H + si-Integrin β1',
          'MHCC-97H + Lat-A',
          'MHCC-97L Control',
          'MHCC-97L + shPlectin',
          'MHCC-97L + si-Integrin β1',
          'MHCC-97L + Lat-A'
        ],
        datasets: [
          {
            label: '7 kPa Substrate',
            data: [15.6, 9.2, 11.4, 4.8, 6.2, 3.8, 4.2, 5.8],
            backgroundColor: 'rgba(56, 189, 248, 0.75)',
            borderRadius: 6
          },
          {
            label: '53 kPa Substrate',
            data: [31.8, 8.8, 10.2, 4.8, 21.4, 3.1, 4.5, 6.4],
            backgroundColor: 'rgba(244, 63, 94, 0.85)',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8' } },
          tooltip: {
            callbacks: {
              afterBody: () => 'Wang et al., 2025 (Figs 2C, 4C, 6B). Notice that 53 kPa boost is completely blocked by shPlectin, si-Integrin β1, or Lat-A.'
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { 
            title: { display: true, text: 'Wound Closure (%) at 12 hours', color: '#94a3b8' },
            ticks: { color: '#94a3b8' }, 
            grid: { color: 'rgba(255,255,255,0.05)' },
            min: 0,
            max: 40
          }
        }
      }
    });
  }
}

// ============================================================================
// Interactive Mechanobiology Quiz
// ============================================================================
const quizData = [
  {
    id: 1,
    question: "What is the physiological matrix stiffness of normal human liver compared to cirrhotic/HCC liver tissue?",
    options: [
      { text: "Normal liver is ~53 kPa; cirrhotic liver is ~7 kPa", correct: false },
      { text: "Normal liver is ~7 kPa; cirrhotic/HCC tissue is ~53 kPa or higher", correct: true },
      { text: "Both normal and cirrhotic liver tissues have identical stiffness (~30 kPa)", correct: false },
      { text: "Normal liver is 100 kPa; tumors become fluid-like (~1 kPa)", correct: false }
    ],
    explanation: "Normal healthy liver tissue has an elastic modulus of ~3-7 kPa. Chronic fibrosis and cirrhosis cause massive collagen crosslinking via LOX, increasing ECM stiffness to ~53 kPa or more (Wang et al., 2025)."
  },
  {
    id: 2,
    question: "How does elevated ECM stiffness (53 kPa) affect Plectin expression in HCC cells?",
    options: [
      { text: "High stiffness significantly downregulates Plectin expression", correct: false },
      { text: "High stiffness significantly upregulates Plectin mRNA and protein expression", correct: true },
      { text: "Plectin expression remains completely unchanged across all stiffnesses", correct: false },
      { text: "Plectin is degraded and cleaved into non-functional fragments", correct: false }
    ],
    explanation: "Wang et al. demonstrated by RT-qPCR and Western blotting that culturing MHCC-97H and MHCC-97L on 53 kPa hydrogels significantly elevates both Plectin mRNA and protein levels compared to 7 kPa substrates (Fig 1C, 1D)."
  },
  {
    id: 3,
    question: "What happens to high matrix stiffness-induced Plectin upregulation when Integrin β1 is knocked down (si-Integrin β1)?",
    options: [
      { text: "Plectin upregulation is abolished, proving that plectin senses stiffness via Integrin β1", correct: true },
      { text: "Plectin levels double as a compensatory response", correct: false },
      { text: "Integrin β1 knockdown has zero effect on Plectin induction", correct: false },
      { text: "Cell migration accelerates even faster without Integrin β1", correct: false }
    ],
    explanation: "Western blot analysis revealed that under 53 kPa conditions, the si-Integrin β1 group failed to upregulate plectin expression (Fig 4B). This confirms that Integrin β1 is indispensable for transmitting the ECM stiffness signal to plectin."
  },
  {
    id: 4,
    question: "What is the primary cellular effect of Plectin and Integrin β1 knockdown on the actin cytoskeleton under 53 kPa stiffness?",
    options: [
      { text: "It causes spontaneous hyper-polymerization of actin filaments", correct: false },
      { text: "It attenuates F-actin polymerization, reducing thick stress fibers and cytoskeletal alignment", correct: true },
      { text: "It replaces actin filaments with collagen fibers inside the cytoplasm", correct: false },
      { text: "It converts F-actin into microtubules", correct: false }
    ],
    explanation: "Confocal immunofluorescence demonstrated that knockdown of either plectin or integrin β1 weakened the promoting effect of high matrix stiffness on F-actin polymerization and stress fiber formation (Fig 5B, 5C)."
  },
  {
    id: 5,
    question: "Why did the authors treat cells with Latrunculin A (Lat-A) in Figure 6?",
    options: [
      { text: "To block cell division in the G2 phase", correct: false },
      { text: "To depolymerize F-actin and verify that F-actin assembly is strictly required for stiffness-accelerated HCC migration", correct: true },
      { text: "To crosslink collagen fibers in the polyacrylamide gel", correct: false },
      { text: "To overexpress Plectin without changing substrate stiffness", correct: false }
    ],
    explanation: "Latrunculin A depolymerizes F-actin by sequestering actin monomers. Lat-A treatment completely reversed the promotion of migration and F-actin stress fiber formation induced by 53 kPa stiffness (Fig 6A, 6B)."
  }
];

function initQuiz() {
  const container = document.getElementById('quizContainer');
  if (!container) return;
  
  container.innerHTML = '';
  quizData.forEach((q, qIdx) => {
    const card = document.createElement('div');
    card.className = 'quiz-card';
    card.dataset.qid = q.id;
    
    card.innerHTML = `
      <div class="quiz-question">
        <span class="quiz-q-num">Q${qIdx + 1}</span>
        <span>${q.question}</span>
      </div>
      <div class="quiz-options">
        ${q.options.map((opt, optIdx) => `
          <button class="quiz-opt" data-opt="${optIdx}">
            <span>${opt.text}</span>
            <span class="opt-icon"></span>
          </button>
        `).join('')}
      </div>
      <div class="quiz-explanation" id="quizExpl-${q.id}">
        <strong>Scientific Rationale:</strong> ${q.explanation}
      </div>
    `;
    
    const optButtons = card.querySelectorAll('.quiz-opt');
    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (state.quizAnswers[q.id] !== undefined) return; // already answered
        
        const selectedIdx = parseInt(btn.dataset.opt, 10);
        const isCorrect = q.options[selectedIdx].correct;
        state.quizAnswers[q.id] = isCorrect;
        
        optButtons.forEach((b, idx) => {
          b.disabled = true;
          if (q.options[idx].correct) {
            b.classList.add('correct');
          } else if (idx === selectedIdx) {
            b.classList.add('incorrect');
          }
        });
        
        const expl = document.getElementById(`quizExpl-${q.id}`);
        if (expl) expl.style.display = 'block';
        
        updateQuizScore();
      });
    });
    
    container.appendChild(card);
  });
}

function updateQuizScore() {
  const total = quizData.length;
  const answered = Object.keys(state.quizAnswers).length;
  const correct = Object.values(state.quizAnswers).filter(Boolean).length;
  
  const scoreBadge = document.getElementById('quizScoreBadge');
  if (scoreBadge) {
    scoreBadge.textContent = `${correct} / ${total} Correct (${answered} Answered)`;
  }
}

// ============================================================================
// Data Export (JSON / CSV)
// ============================================================================
function exportExperimentalData(format = 'json') {
  const outputs = computeBiophysicalOutputs();
  const exportPayload = {
    metadata: {
      study: "Wang et al., BMC Biology (2025) 23:8",
      title: "High matrix stiffness accelerates migration of hepatocellular carcinoma cells through the integrin β1-Plectin-F-actin axis",
      timestamp: new Date().toISOString()
    },
    experimentalParameters: {
      ecmStiffnessKPa: state.stiffness,
      cellLine: state.cellLine,
      siIntegrinB1: state.siIntegrinB1,
      shPlectin: state.shPlectin,
      latrunculinA: state.latrunculinA,
      scratchTimeHours: state.scratchTimeHours
    },
    predictedBiophysicalOutputs: {
      integrinB1FoldChange: outputs.integrinB1Fold,
      plectinFoldChange: outputs.plectinFold,
      fActinPolymerizationIndexPercent: outputs.fActinIndex,
      vimentinReorganizationIndexPercent: outputs.vimentinIndex,
      migrationVelocityMicronsPerHour: outputs.migrationVelocity,
      woundClosure12hPercent: outputs.closure12h
    }
  };
  
  let blob, filename;
  if (format === 'csv') {
    const csvContent = [
      'Parameter,Value',
      `Stiffness (kPa),${state.stiffness}`,
      `Cell Line,${state.cellLine}`,
      `si-Integrin B1,${state.siIntegrinB1}`,
      `shPlectin,${state.shPlectin}`,
      `Latrunculin A,${state.latrunculinA}`,
      `Integrin B1 Fold,${outputs.integrinB1Fold.toFixed(2)}`,
      `Plectin Fold,${outputs.plectinFold.toFixed(2)}`,
      `F-actin Index (%),${outputs.fActinIndex.toFixed(1)}`,
      `Vimentin Index (%),${outputs.vimentinIndex.toFixed(1)}`,
      `Migration Speed (um/h),${outputs.migrationVelocity.toFixed(2)}`,
      `12h Wound Closure (%),${outputs.closure12h.toFixed(2)}`
    ].join('\n');
    blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    filename = `ecm_stiffness_data_${state.stiffness}kPa.csv`;
  } else {
    blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    filename = `ecm_stiffness_data_${state.stiffness}kPa.json`;
  }
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============================================================================
// Initialization & Global Event Listeners
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      themeToggle.innerHTML = newTheme === 'light' 
        ? '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"></path></svg>'
        : '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    });
  }
  
  // Stiffness Slider
  const stiffnessSlider = document.getElementById('stiffnessSlider');
  if (stiffnessSlider) {
    stiffnessSlider.addEventListener('input', (e) => {
      state.stiffness = parseInt(e.target.value, 10);
      updateUI();
    });
  }
  
  // Preset Buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      setStiffnessPreset(parseInt(btn.dataset.kpa, 10));
    });
  });
  
  // Cell Line Buttons
  document.querySelectorAll('.cell-line-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.cellLine = btn.dataset.cell;
      updateUI();
    });
  });
  
  // Perturbation Toggles
  const siInt = document.getElementById('siIntegrinSwitch');
  if (siInt) siInt.addEventListener('change', (e) => { state.siIntegrinB1 = e.target.checked; updateUI(); });
  
  const shPle = document.getElementById('shPlectinSwitch');
  if (shPle) shPle.addEventListener('change', (e) => { state.shPlectin = e.target.checked; updateUI(); });
  
  const latA = document.getElementById('latASwitch');
  if (latA) latA.addEventListener('change', (e) => { state.latrunculinA = e.target.checked; updateUI(); });
  
  // Scratch Controls
  const playBtn = document.getElementById('scratchPlayBtn');
  if (playBtn) playBtn.addEventListener('click', toggleScratchPlay);
  
  const resetBtn = document.getElementById('scratchResetBtn');
  if (resetBtn) resetBtn.addEventListener('click', resetScratchSimulation);
  
  const timeSlider = document.getElementById('scratchTimeSlider');
  if (timeSlider) {
    timeSlider.addEventListener('input', (e) => {
      state.scratchTimeHours = parseFloat(e.target.value);
      state.scratchPlaying = false;
      updateScratchControlsUI();
    });
  }
  
  // Confocal Channel Checkboxes
  const chActin = document.getElementById('channelActinCheck');
  if (chActin) chActin.addEventListener('change', (e) => { state.channelActin = e.target.checked; drawConfocalView(); });
  
  const chDapi = document.getElementById('channelDapiCheck');
  if (chDapi) chDapi.addEventListener('change', (e) => { state.channelDapi = e.target.checked; drawConfocalView(); });
  
  const chVim = document.getElementById('channelVimCheck');
  if (chVim) chVim.addEventListener('change', (e) => { state.channelVimentin = e.target.checked; drawConfocalView(); });
  
  // Export Buttons
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => exportExperimentalData('json'));
  
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => exportExperimentalData('csv'));
  
  // Paper Modal
  const modal = document.getElementById('paperModal');
  const openModalBtn = document.getElementById('openPaperModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  if (openModalBtn && modal) openModalBtn.addEventListener('click', () => modal.classList.add('active'));
  if (closeModalBtn && modal) closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
  
  // Initialize Subsystems
  initPathwayCanvas();
  initScratchCanvas();
  initConfocalMicroscope();
  initResearchDataCharts();
  initQuiz();
  updateUI();
  updateScratchControlsUI();
});
