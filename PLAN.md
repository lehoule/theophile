# Migration de Théophile vers Astro et Cloudflare

## Résumé

Construire une plateforme personnalisée avec Astro et TypeScript, déployée comme site statique et Worker sur Cloudflare. Les articles resteront en Markdown dans un dépôt GitHub public. Les commentaires seront entièrement développés dans le projet avec Cloudflare Workers, D1 et Turnstile—sans Cusdis, Hyvor ou serveur permanent.

Coût prévu :

- Site, API et commentaires : 0 $ aux volumes actuels. Workers offre 100 000 requêtes/jour; D1 offre 5 millions de lignes lues, 100 000 écrites par jour et 5 Go de stockage. [Tarification Workers et D1](https://developers.cloudflare.com/workers/platform/pricing/).
- Protection antibot : Turnstile gratuit avec vérifications illimitées. [Offre Turnstile](https://developers.cloudflare.com/turnstile/plans/).
- Courriels de modération vers une adresse vérifiée : gratuits. [Cloudflare Email Service](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/).
- Médias : probablement 0 $ dans les 10 Go gratuits de R2. [Tarification R2](https://developers.cloudflare.com/r2/pricing/).
- Domaine : renouvellement maintenu chez WHC; l’hébergement WordPress sera annulé après validation.

## Site et contenu

- Créer un site Astro statique, TypeScript strict, avec CSS natif et une identité éditoriale savante : typographie de lecture auto-hébergée, palette crème/encre/bordeaux et présentation soignée des citations et notes.
- Servir le build Astro avec Cloudflare Workers Static Assets; seules les routes `/api/*` exécutent le Worker, tandis que les fichiers statiques restent gratuits et illimités.
- Fournir `/`, `/blog/`, `/blog/page/[n]/`, `/YYYY/MM/[slug]/`, `/category/[slug]/`, `/videos/`, `/a-propos/`, `/recherche/`, `/cookie-policy/`, `/rss.xml`, sitemap, `robots.txt` et 404.
- Conserver les URL historiques et ajouter des redirections 301 pour `/feed/`, les archives d’auteur, les pièces jointes et toute route WordPress remplacée.
- Utiliser Pagefind pour la recherche statique française, Cloudflare Web Analytics sans cookies, ainsi que les métadonnées canonical, Open Graph et `BlogPosting`.
- Définir une collection de contenu validée avec `title`, `slug`, `publishedAt`, `updatedAt`, `excerpt`, `author`, `categories`, `tags`, `featuredMedia`, `commentId`, `legacyWordPressId`, `draft` et SEO facultatif.
- Conserver les articles en Markdown sans HTML ni JSX. Les notes utilisent `[^n]`; les liens MP3 et vidéo autonomes sont transformés en lecteurs accessibles par le moteur de rendu.
- Héberger les médias sur `media.theophile.xyz` dans R2, avec transformations responsives et manifeste typé contenant clé, MIME, dimensions, texte alternatif, légende et checksum.
- Le dépôt GitHub constitue le CMS : commandes locales de création, aperçu, validation et publication. Les brouillons privés ne sont jamais poussés puisque le dépôt est public.

## Système de commentaires Cloudflare

- Intégrer un composant TypeScript léger chargé lorsque la section commentaires approche de l’écran. Aucun script tiers n’est chargé en dehors de Turnstile.
- Le formulaire accepte un nom de 2–80 caractères, une adresse courriel facultative et un commentaire en texte brut de 2–5 000 caractères. Le rendu échappe toujours le HTML et transforme seulement les URL valides en liens `nofollow ugc`.
- Tous les nouveaux commentaires sont créés avec le statut `pending`; ils ne deviennent visibles qu’après approbation.
- Valider Turnstile côté Worker, comme l’exige Cloudflare, puis appliquer : contrôle d’origine, champ piège, maximum de trois liens, détection de doublons, trois soumissions par tranche de quinze minutes et dix par jour pour un même hash IP. [Validation serveur Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- Ne jamais conserver l’adresse IP brute. Utiliser un HMAC avec secret Worker pour la limitation, puis supprimer les entrées temporaires après 24 heures.
- Modéliser D1 avec :
  - `comments` : identifiant UUID, `post_id`, parent facultatif, identifiant WordPress facultatif, nom, courriel privé facultatif, corps texte, statut, source et dates;
  - `moderation_events` : commentaire, action, administrateur et date;
  - `rate_limits` : hash IP, fenêtre et compteur.
- Générer pendant le build un registre des articles commentables. Le Worker refuse toute soumission visant un identifiant absent de ce registre.
- Exposer :
  - `GET /api/comments?postId=&cursor=` pour les commentaires approuvés;
  - `GET /api/comments/counts?postIds=` pour les compteurs;
  - `POST /api/comments` pour une soumission, avec réponse `202 Pending`;
  - `GET /api/admin/comments?status=&cursor=`;
  - `PATCH /api/admin/comments/:id` pour approuver ou classer comme indésirable;
  - `POST /api/admin/comments/:id/replies` pour répondre comme auteur;
  - `DELETE /api/admin/comments/:id`, qui anonymise un commentaire ayant des réponses ou supprime une feuille.
- Ne jamais retourner les courriels, hashes IP ou données de modération dans l’API publique.
- Protéger `/admin/comments/*` et `/api/admin/*` avec Cloudflare Access limité à l’adresse du propriétaire; vérifier également le JWT Access dans le Worker. Le plan Access est gratuit pour moins de 50 utilisateurs. [Cloudflare Zero Trust](https://www.cloudflare.com/plans/zero-trust-services/).
- Fournir un tableau de modération mobile avec filtres, aperçu, approbation, réponse, indésirable, suppression et actions groupées.
- Envoyer au propriétaire un courriel pour chaque commentaire en attente avec l’article, l’auteur, un extrait et un lien vers le tableau protégé. La création du commentaire réussit même si l’envoi du courriel échoue.
- Ne pas envoyer de notification automatique aux commentateurs dans la première version; l’adresse facultative demeure privée et permet une réponse personnelle.
- Mettre à jour la politique de confidentialité pour documenter Cloudflare, Turnstile, les données facultatives, la durée de conservation et la procédure de suppression.

## Migration et déploiement

- Utiliser un export WXR complet et le dossier `wp-content/uploads` obtenu depuis WHC.
- Convertir les 250 articles et 5 pages en Markdown pur, en conservant dates, slugs, taxonomies, notes, liens et médias.
- Inventorier les 473 médias, ignorer seulement les variantes WordPress générées, téléverser les originaux dans R2 et réécrire toutes les références.
- Importer les 366 commentaires approuvés dans D1 avec leurs auteurs, dates, relations parent-enfant et identifiants d’articles. Convertir leur HTML historique en texte sûr avec liens explicites.
- Utiliser l’identifiant WordPress comme `commentId` pour les articles importés et générer un UUID stable pour les nouveaux articles.
- Désactiver les notifications et contrôles de débit pendant l’import, puis produire un rapport avec totaux, commentaires orphelins, médias manquants, shortcodes inconnus et liens cassés.
- Versionner les migrations SQL D1 et rendre l’import idempotent grâce aux identifiants WordPress uniques.
- Utiliser Time Travel D1 pour les restaurations récentes; le plan gratuit conserve sept jours d’historique. Ajouter une exportation mensuelle vers un bucket R2 privé pour les sauvegardes durables. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
- Déployer d’abord sur une URL de prévisualisation, effectuer une dernière exportation après un court gel éditorial, puis transférer les serveurs DNS de WHC vers Cloudflare.
- Garder WordPress disponible en lecture seule pendant 14 jours avant d’annuler uniquement l’hébergement WHC.

## Tests et critères d’acceptation

- Vérifier le schéma Markdown, la génération des routes, les convertisseurs, médias, notes et lecteurs audio/vidéo.
- Comparer l’export et le résultat : 250 articles, 5 pages, 158 catégories, 473 médias inventoriés et 366 commentaires approuvés; toute différence inexpliquée bloque la bascule.
- Explorer toutes les URL WordPress et exiger une réponse 200 ou une seule redirection 301 vers une page valide.
- Tester l’API contre les origines étrangères, faux jetons Turnstile, rejeu de jeton, dépassement des limites, doublons, identifiants d’articles inconnus et charges invalides.
- Tester les tentatives XSS, liens dangereux, Unicode, commentaires vides ou trop longs et vérifier qu’aucun courriel ou hash IP n’apparaît publiquement.
- Tester le parcours complet : soumission → invisible publiquement → courriel au propriétaire → approbation protégée → affichage → réponse administrateur.
- Vérifier que Cloudflare Access refuse le tableau et les API administratives aux visiteurs non autorisés.
- Tester l’import WordPress, les relations imbriquées, l’idempotence, l’export R2 et une restauration D1 en environnement de test.
- Exécuter en CI les tests unitaires, TypeScript, build Astro, Pagefind, vérification de liens, Playwright mobile/ordinateur et audits d’accessibilité.
- Exiger avant bascule : zéro lien interne cassé, zéro fuite de données privées, recherche française fonctionnelle, commentaires historiques visibles, modération opérationnelle et scores Lighthouse d’au moins 90 en performance et 95 en accessibilité/SEO.
