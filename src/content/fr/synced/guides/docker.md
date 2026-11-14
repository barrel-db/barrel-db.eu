---
translation_of: src/content/synced/guides/docker.md
source_hash: "f97642b406f5041c"
title: "Lancer barrel dans Docker"
description: "L’image barrel-server lance barrel_server, le nœud HTTP de barrel, avec les backends de pièces jointes système de fichiers et S3. Utilisez-la quand vous voulez un nœud barrel sur un serveur ou dans un cluster sans installer Erlang."
source: "docs/guides/docker.md"
---

L’image `barrel-server` lance `barrel_server`, le nœud HTTP de barrel, avec les backends de pièces jointes système de fichiers et S3. Utilisez-la quand vous voulez un nœud barrel sur un serveur ou dans un cluster sans installer Erlang. Vous la configurez avec des variables d’environnement, ou vous montez votre propre `sys.config` quand il vous en faut plus.

## Démarrer un nœud

```console
$ docker run -d --name barrel -p 8080:8080 \
    -v barrel-data:/data \
    -e BARREL_AUTH_TOKENS=change-me \
    ghcr.io/barrel-db/barrel-server:latest
$ curl localhost:8080/ready
{"status":"ready"}
```

Créez une base et écrivez un document :

```console
$ curl -XPUT localhost:8080/db/notes -H 'authorization: Bearer change-me'
$ curl -XPUT localhost:8080/db/notes/doc/hello -H 'authorization: Bearer change-me' \
    -H 'content-type: application/json' -d '{"text": "hello"}'
```

Le [guide du serveur REST](/fr/docs/guides/rest-server) liste toutes les routes.

## Réglages

| Variable | Défaut | Ce qu’elle règle |
|---|---|---|
| `BARREL_HTTP_PORT` | `8080` | Port HTTP dans le conteneur |
| `BARREL_DATA_DIR` | `/data` | Où vivent les bases et les index ; gardez-le sur un volume |
| `BARREL_AUTH_TOKENS` | aucun | Jetons bearer séparés par des virgules |
| `BARREL_AUTH_TOKENS_FILE` | aucun | Un fichier avec un jeton par ligne, pour les secrets Docker ou Kubernetes |
| `BARREL_LOG_LEVEL` | `info` | `debug`, `info`, `notice`, `warning` ou `error` |
| `BARREL_NODE_NAME` | `barrel@127.0.0.1` | Nom du nœud Erlang |
| `BARREL_COOKIE` | aléatoire | Cookie de distribution Erlang |

Sans jeton, le serveur accepte toutes les requêtes et journalise un avertissement au démarrage. Définissez au moins un jeton sur tout nœud que d’autres peuvent joindre. `/health` et `/ready` n’ont jamais besoin de jeton.

## Garder les jetons dans un secret

```yaml
services:
  barrel:
    image: ghcr.io/barrel-db/barrel-server:latest
    ports: ["8080:8080"]
    volumes: ["barrel-data:/data"]
    environment:
      BARREL_AUTH_TOKENS_FILE: /run/secrets/barrel_tokens
    secrets: [barrel_tokens]
secrets:
  barrel_tokens:
    file: ./tokens.txt
volumes:
  barrel-data:
```

## Utiliser votre propre configuration

Pour les listeners TLS, HTTP/2 et HTTP/3, les requêtes signées, CORS, MCP ou les pièces jointes S3, écrivez un `sys.config` et montez-le sur `/etc/barrel/sys.config`. Les variables d’environnement ci-dessus sont alors ignorées. Montez `/etc/barrel/vm.args` de la même façon pour définir les options de la VM Erlang.

```erlang
[
 {barrel_server, [
   {data_dir, "/data/docdb"},
   {auth, #{tokens => [<<"change-me">>]}},
   {listeners, #{https => #{port => 8443}}},
   {tls, #{certfile => "/etc/barrel/cert.pem", keyfile => "/etc/barrel/key.pem"}}
 ]},
 {barrel_docdb, [{data_dir, "/data/docdb"}]},
 {barrel_ngram, [{data_dir, "/data/ngram"}]}
].
```

```console
$ docker run -d -p 8443:8443 -v barrel-data:/data \
    -v $PWD/barrel:/etc/barrel:ro \
    ghcr.io/barrel-db/barrel-server:latest
```

Le [guide de synchronisation](/fr/docs/guides/synchronization) décrit les clés des listeners et de TLS.

## Ouvrir un shell distant

```console
$ docker exec -it barrel barrel remote_console
```

## Construire l’image vous-même

Depuis un checkout du dépôt :

```console
$ docker build -t barrel-server .
```

## Notes

- Le conteneur tourne sous l’utilisateur `barrel` (uid 1000). Un répertoire de données monté depuis l’hôte (bind mount) doit être accessible en écriture pour cet uid.
- Le health check appelle `/ready` sur `BARREL_HTTP_PORT` : `docker ps` montre donc le nœud comme sain dès que les processus de la base et de la réplication tournent. Si votre propre configuration sert HTTP sur un autre port, réglez `BARREL_HTTP_PORT` sur ce port.
- Les images sont publiées pour `linux/amd64` et `linux/arm64` avec chaque bundle Barrel, taguées avec le bundle (`YYYY.MM.N`) et `latest`. Épinglez un tag de bundle en production.
