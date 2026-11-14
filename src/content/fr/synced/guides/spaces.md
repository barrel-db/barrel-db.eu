---
translation_of: src/content/synced/guides/spaces.md
source_hash: "4054e91a5fa21e76"
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

Une session est un document d’en-tête de la base d’espace écrit avec un TTL ;
chaque modification le fait glisser. Chaque clé de données, chaque épingle, le
résumé et les compteurs de chaque réplique sont des documents à part, et les
messages sont des documents dont les ids se trient chronologiquement. Une
session expirée disparaît immédiatement des lectures et son en-tête reçoit une
pierre tombale du balayeur TTL de l’espace ; un janitor collecte ensuite ses
documents orphelins.

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
{ok, _} = barrel_session:delete_data(Space, Sid, <<"cursor">>),
{ok, PinId} = barrel_session:pin_context(Space, Sid,
                                         #{content => <<"key fact">>,
                                           priority => 0}),
{ok, Pinned} = barrel_session:list_pinned(Space, Sid),
{ok, _} = barrel_session:unpin_context(Space, Sid, PinId),

%% compteurs : aucun incrément n'est perdu quand deux nœuds comptent en même temps
{ok, 21} = barrel_session:incr_counter(Space, Sid, <<"messages">>, 1),
{ok, #{<<"messages">> := 21}} = barrel_session:get_counters(Space, Sid),
ok = barrel_session:delete(Space, Sid).   %% supprime aussi tous les documents
```

Un compteur ne monte ou ne descend que des quantités que vous ajoutez. Pour
compter « les messages depuis la dernière extraction », gardez le compteur de
messages et stockez son total au moment de la dernière extraction dans une clé
de données : la différence donne le nombre depuis.

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
Accepter enregistre celui qui accepte (une deuxième acceptation est refusée),
ouvre l’espace et y crée une session pour celui qui accepte : le contexte est
lu sur place, rien n’est copié.

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
Chaque étape est un document écrit une seule fois : la passation à la création,
une acceptation par agent, la complétion. Le statut est l’étape la plus avancée
présente.

## Répliquer un espace et son registre

Répliquez le registre et une base d’espace entre nœuds comme n’importe quelle
base barrel. Chaque fait d’accès, de session et de passation est un document
écrit une seule fois ou remplacé en entier : la version que montre chaque nœud
est donc déjà la réponse. barrel_spaces ouvre le registre et ses espaces avec
`barrel_spaces_resolver`, qui clôt chaque conflit sur ces documents en
choisissant cette version, de la même façon sur chaque nœud :

- Une révocation est un document `revoke:` à part. Un accès modifié ailleurs
  ne peut pas l’annuler, et deux nœuds qui révoquent le même jeton sont
  d’accord.
- Deux nœuds qui écrivent des clés, des épingles ou le résumé différents d’une
  même session gardent les deux écritures. La même clé écrite sur deux nœuds
  garde l’écriture la plus récente.
- Retirer une clé de données ou une épingle se réplique comme une suppression :
  un nœud qui détient encore l’ancienne copie ne peut pas la faire revenir.
- Une passation ne revient jamais de completed à accepted, ni de accepted à
  pending. Quand deux agents l’acceptent sur des nœuds qui ne se voient pas,
  les deux acceptations sont gardées et chaque nœud désigne le même
  propriétaire : le `accepted_at` le plus ancien, puis le nom de l’agent.
- Les compteurs sont par réplique et additionnés : aucun incrément n’est perdu.

```erlang
%% nœud A
ok = barrel_caps:revoke(TokenId, #{by => <<"ops">>}),

%% nœud B, après réplication
{error, revoked} = barrel_caps:verify(Token, SpaceId, read),
{ok, [#{<<"revoked_by">> := <<"ops">>}]} = barrel_caps:list(SpaceId).
```

### Votre propre résolveur de conflits

Une base d’espace contient aussi vos documents. Passez votre résolveur avec
`docdb => #{conflict_resolver => {M, F}}` à `create_space/1` ou
`open_space/2` : barrel_spaces l’enveloppe, traite les documents `session:` et
confie tous les autres documents au vôtre. Si vous ouvrez vous-même le registre
ou une base d’espace, définissez `{barrel_spaces_resolver, registry}` sur le
registre, et `barrel_spaces_resolver:with({M, F})` (ou `{barrel_spaces_resolver,
space}`) sur un espace. Comme pour tout résolveur, chaque nœud doit exécuter le
même.

### Mettre à jour depuis 1.x

2.0 stocke les accès, les sessions et les passations autrement, et demande
barrel_docdb 3.1. Des nœuds qui exécutent les deux versions ne s’accordent pas.
Mettez donc à jour tous les nœuds du maillage dans cet ordre :

1. Mettez à jour barrel_docdb en 3.1 sur chaque nœud. Vous pouvez le faire un
   nœud à la fois : le protocole de réplication ne change pas, et un nœud 3.1
   refuse les versions mélangées qu’un nœud 3.0 envoie encore. Chaque base
   convertit son historique de versions la première fois que 3.1 l’ouvre, en un
   seul passage, et journalise combien de lignes elle a déplacées et combien de
   documents elle a réparés.
2. Arrêtez d’écrire via barrel_spaces, ou arrêtez de répliquer le registre et
   les bases d’espace.
3. Mettez à jour barrel_spaces en 2.0 (et barrel_server en 1.15.1) sur chaque
   nœud.
4. Sur un nœud, lancez `barrel_spaces:migrate/0`. Il convertit le registre et
   chaque espace qui s’ouvre sans options d’exécution, et liste les autres dans
   `skipped`. Ouvrez chaque espace ignoré (un espace chiffré avec sa clé) et
   lancez `barrel_session:migrate/1`.
5. Reprenez la réplication. Les autres nœuds reçoivent les documents convertis.
6. Reprenez les écritures.

```erlang
{ok, #{grants := G, handoffs := H, sessions := S, skipped := Skipped}} =
    barrel_spaces:migrate(),
[begin
     {ok, Space} = barrel_spaces:open_space(Id, #{encryption => Spec}),
     {ok, _} = barrel_session:migrate(Space)
 end || Id <- Skipped].
```

Les documents que vous ne convertissez pas se lisent de la même façon, et se
convertissent à leur prochaine écriture.

Ce qui se passe mal si vous sautez l’étape 2 et qu’un nœud 1.x continue
d’écrire :

| Sur un nœud 1.x | Effet |
|---|---|
| Vérifier un jeton | Il ignore les documents `revoke:` et accepte un jeton révoqué sur un nœud 2.0. |
| Lire une session | Il ne trouve aucune donnée, épingle ni résumé écrits par 2.0. |
| `set_data/4` sur une clé existante | 2.0 continue d’afficher sa propre valeur ; seules les nouvelles clés apparaissent. |
| `unpin_context/3` | L’épingle revient sur les nœuds 2.0. |
| Accepter une passation | Une passation acceptée sur 2.0 paraît en attente : une deuxième acceptation réussit et le propriétaire peut changer. |

Une révocation 1.x tient toujours sur les nœuds 2.0, qui lisent les deux
formats.

Il n’y a pas de retour en arrière : 1.x ne sait pas lire les sessions
converties, et une base ouverte par barrel_docdb 3.1 perd ses conflits et ses
versions passées sous 3.0.

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
- Le registre (`_barrel_spaces`) contient les documents d’espace, d’accès, de
  révocation et de passation comme des documents ordinaires : les folds et le flux de changements
  les voient.
- Un espace chiffré a besoin de sa spécification de chiffrement à chaque
  ouverture, y compris dans `barrel_handoff:accept/2` (passez `open_opts`). Sur
  REST et MCP, les espaces s’ouvrent avec les options par défaut : les espaces
  chiffrés ne sont donc accessibles que par l’API Erlang en v1.
- `barrel_spaces_janitor` balaie périodiquement les documents de session
  orphelins des espaces ouverts (`janitor_interval`, 5 minutes par défaut) ;
  `barrel_spaces_janitor:sweep/0` lance un passage immédiatement.
