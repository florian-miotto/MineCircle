import {
  isBlockCell,
  getCellLabel,
  getCellKind,
  getCellTitle,
  generateCircleGrid,
  generateSphereLayers,
  generateSphereBlocks3d,
  generateDomeLayers,
  generateDomeBlocks3d,
  generatePorchGrid,
  generateScriptGrid,
  generateStraightStairsGrid,
  generateSpiralStairsGrid,
  generateCurvedStairsGrid
} from "./generators.js";

import { MinecraftThreeRenderer } from "./three-renderer.js";

const FUTURE_SERVICES = [
  {
    title: "Dômes",
    description: "Étendre les générateurs en 3D pour les projets monumentaux."
  },
  {
    title: "Ponts et routes",
    description: "Préparer des tracés réguliers pour relier vos constructions."
  },
  {
    title: "Export plans",
    description: "Exporter en texte ou séquence de construction."
  }
];

const PORCH_STYLE_LABELS = Object.freeze({
  rounded: "Arrondi",
  pointed: "En pointe",
  medieval: "Médiéval"
});

const STAIR_TYPE_LABELS = Object.freeze({
  straight: "Tout droit",
  spiral: "En colimaçon",
  curved: "Arrondi"
});

const DEFAULT_STRUCTURE_CATALOG = Object.freeze([
  {
    id: "mine",
    title: "Mine",
    description: "Structure importée depuis le fichier mine.glb du projet.",
    fileName: "mine.glb",
    modelUrl: "./mine.glb"
  }
]);

const CURVED_DIRECTION_LABELS = Object.freeze({
  right: "Droite",
  left: "Gauche"
});

const TOOL_HINTS = Object.freeze({
  circle: "Astuce : le diamètre contrôle le contour extérieur de la forme.",
  sphere: "Astuce : utilisez le curseur pour parcourir les couches horizontales de la sphère.",
  dome: "Astuce : étirez la hauteur du dôme pour obtenir une demi-sphère basse ou une forme allongée.",
  porch: "Astuce : la largeur du porche est ajustée automatiquement à une valeur impaire pour garder une symétrie propre.",
  stairs: "Astuce : les marches utilisent des blocs escaliers Minecraft et des supports en blocs pleins.",
  script: "Astuce : le texte est converti en blocs, puis affiché en plan et en 3D.",
  structures: "Astuce : choisissez une structure pour afficher son titre, sa description et sa vue 3D."
});

