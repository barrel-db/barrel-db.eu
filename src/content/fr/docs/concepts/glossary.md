---
translation_of: src/content/docs/concepts/glossary.md
source_hash: "5809224c8984167f"
title: Glossaire
description: Les termes employés dans la documentation de Barrel, chacun expliqué simplement, avec un lien vers la page qui le traite.
---

Cette page explique les mots qu’emploie la documentation de Barrel, par
ordre alphabétique. Chaque entrée dit ce qu’est la chose, pourquoi elle
vous concerne, et où en lire plus. Les autres pages renvoient ici la
première fois qu’elles emploient un terme : revenez-y dès qu’un mot
n’est pas clair.

## <span id="active-active"></span>Actif-actif

Chaque copie d’une base accepte des écritures, et les copies convergent
quand elles se répliquent. Vous ne choisissez pas de copie principale :
un portable, un téléphone et deux serveurs peuvent tous accepter des
modifications du même document pendant qu’ils sont séparés. Les
modifications concurrentes sont gardées comme [conflit](#conflict) au
lieu d’être perdues. Voir [Synchronisation](/fr/docs/guides/synchronization).

## barrel-lite

Un client TypeScript qui garde une copie locale d’une base dans le
navigateur et la synchronise avec un [serveur Barrel](#barrel-server).
Votre application web lit et écrit en local, continue de fonctionner
hors ligne, et converge avec le serveur quand elle se reconnecte. Le
navigateur peut effacer les données locales : c’est la synchronisation
qui rend les écritures durables. Voir [barrel-lite](/fr/docs/guides/barrel-lite).

## BM25

Un classement par mots-clés : il ne renvoie que les documents qui
contiennent les mots de votre requête, classés selon leur
correspondance. Utilisez-le quand les termes exacts comptent, comme un
code d’erreur ou un nom de produit. Son score est la valeur BM25 brute,
sans borne supérieure. Voir [Vectorielle, mots-clés et
hybride](/fr/docs/search/hybrid).

## BQL

Le langage de requête de Barrel, un dialecte de PartiQL (du SQL pour
JSON). Une seule instruction `SELECT` peut filtrer des documents, lancer
une recherche vectorielle ou par mots-clés et relier les résultats à
leurs documents, ou s’abonner aux mises à jour en direct. Elle se
compile vers le même moteur que l’API structurée `find/2`. Voir
[Interroger avec BQL](/fr/docs/guides/query-bql).

## <span id="branch"></span>Branche

Une bifurcation d’une base, créée en temps constant quelle que soit sa
taille, parce que la branche partage ses fichiers sur disque avec sa
base parente. La branche est une base normale : un agent ou une
expérience y travaille seul, puis vous fusionnez ce qui a passé la
revue. Les modifications concurrentes des deux côtés deviennent des
[conflits](#conflict) ordinaires. Voir [Brancher, fusionner,
restaurer](/fr/docs/guides/timeline).

## <span id="channel"></span>Canal

Un ensemble nommé de motifs de chemins, déclaré à la création d’une
base, qui choisit un sous-ensemble de documents à répliquer. Barrel
range les écritures correspondantes dans un flux propre au canal au
moment où elles ont lieu : une récupération filtrée ne lit donc que ce
flux, et non tout l’historique. Servez-vous-en, par exemple, pour
n’envoyer à un téléphone que ses tâches. Voir
[Synchronisation](/fr/docs/guides/synchronization).

## <span id="conflict"></span>Conflit

Deux copies ont modifié le même document avant de se synchroniser :
aucune version n’a vu l’autre. Barrel garde les deux comme versions
sœurs, affiche le même gagnant sur chaque copie, et liste les autres
dans `_conflicts` jusqu’à ce que vous les résolviez. Par ailleurs, une
écriture avec un `_rev` périmé est refusée avec `{error, conflict}` :
vous n’écrasez jamais une modification que vous n’avez pas lue. Voir
[Versions, conflits, convergence](/fr/docs/concepts/versions).

## Convergence

La garantie que chaque copie d’une base finit avec les mêmes versions,
le même gagnant, le même corps et le même indicateur de suppression,
quel que soit l’ordre des écritures et des synchronisations. C’est ce
qui vous permet d’écrire partout et de synchroniser plus tard sans
coordinateur. Voir [Pourquoi cela
converge](/fr/docs/concepts/versions#pourquoi-cela-converge).

## Document

Un objet JSON avec un `id`, comme l’article de support `kb-142`. Chaque
écriture crée une nouvelle version, et chacun de ses champs est indexé :
vous pouvez donc interroger n’importe quel champ sans déclarer d’index.
Les champs de premier niveau qui commencent par `_` sont réservés à
Barrel. Voir [L’enregistrement](/fr/docs/concepts/record).

## <span id="embedded"></span>Embarqué

Faire tourner Barrel dans votre propre release Erlang ou Elixir, comme
une bibliothèque, sans serveur ni saut réseau. Vous disposez de toute
l’API dans le processus : documents, recherche, pièces jointes, [mode
enregistrement](#record-mode) et timeline. Choisissez ce mode quand
votre application possède les données. Voir [Intégrer barrel dans une
application Erlang](/fr/docs/guides/embedding).

## Embedding

Le [vecteur](#vector) qu’un modèle calcule à partir d’un texte, de sorte
que des textes de sens proches reçoivent des vecteurs proches. Barrel
appelle un fournisseur d’embeddings (un modèle local, un serveur Ollama
ou une API cloud) à chaque écriture et à chaque requête textuelle. Le
fournisseur que vous choisissez décide où part votre texte. Voir
[Choisir un fournisseur
d’embeddings](/fr/docs/search/embedding-providers).

## <span id="record"></span>Enregistrement

Tout ce que Barrel garde sous un même id : le [document](#document), ses
[pièces jointes](#attachment) et, en [mode enregistrement](#record-mode),
son [vecteur](#vector). Vous les lisez, écrivez, répliquez et supprimez
par cet id : ils ne se désynchronisent jamais. Voir
[L’enregistrement](/fr/docs/concepts/record).

## <span id="pin"></span>Épingle

Un élément de contexte que vous attachez à une [session](#session) avec
`pin_context`, comme un fait clé que l’agent doit garder sous les yeux.
Les épingles sont stockées comme documents dans l’espace et listées avec
`list_pinned` : tout détenteur d’un jeton pour l’espace peut donc les
lire. Voir [Espaces, sessions, passations](/fr/docs/guides/spaces).

## <span id="space"></span>Espace

Une base Barrel que plusieurs agents partagent, chacun détenant un
[jeton de capacité](#capability-token) pour elle. Son nom est `sp_`
suivi de 16 caractères, et un registre garde la trace de qui a reçu
quels droits. Utilisez un espace par travail partagé, comme un brouillon
de recherche commun. Voir [Espaces et
capacités](/fr/docs/concepts/spaces).

## <span id="capability-token"></span>Jeton de capacité

Une chaîne secrète qui commence par `bsp_` et donne à son détenteur des
droits `read`, `write` ou `admin` sur un seul [espace](#space), et sur
rien d’autre. Elle n’est affichée qu’une fois, à l’émission ; Barrel ne
stocke que son hachage SHA-256. `barrel_server` la vérifie à chaque
requête, alors que dans votre propre nœud Erlang elle est indicative.
Voir [Espaces et capacités](/fr/docs/concepts/spaces).

## MCP

Le Model Context Protocol, un moyen standard pour les runtimes d’agents
et les IDE d’appeler des outils. Le [serveur Barrel](#barrel-server)
sert un point d’accès MCP sur `/mcp`, avec des outils pour les
documents, BQL, la recherche, la timeline, les espaces et les contextes.
Votre agent parle directement à Barrel, soumis aux mêmes jetons de
capacité qu’en REST. Voir [Point d’accès MCP](/fr/docs/guides/mcp).

## <span id="record-mode"></span>Mode enregistrement

Un réglage de base qui indique à Barrel quels champs traiter, avec quel
fournisseur et à quelle dimension. Barrel calcule alors le vecteur à
chaque écriture et le supprime à la suppression : la recherche
correspond toujours aux documents courants, et vous n’appelez jamais
`vector_add` vous-même. Voir [Mode
enregistrement](/fr/docs/guides/record-mode).

## <span id="handoff"></span>Passation

Le moyen pour un agent de transmettre une tâche à un autre dans un
[espace](#space). Elle émet un [jeton de capacité](#capability-token)
pour la tâche ; le premier qui l’accepte obtient une
[session](#session) dans le même espace, et une deuxième acceptation
échoue. Rien n’est copié : l’agent suivant lit le contexte là où il se
trouve. Voir [Espaces et capacités](/fr/docs/concepts/spaces).

## <span id="attachment"></span>Pièce jointe

Un fichier binaire nommé, stocké sous l’id d’un document, comme
`steps.md` sur l’article de support `kb-142`. Les pièces jointes ne sont
pas versionnées : la dernière écriture l’emporte selon son horodatage,
et en écrire une ne change pas la [révision](#revision) du document.
Elles se répliquent sur leur propre flux, à côté des documents. Voir
[Pièces jointes](/fr/docs/store/attachments).

## <span id="checkpoint"></span>Point de reprise

Un petit enregistrement local, gardé des deux côtés d’une
[réplication](#replication), qui note jusqu’où est allée la dernière
exécution. L’exécution suivante repart de là au lieu de tout reprendre :
vous pouvez donc arrêter et relancer la réplication à tout moment. Une
réplication filtrée garde son propre point de reprise. Voir
[Synchronisation](/fr/docs/guides/synchronization).

## <span id="hybrid-search"></span>Recherche hybride

Une recherche qui lance une recherche vectorielle (par le sens) et une
recherche [BM25](#bm25) (par mots-clés), puis fusionne les deux
classements en un seul. Elle trouve les documents qui disent la même
chose avec d’autres mots, tout en classant bien les termes exacts. La
fusion par défaut se fonde sur les rangs, pas sur les scores bruts. Voir
[Vectorielle, mots-clés et hybride](/fr/docs/search/hybrid).

## <span id="replication"></span>Réplication

La copie de versions d’une base vers une autre, dans la même VM Erlang
ou sur HTTP vers un [serveur Barrel](#barrel-server). Elle s’exécute une
fois ou en continu, reprend depuis son [point de reprise](#checkpoint),
et peut ne transporter qu’un sous-ensemble grâce à un
[canal](#channel). Envoyer une version deux fois est sans danger. Voir
[Synchronisation](/fr/docs/guides/synchronization).

## <span id="point-in-time-recovery"></span>Restauration à un instant donné

Lire une base telle qu’elle était à un instant passé, en créant une
[branche](#branch) à cet instant. Vous obtenez les données d’hier à côté
de celles d’aujourd’hui, sans restaurer une sauvegarde par-dessus la
base en service. Cela fonctionne dans la fenêtre de rétention (30 jours
par défaut) ; l’historique plus ancien a disparu. Voir [Sauvegarde et
restauration](/fr/docs/operate/backups#récupérer-un-état-passé).

## <span id="revision"></span>Révision

Le champ `_rev` que Barrel ajoute quand vous lisez un document : le
jeton de sa version gagnante, construit à partir d’une horloge et de
l’id de la base qui l’a écrite. Renvoyez-le quand vous mettez le
document à jour ; un `_rev` absent ou périmé renvoie
`{error, conflict}`. Voir [Le jeton de
version](/fr/docs/concepts/versions#le-jeton-de-version).

## <span id="barrel-server"></span>Serveur Barrel

`barrel_server` met une base Barrel sur le réseau : du REST/JSON sur
HTTP, et un point d’accès [MCP](#mcp) pour les agents. Utilisez-le quand
les clients sont dans d’autres langages, sur d’autres machines, ou
doivent être limités par un [jeton de capacité](#capability-token). Il
ne contient aucune logique de base de données et ne fait pas partie de
la compilation embarquée par défaut. Voir [Lancer le
serveur](/fr/docs/guides/rest-server).

## Session

Le contexte de travail d’un agent dans un [espace](#space) : ses
messages, ses données clé/valeur et ses [épingles](#pin), stockés comme
documents dans l’espace. Elle expire après une période sans activité
(3600 secondes par défaut), sauf si vous la rendez durable. Tout
détenteur d’un jeton pour l’espace peut la lire. Voir [Espaces et
capacités](/fr/docs/concepts/spaces).

## <span id="vector"></span>Vecteur

Une liste de nombres qui représente le sens du texte d’un document, et
sert à trouver des documents par similarité. En [mode
enregistrement](#record-mode), il suit le document : écrit avec lui,
supprimé avec lui. Les vecteurs ne sont pas répliqués ; chaque copie
calcule les siens. Voir [Vectorielle, mots-clés et
hybride](/fr/docs/search/hybrid).
