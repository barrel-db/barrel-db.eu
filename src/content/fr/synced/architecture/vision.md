---
translation_of: src/content/synced/architecture/vision.md
source_hash: "88332a8ba06cd0c7"
title: "Vision : la base de données pour les agents"
description: "Cette note définit ce que devient l’application barrel : non pas une surcouche de barrel_docdb et barrel_vectordb, mais la couche qui en fait une seule base de données, pensée pour les charges de travail d’agents. Lisez-la avant de travailler sur une fonctionnalité de cette couche ; le journal des décisions, à la fin, consigne ce qui est arrêté et pourquoi."
source: "docs/architecture/vision.md"
---

Cette note définit ce que devient l’application `barrel` : non pas une
surcouche de `barrel_docdb` et `barrel_vectordb`, mais la couche qui en fait
une seule base de données, pensée pour les charges de travail d’agents.
Lisez-la avant de travailler sur une fonctionnalité de cette couche ; le
journal des décisions, à la fin, consigne ce qui est arrêté et pourquoi.

## Positionnement

Le discours de Turso sur les agents se ramène à cinq idées : le multi-tenant
par base-fichier, les branches en copie sur écriture, le MVCC avec détection
des conflits au commit, la synchronisation asymétrique avec un distant qui
fait autorité, et un packaging en journal d’audit (AgentFS).
Le domaine de l’infrastructure pour agents se divise entre une couche
mémoire (Letta, Mem0, Zep : extraction, consolidation, oubli progressif) et
un substrat (Neon, Turso, Tiger, Cloudflare : bases isolées peu coûteuses,
branches, voyage dans le temps, recherche hybride, MCP).
Personne ne possède les deux. Barrel, si : cette umbrella est le substrat, et
la couche mémoire se place au-dessus.

Les points d’appui de Barrel, que les acteurs en place ne peuvent pas copier :

- L’intégration dans la VM pour les applications BEAM : pas de saut réseau,
  pas de sérialisation.
- Une vraie synchronisation edge et multi-maître avec résolution causale des
  conflits (HLC) ; Turso a reculé sur les répliques edge et applique « le
  dernier push gagne ».
- La fusion de branches. Les branches de Turso et de Neon sont des
  bifurcations à sens unique ; un moteur héritier de CouchDB obtient la
  fusion grâce à sa mécanique de réplication.
- La provenance au niveau de la base (« que savait l’agent, et quand »).
- Open source et auto-hébergé de bout en bout, adapté à l’UE.

## L’enregistrement

Un enregistrement barrel est une unité : corps du document, blobs (pièces
jointes), vecteurs et provenance (HLC, acteur, source, session). Un seul
chemin d’écriture le possède.

- Écriture = document + marqueur d’embedding en attente dans un seul
  WriteBatch docdb (atomique). L’indexation vectorielle est pilotée par le
  flux de changements avec une sémantique exactly-once ; un consommateur
  relancé répare les vecteurs manquants après un crash.
- Politique d’embedding par base : quels champs sont embeddés, avec quel
  modèle, en synchrone ou en asynchrone. Le mode synchrone donne une
  recherche qui voit vos propres écritures ; l’asynchrone est le défaut.
- `barrel_vectordb` ne stocke que les vecteurs et les index ANN. Le texte et
  les métadonnées sont lus via la jonction `barrel_vectordb_docstore`,
  pointée sur la base de l’enregistrement (le sens de la jonction s’inverse :
  le document est primaire, le vecteur est dérivé).
- À terme (phase ultérieure) : les column families vectorielles rejoignent
  le RocksDB du stockage des enregistrements, pour que vecteur et document
  soient commités dans le même batch, sans marqueur.

## Requêtes : BQL, un dialecte PartiQL

Une seule surface de requête sur les documents, les vecteurs et le plein
texte.

- Sémantique PartiQL : MISSING vs NULL, expressions de chemin, UNNEST.
  Adopter la spécification, ne pas inventer de sémantique.
