// translation_of: src/data/components/rerank.ts source_hash: bcddc27c723535d3
// French text for the barrel_rerank library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { rerank as en } from '../../components/rerank';

export const rerank = overlay(en, {
  lead: 'Le reclassement par cross-encoder : une seconde passe qui réordonne les résultats d’une recherche vectorielle ou par mots-clés en lisant ensemble la requête et chaque candidat.',
  problem: 'La recherche de premier niveau est rapide mais approchée. Un cross-encoder note directement chaque paire requête et document, et place les meilleures réponses en tête. barrel_rerank fait tourner le modèle dans un port Python et y multiplexe les requêtes concurrentes.',
  useWhen: [
    'Les premiers résultats d’une recherche vectorielle ou hybride sont proches, mais dans le mauvais ordre.',
    'Vous pouvez payer un appel au modèle par requête, sur une courte liste de candidats.',
  ],
  notWhen: [
    'Vous ne pouvez pas faire tourner Python avec transformers et torch (environ 2 Go) sur le nœud.',
    'Il vous faut des scores entre 0 et 1 : les scores sont des logits bruts.',
  ],
  external: 'Python 3 avec transformers et torch ; un modèle HuggingFace téléchargé à la première utilisation',
  standalone: { short: 'Oui', text: 'Oui, sans aucune dépendance Erlang. Il faut Python sur le nœud.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['API Erlang uniquement'],
  config: [
    { title: 'Configuration de start_link/1', rows: [
      { meaning: 'Donnez un chemin absolu si l’installation du venv échoue' },
      { meaning: 'Identifiant de modèle HuggingFace' },
      { meaning: 'Par requête' },
    ] },
    { title: 'Environnement de l’application (barrel_rerank)', rows: [
      { meaning: 'Fixez-le à un chemin absolu (voir le défaut connu plus bas)' },
    ] },
  ],
  api: [
    { title: 'Reclasser', rows: [
      { task: 'Démarrer un serveur de modèle', returns: '`{ok, Pid}` ; non enregistré, un par appel' },
      { task: 'Reclasser des candidats', returns: '`{ok, [{Index, Score}]}`, le meilleur en premier, index à partir de 0' },
      { task: 'Garder les k meilleurs', returns: 'les k premières paires' },
      { task: 'Décrire, vérifier' },
      { task: 'Arrêter' },
      { task: 'Venv', returns: 'chemin, `ok`' },
    ] },
  ],
  examples: [
    { title: 'Reclasser trois passages', intro: 'D’après une exécution vérifiée qui réutilisait un venv existant avec transformers, torch et uvloop.', outputLabel: 'Sortie d’une exécution sur barrel_rerank 1.0.2' },
  ],
  limits: [
    'Les scores sont des logits bruts du cross-encoder (9.58, -5.25 ci-dessus), pas des valeurs entre 0 et 1.',
    'Si l’installation du venv échoue, `start_link/1` lance `"python3"` par son nom et échoue avec `{error, {port_open_failed, enoent}}`. Passez un `python` absolu ou un `venv_path` qui fonctionne.',
    'Le modèle est téléchargé depuis HuggingFace à la première utilisation.',
  ],
  gaps: [
    'La valeur par défaut de `venv_path` est cassée : l’application la déclare à `undefined`, et une fois l’application chargée le code utilise cette valeur comme chemin. Au démarrage, il crée un venv dans un répertoire nommé `undefined` sous le répertoire courant. Fixez `venv_path` avec `application:set_env/3` après `application:load/1` et avant de démarrer l’application.',
  ],
  guides: [
    { label: 'Reclassement' },
    { label: 'Vectorielle, par mots-clés et hybride' },
  ],
});
