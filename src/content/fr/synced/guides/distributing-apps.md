---
translation_of: src/content/synced/guides/distributing-apps.md
source_hash: "ed212f77e47774be"
title: "Distribuer les applications de l’umbrella"
description: "L’umbrella est la source de vérité : vous développez toutes les applications dans un seul arbre pour que les changements entre applications restent atomiques. Ce guide sert quand vous devez remettre une application seule à quelqu’un en dehors de l’umbrella. Il y a trois façons de faire, cumulables : publier sur Hex, maintenir un miroir git par application, et consommer une application depuis un autre projet."
source: "docs/guides/distributing-apps.md"
---

L’umbrella est la source de vérité : vous développez toutes les applications
dans un seul arbre pour que les changements entre applications restent
atomiques. Ce guide sert quand vous devez remettre une application seule à
quelqu’un en dehors de l’umbrella. Il y a trois façons de faire, et vous
pouvez les utiliser toutes à la fois : publier sur Hex (un paquet versionné),
maintenir un miroir git par application (un dépôt autonome consultable), et
consommer une application depuis un autre projet. Lisez ce guide avant de
préparer une release ou de brancher une dépendance en aval.

## Prérequis

Avant de publier une application :

- Augmentez son `vsn` dans `apps/<app>/src/<app>.app.src` (Hex refuse
  d’écraser une version publiée), et augmentez au même pas les versions
  épinglées couplées dans les `deps` par défaut des applications qui en
  dépendent (par exemple, augmenter `barrel_vectordb` signifie mettre à jour
  l’épinglage `{barrel_vectordb, ...}` dans `barrel`).
- Vérifiez que l’application a un `README.md`, une `LICENSE`, un
  `CHANGELOG.md`, un bloc `ex_doc`, et `{rebar3_hex, "7.2.0"}` dans ses
  `project_plugins` (voir la note sur le plugin plus bas).
- Taguez la release : par application `<app>-v<version>` (par exemple
  `barrel_docdb-v1.0.0`), et pour l’umbrella `v<version>`. La CI reconnaît
  les deux motifs de tags.

## Ordre de publication

Les applications dépendent les unes des autres : publiez d’abord les feuilles
et remontez. Un paquet ne peut être publié qu’une fois que chaque application
sœur dont il dépend est déjà sur Hex. L’ordre, avec la version que porte
chaque application dans l’arbre :

| # | Application | Version | Dépend de |
|---|---|---|---|
| 1 | `barrel_crypto` | 1.0.0 | |
| 2 | `barrel_embed` | 2.5.0 | |
| 3 | `barrel_docdb` | 1.7.0 | barrel_crypto |
| 4 | `barrel_rerank` | 1.0.2 | |
| 5 | `barrel_faiss` | 1.0.1 | (optionnel ; la bibliothèque C++ FAISS pour le build) |
| 6 | `barrel_vectordb` | 2.5.0 | barrel_embed, barrel_crypto |
| 7 | `barrel_ngram` | 0.11.1 | barrel_docdb |
| 8 | `barrel_att_s3` | 0.1.1 | barrel_docdb |
| 9 | `barrel` | 1.10.0 | barrel_crypto, barrel_docdb, barrel_vectordb, barrel_embed |
| 10 | `barrel_spaces` | 1.2.2 | barrel, barrel_docdb, barrel_crypto |
| 11 | `barrel_server` | 1.10.0 | barrel, barrel_spaces, barrel_ngram |

Ne publiez que les applications dont la version n’est pas encore sur Hex
(`curl -s https://hex.pm/api/packages/<app>` affiche la dernière), dans cet
ordre. `barrel_vectordb` et `barrel_embed` gardent leurs lignes 2.x ; les
autres applications 1.x s’engagent à ne pas casser leur API sans
changement de version majeure.

## Publier sur Hex

