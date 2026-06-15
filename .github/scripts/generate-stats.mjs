import { Octokit } from '@octokit/rest';
import fs from 'fs';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;

if (!GITHUB_TOKEN) {
  console.error('[generate-stats] ❌ GITHUB_TOKEN requis');
  process.exit(1);
}
if (!GITHUB_USERNAME) {
  console.error('[generate-stats] ❌ GITHUB_USERNAME requis');
  process.exit(1);
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });
const username = GITHUB_USERNAME;

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

async function generateStats() {
  try {
    log('🚀 Récupération des données utilisateur...');

    const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
      username,
      per_page: 100,
      type: 'all',
      sort: 'updated',
    });

    const { data: user } = await octokit.rest.users.getByUsername({ username });

    log(`📦 ${repos.length} dépôts chargés`);

    const stats = {
      totalRepos: repos.length,
      sourceRepos: repos.filter(r => !r.fork).length,
      forkedRepos: repos.filter(r => r.fork).length,
      publicRepos: repos.filter(r => !r.private).length,
      privateRepos: repos.filter(r => r.private).length,
      totalStars: repos.reduce((acc, r) => acc + r.stargazers_count, 0),
      totalForks: repos.reduce((acc, r) => acc + r.forks_count, 0),
      totalWatchers: repos.reduce((acc, r) => acc + r.watchers_count, 0),
      totalOpenIssues: repos.reduce((acc, r) => acc + r.open_issues_count, 0),
      languages: {},
      lastUpdated: new Date().toISOString(),
    };

    const langRepos = repos.slice(0, 20);
    log(`🌐 Récupération des langues (${langRepos.length} dépôts, lots de 5)...`);

    for (let i = 0; i < langRepos.length; i += 5) {
      const batch = langRepos.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(r => octokit.rest.repos.listLanguages({ owner: username, repo: r.name }))
      );
      results.forEach((res, idx) => {
        const repo = batch[idx];
        if (res.status === 'fulfilled') {
          Object.entries(res.value.data).forEach(([lang, bytes]) => {
            stats.languages[lang] = (stats.languages[lang] || 0) + bytes;
          });
        } else {
          log(`⚠️  ${repo.name} : langues indisponibles (${res.reason.message})`);
        }
      });
    }

    const totalBytes = Object.values(stats.languages).reduce((a, b) => a + b, 0);

    const sortedLanguages = Object.entries(stats.languages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([lang, bytes]) => ({
        name: lang,
        bytes,
        percentage: totalBytes > 0
          ? Number.parseFloat(((bytes / totalBytes) * 100).toFixed(1))
          : 0,
      }));

    const topRepos = repos
      .filter(r => !r.private)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map(r => ({
        name: r.name,
        description: r.description || '',
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language,
        url: r.html_url,
      }));

    log('⚡ Récupération de l\'activité récente...');
    const { data: events } = await octokit.rest.activity.listPublicEventsForUser({
      username,
      per_page: 10,
    });

    const recentActivity = events.slice(0, 5).map(event => ({
      type: event.type,
      repo: event.repo.name,
      date: event.created_at,
      action: getEventDescription(event),
    }));

    const finalStats = {
      ...stats,
      user: {
        name: user.name,
        bio: user.bio,
        location: user.location,
        company: user.company,
        blog: user.blog,
        followers: user.followers,
        following: user.following,
        publicGists: user.public_gists,
        createdAt: user.created_at,
      },
      topLanguages: sortedLanguages,
      topRepositories: topRepos,
      recentActivity,
    };

    fs.writeFileSync('./stats.json', JSON.stringify(finalStats, null, 2));
    log('✅ Stats générées avec succès');
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Erreur :`, error);
    process.exit(1);
  }
}

function getEventDescription(event) {
  const payload = event.payload || {};
  const count = payload.commits?.length || 0;
  switch (event.type) {
    case 'PushEvent':
      return `A poussé ${count} commit${count > 1 ? 's' : ''}`;
    case 'CreateEvent':
      return `A créé ${payload.ref_type || 'une ressource'}`;
    case 'ForkEvent':
      return 'A forké un dépôt';
    case 'WatchEvent':
      return 'A ajouté une étoile';
    case 'IssuesEvent':
      if (payload.action === 'opened') return 'Ouvert une issue';
      if (payload.action === 'closed') return 'Fermé une issue';
      return 'Mis à jour une issue';
    case 'PullRequestEvent':
      if (payload.action === 'opened') return 'Ouvert une pull request';
      if (payload.action === 'closed') return 'Fermé une pull request';
      if (payload.action === 'merged') return 'Fusionné une pull request';
      return 'Mis à jour une pull request';
    default:
      return event.type.replace('Event', '');
  }
}

generateStats();
