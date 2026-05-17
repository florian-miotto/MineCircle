const FUTURE_SERVICES = [
  {
    title: "Dômes / Sphères",
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

const TOOL_HINTS = Object.freeze({
  circle: "Astuce : le diamètre contrôle le contour extérieur de la forme.",
  sphere: "Astuce : utilisez le curseur pour parcourir les couches horizontales de la sphère.",
  porch: "Astuce : la largeur du porche est ajustée automatiquement à une valeur impaire pour garder une symétrie propre.",
  stairs: "Astuce : les escaliers utilisent deux dalles par bloc de hauteur."
});

class MinecraftBuilderStudio {
  constructor() {
    this.form = document.getElementById("builder-form");
    this.toolSelect = document.getElementById("tool-select");
    this.circleInput = document.getElementById("diameter-input");
    this.porchWidthInput = document.getElementById("porch-width-input");
    this.porchHeightInput = document.getElementById("porch-height-input");
    this.porchStyleInput = document.getElementById("porch-style-input");
    this.stairsHeightInput = document.getElementById("stairs-height-input");
    this.stairsWidthInput = document.getElementById("stairs-width-input");
    this.stairsTypeInput = document.getElementById("stairs-type-input");
    this.toolHint = document.getElementById("tool-hint");
    this.toolPanels = Array.from(document.querySelectorAll("[data-tool-target]"));
    this.grid = document.getElementById("circle-grid");
    this.stairsDetails = document.getElementById("stairs-details");
    this.threeContainer = document.getElementById("stairs-3d-view");
    this.threeStatus = document.getElementById("stairs-3d-status");
    this.sideGrid = document.getElementById("side-grid");
    this.buildSteps = document.getElementById("build-steps");
    this.stats = document.getElementById("stats");
    this.asciiOutput = document.getElementById("ascii-output");
    this.clearButton = document.getElementById("clear-button");
    this.exportButton = document.getElementById("export-button");
    this.exportStatus = document.getElementById("export-status");
    this.sphereLayerSlider = document.getElementById("sphere-layer-input");
    this.sphereLayerLabel = document.getElementById("sphere-layer-label");
    this.futureServicesContainer = document.getElementById("future-services");
    this.currentCells = null;
    this.sphereLayers = null;
    this.currentSphereLayerIndex = 0;
    this.threeState = null;
    this.bindEvents();
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

  generatePorchGrid(width, height, style) {
    const marginX = 2;
    const marginY = 2;
    const roofRise = Math.max(2, Math.min(height - 3, Math.round(height * 0.32)));
    const bodyHeight = height - roofRise;
    const openingWidth = Math.max(3, width - 4);
    const openingRoofRise = Math.max(1, Math.min(roofRise - 1, Math.round(roofRise * 0.8)));
    const openingBodyHeight = Math.max(2, bodyHeight - 1);
    const openingStyle = style === "medieval" ? "pointed" : style;
    const outerProfile = this.buildProfile(width, bodyHeight, roofRise, style);
    const innerProfile = this.buildProfile(openingWidth, openingBodyHeight, openingRoofRise, openingStyle);
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
      for (let y = 0; y < innerProfile[x]; y += 1) {
        const row = groundRow - y;
        const col = openingLeft + x + marginX;
        if (row >= 0 && row < rows) {
          cells[row][col] = false;
        }
      }
    }

    if (style === "medieval") {
      this.addMedievalDetails(cells, groundRow, marginX, width, bodyHeight);
    }

    const blockCount = cells.reduce((total, row) => total + row.filter(Boolean).length, 0);
    return { cells, cols, rows, blockCount };
  }

  createStepCell(level) {
    return {
      block: true,
      kind: "slab",
      label: String(level),
      title: `Dalle ${level}`
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

  createBlock3d(x, y, z, kind = "slab", width = 1, height = 0.5, depth = 1, rotationY = 0) {
    return { x, y, z, kind, width, height, depth, rotationY };
  }

  getStairStepCount(height) {
    return height * 2;
  }

  getSlabCenterY(step) {
    return (step - 1) * 0.5 + 0.25;
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

    for (let step = 1; step <= stepCount; step += 1) {
      const row = rows - margin - step;
      for (let x = 0; x < width; x += 1) {
        cells[row][x + margin] = this.createStepCell(step);
        blocks3d.push(this.createBlock3d(x - xOffset, this.getSlabCenterY(step), step - 1));
      }
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose ${width} dalle${width > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, puis avance d'un bloc.`
      });
    }

    return {
      cells,
      cols,
      rows,
      blockCount: stepCount * width,
      footprint: `${width} × ${stepCount}`,
      sideCells: this.generateStairsSideView(height, stepCount, type),
      blocks3d,
      buildPlan
    };
  }

  generateSpiralStairsGrid(height, width) {
    const walkwayWidth = Math.max(1, width);
    const stepCount = this.getStairStepCount(height);
    const footprint = Math.max(walkwayWidth * 2 + 3, 5);
    const center = Math.floor(footprint / 2);
    const margin = 2;
    const cols = footprint + margin * 2;
    const rows = footprint + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const buildPlan = [];
    const blocks3d = this.createCoreBlocks(height + 1);
    const innerRadius = 1.25;
    const turnPerStep = Math.PI / 4;
    cells[center + margin][center + margin] = this.createCoreCell("P");

    for (let step = 1; step <= stepCount; step += 1) {
      const angle = -Math.PI / 2 + (step - 1) * turnPerStep;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      for (let band = 0; band < walkwayWidth; band += 1) {
        const radius = innerRadius + band;
        const x3d = cos * radius;
        const z3d = sin * radius;
        const projectionX = center + Math.round(cos * (band + 1));
        const projectionY = center + Math.round(sin * (band + 1));

        if (projectionX >= 0 && projectionX < footprint && projectionY >= 0 && projectionY < footprint) {
          cells[projectionY + margin][projectionX + margin] = this.createStepCell(step);
        }

        blocks3d.push(this.createBlock3d(x3d, this.getSlabCenterY(step), z3d));
      }

      const sideLabel = this.getSpiralPositionLabel(
        Math.round(cos),
        Math.round(sin)
      );
      const quarterTurn = Math.round(((step - 1) * 45) % 360);
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose une bande de ${walkwayWidth} dalle${walkwayWidth > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, ${sideLabel} du pilier, rotation ${quarterTurn}°.`
      });
    }

    const blockCount = stepCount * walkwayWidth + height + 1;

    return {
      cells,
      cols,
      rows,
      blockCount,
      footprint: `${footprint} × ${footprint}`,
      sideCells: this.generateStairsSideView(height, stepCount, "spiral"),
      blocks3d,
      buildPlan
    };
  }

  generateCurvedStairsGrid(height, width) {
    const stepCount = this.getStairStepCount(height);
    const footprint = Math.max(width * 2 + stepCount, 7);
    const margin = 2;
    const cols = footprint + margin * 2;
    const rows = footprint + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const center = footprint - width - 1;
    const radius = Math.max(width + 1, Math.round(footprint * 0.55));
    const angleStart = Math.PI;
    const angleEnd = Math.PI * 1.5;
    const buildPlan = [];
    const blocks3d = [];

    for (let step = 1; step <= stepCount; step += 1) {
      const ratio = stepCount === 1 ? 0 : (step - 1) / (stepCount - 1);
      const angle = angleStart + (angleEnd - angleStart) * ratio;

      for (let band = 0; band < width; band += 1) {
        const currentRadius = radius - band;
        const x = Math.round(center + Math.cos(angle) * currentRadius);
        const y = Math.round(center + Math.sin(angle) * currentRadius);
        if (x >= 0 && x < footprint && y >= 0 && y < footprint) {
          cells[y + margin][x + margin] = this.createStepCell(step);
          blocks3d.push(this.createBlock3d(x - center, this.getSlabCenterY(step), y - center));
        }
      }

      const turn = Math.round(ratio * 90);
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose une bande de ${width} dalle${width > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, environ ${turn}° après le départ de la courbe.`
      });
    }

    const blockCount = cells.reduce(
      (total, row) => total + row.filter((cell) => this.isBlockCell(cell)).length,
      0
    );

    return {
      cells,
      cols,
      rows,
      blockCount,
      footprint: `${footprint} × ${footprint}`,
      sideCells: this.generateStairsSideView(height, stepCount, "curved"),
      blocks3d,
      buildPlan
    };
  }

  formatHalfBlockHeight(step) {
    const height = step / 2;
    if (Number.isInteger(height)) {
      return `${height} bloc${height > 1 ? "s" : ""} de hauteur`;
    }
    return `${Math.floor(height)} bloc${height > 1 ? "s" : ""} + 1 dalle de hauteur`;
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

  generateStairsSideView(height, length, type) {
    const margin = 2;
    const cols = length + margin * 2;
    const rows = this.getStairStepCount(height) + margin * 2;
    const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
    const baseline = rows - margin - 1;

    for (let step = 1; step <= length; step += 1) {
      const col = margin + Math.min(length - 1, step - 1);
      const row = baseline - (step - 1);
      cells[row][col] = this.createStepCell(step);
    }

    if (type === "spiral") {
      for (let row = margin; row <= baseline; row += 2) {
        cells[row][margin] = this.createCoreCell("P");
        if (row + 1 <= baseline) {
          cells[row + 1][margin] = this.createCoreCell("");
        }
      }
    }

    return cells;
  }

  addMedievalDetails(cells, groundRow, marginX, width, bodyHeight) {
    const buttressHeight = Math.max(3, Math.round(bodyHeight * 0.65));
    const left = marginX;
    const right = marginX + width - 1;

    for (let y = 0; y < buttressHeight; y += 1) {
      const row = groundRow - y;
      if (row < 0 || row >= cells.length) {
        break;
      }
      cells[row][left] = true;
      cells[row][right] = true;
      if (left + 1 < right) {
        cells[row][left + 1] = true;
        cells[row][right - 1] = true;
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
    const style = this.porchStyleInput.value;
    const hasStyle = Object.prototype.hasOwnProperty.call(PORCH_STYLE_LABELS, style);

    if (!width || !height || !hasStyle) {
      this.showMessage("Paramètres de porche invalides. Vérifie largeur, hauteur et style.");
      return null;
    }

    this.porchWidthInput.value = String(width);
    this.porchHeightInput.value = String(height);
    const porch = this.generatePorchGrid(width, height, style);

    return {
      cells: porch.cells,
      cols: porch.cols,
      rows: porch.rows,
      stats: [
        ["Outil", "Porche / Entrée monumentale"],
        ["Style du haut", PORCH_STYLE_LABELS[style]],
        ["Largeur × hauteur", `${width} × ${height}`],
        ["Blocs estimés", `~${porch.blockCount}`],
        ["Grille affichée", `${porch.cols} × ${porch.rows}`]
      ]
    };
  }

  buildStairsResult() {
    const height = this.normalizeInteger(this.stairsHeightInput.value, 1, 128);
    const width = this.normalizeInteger(this.stairsWidthInput.value, 1, 16);
    const type = this.stairsTypeInput.value;
    const hasType = Object.prototype.hasOwnProperty.call(STAIR_TYPE_LABELS, type);

    if (!height || !width || !hasType) {
      this.showMessage("Paramètres d'escalier invalides. Vérifie hauteur, largeur et type.");
      return null;
    }

    this.stairsHeightInput.value = String(height);
    const stairs = type === "spiral"
      ? this.generateSpiralStairsGrid(height, width)
      : type === "curved"
        ? this.generateCurvedStairsGrid(height, width)
        : this.generateStraightStairsGrid(height, width, type);

    this.stairsWidthInput.value = String(width);

    return {
      cells: stairs.cells,
      cols: stairs.cols,
      rows: stairs.rows,
      sideCells: stairs.sideCells,
      buildPlan: stairs.buildPlan,
      blocks3d: stairs.blocks3d,
      stats: [
        ["Outil", "Escalier"],
        ["Type", STAIR_TYPE_LABELS[type]],
        ["Hauteur totale", `${height} blocs`],
        ["Largeur", `${this.stairsWidthInput.value} blocs`],
        ["Dalles à monter", `${this.getStairStepCount(height)}`],
        ["Emprise au sol", stairs.footprint],
        ["Blocs estimés", `~${stairs.blockCount}`],
        ["Grille affichée", `${stairs.cols} × ${stairs.rows}`]
      ]
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

    return {
      cells: sphere.layers[this.currentSphereLayerIndex],
      cols: sphere.cols,
      rows: sphere.rows,
      stats: [
        ["Outil", "Sphère"],
        ["Diamètre", `${diameter} blocs`],
        ["Couches", `${sphere.layers.length}`],
        ["Couche actuelle", `${this.currentSphereLayerIndex + 1}`],
        ["Blocs estimés", `~${sphere.blockCount}`],
        ["Grille affichée", `${sphere.cols} × ${sphere.rows}`]
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
    } else if (selectedTool === "stairs") {
      result = this.buildStairsResult();
    } else {
      result = this.buildCircleResult();
    }

    if (!result) {
      return;
    }

    this.currentCells = result.cells;
    this.renderGrid(result.cells, result.cols);
    this.renderStairsDetails(result);
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

  renderStairsDetails(result) {
    const isStairs = this.toolSelect.value === "stairs" && result.sideCells;
    this.stairsDetails.classList.toggle("hidden", !isStairs);
    if (!isStairs) {
      this.sideGrid.replaceChildren();
      this.buildSteps.replaceChildren();
      this.clearThreeView();
      return;
    }

    this.renderThreeStairs(result.blocks3d || []);
    this.renderCells(this.sideGrid, result.sideCells, result.sideCells[0].length);
    this.renderBuildSteps(result.buildPlan || []);
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
  }

  updateSphereLayerLabel() {
    const layerNumber = this.currentSphereLayerIndex + 1;
    const total = this.sphereLayers ? this.sphereLayers.length : 1;
    this.sphereLayerLabel.textContent = `Couche ${layerNumber} / ${total}`;
  }

  renderAscii(cells) {
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

  renderBuildSteps(plan) {
    const fragment = document.createDocumentFragment();
    for (const item of plan) {
      const step = document.createElement("li");
      step.innerHTML = `<strong>${item.label}</strong><span>${item.detail}</span>`;
      fragment.appendChild(step);
    }
    this.buildSteps.replaceChildren(fragment);
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

  renderThreeStairs(blocks) {
    if (!this.initThreeView()) {
      return;
    }

    const THREE = window.THREE;
    const { scene, camera, renderer, group } = this.threeState;
    group.clear();

    const maxY = blocks.reduce((max, block) => Math.max(max, block.y + block.height / 2), 1);
    const maxRadius = blocks.reduce((max, block) => {
      const radius = Math.hypot(block.x, block.z) + Math.max(block.width, block.depth);
      return Math.max(max, radius);
    }, 3);
    const showEdges = blocks.length <= 900;

    for (const block of blocks) {
      this.addMinecraftBox(group, block, showEdges);
    }

    if (this.threeState.grid) {
      scene.remove(this.threeState.grid);
    }
    const gridSize = Math.max(8, maxRadius * 2.6);
    const grid = new THREE.GridHelper(gridSize, Math.ceil(gridSize));
    grid.position.y = -0.02;
    grid.material.color.set(0x334155);
    grid.material.opacity = 0.28;
    grid.material.transparent = true;
    scene.add(grid);
    this.threeState.grid = grid;

    this.threeState.targetY = maxY * 0.45;
    this.threeState.minCameraDistance = Math.max(5, maxRadius * 0.9);
    this.threeState.maxCameraDistance = Math.max(22, maxRadius * 5, maxY * 2.6);
    this.threeState.cameraDistance = Math.max(10, maxRadius * 2.35, maxY * 1.25);
    this.positionThreeCamera();
    renderer.render(scene, camera);
    this.threeStatus.textContent = "Glissez pour tourner. Utilisez la molette pour zoomer.";
  }

  addMinecraftBox(group, block, showEdges) {
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

    const edgeColor = block.kind === "core" ? 0x1f2937 : 0x3f2a12;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.44 })
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
  }

  getThreeMaterial(kind) {
    const THREE = window.THREE;
    const cacheKey = kind || "slab";
    if (this.threeState.materials.has(cacheKey)) {
      return this.threeState.materials.get(cacheKey);
    }

    const palettes = {
      core: ["#6b7280", "#4b5563", "#9ca3af", "#374151"],
      support: ["#6b7280", "#4b5563", "#9ca3af", "#374151"],
      slab: ["#b7791f", "#92400e", "#d97706", "#78350f"]
    };
    const texture = this.createPixelTexture(palettes[cacheKey] || palettes.slab);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0
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
    this.buildSteps.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.clearThreeView();
    this.asciiOutput.textContent = "";
  }

  clearPreview() {
    this.grid.replaceChildren();
    this.sideGrid.replaceChildren();
    this.buildSteps.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.clearThreeView();
    this.asciiOutput.textContent = "";
    this.stats.innerHTML = "<div>Aucune structure affichée.</div>";
    this.currentCells = null;
    this.sphereLayers = null;
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
        if (this.getCellKind(cell) === 'slab') {
          ctx.fillStyle = '#d97706';
        }
        if (this.getCellKind(cell) === 'core') {
          ctx.fillStyle = '#64748b';
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
}

new MinecraftBuilderStudio();
