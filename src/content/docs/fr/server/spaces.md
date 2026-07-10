---
title: Espaces et agents
description: Coordonnez plusieurs agents sur un contexte partage avec des espaces, des sessions et des handoffs adosses a des jetons de capacite.
---

La couche agent : un espace est une base de donnees barrel creee a travers
`barrel_spaces`, partagee en detenant un jeton de capacite pour elle. Les sessions
donnent aux agents un contexte de travail avec un TTL glissant dans un espace ; un
handoff transfere du travail a un autre agent comme un jeton dont la possession est
le droit d'accepter. Lisez ceci quand vous coordonnez plusieurs agents sur un
contexte partage.

## Quand l'utiliser

- Plusieurs agents ont besoin de lire et ecrire le meme contexte sans le copier.
- Vous voulez un acces revocable, par espace, au lieu d'un seul identifiant
  global.
- Les agents se passent des taches et le destinataire doit voir le contexte de
  l'emetteur en place.

## Espaces et jetons de capacite

Un espace est une base de donnees avec un nom genere (`sp_` + 16 caracteres) plus
un document de registre dans la base de donnees systeme `_barrel_spaces`. Les
bases de donnees d'espace s'ouvrent a travers le gestionnaire de cycle de vie des
bases de Barrel, ainsi les espaces inactifs se ferment eux-memes et des centaines
d'espaces ephemeres restent bon marche.

```erlang
{ok, _} = application:ensure_all_started(barrel_spaces),
{ok, #{id := SpaceId, db := Db}} = barrel_spaces:create_space(#{
    label => <<"joint research">>,
    session_ttl => 3600           %% default session TTL, seconds
}),
%% Db is a regular barrel handle: documents, search, timeline all work
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"notes">>}),

%% grant access: the token is shown once, only its hash is stored
{ok, Token, _Grant} = barrel_caps:grant(SpaceId, #{
    rights => [read, write],      %% read < write < admin
    subject => <<"agent-bob">>}),

%% the holder verifies (or resolves an auth context)
{ok, _} = barrel_caps:verify(Token, SpaceId, write),
{ok, #{space := SpaceId, rights := _}} = barrel_caps:auth_context(Token),

%% revoke one grant, or drop the space (revokes everything)
ok = barrel_caps:revoke(Token),
ok = barrel_spaces:drop_space(SpaceId).
```

`open_space/2` rouvre un espace existant ; les options d'execution (une spec
`encryption`, une config de store supplementaire) doivent etre repassees a chaque
ouverture, exactement comme pour n'importe quelle base de donnees barrel. Les cles
de chiffrement par espace sont l'histoire d'isolation : voir
[chiffrement](/fr/docs/guides/encryption).

## Sessions

Une session est un document dans la base de donnees d'espace ecrit avec un TTL ;
chaque mutation le fait glisser. Les messages sont des documents separes dont les
ids se trient chronologiquement. Une session expiree disparait des lectures
immediatement et est marquee d'un tombstone par le balayeur de TTL de l'espace ; un
janitor collecte ensuite ses messages orphelins.

```erlang
{ok, Space} = barrel_spaces:open_space(SpaceId),
{ok, Sid} = barrel_session:create(Space, #{agent => <<"alice">>,
                                           ttl => 1800}),
{ok, _} = barrel_session:add_message(Space, Sid, #{
    role => <<"user">>, content => <<"draft is half done">>}),
{ok, Messages} = barrel_session:get_messages(Space, Sid,
                                             #{limit => 50, order => desc}),
{ok, _ExpiresAt} = barrel_session:touch(Space, Sid),

%% structured working state and pinned context
{ok, _} = barrel_session:set_data(Space, Sid, <<"cursor">>, 42),
{ok, PinId} = barrel_session:pin_context(Space, Sid,
                                         #{content => <<"key fact">>,
                                           priority => 0}),
{ok, Pinned} = barrel_session:list_pinned(Space, Sid),
ok = barrel_session:delete(Space, Sid).   %% cascades to messages
```

