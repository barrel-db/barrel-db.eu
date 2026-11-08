---
translation_of: src/content/docs/start/what-is-barrel.md
source_hash: "d2a01b770e0d7e27"
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

| Mode | Ce que c’est | Commencer ici |
|------|------------|------------|
| Embarqué | La bibliothèque `barrel` dans votre release OTP | [Démarrage rapide : embarqué](/fr/docs/start/quickstart-embedded) |
| Serveur | `barrel_server` : REST/JSON et MCP sur HTTP | [Démarrage rapide : serveur](/fr/docs/start/quickstart-server) |
| Navigateur | `barrel-lite` : une copie locale dans une application web, synchronisée avec un serveur | [Démarrage rapide : navigateur](/fr/docs/start/quickstart-browser) |

[Choisir un déploiement](/fr/docs/start/choose-deployment) les compare.

## Les parties

Barrel est une seule base de données faite de bibliothèques Apache 2.0
séparées. Vous pouvez dépendre de `barrel` pour tout, ou d’une seule
bibliothèque.

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
