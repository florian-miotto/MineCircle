const CURVED_DIRECTION_LABELS = Object.freeze({
  right: "Droite",
  left: "Gauche"
});

// Helpers d'analyse des cellules
export function isBlockCell(cell) {
  return typeof cell === "object" && cell !== null ? Boolean(cell.block) : Boolean(cell);
}

export function getCellLabel(cell) {
  return typeof cell === "object" && cell !== null ? cell.label : "";
}

export function getCellKind(cell) {
  if (typeof cell !== "object" || cell === null) {
    return "step";
  }
  return cell.kind || "step";
}

export function getCellTitle(cell) {
  if (typeof cell !== "object" || cell === null) {
    return "";
  }
  return cell.title || cell.label || "";
}

// Helpers de création de cellules (locaux)
function createStepCell(level) {
  return {
    block: true,
    kind: "stair",
    label: String(level),
    title: `Bloc escalier ${level}`
  };
}

function createSlabCell(level) {
  return {
    block: true,
    kind: "slab",
    label: "",
    title: `Dalle de palier ${level}`
  };
}

function createPlatformCell(level) {
  return {
    block: true,
    kind: "platform",
    label: "",
    title: `Bloc de transition ${level}`
  };
}

function createCoreCell(label = "") {
  return {
    block: true,
    kind: "core",
    label,
    title: "Pilier / support"
  };
}

function createSupportCell() {
  return {
    block: true,
    kind: "support",
    label: "",
    title: "Remplissage de sécurité"
  };
}

// Helpers de création de blocs 3D
function createBlock3d(x, y, z, kind = "block", width = 1, height = 1, depth = 1, rotationY = 0) {
  return { x, y, z, kind, width, height, depth, rotationY };
}

function createStairBlock3d(x, step, z, rotationY = 0) {
  const block = createBlock3d(
    x,
    getStairCenterY(step),
    z,
    "stair",
    1,
    1,
    1,
    quantizeRotation90(rotationY)
  );
  block.step = step;
  return block;
}

function createSlabBlock3d(x, step, z) {
  const block = createBlock3d(x, getStairBaseY(step) + 0.25, z, "slab", 1, 0.5, 1);
  block.step = step;
  return block;
}

function createPlatformBlock3d(x, step, z) {
  const block = createBlock3d(x, getStairBaseY(step) + 0.5, z, "platform", 1, 1, 1);
  block.step = step;
  return block;
}

function getStairStepCount(height) {
  return height;
}

function getStairCenterY(step) {
  return getStairBaseY(step) + 0.5;
}

function getStairBaseY(step) {
  return step - 1;
}

function createSupportColumnBlocks(x, z, height) {
  return createSupportSegmentBlocks(x, z, 0, height);
}