### TTL de document (la machinerie en dessous)

Les sessions empruntent une primitive generale qui fonctionne sur n'importe quelle
base de donnees barrel : l'option d'ecriture `expires_at` (ms unix). Les documents
expires se lisent comme introuvables immediatement ; un balayeur par base de
donnees a activer les transforme en vrais tombstones (pour que la replication et
les branches restent correctes).

```erlang
{ok, _} = barrel:put_doc(Db, Doc, #{expires_at => Now + 60000}),
%% absent = preserve the current expiry, 0 = clear it
{ok, Swept} = barrel_docdb:sweep_ttl(DbName).
```

Activez le balayeur avec `ttl_sweep_interval` (ms) dans la config docdb de la base
de donnees ; les espaces le mettent a 60000 par defaut.

## Handoffs

Un handoff est un espace partage plus une capacite. En creer un emet une
autorisation et renvoie le jeton une fois ; quiconque detient le jeton accepte.
Accepter fait passer le document de handoff de en-attente a accepte avec un CAS
(les doubles acceptations perdent), ouvre l'espace, et cree une session pour
l'accepteur dedans : le contexte est lu en place, rien n'est copie.

```erlang
{ok, #{handoff_id := Hid, token := HandoffToken}} =
    barrel_handoff:create(Space, #{
        task_name => <<"finish the draft">>,
        from_agent => <<"alice">>, to_agent => <<"bob">>,
        from_session => Sid,
        pending => [<<"polish conclusion">>]}),

%% bob, holding only the token:
{ok, #{handoff := H, space := BobSpace, session := BobSid}} =
    barrel_handoff:accept(HandoffToken, #{agent => <<"bob">>}),

%% work happens in the shared space, then:
{ok, _} = barrel_handoff:complete(HandoffToken,
                                  #{result => <<"shipped">>}),
%% completion revokes the token by default

%% or hand it on, keeping the lineage (parent/root/depth)
{ok, #{token := NextToken}} = barrel_handoff:chain(HandoffToken, #{
    task_name => <<"review the draft">>, to_agent => <<"carol">>}).
```

Les documents de handoff vivent dans la base de donnees de registre, ainsi les
handoffs en attente sont decouvrables avec `barrel_handoff:list/1` (filtres :
`space`, `status`, `to_agent`, `from_agent`) ou en s'abonnant au flux de
changements du registre.

## Via REST et MCP

`barrel_server` expose tout ceci sous `/spaces` et `/handoffs` ; les jetons de
capacite fonctionnent comme bearers la (et seulement la). Voir
[rest-server](/fr/docs/server/rest-server). Les memes operations existent comme
outils MCP (`space_*`, `session_*`, `handoff_*`) ; voir
[mcp](/fr/docs/server/mcp).

## Notes

- Echelle des droits : `read < write < admin`. Admin couvre l'octroi, la
  revocation, et l'emission de handoff. La verification est locale (le registre est
  une base de donnees sur le meme noeud) ; les jetons sont aleatoires, stockes
  haches, compares en temps constant.
- Le registre (`_barrel_spaces`) tient les documents d'espace, d'autorisation et
  de handoff comme des documents ordinaires : les folds et le flux de changements
  les voient.
- Un espace chiffre a besoin de sa spec de chiffrement a chaque ouverture, y
  compris a l'interieur de `barrel_handoff:accept/2` (passez `open_opts`). Via REST
  et MCP, les espaces s'ouvrent avec les options par defaut, ainsi les espaces
  chiffres sont reserves a l'API Erlang en v1.
- `barrel_spaces_janitor` balaie periodiquement les messages de session orphelins
  des espaces ouverts (`janitor_interval`, 5 minutes par defaut) ;
  `barrel_spaces_janitor:sweep/0` execute une passe maintenant.
