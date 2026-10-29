# Barber Prestige — site vitrine

Site one-page pour **Barber Prestige**, salon de barbier au 3 Place Dupont-de-l'Eure, 27000 Évreux.
HTML / CSS / JS natifs, aucune dépendance ni étape de build.

```
index.html    contenu + SEO (meta, Open Graph, schema.org HairSalon)
styles.css    design, animations, responsive
script.js     interactions (scroll, curseur, horaires en direct, menu, carte)
favicon.svg
```

## Aperçu local

```bash
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Sections

1. **Hero** : titre animé lettre par lettre, enseigne de barbier animée, halo qui suit la souris, statut « Ouvert / Fermé » en direct (heure de Paris).
2. **Le salon** : texte révélé mot par mot, compteurs animés (4,9 / 113 avis / 6j sur 7 / 10h–20h).
3. **Prestations** : les 7 prestations Google (dégradé, ciseaux, rasoir, militaire, bouclés, coupe longue, coloration). Sur desktop, section épinglée avec défilement horizontal piloté par le scroll ; sur mobile, carrousel natif avec scroll-snap.
4. **Avis** : note Google 4,9 / 113 avis, liens vers les avis Google.
5. **Infos** : adresse, téléphones, Instagram / TikTok, horaires (jour courant surligné), carte Google chargée au clic (RGPD).
6. **Footer** et barre d'action fixe sur mobile (Appeler / Itinéraire).

## Fluidité (120 fps)

- Les animations ne modifient que `transform` et `opacity`, des propriétés traitées par le compositeur GPU.
- Les effets liés au scroll (défilement horizontal, barre de progression, parallaxe) utilisent les **scroll-driven animations CSS** quand le navigateur les supporte. Ils s'exécutent hors du thread principal, avec un repli JS sinon.
- Côté JS, une seule boucle `requestAnimationFrame` gère tout. Elle se met en veille quand rien ne bouge, et ses interpolations ne dépendent pas de la fréquence d'affichage (60, 120 ou 144 Hz).
- Les mesures de layout sont mises en cache au redimensionnement. Aucune lecture/écriture n'alterne dans une même frame.
- `prefers-reduced-motion` est respecté : pas d'intro, pas de défilement horizontal, animations coupées.

## À compléter avant la mise en ligne

- **Tarifs** : ajouter `<span class="svc__price">25 €</span>` juste avant `.svc__tag` dans chaque carte.
- **Mentions légales** (obligatoires en France) : raison sociale, SIRET, hébergeur, etc.
- **Photos du salon** : à intégrer si souhaité (aucune photo réelle n'était disponible).
- Vérifier les horaires (`HOURS` dans `script.js` + tableau dans `index.html`) et les numéros de téléphone.

## Déploiement

Le site est 100 % statique et se déploie sur n'importe quel hébergeur (GitHub Pages, Netlify, Vercel, OVH…), en copiant les fichiers à la racine.
