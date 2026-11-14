---
translation_of: src/content/synced/guides/releases.md
source_hash: "da88fe8820aab409"
title: "Les releases de Barrel"
description: "Barrel est publié sous forme de bundle : un instantané daté de tout le dépôt, produit chaque fois que des applications changent de version et sont publiées, où chaque application est à la version qu’elle porte à ce commit."
source: "docs/guides/releases.md"
---

Barrel est publié sous forme de bundle : un instantané daté de tout le dépôt,
produit chaque fois que des applications changent de version et sont publiées,
où chaque application est à la version qu’elle porte à ce commit. Lisez cette
page quand vous voulez savoir quelles versions d’applications vont ensemble,
déployer barrel_server depuis une release, ou épingler une dépendance sur un
état connu.

## Ce qu’est un bundle

Une fusion dans `main` qui passe la CI et change la version d’au moins une
application est un bundle nommé `YYYY.MM.N` : l’année et le mois de la fusion,
et N qui compte les bundles du mois à partir de 0 (`2026.11.0`, `2026.11.1`,
...). Plusieurs bundles peuvent sortir le même jour. Une fusion qui ne change
la version d’aucune application ne publie rien.

Chaque bundle a un tag git `vYYYY.MM.N` et une release GitHub qui contient :

- la version de chaque application à ce commit, et la section du CHANGELOG de
  chaque application dont la version a changé depuis le bundle précédent ;
- des archives tar de `barrel_server` pour Linux x64, Linux arm64 et macOS
  arm64 ;
- l’image `barrel-server`, `ghcr.io/barrel-db/barrel-server:YYYY.MM.N`.

Les applications ne sont pas taguées séparément. Chaque application est
publiée sur Hex sous sa propre version, que les notes du bundle enregistrent.

## Trouver les versions des applications d’un bundle

```sh
gh release view v2026.11.8 --repo barrel-db/barrel
```

Ou depuis un clone :

```sh
git show v2026.11.8:apps/barrel_docdb/src/barrel_docdb.app.src | grep vsn
```

## Lancer le barrel_server d’un bundle

L’archive tar contient son propre runtime Erlang :

```sh
gh release download v2026.11.9 --repo barrel-db/barrel -p 'barrel_server-2026.11.9-linux-x64.tar.gz'
mkdir barrel && tar xzf barrel_server-2026.11.9-linux-x64.tar.gz -C barrel
barrel/bin/barrel_server foreground
```

Ou l’image :

```sh
docker run -p 8080:8080 -e BARREL_AUTH_TOKENS=secret ghcr.io/barrel-db/barrel-server:2026.11.9
```

`barrel/bin/barrel_server versions` et le label
`org.opencontainers.image.version` de l’image donnent le bundle.

## Épingler un bundle

Pour les bibliothèques, dépendez des versions Hex. Pour construire contre un
état exact du dépôt, utilisez le tag du bundle :

```erlang
{deps, [
    {barrel, {git, "https://github.com/barrel-db/barrel.git", {tag, "v2026.11.8"}}}
]}.
```

## Notes

- `:latest` suit le bundle le plus récent ; épinglez un tag de bundle en
  production.
- Triez les bundles avec un tri qui comprend les versions (`sort -V`,
  `git tag --sort=v:refname`) : au-delà de dix bundles dans un mois,
  `2026.11.10` se classe avant `2026.11.9` par ordre alphabétique.
- Les bundles antérieurs au workflow de release ont été créés après coup aux
  commits qui changeaient la version d’une application vers une version
  publiée sur Hex ; ils ont des notes, mais ni archive tar ni image.
- Les tags `v0.2.0` à `v1.1.0` sont antérieurs aux bundles et restent tels
  quels.
