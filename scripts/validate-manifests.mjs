#!/usr/bin/env node
/**
 * validate-manifests.mjs — prove the repository is a valid plugin for every host.
 *
 *   node scripts/validate-manifests.mjs
 *   npm run verify
 *
 * The repo root doubles as the plugin root, so one wrong manifest field silently
 * breaks `claude plugin install` and the Qoder marketplace import. This checks the
 * four manifests, the skill folder shape, every path a manifest or a doc declares,
 * the packaging list, and the line endings that make or break `curl | bash`.
 *
 * Offline, zero dependencies, exit 1 on any problem.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = join(ROOT, 'skills', 'ui-motion');
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const C = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  red: '\u001b[31m',
};
const paint = (color, text) => (process.stdout.isTTY ? `${color}${text}${C.reset}` : text);

const problems = [];
let checks = 0;

function assert(condition, label, detail) {
  checks += 1;
  if (condition) {
    console.log(`${paint(C.green, '+')} ${label}`);
    return true;
  }
  problems.push(label);
  console.log(`${paint(C.red, 'x')} ${label}`);
  if (detail) console.log(`  ${paint(C.dim, detail)}`);
  return false;
}

function readJson(path) {
  const abs = join(ROOT, path);
  if (!existsSync(abs)) {
    assert(false, `${path} exists`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch (error) {
    assert(false, `${path} is valid JSON`, error.message);
    return null;
  }
}

/** A manifest path must be './'-relative, inside the plugin root, and real. */
function declaredPath(value) {
  return typeof value === 'string'
    && value.startsWith('./')
    && !value.includes('..')
    && existsSync(join(ROOT, value));
}

/* ------------------------------------------------------------ plugin manifests */

console.log(`\n${paint(C.green, 'claude code')}`);

const claudePlugin = readJson('.claude-plugin/plugin.json');
if (claudePlugin) {
  assert(KEBAB.test(claudePlugin.name || ''), `plugin name is kebab-case (${claudePlugin.name})`,
    'Claude resolves the plugin by this name in `plugin install <name>@<marketplace>`.');
  assert((claudePlugin.description || '').length > 20, 'plugin has a description');
  assert(!('skills' in claudePlugin) || declaredPath(claudePlugin.skills), 'plugin skills path resolves');
  // Declaring no component keys means the default `skills/<name>/SKILL.md` scan is the
  // contract, so assert that folder shape is actually what ships.
  assert(existsSync(join(SKILL_DIR, 'SKILL.md')), 'skills/ui-motion/SKILL.md exists for the default scan');
}

const claudeMarket = readJson('.claude-plugin/marketplace.json');
if (claudeMarket) {
  assert(KEBAB.test(claudeMarket.name || ''), `marketplace name is kebab-case (${claudeMarket.name})`);
  assert(Boolean(claudeMarket.owner && claudeMarket.owner.name), 'marketplace has an owner');
  assert(Array.isArray(claudeMarket.plugins) && claudeMarket.plugins.length > 0, 'marketplace lists plugins');
  for (const entry of claudeMarket.plugins || []) {
    assert(Boolean(entry.name) && Boolean(entry.source), `entry "${entry.name}" has name + source`);
    assert(entry.name === claudePlugin?.name, `entry "${entry.name}" matches the plugin name`,
      'A mismatch makes the marketplace list the plugin under a name that cannot install.');
    if (typeof entry.source === 'string') {
      const isRoot = entry.source === '.' || entry.source === './';
      assert(isRoot || (entry.source.startsWith('./') && !entry.source.includes('..')),
        `source "${entry.source}" stays inside the repository`);
      if (isRoot) assert(Boolean(claudePlugin), 'a root source needs a root plugin manifest');
    } else if (entry.source?.source === 'github') {
      assert(Boolean(entry.source.repo), `github source declares a repo (${entry.source.repo})`);
    }
    // A version duplicated from plugin.json is a documented validation warning.
    assert(entry.version === undefined || entry.version === claudePlugin?.version,
      `entry "${entry.name}" does not contradict the plugin version`);
  }
}

console.log(`\n${paint(C.green, 'qoder')}`);

const qoderPlugin = readJson('.qoder-plugin/plugin.json');
if (qoderPlugin) {
  assert(KEBAB.test(qoderPlugin.name || ''), `plugin name is kebab-case (${qoderPlugin.name})`,
    'The plugin folder and manifest name must match.');
  assert(Boolean(qoderPlugin.displayName), 'plugin has a displayName');
  assert(Boolean(qoderPlugin.description), 'plugin has a description');
  assert(declaredPath(qoderPlugin.logo), `logo path resolves (${qoderPlugin.logo})`);
  assert(declaredPath(qoderPlugin.skills), `skills path resolves (${qoderPlugin.skills})`);
  assert((qoderPlugin.keywords || []).includes('qoder-plugin'), 'keywords include qoder-plugin');
  assert(Array.isArray(qoderPlugin.tags) && qoderPlugin.tags.length > 0, 'plugin has tags');
  for (const folder of ['references', 'assets', 'scripts']) {
    assert(existsSync(join(SKILL_DIR, folder)), `skill ships ${folder}/`);
  }
  assert(existsSync(join(SKILL_DIR, 'scripts', 'audit.mjs')),
    'skill ships its own auditor, so an installed copy can still audit a build');
}