function createSupportSegmentBlocks(x, z, fromHeight, toHeight) {
  const height = toHeight - fromHeight;
  if (height <= 0) {
    return [];
  }
  const blocks = [];
  const fullBlocks = Math.floor(height);
  let cursor = fromHeight;

  for (let level = 0; level < fullBlocks; level += 1) {
    blocks.push(createBlock3d(x, cursor + 0.5, z, "support", 0.9, 1, 0.9));
    cursor += 1;
  }

  const remainingHeight = height - fullBlocks;
  if (remainingHeight > 0.01) {
    blocks.push(createBlock3d(
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

function createStairBaseBlocks(x, z, baseHeight) {
  return createSupportColumnBlocks(x, z, baseHeight);
}

function getBlockBottomY(block) {
  return block.y - block.height / 2;
}

function getBlockTopY(block) {
  return block.y + block.height / 2;
}

function getColumnKey(x, z) {
  return `${Math.round(x * 1000) / 1000},${Math.round(z * 1000) / 1000}`;
}

function quantizeRotation90(rotationY) {
  const quarterTurn = Math.PI / 2;
  return Math.round(rotationY / quarterTurn) * quarterTurn;
}

function getStairRotationFromVector(directionX, directionZ) {
  return quantizeRotation90(Math.atan2(directionX, directionZ));
}

function createCoreBlocks(height, x = 0, z = 0) {
  const blocks = [];
  for (let level = 0; level < height; level += 1) {
    blocks.push(createBlock3d(x, level + 0.5, z, "core", 1, 1, 1));
  }
  return blocks;
}

function addGroundSupportsForFloatingBlocks(blocks) {
  const epsilon = 0.001;
  const requiredColumns = new Map();

  for (const block of blocks) {
    if (block.kind !== "stair" && block.kind !== "slab" && block.kind !== "platform") {
      continue;
    }

    const bottom = getBlockBottomY(block);
    if (bottom <= epsilon) {
      continue;
    }

    const key = getColumnKey(block.x, block.z);
    const required = requiredColumns.get(key);
    if (!required || bottom > required.height) {
      requiredColumns.set(key, { x: block.x, z: block.z, height: bottom });
    }
  }

  const supportBlocks = [];
  for (const column of requiredColumns.values()) {
    const intervals = blocks
      .filter((block) => getColumnKey(block.x, block.z) === getColumnKey(column.x, column.z))
      .map((block) => ({
        start: Math.max(0, getBlockBottomY(block)),
        end: Math.min(column.height, getBlockTopY(block))
      }))
      .filter((interval) => interval.end > 0 && interval.start < column.height)
      .sort((a, b) => a.start - b.start || b.end - a.end);

    let cursor = 0;
    for (const interval of intervals) {
      if (interval.start > cursor + epsilon) {
        supportBlocks.push(...createSupportSegmentBlocks(column.x, column.z, cursor, interval.start));
      }
      cursor = Math.max(cursor, interval.end);
      if (cursor >= column.height - epsilon) {
        break;
      }
    }

    if (cursor < column.height - epsilon) {
      supportBlocks.push(...createSupportSegmentBlocks(column.x, column.z, cursor, column.height));
    }
  }

  blocks.push(...supportBlocks);
  return supportBlocks.length;
}

function formatStairLevel(step) {
  return `de la marche ${step}`;
}

function formatStairBlockCount(count) {
  return `${count} bloc${count > 1 ? "s" : ""} d'escalier`;
}

function formatSlabBlockCount(count) {
  return `${count} dalle${count > 1 ? "s" : ""}`;
}

function formatPlatformBlockCount(count) {
  return `${count} bloc${count > 1 ? "s" : ""} plein${count > 1 ? "s" : ""}`;
}

function getSpiralPositionLabel(dx, dy) {
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

function getSpiralStepPositions(gridRadius, innerRadius, walkwayWidth, sectorStart, sectorEnd, centerAngle) {
  const positions = new Map();
  const outerRadius = innerRadius + walkwayWidth + 0.35;

  for (let z = -gridRadius; z <= gridRadius; z += 1) {
    for (let x = -gridRadius; x <= gridRadius; x += 1) {
      const radius = Math.hypot(x, z);
      if (radius < innerRadius || radius > outerRadius) {
        continue;
      }
      const angle = Math.atan2(z, x);
      if (isAngleBetween(angle, sectorStart, sectorEnd)) {
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
    const angleA = normalizeAngle(Math.atan2(a.z, a.x) - centerAngle);
    const angleB = normalizeAngle(Math.atan2(b.z, b.x) - centerAngle);
    return Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z) || angleA - angleB;
  });
}

function selectSpiralStairBand(positions, targetAngle, walkwayWidth, nextPositions = [], fallbackRotation = 0) {
  const selected = new Map();
  if (positions.length === 0) {
    return selected;
  }

  const nextKeys = new Set(nextPositions.map((position) => getPositionKey(position.x, position.z)));
  for (const position of positions) {
    const directions = getAdjacentDirections(position.x, position.z, nextKeys, targetAngle);
    if (directions.length === 1) {
      const direction = directions[0];
      selected.set(
        getPositionKey(position.x, position.z),
        {
          kind: "stair",
          rotationY: getStairRotationFromVector(direction.x, direction.z)
        }
      );
    } else if (directions.length > 1) {
      selected.set(getPositionKey(position.x, position.z), { kind: "platform" });
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
      const key = getPositionKey(position.x, position.z);
      if (selected.has(key)) {
        continue;
      }

      const radius = Math.hypot(position.x, position.z);
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(position.z, position.x) - targetAngle));
      const score = Math.abs(radius - targetRadius) * 1.35 + angleOffset * 4;
      if (score < bestScore) {
        bestScore = score;
        bestPosition = position;
      }
    }

    if (bestPosition) {
      selected.set(getPositionKey(bestPosition.x, bestPosition.z), {
        kind: "stair",
        rotationY: fallbackRotation
      });
    }
  }

  if (selected.size === 0) {
    const closest = positions.reduce((best, position) => {
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(position.z, position.x) - targetAngle));
      return !best || angleOffset < best.angleOffset ? { position, angleOffset } : best;
    }, null);
    if (closest) {
      selected.set(getPositionKey(closest.position.x, closest.position.z), {
        kind: "stair",
        rotationY: fallbackRotation
      });
    }
  }

  return selected;
}

function selectCurvedStairBand(positions, targetAngle, pivotX, pivotY, mirror, width, nextPositions = []) {
  const selected = new Map();
  if (positions.length === 0) {
    return selected;
  }

  const nextKeys = new Set(nextPositions.map((position) => getPositionKey(position.x, position.y)));
  for (const position of positions) {
    const directions = getAdjacentDirections(position.x, position.y, nextKeys, targetAngle);
    if (directions.length === 1) {
      const direction = directions[0];
      selected.set(
        getPositionKey(position.x, position.y),
        {
          kind: "stair",
          rotationY: getStairRotationFromVector(direction.x, direction.z)
        }
      );
    } else if (directions.length > 1) {
      selected.set(getPositionKey(position.x, position.y), { kind: "platform" });
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
  const fallbackRotation = getStairRotationFromVector(
    -Math.sin(targetAngle) * mirror,
    Math.cos(targetAngle)
  );

  for (let band = 0; band < width; band += 1) {
    const ratio = width === 1 ? 0.5 : band / (width - 1);
    const targetRadius = maxRadius - (maxRadius - minRadius) * ratio;
    let bestPosition = null;
    let bestScore = Infinity;

    for (const position of positions) {
      const key = getPositionKey(position.x, position.y);
      if (selected.has(key)) {
        continue;
      }

      const normalizedX = (position.x - pivotX) * mirror;
      const normalizedY = position.y - pivotY;
      const currentRadius = Math.hypot(normalizedX, normalizedY);
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(normalizedY, normalizedX) - targetAngle));
      const score = Math.abs(currentRadius - targetRadius) * 1.35 + angleOffset * 4;
      if (score < bestScore) {
        bestScore = score;
        bestPosition = position;
      }
    }

    if (bestPosition) {
      selected.set(getPositionKey(bestPosition.x, bestPosition.y), {
        kind: "stair",
        rotationY: fallbackRotation
      });
    }
  }

  if (selected.size === 0) {
    const closest = positions.reduce((best, position) => {
      const normalizedX = (position.x - pivotX) * mirror;
      const normalizedY = position.y - pivotY;
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(normalizedY, normalizedX) - targetAngle));
      return !best || angleOffset < best.angleOffset ? { position, angleOffset } : best;
    }, null);
    if (closest) {
      selected.set(getPositionKey(closest.position.x, closest.position.y), {
        kind: "stair",
        rotationY: fallbackRotation
      });
    }
  }

  return selected;
}

