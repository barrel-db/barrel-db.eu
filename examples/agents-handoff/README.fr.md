<!-- translation_of: examples/agents-handoff/README.md source_hash: 7d6fb819348d6ce1 -->
# Partager un espace entre agents

Ce projet fait travailler trois agents sur un espace partagé. alice crée
l’espace et commence une tâche. carol reçoit un jeton de capacité en
lecture seule. alice passe la tâche à bob : bob accepte la passation, lit
sur place les notes, les messages et les épingles d’alice, écrit son
résultat et termine la passation, ce qui révoque son jeton. À chaque
étape, le programme affiche ce que chaque agent peut et ne peut pas
faire. Utilisez-le quand plusieurs agents doivent partager un contexte
sans tout partager.

## Prérequis

- Erlang/OTP 26 ou plus récent (cette exécution a utilisé OTP 29) et rebar3.
- Un compilateur C et CMake pour les dépendances natives (la première
  compilation prend quelques minutes).

## Exécuter

```sh
./run.sh
```

`run.sh` compile le projet, supprime `./data`, puis exécute
`agents_handoff:main/0` une fois.

## Ce que montre l’exemple

- `barrel_caps:grant/2` émet un jeton pour un espace avec des droits
  donnés ; `barrel_caps:verify/3` répond `ok` ou une raison :
  `forbidden`, `wrong_space`, `invalid_token`, `revoked`.
- `barrel_handoff:create/2` émet la passation sous forme de jeton
  (lecture et écriture par défaut, jamais admin). `accept/2` ne
  fonctionne qu’une fois : une seconde acceptation reçoit
  `already_accepted`.
- L’agent qui accepte lit sur place la session de l’émetteur et reçoit
  sa propre session, qui pointe vers la passation.
- `barrel_handoff:complete/2` révoque le jeton de la passation ;
  `barrel_caps:revoke/1` révoque celui de carol.

## Notes

- Dans le processus, les jetons sont indicatifs : `barrel_spaces:open_space/1`
  et les fonctions de `barrel_session` ne prennent pas de jeton, votre
  code appelle donc `barrel_caps:verify/3` avant d’agir, comme le fait
  `write_with/4` ici. `barrel_server` vérifie les jetons à chaque
  requête REST et MCP.
- `accept`, `complete` et `chain` ne vérifient que le droit `read` du
  jeton de passation.
- Le chiffrement par espace est la frontière d’isolation au sein d’un
  nœud ; voir le guide des espaces.

## Sortie attendue

Un bloc par agent, avec des lignes `can` et `cannot`. La sortie d’une
exécution réelle se trouve dans `expected.txt` ; les identifiants
d’espace et de passation changent à chaque exécution.
