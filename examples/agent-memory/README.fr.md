<!-- translation_of: examples/agent-memory/README.md source_hash: 1e5ba3af7e64d700 -->
# Mémoire d’agent qui survit aux redémarrages

Ce projet conserve la mémoire d’un agent dans un espace Barrel : une
session avec ses messages, son contexte épinglé et ses données de
travail, plus des faits à long terme stockés comme documents, convertis
en embeddings à l’écriture (mode enregistrement) et retrouvés par
recherche. Un premier nœud écrit la mémoire et s’arrête ; un second nœud
ouvre les mêmes données et les retrouve. Partez de cet exemple quand un
agent doit se souvenir d’une exécution à l’autre et après un plantage.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake pour les dépendances natives (la première
  compilation prend quelques minutes).
- Ni modèle ni réseau : l’embedder est `hash_embed`, décrit plus bas.

## Exécuter

```sh
./run.sh
```

`run.sh` compile le projet, supprime `./data`, puis lance deux nœuds
distincts sur le même répertoire de données : `agent_memory:main(write)`
et `agent_memory:main(recall)`.

## Ce que montre l’exemple

- `barrel_spaces:create_space/1` avec une politique `embedding` : chaque
  document qui a un champ `content`, messages compris, reçoit son
  embedding dans la même écriture.
- `barrel_session` : `create/2` avec `ttl => infinity`, `add_message/3`,
  `pin_context/3` (la priorité la plus basse passe en premier), `set_data/4`.
- Sur le second nœud, `barrel_spaces:open_space/1` rouvre l’espace en
  mode enregistrement avec l’embedder de `config/sys.config`
  (`{barrel_spaces, [{embedder, ...}]}`), et messages, épingles, données
  et index vectoriel sont tous là.
- `barrel:search/3` sur les faits et les messages ensemble ; `type` dans
  les métadonnées permet de les distinguer.

## À propos de l’embedder

`hash_embed` est un petit fournisseur déterministe écrit pour cet
exemple : il hache les mots sur 64 dimensions, il retrouve donc les mots
communs mais ne comprend pas le sens. Il permet une exécution hors ligne
et une sortie stable. Ses scores ne mesurent pas la qualité de la
recherche. Pour un vrai rappel, utilisez un modèle : réglez l’`embedder`
de l’espace (et l’environnement de `barrel_spaces`) sur
`{ollama, #{url => ..., model => ...}}` ou `{local, #{}}`, avec les
`dimensions` correspondantes. Voir
[choisir un fournisseur d’embeddings](https://barrel-db.eu/fr/docs/search/embedding-providers).

## Sortie attendue

Le nœud 1 affiche l’identifiant de session et la première recherche ; le
nœud 2 affiche les messages, les épingles et les données qu’il a relus,
et deux recherches. La sortie d’une exécution réelle se trouve dans
`expected.txt` ; l’identifiant de session change à chaque exécution.
