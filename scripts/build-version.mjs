import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';

const isCommit = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value.trim());

function getGitCommit() {
  const environmentCandidates = [
    process.env.RENDER_GIT_COMMIT,
    process.env.GITHUB_SHA,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.CF_PAGES_COMMIT_SHA,
  ];

  for (const candidate of environmentCandidates) {
    if (isCommit(candidate)) return candidate.trim();
  }

  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (isCommit(commit)) return commit;
  } catch {
    // Snapshot-based builders such as Portals may not include .git metadata.
  }

  return null;
}

const commit = getGitCommit();

writeFileSync(
  'dist/version.json',
  JSON.stringify({commit, builtAt: new Date().toISOString()}) + '\n',
);

console.log(
  commit
    ? 'Build revision: ' + commit
    : 'Build revision unavailable: source snapshot has no Git metadata',
);
