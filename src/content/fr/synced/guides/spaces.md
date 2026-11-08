---
translation_of: src/content/synced/guides/spaces.md
source_hash: "43b69fe382a826e6"
title: "Espaces, sessions et passations"
description: "La couche agents : un espace est une base barrel créée via barrel_spaces, partagée en détenant un jeton de capacité pour elle. Les sessions donnent aux agents un contexte de travail avec un TTL glissant dans un espace ; une passation transfère un travail à un autre agent sous forme d’un jeton dont la possession donne le droit d’accepter. Lisez ce guide si vous coordonnez plusieurs agents sur un contexte partagé."
source: "docs/guides/spaces.md"
---

La couche agents : un espace est une base barrel créée via `barrel_spaces`,
partagée en détenant un jeton de capacité pour elle. Les sessions donnent aux
agents un contexte de travail avec un TTL glissant dans un espace ; une
passation transfère un travail à un autre agent sous forme d’un jeton dont la
possession donne le droit d’accepter. Lisez ce guide si vous coordonnez
plusieurs agents sur un contexte partagé.

## Quand l’utiliser

- Plusieurs agents doivent lire et écrire le même contexte sans le copier.
- Vous voulez un accès révocable, par espace, plutôt qu’un seul identifiant
  global.
- Des agents se passent des tâches et celui qui reçoit doit voir le contexte de
  l’émetteur sur place.

## Espaces et jetons de capacité

Un espace est une base avec un nom généré (`sp_` + 16 caractères) plus un
document de registre dans la base système `_barrel_spaces`. Les bases d’espace
s’ouvrent via le gestionnaire de cycle de vie des bases de Barrel : les espaces
inactifs se ferment d’eux-mêmes et des centaines d’espaces éphémères restent peu
coûteux.

```erlang
{ok, _} = application:ensure_all_started(barrel_spaces),
{ok, #{id := SpaceId, db := Db}} = barrel_spaces:create_space(#{
    label => <<"joint research">>,
    session_ttl => 3600           %% TTL de session par défaut, en secondes
}),
%% Db est un handle barrel ordinaire : documents, recherche, timeline fonctionnent
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"notes">>}),

%% accorder l'accès : le jeton n'est montré qu'une fois, seul son hash est stocké
{ok, Token, _Grant} = barrel_caps:grant(SpaceId, #{
    rights => [read, write],      %% read < write < admin
    subject => <<"agent-bob">>}),

%% le détenteur vérifie (ou résout un contexte d'authentification)
{ok, _} = barrel_caps:verify(Token, SpaceId, write),
{ok, #{space := SpaceId, rights := _}} = barrel_caps:auth_context(Token),

%% révoquer un accès, ou supprimer l'espace (révoque tout)
ok = barrel_caps:revoke(Token),
ok = barrel_spaces:drop_space(SpaceId).
```

`open_space/2` rouvre un espace existant ; les options d’exécution (une
spécification `encryption`, une configuration de stockage supplémentaire)
doivent être repassées à chaque ouverture, exactement comme pour toute base
barrel.

### Un espace en mode enregistrement

Donnez à `create_space/1` une politique `embedding` et l’espace indexe les
champs que vous nommez, comme toute base en mode enregistrement (voir
[embedding](/fr/docs/guides/embedding)) :

```erlang
Embedder = {ollama, #{model => <<"nomic-embed-text">>}},
{ok, #{id := SpaceId}} = barrel_spaces:create_space(#{
    embedding => #{fields => [<<"text">>], mode => sync,
                   embedder => Embedder}}).
```

Le document d’espace enregistre les champs de la politique et l’identité de
l’embedder (fournisseur, modèle, dimensions, distance, empreinte), pas la
configuration de l’embedder : le registre est répliqué, et une configuration peut
contenir des chemins et des clés d’API. Chaque nœud qui ouvre l’espace fournit sa
propre configuration pour le même modèle :

```erlang
application:set_env(barrel_spaces, embedder, Embedder),
{ok, #{db := Db}} = barrel_spaces:open_space(SpaceId).
```

L’ouverture vérifie d’abord l’empreinte. Un autre modèle répond
`{error, {embedder_mismatch, _}}` ; l’absence d’env `embedder` répond
`{error, {embedder_required, Fingerprint}}`. Un espace atteint via barrel_server
(ses routes `/db` et de synchronisation) s’ouvre de la même façon, donc la
première route qui le touche ne décide pas de son mode. L’isolation repose sur
des clés de chiffrement par espace : voir [encryption](/fr/docs/guides/encryption).

## Sessions

