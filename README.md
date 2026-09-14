# Triple Vingt

Marqueur de fléchettes maison : parties de Cricket et 301/501 pour 2 à 4 joueurs, avec historique et statistiques.

## Structure du projet

```
darts-score/
├── index.html          Page principale (structure de l'app)
├── css/
│   └── style.css       Tous les styles (thème clair/sombre inclus)
└── js/
    ├── constants.js     Constantes du jeu (cibles cricket, scores rapides 301/501)
    ├── dom.js           Récupération des références aux éléments du DOM
    ├── state.js         État partagé (partie en cours, onglet actif, saisie en cours...)
    ├── store.js         Couche de persistance (voir ci-dessous)
    ├── cricket.js        Logique et affichage du mode Cricket
    ├── x01.js           Logique et affichage du mode 301/501
    └── app.js           Navigation, formulaire de création de partie, historique, démarrage
```

Aucun outil de build n'est nécessaire : c'est du HTML/CSS/JS pur. Le fichier
`index.html` peut être ouvert directement dans IntelliJ (ou tout autre
éditeur) comme un projet web classique.

## Ouvrir le projet dans IntelliJ

1. `File > Open...` puis sélectionner le dossier `darts-score`.
2. Ouvrir `index.html` et cliquer sur l'icône de navigateur dans la marge
   (ou clic droit → *Open in Browser*) pour le prévisualiser via le petit
   serveur intégré d'IntelliJ.

## À propos de la sauvegarde

Le site a été conçu pour tourner dans un **Claude Artifact**, qui fournit une
petite base de données partagée et synchronisée en temps réel entre tous les
appareils (`window.claude.use('db')` dans `js/store.js`).

- **Ouvert depuis ce dossier local** (double-clic sur `index.html`, ou via le
  serveur d'IntelliJ), cette capacité n'existe pas : l'app le détecte
  automatiquement et bascule en mode « sans sauvegarde » (état gardé en
  mémoire le temps de la session, un bandeau orange le signale). Idéal pour
  lire le code ou tester une partie rapidement.
- **Sur la page publiée** (l'Artifact Claude), les parties et l'historique
  sont sauvegardés et synchronisés entre tous les appareils qui l'ouvrent.
