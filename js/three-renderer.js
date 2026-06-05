const BLOCK_EDGE_COLORS = Object.freeze({
  core: 0x1f2937,
  support: 0x083344,
  sphere: 0x14532d,
  stair: 0xffffff,
  slab: 0xffffff,
  platform: 0xffffff,
  dome: 0xffffff,
  script: 0x4c1d95
});

const STAIR_SURFACE_KINDS = new Set(["stair", "slab", "platform"]);

export class MinecraftThreeRenderer {
  constructor(domElements) {
    this.container = domElements.container;
    this.status = domElements.status;
    this.viewTitle = domElements.viewTitle;
    this.controlsContainer = domElements.controlsContainer;
    this.prevButton = domElements.prevButton;
    this.nextButton = domElements.nextButton;
    this.stepCounterElement = domElements.stepCounter;
    this.stairsDetails = domElements.stairsDetails;
    this.t = domElements.translate || ((key) => key);

    this.threeState = null;
    this.buildSteps = [];
    this.currentBuildStep = 0;
    this.selectedTool = "circle";
    this.showSupports3d = true;
  }

  initThreeView() {
    if (this.threeState) {
      return true;
    }

    const THREE = window.THREE;
    if (!THREE) {
      this.status.textContent = this.t("renderer.missingThree");
      return false;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050a18);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = false;
    if ("outputColorSpace" in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    this.container.replaceChildren(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const ambient = new THREE.AmbientLight(0xffffff, 0.62);
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(20, 40, 20);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.35);
    fill.position.set(-20, 20, -20);
    scene.add(ambient, key, fill);

    this.threeState = {
      scene,
      camera,
      renderer,
      group,
      materials: new Map(),
      geometries: new Map(),
      edgeGeometries: new Map(),
      isDragging: false,
      lastX: 0,
      lastY: 0,
      cameraDistance: 15,
      minCameraDistance: 5,
      maxCameraDistance: 50,
      targetY: 0,
      minPitch: -0.9,
      maxPitch: 0.75,
      animationFrame: null,
      grid: null,
      structureLoadToken: null
    };

    this.bindThreeDragEvents();
    this.resizeThreeView();
    this.animateThreeView();
    return true;
  }

  bindThreeDragEvents() {
    const { renderer, group } = this.threeState;
    const dom = renderer.domElement;

    dom.addEventListener("mousedown", (event) => {
      this.threeState.isDragging = true;
      this.threeState.lastX = event.clientX;
      this.threeState.lastY = event.clientY;
    });

    window.addEventListener("mousemove", (event) => {
      if (!this.threeState.isDragging) {
        return;
      }
      const deltaX = event.clientX - this.threeState.lastX;
      const deltaY = event.clientY - this.threeState.lastY;
      this.threeState.lastX = event.clientX;
      this.threeState.lastY = event.clientY;

      group.rotation.y += deltaX * 0.008;
      group.rotation.x = Math.max(
        this.threeState.minPitch,
        Math.min(this.threeState.maxPitch, group.rotation.x + deltaY * 0.006)
      );
    });

    window.addEventListener("mouseup", () => {
      this.threeState.isDragging = false;
    });

    dom.addEventListener("mouseleave", () => {
      this.threeState.isDragging = false;
    });

    dom.addEventListener("wheel", (event) => {
      event.preventDefault();
      const zoomFactor = event.deltaY > 0 ? 1.08 : 0.92;
      this.threeState.cameraDistance = Math.max(
        this.threeState.minCameraDistance,
        Math.min(this.threeState.maxCameraDistance, this.threeState.cameraDistance * zoomFactor)
      );
      this.positionThreeCamera();
    }, { passive: false });
  }

  renderThreeBlocks(blocks, selectedTool, showSupports3d, options = {}) {
    this.selectedTool = selectedTool;
    this.showSupports3d = showSupports3d;

    if (blocks.length > 0) {
      this.buildConstructionSteps(blocks);
      this.currentBuildStep = this.buildSteps.length - 1; // Afficher la dernière étape
      this.updateConstructionUI();
    }
    this.renderCurrentBuildStep(false);
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
    const edgeOpacity = this.getBlockEdgeOpacity(block.kind);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: edgeOpacity,
      linewidth: this.getBlockEdgeWidth(block.kind)
    });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
    edges.position.copy(mesh.position);
    edges.rotation.copy(mesh.rotation);
    group.add(edges);
    if (this.hasStrongOutline(block.kind)) {
      const outlineScale = this.getStrongOutlineScale(block.kind);
      const outlineMat = new THREE.MeshBasicMaterial({ color: this.getStrongOutlineColor(block.kind), side: THREE.BackSide });
      const outline = new THREE.Mesh(geometry.clone(), outlineMat);
      outline.position.copy(mesh.position);
      outline.rotation.copy(mesh.rotation);
      outline.scale.set(outlineScale, outlineScale, outlineScale);
      group.add(outline);
    }
  }

  addMinecraftStairBlock(group, block, showEdges) {
    const THREE = window.THREE;
    const stairGroup = new THREE.Group();
    const material = this.getThreeMaterial("stair");
    const stairShape = block.stairShape || "straight";
    const geometryKey = `stair|${block.width}|${block.height}|${block.depth}|${stairShape}`;
    let geometry = this.threeState.geometries.get(geometryKey);
    if (!geometry) {
      geometry = this.createStairGeometry(block.width, block.height, block.depth, stairShape);
      this.threeState.geometries.set(geometryKey, geometry);
    }

    stairGroup.position.set(block.x, block.y, block.z);
    stairGroup.rotation.y = block.rotationY || 0;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    stairGroup.add(mesh);

    if (showEdges) {
      const outlineKey = `stair-outline|${block.width}|${block.height}|${block.depth}|${stairShape}`;
      let outlineGeometry = this.threeState.edgeGeometries.get(outlineKey);
      if (!outlineGeometry) {
        outlineGeometry = this.createStairOutlineGeometry(block.width, block.height, block.depth, stairShape);
        this.threeState.edgeGeometries.set(outlineKey, outlineGeometry);
      }

      const edges = new THREE.LineSegments(
        outlineGeometry,
        new THREE.LineBasicMaterial({
          color: this.getBlockEdgeColor("stair"),
          transparent: true,
          opacity: this.getBlockEdgeOpacity("stair"),
          linewidth: this.getBlockEdgeWidth("stair")
        })
      );
      stairGroup.add(edges);
    }

    group.add(stairGroup);
    return stairGroup;
  }

  applyStairCornerShapes(blocks) {
    const stairBlocks = blocks.filter((block) => block.kind === "stair");
    if (stairBlocks.length === 0) {
      return blocks;
    }

    const stairMap = new Map();
    const stairColumnMap = new Map();
    for (const block of stairBlocks) {
      const level = block.step ?? Math.round(block.y * 2) / 2;
      stairMap.set(this.getStairAdjacencyKey(block.x, block.z, level), block);
      const columnKey = this.getStairColumnKey(block.x, block.z);
      if (!stairColumnMap.has(columnKey)) {
        stairColumnMap.set(columnKey, []);
      }
      stairColumnMap.get(columnKey).push({ block, level });
    }

    return blocks.map((block) => {
      if (block.kind !== "stair") {
        return block;
      }
      const shape = this.getStairCornerShape(block, stairMap, stairColumnMap);
      return shape === "straight" ? block : { ...block, stairShape: shape };
    });
  }

  getStairCornerShape(block, stairMap, stairColumnMap) {
    const rotationY = block.rotationY || 0;
    const level = block.step ?? Math.round(block.y * 2) / 2;
    const forward = this.getStairForwardVector(rotationY);
    const right = this.getStairRightVector(rotationY);
    const sides = [
      { name: "left", x: -right.x, z: -right.z },
      { name: "right", x: right.x, z: right.z }
    ];

    for (const side of sides) {
      const neighborX = block.x + side.x;
      const neighborZ = block.z + side.z;
      const neighbor = stairMap.get(this.getStairAdjacencyKey(neighborX, neighborZ, level))
        || this.getNearbyStairInColumn(neighborX, neighborZ, level, stairColumnMap);
      if (!neighbor) {
        continue;
      }

      const neighborForward = this.getStairForwardVector(neighbor.rotationY || 0);
      if (Math.abs(forward.x * neighborForward.x + forward.z * neighborForward.z) > 0.1) {
        continue;
      }

      const neighborToBlock = { x: -side.x, z: -side.z };
      if (this.areGridVectorsEqual(neighborToBlock, { x: -neighborForward.x, z: -neighborForward.z })) {
        return `inner-${side.name}`;
      }
      if (this.areGridVectorsEqual(neighborToBlock, neighborForward)) {
        return `outer-${side.name}`;
      }
    }

    return "straight";
  }

  getNearbyStairInColumn(x, z, level, stairColumnMap) {
    const candidates = stairColumnMap.get(this.getStairColumnKey(x, z)) || [];
    let best = null;
    for (const candidate of candidates) {
      const distance = Math.abs(candidate.level - level);
      if (distance > 1) {
        continue;
      }
      if (!best || distance < best.distance) {
        best = { ...candidate, distance };
      }
    }
    return best?.block || null;
  }

  getStairAdjacencyKey(x, z, level) {
    return `${Math.round(x)},${Math.round(z)},${level}`;
  }

  getStairColumnKey(x, z) {
    return `${Math.round(x)},${Math.round(z)}`;
  }

  getStairForwardVector(rotationY) {
    return {
      x: Math.round(Math.sin(rotationY)),
      z: Math.round(Math.cos(rotationY))
    };
  }

  getStairRightVector(rotationY) {
    return {
      x: Math.round(Math.cos(rotationY)),
      z: Math.round(-Math.sin(rotationY))
    };
  }

  areGridVectorsEqual(a, b) {
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.z) === Math.round(b.z);
  }

  createStairGeometry(width, height, depth, shape = "straight") {
    const THREE = window.THREE;
    const { xs, zs, yMin, heights } = this.getStairHeightGrid(width, height, depth, shape);
    const vertices = [];
    const addQuad = (points) => {
      for (const point of points) {
        vertices.push(point[0], point[1], point[2]);
      }
    };

    addQuad([
      [xs[0], yMin, zs[0]], [xs[2], yMin, zs[0]], [xs[2], yMin, zs[2]],
      [xs[0], yMin, zs[0]], [xs[2], yMin, zs[2]], [xs[0], yMin, zs[2]]
    ]);

    for (let ix = 0; ix < 2; ix += 1) {
      for (let iz = 0; iz < 2; iz += 1) {
        const x0 = xs[ix];
        const x1 = xs[ix + 1];
        const z0 = zs[iz];
        const z1 = zs[iz + 1];
        const y = heights[ix][iz];

        addQuad([
          [x0, y, z0], [x0, y, z1], [x1, y, z1],
          [x0, y, z0], [x1, y, z1], [x1, y, z0]
        ]);

        if (ix === 0) {
          this.addVerticalStairFace(vertices, x0, z0, x0, z1, yMin, y);
        } else if (heights[ix - 1][iz] !== y) {
          this.addVerticalStairFace(vertices, x0, z0, x0, z1, Math.min(y, heights[ix - 1][iz]), Math.max(y, heights[ix - 1][iz]));
        }
        if (ix === 1) {
          this.addVerticalStairFace(vertices, x1, z1, x1, z0, yMin, y);
        }
        if (iz === 0) {
          this.addVerticalStairFace(vertices, x1, z0, x0, z0, yMin, y);
        } else if (heights[ix][iz - 1] !== y) {
          this.addVerticalStairFace(vertices, x1, z0, x0, z0, Math.min(y, heights[ix][iz - 1]), Math.max(y, heights[ix][iz - 1]));
        }
        if (iz === 1) {
          this.addVerticalStairFace(vertices, x0, z1, x1, z1, yMin, y);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  addVerticalStairFace(vertices, x0, z0, x1, z1, y0, y1) {
    vertices.push(
      x0, y0, z0, x1, y0, z1, x1, y1, z1,
      x0, y0, z0, x1, y1, z1, x0, y1, z0
    );
  }

  createStairOutlineGeometry(width, height, depth, shape = "straight") {
    const THREE = window.THREE;
    const { xs, zs, yMin, heights } = this.getStairHeightGrid(width, height, depth, shape);
    const vertices = [];
    const addSegment = (x0, y0, z0, x1, y1, z1) => {
      vertices.push(x0, y0, z0, x1, y1, z1);
    };

    addSegment(xs[0], yMin, zs[0], xs[2], yMin, zs[0]);
    addSegment(xs[2], yMin, zs[0], xs[2], yMin, zs[2]);
    addSegment(xs[2], yMin, zs[2], xs[0], yMin, zs[2]);
    addSegment(xs[0], yMin, zs[2], xs[0], yMin, zs[0]);

    for (let ix = 0; ix < 2; ix += 1) {
      for (let iz = 0; iz < 2; iz += 1) {
        const x0 = xs[ix];
        const x1 = xs[ix + 1];
        const z0 = zs[iz];
        const z1 = zs[iz + 1];
        const y = heights[ix][iz];

        if (ix === 0 || heights[ix - 1][iz] !== y) {
          addSegment(x0, y, z0, x0, y, z1);
        }
        if (ix === 1 || heights[ix + 1][iz] !== y) {
          addSegment(x1, y, z0, x1, y, z1);
        }
        if (iz === 0 || heights[ix][iz - 1] !== y) {
          addSegment(x0, y, z0, x1, y, z0);
        }
        if (iz === 1 || heights[ix][iz + 1] !== y) {
          addSegment(x0, y, z1, x1, y, z1);
        }
      }
    }

    for (const x of [xs[0], xs[2]]) {
      for (const z of [zs[0], zs[2]]) {
        const ix = x === xs[0] ? 0 : 1;
        const iz = z === zs[0] ? 0 : 1;
        addSegment(x, yMin, z, x, heights[ix][iz], z);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    return geometry;
  }

  getStairHeightGrid(width, height, depth, shape = "straight") {
    const half = 0;
    const full = height / 2;
    const heights = [
      [half, full],
      [half, full]
    ];

    if (shape === "inner-left") {
      heights[0][0] = full;
    } else if (shape === "inner-right") {
      heights[1][0] = full;
    } else if (shape === "outer-left") {
      heights[1][1] = half;
    } else if (shape === "outer-right") {
      heights[0][1] = half;
    }

    return {
      xs: [-width / 2, 0, width / 2],
      zs: [-depth / 2, 0, depth / 2],
      yMin: -height / 2,
      heights
    };
  }

  getBlockEdgeColor(kind) {
    return BLOCK_EDGE_COLORS[kind] ?? 0x3f2a12;
  }

  getBlockEdgeOpacity(kind) {
    return kind === 'dome' || this.isStairSurfaceKind(kind) ? 0.95 : kind === 'sphere' ? 0.72 : 0.30;
  }

  getBlockEdgeWidth(kind) {
    return kind === 'dome' || this.isStairSurfaceKind(kind) ? 2.5 : 1;
  }

  hasStrongOutline(kind) {
    return kind === 'sphere' || kind === 'dome' || this.isStairSurfaceKind(kind) || kind === 'stone';
  }

  getStrongOutlineColor(kind) {
    return kind === 'dome' || this.isStairSurfaceKind(kind) ? 0xffffff : 0x000000;
  }

  getStrongOutlineScale(kind) {
    return kind === 'dome' || this.isStairSurfaceKind(kind) ? 1.08 : 1.03;
  }

  isStairSurfaceKind(kind) {
    return STAIR_SURFACE_KINDS.has(kind);
  }

  buildConstructionSteps(blocks) {
    const heightMap = new Map();
    
    for (const block of blocks) {
      const roundedY = Math.round(block.y * 2) / 2;
      if (!heightMap.has(roundedY)) {
        heightMap.set(roundedY, []);
      }
      heightMap.get(roundedY).push(block);
    }
    
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
    const hasSteps = this.buildSteps.length > 0;
    this.controlsContainer.classList.toggle("hidden", !hasSteps);
    
    if (!hasSteps) {
      return;
    }
    
    const isFirstStep = this.currentBuildStep === 0;
    const isLastStep = this.currentBuildStep === this.buildSteps.length - 1;
    
    this.prevButton.disabled = isFirstStep;
    this.nextButton.disabled = isLastStep;
    
    this.stepCounterElement.textContent = this.t("renderer.step", {
      current: this.currentBuildStep + 1,
      total: this.buildSteps.length
    });
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

    const showEdges = (this.selectedTool === 'sphere' || this.selectedTool === 'dome' || this.selectedTool === 'script' || this.selectedTool === 'stairs')
      ? true
      : centeredBlocks.length <= 900;
    const blockMeshes = [];
    const instancedThreshold = (this.selectedTool === 'sphere' || this.selectedTool === 'dome' || this.selectedTool === 'script' || this.selectedTool === 'stairs')
      ? Infinity
      : 1200;

    if (centeredBlocks.length > instancedThreshold) {
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
    this.status.textContent = this.t("renderer.dragHelp");
  }

  createBlockMesh(group, block, showEdges) {
    const THREE = window.THREE;
    
    if (block.kind === "stair") {
      const stairGroup = this.addMinecraftStairBlock(group, block, showEdges);
      stairGroup.scale.set(0, 0, 0);
      return stairGroup;
    }

    const geomKey = `${block.width}|${block.height}|${block.depth}`;
    let geometry = this.threeState.geometries.get(geomKey);
    if (!geometry) {
      geometry = new THREE.BoxGeometry(block.width, block.height, block.depth);
      this.threeState.geometries.set(geomKey, geometry);
    }

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
      const edgeOpacity = this.getBlockEdgeOpacity(block.kind);
      
      let edgesGeometry = this.threeState.edgeGeometries.get(geomKey);
      if (!edgesGeometry) {
        edgesGeometry = new THREE.EdgesGeometry(geometry);
        this.threeState.edgeGeometries.set(geomKey, edgesGeometry);
      }

      const edges = new THREE.LineSegments(
        edgesGeometry,
        new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: edgeOpacity,
          linewidth: this.getBlockEdgeWidth(block.kind)
        })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      edges.scale.set(0, 0, 0);
      group.add(edges);
      mesh.userData.edgesMesh = edges;

      if (this.hasStrongOutline(block.kind)) {
        const outlineMat = new THREE.MeshBasicMaterial({ color: this.getStrongOutlineColor(block.kind), side: THREE.BackSide });
        const outline = new THREE.Mesh(geometry, outlineMat);
        outline.position.copy(mesh.position);
        outline.rotation.copy(mesh.rotation);
        outline.scale.set(0, 0, 0);
        outline.userData.scaleTarget = this.getStrongOutlineScale(block.kind);
        group.add(outline);
        mesh.userData.outlineMesh = outline;
      }
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
        if (mesh.userData.outlineMesh) {
          const target = mesh.userData.outlineMesh.userData.scaleTarget || 1.03;
          mesh.userData.outlineMesh.scale.set(target, target, target);
        }
      }
      return;
    }

    for (const mesh of blockMeshes) {
      mesh.scale.set(0, 0, 0);
      if (mesh.userData.edgesMesh) {
        mesh.userData.edgesMesh.scale.set(0, 0, 0);
      }
      if (mesh.userData.outlineMesh) {
        mesh.userData.outlineMesh.scale.set(0, 0, 0);
      }
    }

    const totalBuildTime = 0.6;
    const count = blockMeshes.length;
    const delayIncrement = Math.min(0.04, totalBuildTime / Math.max(1, count));
    const duration = Math.max(0.12, Math.min(0.3, 0.4 - count * 0.001));

    blockMeshes.forEach((mesh, index) => {
      const delay = goingBackward ? (count - index - 1) * delayIncrement : index * delayIncrement;
      
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
        });
      }
      if (mesh.userData.outlineMesh) {
        const target = mesh.userData.outlineMesh.userData.scaleTarget || 1.03;
        GSAP.to(mesh.userData.outlineMesh.scale, {
          x: target,
          y: target,
          z: target,
          duration,
          delay,
          ease: "back.out"
        });
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
      platform: ["#9f6b2f", "#704214", "#c18a45", "#4a2a0d"],
      dome: ["#38bdf8", "#0284c7", "#bae6fd", "#0c4a6e"],
      script: ["#c084fc", "#7e22ce", "#f0abfc", "#4c1d95"]
    };

    if (kind === 'stone' || kind === 'sphere') {
      const tex = this.createStoneTexture();
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.88,
        metalness: 0,
        transparent: false,
        depthWrite: true
      });
      this.threeState.materials.set(kind, mat);
      return mat;
    }

    if (kind === 'dome') {
      const texture = this.createDomePngTexture();
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.84,
        metalness: 0,
        transparent: false,
        depthWrite: true
      });
      this.threeState.materials.set(kind, material);
      return material;
    }

    const texture = this.createPixelTexture(palettes[cacheKey] || palettes.block);
    const isTranslucent = cacheKey === "support" || cacheKey === "glass" || cacheKey === "water";
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.92,
      metalness: 0,
      side: cacheKey === "stair" ? THREE.DoubleSide : THREE.FrontSide,
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

  createDomePngTexture() {
    const THREE = window.THREE;
    const size = 32;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#0ea5e9";
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 8) {
      for (let x = 0; x < size; x += 8) {
        const shifted = (x / 8 + y / 8) % 2 === 0;
        ctx.fillStyle = shifted ? "#38bdf8" : "#0284c7";
        ctx.fillRect(x, y, 8, 8);
        ctx.fillStyle = "rgba(224, 242, 254, 0.35)";
        ctx.fillRect(x + 1, y + 1, 5, 1);
        ctx.fillRect(x + 1, y + 2, 1, 4);
        ctx.fillStyle = "rgba(7, 89, 133, 0.42)";
        ctx.fillRect(x + 6, y + 1, 1, 6);
        ctx.fillRect(x + 1, y + 6, 6, 1);
      }
    }

    ctx.strokeStyle = "rgba(12, 74, 110, 0.78)";
    ctx.lineWidth = 1;
    for (let line = 0.5; line <= size; line += 8) {
      ctx.beginPath();
      ctx.moveTo(line, 0);
      ctx.lineTo(line, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, line);
      ctx.lineTo(size, line);
      ctx.stroke();
    }

    const pngUrl = canvas.toDataURL("image/png");
    const texture = new THREE.TextureLoader().load(pngUrl);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    if ("colorSpace" in texture && THREE.SRGBColorSpace) {
      texture.colorSpace = THREE.SRGBColorSpace;
    }
    return texture;
  }

  createStoneTexture() {
    const THREE = window.THREE;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#8f8f8f';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 4000; i++) {
      const x = Math.floor(Math.random() * size);
      const y = Math.floor(Math.random() * size);
      const v = Math.floor(200 + Math.random() * 55);
      const a = 0.06 + Math.random() * 0.18;
      ctx.fillStyle = `rgba(${v},${v},${v},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }

    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      const startX = Math.random() * size;
      const startY = Math.random() * size;
      ctx.moveTo(startX, startY);
      for (let j = 0; j < 8; j++) {
        ctx.lineTo(startX + Math.random() * 12 - 6 + j * 2, startY + Math.random() * 6 - 3);
      }
      ctx.strokeStyle = `rgba(60,60,60,${0.15 + Math.random() * 0.18})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    texture.anisotropy = 1;
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
    const rect = this.container.getBoundingClientRect();
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
    if (this.status) {
      this.status.textContent = "";
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

  // -------------------------------------------------------------
  // PARSEUR GLB PERSONALISÉ
  // -------------------------------------------------------------

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
    this.status.textContent = this.t("renderer.loading", { label });

    try {
      const model = await this.loadGlbModel(structure.modelUrl);
      if (this.threeState.structureLoadToken !== loadToken) {
        return;
      }

      group.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      if (bounds.isEmpty()) {
        this.status.textContent = this.t("renderer.emptyGlb");
        return;
      }

      const center = new THREE.Vector3();
      bounds.getCenter(center);
      model.position.sub(center); // Centrer l'objet

      const size = new THREE.Vector3();
      bounds.getSize(size);
      const maxRadius = Math.hypot(size.x, size.z) * 0.5;
      const heightSpan = size.y;
      const maxY = size.y * 0.5;
      const minY = -size.y * 0.5;

      this.threeState.targetY = (minY + maxY) * 0.5;
      this.threeState.minCameraDistance = Math.max(3, maxRadius * 0.5);
      this.threeState.maxCameraDistance = Math.max(30, maxRadius * 8, heightSpan * 5);
      this.threeState.cameraDistance = Math.max(8, maxRadius * 2.4, heightSpan * 1.4);
      this.positionThreeCamera();
      renderer.render(scene, camera);
      this.status.textContent = this.t("renderer.loaded", {
        title: structure.title,
        url: structure.modelUrl
      });
    } catch (error) {
      console.error(error);
      const detail = error && error.message ? error.message : "unknown error";
      this.status.textContent = window.location.protocol === "file:"
        ? this.t("renderer.fileProtocol")
        : this.t("renderer.loadError", { detail });
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
}
