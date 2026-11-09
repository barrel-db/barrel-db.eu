import type { ComponentContent } from './types';

const code = `os:putenv("BARREL_ENCRYPTION_KEY", "a long passphrase"),
{ok, _} = application:ensure_all_started(barrel),
Opts = fun(Enc) -> #{encryption => Enc,
    docdb => #{data_dir => Dir},
    vectordb => #{dimension => 3, bm25_backend => disk,
                  db_path => Dir ++ "/secret_vec"}} end,
{ok, Db} = barrel:open(secret, Opts(default)),
{ok, _} = barrel:put_doc(Db, #{<<"id">> => <<"a">>,
    <<"note">> => <<"TOPSECRETMARKER">>}),
ok = barrel:vector_add(Db, <<"a">>, <<"TOPSECRETVECTEXT">>,
                       #{}, [0.1, 0.2, 0.3]),
{ok, _} = barrel:put_attachment(Db, <<"a">>, <<"f.txt">>,
                                <<"TOPSECRETBLOB">>),
ok = barrel:close(Db),
io:format("files containing plaintext marker: ~s",
    [os:cmd("grep -rl -a 'TOPSECRET' " ++ Dir
            ++ " | wc -l")]),
io:format("plaintext open: ~p~n",
          [barrel:open(secret, Opts(disabled))]),
os:putenv("BARREL_ENCRYPTION_KEY", "another passphrase"),
io:format("wrong key open: ~p~n",
          [barrel:open(secret, Opts(default))]).`;

const output = `files containing plaintext marker:        0
plaintext open: {error,db_is_encrypted}
wrong key open: {error,wrong_encryption_key}`;

export const crypto: ComponentContent = {
  slug: 'crypto',
  lead: 'Encryption at rest for Barrel: the ciphers, key derivation and key providers behind the `encryption` option of a database.',
  problem: 'A database per tenant or per agent should be unreadable without its key, on disk and in backups. barrel_crypto derives a key per database from a master secret (or asks your key provider), and the document store, vector store, disk BM25 files and blob attachments are encrypted with it.',
  useWhen: [
    'Each tenant, agent or space needs its own key.',
    'Processes in one Erlang node must not read each other\'s spaces: encryption is that boundary.',
    'You keep keys in a KMS: write a key provider module.',
  ],
  notWhen: [
    'You store attachments in S3 through [barrel_att_s3](/product/att-s3): those bytes are not encrypted.',
    'You need key rotation or to encrypt an existing database in place: neither exists.',
  ],
  dependsOn: [],
  external: 'OTP crypto',
  standalone: { short: 'Yes', text: 'Yes, it has no dependencies beyond OTP crypto.' },
  install: { code: '{barrel_crypto, "~> 1.0"}', lang: 'erlang', label: 'rebar.config deps' },
  reachedThrough: ['the `encryption` option of `barrel:open/2`, `barrel_docdb:create_db/2` and `barrel_spaces:create_space/1`', 'Erlang API'],
  config: [
    { title: 'Keys', rows: [
      { key: 'BARREL_ENCRYPTION_KEY', def: 'none', meaning: 'Master secret: 32 raw bytes, 64 hex characters, or a passphrase' },
      { key: '{barrel_crypto, encryption_key}', def: 'none', meaning: 'Used when the environment variable is not set' },
      { key: 'BARREL_ENCRYPTION_SALT / encryption_salt', def: 'barrel_default_salt_v1', meaning: 'HKDF salt' },
    ] },
    { title: 'encryption option', rows: [
      { key: 'disabled', def: 'default', meaning: 'Plaintext' },
      { key: 'default', def: '', meaning: 'Per-database key derived from the master secret' },
      { key: '#{provider => Mod}', def: '', meaning: 'Your module returns the 32-byte key for a keyspace' },
    ] },
  ],
  api: [
    { title: 'Keys', rows: [
      { task: 'Key for a database', call: 'barrel_keyprovider:key_for_db/2', returns: '`{ok, Key}`, `{ok, plaintext}`, or `{error, _}`' },
      { task: 'Your own provider', call: 'callback key_for_db(Keyspace)', returns: '`{ok, <<_:256>>}`' },
      { task: 'Derive', call: 'barrel_crypto:derive_key/1,2', returns: 'a key' },
    ] },
    { title: 'Ciphers', rows: [
      { task: 'Seal, open (AES-256-GCM)', call: 'barrel_crypto:encrypt/2, decrypt/2', returns: 'envelope, plaintext or `{error, decryption_failed}`' },
      { task: 'Terms', call: 'barrel_crypto:encrypt_term/2, decrypt_term/2', returns: 'envelope, term' },
      { task: 'File slices (AES-256-CTR)', call: 'barrel_crypto:ctr_crypt/3,4, new_nonce/1', returns: 'bytes' },
      { task: 'Check a key', call: 'barrel_crypto:key_check_new/1, key_check_verify/2', returns: 'token, boolean' },
    ] },
  ],
  examples: [
    { title: 'An encrypted database, checked on disk', intro: 'From a verified run: documents, a vector, disk BM25 and a blob attachment, then a search of the files for the plaintext.', label: 'Erlang', code, output, outputLabel: 'Output, from a run on barrel_crypto 1.0.0 (the same write without encryption left the marker in 1 file)' },
  ],
  limits: [
    'No key rotation and no in-place encryption of an existing database (`{error, cannot_encrypt_existing_db}`).',
    'Keys are never written to disk, but a cleartext key-check file `CRYPTO` sits in the database directory.',
    'CTR mode is unauthenticated, and keys are not zeroized in memory (both documented).',
    '`decrypt/2` passes through input that does not start with `BR`; a short plaintext starting with `BR` crashes it.',
  ],
  gaps: [
    'Attachments stored in S3 through barrel_att_s3 are not encrypted, even when the database is (verified: the object in the bucket held the plaintext).',
  ],
  guides: [
    { label: 'Encryption at rest', href: '/docs/guides/encryption' },
    { label: 'Authentication', href: '/docs/security/authentication' },
  ],
  apiRef: '/docs/lib/crypto/',
};
