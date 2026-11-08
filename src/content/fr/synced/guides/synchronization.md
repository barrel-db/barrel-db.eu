---
translation_of: src/content/synced/guides/synchronization.md
source_hash: "bd0f437559193065"
title: "Synchronisation"
description: "Barrel réplique les documents entre bases avec un protocole à vecteurs de versions : ordre causal issu d’une horloge logique hybride (HLC), gagnants déterministes, livraison idempotente et checkpoints pour reprendre. La réplication s’exécute dans la même VM ou sur HTTP face à un barrel_server. Lisez ce guide si vous devez copier deux bases ou les garder synchronisées, répliquer un sous-ensemble avec des canaux, ou déplacer les pièces jointes avec les documents."
source: "docs/guides/synchronization.md"
---

Barrel réplique les documents entre bases avec un protocole à vecteurs de
versions : ordre causal issu d’une horloge logique hybride (HLC), gagnants
déterministes, livraison idempotente et checkpoints pour reprendre. La
réplication s’exécute dans la même VM ou sur HTTP face à un `barrel_server`.
Lisez ce guide si vous devez copier deux bases ou les garder synchronisées,
répliquer un sous-ensemble avec des canaux, ou déplacer les pièces jointes avec
les documents.

## Ce que c’est

La réplication vit dans `barrel_docdb` (`barrel_rep`). Une exécution :

1. Lit le checkpoint (un document local des deux côtés) pour trouver le dernier
   HLC envoyé.
2. Récupère les changements de la source depuis ce HLC, filtre appliqué à la
   source.
3. Compare les jetons de version proposés avec la cible en un seul aller-retour.
4. Fait un `put_version` des documents manquants sur la cible (idempotent : une
   livraison au moins une fois est donc sûre).
5. Pose un checkpoint par lot, puis lance la phase des pièces jointes (voir
   plus bas).

Les deux côtés convergent vers le même gagnant, le même corps et le même état de
suppression pour chaque document, quel que soit l’entrelacement des écritures.
Les conflits sont enregistrés là où la concurrence a été observée et se résolvent
en écrivant une version qui les remplace.

Les transports implémentent le behaviour `barrel_rep_transport`. Deux sont
disponibles aujourd’hui : `barrel_rep_transport_local` (même VM, noms de bases)
et `barrel_rep_transport_http` (client hackney qui parle le protocole
`/db/:db/_sync/*` servi par `barrel_server`).

## Quand l’utiliser

- Copier une base vers une autre, dans la même VM ou sur un autre nœud.
- Garder des répliques cohérentes à terme, en une fois par exécution ou en
  continu.
- Répliquer un sous-ensemble de documents avec un filtre de canal, de chemin ou
  de requête.
- Déplacer les blobs des pièces jointes avec leurs documents, adressés par
  contenu.

## Comment faire (même VM)

```erlang
{ok, _} = barrel_docdb:create_db(<<"source">>),
{ok, _} = barrel_docdb:create_db(<<"target">>),
{ok, _} = barrel_docdb:put_doc(<<"source">>, #{<<"id">> => <<"a">>, <<"v">> => 1}),

{ok, Result} = barrel_rep:replicate(<<"source">>, <<"target">>),
#{docs_written := N, att_sync := _} = Result.
```

Relancez-la plus tard pour récupérer les nouveaux changements ; elle reprend
depuis le checkpoint.

## Comment faire (sur HTTP)

Le côté distant est une URL sous un `barrel_server` en cours d’exécution. La base
doit y exister : la réplication ne la crée pas, et une base inconnue répond 404.
Créez-la d’abord (`PUT /db/inventory`). Construisez un endpoint, puis passez le
transport correspondant :

```erlang
Endpoint = barrel_rep_transport_http:endpoint(
    <<"http://edge-1.example.com:8080/db/inventory">>),

%% push
{ok, _} = barrel_rep:replicate(<<"inventory">>, Endpoint,
    #{target_transport => barrel_rep_transport_http}),

%% pull
{ok, _} = barrel_rep:replicate(Endpoint, <<"inventory">>,
    #{source_transport => barrel_rep_transport_http}).
```

