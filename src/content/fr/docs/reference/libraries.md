---
translation_of: src/content/docs/reference/libraries.md
source_hash: "848c1abe0a4084f0"
title: Bibliothèques
description: Les bibliothèques indépendantes qui composent Barrel, leurs versions et profils de compilation, et où trouver la référence générée de chacune.
---

Barrel est une seule base de données faite de bibliothèques indépendantes sous licence Apache 2.0, réunies dans un dépôt umbrella. Vous utilisez l’API `barrel`, lancez `barrel_server`, ou dépendez d’une seule bibliothèque. Cette page les liste, indique ce que chacune demande pour compiler, et renvoie vers sa référence générée : les guides qu’elle fournit et la documentation de ses modules, produites avec ex_doc à partir du code source.

## La pile

| Bibliothèque | Version | Rôle | Référence |
|---|---|---|---|
| `barrel` | 1.13.0 | La base de données : documents, pièces jointes et vecteurs sous un même id, BQL, mode enregistrement, timeline, contextes | [/docs/lib/barrel/](/docs/lib/barrel/) |
| `barrel_docdb` | 2.3.0 | Documents, versions, requêtes, pièces jointes, réplication | [/docs/lib/docdb/](/docs/lib/docdb/) |
| `barrel_vectordb` | 2.5.3 | Index vectoriel (HNSW, DiskANN, FAISS), BM25, recherche hybride | [/docs/lib/vectordb/](/docs/lib/vectordb/) |
| `barrel_ngram` | 0.11.4 | Recherche exacte par sous-chaîne et expression régulière sur une base docdb | [source](https://github.com/barrel-db/barrel/tree/main/apps/barrel_ngram) |
| `barrel_embed` | 2.6.1 | Fournisseurs d’embeddings, locaux ou cloud | [/docs/lib/embed/](/docs/lib/embed/) |
| `barrel_rerank` | 1.0.3 | Reclassement par cross-encoder | [/docs/lib/rerank/](/docs/lib/rerank/) |
| `barrel_crypto` | 1.0.0 | Primitives de chiffrement au repos et fournisseurs de clés | [/docs/lib/crypto/](/docs/lib/crypto/) |
| `barrel_spaces` | 1.3.1 | Espaces, jetons de capacité, sessions, passations | [/docs/lib/spaces/](/docs/lib/spaces/) |
| `barrel_server` | 1.14.0 | REST et MCP sur HTTP | [/docs/lib/server/](/docs/lib/server/) |
| `barrel_att_s3` | 0.1.5 | Pièces jointes dans un stockage compatible S3 | [source](https://github.com/barrel-db/barrel/tree/main/apps/barrel_att_s3) |
| `barrel_faiss` | 1.0.1 | Bindings NIF vers FAISS | [HexDocs](https://hexdocs.pm/barrel_faiss) |
| `barrel-lite` | 0.1.0 | Client TypeScript avec une copie dans le navigateur ; non publié sur npm | [guide](/fr/docs/guides/barrel-lite) |

`barrel_faiss` est lié à une installation système de FAISS, sa référence n’est donc pas générée avec ce site ; lisez-la sur HexDocs. `barrel_ngram` et `barrel_att_s3` n’ont pas encore de site de référence ici ; leur README et la documentation de leurs modules sont dans le dépôt.

Pour la surface HTTP et MCP, utilisez les pages [API REST](/fr/docs/reference/rest-api) et [Outils MCP](/fr/docs/reference/mcp-tools).

## Profils de compilation

Une compilation simple de l’umbrella laisse de côté les applications qui demandent des outils supplémentaires ou tirent des dépendances réseau :

```shell
rebar3 compile              # barrel and its libraries
rebar3 as server compile    # adds barrel_server
rebar3 as s3 compile        # adds barrel_att_s3
rebar3 as faiss compile     # adds barrel_faiss
```

- Chaque application demande OTP 26 ou plus récent. barrel_docdb, barrel_vectordb et barrel_ngram compilent du code C ou C++ avec CMake.
- `barrel_faiss` demande la bibliothèque FAISS, OpenMP et BLAS. Elle compile sur Linux, macOS et les BSD, pas sur Windows.
- `barrel_embed` et `barrel_rerank` installent des paquets Python dans un venv pour leurs modèles locaux.

Voir [Compiler et tester](/fr/docs/contribute/build-and-test) pour les commandes de test.

## Dépendre d’une seule bibliothèque

Chaque bibliothèque a son propre `rebar.config` et dépend de ses voisines par version. Par exemple, documents et réplication sans vecteurs :

```erlang
{deps, [{barrel_docdb, "~> 2.0"}]}.
```

Le code source de chaque bibliothèque est sur [github.com/barrel-db/barrel](https://github.com/barrel-db/barrel), sous `apps/`.
