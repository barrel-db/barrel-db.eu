---
title: Introduction
description: Ce qu'est Barrel, et quand vous en avez besoin.
---

Barrel est une base de donnees edge-AI embarquable. Vous stockez un document, ses
pieces jointes et son vecteur sous un seul id, puis vous interrogez, recherchez,
synchronisez et confiez ces donnees a des agents, sans assembler un stockage
documentaire et un index vectoriel separe. Choisissez Barrel quand vous
construisez un agent ou une application offline-first et que vous voulez la
memoire, la recherche et la synchronisation au meme endroit.

## Un enregistrement, trois formes

Une seule ecriture stocke tout ce qui concerne un element :

- le **document** (JSON sans schema) avec MVCC a vecteurs de version et requetes BQL,
- ses **pieces jointes** (blobs adresses par contenu, diffuses en flux et repliques),
- et son **vecteur** (embedding automatique, ou fourni par vous), interrogeable par
  recherche vectorielle, BM25 et hybride.

Parce qu'ils partagent un seul id, la memoire d'un agent tient en une ecriture et
une lecture. Il n'y a pas de code de liaison pour garder un stockage documentaire
et un index vectoriel synchronises.

## Executez-le la ou vous en avez besoin

Vous utilisez la meme base de donnees a trois endroits :

- **Embarque** : une bibliotheque dans votre application Erlang ou Elixir, sans
  processus separe.
- **Serveur** : lancez `barrel_server` pour une surface REST/JSON et MCP sur la
  meme base de donnees.
- **Navigateur** : synchronisez une copie offline-first dans le navigateur avec
  `barrel-lite`.

## Ce que vous obtenez

- Un enregistrement unifie : documents, blobs et vecteurs sous un seul id.
- Recherche locale vectorielle, BM25 et hybride, plus BQL (un dialecte PartiQL).
- Synchronisation offline-first avec des vecteurs de version HLC, ainsi les
  ecritures convergent sans coordinateur et ne sont jamais abandonnees
  silencieusement.
- Chiffrement au repos avec des cles par base de donnees.
- Timeline : creez une branche d'une base de donnees, restaurez-la a un instant
  donne, et fusionnez a nouveau.
- Une couche agent : espaces, jetons de capacite, sessions et handoffs via REST
  et le Model Context Protocol.

## Etapes suivantes

- [Installez Barrel](/fr/docs/get-started/installation) dans votre projet.
- Suivez le [Demarrage rapide](/fr/docs/get-started/quickstart) pour stocker et
  rechercher vos premiers documents.
- Lisez [Modele de donnees](/fr/docs/concepts/data-model) pour comprendre l'idee
  de l'enregistrement unique.
