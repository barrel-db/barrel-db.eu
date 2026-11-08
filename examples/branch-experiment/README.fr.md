<!-- translation_of: examples/branch-experiment/README.md source_hash: 67863a321db892c3 -->
# Créer une branche, comparer, fusionner, restaurer

Ce projet essaie une modification sur une branche d’une base de données
avant de toucher l’original. Il écrit une petite liste de prix, augmente
un prix sur la base principale, crée une branche, modifie, ajoute et
supprime sur la branche, compare les deux avec la même requête BQL et
l’historique des versions, fusionne la branche, puis ouvre une seconde
branche de la base principale telle qu’elle était avant toute
modification (restauration à un instant donné). Utilisez-le quand une
exécution d’agent, une migration ou une modification en masse doit être
relue avant d’être appliquée.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake pour les dépendances natives (la première
  compilation prend quelques minutes).

## Exécuter

```sh
./run.sh
```

`run.sh` compile le projet, supprime `./data`, puis exécute
`branch_experiment:main/0` une fois.

## Ce que montre l’exemple

- `barrel:changes(Db, first)` renvoie le curseur du dernier changement :
  gardez-le pour revenir plus tard à ce point.
- `barrel:branch/2` crée maintenant une branche de la base. Les écritures
  sur la branche ne touchent pas le parent tant que vous ne fusionnez pas.
- `barrel:doc_versions/2` et `barrel:version_body/3` listent les versions
  d’un document et lisent chacune d’elles.
- `barrel:merge/1` écrit les modifications de la branche dans le parent
  et renvoie un rapport.
- `barrel:branch(Db, Name, #{at => Cursor})` ouvre une branche du passé.
- Une branche d’une branche est refusée : `{error, cannot_branch_a_branch}`.

## Notes

- La filiation n’a qu’un niveau, et un instant plus ancien que
  l’historique conservé échoue avec `pitr_window_exceeded` (la
  conservation par défaut est de 30 jours).
- Cette base n’a pas de stockage vectoriel. Sur une base en mode
  enregistrement, une branche reconstruit son index à partir des
  embeddings stockés ; la branche d’une base simple ne porte aucun vecteur.

## Sortie attendue

La table des prix à chaque étape, les versions d’un document et le
rapport de fusion. La sortie d’une exécution réelle se trouve dans
`expected.txt`.
