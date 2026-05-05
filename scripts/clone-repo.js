const { execSync } = require('child_process');

const [repoUrl, repoRef, targetDir] = process.argv.slice(2);

if (!repoUrl || !repoRef || !targetDir) {
  console.error('Usage: node scripts/clone-repo.js <repo-url> <repo-ref> <target-dir>');
  process.exit(1);
}

function withToken(url, token) {
  if (!token) return url;
  if (!url.startsWith('https://')) return url;
  return url.replace('https://', `https://x-access-token:${token}@`);
}

const secureUrl = withToken(repoUrl, process.env.REPO_TOKEN);

try {
  execSync(`git clone --depth 1 --branch "${repoRef}" "${secureUrl}" "${targetDir}"`, {
    stdio: 'inherit'
  });
} catch (_error) {
  console.error(`Failed cloning ${repoUrl} with ref ${repoRef}.`);
  console.error('If repository is private, set GitHub secret EXTERNAL_REPO_TOKEN with read access.');
  process.exit(1);
}
