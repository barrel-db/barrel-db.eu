---
title: La couche agent
description: Espaces, jetons de capacite, sessions et handoffs, les pieces pour donner aux agents une memoire cadree et partageable.
---

La couche agent fait de Barrel une memoire pour les agents : contexte partage,
acces cadre, sessions de travail, et handoffs entre agents. Lisez ceci pour
comprendre les pieces avant de cabler un runtime d'agent a Barrel via REST ou
MCP.

## Espaces

Un espace est une base de donnees de contexte partage avec son propre chiffrement
et son propre ensemble d'autorisations. Agents et personnes travaillent dans le
meme espace, ainsi la memoire d'un agent n'est pas un silo prive, c'est un lieu
que d'autres peuvent lire et enrichir.

```erlang
{ok, #{id := Space}} = barrel_spaces:create_space(<<"research-team">>).
```

## Jetons de capacite

Vous remettez a un agent un jeton de capacite cadre sur un espace avec des droits
`read`, `write` ou `admin` (read est le plus faible, admin le plus fort). L'acces
est fail-closed par defaut, et vous pouvez revoquer un jeton a tout moment. Donnez
a chaque agent le minimum dont il a besoin.

```erlang
{ok, Token} = barrel_caps:grant(Space, #{rights => [read, write]}).
```

## Sessions

Une session est une memoire de travail avec une duree de vie glissante : messages
ordonnes, donnees structurees, et resumes. Les sessions expirent et sont balayees
quand un agent devient inactif, ainsi le contexte de courte duree ne s'accumule
pas indefiniment.

## Handoffs

Un handoff passe une tache d'un agent a un autre par reference, en portant une
capacite. Le destinataire l'accepte et prend le relais ; l'autorisation de
l'emetteur est revoquee. C'est ainsi que le travail se deplace entre agents sans
copier les donnees sous-jacentes.

## Via REST et MCP

Tout ce qui precede est atteignable a travers
[barrel_server](/fr/docs/server/rest-server) : les routes REST sous `/spaces`, et
un [point de terminaison MCP](/fr/docs/server/mcp) dont les outils portent le meme
cadrage de capacite. Chaque ecriture enregistre qui l'a faite (acteur, session,
source), ainsi les actions des agents restent auditables.