`endpoint/1` normalise l’URL (schéma et hôte en minuscules, pas de barre oblique
finale). L’URL normalisée est l’identité de la réplication : changer son texte
démarre un nouveau checkpoint, changer les identifiants ou les réglages non. La
map d’endpoint accepte aussi `pool`, `connect_timeout`, `recv_timeout` et
`headers`.

### JSON et CBOR sur les routes de synchronisation

JSON reste le format par défaut. CBOR n’est utilisé que pour les documents que
JSON ne peut pas transporter : un document contenant un binaire qui n’est pas de
l’UTF-8 valide (un hash brut, par exemple). La réplication barrel choisit
l’encodage à chaque requête ; un client JSON n’a rien à changer.

Ce que fait le serveur avec chaque encodage :

| Vous envoyez ou demandez | Le serveur |
|---|---|
| un corps sans `content-type: application/cbor` | le lit comme du JSON, comme avant ; `vv` est en base64 |
| un corps avec `content-type: application/cbor` | le lit comme du CBOR ; `vv` est une chaîne d’octets |
| pas d'`accept`, `*/*` ou `application/json` | répond en JSON, comme avant |
| un `accept` qui nomme `application/cbor` | répond en CBOR, erreurs comprises |
| un document que JSON ne peut pas transporter, sans CBOR dans `accept` | répond 406 `not_acceptable` |

Un corps mal formé répond 400 (`bad_json` ou `bad_cbor`). Les routes de pièces
jointes transmettent des octets bruts en flux et répondent les erreurs en JSON
quel que soit votre `accept`.

La réplication barrel envoie du JSON chaque fois que JSON peut transporter le
document et demande du CBOR quand elle en récupère un. Les deux pairs ont besoin
de barrel_docdb 1.8.0 et barrel_server 1.11.0 pour déplacer un document que JSON
ne peut pas transporter ; tout le reste se réplique avec des pairs plus anciens
comme avant. Un client uniquement JSON, comme barrel-lite, ne produit jamais un
tel document ; il ne reçoit une 406 que quand il en récupère un poussé par un
pair CBOR.

## Comment faire (authentification)

Protégez un serveur avec des jetons bearer statiques ; une liste accepte l’ancien
et le nouveau pendant une rotation. `/health` reste ouvert, tout le reste exige
le jeton :

```erlang
%% côté serveur (env de l'application, avant le démarrage de barrel_server)
application:set_env(barrel_server, auth, #{tokens => [<<"s3cret">>]}).
```

Donnez au client son jeton sur l’endpoint, ou indexé par origine dans l’env de
l’application pour que les configurations de tâches persistées ne contiennent
aucun secret :

```erlang
Authed = Endpoint#{auth => #{token => <<"s3cret">>}},
%% ou
application:set_env(barrel_docdb, sync_auth,
                    #{<<"http://edge-1.example.com:8080">> => <<"s3cret">>}).
```

## Comment faire (requêtes signées)

