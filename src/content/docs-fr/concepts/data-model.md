---
title: Modele de donnees
description: Comment Barrel stocke un document, ses blobs et son vecteur comme un seul enregistrement sous un seul id.
---

Barrel garde tout ce qui concerne un element sous un seul id. Lisez ceci pour
comprendre ce qu'est un "enregistrement", et pourquoi cette forme compte quand
vous construisez des agents.

## Un id, trois formes

Quand vous ecrivez dans Barrel, un id adresse trois choses :

- le **document** : JSON sans schema (une map Erlang), versionne et interrogeable ;
- ses **pieces jointes** : blobs binaires adresses par contenu, diffuses en flux
  et repliques ;
- son **vecteur** : un embedding, soit calcule pour vous, soit fourni.

Vous ne gardez pas un stockage documentaire et un index vectoriel separe
synchronises. Il n'y a pas de deuxieme ecriture, pas de correspondance d'id, et
aucune derive entre eux. La memoire d'un agent tient en une ecriture et une
lecture.

## Le document

Un document est une map avec un `<<"id">>` binaire. Chaque chemin de premier
niveau est indexe automatiquement, vous interrogez donc avec
[BQL](/fr/docs/guides/query-bql) sans creer d'index. Les ecritures sont
versionnees avec des [vecteurs de version](/fr/docs/concepts/version-vectors),
ainsi les modifications concurrentes convergent au lieu de s'ecraser
mutuellement.

## Pieces jointes

Les pieces jointes sont des blobs attaches a un document par leur nom. Elles sont
adressees par contenu et diffusees par morceaux, ainsi les gros fichiers ne
restent pas en memoire. Le backend de stockage est enfichable par base de
donnees. Voir [Integrer Barrel](/fr/docs/guides/embedding) pour l'API des pieces
jointes.

## Vecteurs

Un enregistrement peut porter un vecteur. Vous l'ajoutez explicitement, ou vous
ouvrez la base de donnees avec une politique d'embedding pour que Barrel calcule
l'embedding de votre texte a l'ecriture (voir
[Mode enregistrement](/fr/docs/guides/record-mode)). Dans les deux cas le vecteur
vit avec le document, et vous le cherchez par recherche vectorielle, BM25 ou
hybride.

## Ou vit un enregistrement

Le meme modele d'enregistrement est disponible de trois facons : embarque dans
votre application Erlang, via HTTP a travers
[barrel_server](/fr/docs/server/rest-server), et synchronise dans le navigateur
avec [barrel-lite](/fr/docs/guides/barrel-lite). C'est la meme base de donnees et
le meme enregistrement ou que vous l'atteigniez.
