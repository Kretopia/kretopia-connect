# Harmoniser « How this works » avec le mode clair

## Résultat attendu
Toutes les fenêtres de tutoriel ouvertes depuis « How this works » suivent le thème actif : fond clair, texte sombre et contrastes adaptés en Light mode, tout en conservant leur rendu actuel en Dark mode.

## Mise en œuvre
- Retirer le mode sombre forcé du tutoriel partagé utilisé dans l’application.
- Remplacer ses couleurs fixes par les couleurs sémantiques du thème pour la fenêtre, les étapes, icônes, séparateurs et actions.
- Harmoniser aussi le tutoriel partagé de la page publique afin qu’il ne force plus un panneau sombre lorsque le thème clair est actif.
- Conserver l’accent rose Kretopia, les interactions, le clavier, les animations réduites et tous les contenus existants.

## Validation
- Vérifier le typage et les tests ciblés des tutoriels.
- Contrôler visuellement une fenêtre en Light et Dark mode, notamment sur mobile.
