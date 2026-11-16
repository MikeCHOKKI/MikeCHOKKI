// Met à jour les versions citées dans README.md, entre des marqueurs, à partir de leur source officielle.
// Aucune dépendance : Node 20+ (fetch natif). Lance en local avec `GITHUB_TOKEN=$(gh auth token) node .github/scripts/profile-versions.mjs`.
//
// Marqueurs reconnus (le texte entre les deux est remplacé par la dernière version, sans le « v ») :
//   <!-- auto:pub:<paquet> -->0.9.0<!-- /auto -->            dernière version publiée sur pub.dev
//   <!-- auto:release:<propriétaire>/<dépôt> -->0.3.0<!-- /auto -->   dernière release GitHub, préversions comprises
// Une source qui ne répond pas laisse la valeur en place : le profil ne montre jamais une case vide.
import { readFileSync, writeFileSync } from 'node:fs';

const README = 'README.md';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const MARKER = /<!-- auto:(pub|release):([\w./-]+) -->(.*?)<!-- \/auto -->/g;

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': 'profile-versions', ...headers } });
  if (!res.ok) throw new Error(`${url} : ${res.status}`);
  return res.json();
}

const sources = {
  // pub.dev : `latest` est la dernière version stable publiée.
  pub: async (name) => (await getJson(`https://pub.dev/api/packages/${name}`)).latest.version,
  // /releases/latest ignore les préversions ; on prend la plus récente de la liste, brouillons exclus.
  release: async (repo) => {
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
    const releases = await getJson(`https://api.github.com/repos/${repo}/releases?per_page=10`, headers);
    const latest = releases.find((r) => !r.draft);
    if (!latest) throw new Error(`${repo} : aucune release publiée`);
    return latest.tag_name.replace(/^v/, '');
  },
};

const readme = readFileSync(README, 'utf8');
const found = [...readme.matchAll(MARKER)];
const versions = new Map();

for (const [, kind, id, current] of found) {
  const key = `${kind}:${id}`;
  if (versions.has(key)) continue;
  try {
    versions.set(key, await sources[kind](id));
  } catch (error) {
    console.warn(`⚠ ${key} : ${error.message} (valeur gardée : ${current})`);
    versions.set(key, current);
  }
}

const updated = readme.replace(MARKER, (_, kind, id) => `<!-- auto:${kind}:${id} -->${versions.get(`${kind}:${id}`)}<!-- /auto -->`);

for (const [key, version] of versions) console.log(`${key} → ${version}`);
if (updated !== readme) {
  writeFileSync(README, updated);
  console.log('README.md mis à jour');
} else {
  console.log('README.md déjà à jour');
}
