# Minecraft Circle Builder
Petit site web pour aider à construire des structures Minecraft en vue de dessus (grille de blocs carrés).
## Fonctionnalités actuelles
- Sélecteur d'outil (cercle, sphère, porche/entrée monumentale ou escalier)
- Génération de cercle à partir d'un diamètre (1 à 256 blocs)
- Génération de sphère par couches à partir d'un diamètre, avec aperçu 3D zoomable
- Génération de porche/entrée monumentale (largeur, hauteur, style du haut)
- Styles de sommet pour porche : arrondi, en pointe, médiéval
- Génération d'escalier tout droit, en colimaçon ou arrondi (hauteur totale, largeur)
- Sens gauche/droite pour les escaliers arrondis et en colimaçon
- Escaliers basés sur des dalles Minecraft : 2 dalles = 1 bloc de hauteur
- Supports de sécurité en bordure des dalles, visibles en bleu, pour garder un passage sous l'escalier
- Vue de dessus, vue de côté et aperçu 3D zoomable pour les escaliers
- Affichage visuel + aperçu texte
- Base d'interface prévue pour accueillir d'autres services Minecraft
## Lancement
Ouvre simplement `index.html` dans ton navigateur.
La vue 3D utilise une copie locale de Three.js dans `vendor/three.min.js`.
## Structure
- `index.html` : interface
- `styles.css` : style et mise en page
- `app.js` : logique de génération et rendu des structures
- `vendor/three.min.js` : moteur 3D utilisé pour l'aperçu des escaliers
## Idées d'évolution
- Export image ou plan de construction
- Gestion de formes avancées (arcs, ellipses, routes, ponts)
