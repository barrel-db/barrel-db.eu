---
translation_of: src/content/synced/guides/embedding-barrel-server.md
source_hash: "c036d066ee835cc1"
title: "Embarquer le serveur barrel dans une application livery"
description: "barrel_server_api expose les routes REST et de synchronisation de barrel sous forme d’une simple liste de routes livery, pour qu’une autre application Erlang les serve depuis son propre service livery, éventuellement sous un sous-chemin, avec sa propre authentification. Lisez ce guide si vous voulez que barrel-lite (ou tout client HTTP) atteigne barrel via le point d’accès d’une application hôte."
source: "docs/guides/embedding-barrel-server.md"
---

`barrel_server_api` expose les routes REST et de synchronisation de barrel sous
forme d’une simple liste de routes `livery`, pour qu’une autre application Erlang
les serve depuis son **propre** service livery, éventuellement sous un
sous-chemin, avec sa propre authentification. Lisez ce guide si vous voulez que
`barrel-lite` (ou tout client HTTP) atteigne barrel via le point d’accès d’une
application hôte au lieu de lancer le listener autonome `barrel_server`.

## Quand l’utiliser

- Vous faites déjà tourner un service `livery` et voulez y ajouter la surface
  `/db` + `/_sync` de barrel, par exemple sous `/barrel`.
- Vous voulez que l’application hôte gère l’authentification et CORS plutôt que
  le bearer et le CORS intégrés à barrel.
- Pour un serveur HTTP autonome clé en main, lancez plutôt `barrel_server`
  directement (voir [rest-server](/fr/docs/guides/rest-server)).

## Comment faire

Démarrez `barrel` et `barrel_spaces`, puis montez le routeur de barrel dans le
vôtre. La surface DB n’a pas besoin du superviseur `barrel_server` : les handlers
sont sans état.

```erlang
%% 1. Indiquez à barrel un répertoire de données et démarrez-le (pas barrel_server).
application:set_env(barrel_docdb, data_dir, "/var/lib/myapp/barrel"),
{ok, _} = application:ensure_all_started(barrel),
{ok, _} = application:ensure_all_started(barrel_spaces),

%% 2. Montez la surface DB par défaut de barrel sous /barrel, dans votre routeur.
BarrelRouter = barrel_server_api:router(),
Router = livery_router:nest(<<"/barrel">>, BarrelRouter, MyHostRouter),

%% 3. Servez-le. Votre middleware gère l'authentification ; barrel n'en fournit aucune ici.
{ok, _} = livery:start_service(#{
    http       => #{port => 8080},
    router     => Router,
    middleware => MyAuthStack
}).
```

`barrel-lite` pointe alors vers le sous-chemin, sans changement côté client :

```ts
const db = openBarrel({ url: "https://host/barrel", db: "mydb" });
```

## Choisir les routes

`routes/0` (et `router/0`) renvoient la surface DB par défaut : les groupes `db`,
`sync`, `timeline` et `search`, c’est-à-dire ce qu’utilise barrel-lite. Passez
`groups` pour l’élargir ou la restreindre ; `mcp`, `contexts` et la couche agents
`spaces`/`handoffs` sont optionnels.

```erlang
barrel_server_api:routes().                              %% surface DB (par défaut)
barrel_server_api:routes(#{groups => [db, sync]}).       %% docs + protocole de sync seulement
barrel_server_api:routes(#{groups => all}).              %% tout
barrel_server_api:router(#{prefix => <<"/barrel">>}).    %% routeur déjà imbriqué
```

Groupes : `meta` (`/`, `/health`), `db`, `sync`, `timeline`, `search`, `spaces`,
`contexts` (`/contexts`, `/worksets`), `mcp`. Un nom inconnu lève `{unknown_route_group, Name}`.

## Notes

- L’hôte gère l’authentification. `barrel_server_api` ne renvoie que des routes ;
  enveloppez-les avec votre propre middleware (`livery_router:layer/2` sur le
  sous-arbre barrel, ou une pile à l’échelle du service). Le bearer et le CORS
  intégrés à barrel vivent dans le service autonome `barrel_server` et ne
  s’appliquent pas ici.
- Définissez vous-même le `data_dir` de `barrel_docdb` (la correspondance de
  configuration de l’application `barrel_server` ne s’exécute pas si vous ne
  démarrez pas cette application). Les options d’ouverture à l’échelle du serveur
  viennent de `{barrel_server, open_opts, Map}` s’il est défini.
- Le groupe `mcp` a besoin du registrar MCP et du pont de requêtes en direct ;
  pour cela, démarrez l’application `barrel_server` avec le listener HTTP
  désactivé, et notez que `/mcp` sous un sous-chemin n’est pas encore vérifié. La
  surface DB n’a besoin ni de l’un ni de l’autre.
- Les chemins des routes, les formes des requêtes et réponses et le comportement
  des changements/SSE sont identiques à ceux du serveur autonome ; voir
  [rest-server](/fr/docs/guides/rest-server).
