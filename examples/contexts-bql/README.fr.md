<!-- translation_of: examples/contexts-bql/README.md source_hash: 699ea911ece60f6c -->
# Interroger deux bases comme des contextes

Ce projet enregistre deux bases, les tickets de support de deux régions,
comme contextes et exécute une seule instruction BQL sur les deux. La
réponse fusionne les lignes dans l’ordre de `ORDER BY` et indique de
quel contexte vient chaque ligne, quels contextes ont répondu et ce que
couvre chaque réponse. Un troisième contexte pointe vers un nœud arrêté :
la même requête renvoie alors une réponse partielle, avec la raison.
Utilisez les contextes quand un agent doit chercher dans des données
réparties sur plusieurs bases ou nœuds et doit savoir ce qu’il n’a pas vu.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake pour les dépendances natives (la première
  compilation prend quelques minutes).

## Exécuter

```sh
./run.sh
```

`run.sh` compile le projet, supprime `./data`, puis exécute
`contexts_bql:main/0` une fois.

## Ce que montre l’exemple

- `barrel_ctx:register/1` : une fiche avec un nom et un emplacement,
  local (une base sur ce nœud) ou distant (un point d’accès barrel_server
  et une base sur celui-ci).
- `barrel_ctx:query/1` avec `query` et `contexts` : chaque contexte
  exécute la même instruction ; le nom après `FROM` est ignoré.
- `execution` vaut `succeeded`, `partial` ou `failed` ; `sources` a une
  entrée par contexte avec son statut, son nombre de lignes et `bound` ;
  `coverage` les compte ; `summary` dit la même chose en un paragraphe.
- Avec `offline => true`, les contextes distants sont ignorés, pas
  contactés.
- Une requête de lignes sur des contextes exige `LIMIT` : sans lui, la
  requête est refusée avant qu’aucun contexte ne s’exécute.

## Notes

- Non pris en charge entre contextes : `SUBSCRIBE`, `OFFSET`, `UNNEST`,
  les continuations et la fusion des scores BM25 ou hybrides (ceux-ci
  reviennent groupés par contexte).
- Les mêmes requêtes passent par REST (`POST /contexts/_query`) et MCP
  (`context_query`) sur barrel_server.

## Sortie attendue

Trois réponses et un refus. La sortie d’une exécution réelle se trouve
dans `expected.txt`.
