---
translation_of: src/content/docs/contribute/build-and-test.md
source_hash: "0cec6cd2e8df08a0"
title: Compiler et tester
description: Compiler l’umbrella Barrel avec rebar3 et ses profils, lancer les suites eunit et Common Test, les scripts de bout en bout et la vérification des paquets, comme le fait la CI.
---

Cette page montre comment compiler l’umbrella barrel et lancer ses tests comme le fait la CI. Lisez-la avant d’ouvrir une pull request, ou quand vous devez lancer une suite contre une modification.

## Prérequis

- Erlang/OTP 26 ou plus récent. La CI tourne sous OTP 28 (OTP 29 pour barrel_embed seul).
- rebar3, CMake, un compilateur C et C++, et les bibliothèques de compression liées par RocksDB : sur Debian, `cmake build-essential libssl-dev zlib1g-dev libsnappy-dev liblz4-dev libzstd-dev`.
- Python 3 avec `venv`, pour les tests d’embedding et de reclassement qui démarrent un modèle.
- Docker avec le plugin Compose, uniquement pour les scripts de bout en bout.

```shell
git clone https://github.com/barrel-db/barrel.git
cd barrel
rebar3 compile
```

## Profils de compilation

La compilation par défaut contient barrel_crypto, barrel_docdb, barrel_ngram, barrel_vectordb, barrel_embed, barrel_rerank, barrel et barrel_spaces. Les autres applications viennent avec un profil :

| Profil | Ajoute | Commande |
|---|---|---|
| `server` | barrel_server et sa pile HTTP | `rebar3 as server compile` |
| `s3` | barrel_att_s3 | `rebar3 as s3 compile` |
| `faiss` | barrel_faiss (demande la bibliothèque FAISS, OpenMP, BLAS) | `rebar3 as faiss compile` |
| `s3_server` | barrel_server et barrel_att_s3 ensemble | `rebar3 as s3_server compile` |
| `prod` | une release qui inclut ERTS | `rebar3 as server,prod release -n barrel_server` |
| `test` | meck, pour les suites | `rebar3 as test ...` |

Ouvrez un shell avec le serveur en marche :

```shell
rebar3 as server shell
```

## Lancer les tests

Le job umbrella de la CI lance ceci, dans cet ordre :

```shell
rebar3 compile
rebar3 as test eunit --app barrel,barrel_crypto,barrel_docdb,barrel_ngram,barrel_vectordb,barrel_rerank
rebar3 as test eunit --module=barrel_embed_tests,barrel_embed_provider_tests,barrel_embed_request_tests,barrel_embed_pool_tests
rebar3 as test ct
```

`test/ct.sys.config` définit `{barrel_embed, [{managed_venv, false}]}` : les suites ne créent donc jamais de venv Python et ne téléchargent aucun modèle. Les autres modules de test de barrel_embed demandent Python ou un Ollama en marche, et la CI les laisse de côté.

Lancez une suite, ou un seul cas :

```shell
rebar3 as test ct --suite apps/barrel_docdb/test/barrel_rep_SUITE
rebar3 as test ct --suite apps/barrel_docdb/test/barrel_rep_SUITE \
  --case <case_name>
```

Les suites du serveur (REST, sync, auth, spaces, MCP, timeline, chiffrement) tournent sous leur profil :

```shell
rebar3 as server compile
rebar3 as server ct
```

Les backends facultatifs :

```shell
rebar3 as faiss ct --suite apps/barrel_faiss/test/barrel_faiss_SUITE

eval "$(test/e2e/attachments-s3-setup.sh)"
rebar3 as s3 ct --suite apps/barrel_att_s3/test/barrel_att_s3_SUITE
```

Le script de préparation S3 démarre RustFS et Garage dans Docker et affiche les variables que lit la suite.

## Tester une bibliothèque seule

La CI compile et teste aussi chaque bibliothèque seule, pour repérer une dépendance envers une voisine que son `rebar.config` ne déclare pas. barrel_docdb a besoin pour cela de barrel_crypto dans `_checkouts` :

```shell
cd apps/barrel_docdb
mkdir -p _checkouts
ln -s ../../barrel_crypto _checkouts/barrel_crypto
rebar3 compile
rebar3 xref
rebar3 eunit
```

barrel_crypto, barrel_ngram, barrel_rerank et barrel_embed n’ont besoin d’aucun checkout.

## Vérifications statiques

```shell
rebar3 xref
rebar3 dialyzer
```

Les deux sont configurés à la racine de l’umbrella ; lancez-les depuis là.

## Scripts de bout en bout

Les scripts de `test/e2e/` compilent la release barrel_server dans Docker et lancent plusieurs pairs comme processus séparés : `replication.sh`, `active-active.sh`, `mixed-version.sh`, `crash.sh`, `power-fail.sh` (demande des conteneurs privilégiés pour FUSE) et `attachments-s3.sh`. Chacun sort avec 0 quand toutes les assertions sont passées, et supprime ses conteneurs.

```shell
test/e2e/replication.sh
```

La première exécution construit l’image et prend quelques minutes. Voir [Tests de bout en bout](/fr/docs/contribute/end-to-end-tests) pour ce que vérifie chaque script.

## Vérifier un paquet avant publication

`scripts/check_package.sh` génère la documentation d’une application avec les applications voisines du dépôt, puis son paquet Hex avec les dépendances venant de Hex, comme le fait `rebar3 hex publish`. Lancez-le pour chaque application que vous modifiez avant de publier :

```shell
scripts/check_package.sh barrel_docdb
```

Une version voisine qui n’est pas encore sur Hex est signalée par un avertissement : publiez d’abord la voisine. La CI le lance pour chaque application publiée sauf barrel_faiss.

## barrel-lite

```shell
cd clients/barrel-lite
npm ci
npm run typecheck
npm run build
npm test
```

`npm run test:integration` démarre un vrai barrel_server sur le port 18080 : compilez d’abord le profil `server`. `npm run test:browser` lance les specs Playwright.

## Remarques

- Ne relancez pas un test instable et ne le mettez pas en liste d’exceptions : reproduisez-le sous charge, puis corrigez le code ou rendez le test déterministe.
