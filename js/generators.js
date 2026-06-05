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

function createDomeCell(level) {
  return {
    block: true,
    kind: "dome",
    label: "",
    title: `Dôme couche ${level}`
  };
}

function createScriptCell() {
  return {
    block: true,
    kind: "script",
    label: "",
    title: "Bloc de texte"
  };
}

// Helpers de création de blocs 3D
function createBlock3d(x, y, z, kind = "block", width = 1, height = 1, depth = 1, rotationY = 0) {
  return { x, y, z, kind, width, height, depth, rotationY };
}

function createLayerBlocks3d(layers, kind, getY) {
  if (!layers || layers.length === 0) {
    return [];
  }

  const blocks = [];
  const rows = layers[0].length;
  const cols = layers[0][0].length;
  const centerX = (cols - 1) / 2;
  const centerZ = (rows - 1) / 2;

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
    const layer = layers[layerIndex];
    for (let z = 0; z < rows; z += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (isBlockCell(layer[z][x])) {
          blocks.push(createBlock3d(
            x - centerX,
            getY(layerIndex),
            z - centerZ,
            kind,
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

function createSupportColumnAroundExistingBlocks(blocks, x, z, height) {
  const epsilon = 0.001;
  if (height <= epsilon) {
    return [];
  }

  const columnKey = getColumnKey(x, z);
  const intervals = blocks
    .filter((block) => getColumnKey(block.x, block.z) === columnKey)
    .map((block) => ({
      start: Math.max(0, getBlockBottomY(block)),
      end: Math.min(height, getBlockTopY(block))
    }))
    .filter((interval) => interval.end > 0 && interval.start < height)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const supportBlocks = [];
  let cursor = 0;
  for (const interval of intervals) {
    if (interval.start > cursor + epsilon) {
      supportBlocks.push(...createSupportSegmentBlocks(x, z, cursor, interval.start));
    }
    cursor = Math.max(cursor, interval.end);
    if (cursor >= height - epsilon) {
      break;
    }
  }

  if (cursor < height - epsilon) {
    supportBlocks.push(...createSupportSegmentBlocks(x, z, cursor, height));
  }

  return supportBlocks;
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

function getVectorAngle(directionX, directionZ) {
  return Math.atan2(directionZ, directionX);
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
    const z2 = z * z;
    for (let x = -gridRadius; x <= gridRadius; x += 1) {
      const radius = Math.sqrt(x * x + z2);
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
  const radii = result.map((position) => Math.sqrt(position.x * position.x + position.z * position.z));
  const minRadius = Math.min(...radii);
  const maxRadius = Math.max(...radii);

  for (const position of result) {
    const radius = Math.sqrt(position.x * position.x + position.z * position.z);
    position.support = radius <= minRadius + 0.45 || radius >= maxRadius - 0.45;
  }

  return result.sort((a, b) => {
    const angleA = normalizeAngle(Math.atan2(a.z, a.x) - centerAngle);
    const angleB = normalizeAngle(Math.atan2(b.z, b.x) - centerAngle);
    return Math.sqrt(a.x * a.x + a.z * a.z) - Math.sqrt(b.x * b.x + b.z * b.z) || angleA - angleB;
  });
}

function selectSpiralStairBand(positions, sectorAngle, travelAngle, walkwayWidth, nextPositions = [], fallbackRotation = 0) {
  const selected = new Map();
  if (positions.length === 0) {
    return selected;
  }

  const nextKeys = new Set(nextPositions.map((position) => getPositionKey(position.x, position.z)));
  for (const position of positions) {
    const directions = getAdjacentDirections(position.x, position.z, nextKeys, travelAngle);
    const validDirections = directions.filter((direction) => direction.score <= Math.PI * 0.58);
    if (validDirections.length === 1) {
      const direction = validDirections[0];
      selected.set(
        getPositionKey(position.x, position.z),
        {
          kind: "stair",
          rotationY: getStairRotationFromVector(direction.x, direction.z)
        }
      );
    } else if (validDirections.length > 1) {
      selected.set(getPositionKey(position.x, position.z), { kind: "platform" });
    }
  }

  const radii = positions.map((position) => Math.sqrt(position.x * position.x + position.z * position.z));
  const minRadius = Math.min(...radii);
  const maxRadius = Math.max(...radii);
  for (let band = 0; band < walkwayWidth; band += 1) {
    const ratio = walkwayWidth === 1 ? 0.5 : band / (walkwayWidth - 1);
    const targetRadius = minRadius + (maxRadius - minRadius) * ratio;
    const hasStairForBand = positions.some((position) => {
      const key = getPositionKey(position.x, position.z);
      const selectedTransition = selected.get(key);
      return selectedTransition?.kind === "stair" && Math.abs(Math.sqrt(position.x * position.x + position.z * position.z) - targetRadius) <= 0.75;
    });
    if (hasStairForBand) {
      continue;
    }

    let bestPosition = null;
    let bestScore = Infinity;

    for (const position of positions) {
      const key = getPositionKey(position.x, position.z);
      if (selected.has(key)) {
        continue;
      }

      const radius = Math.sqrt(position.x * position.x + position.z * position.z);
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(position.z, position.x) - sectorAngle));
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
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(position.z, position.x) - sectorAngle));
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

function selectCurvedStairBand(positions, sectorAngle, travelAngle, pivotX, pivotY, mirror, width, nextPositions = []) {
  const selected = new Map();
  if (positions.length === 0 || nextPositions.length === 0) {
    return selected;
  }

  const nextKeys = new Set(nextPositions.map((position) => getPositionKey(position.x, position.y)));
  for (const position of positions) {
    const directions = getAdjacentDirections(position.x, position.y, nextKeys, travelAngle);
    const validDirections = directions.filter((direction) => direction.score <= Math.PI * 0.58);
    if (validDirections.length === 1) {
      const direction = validDirections[0];
      selected.set(getPositionKey(position.x, position.y), {
        kind: "stair",
        rotationY: getStairRotationFromVector(direction.x, direction.z)
      });
    } else if (validDirections.length > 1) {
      selected.set(getPositionKey(position.x, position.y), { kind: "platform" });
    }
  }

  const radii = positions.map((position) => {
    const nx = (position.x - pivotX) * mirror;
    const ny = position.y - pivotY;
    return Math.sqrt(nx * nx + ny * ny);
  });
  const minRadius = Math.min(...radii);
  const maxRadius = Math.max(...radii);
  const fallbackRotation = getStairRotationFromVector(
    Math.cos(travelAngle),
    Math.sin(travelAngle)
  );

  for (let band = 0; band < width; band += 1) {
    const ratio = width === 1 ? 0.5 : band / (width - 1);
    const targetRadius = maxRadius - (maxRadius - minRadius) * ratio;
    const hasStairForBand = positions.some((position) => {
      const key = getPositionKey(position.x, position.y);
      const selectedTransition = selected.get(key);
      const normalizedX = (position.x - pivotX) * mirror;
      const normalizedY = position.y - pivotY;
      const currentRadius = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      return selectedTransition?.kind === "stair" && Math.abs(currentRadius - targetRadius) <= 0.75;
    });
    if (hasStairForBand) {
      continue;
    }

    let bestPosition = null;
    let bestDirection = null;
    let bestScore = Infinity;

    for (const position of positions) {
      const key = getPositionKey(position.x, position.y);
      if (selected.has(key)) {
        continue;
      }
      const directions = getAdjacentDirections(position.x, position.y, nextKeys, travelAngle);
      const validDirections = directions.filter((direction) => direction.score <= Math.PI * 0.58);
      if (validDirections.length === 0) {
        continue;
      }

      const normalizedX = (position.x - pivotX) * mirror;
      const normalizedY = position.y - pivotY;
      const currentRadius = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
      const angleOffset = Math.abs(normalizeAngle(Math.atan2(normalizedY, normalizedX) - sectorAngle));
      const score = Math.abs(currentRadius - targetRadius) * 1.35 + angleOffset * 4;

      if (score < bestScore) {
        bestScore = score;
        bestPosition = position;
        bestDirection = validDirections[0];
      }
    }

    if (bestPosition) {
      const key = getPositionKey(bestPosition.x, bestPosition.y);
      selected.set(key, {
        kind: "stair",
        rotationY: bestDirection
          ? getStairRotationFromVector(bestDirection.x, bestDirection.z)
          : fallbackRotation
      });
    }
  }

  return selected;
}

function pruneCurvedUnsafeSurfaces(blocks3d, placements, cells, margin, pivotX, pivotY) {
  const surfaceKinds = new Set(["stair", "slab", "platform"]);
  const surfaceBlocks = blocks3d.filter((block) => surfaceKinds.has(block.kind));
  const activeMap = new Map(surfaceBlocks.map((block) => [getSurfaceKey(block), block]));
  const protectedLandingKeys = getProtectedStairLandingKeys(activeMap);
  const removedKeys = new Set();
  let changed = true;

  while (changed) {
    changed = false;

    for (const [key, block] of activeMap.entries()) {
      if (block.kind === "slab" && hasUnsafeLowerNeighbor(block, activeMap, protectedLandingKeys)) {
        activeMap.delete(key);
        removedKeys.add(key);
        changed = true;
      }
    }

  }

  const keptSurfaceKeys = new Set(activeMap.keys());
  const neededColumns = new Set(
    [...keptSurfaceKeys].map((key) => key.substring(0, key.lastIndexOf(",")))
  );
  const filteredBlocks = blocks3d.filter((block) => {
    if (surfaceKinds.has(block.kind)) {
      return keptSurfaceKeys.has(getSurfaceKey(block));
    }
    if (block.kind === "support") {
      return neededColumns.has(getColumnKey(block.x, block.z));
    }
    return true;
  });

  placements.splice(0, placements.length, ...placements.filter((placement) => {
    const key = getSurfaceKey({
      x: placement.x,
      z: placement.z,
      step: placement.step
    });
    return keptSurfaceKeys.has(key);
  }));

  for (const row of cells) {
    for (let col = 0; col < row.length; col += 1) {
      if (surfaceKinds.has(getCellKind(row[col]))) {
        row[col] = false;
      }
    }
  }

  for (const placement of placements) {
    const row = Math.round(placement.z + pivotY + margin);
    const col = Math.round(placement.x + pivotX + margin);
    if (row < 0 || row >= cells.length || col < 0 || col >= cells[row].length) {
      continue;
    }
    cells[row][col] = placement.kind === "stair"
      ? createStepCell(placement.step)
      : placement.kind === "platform"
        ? createPlatformCell(placement.step)
        : createSlabCell(placement.step);
  }

  return {
    blocks3d: filteredBlocks,
    supportUnitCount: filteredBlocks.filter((block) => block.kind === "support").length,
    stairBlockCount: filteredBlocks.filter((block) => block.kind === "stair").length,
    slabBlockCount: filteredBlocks.filter((block) => block.kind === "slab").length,
    platformBlockCount: filteredBlocks.filter((block) => block.kind === "platform").length
  };
}

function getProtectedStairLandingKeys(surfaceMap) {
  const protectedKeys = new Set();
  for (const block of surfaceMap.values()) {
    if (block.kind !== "stair") {
      continue;
    }
    const forward = getStairForwardGridVector(block.rotationY || 0);
    protectedKeys.add(`${Math.round(block.x) - forward.x},${Math.round(block.z) - forward.z},${block.step}`);
    protectedKeys.add(`${Math.round(block.x) + forward.x},${Math.round(block.z) + forward.z},${block.step + 1}`);
  }
  return protectedKeys;
}

function hasUnsafeLowerNeighbor(block, surfaceMap, protectedLandingKeys) {
  if (protectedLandingKeys.has(getSurfaceKey(block))) {
    return false;
  }

  if (block.step <= 1) {
    return false;
  }

  const x = Math.round(block.x);
  const z = Math.round(block.z);
  const lowerStep = block.step - 1;
  const checks = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 }
  ];

  for (const check of checks) {
    const lower = surfaceMap.get(`${x + check.x},${z + check.z},${lowerStep}`);
    if (!lower) {
      continue;
    }
    if (check.x === 0 && check.z === 0) {
      return true;
    }
    if (lower.kind !== "stair") {
      return true;
    }
    const forward = getStairForwardGridVector(lower.rotationY || 0);
    if (x - Math.round(lower.x) !== forward.x || z - Math.round(lower.z) !== forward.z) {
      return true;
    }
  }

  return false;
}

function getSurfaceKey(block) {
  return `${Math.round(block.x)},${Math.round(block.z)},${block.step}`;
}

function repairCurvedHeightJumps(blocks3d, placements, cells, margin, pivotX, pivotY) {
  const surfaceKinds = new Set(["stair", "slab", "platform"]);
  const placementMap = new Map(placements.map((placement) => [
    getSurfaceKey({ x: placement.x, z: placement.z, step: placement.step }),
    placement
  ]));
  const removedKeys = new Set();
  const activeMap = new Map(
    blocks3d
      .filter((block) => surfaceKinds.has(block.kind))
      .map((block) => [getSurfaceKey(block), block])
  );

  let changed = true;
  let pass = 0;
  while (changed && pass < 6) {
    pass += 1;
    changed = false;

    const sortedBlocks = [...activeMap.values()].sort((a, b) => b.step - a.step);
    for (const block of sortedBlocks) {
      if ((block.kind !== "slab" && block.kind !== "platform") || block.step <= 1) {
        continue;
      }

      const key = getSurfaceKey(block);
      if (hasUnresolvedHeightJump(block, activeMap)) {
        activeMap.delete(key);
        removedKeys.add(key);
        changed = true;
      }
    }

    for (const block of activeMap.values()) {
      if (block.kind !== "stair") {
        continue;
      }
      const forward = getStairForwardGridVector(block.rotationY || 0);
      const upperLandingKey = `${Math.round(block.x) + forward.x},${Math.round(block.z) + forward.z},${block.step + 1}`;
      const sameLevelFrontKey = `${Math.round(block.x) + forward.x},${Math.round(block.z) + forward.z},${block.step}`;
      const upperLanding = activeMap.get(upperLandingKey);
      const sameLevelFront = activeMap.get(sameLevelFrontKey);
      if (!upperLanding && sameLevelFront?.kind === "stair") {
        block.kind = "slab";
        block.y = getStairBaseY(block.step) + 0.25;
        block.height = 0.5;
        block.rotationY = 0;
        const placement = placementMap.get(getSurfaceKey(block));
        if (placement) {
          placement.kind = "slab";
        }
        changed = true;
      }
    }
  }

  for (const [key, block] of activeMap.entries()) {
    if ((block.kind === "slab" || block.kind === "platform") && hasUnresolvedHeightJump(block, activeMap)) {
      activeMap.delete(key);
      removedKeys.add(key);
    }
  }

  const keptSurfaceKeys = new Set(activeMap.keys());
  const neededColumns = new Set(
    [...keptSurfaceKeys].map((key) => key.substring(0, key.lastIndexOf(",")))
  );
  const filteredBlocks = blocks3d.filter((block) => {
    if (surfaceKinds.has(block.kind)) {
      return keptSurfaceKeys.has(getSurfaceKey(block));
    }
    if (block.kind === "support") {
      return neededColumns.has(getColumnKey(block.x, block.z));
    }
    return true;
  });
  placements.splice(0, placements.length, ...placements.filter((placement) => {
    return keptSurfaceKeys.has(getSurfaceKey({ x: placement.x, z: placement.z, step: placement.step }));
  }));

  for (const placement of placements) {
    const block = activeMap.get(getSurfaceKey({ x: placement.x, z: placement.z, step: placement.step }));
    if (block) {
      placement.kind = block.kind;
      placement.support = placement.support || block.kind === "stair" || block.kind === "platform";
    }
  }

  for (const row of cells) {
    for (let col = 0; col < row.length; col += 1) {
      if (surfaceKinds.has(getCellKind(row[col]))) {
        row[col] = false;
      }
    }
  }

  for (const placement of placements) {
    const row = Math.round(placement.z + pivotY + margin);
    const col = Math.round(placement.x + pivotX + margin);
    if (row < 0 || row >= cells.length || col < 0 || col >= cells[row].length) {
      continue;
    }
    cells[row][col] = placement.kind === "stair"
      ? createStepCell(placement.step)
      : placement.kind === "platform"
        ? createPlatformCell(placement.step)
        : createSlabCell(placement.step);
  }

  return {
    blocks3d: filteredBlocks,
    supportUnitCount: filteredBlocks.filter((block) => block.kind === "support").length,
    stairBlockCount: filteredBlocks.filter((block) => block.kind === "stair").length,
    slabBlockCount: filteredBlocks.filter((block) => block.kind === "slab").length,
    platformBlockCount: filteredBlocks.filter((block) => block.kind === "platform").length
  };
}

function hasUnresolvedHeightJump(block, surfaceMap) {
  if (block.step <= 1) {
    return false;
  }

  const x = Math.round(block.x);
  const z = Math.round(block.z);
  const checks = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
    { x: 0, z: -1 }
  ];

  for (const check of checks) {
    const lower = surfaceMap.get(`${x + check.x},${z + check.z},${block.step - 1}`);
    if (!lower) {
      continue;
    }
    if (check.x === 0 && check.z === 0) {
      return true;
    }
    if (lower.kind !== "stair" && lower.kind !== "platform") {
      return true;
    }
    if (lower.kind === "platform") {
      continue;
    }
    const forward = getStairForwardGridVector(lower.rotationY || 0);
    if (x - Math.round(lower.x) !== forward.x || z - Math.round(lower.z) !== forward.z) {
      return true;
    }
  }

  return false;
}

function createsForwardStairRun(position, rotationY, selectedKeys) {
  const forward = getStairForwardGridVector(rotationY);
  const previousKey = getPositionKey(position.x - forward.x, position.y - forward.z);
  const nextKey = getPositionKey(position.x + forward.x, position.y + forward.z);
  return selectedKeys.has(previousKey) || selectedKeys.has(nextKey);
}

function addCurvedStepPosition(stepMap, x, y, footprint) {
  if (x >= 0 && x < footprint && y >= 0 && y < footprint) {
    stepMap.set(getPositionKey(x, y), { x, y });
  }
}

function getStairForwardGridVector(rotationY) {
  return {
    x: Math.round(Math.sin(rotationY)),
    z: Math.round(Math.cos(rotationY))
  };
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

const SCRIPT_FONT = Object.freeze({
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "?": ["11110", "00001", "00001", "00110", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "_": ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"]
});

function normalizeScriptText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .slice(0, 32);
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
    const dy = y - center;
    const dy2 = dy * dy;
    for (let x = 0; x < size; x += 1) {
      const distanceToCenter = Math.sqrt((x - center) ** 2 + dy2);
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
      const dy = y - center;
      const dy2 = dy * dy;
      for (let x = 0; x < size; x += 1) {
        const distanceToCenter = Math.sqrt((x - center) ** 2 + dy2);
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

  const centerY = (layers.length - 1) / 2;
  return createLayerBlocks3d(layers, "sphere", (layerIndex) => layerIndex - centerY);
}

export function generateDomeLayers(diameter, heightStretch = 1, domeSolid = false) {
  const margin = 2;
  const size = diameter + margin * 2;
  const radius = diameter / 2;
  const center = (size - 1) / 2;
  const stretch = Math.max(0.5, Math.min(3, Number(heightStretch) || 1));
  const layerCount = Math.max(1, Math.round(radius * stretch));
  const layers = [];
  let blockCount = 0;

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    const verticalRatio = layerCount === 1 ? 0 : layerIndex / Math.max(1, layerCount - 1);
    const layerRadius = Math.max(0.75, radius * Math.sqrt(Math.max(0, 1 - verticalRatio * verticalRatio)));
    const cells = [];

    for (let z = 0; z < size; z += 1) {
      const row = [];
      const dz = z - center;
      const dz2 = dz * dz;
      for (let x = 0; x < size; x += 1) {
        const distanceToCenter = Math.sqrt((x - center) ** 2 + dz2);
        const isBlock = domeSolid
          ? distanceToCenter <= layerRadius
          : distanceToCenter <= layerRadius && distanceToCenter > layerRadius - 1;
        const cell = isBlock ? createDomeCell(layerIndex + 1) : false;
        row.push(cell);
        if (isBlock) {
          blockCount += 1;
        }
      }
      cells.push(row);
    }

    layers.push(cells);
  }

  return { layers, cols: size, rows: size, blockCount, layerCount };
}

export function generateDomeBlocks3d(layers) {
  return createLayerBlocks3d(layers, "dome", (layerIndex) => layerIndex + 0.5);
}

export function generateScriptGrid(text, size = 2, weight = 1, spacing = 1) {
  const normalizedText = normalizeScriptText(text).trim() || "SCRIPT";
  const scale = Math.max(1, Math.min(8, Number(size) || 1));
  const strokeWeight = Math.max(1, Math.min(3, Number(weight) || 1));
  const letterSpacing = Math.max(0, Math.min(8, Number(spacing) || 0));
  const glyphHeight = 7;
  const glyphWidth = 5;
  const logicalWidth = normalizedText.length * glyphWidth + Math.max(0, normalizedText.length - 1) * letterSpacing;
  const logicalCells = Array.from({ length: glyphHeight }, () => Array(logicalWidth).fill(false));
  let cursor = 0;

  for (const char of normalizedText) {
    const glyph = SCRIPT_FONT[char] || SCRIPT_FONT["?"];
    for (let y = 0; y < glyphHeight; y += 1) {
      for (let x = 0; x < glyphWidth; x += 1) {
        if (glyph[y][x] !== "1") {
          continue;
        }
        for (let dy = 0; dy < strokeWeight; dy += 1) {
          for (let dx = 0; dx < strokeWeight; dx += 1) {
            const targetY = Math.min(glyphHeight - 1, y + dy);
            const targetX = Math.min(logicalWidth - 1, cursor + x + dx);
            logicalCells[targetY][targetX] = true;
          }
        }
      }
    }
    cursor += glyphWidth + letterSpacing;
  }

  const margin = 2;
  const rows = logicalCells.length * scale + margin * 2;
  const cols = logicalWidth * scale + margin * 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
  let blocks3d = [];
  const centerX = (cols - 1) / 2;
  const centerZ = (rows - 1) / 2;
  let blockCount = 0;

  for (let y = 0; y < logicalCells.length; y += 1) {
    for (let x = 0; x < logicalWidth; x += 1) {
      if (!logicalCells[y][x]) {
        continue;
      }
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const row = margin + y * scale + sy;
          const col = margin + x * scale + sx;
          cells[row][col] = createScriptCell();
          blocks3d.push(createBlock3d(
            col - centerX,
            0.5,
            row - centerZ,
            "script",
            1,
            1,
            1
          ));
          blockCount += 1;
        }
      }
    }
  }

  return {
    cells,
    cols,
    rows,
    blocks3d,
    blockCount,
    text: normalizedText,
    footprint: `${cols} × ${rows}`
  };
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
  let blocks3d = [];
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
    const travelX = -Math.sin(exitAngle) * turnSign;
    const travelZ = Math.cos(exitAngle) * turnSign;
    const travelAngle = getVectorAngle(travelX, travelZ);
    const fallbackStairRotation = getStairRotationFromVector(travelX, travelZ);
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
      travelAngle,
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
        if (position.support) {
          const supportBlocks = createSupportColumnAroundExistingBlocks(blocks3d, position.x, position.z, supportHeight);
          blocks3d.push(...supportBlocks);
          supportUnitCount += supportBlocks.length;
        }
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
          const supportBlocks = createSupportColumnAroundExistingBlocks(blocks3d, position.x, position.z, supportHeight);
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
        support: position.support,
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
      detail: `Pose ${formatStairBlockCount(stepStairCount)} contre la bordure du niveau suivant, ${formatPlatformBlockCount(stepPlatformCount)} de transition, puis ${formatSlabBlockCount(stepSlabCount)} de palier ${formatStairLevel(step)}, ${sideLabel} du pilier. Garde les supports sur les bordures.`
    });
  }

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
  const angleStart = Math.PI;
  const angleEnd = Math.PI * 1.5;
  const totalAngle = angleEnd - angleStart;
  const targetTreadLength = 3;
  const radius = Math.max(width + 1, Math.ceil((stepCount * targetTreadLength) / totalAngle));
  const footprint = Math.max(width * 2 + stepCount, radius + width + 3, 7);
  const margin = 2;
  const cols = footprint + margin * 2;
  const rows = footprint + margin * 2;
  const cells = Array.from({ length: rows }, () => Array(cols).fill(false));
  const pivotX = direction === "right" ? width : footprint - width - 1;
  const pivotY = footprint - width - 1;
  const mirror = direction === "right" ? -1 : 1;
  const buildPlan = [];
  let blocks3d = [];
  const placements = [];
  let supportUnitCount = 0;
  let stairBlockCount = 0;
  let slabBlockCount = 0;
  let platformBlockCount = 0;

  const stepsByLevel = Array.from({ length: stepCount + 1 }, () => new Map());
  const innerRadius = radius - width + 0.25;
  const outerRadius = radius + 0.75;

  for (let y = 0; y < footprint; y += 1) {
    const ny = y - pivotY;
    const ny2 = ny * ny;
    for (let x = 0; x < footprint; x += 1) {
      const normalizedX = (x - pivotX) * mirror;
      const distance = Math.sqrt(normalizedX * normalizedX + ny2);

      if (distance < innerRadius || distance > outerRadius) {
        continue;
      }

      let angle = Math.atan2(ny, normalizedX);
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
    const travelX = -Math.sin(exitAngle) * mirror;
    const travelZ = Math.cos(exitAngle);
    const travelAngle = getVectorAngle(travelX, travelZ);
    const stairRotation = getStairRotationFromVector(travelX, travelZ);

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
      travelAngle,
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
      const distance = Math.sqrt(normalizedX * normalizedX + z3d * z3d);
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

  const repaired = repairCurvedHeightJumps(blocks3d, placements, cells, margin, pivotX, pivotY);
  blocks3d = repaired.blocks3d;
  supportUnitCount = repaired.supportUnitCount;
  stairBlockCount = repaired.stairBlockCount;
  slabBlockCount = repaired.slabBlockCount;
  platformBlockCount = repaired.platformBlockCount;

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
