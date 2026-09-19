# Correctif du 404 des suggestions d’onboarding

## Objectif
Empêcher l’appel au service de suggestions tant que le profil authentifié n’existe pas, afin qu’un compte en cours de création ne puisse plus provoquer un écran vide.

## Modifications
- Dans Today, charger d’abord le profil puis appeler les suggestions uniquement si une ligne de profil existe.
- Dans l’étape de suggestions de l’onboarding, vérifier ou créer le profil minimal avant l’appel au service.
- Traiter explicitement une réponse « Profile not found » comme un état vide récupérable, sans exception globale ni écran blanc.
- Conserver la correction déjà présente dans le service pour le futur backend migré.

## Vérification
- Vérifier qu’aucun appel au service n’est émis avant la présence du profil.
- Tester le cas profil absent et le cas profil existant.
- Exécuter la vérification TypeScript et les tests ciblés, puis contrôler l’aperçu.

## Hors périmètre
- Aucun changement DNS, domaine, migration, paiement ou fichier de verrouillage.
- Aucune bascule vers le nouveau backend vide.
