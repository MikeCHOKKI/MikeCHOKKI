// Génère assets/stats.svg : statistiques GitHub du profil, affichées façon terminal (palette Nuit & Or).
// Aucune dépendance : Node 20+ (fetch natif). Lance en local avec `GITHUB_TOKEN=$(gh auth token) node .github/scripts/profile-stats.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';

const LOGIN = process.env.GITHUB_USERNAME || 'MikeCHOKKI';
const TOKENS = [process.env.GH_TOKEN, process.env.GITHUB_TOKEN].filter(Boolean);
const OUTPUT = 'assets/stats.svg';
// Langages de balisage ou de notebooks : ils gonflent les pourcentages sans refléter le code écrit.
const IGNORED_LANGUAGES = new Set(['HTML', 'CSS', 'SCSS', 'Jupyter Notebook', 'Makefile', 'Dockerfile', 'Shell', 'Batchfile', 'PowerShell', 'CMake', 'C++', 'Swift', 'Kotlin', 'Objective-C', 'Ruby']);

const QUERY = `query ($login: String!) {
  user(login: $login) {
    followers { totalCount }
    publicRepos: repositories(ownerAffiliations: OWNER, privacy: PUBLIC) { totalCount }
    ownRepos: repositories(ownerAffiliations: OWNER, isFork: false, first: 100) {
      nodes {
        isPrivate
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
    contributionsCollection {
      contributionCalendar { totalContributions }
      totalCommitContributions
      totalPullRequestContributions
    }
  }
}`;

async function fetchStats() {
  if (TOKENS.length === 0) throw new Error('GH_TOKEN ou GITHUB_TOKEN requis');
  let lastError;
  // GH_TOKEN (jeton personnel, inclut les dépôts privés) en priorité ; repli sur le jeton du workflow s'il est expiré.
  for (const token of TOKENS) {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats' },
      body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.data?.user) return body.data.user;
    lastError = new Error(`GitHub API ${res.status} : ${JSON.stringify(body.errors ?? body.message ?? body)}`);
  }
  throw lastError;
}

function topLanguages(repos, count = 5) {
  const sizes = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      if (IGNORED_LANGUAGES.has(node.name)) continue;
      sizes.set(node.name, (sizes.get(node.name) ?? 0) + size);
    }
  }
  const total = [...sizes.values()].reduce((a, b) => a + b, 0) || 1;
  return [...sizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([name, size]) => ({ name, percent: (size / total) * 100 }));
}

const escapeXml = (s) => String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
const nf = new Intl.NumberFormat('fr-FR');

function render(user) {
  const repos = user.ownRepos.nodes;
  const stars = repos.filter((r) => !r.isPrivate).reduce((sum, r) => sum + r.stargazerCount, 0);
  const c = user.contributionsCollection;
  const updated = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Dakar' }).format(new Date());

  const rows = [
    ['abonnés', nf.format(user.followers.totalCount)],
    ['dépôts publics', nf.format(user.publicRepos.totalCount)],
    ['étoiles', nf.format(stars)],
    ['contributions', `${nf.format(c.contributionCalendar.totalContributions)} (12 derniers mois)`],
    ['commits', nf.format(c.totalCommitContributions)],
    ['pull requests', nf.format(c.totalPullRequestContributions)],
  ];
  const langs = topLanguages(repos);

  const lineH = 26;
  let y = 74;
  const out = [];
  const prompt = (cmd) =>
    `<text x="24" y="${y}"><tspan class="user">mike@lucidforge</tspan><tspan class="sep">:</tspan><tspan class="path">~</tspan><tspan class="sep">$ </tspan><tspan class="cmd">${escapeXml(cmd)}</tspan></text>`;

  out.push(prompt(`gh stats --user ${LOGIN}`));
  y += lineH + 6;
  for (const [label, value] of rows) {
    out.push(`<text x="24" y="${y}"><tspan class="label">${escapeXml(label.padEnd(16, '.'))}</tspan><tspan class="value"> ${escapeXml(value)}</tspan></text>`);
    y += lineH;
  }

  y += 14;
  out.push(prompt('gh stats --languages --top 5'));
  y += lineH + 6;
  const barWidth = 300;
  for (const { name, percent } of langs) {
    const filled = Math.max(2, Math.round((percent / 100) * barWidth));
    out.push(
      `<text x="24" y="${y}" class="value">${escapeXml(name)}</text>` +
        `<rect x="190" y="${y - 13}" width="${barWidth}" height="14" rx="2" fill="#0F172A"/>` +
        `<rect x="190" y="${y - 13}" width="${filled}" height="14" rx="2" fill="#D4A017"/>` +
        `<text x="${190 + barWidth + 16}" y="${y}" class="label">${percent.toFixed(1).replace('.', ',')} %</text>`,
    );
    y += lineH;
  }

  y += 14;
  out.push(`<text x="24" y="${y}" class="muted"># mis à jour le ${updated} par GitHub Actions</text>`);
  const height = y + 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="${height}" viewBox="0 0 860 ${height}" role="img" aria-label="Statistiques GitHub de ${escapeXml(LOGIN)}">
  <style>
    text { font-family: 'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 15px; }
    .user { fill: #D4A017; font-weight: 700; }
    .sep, .muted { fill: #64748B; }
    .path { fill: #F5E6B8; }
    .cmd { fill: #F8FAFC; }
    .label { fill: #94A3B8; }
    .value { fill: #F8FAFC; }
  </style>
  <rect x="1" y="1" width="858" height="${height - 2}" rx="12" fill="#020617" stroke="#D4A017" stroke-opacity="0.45" stroke-width="1.5"/>
  <path d="M1 13 a12 12 0 0 1 12 -12 h834 a12 12 0 0 1 12 12 v25 h-858 z" fill="#0B1220"/>
  <line x1="1" y1="38" x2="859" y2="38" stroke="#D4A017" stroke-opacity="0.25"/>
  <circle cx="24" cy="20" r="6" fill="#EF4444"/><circle cx="44" cy="20" r="6" fill="#EAB308"/><circle cx="64" cy="20" r="6" fill="#22C55E"/>
  <text x="430" y="25" text-anchor="middle" class="muted" style="font-size:13px">mike@lucidforge: ~/stats — zsh</text>
  ${out.join('\n  ')}
</svg>
`;
}

const user = await fetchStats();
mkdirSync('assets', { recursive: true });
writeFileSync(OUTPUT, render(user));
console.log(`✅ ${OUTPUT} généré`);
