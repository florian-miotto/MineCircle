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

const FUTURE_SERVICES = ["domes", "bridges", "exports"];

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
    titleKey: "structure.mine.title",
    descriptionKey: "structure.mine.description",
    fileName: "mine.glb",
    modelUrl: "./mine.glb"
  }
]);

const CURVED_DIRECTION_LABELS = Object.freeze({
  right: "Droite",
  left: "Gauche"
});

const TOOL_HINTS = Object.freeze({
  circle: "toolHint.circle",
  sphere: "toolHint.sphere",
  dome: "toolHint.dome",
  porch: "toolHint.porch",
  stairs: "toolHint.stairs",
  script: "toolHint.script",
  structures: "toolHint.structures"
});

const CELL_COLORS = Object.freeze({
  stair: '#d59a3a',
  slab: '#c58a2b',
  platform: '#9f6b2f',
  core: '#64748b',
  support: '#38bdf8',
  dome: '#0ea5e9',
  script: '#a855f7'
});

const LOCALES = Object.freeze({
  fr: {
    strings: {
      "meta.title": "Minecraft Circle & Sphere Builder - Plan de construction 2D/3D",
      "meta.description": "Générez facilement des cercles, sphères, porches et escaliers pour vos constructions Minecraft. Visualisez en 2D et 3D avec des instructions étape par étape.",
      "hero.title": "Minecraft Circle Builder",
      "hero.subtitle": "Génère des cercles, porches et entrées monumentales en blocs Minecraft.",
      "language.aria": "Choisir la langue",
      "language.frTitle": "Français",
      "language.enTitle": "Anglais",
      "tool.selectTitle": "Outil à utiliser",
      "tool.circleOption": "⭕ Cercle",
      "tool.sphereOption": "🌐 Sphère",
      "tool.domeOption": "🏟️ Dôme",
      "tool.porchOption": "⛩️ Porche / Entrée",
      "tool.stairsOption": "📶 Escalier",
      "tool.scriptOption": "✍️ Script",
      "tool.structuresOption": "🏗️ Structures",
      "settings.title": "Paramètres",
      "input.diameter": "Diamètre (en blocs)",
      "input.sphereLayer": "Couche de la sphère",
      "input.sphereSolid": "Sphère pleine",
      "hint.sphereSlider": "Faites glisser pour voir chaque coupe de la sphère.",
      "input.width": "Largeur (en blocs)",
      "input.height": "Hauteur (en blocs)",
      "input.frameThickness": "Épaisseur du cadre (en blocs)",
      "input.topStyle": "Style du haut",
      "input.groundDiameter": "Diamètre au sol (en blocs)",
      "input.verticalStretch": "Étirement vertical",
      "input.domeLayer": "Couche du dôme",
      "input.domeSolid": "Dôme plein",
      "input.totalHeight": "Hauteur totale (en blocs)",
      "input.stairType": "Type d'escalier",
      "input.rotationDirection": "Sens de rotation",
      "input.curvedDirection": "Sens de l'arrondi",
      "input.spiralDirection": "Sens du colimaçon",
      "input.text": "Texte",
      "input.size": "Taille",
      "input.strokeWeight": "Finesse du trait",
      "input.spacing": "Espacement",
      "porch.roundedOption": "⬤ Arrondi",
      "porch.pointedOption": "▲ En pointe",
      "porch.medievalOption": "🏰 Médiéval",
      "stairs.straightOption": "➞ Tout droit",
      "stairs.spiralOption": "🌀 En colimaçon",
      "stairs.curvedOption": "↪️ Arrondi / Courbé",
      "direction.rightOption": "➡️ Droite",
      "direction.leftOption": "⬅️ Gauche",
      "structures.available": "Structures disponibles",
      "structures.listAria": "Liste des structures disponibles",
      "structures.loading": "Chargement des structures...",
      "structures.hint": "Les structures affichées correspondent aux fichiers GLB présents dans le dossier du site.",
      "button.generate": "Générer",
      "button.previous": "◀ Précédent",
      "button.next": "Suivant ▶",
      "button.hideSupports": "Masquer les supports (3D)",
      "button.showSupports": "Afficher les supports (3D)",
      "button.copyCommands": "Copie Commande",
      "button.exportPng": "Exporter PNG",
      "button.clear": "Effacer",
      "step.initial": "Étape 1 / 1",
      "view.3d": "Vue 3D",
      "view.3dAria": "Vue 3D de la structure",
      "view.structure3d": "Vue 3D de la structure",
      "view.sphere3d": "Vue 3D de la sphère",
      "view.dome3d": "Vue 3D du dôme",
      "view.script3d": "Vue 3D du script",
      "view.top": "Vue de dessus",
      "view.side": "Vue de côté",
      "view.gridAria": "Grille de construction Minecraft",
      "view.sideAria": "Vue de côté de l'escalier",
      "legend.stair": "<i class=\"swatch swatch-stair\"></i> Bloc escalier / marche",
      "legend.slab": "<i class=\"swatch swatch-slab\"></i> Dalle / palier plat",
      "legend.platform": "<i class=\"swatch swatch-platform\"></i> Bloc de transition",
      "legend.core": "<i class=\"swatch swatch-core\"></i> Bloc plein / pilier",
      "legend.dome": "<i class=\"swatch swatch-dome\"></i> Bloc de dôme",
      "legend.script": "<i class=\"swatch swatch-script\"></i> Bloc de script",
      "legend.support": "<i class=\"swatch swatch-support\"></i> Remplissage sécurité",
      "legend.empty": "<i class=\"swatch swatch-empty\"></i> Case vide",
      "future.title": "Services Minecraft à venir",
      "future.domes.title": "Monuments en 3D",
      "future.domes.description": "Étendre les générateurs en 3D pour les projets monumentaux.",
      "future.bridges.title": "Ponts et routes",
      "future.bridges.description": "Préparer des tracés réguliers pour relier vos constructions.",
      "future.exports.title": "Export plans",
      "future.exports.description": "Exporter en texte ou séquence de construction.",
      "toolHint.circle": "Astuce : le diamètre contrôle le contour extérieur de la forme.",
      "toolHint.sphere": "Astuce : utilisez le curseur pour parcourir les couches horizontales de la sphère.",
      "toolHint.dome": "Astuce : étirez la hauteur du dôme pour obtenir une demi-sphère basse ou une forme allongée.",
      "toolHint.porch": "Astuce : la largeur du porche est ajustée automatiquement à une valeur impaire pour garder une symétrie propre.",
      "toolHint.stairs": "Astuce : les marches utilisent des blocs escaliers Minecraft et des supports en blocs pleins.",
      "toolHint.script": "Astuce : le texte est converti en blocs, puis affiché en plan et en 3D.",
      "toolHint.structures": "Astuce : choisissez une structure pour afficher son titre, sa description et sa vue 3D.",
      "label.layer": "Couche {current} / {total}",
      "label.stretch": "Étirement ×{value}",
      "label.noStructure": "Aucune structure affichée.",
      "label.noStructures": "Aucune structure disponible.",
      "label.script.thin": "Trait fin",
      "label.script.medium": "Trait moyen",
      "label.script.thick": "Trait épais",
      "structure.mine.title": "Mine",
      "structure.mine.description": "Structure importée depuis le fichier mine.glb du projet.",
      "structure.genericTitle": "Structure",
      "structure.genericDescription": "Structure GLB du dossier du site.",
      "message.invalidDiameter": "Diamètre invalide. Saisis un entier entre 1 et 256.",
      "message.invalidPorch": "Paramètres de porche invalides. Vérifie largeur, hauteur, épaisseur et style.",
      "message.invalidStairs": "Paramètres d'escalier invalides. Vérifie hauteur, largeur et type.",
      "message.invalidDome": "Paramètres de dôme invalides. Vérifie le diamètre et l'étirement.",
      "message.invalidScript": "Paramètres de script invalides. Saisis un texte, une taille, une finesse et un espacement.",
      "message.noExport": "Aucune structure à exporter.",
      "message.pngExported": "PNG exporté avec succès.",
      "message.copyOnlyCircle": "La copie de commandes est disponible pour le cercle.",
      "message.noCommands": "Aucune commande à copier.",
      "message.commandsCopied": "{count} commandes Minecraft copiées.",
      "renderer.missingThree": "Vue 3D indisponible : Three.js n'a pas pu être chargé.",
      "renderer.step": "Étape {current} / {total}",
      "renderer.dragHelp": "Glissez horizontalement et verticalement pour tourner. Utilisez la molette pour zoomer.",
      "renderer.loading": "Chargement de {label}...",
      "renderer.emptyGlb": "Le fichier GLB est chargé, mais aucun volume visible n'a été trouvé.",
      "renderer.loaded": "{title} chargé depuis {url}. Glissez horizontalement et verticalement pour tourner. Utilisez la molette pour zoomer.",
      "renderer.fileProtocol": "Impossible de charger le GLB en file://. Lancez node dev-server.cjs puis ouvrez http://127.0.0.1:8000/index.html.",
      "renderer.loadError": "Impossible de charger le GLB : {detail}"
    },
    labels: {
      tools: { circle: "Cercle", sphere: "Sphère", dome: "Dôme", porch: "Porche / Entrée monumentale", stairs: "Escalier", script: "Script", structures: "Structures" },
      porchStyles: { rounded: "Arrondi", pointed: "En pointe", medieval: "Médiéval" },
      stairTypes: { straight: "Tout droit", spiral: "En colimaçon", curved: "Arrondi" },
      directions: { right: "Droite", left: "Gauche" },
      stats: {
        tool: "Outil", diameter: "Diamètre", outlineBlocks: "Blocs du contour", grid: "Grille affichée",
        topStyle: "Style du haut", widthHeight: "Largeur × hauteur", thickness: "Épaisseur",
        estimatedBlocks: "Blocs estimés", type: "Type", totalHeight: "Hauteur totale", width: "Largeur",
        stairBlocks: "Blocs escaliers", footprint: "Emprise au sol", slabs: "Dalles de palier",
        platforms: "Blocs de transition", spiralDirection: "Sens du colimaçon", curvedDirection: "Sens de l'arrondi",
        layers: "Couches", currentLayer: "Couche actuelle", groundDiameter: "Diamètre au sol",
        stretch: "Étirement", height: "Hauteur", text: "Texte", size: "Taille", weight: "Finesse",
        spacing: "Espacement", title: "Titre", description: "Description", file: "Fichier", engine: "Moteur"
      }
    }
  },
  en: {
    strings: {
      "meta.title": "Minecraft Circle & Sphere Builder - 2D/3D building planner",
      "meta.description": "Easily generate circles, spheres, domes, arches and stairs for Minecraft builds. Preview them in 2D and 3D with step-by-step construction guidance.",
      "hero.title": "Minecraft Circle Builder",
      "hero.subtitle": "Generate Minecraft block circles, arches, stairs, domes and monumental entrances.",
      "language.aria": "Choose language",
      "language.frTitle": "French",
      "language.enTitle": "English",
      "tool.selectTitle": "Tool",
      "tool.circleOption": "⭕ Circle",
      "tool.sphereOption": "🌐 Sphere",
      "tool.domeOption": "🏟️ Dome",
      "tool.porchOption": "⛩️ Porch / Entrance",
      "tool.stairsOption": "📶 Stairs",
      "tool.scriptOption": "✍️ Script",
      "tool.structuresOption": "🏗️ Structures",
      "settings.title": "Settings",
      "input.diameter": "Diameter (blocks)",
      "input.sphereLayer": "Sphere layer",
      "input.sphereSolid": "Solid sphere",
      "hint.sphereSlider": "Drag to inspect each slice of the sphere.",
      "input.width": "Width (blocks)",
      "input.height": "Height (blocks)",
      "input.frameThickness": "Frame thickness (blocks)",
      "input.topStyle": "Top style",
      "input.groundDiameter": "Ground diameter (blocks)",
      "input.verticalStretch": "Vertical stretch",
      "input.domeLayer": "Dome layer",
      "input.domeSolid": "Solid dome",
      "input.totalHeight": "Total height (blocks)",
      "input.stairType": "Stair type",
      "input.rotationDirection": "Turn direction",
      "input.curvedDirection": "Curve direction",
      "input.spiralDirection": "Spiral direction",
      "input.text": "Text",
      "input.size": "Size",
      "input.strokeWeight": "Stroke weight",
      "input.spacing": "Spacing",
      "porch.roundedOption": "⬤ Rounded",
      "porch.pointedOption": "▲ Pointed",
      "porch.medievalOption": "🏰 Medieval",
      "stairs.straightOption": "➞ Straight",
      "stairs.spiralOption": "🌀 Spiral",
      "stairs.curvedOption": "↪️ Rounded / Curved",
      "direction.rightOption": "➡️ Right",
      "direction.leftOption": "⬅️ Left",
      "structures.available": "Available structures",
      "structures.listAria": "Available structures list",
      "structures.loading": "Loading structures...",
      "structures.hint": "The listed structures match the GLB files available in the site folder.",
      "button.generate": "Generate",
      "button.previous": "◀ Previous",
      "button.next": "Next ▶",
      "button.hideSupports": "Hide supports (3D)",
      "button.showSupports": "Show supports (3D)",
      "button.copyCommands": "Copy Commands",
      "button.exportPng": "Export PNG",
      "button.clear": "Clear",
      "step.initial": "Step 1 / 1",
      "view.3d": "3D view",
      "view.3dAria": "3D structure view",
      "view.structure3d": "Structure 3D view",
      "view.sphere3d": "Sphere 3D view",
      "view.dome3d": "Dome 3D view",
      "view.script3d": "Script 3D view",
      "view.top": "Top view",
      "view.side": "Side view",
      "view.gridAria": "Minecraft build grid",
      "view.sideAria": "Stair side view",
      "legend.stair": "<i class=\"swatch swatch-stair\"></i> Stair block / step",
      "legend.slab": "<i class=\"swatch swatch-slab\"></i> Slab / flat landing",
      "legend.platform": "<i class=\"swatch swatch-platform\"></i> Transition block",
      "legend.core": "<i class=\"swatch swatch-core\"></i> Solid block / pillar",
      "legend.dome": "<i class=\"swatch swatch-dome\"></i> Dome block",
      "legend.script": "<i class=\"swatch swatch-script\"></i> Script block",
      "legend.support": "<i class=\"swatch swatch-support\"></i> Safety fill",
      "legend.empty": "<i class=\"swatch swatch-empty\"></i> Empty cell",
      "future.title": "Upcoming Minecraft services",
      "future.domes.title": "3D monuments",
      "future.domes.description": "Extend 3D generators for monumental builds.",
      "future.bridges.title": "Bridges and roads",
      "future.bridges.description": "Prepare clean paths to connect your builds.",
      "future.exports.title": "Plan exports",
      "future.exports.description": "Export as text or as a construction sequence.",
      "toolHint.circle": "Tip: the diameter controls the outer outline of the shape.",
      "toolHint.sphere": "Tip: use the slider to browse the horizontal layers of the sphere.",
      "toolHint.dome": "Tip: stretch the dome height to get a low half-sphere or a taller shape.",
      "toolHint.porch": "Tip: porch width is automatically adjusted to an odd value to keep clean symmetry.",
      "toolHint.stairs": "Tip: stairs use Minecraft stair blocks and solid support blocks.",
      "toolHint.script": "Tip: text is converted into blocks, then displayed as a plan and in 3D.",
      "toolHint.structures": "Tip: choose a structure to display its title, description and 3D view.",
      "label.layer": "Layer {current} / {total}",
      "label.stretch": "Stretch ×{value}",
      "label.noStructure": "No structure displayed.",
      "label.noStructures": "No structures available.",
      "label.script.thin": "Thin stroke",
      "label.script.medium": "Medium stroke",
      "label.script.thick": "Thick stroke",
      "structure.mine.title": "Mine",
      "structure.mine.description": "Structure imported from the project's mine.glb file.",
      "structure.genericTitle": "Structure",
      "structure.genericDescription": "GLB structure from the site folder.",
      "message.invalidDiameter": "Invalid diameter. Enter an integer between 1 and 256.",
      "message.invalidPorch": "Invalid porch settings. Check width, height, thickness and style.",
      "message.invalidStairs": "Invalid stair settings. Check height, width and type.",
      "message.invalidDome": "Invalid dome settings. Check diameter and stretch.",
      "message.invalidScript": "Invalid script settings. Enter text, size, stroke weight and spacing.",
      "message.noExport": "No structure to export.",
      "message.pngExported": "PNG exported successfully.",
      "message.copyOnlyCircle": "Command copying is available for circles.",
      "message.noCommands": "No command to copy.",
      "message.commandsCopied": "{count} Minecraft commands copied.",
      "renderer.missingThree": "3D view unavailable: Three.js could not be loaded.",
      "renderer.step": "Step {current} / {total}",
      "renderer.dragHelp": "Drag horizontally and vertically to rotate. Use the mouse wheel to zoom.",
      "renderer.loading": "Loading {label}...",
      "renderer.emptyGlb": "The GLB file loaded, but no visible volume was found.",
      "renderer.loaded": "{title} loaded from {url}. Drag horizontally and vertically to rotate. Use the mouse wheel to zoom.",
      "renderer.fileProtocol": "Cannot load GLB over file://. Run node dev-server.cjs, then open http://127.0.0.1:8000/index.html.",
      "renderer.loadError": "Could not load GLB: {detail}"
    },
    labels: {
      tools: { circle: "Circle", sphere: "Sphere", dome: "Dome", porch: "Porch / Monumental entrance", stairs: "Stairs", script: "Script", structures: "Structures" },
      porchStyles: { rounded: "Rounded", pointed: "Pointed", medieval: "Medieval" },
      stairTypes: { straight: "Straight", spiral: "Spiral", curved: "Rounded" },
      directions: { right: "Right", left: "Left" },
      stats: {
        tool: "Tool", diameter: "Diameter", outlineBlocks: "Outline blocks", grid: "Displayed grid",
        topStyle: "Top style", widthHeight: "Width × height", thickness: "Thickness",
        estimatedBlocks: "Estimated blocks", type: "Type", totalHeight: "Total height", width: "Width",
        stairBlocks: "Stair blocks", footprint: "Footprint", slabs: "Landing slabs",
        platforms: "Transition blocks", spiralDirection: "Spiral direction", curvedDirection: "Curve direction",
        layers: "Layers", currentLayer: "Current layer", groundDiameter: "Ground diameter",
        stretch: "Stretch", height: "Height", text: "Text", size: "Size", weight: "Weight",
        spacing: "Spacing", title: "Title", description: "Description", file: "File", engine: "Engine"
      }
    }
  }
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
    this.languageButtons = Array.from(document.querySelectorAll("[data-lang]"));
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
    this.copyCommandsButton = document.getElementById("copy-commands-button");
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
    this.language = this.getInitialLanguage();

    // Initialiser le moteur de rendu 3D
    const domElements = {
      container: this.threeContainer,
      status: this.threeStatus,
      viewTitle: this.threeViewTitle,
      controlsContainer: this.constructionControlsContainer,
      prevButton: this.prevStepButton,
      nextButton: this.nextStepButton,
      stepCounter: this.stepCounter,
      stairsDetails: this.stairsDetails,
      translate: (key, params) => this.t(key, params)
    };
    this.threeRenderer = new MinecraftThreeRenderer(domElements);

    this.bindEvents();
    this.applyTranslations();
    this.renderStructureCatalog();
    this.loadStructureCatalog();
    this.initStructureStream();
    this.renderFutureServices();
    this.syncVisibleControls();
    this.drawCurrentTool();
  }

  getInitialLanguage() {
    const savedLanguage = window.localStorage?.getItem("builder-language");
    if (savedLanguage && LOCALES[savedLanguage]) {
      return savedLanguage;
    }

    const browserLanguage = window.navigator?.language?.slice(0, 2);
    return browserLanguage === "en" ? "en" : "fr";
  }

  t(key, params = {}) {
    const strings = LOCALES[this.language]?.strings || LOCALES.fr.strings;
    const fallback = LOCALES.fr.strings[key] || key;
    const template = strings[key] || fallback;
    return template.replace(/\{(\w+)\}/g, (_, name) => {
      return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : `{${name}}`;
    });
  }

  getLocaleLabel(group, key) {
    return LOCALES[this.language]?.labels?.[group]?.[key]
      || LOCALES.fr.labels[group]?.[key]
      || key;
  }

  getStatLabel(key) {
    return this.getLocaleLabel("stats", key);
  }

  formatBlocks(value) {
    if (this.language === "en") {
      return `${value} block${value === 1 ? "" : "s"}`;
    }
    return `${value} bloc${value > 1 ? "s" : ""}`;
  }

  getStructureTitle(structure) {
    if (!structure) {
      return this.t("structure.genericTitle");
    }
    return structure.titleKey ? this.t(structure.titleKey) : structure.title;
  }

  getStructureDescription(structure) {
    if (!structure) {
      return this.t("structure.genericDescription");
    }
    return structure.descriptionKey ? this.t(structure.descriptionKey) : structure.description;
  }

  applyTranslations() {
    document.documentElement.lang = this.language;
    document.title = this.t("meta.title");
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", this.t("meta.description"));
    }

    for (const element of document.querySelectorAll("[data-i18n]")) {
      element.textContent = this.t(element.dataset.i18n);
    }
    for (const element of document.querySelectorAll("[data-i18n-html]")) {
      element.innerHTML = this.t(element.dataset.i18nHtml);
    }
    for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
      element.setAttribute("aria-label", this.t(element.dataset.i18nAriaLabel));
    }
    for (const element of document.querySelectorAll("[data-i18n-title]")) {
      element.setAttribute("title", this.t(element.dataset.i18nTitle));
    }

    for (const button of this.languageButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.lang === this.language));
    }

    this.updateDomeStretchLabel();
    this.updateScriptWeightLabel();
    this.syncStairTurnControl();
    if (this.toggleSupports3dBtn) {
      this.toggleSupports3dBtn.textContent = this.showSupports3d
        ? this.t("button.hideSupports")
        : this.t("button.showSupports");
    }
  }

  setLanguage(language) {
    if (!LOCALES[language] || language === this.language) {
      return;
    }

    this.language = language;
    window.localStorage?.setItem("builder-language", language);
    this.applyTranslations();
    this.renderStructureCatalog();
    this.renderFutureServices();
    this.syncVisibleControls();
    this.drawCurrentTool();
  }

  bindEvents() {
    for (const button of this.languageButtons) {
      button.addEventListener("click", () => {
        this.setLanguage(button.dataset.lang);
      });
    }

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

    this.copyCommandsButton.addEventListener("click", () => {
      this.copyCircleCommands();
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
      this.toggleSupports3dBtn.textContent = this.showSupports3d
        ? this.t("button.hideSupports")
        : this.t("button.showSupports");
      this.drawCurrentTool();
    });

    this.bindSolidToggle(this.sphereSolidToggle, "sphere", "sphereSolid");
    this.bindSolidToggle(this.domeSolidToggle, "dome", "domeSolid");

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

  bindSolidToggle(toggleElement, toolValue, propertyName) {
    if (!toggleElement) {
      return;
    }
    toggleElement.addEventListener("change", () => {
      this[propertyName] = Boolean(toggleElement.checked);
      if (this.toolSelect && this.toolSelect.value === toolValue) {
        this.drawCurrentTool();
      }
    });
  }

  normalizeValue(rawValue, min, max, parseFn) {
    const parsed = parseFn(rawValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.max(min, Math.min(max, parsed));
  }

  normalizeInteger(rawValue, min, max) {
    return this.normalizeValue(rawValue, min, max, (v) => Number.parseInt(v, 10));
  }

  normalizeNumber(rawValue, min, max) {
    return this.normalizeValue(rawValue, min, max, Number.parseFloat);
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
    this.toolHint.textContent = this.t(TOOL_HINTS[selectedTool] || "");
    if (this.copyCommandsButton) {
      this.copyCommandsButton.hidden = selectedTool !== "circle";
    }
    this.updateDomeStretchLabel();
    this.updateScriptWeightLabel();
    this.syncStairTurnControl();
  }

  syncStairTurnControl() {
    const type = this.stairsTypeInput.value;
    const usesDirection = type === "spiral" || type === "curved";
    this.stairsTurnControl.classList.toggle("hidden", !usesDirection);
    this.stairsTurnInput.disabled = !usesDirection;
    this.stairsTurnLabel.textContent = type === "curved"
      ? this.t("input.curvedDirection")
      : this.t("input.spiralDirection");
  }

  updateDomeStretchLabel() {
    if (!this.domeStretchInput || !this.domeStretchLabel) {
      return;
    }
    const stretch = this.normalizeNumber(this.domeStretchInput.value, 0.5, 3) || 1;
    this.domeStretchLabel.textContent = this.t("label.stretch", { value: stretch.toFixed(1) });
  }

  updateScriptWeightLabel() {
    if (!this.scriptWeightInput || !this.scriptWeightLabel) {
      return;
    }
    const weight = this.normalizeInteger(this.scriptWeightInput.value, 1, 3) || 1;
    const labels = {
      1: this.t("label.script.thin"),
      2: this.t("label.script.medium"),
      3: this.t("label.script.thick")
    };
    this.scriptWeightLabel.textContent = labels[weight] || labels[1];
  }

  renderStructureCatalog() {
    const fragment = document.createDocumentFragment();

    if (this.structureCatalog.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "hint";
      emptyMessage.textContent = this.t("label.noStructures");
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
      title.textContent = this.getStructureTitle(structure);

      const description = document.createElement("span");
      description.className = "structure-card-description";
      description.textContent = this.getStructureDescription(structure);

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
        title: structure.title || structure.fileName || this.t("structure.genericTitle"),
        description: structure.description || this.t("structure.genericDescription"),
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
      this.showMessage(this.t("message.invalidDiameter"));
      return null;
    }

    this.circleInput.value = String(diameter);
    const circle = generateCircleGrid(diameter);

    return {
      cells: circle.cells,
      cols: circle.cols,
      rows: circle.rows,
      stats: [
        [this.getStatLabel("tool"), this.getLocaleLabel("tools", "circle")],
        [this.getStatLabel("diameter"), this.formatBlocks(diameter)],
        [this.getStatLabel("outlineBlocks"), `~${circle.blockCount}`],
        [this.getStatLabel("grid"), `${circle.cols} × ${circle.rows}`]
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
      this.showMessage(this.t("message.invalidPorch"));
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
        [this.getStatLabel("tool"), this.getLocaleLabel("tools", "porch")],
        [this.getStatLabel("topStyle"), this.getLocaleLabel("porchStyles", style)],
        [this.getStatLabel("widthHeight"), `${width} × ${height}`],
        [this.getStatLabel("thickness"), this.formatBlocks(thickness)],
        [this.getStatLabel("estimatedBlocks"), `~${porch.blockCount}`],
        [this.getStatLabel("grid"), `${porch.cols} × ${porch.rows}`]
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
      this.showMessage(this.t("message.invalidStairs"));
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
      [this.getStatLabel("tool"), this.getLocaleLabel("tools", "stairs")],
      [this.getStatLabel("type"), this.getLocaleLabel("stairTypes", type)],
      [this.getStatLabel("totalHeight"), this.formatBlocks(height)],
      [this.getStatLabel("width"), this.formatBlocks(Number(this.stairsWidthInput.value))],
      [this.getStatLabel("stairBlocks"), `${stairs.stairBlockCount}`],
      [this.getStatLabel("footprint"), stairs.footprint],
      [this.getStatLabel("estimatedBlocks"), `~${stairs.blockCount}`],
      [this.getStatLabel("grid"), `${stairs.cols} × ${stairs.rows}`]
    ];

    if (stairs.slabBlockCount > 0) {
      stats.splice(5, 0, [this.getStatLabel("slabs"), `${stairs.slabBlockCount}`]);
    }

    if (stairs.platformBlockCount > 0) {
      stats.splice(5, 0, [this.getStatLabel("platforms"), `${stairs.platformBlockCount}`]);
    }

    if (type === "spiral") {
      stats.splice(2, 0, [this.getStatLabel("spiralDirection"), this.getLocaleLabel("directions", curvedDirection)]);
    } else if (type === "curved") {
      stats.splice(2, 0, [this.getStatLabel("curvedDirection"), this.getLocaleLabel("directions", curvedDirection)]);
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
      this.showMessage(this.t("message.invalidDiameter"));
      return null;
    }

    this.circleInput.value = String(diameter);
    const sphere = generateSphereLayers(diameter, this.sphereSolid);
    this.sphereLayers = sphere.layers;
    this.currentSphereLayerIndex = Math.floor(sphere.layers.length / 2);
    this.initLayerSlider(this.sphereLayerSlider, this.sphereLayerLabel, this.currentSphereLayerIndex, this.sphereLayers);
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
      this.showMessage(this.t("message.invalidDome"));
      return null;
    }

    this.domeDiameterInput.value = String(diameter);
    this.domeStretchInput.value = String(stretch.toFixed(1));
    this.updateDomeStretchLabel();

    const dome = generateDomeLayers(diameter, stretch, this.domeSolid);
    this.domeLayers = dome.layers;
    this.currentDomeLayerIndex = 0;
    this.initLayerSlider(this.domeLayerSlider, this.domeLayerLabel, this.currentDomeLayerIndex, this.domeLayers);
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
      [this.getStatLabel("tool"), this.getLocaleLabel("tools", "sphere")],
      [this.getStatLabel("diameter"), this.formatBlocks(this.sphereStats.diameter)],
      [this.getStatLabel("layers"), `${this.sphereStats.layers}`],
      [this.getStatLabel("currentLayer"), `${this.currentSphereLayerIndex + 1}`],
      [this.getStatLabel("estimatedBlocks"), `~${this.sphereStats.blockCount}`],
      [this.getStatLabel("grid"), `${this.sphereStats.cols} × ${this.sphereStats.rows}`]
    ];
  }

  getDomeStatsRows() {
    if (!this.domeStats) {
      return [];
    }

    return [
      [this.getStatLabel("tool"), this.getLocaleLabel("tools", "dome")],
      [this.getStatLabel("groundDiameter"), this.formatBlocks(this.domeStats.diameter)],
      [this.getStatLabel("stretch"), `×${this.domeStats.stretch.toFixed(1)}`],
      [this.getStatLabel("height"), this.language === "en" ? `${this.domeStats.layers} layers` : `${this.domeStats.layers} couches`],
      [this.getStatLabel("currentLayer"), `${this.currentDomeLayerIndex + 1}`],
      [this.getStatLabel("estimatedBlocks"), `~${this.domeStats.blockCount}`],
      [this.getStatLabel("grid"), `${this.domeStats.cols} × ${this.domeStats.rows}`]
    ];
  }

  buildScriptResult() {
    const text = (this.scriptTextInput.value || "").trim();
    const size = this.normalizeInteger(this.scriptSizeInput.value, 1, 8);
    const weight = this.normalizeInteger(this.scriptWeightInput.value, 1, 3);
    const spacing = this.normalizeInteger(this.scriptSpacingInput.value, 0, 8);

    if (!text || !size || !weight || spacing === null) {
      this.showMessage(this.t("message.invalidScript"));
      return null;
    }

    this.scriptSizeInput.value = String(size);
    this.scriptWeightInput.value = String(weight);
    this.scriptSpacingInput.value = String(spacing);
    this.updateScriptWeightLabel();

    const script = generateScriptGrid(text, size, weight, spacing);
    this.scriptTextInput.value = script.text;

    return {
      cells: script.cells,
      cols: script.cols,
      rows: script.rows,
      blocks3d: script.blocks3d,
      stats: [
        [this.getStatLabel("tool"), this.getLocaleLabel("tools", "script")],
        [this.getStatLabel("text"), script.text],
        [this.getStatLabel("size"), `${size}`],
        [this.getStatLabel("weight"), `${weight}`],
        [this.getStatLabel("spacing"), `${spacing}`],
        [this.getStatLabel("estimatedBlocks"), `~${script.blockCount}`],
        [this.getStatLabel("grid"), script.footprint]
      ]
    };
  }

  buildStructuresResult() {
    const selectedStructure = this.structureCatalog.find((structure) => structure.id === this.selectedStructureId)
      || this.structureCatalog[0]
      || DEFAULT_STRUCTURE_CATALOG[0];
    const title = this.getStructureTitle(selectedStructure);
    const description = this.getStructureDescription(selectedStructure);

    return {
      title,
      description,
      modelUrl: selectedStructure.modelUrl,
      stats: [
        [this.getStatLabel("tool"), this.getLocaleLabel("tools", "structures")],
        [this.getStatLabel("title"), title],
        [this.getStatLabel("description"), description],
        [this.getStatLabel("file"), selectedStructure.fileName],
        [this.getStatLabel("engine"), "Three.js"]
      ]
    };
  }

  drawCurrentTool() {
    const selectedTool = this.toolSelect.value;
    
    this.sphereLayers = null;
    this.sphereStats = null;
    this.domeLayers = null;
    this.domeStats = null;
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
      ? this.t("view.structure3d")
      : isSphere
        ? this.t("view.sphere3d")
        : isDome
          ? this.t("view.dome3d")
          : isScript
            ? this.t("view.script3d")
            : this.t("view.3d");

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

  renderLayer(layers, currentIndex, updateLabelFn, statsRows) {
    if (!layers) {
      return;
    }
    const layer = layers[currentIndex];
    this.currentCells = layer;
    this.renderGrid(layer, layer[0].length);
    this.renderAscii(layer);
    updateLabelFn.call(this);
    this.updateStats(statsRows);
  }

  renderSphereLayer() {
    this.renderLayer(this.sphereLayers, this.currentSphereLayerIndex, this.updateSphereLayerLabel, this.getSphereStatsRows());
  }

  renderDomeLayer() {
    this.renderLayer(this.domeLayers, this.currentDomeLayerIndex, this.updateDomeLayerLabel, this.getDomeStatsRows());
  }

  updateLayerLabel(labelElement, currentIndex, layers) {
    const layerNumber = currentIndex + 1;
    const total = layers ? layers.length : 1;
    labelElement.textContent = this.t("label.layer", { current: layerNumber, total });
  }

  updateSphereLayerLabel() {
    this.updateLayerLabel(this.sphereLayerLabel, this.currentSphereLayerIndex, this.sphereLayers);
  }

  updateDomeLayerLabel() {
    this.updateLayerLabel(this.domeLayerLabel, this.currentDomeLayerIndex, this.domeLayers);
  }

  initLayerSlider(slider, labelElement, currentIndex, layers) {
    slider.max = String(layers.length);
    slider.value = String(currentIndex + 1);
    this.updateLayerLabel(labelElement, currentIndex, layers);
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
    this.resetViews();
  }

  resetViews() {
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
    this.stats.innerHTML = `<div>${this.t("label.noStructure")}</div>`;
    this.resetViews();
    this.currentCells = null;
    this.currentSphereLayerIndex = 0;
    this.currentDomeLayerIndex = 0;
  }

  exportAsPng() {
    if (!this.currentCells || this.currentCells.length === 0) {
      this.exportStatus.textContent = this.t("message.noExport");
      return;
    }

    const canvas = document.createElement('canvas');
    const cellSize = 16;
    canvas.width = this.currentCells[0].length * cellSize;
    canvas.height = this.currentCells.length * cellSize;
    const ctx = canvas.getContext('2d');

    this.currentCells.forEach((row, y) => {
      row.forEach((cell, x) => {
        const kind = getCellKind(cell);
        ctx.fillStyle = CELL_COLORS[kind] || (isBlockCell(cell) ? '#22c55e' : '#0b1020');
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
    this.exportStatus.textContent = this.t("message.pngExported");
  }

  buildCircleCommands() {
    const diameter = this.normalizeInteger(this.circleInput.value, 1, 256);
    if (!diameter) {
      return [];
    }

    const circle = generateCircleGrid(diameter);
    const center = Math.floor((circle.cols - 1) / 2);
    const commands = [];

    for (let z = 0; z < circle.rows; z += 1) {
      for (let x = 0; x < circle.cols; x += 1) {
        if (!isBlockCell(circle.cells[z][x])) {
          continue;
        }
        commands.push(`/setblock ~${x - center} ~ ~${z - center} minecraft:stone`);
      }
    }

    return commands;
  }

  async copyCircleCommands() {
    if (this.toolSelect.value !== "circle") {
      this.exportStatus.textContent = this.t("message.copyOnlyCircle");
      return;
    }

    const commands = this.buildCircleCommands();
    if (commands.length === 0) {
      this.exportStatus.textContent = this.t("message.noCommands");
      return;
    }

    const commandText = commands.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(commandText);
      } else {
        this.copyTextWithFallback(commandText);
      }
      this.exportStatus.textContent = this.t("message.commandsCopied", { count: commands.length });
    } catch (error) {
      this.copyTextWithFallback(commandText);
      this.exportStatus.textContent = this.t("message.commandsCopied", { count: commands.length });
    }
  }

  copyTextWithFallback(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  renderFutureServices() {
    const fragment = document.createDocumentFragment();
    for (const serviceKey of FUTURE_SERVICES) {
      const card = document.createElement("article");
      card.className = "future-card";
      card.innerHTML = `<h3>${this.t(`future.${serviceKey}.title`)}</h3><p>${this.t(`future.${serviceKey}.description`)}</p>`;
      fragment.appendChild(card);
    }
    this.futureServicesContainer.replaceChildren(fragment);
  }
}

new MinecraftBuilderStudio();