- Parseur leex/yecc (riak_ql sert de modèle architectural). Le planificateur
  compile vers la mécanique existante : indexation automatique des chemins,
  postings roaring64, sélection d’index par cardinalité, curseurs
  d’instantané.
- Les vecteurs et le FTS entrent dans le SQL d’abord comme fonctions de
  table : `vector_top_k(...)`, `bm25_top_k(...)` (le modèle de libSQL, sans
  magie dans le planificateur). Hybride = RRF. Une réécriture
  `ORDER BY distance LIMIT k` dans le planificateur pourra venir plus tard.
- Requêtes live : la même requête + SUBSCRIBE, adossée aux abonnements de
  requêtes existants ; une requête live est un processus Erlang qui pousse
  des deltas.
- Périmètre v1 : SELECT, WHERE, ORDER BY, LIMIT, chemins, UNNEST, fonctions
  de table. Hors v1 : jointures, GROUP BY, complétude SQL-92.

## Synchronisation

Le serveur fait autorité pour les clients légers ; multi-maître entre
serveurs.

- Les vecteurs de versions HLC remplacent la sémantique des arbres de
  révisions (le choix de Couchbase Lite 4.0). Conflit par défaut : la
  dernière écriture gagne selon la HLC, ce qui respecte la causalité. Les
  versions perdantes sont remplacées, pas supprimées, et restent
  interrogeables dans l’historique. Un hook de fusion permet une résolution
  personnalisée.
- Protocole asymétrique : pousser des mutations logiques estampillées HLC,
  tirer un journal de changements compacté.
- La synchronisation partielle est un index construit à l’écriture (des
  channels dérivés des listes de postings de chemins existantes), jamais un
  filtre appliqué à la lecture sur le flux global.
- Les blobs se synchronisent hors bande, adressés par contenu. Les vecteurs
  se synchronisent quantifiés ; les index ANN ne sont jamais envoyés, ils se
  reconstruisent localement.
- Une fenêtre de rétention par base borne les tombstones, la fenêtre PITR et
  la fenêtre de fusion avec un seul réglage.

## Timeline : branches et restauration à un instant donné

Branches, PITR et fusion forment un seul sous-système bâti sur deux
primitives : les checkpoints RocksDB (la mécanique de bifurcation : SST en
liens physiques, quasi instantané) et un journal de changements HLC conservé
(la sémantique). Le flux de changements doit conserver l’historique dans la
fenêtre de rétention ; aujourd’hui, il ne garde que le dernier changement
par document.

- Branche = bifurcation maintenant : checkpoint des deux stockages,
  enregistrement de `{parent, fork_hlc}`.
- PITR = bifurcation à un T passé : checkpoint le plus proche avant T, puis
  rejeu du journal jusqu’à T. La restauration crée une nouvelle base (parité
  avec Turso), et elle peut être fusionnée en retour.
- Fusion = réplication ponctuelle des changements de la branche depuis
  `fork_hlc` vers le parent, par la mécanique normale de conflits de la
  synchronisation, avec une politique `lww | fail_on_conflict | Fun`. La
  fusion est une synchronisation ; pas de moteur séparé.
- En v1, la lignée est parent-enfant linéaire. Les DAG de branches et les
  fusions entre lignées viennent explicitement plus tard.

## Couche agents

- Une base par agent : ouverture/création assez peu coûteuse pour des
  centaines de bases éphémères par tâche ; un processus supervisé par base,
  des noms binaires de bout en bout (pas de fuite d’atomes), et un
  gestionnaire de cycle de vie (`barrel_dbs`) avec fermeture sur inactivité
  et éviction LRU.
- Espaces : des conteneurs de contexte partagés avec des jetons de capacité ;
  le contexte est partagé par référence, pas copié. Un espace EST une base
  barrel ; une capacité est un jeton aléatoire haché avec des droits
  read < write < admin, révocable localement.