Chaque application publiable déclare ses applications sœurs comme
dépendances Hex dans les `{deps, [...]}` **par défaut** de son
`rebar.config`. Ce n’est ni optionnel ni cosmétique : rebar3_hex construit
les `requirements` du paquet à partir du lockfile du profil par défaut, donc
une dépendance placée dans un profil `hex` (ou n’importe quel autre) est
retirée du tarball sans avertissement. Le paquet se publie et s’installe
alors sans erreur, et le consommateur tombe sur un `undef` à l’exécution. Ne
mettez pas les dépendances sœurs dans un profil `hex`.

Par exemple `apps/barrel_spaces/rebar.config` :

```erlang
{deps, [
    {barrel_crypto, "~> 1.0"},
    {barrel_docdb, "~> 2.0"},
    {barrel, "~> 1.3"}
]}.
```

Dans l’umbrella, elles se résolvent comme applications locales du projet ;
sur Hex, elles se résolvent depuis Hex. Utilisez des épinglages `~>` pour
qu’une release de correctif d’une application sœur n’impose pas de republier
chaque application qui en dépend.

```console
$ cd apps/barrel_embed
$ rebar3 hex publish
```

Publiez dans l’ordre des dépendances, par exemple les applications d’une
release :

```console
$ for app in barrel_ngram barrel barrel_server; do
    (cd apps/$app && rebar3 hex publish --yes)
  done
```

Le plugin Hex est épinglé à `{rebar3_hex, "7.2.0"}` dans chaque
`rebar.config`. rebar3_hex 7.3.0 avec hex_core 0.19.0 plante à la
publication (un `badmatch` sur `cli_auth_callbacks` dans
`hex_cli_auth:call_callback`). 7.2.0 résout hex_core 0.18.0 ; vérifiez avec
`ls _build/default/plugins` après un build, et gardez l’épinglage jusqu’à la
sortie d’une version corrigée.

Avant de publier, faites un essai à blanc de chaque tarball avec
`rebar3 hex build` et vérifiez son contenu (en particulier pour les
applications NIF `barrel_vectordb`/`barrel_faiss`, dont le `{files, [...]}`
du `.app.src` doit inclure `c_src` et les scripts de build racine
`do_cmake.sh` / `do_faiss.sh`).

## Vérifier d’abord les dépendances déclarées

rebar3_hex construit les `requirements` du paquet à partir de `rebar.lock`,
pas de `rebar.config`. Deux choses retirent une dépendance du tarball sans
avertissement :

- **`_checkouts/`.** Une application sœur résolue par un checkout n’entre
  jamais dans le lock, elle disparaît donc des `requirements`. Le paquet se
  publie et s’installe sans erreur, et le consommateur tombe sur un `undef` à
  l’exécution.
- **Un `apps/<app>/rebar.lock` périmé.** Il est ignoré par git : c’est donc
  ce que votre dernier build local a laissé. Une dépendance verrouillée à un
  niveau transitif ne devient pas un requirement, même quand `rebar.config`
  la nomme directement.

La publication est irréversible : une version ne peut pas être refaite. Pour
chaque application, dans l’ordre, supprimez donc les deux, reconstruisez et
vérifiez :

```console
$ cd apps/<app>
$ rm -rf _checkouts rebar.lock
$ rebar3 compile                     # regenerate rebar.lock from Hex
$ rebar3 hex build                   # siblings resolve from Hex (default deps)
$ cd ../..
$ python3 scripts/check_hex_requirements.py apps/<app>
```

`rebar3 hex build` a besoin d’un lockfile : lancez donc d’abord
`rebar3 compile` (supprimer `rebar.lock` sans le régénérer fait échouer le
build avec « No lockfile detected »). Les applications sœurs se résolvent
depuis Hex : chaque application sœur dont dépend une application doit donc
déjà être publiée (l’ordre de publication ci-dessus le garantit).

Le script compare les `requirements` du tarball aux deps du `rebar.config`
de l’application et sort avec un code non nul à la moindre omission. Il ne
passe qu’une fois que chaque application sœur dont dépend l’application est
déjà sur Hex, ce qui correspond exactement à l’ordre de publication
ci-dessus.

