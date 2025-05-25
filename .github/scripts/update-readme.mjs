const fs = require('fs');

function updateReadme() {
  try {
    const stats = JSON.parse(fs.readFileSync('./stats.json', 'utf8'));
    let readme = fs.readFileSync('./README.md', 'utf8');
    
    // Générer le contenu dynamique
    const dynamicContent = generateDynamicContent(stats);
    
    // Remplacer les sections dynamiques
    readme = updateSection(readme, 'DYNAMIC_STATS', dynamicContent.stats);
    readme = updateSection(readme, 'TOP_LANGUAGES', dynamicContent.languages);
    readme = updateSection(readme, 'TOP_REPOS', dynamicContent.repos);
    readme = updateSection(readme, 'RECENT_ACTIVITY', dynamicContent.activity);
    
    fs.writeFileSync('./README.md', readme);
    console.log('✅ README updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating README:', error);
    process.exit(1);
  }
}

function updateSection(readme, sectionName, content) {
  const startMarker = `<!-- ${sectionName}_START -->`;
  const endMarker = `<!-- ${sectionName}_END -->`;
  
  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1) {
    return readme.substring(0, startIndex + startMarker.length) + 
           '\n' + content + '\n' + 
           readme.substring(endIndex);
  }
  
  return readme;
}

function generateDynamicContent(stats) {
  return {
    stats: `
<div align="center">

### 📊 **Live GitHub Statistics**

| Metric | Value |
|--------|-------|
| 📁 Total Repositories | ${stats.totalRepos} |
| 🔓 Public Repositories | ${stats.publicRepos} |
| 🔒 Private Repositories | ${stats.privateRepos} |
| ⭐ Total Stars Earned | ${stats.totalStars} |
| 🍴 Total Forks | ${stats.totalForks} |
| 👀 Total Watchers | ${stats.totalWatchers} |
| 👥 Followers | ${stats.user.followers} |

*Last updated: ${new Date(stats.lastUpdated).toLocaleDateString()}*

</div>`,

    languages: `
<div align="center">

### 💻 **Most Used Languages (Live Data)**

${stats.topLanguages.map((lang, index) => 
  `${index + 1}. **${lang.name}** - ${lang.percentage}%`
).join('\n')}

</div>`,

    repos: `
<div align="center">

### 🌟 **Top Repositories**

${stats.topRepositories.map(repo => `
#### [${repo.name}](${repo.url}) ${repo.private ? '🔒' : '🔓'}
*${repo.description}*
- **Language:** ${repo.language || 'N/A'}
- **Stars:** ⭐ ${repo.stars} | **Forks:** 🍴 ${repo.forks}
`).join('\n')}

</div>`,

    activity: `
<div align="center">

### ⚡ **Recent Activity**

${stats.recentActivity.map(activity => 
  `- **${activity.action}** in [${activity.repo}] - *${new Date(activity.date).toLocaleDateString()}*`
).join('\n')}

</div>`
  };
}

updateReadme();