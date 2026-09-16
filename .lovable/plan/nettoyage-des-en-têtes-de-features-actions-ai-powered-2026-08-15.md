# Nettoyage des en-têtes de features + actions "AI Powered"

## Objectif
Sous le bouton "How this works", plus aucun bouton parasite. Chaque action importante est déplacée à un endroit logique de la page et repensée en surface "AI Powered". Match gagne une 3e tab et un vrai deck façon Tinder/Bumble au centre. Kreto répond directement dans la page.

## 1. En-têtes de features — suppression des éléments parasites
Le bloc parasite est le slot `meta` du composant partagé `FeaturePageHeader`, rendu juste sous "How this works".

- Le slot `meta` n'est plus rendu dans l'en-tête (l'en-tête garde eyebrow, titre, sous-titre, "How this works", et éventuellement les tabs).
- Toutes les pages qui passaient `meta` sont mises à jour pour placer ces actions dans le corps de la page :
  - Clients : "New client" (voir §5)
  - Meetup/Events : "Host Event" + "Manage" (voir §2)
  - Circle/Stages : icône personne / invitation (voir §4)
  - Recordings, Subscription, Founding Member, Creative Circle, WorkHome : badge ou bouton déplacé en haut du contenu, dans une barre d'action discrète alignée à droite.

## 2. Meetup — "Host Event" au centre de l'attention, en mode AI
- Retiré de l'en-tête.
- Nouvelle carte pleine largeur en haut du contenu (au-dessus des tabs Discover/This Week/…) : bandeau accent avec avatar Kreto, titre "Host an event", champ unique "Describe your event — Kreto builds it" (ex : "Photo meetup à Port of Spain samedi soir, 30 places, gratuit").
- Le texte saisi ouvre la modale de création déjà existante, pré-remplie ; un bouton secondaire "Start from scratch" ouvre la modale vide (comportement actuel intact).
- "Manage (n)" devient un lien texte discret dans le coin de cette carte.

## 3. Match — 3e tab + deck Tinder/Bumble centré
- Tabs : **Swipe · Browse · Likes you** (la 3e liste les créateurs qui vous ont déjà liké et attendent votre réponse — c'est la tab qui manque pour boucler la boucle Tinder/Bumble). Si aucune donnée, état vide clair, aucun chiffre inventé.
- Le deck Swipe est recentré : carte unique au centre, largeur max ~420px, deux cartes empilées derrière pour la profondeur.
- Swipe droite = like, gauche = pass, avec suivi du doigt/souris, rotation, badges "LIKE"/"NOPE" qui apparaissent selon la direction, et animation d'envoi hors écran. Les boutons ronds (X / cœur / undo) restent sous la carte.
- La logique de swipe (`recordSwipe`, matchs, undo) reste celle existante — uniquement présentation et gestes.

## 4. Circle / Stages
- "Match · Browse · Network" quittent l'en-tête et deviennent un segmenteur centré au milieu de la page, au-dessus du contenu Sound Stages.
- L'icône personne (invitation) est retirée de l'en-tête et devient une carte "Grow your circle" en bas de page : Kreto suggère qui inviter à partir de vos collaborations, plus un bouton "Invite creators" qui ouvre la modale existante.

## 5. Clients — "New client" en mode AI
- Retiré de l'en-tête.
- En haut de la liste : carte d'ajout intelligente — un champ unique "Paste an email signature, a brief, or just a name". Kreto extrait nom, société, email, téléphone et pré-remplit le formulaire existant pour validation.
- Bouton "Add manually" secondaire à côté (ouvre le formulaire vide). L'état vide de la liste pointe vers cette même carte.

## 6. Kreto — chat direct dans la page
- Sur `/kreto`, le bouton "Ask Kreto anything…" est remplacé par un vrai composer + fil de conversation dans la page : on tape, on envoie, la réponse s'affiche en streaming sur place. Plus d'ouverture automatique du tiroir Kreto à l'arrivée.
- Réutilise exactement le même moteur que la bulle (streaming `thrive-ai-chat`), donc mêmes capacités, mêmes limites par palier, aucun nouveau backend.
- Les quick actions envoient leur prompt dans ce fil au lieu d'ouvrir le tiroir. Le tiroir Kreto reste disponible partout ailleurs.

## Détails techniques
- `FeaturePageHeader` : prop `meta` supprimée du rendu et de l'interface ; tous les appelants nettoyés.
- Match : nouvelle valeur de mode `"likes"`, données issues des swipes entrants existants (aucune nouvelle table).
- Swipe : gestes de drag renforcés dans `SwipeStack`/`HingeStyleCard`, pas de nouvelle dépendance.
- Kreto in-page : extraction du fil de messages en composant réutilisable partagé avec `ThriveAgentFab` afin de ne pas dupliquer la logique de streaming et d'actions.
- Extraction client (Clients) et parsing d'événement (Meetup) passent par une edge function légère basée sur Gemini Flash ; en cas d'échec, on retombe simplement sur le formulaire vide.
