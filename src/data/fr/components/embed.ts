// translation_of: src/data/components/embed.ts source_hash: f05cc30776af6673
// French text for the barrel_embed library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { embed as en } from '../../components/embed';

export const embed = overlay(en, {
  lead: 'Des embeddings de texte et d’image pour Erlang, depuis des modèles locaux ou des API cloud, avec une chaîne de fournisseurs qui passe au suivant quand l’un est indisponible.',
  problem: 'La recherche vectorielle a besoin d’embeddings, et la bonne source change : un modèle local sur un portable, Ollama sur un serveur, une API cloud en production. barrel_embed place toutes les sources derrière un seul appel, si bien que barrel et barrel_vectordb prennent une configuration `embedder` et n’appellent jamais un modèle directement.',
  useWhen: [
    'Vous voulez le mode enregistrement ou la recherche par texte dans barrel ou barrel_vectordb.',
    'Vous voulez une solution de repli : essayer d’abord un modèle local, puis un autre fournisseur.',
    'Vous avez votre propre modèle et voulez le brancher comme module fournisseur.',
  ],
  notWhen: [
    'Vous calculez les vecteurs ailleurs et les transmettez : vous pouvez vous passer de fournisseur (barrel_vectordb inclut quand même cette bibliothèque).',
  ],
  external: 'hackney ; Python 3 pour les fournisseurs Python locaux',
  standalone: { short: 'Oui', text: 'Oui. Sa seule dépendance est hackney.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['API Erlang', 'l’option `embedder` de barrel et de barrel_vectordb'],
  config: [
    { title: 'Configuration de init/1', rows: [
      { def: 'aucun', meaning: '`{Provider, Opts}` ou une liste pour une chaîne de repli ; sans rien, `{ok, undefined}`' },
      { meaning: 'Renvoyé par `dimension/1` ; fixez-le selon le modèle' },
      { meaning: 'Taille des lots pour `embed_batch`' },
    ] },
    { title: 'Fournisseurs (modèle par défaut, dimension)', rows: [
      { meaning: 'sentence-transformers dans un venv Python géré' },
      { meaning: '`url` par défaut http://localhost:11434' },
      { meaning: 'ONNX dans le venv' },
      { meaning: '`api_key` ou OPENAI_API_KEY' },
      { def: '1024 chacun', meaning: 'Clé d’API lue dans l’environnement' },
      { def: 'voir la référence', meaning: 'Identifiants cloud' },
      { def: 'creux, multi-vecteur, image', meaning: 'Appels spécialisés, venv Python' },
    ] },
    { title: 'Environnement de l’application (barrel_embed)', rows: [
      { meaning: 'venv Python géré' },
      { meaning: '`false` saute l’initialisation du venv' },
    ] },
  ],
  api: [
    { title: 'Calculer des embeddings', rows: [
      { task: 'Démarrer une chaîne de fournisseurs', returns: '`{ok, State}`, `{ok, undefined}` ou `{error, no_providers_available}`' },
      { task: 'Un texte', returns: '`{ok, [float()]}` ou `{error, all_providers_failed}`' },
      { task: 'Plusieurs textes' },
      { task: 'Décrire' },
      { task: 'Libérer' },
    ] },
    { title: 'Fournisseurs et venv', rows: [
      { task: 'Écrire un fournisseur', returns: '`init/1`, `available/1`, `model_info/1` en option' },
      { task: 'venv Python', returns: 'chemin, `ok`' },
      { task: 'Creux, multi-vecteur, image', returns: 'prennent la configuration du fournisseur, pas l’état' },
    ] },
  ],
  examples: [
    { title: 'Votre propre fournisseur', intro: 'Tout module qui implémente le behaviour peut être désigné comme fournisseur.' },
    { title: 'Personnalisé, Ollama, et une chaîne de repli', intro: 'D’après une exécution vérifiée, avec Ollama lancé en local et `nomic-embed-text` téléchargé.', outputLabel: 'Sortie d’une exécution sur barrel_embed 2.6.1' },
  ],
  limits: [
    '`dimension/1` renvoie les `dimensions` configurées (768 par défaut), pas la taille du fournisseur. Passez `dimensions` explicitement, par exemple 384 pour bge-small.',
    'Chaque appel d’embedding lance d’abord `available/1` du fournisseur. Pour les fournisseurs cloud, c’est une requête HTTP de plus par appel.',
    'La première initialisation d’un fournisseur Python peut installer des paquets avec pip et télécharger un modèle. Les paquets Python ne sont pas épinglés.',
    'Les fournisseurs cloud sont décrits d’après le code source ; ils n’ont pas été lancés avec des clés. fastembed, splade, colbert et clip n’ont pas été lancés.',
  ],
  guides: [
    { label: 'Choisir un fournisseur d’embeddings' },
    { label: 'Écrire un fournisseur' },
    { label: 'Le mode enregistrement' },
  ],
});
