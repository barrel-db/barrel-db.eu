---
title: Bibliotheques
description: Les bibliotheques independantes qui composent Barrel, et ou trouver la reference detaillee de chacune.
---

Barrel est une seule base de donnees faite de bibliotheques independantes sous
Apache 2.0. Vous utilisez l'API `barrel` complete, ou vous dependez d'une seule
bibliotheque. Cette page les liste et renvoie vers la documentation par
bibliotheque plus detaillee la ou elle existe.

## La pile

| Bibliotheque | Role |
|---------|------|
| `barrel` | L'API que vous utilisez dans ces docs : documents, blobs et vecteurs sous un seul id. |
| `barrel_docdb` | La couche document : MVCC a vecteurs de version, BQL, pieces jointes, replication. |
| `barrel_vectordb` | La couche vecteur : HNSW, DiskANN, FAISS, et BM25 avec recherche hybride. |
| `barrel_embed` | Generation d'embeddings a travers plusieurs fournisseurs (OpenAI, Ollama, local, et plus). |
| `barrel_rerank` | Reclassement par cross-encoder. |
| `barrel_crypto` | Primitives de chiffrement au repos et fournisseurs de cles. |
| `barrel_spaces` | La couche agent : espaces, jetons de capacite, sessions, handoffs. |
| `barrel_server` | Le serveur REST/JSON et MCP sur l'API `barrel`. |
| `barrel_faiss` | Liaisons NIF Erlang optionnelles pour FAISS. |
| `barrel-lite` | Le client navigateur TypeScript offline-first. |

## Documentation par bibliotheque

Chaque bibliotheque publie son propre site de reference : les guides qu'elle
embarque, plus une reference d'API generee depuis la documentation des modules,
qui ne peut donc pas diverger du code.

- [barrel](/docs/lib/barrel/) - la base complete.
- [barrel_docdb](/docs/lib/docdb/) - la couche document.
- [barrel_vectordb](/docs/lib/vectordb/) - la couche vecteur.
- [barrel_embed](/docs/lib/embed/) - les fournisseurs d'embedding.
- [barrel_server](/docs/lib/server/) - le serveur REST/JSON et MCP.
- [barrel_spaces](/docs/lib/spaces/) - la couche agent.
- [barrel_rerank](/docs/lib/rerank/) - le reranking cross-encoder.
- [barrel_crypto](/docs/lib/crypto/) - le chiffrement au repos.

`barrel_faiss` se lie a une installation FAISS du systeme : sa reference est
publiee sur [HexDocs](https://hexdocs.pm/barrel_faiss) plutot qu'ici. Chaque
bibliotheque est sur HexDocs sous son propre nom.

Le code source de chaque bibliotheque vit dans le depot umbrella a
[github.com/barrel-db/barrel](https://github.com/barrel-db/barrel).
