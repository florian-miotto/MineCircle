// Extension des méthodes pour gérer les étapes de construction avec animations GSAP

// À ajouter à la classe MinecraftBuilderStudio:

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
    
    this.stepCounter.textContent = `Étape ${this.currentBuildStep + 1} / ${this.buildSteps.length}`;
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

  // Modifier renderThreeBlocks pour utiliser le système d'étapes si disponible
  renderThreeBlocksOriginal(blocks, options = {}) {
    // Créer les étapes de construction
    if (blocks.length > 0) {
      this.buildConstructionSteps(blocks);
      this.currentBuildStep = this.buildSteps.length - 1;
      this.updateConstructionUI();
    }

    // Afficher la dernière étape
    this.renderCurrentBuildStep(false);
  }