const qoderMarket = readJson('.qoder-plugin/marketplace.json');
if (qoderMarket) {
  assert(KEBAB.test(qoderMarket.name || ''), `marketplace name is kebab-case (${qoderMarket.name})`);
  assert(Boolean(qoderMarket.owner && qoderMarket.owner.name), 'marketplace has an owner');
  for (const entry of qoderMarket.plugins || []) {
    assert(Boolean(entry.name) && Boolean(entry.source), `entry "${entry.name}" has name + source`);
    assert(entry.name === qoderPlugin?.name, `entry "${entry.name}" matches the qoder plugin name`);
  }
}

/* ------------------------------------------------------------- skill contract */

console.log(`\n${paint(C.green, 'skill')}`);

const skillText = existsSync(join(SKILL_DIR, 'SKILL.md')) ? readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8') : '';
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillText);
assert(Boolean(frontmatter), 'SKILL.md opens with a frontmatter block');
if (frontmatter) {
  const name = /^name:\s*(.+)$/m.exec(frontmatter[1])?.[1]?.trim();
  const description = /^description:\s*(.+)$/m.exec(frontmatter[1])?.[1]?.trim();
  assert(name === 'ui-motion', `frontmatter name matches the skill folder (${name})`);
  assert(Boolean(description) && description.length > 40, 'frontmatter description says when to load the skill');
  assert((description || '').length < 1024, 'frontmatter description is under 1024 characters');
  const version = /^\s+version:\s*(.+)$/m.exec(frontmatter[1])?.[1]?.trim();
  assert(version === qoderPlugin?.version, `SKILL.md version tracks the manifests (${version} / ${qoderPlugin?.version})`);
}

const payloadDirs = ['assets', 'references', 'scripts'];
const payloadFiles = [join(SKILL_DIR, 'SKILL.md')];
for (const dir of payloadDirs) {
  const abs = join(SKILL_DIR, dir);
  if (existsSync(abs)) payloadFiles.push(...readdirSync(abs).filter((n) => n.endsWith('.md')).map((n) => join(abs, n)));
}

// A doc that points at `references/09-...md` which does not exist trains the agent to
// hallucinate a file. Every relative skill path mentioned in any doc must resolve.
const documented = new Set();
for (const doc of payloadFiles) {
  const text = readFileSync(doc, 'utf8');
  for (const match of text.matchAll(/`((?:references|assets|scripts|examples)\/[\w./-]+\.(?:md|js|mjs|css|html))`/g)) {
    documented.add(match[1]);
  }
  for (const match of text.matchAll(/\]\((?!https?:|#)([\w./-]+\.(?:md|css|js))\)/g)) documented.add(match[1]);
}
const broken = [...documented].filter(
  (path) => !existsSync(join(SKILL_DIR, path)) && !existsSync(join(ROOT, path)),
);
assert(broken.length === 0, `all ${documented.size} documented skill paths exist`, broken.join(', '));

/* ---------------------------------------------------------------- packaging */

console.log(`\n${paint(C.green, 'package')}`);

const pkg = readJson('package.json');
if (pkg) {
  assert(existsSync(join(ROOT, pkg.bin?.['ui-skill'] || '.')), 'package.json bin path exists');
  const absent = (pkg.files || []).filter((entry) => !existsSync(join(ROOT, entry)));
  assert(absent.length === 0, `all ${pkg.files?.length} "files" entries exist`, absent.join(', '));
  assert(pkg.version === qoderPlugin?.version, `npm version tracks the plugin version (${pkg.version})`);
}

// CRLF in install.sh is fatal on a real shell: `bash\r: No such file or directory`.
const sh = readFileSync(join(ROOT, 'install.sh'), 'utf8');
assert(!sh.includes('\r'), 'install.sh uses LF line endings');
assert(sh.startsWith('#!/usr/bin/env bash'), 'install.sh starts with a bash shebang');
assert(existsSync(join(ROOT, '.gitattributes')), '.gitattributes pins line endings');

const gitattributes = existsSync(join(ROOT, '.gitattributes')) ? readFileSync(join(ROOT, '.gitattributes'), 'utf8') : '';
const pinsShell = /\.sh\b.*eol=lf/.test(gitattributes);
const defaultsToLf = /^\*\s+text=auto\s+eol=lf\s*$/m.test(gitattributes);
assert(pinsShell || defaultsToLf, '.gitattributes keeps shell scripts at LF',
  'Without it, a Windows clone checks out install.sh with CRLF and `bash` refuses to run it.');

for (const name of ['README.md', 'LICENSE', '.github/workflows/validate.yml']) {
  assert(existsSync(join(ROOT, name)), `${name} is present`);
}

const landing = existsSync(join(ROOT, 'scripts', 'build-site.mjs'))
  ? readFileSync(join(ROOT, 'scripts', 'build-site.mjs'), 'utf8')
  : '';
assert(landing.includes('__BASE__') && !landing.includes('http://localhost'),
  'the Pages build is base-path relative (no hard-coded localhost)');

/* -------------------------------------------------------------------- report */

const scope = relative(process.cwd(), ROOT) || '.';
console.log('');
if (problems.length) {
  console.log(paint(C.red, `${scope}: ${problems.length} problem${problems.length === 1 ? '' : 's'} in ${checks} checks`));
  for (const problem of problems) console.log(`  ${paint(C.dim, problem)}`);
  process.exitCode = 1;
} else {
  console.log(paint(C.green, `${scope}: valid plugin for claude code + qoder · ${checks} checks · ${documented.size} documented paths`));
}