Sans TLS, un jeton bearer peut être rejoué. Pour une authentification Ed25519
par requête, ajoutez `accept` (la liste des méthodes acceptées) et `signers`
(keyId vers une clé publique brute de 32 octets). Chaque requête est signée sur
`ts|keyId|nonce|METHOD|target|sha256(body)`, où `nonce` est neuf à chaque
requête et `target` est le chemin plus `?` et la chaîne de requête brute quand il
y en a une (signature v2), avec protection contre le rejeu et une fenêtre de
décalage d’horloge. `accept => [bearer, signed]` accepte les deux, pour qu’une
flotte bascule nœud par nœud ; `accept => [bearer]` (ou l’absence d'`accept`)
donne exactement le comportement bearer seul décrit plus haut.

```erlang
%% serveur : connaître la clé publique de chaque pair
application:set_env(barrel_server, auth,
                    #{accept  => [bearer, signed],
                      signers => #{<<"node1">> => PubKey32},
                      skew_ms => 300000}).

%% client : signer avec la clé privée correspondante (endpoint ou env par origine)
Signed = Endpoint#{signing => #{key_id => <<"node1">>, priv_key => Priv32}},
%% ou
application:set_env(barrel_docdb, sync_signing,
                    #{<<"https://edge-1.example.com:8443">> =>
                          #{key_id => <<"node1">>, priv_key => Priv32}}).
```

Générez une paire de clés avec `crypto:generate_key(eddsa, ed25519)`. La
signature l’emporte sur un jeton bearer sur le même endpoint. Les clés privées ne
sont jamais écrites dans les configurations de tâches persistées.

Passer de la signature v1 (barrel_docdb < 1.4.0, sans nonce, chemin seul) à la
v2 : les serveurs en barrel_server 1.6.0+ acceptent les deux, donc mettez d’abord
à jour tous les serveurs, puis les clients, qui n’envoient que la v2 (un client
v2 face à un serveur plus ancien est refusé avec une 401 sur chaque requête
signée). Quand plus aucun client n’envoie de v1 (les acceptations v1 sont
journalisées au niveau debug), fermez la fenêtre v1 :

```erlang
application:set_env(barrel_server, auth,
                    #{accept => [signed], signers => Signers,
                      require_nonce => true}).
```

Un reverse proxy placé devant le point d’accès de synchronisation doit transmettre
le chemin et la chaîne de requête sans les modifier : la requête fait partie de
la cible signée.

La signature v3 couvre aussi les en-têtes de requête qui changent l’effet d’une
écriture : `content-type`, `if-match`, `if-none-match`, `x-barrel-actor`,
`x-barrel-session`, `x-barrel-source`, `x-barrel-hlc` et les en-têtes de pièces
jointes `x-barrel-att-origin`, `x-barrel-digest` et `x-barrel-att-touch`. Chacun
est signé comme présent avec sa valeur ou comme absent, et le serveur n’agit que
sur les valeurs signées : modifiez-en un et la requête répond 401. Les clients à
partir de barrel_docdb 2.1.0 n’envoient que la v3. Pour y passer :

1. Mettez d’abord à jour tous les serveurs en barrel_server 1.13.0 (un client v3
   est refusé par un serveur plus ancien).
2. Mettez à jour les clients. Entre-temps, les requêtes v1 et v2 continuent de
   répliquer les documents, mais le serveur ignore leur `x-barrel-hlc` et les
   refuse avec une 401 `{"error":"signature_v3_required"}` quand elles écrivent
   une pièce jointe ou portent un des autres en-têtes ci-dessus.

Un proxy doit transmettre ces en-têtes sans les modifier et ne doit pas envoyer
deux fois un en-tête signé.

Sur chaque requête signée avec un corps, sur n’importe quelle route, le serveur
vérifie le corps par rapport au `x-barrel-content-sha256` signé avant l’exécution
du handler et répond 401 `{"error":"content_hash_mismatch"}` quand il manque ou
ne correspond pas. Une requête qui présente une signature est jugée sur elle
seule : une signature invalide répond 401 même si un jeton bearer ou un
certificat client accepté aurait laissé passer la requête.

Ce que la signature vous apporte : elle authentifie le client et protège
l’intégrité de chaque requête. Elle ne cache ni la requête ni la réponse, et
n’authentifie pas les réponses du serveur. Faites passer le point d’accès de
synchronisation en HTTPS vérifié si vous avez besoin de l’un ou de l’autre. Les
requêtes bearer tirent leur intégrité du seul HTTPS.

## Comment faire (TLS et mTLS)

`barrel_server` sert du HTTP/1.1 en clair par défaut. Configurez des listeners
pour ajouter HTTP/2, HTTP/3 et TLS. Régler `verify => verify_peer` fait d’un
listener un filtre TLS mutuel : un client sans certificat signé par l’autorité de
certification est refusé lors de la poignée de main. Le client de réplication
parle HTTP/1.1 : placez donc le filtre de synchronisation sur un listener H1 sur
TLS (`tls => true` sur l’entrée `http`).

```erlang
application:set_env(barrel_server, listeners,
                    #{http  => #{port => 8443, tls => true},  %% H1 sur TLS
                      https => #{port => 8444},               %% H2
                      http3 => #{port => 8444}}),             %% H3
application:set_env(barrel_server, tls,
                    #{certfile => "server.pem", keyfile => "server.key",
                      cacertfile => "ca.pem", verify => verify_peer}),
application:set_env(barrel_server, auth, #{accept => [mtls]}).

%% client : présenter son certificat (endpoint ou env par origine)
Mtls = Endpoint#{ssl_options => [{certfile, "client.pem"},
                                 {keyfile, "client.key"},
                                 {cacertfile, "ca.pem"}]}.
```

Notes : H1-TLS et H2 sont de vrais filtres mTLS (`ssl` d’OTP). H3 sert en TLS
mais ne filtre pas encore par certificat client (un changement au niveau QUIC
est en attente) ; ne comptez pas sur H3 pour le mTLS.

Ce que le mTLS authentifie : que le client détient un certificat chaîné à
l’autorité de certification configurée, pas de quel client il s’agit.
`accept => [mtls]` seul traite chacun de ces clients comme un même pair de
confiance ayant accès à toutes les bases. Pour l’identité et des droits par base,
ajoutez par-dessus une authentification bearer ou signée
(`accept => [mtls, signed]` filtre le transport et identifie le pair par sa clé
de signature). Associer un certificat client à une identité nécessite que livery
expose le certificat du pair, ce qu’il ne fait pas encore.

Une requête est jugée sur l’identifiant qu’elle présente : une signature, sinon
un jeton bearer ou de capacité dans `Authorization`. Si cet identifiant échoue,
ou si son schéma n’est pas compris, la réponse est 401 même avec un certificat
client accepté ; le certificat seul n’authentifie que les requêtes sans en-tête
`Authorization`.

## Comment faire (réplication sélective)

Les filtres s’appliquent à la source. Les filtres de chemin et de requête se
combinent par AND :

```erlang
{ok, _} = barrel_rep:replicate(<<"source">>, <<"target">>, #{
    filter => #{
        paths => [<<"users/#">>],
        query => #{where => [{path, [<<"status">>], <<"active">>}]}
    }
}).
```

Les canaux sont l’alternative indexée : des ensembles de motifs nommés déclarés à
la création de la base, matérialisés à l’écriture dans un flux par canal, de sorte
qu’un pull filtré est un seul parcours borné au lieu d’un parcours complet du
flux :

```erlang
{ok, _} = barrel_docdb:create_db(<<"source">>, #{
    channels => #{<<"mobile">> => [<<"type/task">>, <<"owner/+">>]}
}),
{ok, _} = barrel_rep:replicate(<<"source">>, <<"target">>, #{
    filter => #{channel => <<"mobile">>}
}).
```

Notes sur les canaux :

- Les motifs sont de style MQTT (`+` pour un segment, `#` final pour le reste).
- Les canaux sont fixés à la création et indexent les écritures faites après la
  création.
- Un document qui cesse de correspondre cesse d’être envoyé ; les répliques
  gardent leur dernière copie (pas de suppression côté cible). Une nouvelle
  réplique ne voit jamais les documents partis.
- Une réplication filtrée garde son propre checkpoint (le filtre fait partie de
  l’id de réplication).

## Pièces jointes

La synchronisation des pièces jointes accompagne chaque exécution
(`attachments => true` par défaut). C’est une seconde phase après la boucle des
documents : le flux de pièces jointes de la source est comparé par empreinte avec
la cible, seul le contenu manquant est transféré, et les écritures convergent en
last-write-wins sur leur HLC d’origine. Le résultat arrive sous `att_sync` dans
le résultat de la réplication :

```erlang
{ok, #{att_sync := #{atts_written := _, atts_skipped := _}}} =
    barrel_rep:replicate(<<"source">>, Endpoint,
        #{target_transport => barrel_rep_transport_http}).
```

Notes :

- Sur HTTP, les blobs circulent par morceaux dans les deux sens ; rien ne met un
  blob entier en mémoire tampon. Les pulls n’ont pas de plafond de taille. Les
  pushs sont bornés par l’env `{barrel_server, max_body, Bytes}` du serveur
  (1 Gio par défaut, `infinity` accepté) ; un push plus gros reçoit une 413,
  échoue pour cette pièce jointe seulement, et l’exécution le signale dans
  `att_write_failures`.
- Il n’y a pas d’ordre entre les documents et leurs pièces jointes : un document
  peut arriver avant son blob (les lectures répondent 404 jusqu’à l’arrivée de
  la phase des pièces jointes).
- Les pièces jointes écrites avant cette fonctionnalité ne se synchronisent pas
  tant qu’elles ne sont pas réécrites, ou synthétisez une fois leurs lignes de
  flux avec `barrel_docdb:rebuild_attachment_feed/1`.
- Désactivez la phase avec `attachments => false` ; elle se dégrade d’elle-même
  en `att_sync => skipped` quand un côté ne peut pas suivre les pièces jointes.

## Réplication continue (tâches)

Le gestionnaire de tâches (`barrel_rep_tasks`) conserve les réplications à
travers les redémarrages. Les extrémités distantes sont des URL ; le transport
HTTP est choisi automatiquement :

```erlang
{ok, TaskId} = barrel_rep_tasks:start_task(#{
    source => <<"inventory">>,
    target => <<"http://edge-1.example.com:8080/db/inventory">>,
    mode => continuous,          %% ou one_shot
    direction => push,           %% push | pull | both
    filter => #{channel => <<"mobile">>}
}),
{ok, #{status := running}} = barrel_rep_tasks:get_task(TaskId),
ok = barrel_rep_tasks:stop_task(TaskId).
```

Comportement continu :

- Les sources locales sont pilotées par événements : la tâche se réveille sur le
  flux de changements et le vide à travers son filtre, si bien que la
  convergence locale prend quelques dizaines de millisecondes. Si le flux se
  termine, la tâche continue et passe au polling.
- Les sources distantes font un polling adaptatif, 500 ms après des données et en
  ralentissant jusqu’à 15 s au repos.
- Les erreurs transitoires ne tuent pas une tâche continue : elle temporise (de
  1 s à 60 s, avec gigue), enregistre `last_error` dans le document de tâche et
  reste `running`. Les tâches en une fois échouent vite.
- Une base locale de la tâche qui se ferme (fermeture pour inactivité,
  `close_db/1`), source ou cible, met la tâche en pause : statut `paused`,
  `paused_reason => <<"db_closed">>`. Dans les 5 s qui suivent la réouverture de
  ses bases locales, la tâche reprend depuis son checkpoint. Une tâche que vous
  avez mise en pause avec `pause_task/1` ou `stop_task/1` reste en pause.
- Les documents de tâche ne stockent les endpoints que sous forme d’URL ; les
  jetons viennent de `sync_auth`.

## Horloges

Chaque échange sur le réseau porte un en-tête `x-barrel-hlc` et les deux côtés
l’intègrent à leur horloge, en plus de la poignée de main explicite au début de
chaque exécution. Un pair trop en avance est rejeté avec `{error, clock_skew}`
(409 sur le réseau). Pour coupler les horloges à la main :

```erlang
{ok, _Merged} = barrel_docdb:sync_hlc(RemoteHlc).
```

## Clients navigateur

Le même protocole `/db/:db/_sync/*` pilote `barrel-lite`, le client navigateur
TypeScript : il garde un stockage OPFS offline-first, horodate les modifications
locales avec son propre identifiant de source, et fait push et pull sur ce
protocole (polling adaptatif ; avec `continuous: true` il garde aussi un flux SSE
`GET /db/:db/changes?feed=continuous` qui réveille le poller). Activez CORS et
émettez-lui un jeton de capacité. Voir [barrel-lite](/fr/docs/guides/barrel-lite).

## Ce qui n’est pas encore couvert

- **Vecteurs.** Les index vectoriels ne sont pas transmis ; en mode
  enregistrement, le texte et les métadonnées se répliquent comme des documents
  et l’index se reconstruit localement. Un client qui a besoin des vecteurs
  stockés les récupère avec `include_embedding` sur `GET /db/:db/doc/:id` ou
  `POST /db/:db/_bulk_get` (c’est ce que fait barrel-lite).
- **Certificats client sur HTTP/3.** Les listeners H3 servent en TLS mais ne
  vérifient pas les certificats client ; utilisez H1-TLS ou H2 pour un filtre
  mTLS.
- **API Barrel.** `barrel` (la base embarquable complète) n’expose pas la
  réplication ; appelez `barrel_rep` et `barrel_rep_tasks` sur le nom docdb
  sous-jacent.
- **Provenance.** L’acteur, la session et la source portés par une écriture
  (voir [audit-provenance](/fr/docs/guides/audit-provenance)) ne voyagent pas sur
  le réseau. Les arrivées répliquées sont attribuées `cause: replicated` avec
  l’identité de la base d’origine ; l’agent qui a agi reste dans la piste propre
  à l’origine.
