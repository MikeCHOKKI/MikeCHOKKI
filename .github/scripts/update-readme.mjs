import fs from 'fs';

const nf = new Intl.NumberFormat('fr-FR');
const df = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const EVENT_EMOJI = {
  PushEvent: '📝',
  CreateEvent: '🔀',
  ForkEvent: '🍴',
  WatchEvent: '⭐',
  IssuesEvent: '❗',
  PullRequestEvent: '🔀',
};

function updateReadme() {
  try {
    if (!fs.existsSync('./stats.json')) {
      console.error('❌ stats.json introuvable — exécute d\'abord generate-stats.mjs');
      process.exit(1);
    }
    const stats = JSON.parse(fs.readFileSync('./stats.json', 'utf8'));

    if (!fs.existsSync('./README.md')) {
      console.error('❌ README.md introuvable');
      process.exit(1);
    }
    let readme = fs.readFileSync('./README.md', 'utf8');

    const dynamicContent = generateDynamicContent(stats);

    readme = updateSection(readme, 'DYNAMIC_STATS', dynamicContent.stats);
    readme = updateSection(readme, 'TOP_LANGUAGES', dynamicContent.languages);
    readme = updateSection(readme, 'TOP_REPOS', dynamicContent.repos);
    readme = updateSection(readme, 'RECENT_ACTIVITY', dynamicContent.activity);

    fs.writeFileSync('./README.md', readme);
    console.log('✅ README mis à jour avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour du README :', error);
    process.exit(1);
  }
}

function updateSection(readme, sectionName, content) {
  const startMarker = `<!-- ${sectionName}_START -->`;
  const endMarker = `<!-- ${sectionName}_END -->`;

  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.warn(`⚠️ Marqueur introuvable dans README.md : ${startMarker} — section ignorée`);
    return readme;
  }

  return (
    readme.substring(0, startIndex + startMarker.length) +
    '\n' + content + '\n' +
    readme.substring(endIndex)
  );
}

function formatDate(dateStr) {
  try {
    return df.format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function languageBar(percentage) {
  const filled = Math.round(percentage / 10);
  const empty = 10 - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

function generateDynamicContent(stats) {
  const statsRow = [
    '| 📁 Dépôts | 🔓 Publics | 🔒 Privés | ⭐ Étoiles | 🍴 Forks | 👀 Watchs | 👥 Followers |',
    '|-----------|-----------|-----------|-----------|---------|---------|------------|',
    `| ${nf.format(stats.totalRepos)} | ${nf.format(stats.publicRepos)} | ${nf.format(stats.privateRepos)} | ${nf.format(stats.totalStars)} | ${nf.format(stats.totalForks)} | ${nf.format(stats.totalWatchers)} | ${nf.format(stats.user?.followers ?? 0)} |`,
  ].join('\n');

  return {
    stats: `
${statsRow}

*Dernière mise à jour : ${formatDate(stats.lastUpdated)}*`,

    languages: stats.topLanguages.length > 0
      ? stats.topLanguages.map(lang =>
          `${languageBar(lang.percentage)} ${lang.percentage}% **${lang.name}**`
        ).join('\n')
      : '*Aucune donnée de langage*',

    repos: stats.topRepositories.length > 0
      ? stats.topRepositories.map(repo => {
          const badge = repo.language
            ? '`' + repo.language + '`'
            : '';
          const desc = repo.description || '*Aucune description*';
          return `⭐ [**${repo.name}**](${repo.url}) — ${desc} ${badge} • 🍴 ${nf.format(repo.forks)}`;
        }).join('\n')
      : '*Aucun dépôt public*',

    activity: stats.recentActivity.length > 0
      ? stats.recentActivity.map(activity => {
          const emoji = EVENT_EMOJI[activity.type] || '⚡';
          const repoName = activity.repo ? activity.repo.split('/')[1] : 'inconnu';
          return `${emoji} **${formatDate(activity.date)}** — ${activity.action} dans [${repoName}](https://github.com/${activity.repo})`;
        }).join('\n')
      : '*Aucune activité récente*',
  };
}

updateReadme();
