import { fetchPullRequests } from './dist/tools.js';

async function run() {
  process.env.GITHUB_TOKEN = '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';
  process.env.GITHUB_OWNER = 'Smart-Energy-Solution-Ltd';
  process.env.GITHUB_REPO = 'taraa-backend';
  
  try {
    const prs = await fetchPullRequests('Smart-Energy-Solution-Ltd', 'taraa-backend', 'all', 5);
    console.log(JSON.stringify(prs, null, 2));
  } catch (error) {
    console.error(error);
  }
}

run();
