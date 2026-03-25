import { reviewGitHubPR } from './dist/tools.js';

async function run() {
  process.env.GITHUB_TOKEN = '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';
  process.env.GITHUB_OWNER = 'Smart-Energy-Solution-Ltd';
  process.env.GITHUB_REPO = 'taraa-backend';
  
  try {
    const prNumber = 13;
    console.log(`Starting review for PR #${prNumber}...`);
    const result = await reviewGitHubPR(prNumber, 'Smart-Energy-Solution-Ltd', 'taraa-backend', false);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error during PR review:', error);
  }
}

run();
