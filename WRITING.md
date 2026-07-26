# Guide de rédaction

Les articles du site sont écrits en Markdown et enregistrés dans `src/content/posts/`.
Le nom de chaque fichier commence par la date de publication : `AAAA-MM-JJ-slug.md`.

## 1. Créer un brouillon

Depuis la racine du projet :

```sh
node scripts/create-post.mjs "Titre de l’article"
```

La commande crée un fichier avec `draft: true`. Ouvrez ce fichier et remplacez le texte de présentation.

## 2. Vérifier les informations au début du fichier

```yaml
---
title: "Titre de l’article"
slug: "titre-de-larticle"
publishedAt: 2026-07-25
author: "Théophile"
categories: ["Bible", "Exégèse"]
tags: []
draft: true
---
```

Gardez `draft: true` pendant la rédaction. Remplacez-le par `draft: false` seulement quand l’article est prêt à être publié.

## 3. Écrire en Markdown

```md
## Un sous-titre

Un paragraphe avec du **gras**, de l’_italique_ et [un lien](https://example.com).

> Une citation importante.

- Un point
- Un autre point
```

Le titre principal est généré automatiquement à partir de `title`. Commencez donc généralement le texte avec un paragraphe ou un titre `##`.

## 4. Ajouter une référence

Placez l’appel de note dans le texte :

```md
Cette affirmation mérite une source.[^1]
```

Ajoutez ensuite la référence, de préférence à la fin de l’article :

```md
[^1]: Nom de l’auteur, _Titre du livre_, éditeur, année, p. 42.
```

Le site affiche automatiquement la section **Références** en français. Pour une référence longue, utilisez un lien Markdown et conservez une formulation lisible. Chaque numéro doit être unique dans l’article.

## 5. Vérifier l’article

Lancez le site localement :

```sh
npm run dev
```

Puis vérifiez le contenu avant de le proposer :

```sh
npm run check
npm test
npm run build
```

Avant publication, relisez particulièrement le titre, la date, les liens, les références, les images et les fautes de français. N’utilisez jamais `draft: false` pour un article qui contient encore des informations privées ou incomplètes.
