// Publishes this static-site project to the user's existing organization repository.
// Read the token from stdin; never write it to disk, command arguments or Git config.
import { createInterface } from 'node:readline';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';

if (process.stdin.isTTY) process.stdin.setRawMode(true);
const input = createInterface({ input: process.stdin, terminal: false });
console.log('Ready for GitHub token on stdin (input is not echoed).');
const token = await new Promise(resolve => input.once('line', resolve));
input.close();
if (process.stdin.isTTY) process.stdin.setRawMode(false);
if (!token || !token.trim()) throw new Error('No token supplied.');
const secret = token.trim();
const authorization = Buffer.from('x-access-token:' + secret).toString('base64');
const redact = text => String(text).replaceAll(secret, '[REDACTED]').replaceAll(authorization, '[REDACTED]');

async function api(route, options = {}) {
  const response = await fetch('https://api.github.com' + route, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + secret,
      'User-Agent': 'treehouse-camp-static-publisher',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${data.message}`);
  return data;
}

function git(args, authenticated = false) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
  // Disable saved credential helpers and inject an in-memory per-process auth header.
  if (authenticated) {
    env.GIT_CONFIG_COUNT = '2';
    env.GIT_CONFIG_KEY_0 = 'credential.helper'; env.GIT_CONFIG_VALUE_0 = '';
    env.GIT_CONFIG_KEY_1 = 'http.https://github.com/.extraheader';
    env.GIT_CONFIG_VALUE_1 = 'AUTHORIZATION: basic ' + authorization;
  }
  const result = spawnSync('git', args, { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0) throw new Error(redact(result.stderr || result.error || 'Git command failed'));
  return result.stdout.trim();
}

try {
  const account = await api('/user');
  console.log('Authenticated GitHub account: ' + account.login);
  const repoPath = '/repos/CVJMBADEN/treehouse-camp';
  const repo = await api(repoPath);
  if (process.argv.includes('--check-only')) {
    console.log(JSON.stringify({ repository: repo.full_name, private: repo.private, defaultBranch: repo.default_branch, accountPermissions: repo.permissions, sizeKiB: repo.size }, null, 2));
    console.log('Read-only access check completed. No files uploaded or repository changes made.');
    process.exit(0);
  }
  const existingHead = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', windowsHide: true });
  if (existingHead.status === 0) throw new Error('Local checkout already has commits; inspect before publishing.');
  if (git(['remote'])) throw new Error('A remote is already configured; inspect before publishing.');
  const candidates = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const file of candidates) {
    const bytes = await fs.readFile(file);
    if (bytes.includes(Buffer.from(secret))) throw new Error('Credential found in a candidate upload file. Aborting.');
    if (bytes.length >= 100 * 1024 * 1024) throw new Error('File exceeds GitHub limit: ' + file);
  }
  const branches = await api(repoPath + '/branches?per_page=100');
  if (branches.length) {
    const branch = branches.find(b => b.name === repo.default_branch) || branches[0];
    const tree = await api(repoPath + '/git/trees/' + branch.commit.sha + '?recursive=1');
    console.log(JSON.stringify({ existingBranches: branches.map(b => b.name), existingFiles: tree.tree.filter(e => e.type === 'blob').map(e => e.path) }, null, 2));
    throw new Error('Repository already has content. Inspect the existing files before importing.');
  }
  console.log('Confirmed empty target repository: ' + repo.html_url);
  git(['symbolic-ref', 'HEAD', 'refs/heads/codex/static-site']);
  git(['add', '--', '.gitignore', 'README.md', 'dist', 'migration-report.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'scripts', 'snapshot', 'src']);
  git(['-c', 'user.name=' + (account.name || account.login), '-c', `user.email=${account.id}+${account.login}@users.noreply.github.com`, 'commit', '-m', 'Import CMS-free static Treehouse Camp website']);
  git(['remote', 'add', 'origin', repo.clone_url]);
  git(['push', '--set-upstream', 'origin', 'HEAD:refs/heads/main'], true);
  const localSha = git(['rev-parse', 'HEAD']);
  const remote = await api(repoPath + '/commits/main');
  if (remote.sha !== localSha) throw new Error('Uploaded commit does not match local HEAD.');
  const tree = await api(repoPath + `/git/trees/${localSha}?recursive=1`);
  if (tree.truncated || !tree.tree.some(e => e.path === 'dist/index.html')) throw new Error('Static export missing from remote tree.');
  const count = tree.tree.filter(e => e.type === 'blob' && e.path.startsWith('dist/')).length;
  if (count !== 231) throw new Error('Unexpected deployed file count: ' + count);
  console.log(JSON.stringify({ url: repo.html_url, private: repo.private, branch: 'main', commit: localSha, staticFiles: count, totalFiles: tree.tree.filter(e => e.type === 'blob').length }, null, 2));
} catch (error) {
  console.error(redact(error.message));
  process.exitCode = 1;
}