- Les sessions avec TTL et les passations sont des primitives barrel ; une
  passation est un espace partagé plus une capacité dont la possession vaut
  droit d’accepter. Les sessions reposent sur une primitive générale de TTL
  de document (`expires_at` + balayeur activé sur demande).
- MCP comme surface de premier rang : bases et requêtes live exposées comme
  ressources MCP avec abonnements (spécifiés mais non implémentés dans tout le
  secteur), plus des outils pour requêter, écrire, créer une branche et
  fusionner, et la couche agents.
- Audit : les champs de provenance et le journal de changements conservé
  répondent à « que savait l’agent, et quand » au niveau de la base.
- LIVRÉ (phase 8) : voir la ligne 6 du journal des décisions.

## Concurrence et chiffrement

- Les lectures ponctuelles quittent le writer de la base pour des
  instantanés RocksDB (les requêtes le contournent déjà ; `get_doc` doit le
  faire aussi). Group commit dans le writer. Le CAS de révision au niveau du
  document reste la détection des conflits au commit. La montée en charge en
  écriture vient de la multiplication des bases, que le modèle d’agents
  fournit.
- Chiffrement au repos : un behaviour `barrel_keyprovider` avec des clés par
  base (BYOK) résolues sur le KEYSPACE (une branche s’ouvre avec la clé de
  son parent), l’EncryptedEnv de RocksDB pour chaque stockage, et un
  chiffrement par secteur (AES-256-CTR adressable par offset + enveloppes GCM
  pour les fichiers de termes) pour les fichiers plats mappés en mémoire que
  l’EncryptedEnv ne couvre pas : BM25 disque et DiskANN. L’état HNSW/FAISS
  est persisté via les stockages chiffrés. Ouvertures à échec sûr grâce à des
  marqueurs de vérification de clé en clair. Les clés par base servent aussi
  d’isolation entre agents. LIVRÉ (phase 7).

## Navigateur : barrel-lite

Un client de protocole en TypeScript, pas un portage WASM du moteur.

- Stockage OPFS avec élection d’un leader par Web Locks (un seul writer par
  origine).
- Mutations locales estampillées HLC ; pousser du logique, tirer le journal
  de changements ; les données locales sont un cache (Safari évince), la
  synchronisation assure la durabilité.
- Sous-ensemble BQL local pour l’ensemble synchronisé ; pas d’ANN dans le
  navigateur : cosinus en force brute sur le sous-ensemble synchronisé,
  embeddings transformers.js en option, requêtes lourdes ou globales
  déléguées au serveur.
- LIVRÉ (phases 9a, 9b, 9c) : voir la ligne 7 du journal des décisions.

## Non-objectifs

- Pas de réplication CRDT symétrique (les retours d’expérience du domaine
  sont sans appel).
- Pas de complétude SQL-92 avant que le sous-ensemble documents ne l’ait
  méritée.
- Pas de portage WASM du moteur Erlang.
- Pas de moteur de requêtes DuckDB/DataFusion embarqué (il ne peut pas voir
  les index de barrel).

## Journal des décisions