function getAdjacentDirections(x, z, positionKeys, targetAngle) {
  const directions = [
    { x: 0, z: 1 },
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 }
  ];

  return directions
    .filter((direction) => positionKeys.has(getPositionKey(x + direction.x, z + direction.z)))
    .map((direction) => {
      const angle = Math.atan2(direction.z, direction.x);
      return {
        ...direction,
        score: Math.abs(normalizeAngle(angle - targetAngle))
      };
    })
    .sort((a, b) => a.score - b.score);
}

function getPositionKey(x, z) {
  return `${x},${z}`;
}

function normalizeAngle(angle) {
  let normalized = angle;
  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }
  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }
  return normalized;
}

function isAngleBetween(angle, start, end) {
  const normalizedAngle = normalizeAngle(angle - start);
  const normalizedEnd = normalizeAngle(end - start);
  return normalizedAngle >= 0 && normalizedAngle <= normalizedEnd;
}

function getArchContribution(style, ratioFromCenter, rise, index) {
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

function buildProfile(span, baseHeight, rise, style) {
  const center = (span - 1) / 2;
  const halfSpan = Math.max(1, (span - 1) / 2);
  const heights = [];

  for (let x = 0; x < span; x += 1) {
    const distance = Math.abs(x - center);
    const ratio = Math.min(1, distance / halfSpan);
    const topContribution = getArchContribution(style, ratio, rise, x);
    heights.push(Math.max(1, baseHeight + topContribution));
  }

  return heights;
}

function addMedievalDetails(cells, groundRow, marginX, width, bodyHeight, thickness) {
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

export function generateStairsSideView(height, length, type, width = 1, placements = []) {
  if ((type === "spiral" || type === "curved") && placements.length > 0) {
    return generateSpiralSideView(height, length, width, placements);
  }

  const margin = 2;
  const cols = length + margin * 2;
  const rows = getStairStepCount(height) + margin * 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
  const baseline = rows - margin - 1;

  for (let step = 1; step <= length; step += 1) {
    const col = margin + Math.min(length - 1, step - 1);
    const row = baseline - (step - 1);
    for (let supportRow = row + 1; supportRow <= baseline; supportRow += 1) {
      cells[supportRow][col] = createSupportCell();
    }
    cells[row][col] = createStepCell(step);
  }

  return cells;
}

export function generateSpiralSideView(height, stepCount, width, placements) {
  const margin = 2;
  const maxOffset = Math.max(
    width + 2,
    ...placements.map((placement) => Math.abs(placement.x))
  );
  const sideSpan = maxOffset * 2 + 3;
  const cols = sideSpan + margin * 2;
  const rows = getStairStepCount(height) + margin * 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
  const baseline = rows - margin - 1;
  const centerCol = margin + maxOffset + 1;

  for (let row = margin; row <= baseline; row += 1) {
    cells[row][centerCol] = createCoreCell(row === margin ? "P" : "");
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
          cells[supportRow][col] = createSupportCell();
        }
      }
    }
    const placementCell = placement.kind === "stair"
      ? createStepCell(placement.step)
      : placement.kind === "platform"
        ? createPlatformCell(placement.step)
        : createSlabCell(placement.step);
    if (!cells[row][col] || placement.kind === "stair" || placement.kind === "platform") {
      cells[row][col] = placementCell;
    }
  }

  return cells;
}