class MinecraftBuilderStudio {
  constructor() {
    this.form = document.getElementById("builder-form");
    this.toolSelect = document.getElementById("tool-select");
    this.circleInput = document.getElementById("diameter-input");
    this.porchWidthInput = document.getElementById("porch-width-input");
    this.porchHeightInput = document.getElementById("porch-height-input");
    this.porchThicknessInput = document.getElementById("porch-thickness-input");
    this.porchStyleInput = document.getElementById("porch-style-input");
    this.domeDiameterInput = document.getElementById("dome-diameter-input");
    this.domeStretchInput = document.getElementById("dome-stretch-input");
    this.domeStretchLabel = document.getElementById("dome-stretch-label");
    this.domeLayerSlider = document.getElementById("dome-layer-input");
    this.domeLayerLabel = document.getElementById("dome-layer-label");
    this.domeSolidToggle = document.getElementById("dome-solid-toggle");
    this.structureList = document.getElementById("structure-list");
    this.stairsHeightInput = document.getElementById("stairs-height-input");
    this.stairsWidthInput = document.getElementById("stairs-width-input");
    this.stairsTypeInput = document.getElementById("stairs-type-input");
    this.stairsTurnControl = document.getElementById("stairs-turn-control");
    this.stairsTurnLabel = document.getElementById("stairs-turn-label");
    this.stairsTurnInput = document.getElementById("stairs-turn-input");
    this.scriptTextInput = document.getElementById("script-text-input");
    this.scriptSizeInput = document.getElementById("script-size-input");
    this.scriptWeightInput = document.getElementById("script-weight-input");
    this.scriptWeightLabel = document.getElementById("script-weight-label");
    this.scriptSpacingInput = document.getElementById("script-spacing-input");
    this.toolHint = document.getElementById("tool-hint");
    this.toolPanels = Array.from(document.querySelectorAll("[data-tool-target]"));
    this.canvasPanel = document.querySelector(".canvas-panel");
    this.grid = document.getElementById("circle-grid");
    this.stairsDetails = document.getElementById("stairs-details");
    this.threeContainer = document.getElementById("stairs-3d-view");
    this.threeViewTitle = document.getElementById("three-view-title");
    this.threeStatus = document.getElementById("stairs-3d-status");
    this.sideDetailBlock = document.getElementById("side-detail-block");
    this.sideGrid = document.getElementById("side-grid");
    this.stats = document.getElementById("stats");
    this.asciiOutput = document.getElementById("ascii-output");
    this.clearButton = document.getElementById("clear-button");
    this.exportButton = document.getElementById("export-button");
    this.exportStatus = document.getElementById("export-status");
    this.sphereLayerSlider = document.getElementById("sphere-layer-input");
    this.sphereLayerLabel = document.getElementById("sphere-layer-label");
    this.futureServicesContainer = document.getElementById("future-services");
    this.toggleSupports3dBtn = document.getElementById("toggle-supports-3d");
    this.sphereSolidToggle = document.getElementById("sphere-solid-toggle");
    this.sphereSolid = Boolean(this.sphereSolidToggle && this.sphereSolidToggle.checked);
    this.structureLoadingMessage = document.getElementById("structure-loading");
    this.constructionControlsContainer = document.getElementById("construction-controls");
    this.prevStepButton = document.getElementById("prev-step-button");
    this.nextStepButton = document.getElementById("next-step-button");
    this.stepCounter = document.getElementById("step-counter");
    this.currentCells = null;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.domeLayers = null;
    this.domeStats = null;
    this.currentSphereLayerIndex = 0;
    this.currentDomeLayerIndex = 0;
    this.structureCatalog = [...DEFAULT_STRUCTURE_CATALOG];
    this.selectedStructureId = this.structureCatalog[0].id;
    this.showSupports3d = true;
    this.domeSolid = Boolean(this.domeSolidToggle && this.domeSolidToggle.checked);

    // Initialiser le moteur de rendu 3D
    const domElements = {
      container: this.threeContainer,
      status: this.threeStatus,
      viewTitle: this.threeViewTitle,
      controlsContainer: this.constructionControlsContainer,
      prevButton: this.prevStepButton,
      nextButton: this.nextStepButton,
      stepCounter: this.stepCounter,
      stairsDetails: this.stairsDetails
    };
    this.threeRenderer = new MinecraftThreeRenderer(domElements);

    this.bindEvents();
    this.renderStructureCatalog();
    this.loadStructureCatalog();
    this.initStructureStream();
    this.renderFutureServices();
    this.syncVisibleControls();
    this.drawCurrentTool();
  }

