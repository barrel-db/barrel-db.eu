<!-- translation_of: examples/embedded-erlang/README.md source_hash: 4fec35569c8ef1ed -->
# Intégrer barrel dans une application Erlang

Ce projet exécute barrel dans votre propre nœud Erlang : il ouvre une
base de données, écrit trois documents, en met un à jour, les interroge
en BQL, ferme la base puis la rouvre pour relire les données depuis le
disque. Il n’y a ni serveur ni réseau. Commencez ici quand votre
application tourne sur la BEAM et possède ses données.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake : rocksdb et le stockage vectoriel compilent
  leur code natif à la première compilation, ce qui prend quelques minutes.

## Exécuter

```sh
./run.sh
```

`run.sh` compile le projet (`rebar3 compile`, dépendances depuis Hex),
supprime `./data`, puis exécute `embedded_erlang:main/0` dans un nœud
neuf avec `erl -noshell -config config/sys`. `config/sys.config` place
les données sous `./data/docdb` et envoie les logs sur stderr.

Pour utiliser barrel dans votre propre application, ajoutez la
dépendance et listez `barrel` dans les `applications` de votre `.app.src` :

```erlang
{deps, [{barrel, "~> 1.12"}]}.
```

## Ce que montre l’exemple

- `barrel:open/2` avec `vectordb => none` : des documents uniquement,
  sans stockage vectoriel.
- `barrel:put_docs/2` renvoie un résultat par document, chacun avec sa
  révision.
- Une mise à jour doit porter le `_rev` qu’elle a lu ; un `_rev` périmé
  renvoie `{error, conflict}`.
- BQL avec `WHERE`, `ORDER BY`, un `$parameter`, `IN` sur un tableau et
  `UNNEST`.
- `barrel:close/1`, puis une réouverture qui lit les mêmes données.

## Sortie attendue

Chaque étape affiche une ligne ou une liste de lignes de résultat. La
sortie d’une exécution réelle se trouve dans `expected.txt` ; les
révisions changent à chaque exécution.
