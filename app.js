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

const CURVED_DIRECTION_LABELS = Object.freeze({
  right: "Droite",
  left: "Gauche"
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
    this.currentCells = null;
    this.sphereLayers = null;
    this.sphereStats = null;
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

    this.stairsTypeInput.addEventListener("change", () => {
      this.syncStairTurnControl();
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
    this.syncStairTurnControl();
  }

  syncStairTurnControl() {
    const type = this.stairsTypeInput.value;
    const usesDirection = type === "spiral" || type === "curved";
    this.stairsTurnControl.classList.toggle("hidden", !usesDirection);
    this.stairsTurnInput.disabled = !usesDirection;
    this.stairsTurnLabel.textContent = type === "curved" ? "Sens de l'arrondi" : "Sens du colimaçon";
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

  createSupportCell() {
    return {
      block: true,
      kind: "support",
      label: "",
      title: "Remplissage de sécurité"
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

  getSlabBottomY(step) {
    return (step - 1) * 0.5;
  }

  getSupportUnitCount(height) {
    return Math.ceil(height * 2);
  }

  createSupportColumnBlocks(x, z, height) {
    if (height <= 0) {
      return [];
    }
    const blocks = [];
    const halfUnits = this.getSupportUnitCount(height);

    for (let unit = 0; unit < halfUnits; unit += 1) {
      blocks.push(this.createBlock3d(x, unit * 0.5 + 0.25, z, "support", 0.88, 0.5, 0.88));
    }

    return blocks;
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
      const supportHeight = this.getSlabBottomY(step);
      for (let x = 0; x < width; x += 1) {
        cells[row][x + margin] = this.createStepCell(step);
        const x3d = x - xOffset;
        const supportBlocks = this.createSupportColumnBlocks(x3d, step - 1, supportHeight);
        blocks3d.push(...supportBlocks);
        supportUnitCount += supportBlocks.length;
        blocks3d.push(this.createBlock3d(x3d, this.getSlabCenterY(step), step - 1));
      }
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose ${width} dalle${width > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, avec le remplissage dessous jusqu'au sol.`
      });
    }

    return {
      cells,
      cols,
      rows,
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
    cells[center + margin][center + margin] = this.createCoreCell("P");

    for (let step = 1; step <= stepCount; step += 1) {
      const angle = -Math.PI / 2 + (step - 1) * turnPerStep * turnSign;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const sectorStart = angle - turnPerStep * 0.55;
      const sectorEnd = angle + turnPerStep * 0.55;
      const supportHeight = this.getSlabBottomY(step);
      const stepPositions = this.getSpiralStepPositions(
        gridRadius,
        innerRadius,
        walkwayWidth,
        sectorStart,
        sectorEnd,
        angle
      );

      for (const position of stepPositions) {
        const projectionX = center + position.x;
        const projectionY = center + position.z;
        cells[projectionY + margin][projectionX + margin] = this.createStepCell(step);

        if (position.support) {
          const supportBlocks = this.createSupportColumnBlocks(position.x, position.z, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
        }
        blocks3d.push(this.createBlock3d(position.x, this.getSlabCenterY(step), position.z));
        placements.push({ step, x: position.x, z: position.z, support: position.support });
      }

      const sideLabel = this.getSpiralPositionLabel(
        Math.round(cos),
        Math.round(sin)
      );
      const quarterTurn = Math.round(((step - 1) * 45) % 360);
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose une plateforme de ${stepPositions.length} dalle${stepPositions.length > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, ${sideLabel} du pilier, puis mets les supports seulement en bordure.`
      });
    }

    const blockCount = placements.length + height + 1 + supportUnitCount;

    return {
      cells,
      cols,
      rows,
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
    let supportUnitCount = 0;

    for (let step = 1; step <= stepCount; step += 1) {
      const ratio = stepCount === 1 ? 0 : (step - 1) / (stepCount - 1);
      const angle = angleStart + (angleEnd - angleStart) * ratio;
      const supportHeight = this.getSlabBottomY(step);

      for (let band = 0; band < width; band += 1) {
        const currentRadius = radius - band;
        const x = Math.round(pivotX + Math.cos(angle) * currentRadius * mirror);
        const y = Math.round(pivotY + Math.sin(angle) * currentRadius);
        if (x >= 0 && x < footprint && y >= 0 && y < footprint) {
          cells[y + margin][x + margin] = this.createStepCell(step);
          const x3d = x - pivotX;
          const z3d = y - pivotY;
          const supportBlocks = this.createSupportColumnBlocks(x3d, z3d, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
          blocks3d.push(this.createBlock3d(x3d, this.getSlabCenterY(step), z3d));
        }
      }

      const turn = Math.round(ratio * 90);
      buildPlan.push({
        level: step,
        label: `Dalle ${step}`,
        detail: `Pose une bande de ${width} dalle${width > 1 ? "s" : ""} à ${this.formatHalfBlockHeight(step)}, en arrondissant vers la ${CURVED_DIRECTION_LABELS[direction].toLowerCase()}.`
      });
    }

    const blockCount = cells.reduce(
      (total, row) => total + row.filter((cell) => this.isBlockCell(cell)).length,
      0
    ) + supportUnitCount;

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

  generateStairsSideView(height, length, type, width = 1, placements = []) {
    if (type === "spiral") {
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
      cells[row][col] = this.createStepCell(placement.step);
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
      ["Dalles à monter", `${this.getStairStepCount(height)}`],
      ["Emprise au sol", stairs.footprint],
      ["Blocs estimés", `~${stairs.blockCount}`],
      ["Grille affichée", `${stairs.cols} × ${stairs.rows}`]
    ];

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
    const showDetails = isStairs || isSphere;

    this.stairsDetails.classList.toggle("hidden", !showDetails);
    this.stairsDetails.classList.toggle("sphere-details", isSphere);
    this.canvasPanel.classList.toggle("stairs-layout", isStairs);
    this.canvasPanel.classList.toggle("sphere-layout", isSphere);
    this.sideDetailBlock.classList.toggle("hidden", !isStairs);
    this.threeViewTitle.textContent = isSphere ? "Vue 3D de la sphère" : "Vue 3D";

    if (!showDetails) {
      this.sideGrid.replaceChildren();
      this.clearThreeView();
      return;
    }

    this.renderThreeBlocks(result.blocks3d || [], {
      gridAtBottom: isStairs,
      status: isSphere
        ? "Glissez pour tourner la sphère. Utilisez la molette pour zoomer."
        : "Glissez pour tourner. Utilisez la molette pour zoomer."
    });

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
    group.clear();
    const centeredBlocks = this.centerBlocksForThreeView(blocks);

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

    const edgeColor = block.kind === "core"
      ? 0x1f2937
      : block.kind === "support"
        ? 0x083344
        : block.kind === "sphere"
          ? 0x14532d
          : 0x3f2a12;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.44 })
    );
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
  }

  addInstancedMinecraftBoxes(group, blocks) {
    const THREE = window.THREE;
    const groupedBlocks = new Map();

    for (const block of blocks) {
      const key = [
        block.kind || "slab",
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
  }

  getThreeMaterial(kind) {
    const THREE = window.THREE;
    const cacheKey = kind || "slab";
    if (this.threeState.materials.has(cacheKey)) {
      return this.threeState.materials.get(cacheKey);
    }

    const palettes = {
      core: ["#6b7280", "#4b5563", "#9ca3af", "#374151"],
      support: ["#38bdf8", "#0e7490", "#67e8f9", "#155e75"],
      sphere: ["#4ade80", "#16a34a", "#86efac", "#15803d"],
      slab: ["#b7791f", "#92400e", "#d97706", "#78350f"]
    };
    const texture = this.createPixelTexture(palettes[cacheKey] || palettes.slab);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      transparent: cacheKey === "support",
      opacity: cacheKey === "support" ? 0.3 : 1,
      depthWrite: cacheKey !== "support"
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
    this.stairsDetails.classList.add("hidden");
    this.canvasPanel.classList.remove("stairs-layout", "sphere-layout");
    this.clearThreeView();
    this.asciiOutput.textContent = "";
    this.sphereLayers = null;
    this.sphereStats = null;
  }

  clearPreview() {
    this.grid.replaceChildren();
    this.sideGrid.replaceChildren();
    this.stairsDetails.classList.add("hidden");
    this.canvasPanel.classList.remove("stairs-layout", "sphere-layout");
    this.clearThreeView();
    this.asciiOutput.textContent = "";
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
        if (this.getCellKind(cell) === 'slab') {
          ctx.fillStyle = '#d97706';
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
}

new MinecraftBuilderStudio();
