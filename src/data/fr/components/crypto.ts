// translation_of: src/data/components/crypto.ts source_hash: cc783bcd9f20bd88
// French text for the barrel_crypto library page. Code, calls and outputs come from the English file.
import { overlay } from '../../overlay';
import { crypto as en } from '../../components/crypto';

export const crypto = overlay(en, {
  lead: 'Le chiffrement au repos de Barrel : les algorithmes, la dérivation de clés et les fournisseurs de clés derrière l’option `encryption` d’une base.',
  problem: 'Une base par client ou par agent doit être illisible sans sa clé, sur disque comme dans les sauvegardes. barrel_crypto dérive une clé par base à partir d’un secret maître (ou la demande à votre fournisseur de clés), et le stockage des documents, le magasin de vecteurs, les fichiers BM25 sur disque et les pièces jointes en blob sont chiffrés avec elle.',
  useWhen: [
    'Chaque client, agent ou espace a besoin de sa propre clé.',
    'Les processus d’un même nœud Erlang ne doivent pas lire les espaces les uns des autres : le chiffrement est cette frontière.',
    'Vous gardez vos clés dans un KMS : écrivez un module fournisseur de clés.',
  ],
  notWhen: [
    'Vous stockez les pièces jointes dans S3 via [barrel_att_s3](/product/att-s3) : ces octets ne sont pas chiffrés.',
    'Vous avez besoin de rotation des clés ou de chiffrer une base existante sur place : ni l’un ni l’autre n’existe.',
  ],
  external: 'crypto d’OTP',
  standalone: { short: 'Oui', text: 'Oui, elle n’a aucune dépendance en dehors de crypto d’OTP.' },
  install: { label: 'dépendances rebar.config' },
  reachedThrough: ['l’option `encryption` de `barrel:open/2`, `barrel_docdb:create_db/2` et `barrel_spaces:create_space/1`', 'API Erlang'],
  config: [
    { title: 'Clés', rows: [
      { def: 'aucun', meaning: 'Secret maître : 32 octets bruts, 64 caractères hexadécimaux, ou une phrase de passe' },
      { def: 'aucun', meaning: 'Utilisé quand la variable d’environnement n’est pas définie' },
      { meaning: 'Sel HKDF' },
    ] },
    { title: 'Option encryption', rows: [
      { def: 'par défaut', meaning: 'En clair' },
      { meaning: 'Clé par base, dérivée du secret maître' },
      { meaning: 'Votre module renvoie la clé de 32 octets d’un espace de clés' },
    ] },
  ],
  api: [
    { title: 'Clés', rows: [
      { task: 'Clé d’une base', returns: '`{ok, Key}`, `{ok, plaintext}`, ou `{error, _}`' },
      { task: 'Votre propre fournisseur' },
      { task: 'Dériver', returns: 'une clé' },
    ] },
    { title: 'Algorithmes', rows: [
      { task: 'Sceller, ouvrir (AES-256-GCM)', returns: 'enveloppe, texte en clair ou `{error, decryption_failed}`' },
      { task: 'Termes', returns: 'enveloppe, terme' },
      { task: 'Tranches de fichier (AES-256-CTR)', returns: 'octets' },
      { task: 'Vérifier une clé', returns: 'jeton, booléen' },
    ] },
  ],
  examples: [
    { title: 'Une base chiffrée, vérifiée sur disque', intro: 'D’après une exécution vérifiée : documents, un vecteur, BM25 sur disque et une pièce jointe en blob, puis une recherche du texte en clair dans les fichiers.', outputLabel: 'Sortie d’une exécution sur barrel_crypto 1.0.0 (la même écriture sans chiffrement laissait le marqueur dans 1 fichier)' },
  ],
  limits: [
    'Pas de rotation des clés et pas de chiffrement sur place d’une base existante (`{error, cannot_encrypt_existing_db}`).',
    'Les clés ne sont jamais écrites sur disque, mais un fichier de vérification de clé en clair, `CRYPTO`, se trouve dans le répertoire de la base.',
    'Le mode CTR n’est pas authentifié, et les clés ne sont pas effacées de la mémoire (les deux points sont documentés).',
    '`decrypt/2` laisse passer une entrée qui ne commence pas par `BR` ; un texte en clair court qui commence par `BR` le fait planter.',
  ],
  gaps: [
    'Les pièces jointes stockées dans S3 via barrel_att_s3 ne sont pas chiffrées, même quand la base l’est (vérifié : l’objet dans le bucket contenait le texte en clair).',
  ],
  guides: [
    { label: 'Chiffrement au repos' },
    { label: 'Authentification' },
  ],
});
