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
    description: "Exporter en image, texte ou séquence de construction."
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
  porch: "Astuce : la largeur du porche est ajustée automatiquement à une valeur impaire pour garder une symétrie propre.",
  stairs: "Astuce : les marches utilisent des blocs escaliers Minecraft et des supports en blocs pleins.",
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
    this.structureList = document.getElementById("structure-list");
    this.stairsHeightInput = document.getElementById("stairs-height-input");
    this.stairsWidthInput = document.getElementById("stairs-width-input");
    this.stairsTypeInput = document.getElementById("stairs-type-input");
    this.stairsTurnControl = document.getElementById("stairs-turn-control");
    this.stairsTurnLabel = document.getElementById("stairs-turn-label");
    this.stairsTurnInput = document.getElementById("stairs-turn-input");
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
    this.structureLoadingMessage = document.getElementById("structure-loading");
    this.constructionControlsContainer = document.getElementById("construction-controls");
    this.prevStepButton = document.getElementById("prev-step-button");
    this.nextStepButton = document.getElementById("next-step-button");
    this.stepCounter = document.getElementById("step-counter");
    this.currentCells = null;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.currentSphereLayerIndex = 0;
    this.structureCatalog = [...DEFAULT_STRUCTURE_CATALOG];
    this.selectedStructureId = this.structureCatalog[0].id;
    this.threeState = null;
    this.showSupports3d = true;
    this.buildSteps = [];
    this.currentBuildStep = 0;
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

    this.toggleSupports3dBtn.addEventListener("click", () => {
      this.showSupports3d = !this.showSupports3d;
      this.toggleSupports3dBtn.textContent = this.showSupports3d ? "Masquer les supports (3D)" : "Afficher les supports (3D)";
      this.drawCurrentTool();
    });

    this.prevStepButton.addEventListener("click", () => {
      this.goToPreviousStep();
    });

    this.nextStepButton.addEventListener("click", () => {
      this.goToNextStep();
    });

    window.addEventListener("resize", () => {
      this.resizeThreeView();
    });
  }

  normalizeInteger(rawValue, min, max) {
    const parsed = Number.parseInt(rawValue, 10);
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
    this.syncStairTurnControl();
  }

  syncStairTurnControl() {
    const type = this.stairsTypeInput.value;
    const usesDirection = type === "spiral" || type === "curved";
    this.stairsTurnControl.classList.toggle("hidden", !usesDirection);
    this.stairsTurnInput.disabled = !usesDirection;
    this.stairsTurnLabel.textContent = type === "curved" ? "Sens de l'arrondi" : "Sens du colimaçon";
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
    
    // Masquer le message de chargement
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

    // Afficher le message de chargement
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
        // Masquer le message de chargement en cas d'erreur
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

  generateCircleGrid(diameter) {
    const margin = 2;
    const size = diameter + margin * 2;
    const radius = diameter / 2;
    const center = (size - 1) / 2;
    const cells = [];
    let blockCount = 0;

    for (let y = 0; y < size; y += 1) {
      const row = [];
      for (let x = 0; x < size; x += 1) {
        const distanceToCenter = Math.hypot(x - center, y - center);
        const isCircleBlock = distanceToCenter <= radius && distanceToCenter > radius - 1;
        row.push(isCircleBlock);
        if (isCircleBlock) {
          blockCount += 1;
        }
      }
      cells.push(row);
    }

    return { cells, cols: size, rows: size, blockCount };
  }

  generateSphereLayers(diameter) {
    const margin = 2;
    const size = diameter + margin * 2;
    const radius = diameter / 2;
    const center = (size - 1) / 2;
    const layers = [];
    let blockCount = 0;

    for (let z = 0; z < diameter; z += 1) {
      const zDistance = Math.abs(z + margin - center);
      const layerRadius = Math.sqrt(Math.max(0, radius * radius - zDistance * zDistance));
      const cells = [];

      for (let y = 0; y < size; y += 1) {
        const row = [];
        for (let x = 0; x < size; x += 1) {
          const distanceToCenter = Math.hypot(x - center, y - center);
          const isBlock = distanceToCenter <= layerRadius && distanceToCenter > layerRadius - 1;
          row.push(isBlock);
          if (isBlock) {
            blockCount += 1;
          }
        }
        cells.push(row);
      }

      layers.push(cells);
    }

    return { layers, cols: size, rows: size, blockCount };
  }

  generateSphereBlocks3d(layers) {
    if (!layers || layers.length === 0) {
      return [];
    }

    const blocks = [];
    const rows = layers[0].length;
    const cols = layers[0][0].length;
    const centerX = (cols - 1) / 2;
    const centerZ = (rows - 1) / 2;
    const centerY = (layers.length - 1) / 2;

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const layer = layers[layerIndex];
      for (let z = 0; z < rows; z += 1) {
        for (let x = 0; x < cols; x += 1) {
          if (layer[z][x]) {
            blocks.push(this.createBlock3d(
              x - centerX,
              layerIndex - centerY,
              z - centerZ,
              "sphere",
              1,
              1,
              1
            ));
          }
        }
      }
    }

    return blocks;
  }

  getArchContribution(style, ratioFromCenter, rise, index) {
    if (style === "rounded") {
      return Math.round(Math.sqrt(Math.max(0, 1 - ratioFromCenter ** 2)) * rise);
    }

    if (style === "pointed") {
      return Math.round((1 - ratioFromCenter) * rise);
    }

    if (style === "medieval") {
      return index % 2 === 0 ? rise : Math.max(1, rise - 1);
    }

    return Math.round((1 - ratioFromCenter) * rise);
  }

  buildProfile(span, baseHeight, rise, style) {
    const center = (span - 1) / 2;
    const halfSpan = Math.max(1, (span - 1) / 2);
    const heights = [];

    for (let x = 0; x < span; x += 1) {
      const distance = Math.abs(x - center);
      const ratio = Math.min(1, distance / halfSpan);
      const topContribution = this.getArchContribution(style, ratio, rise, x);
      heights.push(Math.max(1, baseHeight + topContribution));
    }

    return heights;
  }

  generatePorchGrid(width, height, style, thickness) {
    const marginX = 2;
    const marginY = 2;
    const roofRise = Math.max(2, Math.min(height - 3, Math.round(height * 0.32)));
    const bodyHeight = height - roofRise;
    const openingWidth = Math.max(1, width - thickness * 2);
    const outerProfile = this.buildProfile(width, bodyHeight, roofRise, style);
    const cols = width + marginX * 2;
    const rows = height + marginY * 2;
    const groundRow = rows - marginY - 1;
    const openingLeft = Math.floor((width - openingWidth) / 2);
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));

    for (let x = 0; x < width; x += 1) {
      for (let y = 0; y < outerProfile[x]; y += 1) {
        const row = groundRow - y;
        const col = x + marginX;
        if (row >= 0 && row < rows) {
          cells[row][col] = true;
        }
      }
    }

    for (let x = 0; x < openingWidth; x += 1) {
      const profileX = openingLeft + x;
      let openingHeight = outerProfile[profileX] - thickness;
      if (profileX > 0 && outerProfile[profileX - 1] < outerProfile[profileX]) {
        openingHeight = Math.min(openingHeight, outerProfile[profileX - 1] - thickness);
      }
      if (profileX < width - 1 && outerProfile[profileX + 1] < outerProfile[profileX]) {
        openingHeight = Math.min(openingHeight, outerProfile[profileX + 1] - thickness);
      }
      openingHeight = Math.max(1, openingHeight);
      for (let y = 0; y < openingHeight; y += 1) {
        const row = groundRow - y;
        const col = openingLeft + x + marginX;
        if (row >= 0 && row < rows) {
          cells[row][col] = false;
        }
      }
    }

    if (style === "medieval") {
      this.addMedievalDetails(cells, groundRow, marginX, width, bodyHeight, thickness);
    }

    const blockCount = cells.reduce((total, row) => total + row.filter(Boolean).length, 0);
    return { cells, cols, rows, blockCount };
  }

  createStepCell(level) {
    return {
      block: true,
      kind: "stair",
      label: String(level),
      title: `Bloc escalier ${level}`
    };
  }

  createSlabCell(level) {
    return {
      block: true,
      kind: "slab",
      label: "",
      title: `Dalle de palier ${level}`
    };
  }

  createPlatformCell(level) {
    return {
      block: true,
      kind: "platform",
      label: "",
      title: `Bloc de transition ${level}`
    };
  }

  createCoreCell(label = "") {
    return {
      block: true,
      kind: "core",
      label,
      title: "Pilier / support"
    };
  }

  createSupportCell() {
    return {
      block: true,
      kind: "support",
      label: "",
      title: "Remplissage de sécurité"
    };
  }

  createBlock3d(x, y, z, kind = "block", width = 1, height = 1, depth = 1, rotationY = 0) {
    return { x, y, z, kind, width, height, depth, rotationY };
  }

  createStairBlock3d(x, step, z, rotationY = 0) {
    const block = this.createBlock3d(
      x,
      this.getStairCenterY(step),
      z,
      "stair",
      1,
      1,
      1,
      this.quantizeRotation90(rotationY)
    );
    block.step = step;
    return block;
  }

  createSlabBlock3d(x, step, z) {
    const block = this.createBlock3d(x, this.getStairBaseY(step) + 0.25, z, "slab", 1, 0.5, 1);
    block.step = step;
    return block;
  }

  createPlatformBlock3d(x, step, z) {
    const block = this.createBlock3d(x, this.getStairBaseY(step) + 0.5, z, "platform", 1, 1, 1);
    block.step = step;
    return block;
  }

  getStairStepCount(height) {
    return height;
  }

  getStairCenterY(step) {
    return this.getStairBaseY(step) + 0.5;
  }

  getStairBaseY(step) {
    return step - 1;
  }

  createSupportColumnBlocks(x, z, height) {
    return this.createSupportSegmentBlocks(x, z, 0, height);
  }

  createSupportSegmentBlocks(x, z, fromHeight, toHeight) {
    const height = toHeight - fromHeight;
    if (height <= 0) {
      return [];
    }
    const blocks = [];
    const fullBlocks = Math.floor(height);
    let cursor = fromHeight;

    for (let level = 0; level < fullBlocks; level += 1) {
      blocks.push(this.createBlock3d(x, cursor + 0.5, z, "support", 0.9, 1, 0.9));
      cursor += 1;
    }

    const remainingHeight = height - fullBlocks;
    if (remainingHeight > 0.01) {
      blocks.push(this.createBlock3d(
        x,
        cursor + remainingHeight / 2,
        z,
        "support",
        0.9,
        remainingHeight,
        0.9
      ));
    }

    return blocks;
  }

  createStairBaseBlocks(x, z, baseHeight) {
    return this.createSupportColumnBlocks(x, z, baseHeight);
  }

  addGroundSupportsForFloatingBlocks(blocks) {
    const epsilon = 0.001;
    const requiredColumns = new Map();

    for (const block of blocks) {
      if (block.kind !== "stair" && block.kind !== "slab" && block.kind !== "platform") {
        continue;
      }

      const bottom = this.getBlockBottomY(block);
      if (bottom <= epsilon) {
        continue;
      }

      const key = this.getColumnKey(block.x, block.z);
      const required = requiredColumns.get(key);
      if (!required || bottom > required.height) {
        requiredColumns.set(key, { x: block.x, z: block.z, height: bottom });
      }
    }

    const supportBlocks = [];
    for (const column of requiredColumns.values()) {
      const intervals = blocks
        .filter((block) => this.getColumnKey(block.x, block.z) === this.getColumnKey(column.x, column.z))
        .map((block) => ({
          start: Math.max(0, this.getBlockBottomY(block)),
          end: Math.min(column.height, this.getBlockTopY(block))
        }))
        .filter((interval) => interval.end > 0 && interval.start < column.height)
        .sort((a, b) => a.start - b.start || b.end - a.end);

      let cursor = 0;
      for (const interval of intervals) {
        if (interval.start > cursor + epsilon) {
          supportBlocks.push(...this.createSupportSegmentBlocks(column.x, column.z, cursor, interval.start));
        }
        cursor = Math.max(cursor, interval.end);
        if (cursor >= column.height - epsilon) {
          break;
        }
      }

      if (cursor < column.height - epsilon) {
        supportBlocks.push(...this.createSupportSegmentBlocks(column.x, column.z, cursor, column.height));
      }
    }

    blocks.push(...supportBlocks);
    return supportBlocks.length;
  }

  getBlockBottomY(block) {
    return block.y - block.height / 2;
  }

  getBlockTopY(block) {
    return block.y + block.height / 2;
  }

  getColumnKey(x, z) {
    return `${Math.round(x * 1000) / 1000},${Math.round(z * 1000) / 1000}`;
  }

  quantizeRotation90(rotationY) {
    const quarterTurn = Math.PI / 2;
    return Math.round(rotationY / quarterTurn) * quarterTurn;
  }

  getStairRotationFromVector(directionX, directionZ) {
    return this.quantizeRotation90(Math.atan2(directionX, directionZ));
  }

  createCoreBlocks(height, x = 0, z = 0) {
    const blocks = [];
    for (let level = 0; level < height; level += 1) {
      blocks.push(this.createBlock3d(x, level + 0.5, z, "core", 1, 1, 1));
    }
    return blocks;
  }

  generateStraightStairsGrid(height, width, type) {
    const margin = 2;
    const stepCount = this.getStairStepCount(height);
    const cols = width + margin * 2;
    const rows = stepCount + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const buildPlan = [];
    const blocks3d = [];
    const xOffset = (width - 1) / 2;
    let supportUnitCount = 0;

    for (let step = 1; step <= stepCount; step += 1) {
      const row = rows - margin - step;
      const supportHeight = this.getStairBaseY(step);
      for (let x = 0; x < width; x += 1) {
        cells[row][x + margin] = this.createStepCell(step);
        const x3d = x - xOffset;
        const supportBlocks = this.createSupportColumnBlocks(x3d, step - 1, supportHeight);
        blocks3d.push(...supportBlocks);
        supportUnitCount += supportBlocks.length;
        blocks3d.push(this.createStairBlock3d(x3d, step, step - 1));
      }
      buildPlan.push({
        level: step,
        label: `Marche ${step}`,
        detail: `Pose ${this.formatStairBlockCount(width)} ${this.formatStairLevel(step)}, orientés vers l'avant, avec des blocs pleins de support dessous si nécessaire.`
      });
    }

    supportUnitCount += this.addGroundSupportsForFloatingBlocks(blocks3d);

    return {
      cells,
      cols,
      rows,
      stairBlockCount: stepCount * width,
      slabBlockCount: 0,
      blockCount: stepCount * width + supportUnitCount,
      footprint: `${width} × ${stepCount}`,
      sideCells: this.generateStairsSideView(height, stepCount, type),
      blocks3d,
      buildPlan
    };
  }

  generateSpiralStairsGrid(height, width, direction = "right") {
    const walkwayWidth = Math.max(1, width);
    const stepCount = this.getStairStepCount(height);
    const innerRadius = 1.35;
    const turnPerStep = Math.PI / 4;
    const sectorHalfTurn = turnPerStep * 0.5;
    const turnSign = direction === "left" ? -1 : 1;
    const gridRadius = Math.ceil(innerRadius + walkwayWidth + 0.85);
    const footprint = gridRadius * 2 + 1;
    const center = Math.floor(footprint / 2);
    const margin = 2;
    const cols = footprint + margin * 2;
    const rows = footprint + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const buildPlan = [];
    const blocks3d = this.createCoreBlocks(height + 1);
    const placements = [];
    let supportUnitCount = 0;
    let stairBlockCount = 0;
    let slabBlockCount = 0;
    let platformBlockCount = 0;
    cells[center + margin][center + margin] = this.createCoreCell("P");

    for (let step = 1; step <= stepCount; step += 1) {
      const angle = -Math.PI / 2 + (step - 1) * turnPerStep * turnSign;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const exitAngle = angle + turnPerStep * 0.5 * turnSign;
      const fallbackStairRotation = this.getStairRotationFromVector(
        -Math.sin(exitAngle) * turnSign,
        Math.cos(exitAngle) * turnSign
      );
      const sectorStart = angle - sectorHalfTurn;
      const sectorEnd = angle + sectorHalfTurn;
      const supportHeight = this.getStairBaseY(step);
      const stepPositions = this.getSpiralStepPositions(
        gridRadius,
        innerRadius,
        walkwayWidth,
        sectorStart,
        sectorEnd,
        angle
      );
      const nextAngle = -Math.PI / 2 + step * turnPerStep * turnSign;
      const nextStepPositions = step < stepCount
        ? this.getSpiralStepPositions(
          gridRadius,
          innerRadius,
          walkwayWidth,
          nextAngle - sectorHalfTurn,
          nextAngle + sectorHalfTurn,
          nextAngle
        )
        : [];
      const stairRotations = this.selectSpiralStairBand(
        stepPositions,
        exitAngle,
        walkwayWidth,
        nextStepPositions,
        fallbackStairRotation
      );
      let stepStairCount = 0;
      let stepSlabCount = 0;
      let stepPlatformCount = 0;

      for (const position of stepPositions) {
        const projectionX = center + position.x;
        const projectionY = center + position.z;
        const key = this.getPositionKey(position.x, position.z);
        const transition = stairRotations.get(key);
        const isStair = transition && transition.kind === "stair";
        const isPlatform = transition && transition.kind === "platform";
        const cellRow = projectionY + margin;
        const cellCol = projectionX + margin;
        if (isStair || isPlatform || this.getCellKind(cells[cellRow][cellCol]) !== "stair") {
          cells[cellRow][cellCol] = isStair
            ? this.createStepCell(step)
            : isPlatform
              ? this.createPlatformCell(step)
              : this.createSlabCell(step);
        }

        if (isStair || isPlatform) {
          const supportBlocks = position.support
            ? this.createSupportColumnBlocks(position.x, position.z, supportHeight)
            : this.createStairBaseBlocks(position.x, position.z, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
          if (isStair) {
            blocks3d.push(this.createStairBlock3d(
              position.x,
              step,
              position.z,
              transition.rotationY
            ));
            stairBlockCount += 1;
            stepStairCount += 1;
          } else {
            blocks3d.push(this.createPlatformBlock3d(position.x, step, position.z));
            platformBlockCount += 1;
            stepPlatformCount += 1;
          }
        } else {
          if (position.support) {
            const supportBlocks = this.createSupportColumnBlocks(position.x, position.z, supportHeight);
            blocks3d.push(...supportBlocks);
            supportUnitCount += supportBlocks.length;
          }
          blocks3d.push(this.createSlabBlock3d(position.x, step, position.z));
          slabBlockCount += 1;
          stepSlabCount += 1;
        }
        placements.push({
          step,
          x: position.x,
          z: position.z,
          support: position.support || isStair || isPlatform,
          kind: isStair ? "stair" : isPlatform ? "platform" : "slab"
        });
      }

      const sideLabel = this.getSpiralPositionLabel(
        Math.round(cos),
        Math.round(sin)
      );
      buildPlan.push({
        level: step,
        label: `Marche ${step}`,
        detail: `Pose ${this.formatStairBlockCount(stepStairCount)} contre la bordure du niveau suivant, ${this.formatPlatformBlockCount(stepPlatformCount)} de transition, puis ${this.formatSlabBlockCount(stepSlabCount)} de palier ${this.formatStairLevel(step)}, ${sideLabel} du pilier.`
      });
    }

    supportUnitCount += this.addGroundSupportsForFloatingBlocks(blocks3d);
    const blockCount = stairBlockCount + slabBlockCount + platformBlockCount + height + 1 + supportUnitCount;

    return {
      cells,
      cols,
      rows,
      stairBlockCount,
      slabBlockCount,
      platformBlockCount,
      blockCount,
      footprint: `${footprint} × ${footprint}`,
      sideCells: this.generateStairsSideView(height, stepCount, "spiral", walkwayWidth, placements),
      blocks3d,
      buildPlan
    };
  }

  getSpiralStepPositions(gridRadius, innerRadius, walkwayWidth, sectorStart, sectorEnd, centerAngle) {
    const positions = new Map();
    const outerRadius = innerRadius + walkwayWidth + 0.35;

    for (let z = -gridRadius; z <= gridRadius; z += 1) {
      for (let x = -gridRadius; x <= gridRadius; x += 1) {
        const radius = Math.hypot(x, z);
        if (radius < innerRadius || radius > outerRadius) {
          continue;
        }
        const angle = Math.atan2(z, x);
        if (this.isAngleBetween(angle, sectorStart, sectorEnd)) {
          positions.set(`${x},${z}`, { x, z });
        }
      }
    }

    const cos = Math.cos(centerAngle);
    const sin = Math.sin(centerAngle);
    for (let band = 0; band < walkwayWidth; band += 1) {
      const radius = innerRadius + band + 0.2;
      const x = Math.round(cos * radius);
      const z = Math.round(sin * radius);
      positions.set(`${x},${z}`, { x, z });
    }

    const result = Array.from(positions.values());
    const radii = result.map((position) => Math.hypot(position.x, position.z));
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);

    for (const position of result) {
      const radius = Math.hypot(position.x, position.z);
      position.support = radius <= minRadius + 0.45 || radius >= maxRadius - 0.45;
    }

    return result.sort((a, b) => {
      const angleA = this.normalizeAngle(Math.atan2(a.z, a.x) - centerAngle);
      const angleB = this.normalizeAngle(Math.atan2(b.z, b.x) - centerAngle);
      return Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || angleA - angleB;
    });
  }

  selectSpiralStairBand(positions, targetAngle, walkwayWidth, nextPositions = [], fallbackRotation = 0) {
    const selected = new Map();
    if (positions.length === 0) {
      return selected;
    }

    const nextKeys = new Set(nextPositions.map((position) => this.getPositionKey(position.x, position.z)));
    for (const position of positions) {
      const directions = this.getAdjacentDirections(position.x, position.z, nextKeys, targetAngle);
      if (directions.length === 1) {
        const direction = directions[0];
        selected.set(
          this.getPositionKey(position.x, position.z),
          {
            kind: "stair",
            rotationY: this.getStairRotationFromVector(direction.x, direction.z)
          }
        );
      } else if (directions.length > 1) {
        selected.set(this.getPositionKey(position.x, position.z), { kind: "platform" });
      }
    }

    if (selected.size > 0) {
      return selected;
    }

    const radii = positions.map((position) => Math.hypot(position.x, position.z));
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);
    for (let band = 0; band < walkwayWidth; band += 1) {
      const ratio = walkwayWidth === 1 ? 0.5 : band / (walkwayWidth - 1);
      const targetRadius = minRadius + (maxRadius - minRadius) * ratio;
      let bestPosition = null;
      let bestScore = Infinity;

      for (const position of positions) {
        const key = this.getPositionKey(position.x, position.z);
        if (selected.has(key)) {
          continue;
        }

        const radius = Math.hypot(position.x, position.z);
        const angleOffset = Math.abs(this.normalizeAngle(Math.atan2(position.z, position.x) - targetAngle));
        const score = Math.abs(radius - targetRadius) * 1.35 + angleOffset * 4;
        if (score < bestScore) {
          bestScore = score;
          bestPosition = position;
        }
      }

      if (bestPosition) {
        selected.set(this.getPositionKey(bestPosition.x, bestPosition.z), {
          kind: "stair",
          rotationY: fallbackRotation
        });
      }
    }

    if (selected.size === 0) {
      const closest = positions.reduce((best, position) => {
        const angleOffset = Math.abs(this.normalizeAngle(Math.atan2(position.z, position.x) - targetAngle));
        return !best || angleOffset < best.angleOffset ? { position, angleOffset } : best;
      }, null);
      if (closest) {
        selected.set(this.getPositionKey(closest.position.x, closest.position.z), {
          kind: "stair",
          rotationY: fallbackRotation
        });
      }
    }

    return selected;
  }

  selectCurvedStairBand(positions, targetAngle, pivotX, pivotY, mirror, width, nextPositions = []) {
    const selected = new Map();
    if (positions.length === 0) {
      return selected;
    }

    const nextKeys = new Set(nextPositions.map((position) => this.getPositionKey(position.x, position.y)));
    for (const position of positions) {
      const directions = this.getAdjacentDirections(position.x, position.y, nextKeys, targetAngle);
      if (directions.length === 1) {
        const direction = directions[0];
        selected.set(
          this.getPositionKey(position.x, position.y),
          {
            kind: "stair",
            rotationY: this.getStairRotationFromVector(direction.x, direction.z)
          }
        );
      } else if (directions.length > 1) {
        selected.set(this.getPositionKey(position.x, position.y), { kind: "platform" });
      }
    }

    if (selected.size > 0) {
      return selected;
    }

    const radii = positions.map((position) => Math.hypot(
      (position.x - pivotX) * mirror,
      position.y - pivotY
    ));
    const minRadius = Math.min(...radii);
    const maxRadius = Math.max(...radii);
    const fallbackRotation = this.getStairRotationFromVector(
      -Math.sin(targetAngle) * mirror,
      Math.cos(targetAngle)
    );

    for (let band = 0; band < width; band += 1) {
      const ratio = width === 1 ? 0.5 : band / (width - 1);
      const targetRadius = maxRadius - (maxRadius - minRadius) * ratio;
      let bestPosition = null;
      let bestScore = Infinity;

      for (const position of positions) {
        const key = this.getPositionKey(position.x, position.y);
        if (selected.has(key)) {
          continue;
        }

        const normalizedX = (position.x - pivotX) * mirror;
        const normalizedY = position.y - pivotY;
        const currentRadius = Math.hypot(normalizedX, normalizedY);
        const angleOffset = Math.abs(this.normalizeAngle(Math.atan2(normalizedY, normalizedX) - targetAngle));
        const score = Math.abs(currentRadius - targetRadius) * 1.35 + angleOffset * 4;
        if (score < bestScore) {
          bestScore = score;
          bestPosition = position;
        }
      }

      if (bestPosition) {
        selected.set(this.getPositionKey(bestPosition.x, bestPosition.y), {
          kind: "stair",
          rotationY: fallbackRotation
        });
      }
    }

    if (selected.size === 0) {
      const closest = positions.reduce((best, position) => {
        const normalizedX = (position.x - pivotX) * mirror;
        const normalizedY = position.y - pivotY;
        const angleOffset = Math.abs(this.normalizeAngle(Math.atan2(normalizedY, normalizedX) - targetAngle));
        return !best || angleOffset < best.angleOffset ? { position, angleOffset } : best;
      }, null);
      if (closest) {
        selected.set(this.getPositionKey(closest.position.x, closest.position.y), {
          kind: "stair",
          rotationY: fallbackRotation
        });
      }
    }

    return selected;
  }

  getAdjacentDirections(x, z, positionKeys, targetAngle) {
    const directions = [
      { x: 0, z: 1 },
      { x: 1, z: 0 },
      { x: 0, z: -1 },
      { x: -1, z: 0 }
    ];

    return directions
      .filter((direction) => positionKeys.has(this.getPositionKey(x + direction.x, z + direction.z)))
      .map((direction) => {
        const angle = Math.atan2(direction.z, direction.x);
        return {
          ...direction,
          score: Math.abs(this.normalizeAngle(angle - targetAngle))
        };
      })
      .sort((a, b) => a.score - b.score);
  }

  getPositionKey(x, z) {
    return `${x},${z}`;
  }

  normalizeAngle(angle) {
    let normalized = angle;
    while (normalized <= -Math.PI) {
      normalized += Math.PI * 2;
    }
    while (normalized > Math.PI) {
      normalized -= Math.PI * 2;
    }
    return normalized;
  }

  isAngleBetween(angle, start, end) {
    const normalizedAngle = this.normalizeAngle(angle - start);
    const normalizedEnd = this.normalizeAngle(end - start);
    return normalizedAngle >= 0 && normalizedAngle <= normalizedEnd;
  }

  generateCurvedStairsGrid(height, width, direction) {
    const stepCount = this.getStairStepCount(height);
    const footprint = Math.max(width * 2 + stepCount, 7);
    const margin = 2;
    const cols = footprint + margin * 2;
    const rows = footprint + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const pivotX = direction === "right" ? width : footprint - width - 1;
    const pivotY = footprint - width - 1;
    const radius = Math.max(width + 1, Math.round(footprint * 0.55));
    const mirror = direction === "right" ? -1 : 1;
    const angleStart = Math.PI;
    const angleEnd = Math.PI * 1.5;
    const buildPlan = [];
    const blocks3d = [];
    const placements = [];
    let supportUnitCount = 0;
    let stairBlockCount = 0;
    let slabBlockCount = 0;
    let platformBlockCount = 0;

    const stepsByLevel = Array.from({ length: stepCount + 1 }, () => new Map());
    const innerRadius = radius - width + 0.25;
    const outerRadius = radius + 0.75;
    const totalAngle = angleEnd - angleStart;

    for (let y = 0; y < footprint; y += 1) {
      for (let x = 0; x < footprint; x += 1) {
        const normalizedX = (x - pivotX) * mirror;
        const normalizedY = y - pivotY;
        const distance = Math.hypot(normalizedX, normalizedY);

        if (distance < innerRadius || distance > outerRadius) {
          continue;
        }

        let angle = Math.atan2(normalizedY, normalizedX);
        if (angle < 0) {
          angle += Math.PI * 2;
        }

        if (angle < angleStart || angle > angleEnd) {
          continue;
        }

        const angleRatio = totalAngle === 0 ? 0 : (angle - angleStart) / totalAngle;
        const step = Math.max(1, Math.min(stepCount, Math.floor(angleRatio * stepCount) + 1));
        stepsByLevel[step].set(`${x},${y}`, { x, y });
      }
    }

    for (let step = 1; step <= stepCount; step += 1) {
      const sectorStart = angleStart + totalAngle * ((step - 1) / stepCount);
      const sectorEnd = angleStart + totalAngle * (step / stepCount);
      const angle = (sectorStart + sectorEnd) / 2;
      const exitAngle = sectorEnd;
      const supportHeight = this.getStairBaseY(step);
      const stairRotation = this.getStairRotationFromVector(
        -Math.sin(exitAngle) * mirror,
        Math.cos(exitAngle)
      );

      for (let band = 0; band < width; band += 1) {
        const currentRadius = radius - band;
        const x = Math.round(pivotX + Math.cos(angle) * currentRadius * mirror);
        const y = Math.round(pivotY + Math.sin(angle) * currentRadius);
        if (x >= 0 && x < footprint && y >= 0 && y < footprint) {
          stepsByLevel[step].set(`${x},${y}`, { x, y });
        }
      }

      const stepPositions = Array.from(stepsByLevel[step].values());
      const stairKeys = this.selectCurvedStairBand(
        stepPositions,
        exitAngle,
        pivotX,
        pivotY,
        mirror,
        width,
        step < stepCount ? Array.from(stepsByLevel[step + 1].values()) : []
      );
      let stepStairCount = 0;
      let stepSlabCount = 0;
      let stepPlatformCount = 0;

      for (const position of stepPositions) {
        const x3d = position.x - pivotX;
        const z3d = position.y - pivotY;
        const normalizedX = x3d * mirror;
        const distance = Math.hypot(normalizedX, z3d);
        const support = distance <= innerRadius + 0.45 || distance >= outerRadius - 0.45;
        const key = this.getPositionKey(position.x, position.y);
        const transition = stairKeys.get(key);
        const isStair = transition && transition.kind === "stair";
        const isPlatform = transition && transition.kind === "platform";

        const cellRow = position.y + margin;
        const cellCol = position.x + margin;
        if (isStair || isPlatform || this.getCellKind(cells[cellRow][cellCol]) !== "stair") {
          cells[cellRow][cellCol] = isStair
            ? this.createStepCell(step)
            : isPlatform
              ? this.createPlatformCell(step)
              : this.createSlabCell(step);
        }

        if (isStair || isPlatform) {
          const supportBlocks = support
            ? this.createSupportColumnBlocks(x3d, z3d, supportHeight)
            : this.createStairBaseBlocks(x3d, z3d, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
          if (isStair) {
            blocks3d.push(this.createStairBlock3d(x3d, step, z3d, transition.rotationY || stairRotation));
            stairBlockCount += 1;
            stepStairCount += 1;
          } else {
            blocks3d.push(this.createPlatformBlock3d(x3d, step, z3d));
            platformBlockCount += 1;
            stepPlatformCount += 1;
          }
        } else {
          if (support) {
            const supportBlocks = this.createSupportColumnBlocks(x3d, z3d, supportHeight);
            blocks3d.push(...supportBlocks);
            supportUnitCount += supportBlocks.length;
          }
          blocks3d.push(this.createSlabBlock3d(x3d, step, z3d));
          slabBlockCount += 1;
          stepSlabCount += 1;
        }

        placements.push({
          step,
          x: x3d,
          z: z3d,
          support: support || isStair || isPlatform,
          kind: isStair ? "stair" : isPlatform ? "platform" : "slab"
        });
      }

      buildPlan.push({
        level: step,
        label: `Marche ${step}`,
        detail: `Pose ${this.formatStairBlockCount(stepStairCount)} contre la bordure du niveau suivant, ${this.formatPlatformBlockCount(stepPlatformCount)} de transition, puis ${this.formatSlabBlockCount(stepSlabCount)} de palier ${this.formatStairLevel(step)}, en arrondissant vers la ${CURVED_DIRECTION_LABELS[direction].toLowerCase()}.`
      });
    }

    supportUnitCount += this.addGroundSupportsForFloatingBlocks(blocks3d);
    const blockCount = stairBlockCount + slabBlockCount + platformBlockCount + supportUnitCount;

    return {
      cells,
      cols,
      rows,
      stairBlockCount,
      slabBlockCount,
      platformBlockCount,
      blockCount,
      footprint: `${footprint} × ${footprint}`,
      sideCells: this.generateStairsSideView(height, stepCount, "curved", width, placements),
      blocks3d,
      buildPlan
    };
  }

  formatStairLevel(step) {
    const level = this.getStairBaseY(step);
    if (level === 0) {
      return "au niveau du sol";
    }
    return `au niveau ${level}`;
  }

  formatStairBlockCount(count) {
    return `${count} bloc${count > 1 ? "s" : ""} escalier${count > 1 ? "s" : ""}`;
  }

  formatSlabBlockCount(count) {
    return `${count} dalle${count > 1 ? "s" : ""}`;
  }

  formatPlatformBlockCount(count) {
    return `${count} bloc${count > 1 ? "s" : ""}`;
  }

  getSpiralPositionLabel(dx, dy) {
    const horizontal = dx > 0 ? "est" : dx < 0 ? "ouest" : "";
    const vertical = dy > 0 ? "sud" : dy < 0 ? "nord" : "";
    if (horizontal && vertical) {
      return `au ${vertical}-${horizontal}`;
    }
    if (horizontal) {
      return `côté ${horizontal}`;
    }
    if (vertical) {
      return `côté ${vertical}`;
    }
    return "autour";
  }

  generateStairsSideView(height, length, type, width = 1, placements = []) {
    if ((type === "spiral" || type === "curved") && placements.length > 0) {
      return this.generateSpiralSideView(height, length, width, placements);
    }

    const margin = 2;
    const cols = length + margin * 2;
    const rows = this.getStairStepCount(height) + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const baseline = rows - margin - 1;

    for (let step = 1; step <= length; step += 1) {
      const col = margin + Math.min(length - 1, step - 1);
      const row = baseline - (step - 1);
      for (let supportRow = row + 1; supportRow <= baseline; supportRow += 1) {
        cells[supportRow][col] = this.createSupportCell();
      }
      cells[row][col] = this.createStepCell(step);
    }

    return cells;
  }

  generateSpiralSideView(height, stepCount, width, placements) {
    const margin = 2;
    const maxOffset = Math.max(
      width + 2,
      ...placements.map((placement) => Math.abs(placement.x))
    );
    const sideSpan = maxOffset * 2 + 3;
    const cols = sideSpan + margin * 2;
    const rows = this.getStairStepCount(height) + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const baseline = rows - margin - 1;
    const centerCol = margin + maxOffset + 1;

    for (let row = margin; row <= baseline; row += 1) {
      cells[row][centerCol] = this.createCoreCell(row === margin ? "P" : "");
    }

    for (const placement of placements) {
      const row = baseline - (placement.step - 1);
      const col = centerCol + placement.x;
      if (col < 0 || col >= cols || row < 0 || row >= rows || col === centerCol) {
        continue;
      }
      if (placement.support) {
        for (let supportRow = row + 1; supportRow <= baseline; supportRow += 1) {
          if (!cells[supportRow][col]) {
            cells[supportRow][col] = this.createSupportCell();
          }
        }
      }
      const placementCell = placement.kind === "stair"
        ? this.createStepCell(placement.step)
        : placement.kind === "platform"
          ? this.createPlatformCell(placement.step)
          : this.createSlabCell(placement.step);
      if (!cells[row][col] || placement.kind === "stair" || placement.kind === "platform") {
        cells[row][col] = placementCell;
      }
    }

    return cells;
  }

  addMedievalDetails(cells, groundRow, marginX, width, bodyHeight, thickness) {
    const buttressHeight = Math.max(3, Math.round(bodyHeight * 0.65));
    const left = marginX;
    const right = marginX + width - 1;
    const buttressWidth = Math.max(1, Math.min(thickness, Math.floor(width / 4)));

    for (let y = 0; y < buttressHeight; y += 1) {
      const row = groundRow - y;
      if (row < 0 || row >= cells.length) {
        break;
      }
      for (let offset = 0; offset < buttressWidth; offset += 1) {
        cells[row][left + offset] = true;
        cells[row][right - offset] = true;
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
    const circle = this.generateCircleGrid(diameter);

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
    const porch = this.generatePorchGrid(width, height, style, thickness);

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
      ? this.generateSpiralStairsGrid(height, width, curvedDirection)
      : type === "curved"
        ? this.generateCurvedStairsGrid(height, width, curvedDirection)
        : this.generateStraightStairsGrid(height, width, type);

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
    const sphere = this.generateSphereLayers(diameter);
    this.sphereLayers = sphere.layers;
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
      blocks3d: this.generateSphereBlocks3d(sphere.layers),
      stats: this.getSphereStatsRows()
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
    } else if (selectedTool === "structures") {
      result = this.buildStructuresResult();
    } else if (selectedTool === "stairs") {
      result = this.buildStairsResult();
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
        const isFilled = this.isBlockCell(isBlock);
        const kind = this.getCellKind(isBlock);
        cell.className = isFilled ? `cell block ${kind}` : "cell empty";
        const label = this.getCellLabel(isBlock);
        if (label) {
          cell.textContent = label;
          cell.title = this.getCellTitle(isBlock);
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
    const isStructure = selectedTool === "structures" && result.modelUrl;
    const showDetails = isStairs || isSphere || isStructure;

    this.stairsDetails.classList.toggle("hidden", !showDetails);
    this.stairsDetails.classList.toggle("sphere-details", isSphere);
    this.canvasPanel.classList.toggle("stairs-layout", isStairs);
    this.canvasPanel.classList.toggle("sphere-layout", isSphere);
    this.canvasPanel.classList.toggle("structure-layout", isStructure);
    this.sideDetailBlock.classList.toggle("hidden", !isStairs);
    this.threeViewTitle.textContent = isStructure
      ? "Vue 3D de la structure"
      : isSphere
        ? "Vue 3D de la sphère"
        : "Vue 3D";

    if (!showDetails) {
      this.sideGrid.replaceChildren();
      this.clearThreeView();
      return;
    }

    if (isStructure) {
      this.renderStructureModel(result);
      this.sideGrid.replaceChildren();
      return;
    }

    // Construire les étapes de construction pour les blocs 3D
    const blocks = result.blocks3d || [];
    if (blocks.length > 0) {
      this.buildConstructionSteps(blocks);
      this.currentBuildStep = this.buildSteps.length - 1; // Afficher la dernière étape
      this.updateConstructionUI();
    }

    this.renderCurrentBuildStep(false);

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

  updateSphereLayerLabel() {
    const layerNumber = this.currentSphereLayerIndex + 1;
    const total = this.sphereLayers ? this.sphereLayers.length : 1;
    this.sphereLayerLabel.textContent = `Couche ${layerNumber} / ${total}`;
  }

  renderAscii(cells) {
    if (!this.asciiOutput) return;

    const lines = cells.map((row) => row.map((cell) => {
      const label = this.getCellLabel(cell);
      if (label) {
        return /^\d+$/.test(label) ? label.padStart(2, "0").slice(-2) : label.padStart(2, " ");
      }
      return this.isBlockCell(cell) ? "■ " : "· ";
    }).join(" "));
    this.asciiOutput.textContent = lines.join("\n");
  }

  isBlockCell(cell) {
    return typeof cell === "object" && cell !== null ? Boolean(cell.block) : Boolean(cell);
  }

  getCellLabel(cell) {
    return typeof cell === "object" && cell !== null ? cell.label : "";
  }

  getCellKind(cell) {
    if (typeof cell !== "object" || cell === null) {
      return "step";
    }
    return cell.kind || "step";
  }

  getCellTitle(cell) {
    if (typeof cell !== "object" || cell === null) {
      return "";
    }
    return cell.title || cell.label || "";
  }

  initThreeView() {
    if (this.threeState) {
      return true;
    }

    const THREE = window.THREE;
    if (!THREE) {
      this.threeStatus.textContent = "Vue 3D indisponible : Three.js n'a pas pu être chargé.";
      return false;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a18);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.threeContainer.replaceChildren(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xffffff, 0.62);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(8, 12, 7);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fill.position.set(-8, 6, -8);
    scene.add(ambient, key, fill);

    this.threeState = {
      scene,
      camera,
      renderer,
      group,
      materials: new Map(),
      cameraDistance: 14,
      minCameraDistance: 6,
      maxCameraDistance: 80,
      targetY: 1,
      isDragging: false,
      lastX: 0,
      lastY: 0
    };

    this.bindThreeDragEvents();
    this.resizeThreeView();
    this.animateThreeView();
    return true;
  }

  bindThreeDragEvents() {
    const { renderer, group } = this.threeState;
    const canvas = renderer.domElement;

    canvas.addEventListener("pointerdown", (event) => {
      this.threeState.isDragging = true;
      this.threeState.lastX = event.clientX;
      this.threeState.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.threeState.isDragging) {
        return;
      }
      const deltaX = event.clientX - this.threeState.lastX;
      const deltaY = event.clientY - this.threeState.lastY;
      this.threeState.lastX = event.clientX;
      this.threeState.lastY = event.clientY;
      group.rotation.y += deltaX * 0.01;
      group.rotation.x = Math.max(-0.75, Math.min(0.35, group.rotation.x + deltaY * 0.006));
    });

    canvas.addEventListener("pointerup", (event) => {
      this.threeState.isDragging = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointercancel", () => {
      this.threeState.isDragging = false;
    });

    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY > 0 ? 1.12 : 0.88;
      this.threeState.cameraDistance = Math.max(
        this.threeState.minCameraDistance,
        Math.min(this.threeState.maxCameraDistance, this.threeState.cameraDistance * zoomFactor)
      );
      this.positionThreeCamera();
    }, { passive: false });
  }

  renderThreeBlocks(blocks, options = {}) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    this.threeState.structureLoadToken = null;
    group.clear();

    // On filtre les blocs de support si l'option est désactivée
    const filteredBlocks = this.showSupports3d ? blocks : blocks.filter(b => b.kind !== 'support');

    const centeredBlocks = this.centerBlocksForThreeView(filteredBlocks);

    const maxY = centeredBlocks.reduce((max, block) => Math.max(max, block.y + block.height / 2), 1);
    const minY = centeredBlocks.reduce((min, block) => Math.min(min, block.y - block.height / 2), 0);
    const heightSpan = Math.max(1, maxY - minY);
    const maxRadius = centeredBlocks.reduce((max, block) => {
      const radius = Math.hypot(block.x, block.z) + Math.max(block.width, block.depth);
      return Math.max(max, radius);
    }, 3);
    const showEdges = centeredBlocks.length <= 900;

    if (centeredBlocks.length > 1200) {
      this.addInstancedMinecraftBoxes(group, centeredBlocks);
    } else {
      for (const block of centeredBlocks) {
        this.addMinecraftBox(group, block, showEdges);
      }
    }

    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
    }
    const gridSize = Math.max(8, maxRadius * 2.6);
    const grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
    grid.position.y = options.gridAtBottom ? -0.02 : minY - 0.02;
    grid.material.color.set(0x334155);
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);
    this.threeState.grid = grid;

    this.threeState.targetY = (minY + maxY) * 0.5;
    this.threeState.minCameraDistance = Math.max(5, maxRadius * 0.9);
    this.threeState.maxCameraDistance = Math.max(22, maxRadius * 5, heightSpan * 2.6);
    this.threeState.cameraDistance = Math.max(10, maxRadius * 2.35, heightSpan * 1.25);
    this.positionThreeCamera();
    renderer.render(scene, camera);
    this.threeStatus.textContent = options.status || "Glissez pour tourner. Utilisez la molette pour zoomer.";
  }

  async renderStructureModel(structure) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    const loadToken = Symbol("structure-load");
    this.threeState.structureLoadToken = loadToken;
    group.clear();
    group.rotation.set(0, 0, 0);
    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
      this.threeState.grid = null;
    }

    const label = structure.title || structure.modelUrl;
    this.threeStatus.textContent = `Chargement de ${label}...`;

    try {
      const model = await this.loadGlbModel(structure.modelUrl);
      if (this.threeState.structureLoadToken !== loadToken) {
        return;
      }

      group.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) {
        this.threeStatus.textContent = "Le fichier GLB est chargé, mais aucun volume visible n'a été trouvé.";
        return;
      }

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      bounds.getCenter(center);
      bounds.getSize(size);
      model.position.sub(center);

      const centeredBounds = new THREE.Box3().setFromObject(model);
      const minY = centeredBounds.min.y;
      const maxY = centeredBounds.max.y;
      const maxRadius = Math.max(size.x, size.z, 1) * 0.75;
      const heightSpan = Math.max(1, maxY - minY);
      const gridSize = Math.max(8, Math.max(size.x, size.z) * 1.35);
      const grid = new THREE.GridHelper(gridSize, Math.max(8, Math.ceil(gridSize)));
      grid.position.y = minY - 0.02;
      grid.material.color.set(0x334155);
      grid.material.opacity = 0.28;
      grid.material.transparent = true;
      scene.add(grid);
      this.threeState.grid = grid;

      this.threeState.targetY = (minY + maxY) * 0.5;
      this.threeState.minCameraDistance = Math.max(3, maxRadius * 0.5);
      this.threeState.maxCameraDistance = Math.max(30, maxRadius * 8, heightSpan * 5);
      this.threeState.cameraDistance = Math.max(8, maxRadius * 2.4, heightSpan * 1.4);
      this.positionThreeCamera();
      renderer.render(scene, camera);
      this.threeStatus.textContent = `${structure.title} chargé depuis ${structure.modelUrl}. Glissez pour tourner. Utilisez la molette pour zoomer.`;
    } catch (error) {
      console.error(error);
      const detail = error && error.message ? error.message : "erreur inconnue";
      this.threeStatus.textContent = window.location.protocol === "file:"
        ? "Impossible de charger le GLB en file://. Lancez node dev-server.cjs puis ouvrez http://127.0.0.1:8000/index.html."
        : `Impossible de charger le GLB : ${detail}`;
    }
  }

  async loadGlbModel(modelUrl) {
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`GLB introuvable: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return this.parseGlbModel(buffer);
  }

  parseGlbModel(buffer) {
    const THREE = window.THREE;
    const view = new DataView(buffer);
    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    if (magic !== 0x46546c67 || version !== 2) {
      throw new Error("Format GLB non supporté.");
    }

    let offset = 12;
    let json = null;
    let binaryChunk = null;
    while (offset < buffer.byteLength) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      const chunkStart = offset + 8;
      const chunkEnd = chunkStart + chunkLength;
      if (chunkType === 0x4e4f534a) {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, chunkStart, chunkLength)));
      } else if (chunkType === 0x004e4942) {
        binaryChunk = new Uint8Array(buffer, chunkStart, chunkLength);
      }
      offset = chunkEnd;
    }

    if (!json || !binaryChunk) {
      throw new Error("GLB incomplet.");
    }

    const textures = this.createGlbTextures(json, binaryChunk);
    const materials = (json.materials || []).map((material) => this.createGlbMaterial(material, textures));
    const meshes = (json.meshes || []).map((mesh) => this.createGlbMesh(mesh, json, binaryChunk, materials));
    const nodes = (json.nodes || []).map((node) => {
      const group = new THREE.Group();
      group.name = node.name || "";
      if (typeof node.mesh === "number" && meshes[node.mesh]) {
        group.add(meshes[node.mesh].clone());
      }
      this.applyGlbNodeTransform(group, node);
      return group;
    });

    (json.nodes || []).forEach((node, index) => {
      if (!node.children) {
        return;
      }
      for (const childIndex of node.children) {
        if (nodes[childIndex]) {
          nodes[index].add(nodes[childIndex]);
        }
      }
    });

    const root = new THREE.Group();
    const scene = json.scenes?.[json.scene || 0] || json.scenes?.[0];
    const rootNodeIndices = scene?.nodes || nodes.map((_, index) => index);
    for (const nodeIndex of rootNodeIndices) {
      if (nodes[nodeIndex]) {
        root.add(nodes[nodeIndex]);
      }
    }

    return root;
  }

  createGlbMesh(mesh, json, binaryChunk, materials) {
    const THREE = window.THREE;
    const group = new THREE.Group();
    group.name = mesh.name || "";

    for (const primitive of mesh.primitives || []) {
      if ((primitive.mode ?? 4) !== 4) {
        continue;
      }

      const geometry = new THREE.BufferGeometry();
      for (const [attributeName, accessorIndex] of Object.entries(primitive.attributes || {})) {
        const attribute = this.getGlbAccessorAttribute(json, binaryChunk, accessorIndex);
        const threeName = this.getThreeAttributeName(attributeName);
        if (threeName) {
          geometry.setAttribute(threeName, attribute);
        }
      }

      if (typeof primitive.indices === "number") {
        geometry.setIndex(this.getGlbAccessorAttribute(json, binaryChunk, primitive.indices));
      }
      if (!geometry.getAttribute("normal")) {
        geometry.computeVertexNormals();
      }

      const material = materials[primitive.material] || new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.9 });
      group.add(new THREE.Mesh(geometry, material));
    }

    return group;
  }

  getThreeAttributeName(attributeName) {
    const names = {
      POSITION: "position",
      NORMAL: "normal",
      TEXCOORD_0: "uv",
      COLOR_0: "color"
    };
    return names[attributeName] || "";
  }

  getGlbAccessorAttribute(json, binaryChunk, accessorIndex) {
    const THREE = window.THREE;
    const accessor = json.accessors[accessorIndex];
    const array = this.readGlbAccessorArray(json, binaryChunk, accessorIndex);
    return new THREE.BufferAttribute(array, this.getGlbAccessorItemSize(accessor.type), Boolean(accessor.normalized));
  }

  readGlbAccessorArray(json, binaryChunk, accessorIndex) {
    const accessor = json.accessors[accessorIndex];
    const bufferView = json.bufferViews[accessor.bufferView];
    const TypedArray = this.getGlbComponentArray(accessor.componentType);
    const itemSize = this.getGlbAccessorItemSize(accessor.type);
    const componentSize = TypedArray.BYTES_PER_ELEMENT;
    const count = accessor.count * itemSize;
    const accessorOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const stride = bufferView.byteStride || itemSize * componentSize;

    if (stride === itemSize * componentSize) {
      return new TypedArray(binaryChunk.buffer, binaryChunk.byteOffset + accessorOffset, count);
    }

    const result = new TypedArray(count);
    const dataView = new DataView(binaryChunk.buffer, binaryChunk.byteOffset + accessorOffset, bufferView.byteLength - (accessor.byteOffset || 0));
    for (let index = 0; index < accessor.count; index += 1) {
      for (let item = 0; item < itemSize; item += 1) {
        result[index * itemSize + item] = this.readGlbComponent(dataView, index * stride + item * componentSize, accessor.componentType);
      }
    }
    return result;
  }

  getGlbAccessorItemSize(type) {
    const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    return sizes[type] || 1;
  }

  getGlbComponentArray(componentType) {
    const arrays = {
      5120: Int8Array,
      5121: Uint8Array,
      5122: Int16Array,
      5123: Uint16Array,
      5125: Uint32Array,
      5126: Float32Array
    };
    return arrays[componentType] || Float32Array;
  }

  readGlbComponent(dataView, offset, componentType) {
    const readers = {
      5120: () => dataView.getInt8(offset),
      5121: () => dataView.getUint8(offset),
      5122: () => dataView.getInt16(offset, true),
      5123: () => dataView.getUint16(offset, true),
      5125: () => dataView.getUint32(offset, true),
      5126: () => dataView.getFloat32(offset, true)
    };
    return readers[componentType]();
  }

  createGlbTextures(json, binaryChunk) {
    const THREE = window.THREE;
    const loader = new THREE.TextureLoader();
    return (json.textures || []).map((texture) => {
      const image = json.images?.[texture.source];
      if (!image || typeof image.bufferView !== "number") {
        return null;
      }

      const bufferView = json.bufferViews[image.bufferView];
      const start = bufferView.byteOffset || 0;
      const end = start + bufferView.byteLength;
      const blob = new Blob([binaryChunk.slice(start, end)], { type: image.mimeType || "image/png" });
      const url = URL.createObjectURL(blob);
      const threeTexture = loader.load(url, () => URL.revokeObjectURL(url));
      threeTexture.flipY = false;
      if ("colorSpace" in threeTexture) {
        threeTexture.colorSpace = THREE.SRGBColorSpace;
      }
      return threeTexture;
    });
  }

  createGlbMaterial(material, textures) {
    const THREE = window.THREE;
    const pbr = material.pbrMetallicRoughness || {};
    const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
    const meshMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(baseColor[0], baseColor[1], baseColor[2]),
      opacity: baseColor[3] ?? 1,
      transparent: (baseColor[3] ?? 1) < 1 || material.alphaMode === "BLEND",
      roughness: pbr.roughnessFactor ?? 0.9,
      metalness: pbr.metallicFactor ?? 0
    });

    const textureIndex = pbr.baseColorTexture?.index;
    if (typeof textureIndex === "number" && textures[textureIndex]) {
      meshMaterial.map = textures[textureIndex];
    }

    return meshMaterial;
  }

  applyGlbNodeTransform(object, node) {
    if (node.matrix) {
      object.matrix.fromArray(node.matrix);
      object.matrix.decompose(object.position, object.quaternion, object.scale);
      return;
    }
    if (node.translation) {
      object.position.fromArray(node.translation);
    }
    if (node.rotation) {
      object.quaternion.fromArray(node.rotation);
    }
    if (node.scale) {
      object.scale.fromArray(node.scale);
    }
  }

  centerBlocksForThreeView(blocks) {
    if (!blocks || blocks.length === 0) {
      return [];
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const block of blocks) {
      minX = Math.min(minX, block.x - block.width / 2);
      maxX = Math.max(maxX, block.x + block.width / 2);
      minZ = Math.min(minZ, block.z - block.depth / 2);
      maxZ = Math.max(maxZ, block.z + block.depth / 2);
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    return blocks.map((block) => ({
      ...block,
      x: block.x - centerX,
      z: block.z - centerZ
    }));
  }

  addMinecraftBox(group, block, showEdges) {
    if (block.kind === "stair") {
      this.addMinecraftStairBlock(group, block, showEdges);
      return;
    }

    const THREE = window.THREE;
    const geometry = new THREE.BoxGeometry(block.width, block.height, block.depth);
    const material = this.getThreeMaterial(block.kind);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(block.x, block.y, block.z);
    mesh.rotation.y = block.rotationY || 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (!showEdges) {
      return;
    }

    const edgeColor = this.getBlockEdgeColor(block.kind);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.30 })
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
  }

  addMinecraftStairBlock(group, block, showEdges) {
    const THREE = window.THREE;
    const stairGroup = new THREE.Group();
    const material = this.getThreeMaterial("stair");
    const pieces = [
      {
        geometry: new THREE.BoxGeometry(block.width, block.height / 2, block.depth),
        y: -block.height / 4,
        z: 0
      },
      {
        geometry: new THREE.BoxGeometry(block.width, block.height / 2, block.depth / 2),
        y: block.height / 4,
        z: block.depth / 4
      }
    ];

    stairGroup.position.set(block.x, block.y, block.z);
    stairGroup.rotation.y = block.rotationY || 0;

    for (const piece of pieces) {
      const mesh = new THREE.Mesh(piece.geometry, material);
      mesh.position.set(0, piece.y, piece.z);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      stairGroup.add(mesh);

      if (showEdges) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(piece.geometry),
          new THREE.LineBasicMaterial({
            color: this.getBlockEdgeColor("stair"),
            transparent: true,
            opacity: 0.34
          })
        );
        edges.position.copy(mesh.position);
        stairGroup.add(edges);
      }
    }

    group.add(stairGroup);
  }

  getBlockEdgeColor(kind) {
    if (kind === "core") {
      return 0x1f2937;
    }
    if (kind === "support") {
      return 0x083344;
    }
    if (kind === "sphere") {
      return 0x14532d;
    }
    if (kind === "stair") {
      return 0x5f3510;
    }
    if (kind === "slab") {
      return 0x78350f;
    }
    if (kind === "platform") {
      return 0x3f2a12;
    }
    return 0x3f2a12;
  }

  buildConstructionSteps(blocks) {
    // Grouper les blocs par hauteur Y pour créer des étapes
    const heightMap = new Map();
    
    for (const block of blocks) {
      const roundedY = Math.round(block.y * 2) / 2;
      if (!heightMap.has(roundedY)) {
        heightMap.set(roundedY, []);
      }
      heightMap.get(roundedY).push(block);
    }
    
    // Trier par hauteur et créer des étapes cumulatives
    const sortedHeights = Array.from(heightMap.keys()).sort((a, b) => a - b);
    const steps = [];
    const cumulativeBlocks = [];
    
    for (const height of sortedHeights) {
      cumulativeBlocks.push(...heightMap.get(height));
      steps.push([...cumulativeBlocks]);
    }
    
    this.buildSteps = steps;
    this.currentBuildStep = 0;
    return steps;
  }

  updateConstructionUI() {
    // Mettre à jour la visibilité et l'état des boutons
    const hasSteps = this.buildSteps.length > 0;
    this.constructionControlsContainer.classList.toggle("hidden", !hasSteps);
    
    if (!hasSteps) {
      return;
    }
    
    const isFirstStep = this.currentBuildStep === 0;
    const isLastStep = this.currentBuildStep === this.buildSteps.length - 1;
    
    this.prevStepButton.disabled = isFirstStep;
    this.nextStepButton.disabled = isLastStep;
    
    this.stepCounter.textContent = "Étape " + (this.currentBuildStep + 1) + " / " + this.buildSteps.length;
  }

  goToPreviousStep() {
    if (this.currentBuildStep > 0) {
      this.currentBuildStep--;
      this.renderCurrentBuildStep(true);
    }
  }

  goToNextStep() {
    if (this.currentBuildStep < this.buildSteps.length - 1) {
      this.currentBuildStep++;
      this.renderCurrentBuildStep(false);
    }
  }

  renderCurrentBuildStep(goingBackward = false) {
    if (this.buildSteps.length === 0) {
      return;
    }
    
    const currentStepBlocks = this.buildSteps[this.currentBuildStep];
    this.updateConstructionUI();
    this.renderThreeBlocksWithAnimation(currentStepBlocks, goingBackward);
  }

  renderThreeBlocksWithAnimation(blocks, goingBackward = false) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    this.threeState.structureLoadToken = null;
    
    const filteredBlocks = this.showSupports3d ? blocks : blocks.filter(b => b.kind !== 'support');
    const centeredBlocks = this.centerBlocksForThreeView(filteredBlocks);

    const maxY = centeredBlocks.reduce((max, block) => Math.max(max, block.y + block.height / 2), 1);
    const minY = centeredBlocks.reduce((min, block) => Math.min(min, block.y - block.height / 2), 0);
    const heightSpan = Math.max(1, maxY - minY);
    const maxRadius = centeredBlocks.reduce((max, block) => {
      const radius = Math.hypot(block.x, block.z) + Math.max(block.width, block.depth);
      return Math.max(max, radius);
    }, 3);

    group.clear();
    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
    }

    const showEdges = centeredBlocks.length <= 900;
    const blockMeshes = [];

    if (centeredBlocks.length > 1200) {
      this.addInstancedMinecraftBoxes(group, centeredBlocks);
    } else {
      for (const block of centeredBlocks) {
        const mesh = this.createBlockMesh(group, block, showEdges);
        if (mesh) {
          blockMeshes.push(mesh);
        }
      }
    }

    const gridSize = Math.max(8, maxRadius * 2.6);
    const grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
    grid.position.y = minY - 0.02;
    grid.material.color.set(0x334155);
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);
    this.threeState.grid = grid;

    this.threeState.targetY = (minY + maxY) * 0.5;
    this.threeState.minCameraDistance = Math.max(5, maxRadius * 0.9);
    this.threeState.maxCameraDistance = Math.max(22, maxRadius * 5, heightSpan * 2.6);
    this.threeState.cameraDistance = Math.max(10, maxRadius * 2.35, heightSpan * 1.25);
    this.positionThreeCamera();

    // Animer seulement s'il y a des blocs (pas de meshes si instancés ou escaliers)
    if (blockMeshes.length > 0) {
      this.animateBlocksAppearance(blockMeshes, goingBackward);
    }

    renderer.render(scene, camera);
    this.threeStatus.textContent = "Glissez pour tourner. Utilisez la molette pour zoomer.";
  }

  createBlockMesh(group, block, showEdges) {
    const THREE = window.THREE;
    
    if (block.kind === "stair") {
      this.addMinecraftStairBlock(group, block, showEdges);
      return null;
    }

    const geometry = new THREE.BoxGeometry(block.width, block.height, block.depth);
    const material = this.getThreeMaterial(block.kind);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(block.x, block.y, block.z);
    mesh.rotation.y = block.rotationY || 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.scale.set(0, 0, 0);
    group.add(mesh);

    if (showEdges) {
      const edgeColor = this.getBlockEdgeColor(block.kind);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.30 })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      edges.scale.set(0, 0, 0);
      group.add(edges);
      mesh.userData.edgesMesh = edges;
    }

    return mesh;
  }

  animateBlocksAppearance(blockMeshes, goingBackward = false) {
    const GSAP = window.gsap;
    
    if (!GSAP) {
      for (const mesh of blockMeshes) {
        mesh.scale.set(1, 1, 1);
        if (mesh.userData.edgesMesh) {
          mesh.userData.edgesMesh.scale.set(1, 1, 1);
        }
      }
      return;
    }

    for (const mesh of blockMeshes) {
      mesh.scale.set(0, 0, 0);
      if (mesh.userData.edgesMesh) {
        mesh.userData.edgesMesh.scale.set(0, 0, 0);
      }
    }

    const duration = 0.4;
    const delayIncrement = 0.05;

    blockMeshes.forEach((mesh, index) => {
      const delay = goingBackward ? (blockMeshes.length - index - 1) * delayIncrement : index * delayIncrement;
      
      GSAP.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration,
        delay,
        ease: "back.out"
      });

      if (mesh.userData.edgesMesh) {
        GSAP.to(mesh.userData.edgesMesh.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration,
          delay,
          ease: "back.out"
        }, "<");
      }
    });
  }

  addInstancedMinecraftBoxes(group, blocks) {
    const THREE = window.THREE;
    const groupedBlocks = new Map();
    const stairBlocks = [];

    for (const block of blocks) {
      if (block.kind === "stair") {
        stairBlocks.push(block);
        continue;
      }

      const key = [
        block.kind || "block",
        block.width,
        block.height,
        block.depth
      ].join("|");
      if (!groupedBlocks.has(key)) {
        groupedBlocks.set(key, []);
      }
      groupedBlocks.get(key).push(block);
    }

    const dummy = new THREE.Object3D();
    for (const blockGroup of groupedBlocks.values()) {
      const sample = blockGroup[0];
      const geometry = new THREE.BoxGeometry(sample.width, sample.height, sample.depth);
      const material = this.getThreeMaterial(sample.kind);
      const mesh = new THREE.InstancedMesh(geometry, material, blockGroup.length);

      blockGroup.forEach((block, index) => {
        dummy.position.set(block.x, block.y, block.z);
        dummy.rotation.set(0, block.rotationY || 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    }

    if (stairBlocks.length > 0) {
      this.addInstancedStairBlocks(group, stairBlocks);
    }
  }

  addInstancedStairBlocks(group, blocks) {
    const THREE = window.THREE;
    const material = this.getThreeMaterial("stair");
    const lowerGeometry = new THREE.BoxGeometry(1, 0.5, 1);
    const upperGeometry = new THREE.BoxGeometry(1, 0.5, 0.5);
    const lowerMesh = new THREE.InstancedMesh(lowerGeometry, material, blocks.length);
    const upperMesh = new THREE.InstancedMesh(upperGeometry, material, blocks.length);
    const dummy = new THREE.Object3D();

    blocks.forEach((block, index) => {
      const rotationY = block.rotationY || 0;
      const width = block.width || 1;
      const height = block.height || 1;
      const depth = block.depth || 1;

      dummy.position.set(block.x, block.y - height / 4, block.z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      lowerMesh.setMatrixAt(index, dummy.matrix);

      dummy.position.set(
        block.x + Math.sin(rotationY) * depth / 4,
        block.y + height / 4,
        block.z + Math.cos(rotationY) * depth / 4
      );
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      upperMesh.setMatrixAt(index, dummy.matrix);
    });

    lowerMesh.instanceMatrix.needsUpdate = true;
    upperMesh.instanceMatrix.needsUpdate = true;
    lowerMesh.receiveShadow = true;
    upperMesh.receiveShadow = true;
    group.add(lowerMesh);
    group.add(upperMesh);
  }

  getThreeMaterial(kind) {
    const THREE = window.THREE;
    const cacheKey = kind || "block";
    if (this.threeState.materials.has(cacheKey)) {
      return this.threeState.materials.get(cacheKey);
    }

    const palettes = {
      block: ["#4ade80", "#16a34a", "#86efac", "#166534"],
      core: ["#6b7280", "#4b5563", "#9ca3af", "#374151"],
      support: ["#38bdf8", "#0e7490", "#67e8f9", "#155e75"],
      sphere: ["#4ade80c5", "#16a34a93", "#86efadc0", "#15803c48"],
      wall: ["#b08968", "#8b5e34", "#d4a373", "#7f5539"],
      roof: ["#9f1239", "#7f1d1d", "#dc2626", "#581c1c"],
      door: ["#78350f", "#92400e", "#451a03", "#b45309"],
      glass: ["#93c5fd", "#60a5fa", "#bfdbfe", "#38bdf8"],
      metal: ["#64748b", "#475569", "#94a3b8", "#334155"],
      smoke: ["#374151", "#111827", "#6b7280", "#1f2937"],
      soil: ["#854d0e", "#713f12", "#a16207", "#422006"],
      water: ["#0284c7", "#0369a1", "#38bdf8", "#075985"],
      crop: ["#65a30d", "#4d7c0f", "#84cc16", "#365314"],
      fence: ["#a16207", "#854d0e", "#ca8a04", "#713f12"],
      stair: ["#d59a3a", "#9a5b16", "#f3b65d", "#6b3510"],
      slab: ["#c58a2b", "#8f5518", "#e7ad55", "#6f3a12"],
      platform: ["#9f6b2f", "#704214", "#c18a45", "#4a2a0d"]
    };
    const texture = this.createPixelTexture(palettes[cacheKey] || palettes.block);
    const isTranslucent = cacheKey === "support" || cacheKey === "glass" || cacheKey === "water";
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      transparent: isTranslucent,
      opacity: cacheKey === "support" ? 0.42 : cacheKey === "glass" || cacheKey === "water" ? 0.72 : 1,
      depthWrite: !isTranslucent
    });
    this.threeState.materials.set(cacheKey, material);
    return material;
  }

  createPixelTexture(colors) {
    const THREE = window.THREE;
    const canvas = document.createElement("canvas");
    const size = 16;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const colorIndex = (x * 7 + y * 5 + ((x ^ y) % 3)) % colors.length;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  }

  positionThreeCamera() {
    if (!this.threeState) {
      return;
    }
    const { camera, cameraDistance, targetY } = this.threeState;
    camera.position.set(cameraDistance, Math.max(5, cameraDistance * 0.58), cameraDistance);
    camera.lookAt(0, targetY, 0);
  }

  resizeThreeView() {
    if (!this.threeState || this.stairsDetails.classList.contains("hidden")) {
      return;
    }
    const { camera, renderer } = this.threeState;
    const rect = this.threeContainer.getBoundingClientRect();
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(260, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, true);
  }

  animateThreeView() {
    if (!this.threeState) {
      return;
    }
    const { renderer, scene, camera, group } = this.threeState;
    if (!this.threeState.isDragging && !this.stairsDetails.classList.contains("hidden")) {
      group.rotation.y += 0.003;
    }
    renderer.render(scene, camera);
    this.threeState.animationFrame = window.requestAnimationFrame(() => this.animateThreeView());
  }

  clearThreeView() {
    if (this.threeStatus) {
      this.threeStatus.textContent = "";
    }
    if (!this.threeState) {
      return;
    }
    this.threeState.structureLoadToken = null;
    this.threeState.group.clear();
    if (this.threeState.grid) {
      this.threeState.scene.remove(this.threeState.grid);
      this.threeState.grid = null;
    }
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
    this.clearThreeView();
    if (this.asciiOutput) {
      this.asciiOutput.textContent = "";
    }
    this.sphereLayers = null;
    this.sphereStats = null;
  }

  clearPreview() {
    this.grid.replaceChildren();
    this.sideGrid.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.canvasPanel.classList.remove("stairs-layout", "sphere-layout", "structure-layout");
    this.clearThreeView();
    if (this.asciiOutput) {
      this.asciiOutput.textContent = "";
    }
    this.stats.innerHTML = "<div>Aucune structure affichée.</div>";
    this.currentCells = null;
    this.sphereLayers = null;
    this.sphereStats = null;
    this.currentSphereLayerIndex = 0;
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
        ctx.fillStyle = this.isBlockCell(cell) ? '#22c55e' : '#0b1020';
        if (this.getCellKind(cell) === 'stair') {
          ctx.fillStyle = '#d59a3a';
        }
        if (this.getCellKind(cell) === 'slab') {
          ctx.fillStyle = '#c58a2b';
        }
        if (this.getCellKind(cell) === 'platform') {
          ctx.fillStyle = '#9f6b2f';
        }
        if (this.getCellKind(cell) === 'core') {
          ctx.fillStyle = '#64748b';
        }
        if (this.getCellKind(cell) === 'support') {
          ctx.fillStyle = '#38bdf8';
        }
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        const label = this.getCellLabel(cell);
        if (label) {
          ctx.fillStyle = this.getCellKind(cell) === 'core' ? '#f8fafc' : '#052e16';
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

  buildConstructionSteps(blocks) {
    // Grouper les blocs par hauteur Y pour créer des étapes
    const heightMap = new Map();
    
    for (const block of blocks) {
      const roundedY = Math.round(block.y * 2) / 2;
      if (!heightMap.has(roundedY)) {
        heightMap.set(roundedY, []);
      }
      heightMap.get(roundedY).push(block);
    }
    
    // Trier par hauteur et créer des étapes cumulatives
    const sortedHeights = Array.from(heightMap.keys()).sort((a, b) => a - b);
    const steps = [];
    const cumulativeBlocks = [];
    
    for (const height of sortedHeights) {
      cumulativeBlocks.push(...heightMap.get(height));
      steps.push([...cumulativeBlocks]);
    }
    
    this.buildSteps = steps;
    this.currentBuildStep = 0;
    return steps;
  }

  updateConstructionUI() {
    // Mettre à jour la visibilité et l'état des boutons
    const hasSteps = this.buildSteps.length > 0;
    this.constructionControlsContainer.classList.toggle("hidden", !hasSteps);
    
    if (!hasSteps) {
      return;
    }
    
    const isFirstStep = this.currentBuildStep === 0;
    const isLastStep = this.currentBuildStep === this.buildSteps.length - 1;
    
    this.prevStepButton.disabled = isFirstStep;
    this.nextStepButton.disabled = isLastStep;
    
    this.stepCounter.textContent = "Étape " + (this.currentBuildStep + 1) + " / " + this.buildSteps.length;
  }

  goToPreviousStep() {
    if (this.currentBuildStep > 0) {
      this.currentBuildStep--;
      this.renderCurrentBuildStep(true);
    }
  }

  goToNextStep() {
    if (this.currentBuildStep < this.buildSteps.length - 1) {
      this.currentBuildStep++;
      this.renderCurrentBuildStep(false);
    }
  }

  renderCurrentBuildStep(goingBackward = false) {
    if (this.buildSteps.length === 0) {
      return;
    }
    
    const currentStepBlocks = this.buildSteps[this.currentBuildStep];
    this.updateConstructionUI();
    this.renderThreeBlocksWithAnimation(currentStepBlocks, goingBackward);
  }

  renderThreeBlocksWithAnimation(blocks, goingBackward = false) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    this.threeState.structureLoadToken = null;
    
    const filteredBlocks = this.showSupports3d ? blocks : blocks.filter(b => b.kind !== 'support');
    const centeredBlocks = this.centerBlocksForThreeView(filteredBlocks);

    const maxY = centeredBlocks.reduce((max, block) => Math.max(max, block.y + block.height / 2), 1);
    const minY = centeredBlocks.reduce((min, block) => Math.min(min, block.y - block.height / 2), 0);
    const heightSpan = Math.max(1, maxY - minY);
    const maxRadius = centeredBlocks.reduce((max, block) => {
      const radius = Math.hypot(block.x, block.z) + Math.max(block.width, block.depth);
      return Math.max(max, radius);
    }, 3);

    group.clear();
    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
    }

    const showEdges = centeredBlocks.length <= 900;
    const blockMeshes = [];

    if (centeredBlocks.length > 1200) {
      this.addInstancedMinecraftBoxes(group, centeredBlocks);
    } else {
      for (const block of centeredBlocks) {
        const mesh = this.createBlockMesh(group, block, showEdges);
        if (mesh) {
          blockMeshes.push(mesh);
        }
      }
    }

    const gridSize = Math.max(8, maxRadius * 2.6);
    const grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
    grid.position.y = minY - 0.02;
    grid.material.color.set(0x334155);
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);
    this.threeState.grid = grid;

    this.threeState.targetY = (minY + maxY) * 0.5;
    this.threeState.minCameraDistance = Math.max(5, maxRadius * 0.9);
    this.threeState.maxCameraDistance = Math.max(22, maxRadius * 5, heightSpan * 2.6);
    this.threeState.cameraDistance = Math.max(10, maxRadius * 2.35, heightSpan * 1.25);
    this.positionThreeCamera();

    if (blockMeshes.length > 0) {
      this.animateBlocksAppearance(blockMeshes, goingBackward);
    }

    renderer.render(scene, camera);
    this.threeStatus.textContent = "Glissez pour tourner. Utilisez la molette pour zoomer.";
  }

  createBlockMesh(group, block, showEdges) {
    const THREE = window.THREE;
    
    if (block.kind === "stair") {
      this.addMinecraftStairBlock(group, block, showEdges);
      return null;
    }

    const geometry = new THREE.BoxGeometry(block.width, block.height, block.depth);
    const material = this.getThreeMaterial(block.kind);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(block.x, block.y, block.z);
    mesh.rotation.y = block.rotationY || 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.scale.set(0, 0, 0);
    group.add(mesh);

    if (showEdges) {
      const edgeColor = this.getBlockEdgeColor(block.kind);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.30 })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      edges.scale.set(0, 0, 0);
      group.add(edges);
      mesh.userData.edgesMesh = edges;
    }

    return mesh;
  }

  animateBlocksAppearance(blockMeshes, goingBackward = false) {
    const GSAP = window.gsap;
    
    if (!GSAP) {
      for (const mesh of blockMeshes) {
        mesh.scale.set(1, 1, 1);
        if (mesh.userData.edgesMesh) {
          mesh.userData.edgesMesh.scale.set(1, 1, 1);
        }
      }
      return;
    }

    for (const mesh of blockMeshes) {
      mesh.scale.set(0, 0, 0);
      if (mesh.userData.edgesMesh) {
        mesh.userData.edgesMesh.scale.set(0, 0, 0);
      }
    }

    const duration = 0.4;
    const delayIncrement = 0.05;

    blockMeshes.forEach((mesh, index) => {
      const delay = goingBackward ? (blockMeshes.length - index - 1) * delayIncrement : index * delayIncrement;
      
      GSAP.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration,
        delay,
        ease: "back.out"
      });

      if (mesh.userData.edgesMesh) {
        GSAP.to(mesh.userData.edgesMesh.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration,
          delay,
          ease: "back.out"
        }, "<");
      }
    });
  }

  updateConstructionUI() {
    // Mettre à jour la visibilité et l'état des boutons
    const hasSteps = this.buildSteps.length > 0;
    this.constructionControlsContainer.classList.toggle("hidden", !hasSteps);
    
    if (!hasSteps) {
      return;
    }
    
    const isFirstStep = this.currentBuildStep === 0;
    const isLastStep = this.currentBuildStep === this.buildSteps.length - 1;
    
    this.prevStepButton.disabled = isFirstStep;
    this.nextStepButton.disabled = isLastStep;
    
    this.stepCounter.textContent = "Étape " + (this.currentBuildStep + 1) + " / " + this.buildSteps.length;
  }

  goToPreviousStep() {
    if (this.currentBuildStep > 0) {
      this.currentBuildStep--;
      this.renderCurrentBuildStep(true);
    }
  }

  goToNextStep() {
    if (this.currentBuildStep < this.buildSteps.length - 1) {
      this.currentBuildStep++;
      this.renderCurrentBuildStep(false);
    }
  }

  renderCurrentBuildStep(goingBackward = false) {
    if (this.buildSteps.length === 0) {
      return;
    }
    
    const currentStepBlocks = this.buildSteps[this.currentBuildStep];
    this.updateConstructionUI();
    
    // Afficher uniquement les blocs de l'étape actuelle dans la vue 3D avec animation
    this.renderThreeBlocksWithAnimation(currentStepBlocks, goingBackward);
  }

  renderThreeBlocksWithAnimation(blocks, goingBackward = false) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    this.threeState.structureLoadToken = null;
    
    // Filtrer les blocs de support si nécessaire
    const filteredBlocks = this.showSupports3d ? blocks : blocks.filter(b => b.kind !== 'support');
    const centeredBlocks = this.centerBlocksForThreeView(filteredBlocks);

    // Calculer les paramètres de caméra
    const maxY = centeredBlocks.reduce((max, block) => Math.max(max, block.y + block.height / 2), 1);
    const minY = centeredBlocks.reduce((min, block) => Math.min(min, block.y - block.height / 2), 0);
    const heightSpan = Math.max(1, maxY - minY);
    const maxRadius = centeredBlocks.reduce((max, block) => {
      const radius = Math.hypot(block.x, block.z) + Math.max(block.width, block.depth);
      return Math.max(max, radius);
    }, 3);

    // Nettoyer le groupe et la grille
    group.clear();
    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
    }

    // Ajouter les blocs avec animation
    const showEdges = centeredBlocks.length <= 900;
    const blockMeshes = [];

    // Créer les blocs et les ajouter au groupe
    if (centeredBlocks.length > 1200) {
      this.addInstancedMinecraftBoxes(group, centeredBlocks);
    } else {
      for (const block of centeredBlocks) {
        const mesh = this.createBlockMesh(group, block, showEdges);
        if (mesh) {
          blockMeshes.push(mesh);
        }
      }
    }

    // Ajouter la grille
    const gridSize = Math.max(8, maxRadius * 2.6);
    const grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
    grid.position.y = minY - 0.02;
    grid.material.color.set(0x334155);
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);
    this.threeState.grid = grid;

    // Mettre à jour la caméra
    this.threeState.targetY = (minY + maxY) * 0.5;
    this.threeState.minCameraDistance = Math.max(5, maxRadius * 0.9);
    this.threeState.maxCameraDistance = Math.max(22, maxRadius * 5, heightSpan * 2.6);
    this.threeState.cameraDistance = Math.max(10, maxRadius * 2.35, heightSpan * 1.25);
    this.positionThreeCamera();

    // Animer l'apparition des blocs avec GSAP
    this.animateBlocksAppearance(blockMeshes, goingBackward);

    renderer.render(scene, camera);
    this.threeStatus.textContent = "Glissez pour tourner. Utilisez la molette pour zoomer.";
  }

  createBlockMesh(group, block, showEdges) {
    const THREE = window.THREE;
    
    if (block.kind === "stair") {
      this.addMinecraftStairBlock(group, block, showEdges);
      return null;
    }

    const geometry = new THREE.BoxGeometry(block.width, block.height, block.depth);
    const material = this.getThreeMaterial(block.kind);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(block.x, block.y, block.z);
    mesh.rotation.y = block.rotationY || 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.scale.set(0, 0, 0); // Démarrer petit pour l'animation
    group.add(mesh);

    if (showEdges) {
      const edgeColor = this.getBlockEdgeColor(block.kind);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.30 })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      edges.scale.set(0, 0, 0); // Démarrer petit pour l'animation
      group.add(edges);
      mesh.userData.edgesMesh = edges;
    }

    return mesh;
  }

  animateBlocksAppearance(blockMeshes, goingBackward = false) {
    const GSAP = window.gsap;
    
    if (!GSAP) {
      // Si GSAP n'est pas disponible, afficher directement les blocs
      for (const mesh of blockMeshes) {
        mesh.scale.set(1, 1, 1);
        if (mesh.userData.edgesMesh) {
          mesh.userData.edgesMesh.scale.set(1, 1, 1);
        }
      }
      return;
    }

    // Réinitialiser l'échelle
    for (const mesh of blockMeshes) {
      mesh.scale.set(0, 0, 0);
      if (mesh.userData.edgesMesh) {
        mesh.userData.edgesMesh.scale.set(0, 0, 0);
      }
    }

    const duration = 0.4;
    const delayIncrement = 0.05;

    blockMeshes.forEach((mesh, index) => {
      const delay = goingBackward ? (blockMeshes.length - index - 1) * delayIncrement : index * delayIncrement;
      
      GSAP.to(mesh.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration,
        delay,
        ease: "back.out"
      });

      if (mesh.userData.edgesMesh) {
        GSAP.to(mesh.userData.edgesMesh.scale, {
          x: 1,
          y: 1,
          z: 1,
          duration,
          delay,
          ease: "back.out"
        }, "<");
      }
    });
  }
}



new MinecraftBuilderStudio();