Notes :

- La liste `{files, [...]}` de chaque `.app.src` contrôle ce qui part dans le
  tarball. Tenez-la à jour quand vous ajoutez des ressources `priv/` ou des
  includes.
- Chaque dépendance se résout depuis Hex, y compris `livery` (0.10.3) et
  `barrel_mcp` (4.1.1) pour `barrel_server`. Hex refuse les dépendances git,
  gardez donc les choses ainsi : ne réintroduisez pas de dépendance
  `{git, ...}` dans une application que vous comptez publier.
- `barrel_faiss` fournit une NIF qui demande la bibliothèque C++ FAISS au
  moment du build. Le paquet ne se construit que là où cette chaîne d’outils
  est présente.
- Augmentez le `vsn` dans `.app.src` avant de publier ; Hex refuse d’écraser
  une version publiée.

## Maintenir un miroir git par application

Utilisez cette méthode quand vous voulez un dépôt git autonome et consultable
pour une application (par exemple pour en dépendre avec une dépendance
`{git, ...}`, ou pour la publier sur sa propre forge). L’umbrella reste la
source de vérité et vous poussez vers l’extérieur un historique limité à une
application.

`git subtree split` produit une branche qui ne contient que l’historique de
cette application. L’opération est répétable : vous pouvez la relancer à
chaque release pour mettre le miroir à jour.

```console
$ git subtree split --prefix=apps/barrel_embed -b export/barrel_embed
$ git push git@code.barrel-db.eu:barrel-db/barrel_embed.git export/barrel_embed:main
```

`git filter-repo` fait une extraction propre et ponctuelle, avec
l’application réécrite à la racine du dépôt. Il réécrit l’historique : il
sert donc à amorcer un nouveau dépôt, pas à synchroniser.

```console
$ git clone . /tmp/barrel_embed && cd /tmp/barrel_embed
$ git filter-repo --subdirectory-filter apps/barrel_embed
$ git remote add origin git@code.barrel-db.eu:barrel-db/barrel_embed.git
$ git push -u origin main
```

Notes :

- Préférez `subtree split` pour les miroirs suivis dans la durée et
  `filter-repo` pour l’extraction initiale.
- Remplacez le dépôt distant d’exemple par votre forge. Les `links` du paquet
  dans chaque `.app.src` pointent vers le dépôt de l’umbrella ; les miroirs
  par application sont optionnels (l’umbrella est la source de vérité).
- Pilotez les miroirs depuis un job de release déclenché par les tags
  `barrel_*-v*` que la CI reconnaît déjà, pour qu’une release taguée se
  propage vers les dépôts autonomes.

## Consommer une application ailleurs

Depuis un autre projet, dépendez d’une application distribuée sous la forme
qui correspond à la façon dont vous l’avez livrée.

Paquet Hex (après publication) :

```erlang
{deps, [
    {barrel_embed, "~> 2.5"}
]}.
```

Miroir git :

```erlang
{deps, [
    {barrel_embed, {git, "https://code.barrel-db.eu/barrel-db/barrel_embed.git",
                    {tag, "v2.2.1"}}}
]}.
```

Checkout local de l’umbrella (le plus rapide pour le co-développement, sans
étape de publication) :

```erlang
{deps, [
    {barrel_embed, {path, "../barrel/apps/barrel_embed"}}
]}.
```

Si vous voulez au contraire que les applications vivent dans leurs propres
dépôts et que l’umbrella les intègre (l’inverse du miroir), utilisez des
sous-modules git :

```console
$ git submodule add git@code.barrel-db.eu:barrel-db/barrel_embed.git apps/barrel_embed
```

Les dépôts par application deviennent alors la source de vérité, et
l’umbrella un consommateur qui épingle chaque application à un commit. Cela
ramène les changements coordonnés entre plusieurs dépôts : ne l’utilisez que
si vous décidez d’inverser le modèle actuel.
