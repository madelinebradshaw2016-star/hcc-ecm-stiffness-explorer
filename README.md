# Mechano-Liver: ECM Stiffness & HCC Migration Explorer
### Integrin β1 — Plectin — F-actin Axis in Hepatocellular Carcinoma

An interactive mechanobiology web application and simulation platform translating the cutting-edge findings of:

> **Wang, Z., Wang, W., Luo, Q. & Song, G.** (2025). *High matrix stiffness accelerates migration of hepatocellular carcinoma cells through the integrin β1-Plectin-F-actin axis*. **BMC Biology**, 23:8. [https://doi.org/10.1186/s12915-025-02113-1](https://doi.org/10.1186/s12915-025-02113-1)

---

## 🔬 Scientific Overview

Hepatocellular carcinoma (HCC) is one of the leading causes of cancer-related mortality worldwide. Over 80% of HCC cases arise in the setting of chronic liver fibrosis and cirrhosis, characterized by extensive deposition of collagen type I (COL1A1) and enzymatic cross-linking by Lysyl Oxidase (LOX). This process drastically increases the extracellular matrix (ECM) stiffness from a soft, compliant physiological state (**~3–7 kPa**) to a rigid, fibrotic/cirrhotic tumor microenvironment (**>53 kPa**).

This interactive platform demonstrates the mechanical and biochemical circuitry revealed by Wang et al. (2025):
1. **Mechanical Sensing**: High ECM stiffness (53 kPa) acts as an external mechanical force sensed by **Integrin β1** surface receptors.
2. **Signal Transduction & Cytolinker Induction**: Integrin β1 activation upregulates **Plectin**, a multi-domain ~500 kDa cytolinker protein that connects membrane adhesion complexes with the cytoskeleton.
3. **Cytoskeletal Remodeling**: Plectin enhances **F-actin polymerization**, forming thick longitudinal stress fibers, focal adhesions, and lamellipodia/filopodia. It simultaneously remodels intermediate filaments (**Vimentin**).
4. **Malignant Migration**: The remodeled cytoskeleton generates enhanced intracellular traction forces, markedly accelerating HCC cell migration and metastatic potential.
5. **Therapeutic Vulnerability**: Silencing either **Integrin β1** (via siRNA) or **Plectin** (via shRNA), or depolymerizing F-actin with **Latrunculin A (Lat-A)**, abolishes stiffness-driven cell migration, highlighting key anti-metastatic therapeutic targets.

---

## 🌟 Interactive Modules & Features

### 1. Dynamic Mechanotransduction Pathway Simulator
- **Continuous Stiffness Slider (1–70 kPa)** with real-time biophysical modeling.
- **Preset Scenarios**:
  - *Normal Liver Parenchyma* (~7 kPa)
  - *Moderate Fibrosis* (~20 kPa)
  - *Cirrhotic / Stiff HCC Stroma* (~53 kPa)
  - *Dense Desmoplasia* (~65 kPa)
- **Genetic & Chemical Perturbations**:
  - `si-Integrin β1` (siRNA knockdown)
  - `shPlectin` (shRNA lentiviral silencing)
  - `+ Latrunculin A` (F-actin monomer depolymerizer)
- **Cell Line Models**: `MHCC-97H` (high metastatic potential) vs `MHCC-97L` (low metastatic potential).
- **Live Canvas Visualization**: Collagen network crosslinking, integrin dimer clustering, plectin dumbbell cytolinker recruitment, polarized F-actin stress fibers, vimentin intermediate filaments, and mechano-reciprocal transcription pulses into the nucleus.

### 2. Virtual In Vitro Scratch / Wound Healing Assay
- Recreates the 500 μm Ibidi insert wound healing migration experiments (Figures 2A, 2C, 4C, 6B).
- Animated cell monolayer closure dynamics over 0 to 24 hours.
- Real-time gap measurement, 200 μm calibrated scale bar, and live wound closure percentage calculation matching empirical data (e.g. 15.6% @ 7 kPa vs 31.8% @ 53 kPa in MHCC-97H).

### 3. Virtual Leica TCS SP8 DIVE Confocal Microscope
- Recreates multi-channel confocal fluorescence immunofluorescence images (Figures 5A–D, 6A).
- Fluorescence channels:
  - **Actin-Tracker Red / Rhodamine** (F-actin stress fibers, 561 nm)
  - **DAPI** (Nuclei, 405 nm)
  - **Alexa Fluor 647** (Vimentin intermediate filaments, 647 nm)
- **Interactive Trans-Cellular Line-Scan Tool**: Drag crosshairs across the cells to dynamically graph cross-sectional fluorescence intensity peaks, demonstrating thick stress fiber formation at 53 kPa and its loss upon Latrunculin A treatment.

### 4. Empirical Research Data & TCGA Bioinformatics Explorer
Interactive Chart.js visualizations of the actual paper datasets:
- **TCGA HCC Patient Cohort**: Plectin mRNA expression in normal liver (n=276) vs HCC (n=371, p < 0.001) and stiffness stratification (COL1A1^High-LOX^High vs Low).
- **Spearman Correlation**: Significant positive correlation between Plectin and Integrin β1 (R = 0.448, p < 0.001).
- **RT-qPCR & Western Blot Quantification**: Fold changes across 7 kPa vs 53 kPa hydrogels.
- **Wound Closure (%) Summary**: Comprehensive comparison across all experimental and perturbation groups.

### 5. Clinical & Translational Insights
- Analysis of liver stiffness measurement (LSM / FibroScan / SWE) in staging cirrhosis and determining HCC risk.
- Targeting mechanotransduction (Integrin β1 inhibitors, LOX inhibitors like simtuzumab/BAPN, plectin-targeting strategies).

### 6. Mechanobiology Mastery Quiz
- 5 interactive questions with instant feedback and scientific rationale citing figures from the paper.

### 7. Data Export
- Download live experimental simulations and calculated biophysical metrics as formatted **JSON** or **CSV** reports.

---

## 🚀 Running Locally

No npm build steps or complex dependencies required! The application is self-contained:

```bash
# Clone the repository
git clone https://github.com/<your-username>/hcc-ecm-stiffness-explorer.git
cd hcc-ecm-stiffness-explorer

# Serve using any static server, for example Python:
python -m http.server 8080
```
Then navigate to `http://localhost:8080` in your web browser.

---

## 🌐 Deploying to GitHub Pages

This repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. In your GitHub repository, go to **Settings > Pages**.
2. Under **Build and deployment > Source**, select **GitHub Actions**.
3. Push commits to `main` branch: GitHub Actions will automatically deploy the site to:
   `https://<your-username>.github.io/hcc-ecm-stiffness-explorer/`

---

## 📚 Citation

If you use or reference this work, please cite the original study:

```bibtex
@article{Wang2025ECM,
  title={High matrix stiffness accelerates migration of hepatocellular carcinoma cells through the integrin {\ss}1-Plectin-F-actin axis},
  author={Wang, Zhihui and Wang, Wenbin and Luo, Qing and Song, Guanbin},
  journal={BMC Biology},
  volume={23},
  number={1},
  pages={8},
  year={2025},
  publisher={BioMed Central},
  doi={10.1186/s12915-025-02113-1}
}
```

---

## 📄 License
This interactive project is open-source under the MIT License. The underlying scientific content is adapted from Wang et al., *BMC Biology* (2025), distributed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0).
