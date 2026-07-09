---
title: Bibliotheques
description: Les bibliotheques independantes qui composent Barrel, et ou trouver la reference detaillee de chacune.
---

Barrel est une seule base de donnees faite de bibliotheques independantes sous
Apache 2.0. Vous utilisez la facade `barrel` complete, ou vous dependez d'une seule
bibliotheque. Cette page les liste et renvoie vers la documentation par
bibliotheque plus detaillee la ou elle existe.

## La pile

| Bibliotheque | Role |
|---------|------|
| `barrel` | La facade que vous utilisez dans ces docs : documents, blobs et vecteurs sous un seul id. |
| `barrel_docdb` | La couche document : MVCC a vecteurs de version, BQL, pieces jointes, replication. |
| `barrel_vectordb` | La couche vecteur : HNSW, DiskANN, FAISS, et BM25 avec recherche hybride. |
| `barrel_embed` | Generation d'embeddings a travers plusieurs fournisseurs (OpenAI, Ollama, local, et plus). |
| `barrel_rerank` | Reclassement par cross-encoder. |
| `barrel_crypto` | Primitives de chiffrement au repos et fournisseurs de cles. |
| `barrel_spaces` | La couche agent : espaces, jetons de capacite, sessions, handoffs. |
| `barrel_server` | Le serveur REST/JSON et MCP sur la facade. |
| `barrel_faiss` | Liaisons NIF Erlang optionnelles pour FAISS. |
| `barrel-lite` | Le client navigateur TypeScript offline-first. |

## Documentation par bibliotheque

Trois bibliotheques ont leurs propres sites de reference avec plus de details
d'API :

- [barrel_docdb](https://docs.barrel-db.eu/docdb) - la couche document.
- [barrel_vectordb](https://docs.barrel-db.eu/vectordb) - la couche vecteur.
- [barrel_embed](https://docs.barrel-db.eu/embed) - les fournisseurs d'embedding.

Le code source de chaque bibliotheque vit dans le depot umbrella a
[github.com/barrel-db/barrel](https://github.com/barrel-db/barrel).
