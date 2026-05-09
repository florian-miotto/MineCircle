const FUTURE_SERVICES = [
  {
    title: "Dômes / Sphères",
    description: "Étendre les générateurs en 3D pour les projets monumentaux."
  },
  {
    title: "Escaliers monumentaux",
    description: "Générer des marches harmonisées avec la largeur d'une entrée."
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

class MinecraftBuilderStudio {
  constructor() {
    this.form = document.getElementById("builder-form");
    this.toolSelect = document.getElementById("tool-select");
    this.circleInput = document.getElementById("diameter-input");
    this.porchWidthInput = document.getElementById("porch-width-input");
    this.porchHeightInput = document.getElementById("porch-height-input");
    this.porchStyleInput = document.getElementById("porch-style-input");
    this.toolPanels = Array.from(document.querySelectorAll("[data-tool-target]"));
    this.grid = document.getElementById("circle-grid");
    this.stats = document.getElementById("stats");
    this.asciiOutput = document.getElementById("ascii-output");
    this.clearButton = document.getElementById("clear-button");
    this.exportButton = document.getElementById("export-button");
    this.exportStatus = document.getElementById("export-status");
    this.futureServicesContainer = document.getElementById("future-services");
    this.currentCells = null;
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
      const isCurrentPanel = panel.dataset.toolTarget === selectedTool || (selectedTool === "sphere" && panel.dataset.toolTarget === "circle");
      panel.classList.toggle("hidden", !isCurrentPanel);
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

  buildSphereResult() {
    const diameter = this.normalizeInteger(this.circleInput.value, 1, 256);
    if (!diameter) {
      this.showMessage("Diamètre invalide. Saisis un entier entre 1 et 256.");
      return null;
    }

    this.circleInput.value = String(diameter);
    const sphere = this.generateSphereLayers(diameter);
    const midIndex = Math.floor(sphere.layers.length / 2);
    const layer = sphere.layers[midIndex];

    return {
      cells: layer,
      cols: sphere.cols,
      rows: sphere.rows,
      stats: [
        ["Outil", "Sphère"],
        ["Diamètre", `${diameter} blocs`],
        ["Couches", `${sphere.layers.length}`],
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
    } else {
      result = this.buildCircleResult();
    }

    if (!result) {
      return;
    }

    this.currentCells = result.cells;
    this.renderGrid(result.cells, result.cols);
    this.renderAscii(result.cells);
    this.updateStats(result.stats);
  }

  renderGrid(cells, cols) {
    this.grid.replaceChildren();
    this.grid.style.setProperty("--cols", String(cols));

    const fragment = document.createDocumentFragment();
    for (const row of cells) {
      for (const isBlock of row) {
        const cell = document.createElement("div");
        cell.className = isBlock ? "cell block" : "cell empty";
        fragment.appendChild(cell);
      }
    }

    this.grid.appendChild(fragment);
  }

  renderAscii(cells) {
    const lines = cells.map((row) => row.map((isBlock) => (isBlock ? "■" : "·")).join(" "));
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
    this.asciiOutput.textContent = "";
  }

  clearPreview() {
    this.grid.replaceChildren();
    this.asciiOutput.textContent = "";
    this.stats.innerHTML = "<div>Aucune structure affichée.</div>";
    this.currentCells = null;
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
      row.forEach((isBlock, x) => {
        ctx.fillStyle = isBlock ? '#22c55e' : '#0b1020';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
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
