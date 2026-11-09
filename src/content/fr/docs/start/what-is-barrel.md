---
translation_of: src/content/docs/start/what-is-barrel.md
source_hash: "872b7b541537fb78"
title: Présentation pour les développeurs
description: Barrel est une base de données open source pour les agents et les applications en périphérie. Elle garde un document, ses fichiers et son vecteur sous un même id, les recherche, et les réplique entre des copies qui acceptent toutes des écritures.
---

Barrel est une base de données open source, écrite en Erlang/OTP, pour
les agents et les applications qui tournent près de leurs données. Un
enregistrement contient un document JSON, ses pièces jointes et son
vecteur sous le même id. Vous le recherchez par champ, par mot-clé, par
sens ou par regex, et vous le répliquez entre des copies qui acceptent
toutes des écritures. Lisez d’abord cette page pour savoir ce que Barrel
fait aujourd’hui, ce qu’il ne fait pas, et de quelle partie vous avez
besoin.

## Les idées de base

Quelques idées reviennent sur chaque page de cette documentation. Chacune
est expliquée ici simplement, avec un lien vers son entrée du
[glossaire](/fr/docs/concepts/glossary).

**Un enregistrement garde tout ce qui concerne une chose sous un même
id.** Un [enregistrement](/fr/docs/concepts/glossary#record) réunit un
[document](/fr/docs/concepts/glossary#document) JSON, les fichiers qui
y sont joints ([pièces jointes](/fr/docs/concepts/glossary#attachment))
et son [vecteur](/fr/docs/concepts/glossary#vector). Pour un article de
support comme kb-142, ce sont ses champs, une capture d’écran jointe, et
les nombres qui décrivent le sens de son texte. Vous n’avez jamais à
tenir deux stockages en phase à la main.

**Chaque écriture reçoit une révision.** Quand vous écrivez un document,
Barrel ajoute un jeton de [révision](/fr/docs/concepts/glossary#revision),
`_rev`. Pour mettre le document à jour, vous renvoyez ce jeton : Barrel
sait ainsi quelle version vous avez modifiée. Une écriture fondée sur une
version périmée est refusée au lieu de remplacer en silence une version
plus récente.

**La recherche par le sens repose sur les embeddings.** Un
[embedding](/fr/docs/concepts/glossary#embedding) est un vecteur calculé
à partir d’un texte par un modèle, de sorte que des textes de sens voisin
obtiennent des vecteurs proches. C’est ainsi que « I cannot log in »
trouve « Reset a locked account ». En [mode
enregistrement](/fr/docs/concepts/glossary#record-mode), vous nommez les
champs à traiter, et Barrel calcule les vecteurs et les garde en phase
avec chaque écriture et chaque suppression. La [recherche
hybride](/fr/docs/concepts/glossary#hybrid-search) y ajoute le classement
par mot-clé [BM25](/fr/docs/concepts/glossary#bm25) pour les termes
exacts.

**Chaque copie accepte des écritures.** La
[réplication](/fr/docs/concepts/glossary#replication) copie les
changements entre bases, dans un sens ou dans les deux, et chaque copie accepte des
écritures ([actif-actif](/fr/docs/concepts/glossary#active-active)).
Quand deux copies modifient le même document en même temps, les deux
versions sont gardées : l’une est le gagnant, l’autre un
[conflit](/fr/docs/concepts/glossary#conflict) que vous pouvez résoudre.
Chaque copie choisit le même gagnant, si bien qu’elles finissent
identiques : c’est la
[convergence](/fr/docs/concepts/glossary#convergence).

**Les agents partagent leurs données par des espaces.** Un
[espace](/fr/docs/concepts/glossary#space) est une base créée via la
couche agents de Barrel pour que plusieurs agents y travaillent. L’accès
se donne avec un [jeton de
capacité](/fr/docs/concepts/glossary#capability-token), qui accorde des
droits nommés (lecture, écriture) sur un seul espace et peut être
révoqué. Une [passation](/fr/docs/concepts/glossary#handoff) transmet
une tâche et son espace d’un agent à un autre.

**Une base a une timeline.** Vous pouvez créer une
[branche](/fr/docs/concepts/glossary#branch), une copie séparée de la
base pour essayer des changements, puis la fusionner plus tard. Une
branche prise à un instant passé vous donne la [restauration à un instant
donné](/fr/docs/concepts/glossary#point-in-time-recovery).

## Ce que vous obtenez

- **Un enregistrement par id.** Un document, ses pièces jointes et son
  embedding vivent ensemble. En [mode
  enregistrement](/fr/docs/guides/record-mode), Barrel calcule l’embedding
  des champs que vous nommez et garde l’index vectoriel en phase avec
  chaque écriture et chaque suppression.
- **Requêtes.** Chaque chemin est indexé. Vous interrogez avec
  [BQL](/fr/docs/guides/query-bql), un petit langage proche de SQL, ou
  avec `find/2` depuis Erlang.
- **Recherche.** Recherche vectorielle, par mot-clé BM25 et hybride, plus
  la recherche exacte de sous-chaînes et par regex. Voir [Vectorielle, par
  mot-clé et hybride](/fr/docs/search/hybrid).
- **Réplication.** Chaque copie accepte des écritures. Les modifications
  concurrentes sont gardées comme versions sœurs et chaque copie affiche
  le même gagnant. Voir [Versions, conflits,
  convergence](/fr/docs/concepts/versions).
- **Timeline.** Créez une branche d’une base, fusionnez la branche, ou
  créez une branche à un instant passé. Voir [Brancher, fusionner,
  récupérer](/fr/docs/guides/timeline).
- **Couche agents.** Des espaces partagés par jetons de capacité, des
  sessions avec un TTL, des passations, et un point d’accès MCP. Voir
  [Espaces et capacités](/fr/docs/concepts/spaces).
- **Sécurité.** Chiffrement au repos par base, jetons bearer et jetons de
  capacité, requêtes signées et mTLS. Voir
  [Authentification](/fr/docs/security/authentication).

## Comment le faire tourner

Vous utilisez la même base de trois façons, selon l’endroit où tourne
votre code. Elles se répliquent entre elles : vous pouvez commencer par
l’une et en ajouter une autre plus tard.

| Mode | Ce que c’est | Commencer ici |
|------|------------|------------|
| Embarqué | La bibliothèque `barrel` dans votre release OTP | [Démarrage rapide : embarqué](/fr/docs/start/quickstart-embedded) |
| Serveur | `barrel_server` : REST/JSON et MCP sur HTTP | [Démarrage rapide : serveur](/fr/docs/start/quickstart-server) |
| Navigateur | `barrel-lite` : une copie locale dans une application web, synchronisée avec un serveur | [Démarrage rapide : navigateur](/fr/docs/start/quickstart-browser) |

[Choisir un déploiement](/fr/docs/start/choose-deployment) les compare.

## Les parties

Barrel est une seule base de données faite de bibliothèques Apache 2.0
séparées. Vous pouvez dépendre de `barrel` pour tout, ou d’une seule
bibliothèque quand vous n’avez besoin que de cette partie, par exemple
`barrel_docdb` pour les documents et la synchronisation sans vecteurs.

| Bibliothèque | Rôle |
|---------|------|
| `barrel` | L’API de cette documentation : documents, fichiers et vecteurs sous un même id |
| `barrel_docdb` | Documents, versions, BQL, pièces jointes, réplication |
| `barrel_vectordb` | Index vectoriel (HNSW, DiskANN, FAISS), BM25, hybride |
| `barrel_ngram` | Index exact de sous-chaînes et de regex |
| `barrel_embed` | Fournisseurs d’embeddings, locaux ou cloud |
| `barrel_rerank` | Reranking par cross-encoder (optionnel) |
| `barrel_spaces` | Espaces, jetons de capacité, sessions, passations |
| `barrel_server` | Serveur REST/JSON et MCP |
| `barrel-lite` | Client navigateur en TypeScript |

Voir [Bibliothèques](/fr/docs/reference/libraries) pour les références de
chaque bibliothèque.

## Ce qu’il ne fait pas

Ces limites sont vraies aujourd’hui. Vérifiez-les avant de concevoir
autour de Barrel.

- **Les vecteurs ne sont pas répliqués.** Les documents et les pièces
  jointes se répliquent. En mode enregistrement, chaque copie reconstruit
  son index vectoriel à partir des documents.
- **BQL n’a ni agrégats, ni jointures, ni GROUP BY.** `COUNT(*)` est une
  erreur de syntaxe.
- **Pas de commande de sauvegarde.** Vous copiez les données avec une
  branche, un export ou la réplication. Voir [Sauvegardes et
  récupération](/fr/docs/operate/backups).
- **Pas de route de métriques sur le serveur.** Les métriques sont
  exportées depuis Erlang. Voir [Supervision](/fr/docs/operate/monitoring).

La page [état des fonctionnalités](/fr/docs/features) liste ce qui est
prévu.