Une session est un document de la base d’espace écrit avec un TTL ; chaque
modification le fait glisser. Les messages sont des documents séparés dont les
ids se trient chronologiquement. Une session expirée disparaît immédiatement des
lectures et reçoit une pierre tombale du balayeur TTL de l’espace ; un janitor
collecte ensuite ses messages orphelins.

```erlang
{ok, Space} = barrel_spaces:open_space(SpaceId),
{ok, Sid} = barrel_session:create(Space, #{agent => <<"alice">>,
                                           ttl => 1800}),
{ok, _} = barrel_session:add_message(Space, Sid, #{
    role => <<"user">>, content => <<"draft is half done">>}),
{ok, Messages} = barrel_session:get_messages(Space, Sid,
                                             #{limit => 50, order => desc}),
{ok, _ExpiresAt} = barrel_session:touch(Space, Sid),

%% état de travail structuré et contexte épinglé
{ok, _} = barrel_session:set_data(Space, Sid, <<"cursor">>, 42),
{ok, PinId} = barrel_session:pin_context(Space, Sid,
                                         #{content => <<"key fact">>,
                                           priority => 0}),
{ok, Pinned} = barrel_session:list_pinned(Space, Sid),
ok = barrel_session:delete(Space, Sid).   %% supprime aussi les messages
```

### Sessions durables

Passez `ttl => infinity` (ou 0) pour créer une session qui n’expire jamais : un
enregistrement, pas un cache. Les modifications renvoient alors `{ok, 0}` au lieu
d’une heure d’expiration, et le balayeur TTL l’ignore.

```erlang
{ok, Rec} = barrel_session:create(Space, #{agent => <<"alice">>,
                                           ttl => infinity}),
{ok, 0} = barrel_session:touch(Space, Rec).
```

### Listage filtré

`list/2` filtre via les index de chemins de la base d’espace : un espace qui
contient des milliers de sessions ne paie pas un parcours complet.

```erlang
{ok, Mine} = barrel_session:list(Space, #{
    match => #{<<"data.user_id">> => <<"u1">>},   %% n'importe quel chemin de champ
    agent => <<"alice">>,                         %% se combine avec match
    limit => 50}).
```

### Importer un corpus existant

Les sessions et les messages arrivent avec leurs propres ids et horodatages ; le
module reste maître du schéma des documents :

```erlang
{ok, _} = barrel_session:create(Space, #{id => <<"legacy-1">>}),
{ok, _} = barrel_session:import_session(Space, #{
    id => <<"legacy-2">>, agent => <<"old-bot">>,
    data => #{<<"user_id">> => <<"u1">>},
    created_at => 1750000000000, updated_at => 1750000100000}),
    %% pour les imports, le ttl vaut jamais par défaut ; ttl > 0 démarre à updated_at
{ok, _} = barrel_session:import_message(Space, <<"legacy-2">>, #{
    role => <<"user">>, content => <<"hello">>,
    ts => 1750000050000, id => <<"msg-legacy-1">>}),   %% pas de glissement du TTL
%% les épingles gardent aussi leur id, leur horodatage et leurs métadonnées
{ok, _} = barrel_session:pin_context(Space, <<"legacy-2">>, #{
    id => <<"pin-legacy-1">>, content => <<"key fact">>,
    pinned_at => 1750000060000, metadata => #{<<"src">> => <<"v1">>}}).
```

Un id d’appelant en double échoue avec `{error, conflict}` (un id de session à
la création, un id de message à l’import, un id d’épingle à l’épinglage),
jamais en silence.

### TTL des documents (le mécanisme sous-jacent)

Les sessions reposent sur une primitive générale qui fonctionne sur toute base
barrel : l’option d’écriture `expires_at` (ms unix). Les documents expirés se
lisent immédiatement comme introuvables ; un balayeur optionnel par base les
transforme en vraies pierres tombales (pour que la réplication et les branches
restent correctes).

```erlang
{ok, _} = barrel:put_doc(Db, Doc, #{expires_at => Now + 60000}),
%% absent = conserver l'expiration actuelle, 0 = l'effacer
{ok, Swept} = barrel_docdb:sweep_ttl(DbName).
```

Activez le balayeur avec `ttl_sweep_interval` (ms) dans la configuration docdb
de la base ; les espaces le règlent à 60000 par défaut.

## Passations

Une passation est un espace partagé plus une capacité. En créer une émet un
accès et renvoie le jeton une seule fois ; quiconque détient le jeton accepte.
Accepter fait passer le document de passation de pending à accepted par un CAS
(une double acceptation perd), ouvre l’espace et y crée une session pour celui
qui accepte : le contexte est lu sur place, rien n’est copié.

