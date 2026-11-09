---
translation_of: src/content/docs/start/choose-deployment.md
source_hash: "8a6ba7fbddd1067a"
title: Choisir un déploiement
description: Choisissez entre embarquer Barrel dans une release Erlang, lancer barrel_server, et garder une copie dans le navigateur avec barrel-lite.
---

Barrel tourne à trois endroits : dans votre release Erlang, comme serveur
HTTP, et comme copie locale dans un navigateur web. Vous pouvez les
combiner, puisqu’ils se répliquent entre eux : un serveur peut se
synchroniser avec des navigateurs et avec d’autres serveurs, et chaque
copie accepte des écritures. Servez-vous de cette page
pour choisir par où commencer, selon vos clients et l’endroit où vos
données doivent vivre.

## Les trois options

### Embarqué

En mode [embarqué](/fr/docs/concepts/glossary#embedded), la
bibliothèque `barrel` tourne dans votre propre release Erlang ou Elixir,
et votre code l’appelle comme des fonctions. Il convient à une
application écrite en Erlang ou en Elixir qui possède ses données, comme
un environnement d’agents sur un appareil en périphérie. Vous obtenez
l’API complète sans saut réseau : [mode
enregistrement](/fr/docs/concepts/glossary#record-mode), timeline,
espaces. En contrepartie, seul le code de la même release peut atteindre
les données, et rien n’impose de règles d’accès entre les parties de ce
code.

### Serveur

[`barrel_server`](/fr/docs/concepts/glossary#barrel-server) fait tourner
Barrel comme un service et le sert sur HTTP : une API REST/JSON et un
point d’accès [MCP](/fr/docs/concepts/glossary#mcp) que les agents
appellent comme des outils. Il convient aux clients écrits dans d’autres
langages, aux clients sur d’autres machines et aux agents. En
contrepartie, vous avez un service à faire tourner et à sécuriser : chaque
appel traverse le réseau, et le serveur n’a aucune authentification tant
que vous ne la configurez pas.

### Navigateur

[`barrel-lite`](/fr/docs/concepts/glossary#barrel-lite) garde une copie
d’une base dans une application web : les lectures et les écritures sont
locales et continuent de fonctionner hors ligne. Il convient à une
application web qui doit rester utilisable sans réseau. En contrepartie,
il lui faut un `barrel_server` avec qui se synchroniser, le navigateur
peut effacer sa copie, et la recherche vectorielle, par mot-clé et
hybride s’exécute sur le serveur, pas en local.

## Choisir

Ce tableau associe un besoin à l’option qui y répond.

| Si vous avez besoin de | Utilisez | Pourquoi |
|-------------|-----|-----|
| Votre application est en Erlang ou Elixir et possède les données | `barrel` embarqué | Aucun saut réseau, API complète, mode enregistrement, timeline |
| Des clients dans d’autres langages, ou sur d’autres machines | `barrel_server` | REST/JSON sur HTTP/1.1, HTTP/2 ou HTTP/3 |
| Un agent qui lit et écrit les données | `barrel_server` | Point d’accès MCP sur `/mcp` avec 39 outils |
| Une application web qui fonctionne hors ligne | `barrel-lite` et `barrel_server` | Stockage local dans le navigateur, synchronisé avec le serveur |
| Plusieurs sites ou appareils qui acceptent tous des écritures | N’importe lequel, en réplication | Chaque copie accepte des écritures et converge |
| Documents et synchronisation seulement, sans vecteurs | `barrel_docdb` | Dépendance plus légère, même réplication |
| Sous-chaîne exacte ou regex sur les documents | `barrel_ngram`, ou `barrel_server` | Le serveur l’expose comme outil `ngram_search` |

## Ce que donne chaque mode

Ce tableau indique les fonctions de chaque mode : vérifiez que celui que
vous avez choisi couvre vos besoins.

| | Embarqué | Serveur | Navigateur |
|-|----------|--------|---------|
| Documents, BQL | oui | oui | oui, BQL local |
| Recherche vectorielle, BM25, hybride | oui | oui | sur le serveur, via `queryRemote` ; cosinus local sur les vecteurs synchronisés |
| Pièces jointes | oui | oui | oui |
| Réplication | `barrel_rep` | routes `_sync` | push et pull vers un serveur |
| Branche, fusion, état passé | oui | routes `_timeline` | non |
| Espaces, sessions, passations | `barrel_spaces` | `/spaces`, `/handoffs`, MCP | non |
| Authentification | dans le processus, aucune | bearer, jetons de capacité, requêtes signées, mTLS | bearer ou jeton de capacité |
| Chiffrement au repos | oui | oui, via `open_opts` | non |

## À savoir avant de choisir

Voici les limites qui changent le plus souvent un choix.

- **Embarqué veut dire que votre processus détient les données.** Le
  stockage vectoriel est lié au processus qui l’ouvre. Ouvrez les bases à
  longue durée de vie via `barrel_dbs` ou avec `store_supervised => true`.
  Voir [Embarquer barrel dans une application
  Erlang](/fr/docs/guides/embedding).
- **Les jetons de capacité sont appliqués par le serveur.** Dans le
  processus, n’importe quel code peut ouvrir n’importe quel espace. Si des
  agents doivent rester séparés, placez-les derrière `barrel_server`. Voir
  [Espaces et capacités](/fr/docs/concepts/spaces).
- **La copie du navigateur est un cache.** Le navigateur peut l’effacer ;
  le serveur détient la copie durable.
- **Les vecteurs ne se répliquent pas.** Chaque copie reconstruit son
  propre index à partir des documents, en mode enregistrement.
- **Un nœud n’est pas un cluster.** Il n’y a ni placement ni bascule
  automatiques. C’est vous qui choisissez quelles copies se répliquent avec
  lesquelles.

## Ensuite

- [Démarrage rapide : embarqué](/fr/docs/start/quickstart-embedded)
- [Démarrage rapide : serveur](/fr/docs/start/quickstart-server)
- [Démarrage rapide : navigateur](/fr/docs/start/quickstart-browser)
- [Synchronisation](/fr/docs/guides/synchronization)
