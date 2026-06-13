# GATES OF TOM — Feuille de route

État actuel : ✅ moteur math calibré (RTP ≈ 96 %) + ✅ client jouable (jetons virtuels).
Légende : 🤖 = je peux le faire ici · 🧑 = à faire par toi / un prestataire externe.

---

## Phase 1 — Finaliser le jeu (produit jouable soigné)

Objectif : passer du prototype à une démo de qualité « vitrine ».

1. **Assets graphiques originaux** 🤖🧑
   - Générer les 9 symboles, le scatter (Zeus dément), les orbes multiplicateurs, le fond Mad Olympus, le cadre.
   - Remplacer les placeholders emoji/CSS par ces images.
   - ⚠️ 100 % originaux (pas les visuels de Gates of Olympus).
2. **Son & musique** 🤖
   - Effets : spin, cascade, gain, orbe, déclenchement free spins, gros gain.
   - Boucle musicale ambiance + montée pendant les free spins.
3. **Polish des animations** 🤖
   - Écran « BIG / MEGA / INSANE WIN » avec comptage.
   - Anticipation quand 3 scatters sont à l'écran.
   - Transition spectaculaire vers les free spins.
4. **Fonctionnalités de jeu** 🤖
   - Ante bet (mise +25 % pour doubler la chance de free spins).
   - Bonus buy (acheter les free spins, ~100× la mise).
   - Autoplay, table des gains in-game, réglages (son, vitesse).
5. **Ergonomie & responsive** 🤖
   - Mobile (portrait + paysage), tablette, desktop.
   - Écran de chargement, solde de démo persistant (localStorage).

---

## Phase 2 — Architecture « production » (indispensable pour le B2B)

Objectif : une math inviolable et une vraie séparation client / serveur.

6. **Séparer math et présentation proprement** 🤖
   - Le client ne doit jamais décider du résultat : il l'affiche seulement.
7. **RGS — Remote Gaming Server** 🤖🧑
   - Serveur qui génère les résultats (RNG côté serveur, *server-authoritative*).
   - API de spin standardisée (requête mise → réponse résultat + animation).
8. **Comptes & soldes côté serveur** 🧑
   - Persistance, sessions, historique des parties (exigé en régulé).
9. **Anti-triche & journalisation** 🤖🧑
   - Logs de chaque spin, contrôle d'intégrité, rejouabilité (seed/audit).
10. **Tests math industriels** 🤖
    - Suite de tests unitaires + simulation **50–100 M spins** (en code rapide) pour figer RTP, volatilité, hit-rate, distribution.

---

## Phase 3 — Conformité & certification

Objectif : pouvoir être vendu légalement à des opérateurs.

11. **PAR sheet complète** 🤖🧑
    - Document math exhaustif (tous les tableaux, probabilités, RTP, max win).
12. **Choix de la/les juridiction(s)** 🧑
    - Ex. Malte (MGA), Curaçao… définit les règles à respecter.
13. **Certification par un labo agréé** 🧑
    - GLI / eCOGRA / BMM : test du RNG et du RTP (norme type GLI-19).
14. **Licence fournisseur B2B** 🧑
    - Agrément de fournisseur de jeux selon la juridiction visée.
15. **Jeu responsable & obligations réglementaires** 🤖🧑
    - Limites, messages RG, logs réglementaires, outils opérateur.

---

## Phase 4 — Distribution & mise en marché

Objectif : brancher le jeu chez les casinos et le vendre.

16. **Intégration opérateurs** 🤖🧑
    - Soit via un **agrégateur** (SoftSwiss, EveryMatrix…), soit API directe.
    - Adapter au protocole d'intégration de chaque plateforme.
17. **Multi-devises / multi-langues** 🤖
18. **Kit commercial** 🤖
    - Fiche produit, chiffres clés (RTP, volatilité, max win), démo en ligne, vidéo.
19. **Modèle économique** 🧑
    - Revenue share (souvent 10–15 % du GGR) ou licence fixe — à négocier.

---

## Phase 5 — Cadre légal & société (transverse, à lancer tôt)

20. **Structure juridique** 🧑 — société, là où la licence B2B est possible.
21. **Marque & PI** 🧑 — protéger « Gates of Tom » et les assets originaux.
22. **Contrats de licence** 🧑 — avec les opérateurs / agrégateurs (avocat spécialisé jeux).

---

## Ordre conseillé / prochaine étape immédiate

La prochaine étape qui apporte le plus de valeur visible : **Phase 1 — assets graphiques + son + ante bet/bonus buy**, pour avoir une démo qui « claque » et que tu peux montrer.
En parallèle, **commencer tôt** la Phase 5 (juridique) car licence + certification sont longues.

> Ce que je ne peux pas faire : délivrer une licence, certifier le RNG, ou monter la structure juridique — ce sont des organismes/avocats externes. Je peux préparer tout le reste (jeu, math, doc, intégration, kit commercial).
