import { Octokit } from '@octokit/rest';
import fs from 'fs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const username = process.env.GITHUB_USERNAME;

async function generateStats() {
  try {
    console.log('🚀 Fetching user data...');
    
    const { data: repos } = await octokit.rest.repos.listForUser({
      username: username,
      per_page: 100,
      type: 'all' 
    });

    const { data: user } = await octokit.rest.users.getByUsername({
      username: username,
    });

    const stats = {
      totalRepos: repos.length,
      publicRepos: repos.filter(repo => !repo.private).length,
      privateRepos: repos.filter(repo => repo.private).length,
      totalStars: repos.reduce((acc, repo) => acc + repo.stargazers_count, 0),
      totalForks: repos.reduce((acc, repo) => acc + repo.forks_count, 0),
      totalWatchers: repos.reduce((acc, repo) => acc + repo.watchers_count, 0),
      languages: {},
      lastUpdated: new Date().toISOString(),
    };

    for (const repo of repos.slice(0, 20)) { 
      try {
        const { data: languages } = await octokit.rest.repos.listLanguages({
          owner: username,
          repo: repo.name,
        });
        
        Object.entries(languages).forEach(([lang, bytes]) => {
          stats.languages[lang] = (stats.languages[lang] || 0) + bytes;
        });
      } catch (error) {
        console.warn(`Cannot fetch languages for ${repo.name}:`, error.message);
      }
    }

    const sortedLanguages = Object.entries(stats.languages)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([lang, bytes]) => ({
        name: lang,
        bytes: bytes,
        percentage: ((bytes / Object.values(stats.languages).reduce((a, b) => a + b, 0)) * 100).toFixed(1)
      }));

    const topRepos = repos
      .filter(repo => !repo.private || repo.stargazers_count > 0)
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map(repo => ({
        name: repo.name,
        description: repo.description || 'No description',
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        url: repo.html_url,
        private: repo.private
      }));

    const { data: events } = await octokit.rest.activity.listPublicEventsForUser({
      username: username,
      per_page: 10
    });

    const recentActivity = events.slice(0, 5).map(event => ({
      type: event.type,
      repo: event.repo.name,
      date: event.created_at,
      action: getEventDescription(event)
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
        createdAt: user.created_at
      },
      topLanguages: sortedLanguages,
      topRepositories: topRepos,
      recentActivity: recentActivity
    };

    fs.writeFileSync('./stats.json', JSON.stringify(finalStats, null, 2));
    console.log('✅ Stats generated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating stats:', error);
    process.exit(1);
  }
}

function getEventDescription(event) {
  switch (event.type) {
    case 'PushEvent':
      return `Pushed ${event.payload.commits?.length || 0} commit(s)`;
    case 'CreateEvent':
      return `Created ${event.payload.ref_type}`;
    case 'ForkEvent':
      return 'Forked repository';
    case 'WatchEvent':
      return 'Starred repository';
    case 'IssuesEvent':
      return `${event.payload.action} issue`;
    case 'PullRequestEvent':
      return `${event.payload.action} pull request`;
    default:
      return event.type.replace('Event', '');
  }
}

generateStats();