  bindEvents() {
    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.drawCurrentTool();
    });

    this.toolSelect.addEventListener("change", () => {
      this.syncVisibleControls();
      this.drawCurrentTool();
    });

    this.stairsTypeInput.addEventListener("change", () => {
      this.syncStairTurnControl();
      this.drawCurrentTool();
    });

    this.structureList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-structure-id]");
      if (!button) {
        return;
      }
      this.selectedStructureId = button.dataset.structureId;
      this.renderStructureCatalog();
      if (this.toolSelect.value === "structures") {
        this.drawCurrentTool();
      }
    });

    this.clearButton.addEventListener("click", () => {
      this.clearPreview();
    });

    this.exportButton.addEventListener("click", () => {
      this.exportAsPng();
    });

    this.sphereLayerSlider.addEventListener("input", () => {
      if (!this.sphereLayers) {
        return;
      }
      this.currentSphereLayerIndex = Number(this.sphereLayerSlider.value) - 1;
      this.renderSphereLayer();
    });

    this.domeStretchInput.addEventListener("input", () => {
      this.updateDomeStretchLabel();
      if (this.toolSelect.value === "dome") {
        this.drawCurrentTool();
      }
    });

    this.domeLayerSlider.addEventListener("input", () => {
      if (!this.domeLayers) {
        return;
      }
      this.currentDomeLayerIndex = Number(this.domeLayerSlider.value) - 1;
      this.renderDomeLayer();
    });

    this.scriptWeightInput.addEventListener("input", () => {
      this.updateScriptWeightLabel();
      if (this.toolSelect.value === "script") {
        this.drawCurrentTool();
      }
    });

    this.toggleSupports3dBtn.addEventListener("click", () => {
      this.showSupports3d = !this.showSupports3d;
      this.toggleSupports3dBtn.textContent = this.showSupports3d ? "Masquer les supports (3D)" : "Afficher les supports (3D)";
      this.drawCurrentTool();
    });

    if (this.sphereSolidToggle) {
      this.sphereSolidToggle.addEventListener('change', () => {
        this.sphereSolid = Boolean(this.sphereSolidToggle.checked);
        if (this.toolSelect && this.toolSelect.value === 'sphere') {
          this.drawCurrentTool();
        }
      });
    }

    if (this.domeSolidToggle) {
      this.domeSolidToggle.addEventListener('change', () => {
        this.domeSolid = Boolean(this.domeSolidToggle.checked);
        if (this.toolSelect && this.toolSelect.value === 'dome') {
          this.drawCurrentTool();
        }
      });
    }

    this.prevStepButton.addEventListener("click", () => {
      this.threeRenderer.goToPreviousStep();
    });

    this.nextStepButton.addEventListener("click", () => {
      this.threeRenderer.goToNextStep();
    });

    window.addEventListener("resize", () => {
      this.threeRenderer.resizeThreeView();
    });
  }

  normalizeInteger(rawValue, min, max) {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  normalizeNumber(rawValue, min, max) {
    const parsed = Number.parseFloat(rawValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  normalizeOddInteger(rawValue, min, max) {
    const value = this.normalizeInteger(rawValue, min, max);
    if (!value) {
      return null;
    }
    if (value % 2 === 1) {
      return value;
    }
    if (value + 1 <= max) {
      return value + 1;
    }
    return value - 1;
  }

  syncVisibleControls() {
    const selectedTool = this.toolSelect.value;
    for (const panel of this.toolPanels) {
      let isCurrentPanel = false;
      if (panel.dataset.toolTarget === "circle") {
        isCurrentPanel = selectedTool === "circle" || selectedTool === "sphere";
      } else {
        isCurrentPanel = panel.dataset.toolTarget === selectedTool;
      }
      panel.classList.toggle("hidden", !isCurrentPanel);
    }
    this.toolHint.textContent = TOOL_HINTS[selectedTool] || "";
    this.updateDomeStretchLabel();
    this.updateScriptWeightLabel();
    this.syncStairTurnControl();
  }

  syncStairTurnControl() {
    const type = this.stairsTypeInput.value;
    const usesDirection = type === "spiral" || type === "curved";
    this.stairsTurnControl.classList.toggle("hidden", !usesDirection);
    this.stairsTurnInput.disabled = !usesDirection;
    this.stairsTurnLabel.textContent = type === "curved" ? "Sens de l'arrondi" : "Sens du colimaçon";
  }

  updateDomeStretchLabel() {
    if (!this.domeStretchInput || !this.domeStretchLabel) {
      return;
    }
    const stretch = this.normalizeNumber(this.domeStretchInput.value, 0.5, 3) || 1;
    this.domeStretchLabel.textContent = `Étirement ×${stretch.toFixed(1)}`;
  }

  updateScriptWeightLabel() {
    if (!this.scriptWeightInput || !this.scriptWeightLabel) {
      return;
    }
    const weight = this.normalizeInteger(this.scriptWeightInput.value, 1, 3) || 1;
    const labels = {
      1: "Trait fin",
      2: "Trait moyen",
      3: "Trait épais"
    };
    this.scriptWeightLabel.textContent = labels[weight] || labels[1];
  }

  renderStructureCatalog() {
    const fragment = document.createDocumentFragment();

    if (this.structureCatalog.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "hint";
      emptyMessage.textContent = "Aucune structure disponible.";
      fragment.appendChild(emptyMessage);
      this.structureList.replaceChildren(fragment);
      return;
    }

    for (const structure of this.structureCatalog) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "structure-card";
      button.dataset.structureId = structure.id;
      button.setAttribute("aria-pressed", String(structure.id === this.selectedStructureId));

      const title = document.createElement("span");
      title.className = "structure-card-title";
      title.textContent = structure.title;

      const description = document.createElement("span");
      description.className = "structure-card-description";
      description.textContent = structure.description;

      button.append(title, description);
      fragment.appendChild(button);
    }

    this.structureList.replaceChildren(fragment);
    
    if (this.structureLoadingMessage) {
      this.structureLoadingMessage.classList.add("hidden");
    }
  }

  async loadStructureCatalog() {
    try {
      const response = await fetch("./structures.json", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const structures = await response.json();
      if (!Array.isArray(structures) || structures.length === 0) {
        return;
      }

      this.updateStructureCatalog(structures);
    } catch (error) {
      console.info("Catalogue GLB automatique indisponible, fallback local utilisé.", error);
    }
  }

  updateStructureCatalog(structures) {
    this.structureCatalog = structures
      .filter((structure) => structure && structure.modelUrl)
      .map((structure) => ({
        id: structure.id || structure.fileName || structure.modelUrl,
        title: structure.title || structure.fileName || "Structure",
        description: structure.description || "Structure GLB du dossier du site.",
        fileName: structure.fileName || structure.modelUrl.replace(/^\.\//, ""),
        modelUrl: structure.modelUrl
      }));

    if (!this.structureCatalog.some((structure) => structure.id === this.selectedStructureId)) {
      this.selectedStructureId = this.structureCatalog[0]?.id || null;
    }
    this.renderStructureCatalog();
    if (this.toolSelect.value === "structures") {
      this.drawCurrentTool();
    }
  }

  initStructureStream() {
    if (typeof EventSource === "undefined") {
      return;
    }

    if (this.structureLoadingMessage) {
      this.structureLoadingMessage.classList.remove("hidden");
    }

    try {
      const source = new EventSource("./structures/stream");
      source.onmessage = (evt) => {
        try {
          const structures = JSON.parse(evt.data);
          if (!Array.isArray(structures) || structures.length === 0) {
            return;
          }

          this.updateStructureCatalog(structures);
        } catch (e) {
          console.info("Erreur parsing structures stream", e);
        }
      };

      source.onerror = () => {
        if (this.structureLoadingMessage) {
          this.structureLoadingMessage.classList.add("hidden");
        }
      };
    } catch (e) {
      console.info("Impossible d'initialiser le flux de structures.", e);
      if (this.structureLoadingMessage) {
        this.structureLoadingMessage.classList.add("hidden");
      }
    }
  }

  buildCircleResult() {
    const diameter = this.normalizeInteger(this.circleInput.value, 1, 256);
    if (!diameter) {
      this.showMessage("Diamètre invalide. Saisis un entier entre 1 et 256.");
      return null;
    }

    this.circleInput.value = String(diameter);
    const circle = generateCircleGrid(diameter);

    return {
      cells: circle.cells,
      cols: circle.cols,
      rows: circle.rows,
      stats: [
        ["Outil", "Cercle"],
        ["Diamètre", `${diameter} blocs`],
        ["Blocs du contour", `~${circle.blockCount}`],
        ["Grille affichée", `${circle.cols} × ${circle.rows}`]
      ]
    };
  }

  buildPorchResult() {
    const width = this.normalizeOddInteger(this.porchWidthInput.value, 5, 101);
    const height = this.normalizeInteger(this.porchHeightInput.value, 5, 120);
    const rawThickness = this.normalizeInteger(this.porchThicknessInput.value, 1, 24);
    const style = this.porchStyleInput.value;
    const hasStyle = Object.prototype.hasOwnProperty.call(PORCH_STYLE_LABELS, style);
    const maxThickness = width ? Math.max(1, Math.min(24, Math.floor((width - 3) / 2), height - 2)) : 1;
    const thickness = rawThickness ? Math.min(rawThickness, maxThickness) : null;

    if (!width || !height || !thickness || !hasStyle) {
      this.showMessage("Paramètres de porche invalides. Vérifie largeur, hauteur, épaisseur et style.");
      return null;
    }

    this.porchWidthInput.value = String(width);
    this.porchHeightInput.value = String(height);
    this.porchThicknessInput.value = String(thickness);
    const porch = generatePorchGrid(width, height, style, thickness);

    return {
      cells: porch.cells,
      cols: porch.cols,
      rows: porch.rows,
      stats: [
        ["Outil", "Porche / Entrée monumentale"],
        ["Style du haut", PORCH_STYLE_LABELS[style]],
        ["Largeur × hauteur", `${width} × ${height}`],
        ["Épaisseur", `${thickness} bloc${thickness > 1 ? "s" : ""}`],
        ["Blocs estimés", `~${porch.blockCount}`],
        ["Grille affichée", `${porch.cols} × ${porch.rows}`]
      ]
    };
  }

  buildStairsResult() {
    const height = this.normalizeInteger(this.stairsHeightInput.value, 1, 128);
    const width = this.normalizeInteger(this.stairsWidthInput.value, 1, 16);
    const type = this.stairsTypeInput.value;
    const curvedDirection = this.stairsTurnInput.value;
    const hasType = Object.prototype.hasOwnProperty.call(STAIR_TYPE_LABELS, type);
    const hasCurvedDirection = Object.prototype.hasOwnProperty.call(CURVED_DIRECTION_LABELS, curvedDirection);

    if (!height || !width || !hasType || !hasCurvedDirection) {
      this.showMessage("Paramètres d'escalier invalides. Vérifie hauteur, largeur et type.");
      return null;
    }

    this.stairsHeightInput.value = String(height);
    const stairs = type === "spiral"
      ? generateSpiralStairsGrid(height, width, curvedDirection)
      : type === "curved"
        ? generateCurvedStairsGrid(height, width, curvedDirection)
        : generateStraightStairsGrid(height, width);

    this.stairsWidthInput.value = String(width);
    const stats = [
      ["Outil", "Escalier"],
      ["Type", STAIR_TYPE_LABELS[type]],
      ["Hauteur totale", `${height} blocs`],
      ["Largeur", `${this.stairsWidthInput.value} blocs`],
      ["Blocs escaliers", `${stairs.stairBlockCount}`],
      ["Emprise au sol", stairs.footprint],
      ["Blocs estimés", `~${stairs.blockCount}`],
      ["Grille affichée", `${stairs.cols} × ${stairs.rows}`]
    ];

    if (stairs.slabBlockCount > 0) {
      stats.splice(5, 0, ["Dalles de palier", `${stairs.slabBlockCount}`]);
    }

    if (stairs.platformBlockCount > 0) {
      stats.splice(5, 0, ["Blocs de transition", `${stairs.platformBlockCount}`]);
    }

    if (type === "spiral") {
      stats.splice(2, 0, ["Sens du colimaçon", CURVED_DIRECTION_LABELS[curvedDirection]]);
    } else if (type === "curved") {
      stats.splice(2, 0, ["Sens de l'arrondi", CURVED_DIRECTION_LABELS[curvedDirection]]);
    }

    return {
      cells: stairs.cells,
      cols: stairs.cols,
      rows: stairs.rows,
      sideCells: stairs.sideCells,
      buildPlan: stairs.buildPlan,
      blocks3d: stairs.blocks3d,
      stats
    };
  }

  buildSphereResult() {
    const diameter = this.normalizeInteger(this.circleInput.value, 1, 256);
    if (!diameter) {
      this.showMessage("Diamètre invalide. Saisis un entier entre 1 et 256.");
      return null;
    }

    this.circleInput.value = String(diameter);
    const sphere = generateSphereLayers(diameter, this.sphereSolid);
    this.sphereLayers = sphere.layers;
    this.domeLayers = null;
    this.domeStats = null;
    this.currentSphereLayerIndex = Math.floor(sphere.layers.length / 2);
    this.sphereLayerSlider.max = String(sphere.layers.length);
    this.sphereLayerSlider.value = String(this.currentSphereLayerIndex + 1);
    this.sphereLayerLabel.textContent = `Couche ${this.currentSphereLayerIndex + 1} / ${sphere.layers.length}`;
    this.sphereStats = {
      diameter,
      layers: sphere.layers.length,
      blockCount: sphere.blockCount,
      cols: sphere.cols,
      rows: sphere.rows
    };

    return {
      cells: sphere.layers[this.currentSphereLayerIndex],
      cols: sphere.cols,
      rows: sphere.rows,
      blocks3d: generateSphereBlocks3d(sphere.layers),
      stats: this.getSphereStatsRows()
    };
  }

  buildDomeResult() {
    const diameter = this.normalizeInteger(this.domeDiameterInput.value, 3, 96);
    const stretch = this.normalizeNumber(this.domeStretchInput.value, 0.5, 3);
    if (!diameter || !stretch) {
      this.showMessage("Paramètres de dôme invalides. Vérifie le diamètre et l'étirement.");
      return null;
    }

    this.domeDiameterInput.value = String(diameter);
    this.domeStretchInput.value = String(stretch.toFixed(1));
    this.updateDomeStretchLabel();

    const dome = generateDomeLayers(diameter, stretch, this.domeSolid);
    this.domeLayers = dome.layers;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.currentDomeLayerIndex = 0;
    this.domeLayerSlider.max = String(dome.layers.length);
    this.domeLayerSlider.value = "1";
    this.domeLayerLabel.textContent = `Couche 1 / ${dome.layers.length}`;
    this.domeStats = {
      diameter,
      stretch,
      layers: dome.layers.length,
      blockCount: dome.blockCount,
      cols: dome.cols,
      rows: dome.rows
    };

    return {
      cells: dome.layers[this.currentDomeLayerIndex],
      cols: dome.cols,
      rows: dome.rows,
      blocks3d: generateDomeBlocks3d(dome.layers),
      stats: this.getDomeStatsRows()
    };
  }

  getSphereStatsRows() {
    if (!this.sphereStats) {
      return [];
    }

    return [
      ["Outil", "Sphère"],
      ["Diamètre", `${this.sphereStats.diameter} blocs`],
      ["Couches", `${this.sphereStats.layers}`],
      ["Couche actuelle", `${this.currentSphereLayerIndex + 1}`],
      ["Blocs estimés", `~${this.sphereStats.blockCount}`],
      ["Grille affichée", `${this.sphereStats.cols} × ${this.sphereStats.rows}`]
    ];
  }

  getDomeStatsRows() {
    if (!this.domeStats) {
      return [];
    }

    return [
      ["Outil", "Dôme"],
      ["Diamètre au sol", `${this.domeStats.diameter} blocs`],
      ["Étirement", `×${this.domeStats.stretch.toFixed(1)}`],
      ["Hauteur", `${this.domeStats.layers} couches`],
      ["Couche actuelle", `${this.currentDomeLayerIndex + 1}`],
      ["Blocs estimés", `~${this.domeStats.blockCount}`],
      ["Grille affichée", `${this.domeStats.cols} × ${this.domeStats.rows}`]
    ];
  }

  buildScriptResult() {
    const text = (this.scriptTextInput.value || "").trim();
    const size = this.normalizeInteger(this.scriptSizeInput.value, 1, 8);
    const weight = this.normalizeInteger(this.scriptWeightInput.value, 1, 3);
    const spacing = this.normalizeInteger(this.scriptSpacingInput.value, 0, 8);

    if (!text || !size || !weight || spacing === null) {
      this.showMessage("Paramètres de script invalides. Saisis un texte, une taille, une finesse et un espacement.");
      return null;
    }

    this.scriptSizeInput.value = String(size);
    this.scriptWeightInput.value = String(weight);
    this.scriptSpacingInput.value = String(spacing);
    this.updateScriptWeightLabel();

    const script = generateScriptGrid(text, size, weight, spacing);
    this.scriptTextInput.value = script.text;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.domeLayers = null;
    this.domeStats = null;

    return {
      cells: script.cells,
      cols: script.cols,
      rows: script.rows,
      blocks3d: script.blocks3d,
      stats: [
        ["Outil", "Script"],
        ["Texte", script.text],
        ["Taille", `${size}`],
        ["Finesse", `${weight}`],
        ["Espacement", `${spacing}`],
        ["Blocs estimés", `~${script.blockCount}`],
        ["Grille affichée", script.footprint]
      ]
    };
  }

  buildStructuresResult() {
    const selectedStructure = this.structureCatalog.find((structure) => structure.id === this.selectedStructureId)
      || this.structureCatalog[0]
      || DEFAULT_STRUCTURE_CATALOG[0];

    return {
      title: selectedStructure.title,
      description: selectedStructure.description,
      modelUrl: selectedStructure.modelUrl,
      stats: [
        ["Outil", "Structures"],
        ["Titre", selectedStructure.title],
        ["Description", selectedStructure.description],
        ["Fichier", selectedStructure.fileName],
        ["Moteur", "Three.js"]
      ]
    };
  }

  drawCurrentTool() {
    const selectedTool = this.toolSelect.value;
    let result;

    if (selectedTool === "porch") {
      result = this.buildPorchResult();
    } else if (selectedTool === "sphere") {
      result = this.buildSphereResult();
    } else if (selectedTool === "dome") {
      result = this.buildDomeResult();
    } else if (selectedTool === "structures") {
      result = this.buildStructuresResult();
    } else if (selectedTool === "stairs") {
      result = this.buildStairsResult();
    } else if (selectedTool === "script") {
      result = this.buildScriptResult();
    } else {
      result = this.buildCircleResult();
    }

    if (!result) {
      return;
    }

    if (selectedTool === "structures") {
      this.currentCells = null;
      this.grid.replaceChildren();
      if (this.asciiOutput) {
        this.asciiOutput.textContent = "";
      }
      this.renderDetailViews(result);
      this.updateStats(result.stats);
      return;
    }

    this.currentCells = result.cells;
    this.renderGrid(result.cells, result.cols);
    this.renderDetailViews(result);
    this.renderAscii(result.cells);
    this.updateStats(result.stats);
  }

  renderGrid(cells, cols) {
    this.renderCells(this.grid, cells, cols);
  }

  renderCells(target, cells, cols) {
    target.replaceChildren();
    target.style.setProperty("--cols", String(cols));

    const fragment = document.createDocumentFragment();
    for (const row of cells) {
      for (const isBlock of row) {
        const cell = document.createElement("div");
        const isFilled = isBlockCell(isBlock);
        const kind = getCellKind(isBlock);
        cell.className = isFilled ? `cell block ${kind}` : "cell empty";
        const label = getCellLabel(isBlock);
        if (label) {
          cell.textContent = label;
          cell.title = getCellTitle(isBlock);
        }
        fragment.appendChild(cell);
      }
    }

    target.appendChild(fragment);
  }

  renderDetailViews(result) {
    const selectedTool = this.toolSelect.value;
    const isStairs = selectedTool === "stairs" && result.sideCells;
    const isSphere = selectedTool === "sphere" && result.blocks3d;
    const isDome = selectedTool === "dome" && result.blocks3d;
    const isScript = selectedTool === "script" && result.blocks3d;
    const isStructure = selectedTool === "structures" && result.modelUrl;
    const showDetails = isStairs || isSphere || isDome || isScript || isStructure;

    this.stairsDetails.classList.toggle("hidden", !showDetails);
    this.stairsDetails.classList.toggle("sphere-details", isSphere || isDome || isScript);
    this.canvasPanel.classList.toggle("stairs-layout", isStairs);
    this.canvasPanel.classList.toggle("sphere-layout", isSphere || isDome || isScript);
    this.canvasPanel.classList.toggle("structure-layout", isStructure);
    this.sideDetailBlock.classList.toggle("hidden", !isStairs);
    this.threeViewTitle.textContent = isStructure
      ? "Vue 3D de la structure"
      : isSphere
        ? "Vue 3D de la sphère"
        : isDome
          ? "Vue 3D du dôme"
          : isScript
            ? "Vue 3D du script"
            : "Vue 3D";

    if (!showDetails) {
      this.sideGrid.replaceChildren();
      this.threeRenderer.clearThreeView();
      return;
    }

    if (isStructure) {
      this.threeRenderer.renderStructureModel(result);
      this.sideGrid.replaceChildren();
      return;
    }

    const blocks = result.blocks3d || [];
    this.threeRenderer.renderThreeBlocks(blocks, selectedTool, this.showSupports3d);

    if (!isStairs) {
      this.sideGrid.replaceChildren();
      return;
    }

    this.renderCells(this.sideGrid, result.sideCells, result.sideCells[0].length);
  }

  renderSphereLayer() {
    if (!this.sphereLayers) {
      return;
    }
    const layer = this.sphereLayers[this.currentSphereLayerIndex];
    this.currentCells = layer;
    this.renderGrid(layer, layer[0].length);
    this.renderAscii(layer);
    this.updateSphereLayerLabel();
    this.updateStats(this.getSphereStatsRows());
  }

  renderDomeLayer() {
    if (!this.domeLayers) {
      return;
    }
    const layer = this.domeLayers[this.currentDomeLayerIndex];
    this.currentCells = layer;
    this.renderGrid(layer, layer[0].length);
    this.renderAscii(layer);
    this.updateDomeLayerLabel();
    this.updateStats(this.getDomeStatsRows());
  }

  updateSphereLayerLabel() {
    const layerNumber = this.currentSphereLayerIndex + 1;
    const total = this.sphereLayers ? this.sphereLayers.length : 1;
    this.sphereLayerLabel.textContent = `Couche ${layerNumber} / ${total}`;
  }

  updateDomeLayerLabel() {
    const layerNumber = this.currentDomeLayerIndex + 1;
    const total = this.domeLayers ? this.domeLayers.length : 1;
    this.domeLayerLabel.textContent = `Couche ${layerNumber} / ${total}`;
  }

  renderAscii(cells) {
    if (!this.asciiOutput) {
      return;
    }
    const lines = cells.map((row) => row.map((cell) => {
      return isBlockCell(cell) ? "■ " : "· ";
    }).join(" "));
    this.asciiOutput.textContent = lines.join("\n");
  }

  updateStats(rows) {
    this.stats.innerHTML = rows
      .map(([label, value]) => `<div><strong>${label} :</strong> ${value}</div>`)
      .join("");
  }

  showMessage(message) {
    this.stats.innerHTML = `<div>${message}</div>`;
    this.grid.replaceChildren();
    this.sideGrid.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.canvasPanel.classList.remove("stairs-layout", "sphere-layout", "structure-layout");
    this.threeRenderer.clearThreeView();
    if (this.asciiOutput) {
      this.asciiOutput.textContent = "";
    }
    this.sphereLayers = null;
    this.sphereStats = null;
    this.domeLayers = null;
    this.domeStats = null;
  }

  clearPreview() {
    this.grid.replaceChildren();
    this.sideGrid.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.canvasPanel.classList.remove("stairs-layout", "sphere-layout", "structure-layout");
    this.threeRenderer.clearThreeView();
    if (this.asciiOutput) {
      this.asciiOutput.textContent = "";
    }
    this.stats.innerHTML = "<div>Aucune structure affichée.</div>";
    this.currentCells = null;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.domeLayers = null;
    this.domeStats = null;
    this.currentSphereLayerIndex = 0;
    this.currentDomeLayerIndex = 0;
  }

  exportAsPng() {
    if (!this.currentCells || this.currentCells.length === 0) {
      this.exportStatus.textContent = "Aucune structure à exporter.";
      return;
    }

    const canvas = document.createElement('canvas');
    const cellSize = 16;
    canvas.width = this.currentCells[0].length * cellSize;
    canvas.height = this.currentCells.length * cellSize;
    const ctx = canvas.getContext('2d');

    this.currentCells.forEach((row, y) => {
      row.forEach((cell, x) => {
        ctx.fillStyle = isBlockCell(cell) ? '#22c55e' : '#0b1020';
        if (getCellKind(cell) === 'stair') {
          ctx.fillStyle = '#d59a3a';
        }
        if (getCellKind(cell) === 'slab') {
          ctx.fillStyle = '#c58a2b';
        }
        if (getCellKind(cell) === 'platform') {
          ctx.fillStyle = '#9f6b2f';
        }
        if (getCellKind(cell) === 'core') {
          ctx.fillStyle = '#64748b';
        }
        if (getCellKind(cell) === 'support') {
          ctx.fillStyle = '#38bdf8';
        }
        if (getCellKind(cell) === 'dome') {
          ctx.fillStyle = '#0ea5e9';
        }
        if (getCellKind(cell) === 'script') {
          ctx.fillStyle = '#a855f7';
        }
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        const label = getCellLabel(cell);
        if (label) {
          ctx.fillStyle = getCellKind(cell) === 'core' ? '#f8fafc' : '#052e16';
          ctx.font = '9px Segoe UI, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
        }
      });
    });

    const link = document.createElement('a');
    link.download = 'minecraft-structure.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    this.exportStatus.textContent = "PNG exporté avec succès.";
  }

  renderFutureServices() {
    const fragment = document.createDocumentFragment();
    for (const service of FUTURE_SERVICES) {
      const card = document.createElement("article");
      card.className = "future-card";
      card.innerHTML = `<h3>${service.title}</h3><p>${service.description}</p>`;
      fragment.appendChild(card);
    }
    this.futureServicesContainer.replaceChildren(fragment);
  }
}

new MinecraftBuilderStudio();
