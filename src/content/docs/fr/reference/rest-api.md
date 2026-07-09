---
title: API REST (OpenAPI)
description: La specification OpenAPI 3.1 de l'API REST barrel_server, et comment tester contre elle.
---

L'API REST barrel_server est decrite par une specification OpenAPI 3.1 que vous
pouvez telecharger a [`/openapi.yaml`](/openapi.yaml). Elle couvre les bases de
donnees, documents, pieces jointes, vecteurs, la recherche, les timelines, le flux
de changements, l'endpoint de requete BQL, et la couche agent (espaces,
autorisations, sessions, handoffs). Utilisez-la quand vous voulez explorer l'API de
facon interactive, generer un client, ou piloter des requetes depuis un outil au
lieu de les ecrire a la main.

## Telecharger la spec

```
curl -O http://localhost:8080/../openapi.yaml   # or fetch it from this site
```

La copie canonique est servie a [`/openapi.yaml`](/openapi.yaml). Elle est livree
avec le serveur a `apps/barrel_server/priv/openapi.yaml`.

## Importer dans Postman ou Insomnia

1. Ouvrez Postman ou Insomnia.
2. Choisissez Importer, puis pointez-le vers `https://barrel-db.eu/openapi.yaml`
   (ou une copie locale du fichier).
3. L'outil construit une collection de requetes a partir des chemins. Fixez l'URL
   de base a votre serveur, par exemple `http://localhost:8080`.
4. Si votre serveur tourne avec authentification, ajoutez un jeton Bearer (un
   jeton serveur global, ou un jeton de capacite `bsp_...` cadre sur un espace).

## Voir dans Swagger Editor ou Scalar

- Collez la spec dans [editor.swagger.io](https://editor.swagger.io) pour parcourir
  chaque operation avec une vue de schema en direct.
- Ou rendez-la avec [Scalar](https://github.com/scalar/scalar) pour une reference
  d'API que vous pouvez lire et depuis laquelle essayer des requetes.

## Generer un client

Utilisez [openapi-generator](https://openapi-generator.tech) pour produire un
client dans votre langage :

```
openapi-generator-cli generate \
  -i https://barrel-db.eu/openapi.yaml \
  -g python \
  -o ./barrel-client
```

Remplacez `-g python` par n'importe quel generateur supporte (`typescript-fetch`,
`go`, `rust`, et d'autres).

## Notes

- `GET /` et `GET /health` sont publics. Tout autre endpoint accepte un jeton
  Bearer quand le serveur est configure pour l'authentification, et n'en a besoin
  d'aucun quand il tourne ouvert.
- Le reseau de replication (`/db/{db}/_sync/*`) et le point de terminaison MCP
  (`/mcp`) sont des protocoles separes et ne font pas partie de cette spec.