```erlang
{ok, #{handoff_id := Hid, token := HandoffToken}} =
    barrel_handoff:create(Space, #{
        task_name => <<"finish the draft">>,
        from_agent => <<"alice">>, to_agent => <<"bob">>,
        from_session => Sid,
        pending => [<<"polish conclusion">>]}),

%% bob, qui ne détient que le jeton :
{ok, #{handoff := H, space := BobSpace, session := BobSid}} =
    barrel_handoff:accept(HandoffToken, #{agent => <<"bob">>}),

%% ou accepter sur la seule discipline du jeton (aucun espace ouvert, aucune
%% session créée), pour les consommateurs qui ont leur propre modèle de session :
%% {ok, #{handoff := H2}} =
%%     barrel_handoff:accept(HandoffToken, #{agent => <<"bob">>,
%%                                           session => false}),

%% le travail se fait dans l'espace partagé, puis :
{ok, _} = barrel_handoff:complete(HandoffToken,
                                  #{result => <<"shipped">>}),
%% la complétion révoque le jeton par défaut

%% ou la transmettre, en gardant la lignée (parent/root/depth)
{ok, #{token := NextToken}} = barrel_handoff:chain(HandoffToken, #{
    task_name => <<"review the draft">>, to_agent => <<"carol">>}).
```

Les documents de passation vivent dans la base de registre : les passations en
attente se découvrent avec `barrel_handoff:list/1` (filtres : `space`, `status`,
`to_agent`, `from_agent`) ou en s’abonnant au flux de changements du registre.

## Sur REST et MCP

`barrel_server` expose tout cela sous `/spaces` et `/handoffs` ; les jetons de
capacité y fonctionnent comme bearers (et seulement là). Voir
[rest-server](/fr/docs/guides/rest-server). Les mêmes opérations existent comme
outils MCP (`space_*`, `session_*`, `handoff_*`) ; voir [mcp](/fr/docs/guides/mcp).

## Notes

- Échelle des droits : `read < write < admin`. Admin couvre l’octroi, la
  révocation et l’émission de passations. La vérification est locale (le
  registre est une base sur le même nœud) ; les jetons sont aléatoires, stockés
  hachés, comparés en temps constant.
- Le nom de la base de registre vient de l’env `registry_db` de l’application
  `barrel_spaces` (par défaut `_barrel_spaces`) ; définissez-le avant la
  première utilisation. Le registre est une base barrel ordinaire : l’ouvrir via
  `barrel_dbs` à côté de cette couche est pris en charge.
- Répliquer le registre est voulu. Les documents d’accès sont un état
  d’autorisation : c’est la réplication qui permet à un jeton émis sur un nœud
  d’être vérifié sur un autre ; en contrepartie, la révocation se propage à la
  vitesse de la réplication. Gardez une réplication du registre serrée si la
  latence de révocation compte pour vous.
- Le stockage vectoriel d’un espace est propre à chaque nœud. Il vit dans
  `<data_dir>/<space id>_vec`, résolu à chaque ouverture depuis le `data_dir`
  local de `barrel_docdb`, donc un document d’espace répliqué s’ouvre sur
  n’importe quel nœud. Répliquer le registre transporte les métadonnées et les
  accès, pas la mémoire : les vecteurs restent sur le nœud qui les a écrits. Un
  `vectordb => #{db_path => ...}` personnalisé donné à la création est conservé
  tel quel et doit exister sur chaque nœud qui ouvre l’espace.
- `barrel_caps:grant/2` n’exige pas que l’espace existe. Accorder sur une portée
  purement logique (un id de tenant, un id de passation) est pris en charge : des
  jetons révocables, hachés au repos, avec échelle de droits, sans base d’espace
  derrière eux.
- Le registre (`_barrel_spaces`) contient les documents d’espace, d’accès et de
  passation comme des documents ordinaires : les folds et le flux de changements
  les voient.
- Un espace chiffré a besoin de sa spécification de chiffrement à chaque
  ouverture, y compris dans `barrel_handoff:accept/2` (passez `open_opts`). Sur
  REST et MCP, les espaces s’ouvrent avec les options par défaut : les espaces
  chiffrés ne sont donc accessibles que par l’API Erlang en v1.
- `barrel_spaces_janitor` balaie périodiquement les messages de session
  orphelins des espaces ouverts (`janitor_interval`, 5 minutes par défaut) ;
  `barrel_spaces_janitor:sweep/0` lance un passage immédiatement.