// -------------------------------------------------------------
// GÉNÉRATEURS PUBLICS
// -------------------------------------------------------------

export function generateCircleGrid(diameter) {
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

export function generateSphereLayers(diameter, sphereSolid) {
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
        const isBlock = sphereSolid
          ? distanceToCenter <= layerRadius
          : distanceToCenter <= layerRadius && distanceToCenter > layerRadius - 1;
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

export function generateSphereBlocks3d(layers) {
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
          blocks.push(createBlock3d(
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

export function generatePorchGrid(width, height, style, thickness) {
  const marginX = 2;
  const marginY = 2;
  const roofRise = Math.max(2, Math.min(height - 3, Math.round(height * 0.32)));
  const bodyHeight = height - roofRise;
  const openingWidth = Math.max(1, width - thickness * 2);
  const outerProfile = buildProfile(width, bodyHeight, roofRise, style);
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
    addMedievalDetails(cells, groundRow, marginX, width, bodyHeight, thickness);
  }

  const blockCount = cells.reduce((total, row) => total + row.filter(Boolean).length, 0);
  return { cells, cols, rows, blockCount };
}

export function generateStraightStairsGrid(height, width) {
  const margin = 2;
  const stepCount = getStairStepCount(height);
  const cols = width + margin * 2;
  const rows = stepCount + margin * 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
  const buildPlan = [];
  const blocks3d = [];
  const xOffset = (width - 1) / 2;
  let supportUnitCount = 0;

  for (let step = 1; step <= stepCount; step += 1) {
    const row = rows - margin - step;
    const supportHeight = getStairBaseY(step);
    for (let x = 0; x < width; x += 1) {
      cells[row][x + margin] = createStepCell(step);
      const x3d = x - xOffset;
      const supportBlocks = createSupportColumnBlocks(x3d, step - 1, supportHeight);
      blocks3d.push(...supportBlocks);
      supportUnitCount += supportBlocks.length;
      blocks3d.push(createStairBlock3d(x3d, step, step - 1));
    }
    buildPlan.push({
      level: step,
      label: `Marche ${step}`,
      detail: `Pose ${formatStairBlockCount(width)} ${formatStairLevel(step)}, orientés vers l'avant, avec des blocs pleins de support dessous si nécessaire.`
    });
  }

  supportUnitCount += addGroundSupportsForFloatingBlocks(blocks3d);

  return {
    cells,
    cols,
    rows,
    stairBlockCount: stepCount * width,
    slabBlockCount: 0,
    blockCount: stepCount * width + supportUnitCount,
    footprint: `${width} × ${stepCount}`,
    sideCells: generateStairsSideView(height, stepCount, "straight"),
    blocks3d,
    buildPlan
  };
}

export function generateSpiralStairsGrid(height, width, direction = "right") {
  const walkwayWidth = Math.max(1, width);
  const stepCount = getStairStepCount(height);
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
  const blocks3d = createCoreBlocks(height + 1);
  const placements = [];
  let supportUnitCount = 0;
  let stairBlockCount = 0;
  let slabBlockCount = 0;
  let platformBlockCount = 0;
  cells[center + margin][center + margin] = createCoreCell("P");

  for (let step = 1; step <= stepCount; step += 1) {
    const angle = -Math.PI / 2 + (step - 1) * turnPerStep * turnSign;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const exitAngle = angle + turnPerStep * 0.5 * turnSign;
    const fallbackStairRotation = getStairRotationFromVector(
      -Math.sin(exitAngle) * turnSign,
      Math.cos(exitAngle) * turnSign
    );
    const sectorStart = angle - sectorHalfTurn;
    const sectorEnd = angle + sectorHalfTurn;
    const supportHeight = getStairBaseY(step);
    const stepPositions = getSpiralStepPositions(
      gridRadius,
      innerRadius,
      walkwayWidth,
      sectorStart,
      sectorEnd,
      angle
    );
    const nextAngle = -Math.PI / 2 + step * turnPerStep * turnSign;
    const nextStepPositions = step < stepCount
      ? getSpiralStepPositions(
        gridRadius,
        innerRadius,
        walkwayWidth,
        nextAngle - sectorHalfTurn,
        nextAngle + sectorHalfTurn,
        nextAngle
      )
      : [];
    const stairRotations = selectSpiralStairBand(
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
      const key = getPositionKey(position.x, position.z);
      const transition = stairRotations.get(key);
      const isStair = transition && transition.kind === "stair";
      const isPlatform = transition && transition.kind === "platform";
      const cellRow = projectionY + margin;
      const cellCol = projectionX + margin;
      if (isStair || isPlatform || getCellKind(cells[cellRow][cellCol]) !== "stair") {
        cells[cellRow][cellCol] = isStair
          ? createStepCell(step)
          : isPlatform
            ? createPlatformCell(step)
            : createSlabCell(step);
      }

      if (isStair || isPlatform) {
        const supportBlocks = position.support
          ? createSupportColumnBlocks(position.x, position.z, supportHeight)
          : createStairBaseBlocks(position.x, position.z, supportHeight);
        blocks3d.push(...supportBlocks);
        supportUnitCount += supportBlocks.length;
        if (isStair) {
          blocks3d.push(createStairBlock3d(
            position.x,
            step,
            position.z,
            transition.rotationY
          ));
          stairBlockCount += 1;
          stepStairCount += 1;
        } else {
          blocks3d.push(createPlatformBlock3d(position.x, step, position.z));
          platformBlockCount += 1;
          stepPlatformCount += 1;
        }
      } else {
        if (position.support) {
          const supportBlocks = createSupportColumnBlocks(position.x, position.z, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
        }
        blocks3d.push(createSlabBlock3d(position.x, step, position.z));
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

    const sideLabel = getSpiralPositionLabel(
      Math.round(cos),
      Math.round(sin)
    );
    buildPlan.push({
      level: step,
      label: `Marche ${step}`,
      detail: `Pose ${formatStairBlockCount(stepStairCount)} contre la bordure du niveau suivant, ${formatPlatformBlockCount(stepPlatformCount)} de transition, puis ${formatSlabBlockCount(stepSlabCount)} de palier ${formatStairLevel(step)}, ${sideLabel} du pilier.`
    });
  }

  supportUnitCount += addGroundSupportsForFloatingBlocks(blocks3d);
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
    sideCells: generateStairsSideView(height, stepCount, "spiral", walkwayWidth, placements),
    blocks3d,
    buildPlan
  };
}

export function generateCurvedStairsGrid(height, width, direction) {
  const stepCount = getStairStepCount(height);
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
    const supportHeight = getStairBaseY(step);
    const stairRotation = getStairRotationFromVector(
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
    const stairKeys = selectCurvedStairBand(
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
      const key = getPositionKey(position.x, position.y);
      const transition = stairKeys.get(key);
      const isStair = transition && transition.kind === "stair";
      const isPlatform = transition && transition.kind === "platform";

      const cellRow = position.y + margin;
      const cellCol = position.x + margin;
      if (isStair || isPlatform || getCellKind(cells[cellRow][cellCol]) !== "stair") {
        cells[cellRow][cellCol] = isStair
          ? createStepCell(step)
          : isPlatform
            ? createPlatformCell(step)
            : createSlabCell(step);
      }

      if (isStair || isPlatform) {
        const supportBlocks = support
          ? createSupportColumnBlocks(x3d, z3d, supportHeight)
          : createStairBaseBlocks(x3d, z3d, supportHeight);
        blocks3d.push(...supportBlocks);
        supportUnitCount += supportBlocks.length;
        if (isStair) {
          blocks3d.push(createStairBlock3d(x3d, step, z3d, transition.rotationY || stairRotation));
          stairBlockCount += 1;
          stepStairCount += 1;
        } else {
          blocks3d.push(createPlatformBlock3d(x3d, step, z3d));
          platformBlockCount += 1;
          stepPlatformCount += 1;
        }
      } else {
        if (support) {
          const supportBlocks = createSupportColumnBlocks(x3d, z3d, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
        }
        blocks3d.push(createSlabBlock3d(x3d, step, z3d));
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
      detail: `Pose ${formatStairBlockCount(stepStairCount)} contre la bordure du niveau suivant, ${formatPlatformBlockCount(stepPlatformCount)} de transition, puis ${formatSlabBlockCount(stepSlabCount)} de palier ${formatStairLevel(step)}, en arrondissant vers la ${CURVED_DIRECTION_LABELS[direction].toLowerCase()}.`
    });
  }

  supportUnitCount += addGroundSupportsForFloatingBlocks(blocks3d);
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
    sideCells: generateStairsSideView(height, stepCount, "curved", width, placements),
    blocks3d,
    buildPlan
  };
}