| # | Décision | Choix | Justification |
|---|----------|-------|---------------|
| 1 | Cœur de la synchronisation | Vecteurs de versions HLC, pas d’arbres de révisions | Les plaies des arbres de révisions (tombstones, gagnants arbitraires, métadonnées dans le chemin de lecture) ; précédent de CBL 4.0. LIVRÉ en phases 3+5 : protocole VV + historique conservé (phase 3) ; transport réseau en HTTP (protocole JSON + base64, /db/:db/_sync/*), authentification bearer statique, channels construits à l’écriture (flux 0x1E) pour la synchronisation partielle, synchronisation des pièces jointes adressées par contenu (flux dans le stockage de blobs, LWW sur la HLC d’origine, transfert en streaming), tâches continues pilotées par événements (réveil par le flux de changements, polling distant adaptatif, backoff sur erreur). Synchronisation des vecteurs quantifiés reportée à la phase 9 |
| 2 | Atomicité document+vecteur | Marqueur outbox dans un seul WriteBatch, indexation par le flux de changements ; unification du stockage plus tard | Atomique dès maintenant sans bloquer la vie autonome de vectordb. LIVRÉ comme mode enregistrement (phase 2) : outbox étiquetée + indexeur supervisé + mode synchrone + docstore en lecture traversante |
| 3 | Dialecte de requête | Sémantique PartiQL | Une sémantique SQL orientée JSON déjà spécifiée ; rien à inventer. LIVRÉ comme BQL v1 (phase 4) : parseur leex/yecc abaissé vers le moteur de requêtes, fonctions de table vector_top_k/bm25_top_k/hybrid_top_k, UNNEST, requêtes live SUBSCRIBE, point d’accès REST en streaming |
| 4 | Branches | Sous-système timeline : checkpoint + journal HLC conservé ; branche, PITR, fusion comme synchronisation ; lignée linéaire en v1 | La fusion est le saut qui dépasse Turso/Neon ; la parité PITR est requise. LIVRÉ (phase 6) : bifurcations en O(1) par liens physiques via les checkpoints rocksdb + indirection de keyspace (la branche garde le nom du parent dans les clés, identité dans le fichier annexe TIMELINE, nouveau source_id) ; retour PITR à partir du journal d’historique conservé, reconstruction des fenêtres de conflit comprise ; fusion = réplication incrémentale depuis la bifurcation via put_version (LWW/conflict_merger) avec une phase pièces jointes ; les branches en mode enregistrement remplissent leur stockage vectoriel à partir des embeddings stockés ; REST /db/:db/_timeline/* |
| 5 | Chiffrement au repos | Clés par base via barrel_keyprovider, résolues par keyspace ; EncryptedEnv + chiffrement par secteur pour les fichiers plats | Les clés servent aussi d’isolation entre agents ; une branche partage la clé de son parent par le keyspace. LIVRÉ (phase 7) : application barrel_crypto (enveloppe GCM, CTR adressable par offset, jetons de vérification de clé, fournisseurs env/personnalisés) ; EncryptedEnv sur les documents et pièces jointes docdb et sur chaque RocksDB vectordb ; BM25 disque (nonce des postings statiques renouvelé à chaque compaction, blockmax intégré) et DiskANN (secteurs de graphe intégrés, vecteurs/pq statiques, meta/pq_state scellés) ; matrice d’ouverture à échec sûr partout ; une seule spécification `encryption` à barrel:open couvre toute la base logique ; serveur via open_opts |
| 6 | Couche agents | Espaces = bases + jetons de capacité ; sessions/passations intégrées ; MCP dans barrel_server | Le partage par référence vaut mieux que la copie ; la possession du jeton vaut mieux que l’identité de l’appelant pour les passations ; un seul gestionnaire de cycle de vie sert REST, MCP et les espaces. LIVRÉ (phase 8) : noms de bases binaires + registre via pour vectordb (fuite d’atomes refermée) ; gestionnaire de cycle de vie barrel_dbs (fermeture sur inactivité, plafond LRU, épinglage) ; option d’écriture provenance (actor/session/source, colonne d’entité + queue TLV dans l’historique, locale seulement sur le protocole) avec lectures d’audit (history/doc_versions/version_body) et points d’accès REST ; TTL de document (expires_at, index d’expiration 0x1F, lectures paresseuses + balayeur activé sur demande) ; apps/barrel_spaces (base registre, identifiants sp_, chiffrement par espace), barrel_caps (jetons bsp_, stockage du hash seul, échelle de droits), sessions (TTL glissant, messages chronologiques, janitor), passations (acceptation par CAS, la complétion révoque, chaînes) ; REST /spaces + /handoffs avec des bearers de capacité ; point d’accès MCP sur /mcp (pont livery_mcp, fournisseur d’authentification propre pour les jetons serveur et de capacité, 26 outils, 3 modèles de ressources, pont de requêtes live avec notifications updated temporisées, GC des sessions, capacités) |
| 7 | Client navigateur | barrel-lite : un client de protocole TS dans l’umbrella (clients/barrel-lite), pas un portage WASM | Le protocole est du JSON + base64 simple : le client réimplémente les codecs et garde les données locales comme cache. LIVRÉ (phase 9a) : codecs HLC/version/VV exacts à l’octet (fixtures de référence générées depuis l’Erlang par un escript) ; stockage local sur un StorageAdapter (mémoire + OPFS asynchrone sur le thread principal) avec un source id persisté et des checkpoints côté client ; synchronisation live ponctuelle et en polling adaptatif (l’application reproduit do_put_version : skip/fast-forward/LWW avec un hook onConflict) ; élection de leader par Web Locks avec RPC proxy des suiveurs par BroadcastChannel (le leader possède le stockage et la synchronisation) ; prérequis côté serveur = middleware CORS (surcouche livery_cors) et jetons de capacité limités aux routes /db de leur espace (read = branche pull, write = branche push, classifieur à échec sûr) ; intégration contre un vrai barrel_server et un smoke test Playwright chromium. LIVRÉ (phase 9b) : un mode SSE continu /changes côté serveur (push par abonnement, contre-pression par ack, heartbeat) avec un flux client qui réveille le poller et se dégrade en cas de coupure ; synchronisation des pièces jointes (stockage de blobs OPFS adressé par contenu, digest sha256-, LWW sur la HLC d’origine, flux + checkpoint séparés, API put/get/remove/gc) ; et un sous-ensemble BQL local porté octet pour octet (lexer + parseur à descente récursive + abaissement + évaluateur) conforme au sous-ensemble documents du serveur, fixé par des fixtures de référence de bout en bout générées depuis l’Erlang, avec queryRemote qui délègue les fonctions de table à POST /db/:db/query. LIVRÉ (phase 9c) : recherche vectorielle dans le navigateur = un tirage dédié des embeddings (include_embedding sur GET doc + POST /db/:db/_bulk_get, le seul changement serveur ; les vecteurs voyagent en float32 LE base64 sans perte, exacts à l’octet avec barrel_doc:encode_embedding), un index vectoriel persisté à dimension unique dans le stockage local (instantané vectors.json), et db.searchLocal qui calcule un top-k cosinus en force brute sur les vecteurs synchronisés avec un pré-filtre BQL WHERE optionnel ; db.searchVector/searchText délèguent aux points d’accès /search du serveur (un corpus ANN à la dimension du modèle, distinct de la colonne emb par document), et transformers.js est un adaptateur optionnel réservé aux exemples, jamais une dépendance d’exécution |
| 8 | Montée en charge | Contextes : des jeux de données bornés et portables que les agents découvrent, attachent et interrogent ensemble ; la fédération par composition, pas des shards transparents | LIVRÉ dans barrel 1.10.0 et barrel_server 1.10.0 (#50 à #59), conception dans [contexts.md](/fr/docs/architecture/contexts). Composition distante : catalogue de contextes, client de requête distant, exécuteur BQL fédéré avec statut, version et couverture par source, route de requête bornée (`max_rows`, `deadline_ms`, version observée), REST `/contexts` et outils MCP `context_*`. Classement : la récupération est groupée par contexte ; `vector_top_k` ne fusionne par score que lorsque chaque membre déclare la même empreinte d’embedding et la distance cosinus (mesuré égal à un index unique en force brute) ; les scores BM25, hybrides et RRF ne fusionnent jamais ; le rerank est refusé tant qu’un reranker adapté au code n’est pas validé. Portabilité : ouvertures en lecture seule, export et import vérifié en lecture seule d’une génération de base, ensembles de travail avec tranches de l’ensemble récupéré et couverture hors ligne ([guide](/fr/docs/guides/contexts)). Reporté : paquets d’index ngram, en attente d’un format de segment compact |
