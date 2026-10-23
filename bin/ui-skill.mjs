#!/usr/bin/env node
/**
 * ui-skill — installer for the ui-motion agent skill.
 *
 *   npx ui-skill install                 # auto-detect agent homes, copy
 *   npx ui-skill install --target claude --target qoder
 *   npx ui-skill install --project --target cursor
 *   npx ui-skill install --link          # symlink instead of copy (dev)
 *   npx ui-skill list
 *   npx ui-skill doctor
 *   npx ui-skill uninstall
 *
 * Copy is the safe default: it needs no elevated privileges on Windows, and the
 * installed skill keeps working if you move the repository.
 */

import { cp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'ui-motion';
const SKILL_ENTRY = 'SKILL.md';
// The skill payload lives at skills/ui-motion/ so the repository root is also a
// valid plugin root for Claude Code (.claude-plugin) and Qoder (.qoder-plugin).
const SKILL_ROOT = join(ROOT, 'skills', SKILL_NAME);
const PAYLOAD = ['SKILL.md', 'references', 'assets', 'scripts'];

const C = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  cyan: '\u001b[36m',
};

const paint = (color, text) => (process.stdout.isTTY ? `${color}${text}${C.reset}` : text);
const ok = (text) => paint(C.green, `✓ ${text}`);
const warn = (text) => paint(C.yellow, `! ${text}`);
const fail = (text) => paint(C.red, `✗ ${text}`);
const info = (text) => paint(C.dim, text);

/* ------------------------------------------------------------------ targets */

/**
 * `skills` targets receive the full payload as a folder.
 * `rules` targets receive one distilled markdown file.
 */
const TARGETS = {
  claude: {
    label: 'Claude Code',
    kind: 'skills',
    user: () => join(homedir(), '.claude', 'skills'),
    project: () => join(process.cwd(), '.claude', 'skills'),
    docs: 'https://docs.claude.com/en/docs/claude-code/skills',
  },
  qoder: {
    label: 'Qoder',
    kind: 'skills',
    user: () => join(homedir(), '.qoder', 'skills'),
    project: () => join(process.cwd(), '.qoder', 'skills'),
    docs: 'https://qoder.com/docs',
  },
  cursor: {
    label: 'Cursor',
    kind: 'rules',
    user: () => join(homedir(), '.cursor', 'rules'),
    project: () => join(process.cwd(), '.cursor', 'rules'),
    file: `${SKILL_NAME}.mdc`,
    docs: 'https://docs.cursor.com/context/rules',
  },
  windsurf: {
    label: 'Windsurf',
    kind: 'rules',
    user: () => join(homedir(), '.windsurf', 'rules'),
    project: () => join(process.cwd(), '.windsurf', 'rules'),
    file: `${SKILL_NAME}.md`,
    docs: 'https://docs.windsurf.com/windsurf/cascade/memories',
  },
  copilot: {
    label: 'GitHub Copilot',
    kind: 'rules',
    project: () => join(process.cwd(), '.github', 'instructions'),
    file: `${SKILL_NAME}.instructions.md`,
    docs: 'https://docs.github.com/en/copilot/customizing-copilot',
  },
  agents: {
    label: 'AGENTS.md (generic)',
    kind: 'rules',
    project: () => process.cwd(),
    file: `${SKILL_NAME}.agents.md`,
    docs: 'https://agents.md',
  },
};

const DEFAULT_TARGETS = ['claude', 'qoder'];

/* -------------------------------------------------------------------- utils */

function parseArgs(argv) {
  const flags = { targets: [], link: false, project: false, all: false, force: false, dest: null, help: false, json: false };
  const command = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'help';

  for (const arg of argv.slice(command === 'help' ? 0 : 1)) {
    if (arg.startsWith('--target=')) flags.targets.push(arg.split('=')[1]);
    else if (arg === '--target' || arg === '-t') flags.pendingTarget = true;
    else if (arg === '--link') flags.link = true;
    else if (arg === '--project') flags.project = true;
    else if (arg === '--all') flags.all = true;
    else if (arg === '--force' || arg === '-f') flags.force = true;
    else if (arg === '--json') flags.json = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg.startsWith('--dest=')) flags.dest = arg.split('=')[1];
    else if (arg === '--dest') flags.pendingDest = true;
    else if (flags.pendingTarget) { flags.targets.push(arg); flags.pendingTarget = false; }
    else if (flags.pendingDest) { flags.dest = arg; flags.pendingDest = false; }
  }

  delete flags.pendingTarget;
  delete flags.pendingDest;
  return { command, flags };
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function listDir(dir, extension) {
  if (!existsSync(dir)) return -1;
  return readdirSync(dir).filter((name) => name.endsWith(extension)).length;
}

async function copyRecursive(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dest = join(to, entry.name);
    if (entry.isDirectory()) await copyRecursive(src, dest);
    else if (entry.isFile()) await cp(src, dest);
  }
}

async function isLinked(dir) {
  try {
    const s = await stat(dir);
    return s.isSymbolicLink();
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------- distilled rules */

const RULES_BODY = `# ui-motion — build rules

Apply these whenever the task is to build or restyle a website: landing page, marketing
site, portfolio, product UI, hero animation, scroll choreography, shader background.

Full skill (references + copy-paste CSS/JS/shaders): install the \`${SKILL_NAME}\` skill folder,
or read the repository at https://github.com/Whalerr09/UI-skill.

## Decide before building

1. Palette archetype (one hue + six-value neutral ramp). Never invent greys per component.
2. Type pairing (two families max) with full fallback stacks.
3. Motion level 0-3. Going over it is a defect.
4. One signature moment. Everything else supports it.

## Tokens

\`\`\`css
:root {
  --page:#05070a; --wall:#0a0e12; --surface:#101419; --content-bg:#131920;
  --fg:#dfe7e0; --fg-muted:#aab4ad; --fg-faint:#78837c;
  --line-soft:rgba(223,231,224,.07); --line:rgba(223,231,224,.13); --line-hard:rgba(223,231,224,.26);
  --accent:#e0231c; --accent-hot:#ff5a3c; --accent-soft:rgba(224,35,28,.16);
  --pad:clamp(20px,3.4vw,56px); --gap:clamp(14px,2.4vw,40px);
  --r-xs:4px; --r-sm:6px; --r-md:9px; --r-lg:14px;
  --ease-out:cubic-bezier(.16,1,.3,1); --ease:cubic-bezier(.22,.61,.36,1);
  --ease-io:cubic-bezier(.65,0,.35,1); --ease-spring:cubic-bezier(.34,1.56,.64,1);
  --dur-0:120ms; --dur-1:180ms; --dur-2:320ms; --dur-3:620ms; --dur-4:900ms; --dur-5:1200ms;
}
\`\`\`

## Motion

- Curves: entrances \`--ease-out\`; exits \`--ease-io\`, exit duration = 0.6 x enter.
- Durations: press 120ms, hover 180ms, drawer 320ms, card 620ms, text 900-1050ms.
- Travel: 4-8% of element height, clamped 8-40px. Scale entrances 0.96 -> 1 maximum.
- Stagger: grids 35ms (cap 420ms), words 72ms, rows 85ms, section header->body 120ms.
- Reveals: one IntersectionObserver for the page, \`rootMargin: "0px 0px -10% 0px"\`,
  \`threshold: .04\`, unobserve after firing, show immediately if already in view.
- No-JS: gate the hidden state behind \`html.js\` added by an inline head script.
- Animate \`transform\`, \`opacity\`, \`filter\` only. Never \`width\`, \`height\`, \`top\`, \`left\`,
  \`margin\`, or \`box-shadow\` per frame. Never \`transition: all\`.

## Masked type

\`\`\`css
.mask-line { display:block; overflow:hidden; padding-bottom:.12em; margin-bottom:-.12em; }
.mask-line > span { display:block; transform:translate3d(0,110%,0); transition:transform 1.05s var(--ease-out); }
.rv-in .mask-line > span { transform:none; }
.word-mask { display:inline-block; overflow:hidden; vertical-align:top; }
.word { display:inline-block; opacity:0; transform:translate3d(0,112%,0);
  transition:transform .82s var(--ease-out), opacity .5s var(--ease-out);
  transition-delay:var(--word-delay,0ms); }
.word-reveal.rv-in .word { opacity:1; transform:none; }
\`\`\`

Split headings keep the original string as \`aria-label\`; the spans are \`aria-hidden\`.
Skip the split under reduced motion.

## Scroll

- One scroll listener, \`{ passive: true }\`, rAF-coalesced, writing \`--scroll-y\` and
  \`--scroll-p\` on \`<html>\`. No layout reads inside the handler.
- Pin with \`position: sticky\` at 2.5-4x viewport height. Never hijack wheel or touch.
- Hero exit: map scroll 0..1 over the hero height; each element gets \`{at, span}\`,
  smoothstep opacity, -18px shift, large planes blur up to 10px. Only write when p > 0.
- Parallax coefficient 0.03-0.12, background layers only, disabled below 768px.
- Nav: \`stuck\` from a sentinel observer; hide on scroll-down past 200px.

## WebGL

Use CSS gradients first, Canvas 2D second, raw WebGL only when the effect is per-pixel,
Three.js only when the object's form must be recognised.

Every GPU surface must: size to \`clientWidth * min(devicePixelRatio, 2)\`; observe resize
with \`ResizeObserver\`; pause offscreen and when the tab is hidden; render exactly one frame
under reduced motion; recover from \`webglcontextlost\`; and delete program, shaders,
buffers, textures, observers and listeners on teardown. Maximum two contexts per page.
Canvas is \`aria-hidden="true"\` and \`pointer-events: none\`. A CSS fallback must already
look complete.

Fullscreen fragment shader: one triangle \`[-1,-1, 3,-1, -1,3]\`; \`uv = (gl_FragCoord.xy*2.0 - uRes) / min(uRes.x, uRes.y)\`;
colours from tokens via uniforms; vignette + grain + dither; 3-5 fBm octaves; 30fps is
enough for ambient fields.

## Accessibility

Reduced motion: all travel becomes instant, shaders freeze to a still frame, parallax and
marquee stop, pinned sections unpin, everything stays visible. Read the preference in JS
and listen for \`change\`.

Focus ring \`2px\` accent at \`2px\` offset, never removed. Skip link first in the DOM. One
\`h1\`, ordered headings, named landmarks. Contrast 4.5:1 body / 3:1 large. No scroll
hijacking, no autoplay audio, nothing flashing above 3Hz.

## Performance budget

LCP <= 2.0s · CLS <= 0.02 · INP <= 120ms · JS <= 180KB gzip · CSS <= 60KB gzip ·
<= 2 WebGL contexts · <= 12ms per frame while scrolling.

Hero image \`fetchpriority="high"\` and never lazy. Below-fold images \`loading="lazy"
decoding="async"\` with \`width\`/\`height\`. Two font families, subset, \`display=swap\`. Long
lists get \`content-visibility: auto\` + \`contain-intrinsic-size\`. \`will-change\` only while
animating.

## Layout

Sections follow an arc: arrival -> credibility -> mechanism -> proof -> objection -> offer
-> close. Alternate density (cinematic / compressed / standard). One primary CTA per
viewport, one accent-coloured element per viewport. 0.5px hairlines, four radii, one shadow.
Mobile: \`100svh\`, \`min-width: 0\` on flex/grid children, \`minmax(min(320px, 100%), 1fr)\` grids,
44px touch targets, 16px inputs.

## Verify before shipping

360/768/1440 widths · reduced motion · JS disabled · WebGL blocked · keyboard only ·
Slow 4G with 4x CPU · zero console errors · zero layout during scroll · no source maps.
`;

function renderRules() {
  return `---
description: Build websites with layered motion, masked type reveals, WebGL accents, token-driven CSS, and a hard performance and accessibility budget.
globs: ["**/*.html","**/*.css","**/*.js","**/*.jsx","**/*.tsx","**/*.astro","**/*.vue","**/*.svelte"]
alwaysApply: false
---

${RULES_BODY}`;
}

/* ------------------------------------------------------------------ actions */

async function installSkillFolder(targetDir, { link, force }) {
  const dest = join(targetDir, SKILL_NAME);

  if (await pathExists(dest)) {
    if (!force) {
      const linked = await isLinked(dest);
      return { dest, status: 'exists', linked };
    }
    await rm(dest, { recursive: true, force: true });
  }

  await mkdir(targetDir, { recursive: true });

  if (link) {
    try {
      await symlink(SKILL_ROOT, dest, process.platform === 'win32' ? 'junction' : 'dir');
      return { dest, status: 'linked' };
    } catch (error) {
      // Windows without developer mode cannot create symlinks; copy instead.
      const body = PAYLOAD.filter((entry) => existsSync(join(SKILL_ROOT, entry)));
      await mkdir(dest, { recursive: true });
      for (const entry of body) {
        const from = join(SKILL_ROOT, entry);
        const s = await stat(from);
        if (s.isDirectory()) await copyRecursive(from, join(dest, entry));
        else await cp(from, join(dest, entry));
      }
      return { dest, status: 'copied', note: `symlink unavailable (${error.code || 'error'})` };
    }
  }

  await mkdir(dest, { recursive: true });
  for (const entry of PAYLOAD) {
    const from = join(SKILL_ROOT, entry);
    if (!existsSync(from)) continue;
    const s = await stat(from);
    if (s.isDirectory()) await copyRecursive(from, join(dest, entry));
    else await cp(from, join(dest, entry));
  }
  return { dest, status: 'copied' };
}

async function installRulesFile(targetDir, file, { force }) {
  const dest = join(targetDir, file);

  if (await pathExists(dest)) {
    const existing = await readFile(dest, 'utf8');
    if (existing.includes('ui-motion — build rules') && !force) {
      return { dest, status: 'exists' };
    }
    if (!force) {
      // Do not clobber a different rules file that happens to share the name.
      return { dest, status: 'conflict' };
    }
  }

  await mkdir(targetDir, { recursive: true });
  await writeFile(dest, renderRules(), 'utf8');
  return { dest, status: 'written' };
}

async function cmdInstall(flags) {
  const names = flags.all ? Object.keys(TARGETS) : flags.targets.length ? flags.targets : DEFAULT_TARGETS;

  const unknown = names.filter((name) => !TARGETS[name]);
  if (unknown.length) {
    console.error(fail(`Unknown target(s): ${unknown.join(', ')}`));
    console.error(info(`Available: ${Object.keys(TARGETS).join(', ')}`));
    process.exitCode = 1;
    return;
  }

  if (!existsSync(join(SKILL_ROOT, SKILL_ENTRY))) {
    console.error(fail(`SKILL.md not found in ${SKILL_ROOT}`));
    process.exitCode = 1;
    return;
  }

  console.log(`${paint(C.bold, 'ui-motion')} ${info(`v${await version()}`)} → ${names.join(', ')}${flags.link ? ' (link)' : ''}\n`);

  const results = [];

  for (const name of names) {
    const target = TARGETS[name];
    const resolver = flags.project ? target.project : target.user;

    if (!resolver) {
      console.log(`${warn(name)} ${info('project-only target; add --project')}`);
      continue;
    }

    const dir = flags.dest && names.length === 1 ? resolve(flags.dest) : resolver();

    try {
      if (target.kind === 'skills') {
        const result = await installSkillFolder(dir, flags);
        results.push({ name, ...result });
        if (result.status === 'exists') console.log(`${warn(`${name}: ${relative(process.cwd(), result.dest) || result.dest}`)} ${info('already installed — use --force to replace')}`);
        else if (result.status === 'linked') console.log(ok(`${name}: linked ${relative(process.cwd(), result.dest) || result.dest}`));
        else console.log(ok(`${name}: copied ${relative(process.cwd(), result.dest) || result.dest}${result.note ? info(` (${result.note})`) : ''}`));
      } else {
        const result = await installRulesFile(dir, target.file, flags);
        results.push({ name, ...result });
        if (result.status === 'written') console.log(ok(`${name}: wrote ${relative(process.cwd(), result.dest) || result.dest}`));
        else if (result.status === 'exists') console.log(`${warn(`${name}: ${result.dest}`)} ${info('already up to date — use --force to refresh')}`);
        else console.log(`${warn(`${name}: ${result.dest}`)} ${info('exists with different content — use --force to replace')}`);
      }
    } catch (error) {
      console.log(fail(`${name}: ${error.message}`));
      process.exitCode = 1;
    }
  }

  if (flags.json) console.log(JSON.stringify(results, null, 2));

  console.log(`\n${info('Next:')} open your agent and ask for a landing page.`);
  console.log(info(`  "Build a landing page for my product with motion level 2."`));
  console.log(info('Docs: https://github.com/Whalerr09/UI-skill'));
}

async function cmdUninstall(flags) {
  const names = flags.all ? Object.keys(TARGETS) : flags.targets.length ? flags.targets : DEFAULT_TARGETS;

  for (const name of names) {
    const target = TARGETS[name];
    if (!target) {
      console.log(warn(`unknown target: ${name}`));
      continue;
    }
    const resolver = flags.project ? target.project : target.user;
    if (!resolver) continue;

    const dir = resolver();
    const dest = target.kind === 'skills' ? join(dir, SKILL_NAME) : join(dir, target.file);

    if (!(await pathExists(dest))) {
      console.log(info(`${name}: nothing at ${dest}`));
      continue;
    }
    await rm(dest, { recursive: true, force: true });
    console.log(ok(`${name}: removed ${dest}`));
  }
}

async function cmdList() {
  console.log(`${paint(C.bold, 'Targets')}\n`);
  for (const [name, target] of Object.entries(TARGETS)) {
    const scope = [target.user ? 'user' : null, target.project ? 'project' : null].filter(Boolean).join(' + ');
    console.log(`  ${name.padEnd(10)} ${info(target.kind === 'skills' ? 'folder' : 'rules ')}  ${target.label} ${info(`(${scope})`)}`);
  }
  console.log(`\n${info('Default: claude, qoder. Use --all for every target, --project for repo-local installs.')}`);
}

async function cmdDoctor() {
  console.log(`${paint(C.bold, 'ui-motion doctor')}\n`);

  const checks = [
    ['skills/ui-motion/SKILL.md', existsSync(join(SKILL_ROOT, SKILL_ENTRY))],
    [`references/ (${listDir(join(SKILL_ROOT, 'references'), '.md')} docs)`, listDir(join(SKILL_ROOT, 'references'), '.md') === 11],
    [`assets/css/ (${listDir(join(SKILL_ROOT, 'assets', 'css'), '.css')} sheets)`, listDir(join(SKILL_ROOT, 'assets', 'css'), '.css') === 3],
    [`assets/js/ (${listDir(join(SKILL_ROOT, 'assets', 'js'), '.js')} modules)`, listDir(join(SKILL_ROOT, 'assets', 'js'), '.js') >= 4],
    ['assets/js/gl/ShaderCanvas.js', existsSync(join(SKILL_ROOT, 'assets', 'js', 'gl', 'ShaderCanvas.js'))],
    ['scripts/audit.mjs', existsSync(join(SKILL_ROOT, 'scripts', 'audit.mjs'))],
    ['.claude-plugin/marketplace.json', existsSync(join(ROOT, '.claude-plugin', 'marketplace.json'))],
    ['.qoder-plugin/plugin.json', existsSync(join(ROOT, '.qoder-plugin', 'plugin.json'))],
    ['examples/index.html', existsSync(join(ROOT, 'examples', 'index.html'))],
  ];

  for (const [label, present] of checks) {
    console.log(present ? ok(label) : fail(label));
  }

  console.log(`\n${paint(C.bold, 'Payload')} ${info(SKILL_ROOT)}`);

  console.log(`\n${paint(C.bold, 'Installed')}\n`);
  let found = 0;

  for (const [name, target] of Object.entries(TARGETS)) {
    const resolvers = [
      ['user', target.user],
      ['project', target.project],
    ].filter(([, fn]) => typeof fn === 'function');

    for (const [scope, fn] of resolvers) {
      const dir = fn();
      const dest = target.kind === 'skills' ? join(dir, SKILL_NAME) : join(dir, target.file);
      if (!existsSync(dest)) continue;
      found += 1;
      const linked = target.kind === 'skills' ? await isLinked(dest) : false;
      console.log(`${ok(`${name} (${scope})`)} ${info(dest)}${linked ? info(' [link]') : ''}`);
    }
  }

  if (!found) console.log(info('  none — run: npx ui-skill install'));

  console.log(`\n${paint(C.bold, 'Node')} ${process.version}`);
}

async function version() {
  try {
    const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function cmdHelp() {
  console.log(`
${paint(C.bold, 'ui-skill')} — install the ui-motion agent skill

${paint(C.bold, 'Usage')}
  npx ui-skill <command> [options]

${paint(C.bold, 'Commands')}
  install       Copy the skill into your agent's skill directory
  uninstall     Remove an installed copy
  list          Show supported targets
  doctor        Check the payload and report installed copies
  version       Print the package version

${paint(C.bold, 'Options')}
  -t, --target <name>   Target agent (repeatable). Default: claude, qoder
      --all             Every known target
      --project         Install into the current repo instead of the user home
      --link            Symlink the source folder (Windows: junction)
  -f, --force           Replace an existing install
      --dest <path>     Custom directory (single target only)
      --json            Machine-readable result
  -h, --help            This message

${paint(C.bold, 'Examples')}
  npx ui-skill install
  npx ui-skill install --target cursor --project
  npx ui-skill install --all --link
  npx ui-skill install --target windsurf --project --force
  npx ui-skill doctor
`);
}

/* -------------------------------------------------------------------- main */

const { command, flags } = parseArgs(process.argv.slice(2));

if (flags.help && command === 'help') cmdHelp();
else {
  switch (command) {
    case 'install':
    case 'add':
      await cmdInstall(flags);
      break;
    case 'uninstall':
    case 'remove':
      await cmdUninstall(flags);
      break;
    case 'list':
    case 'targets':
      await cmdList();
      break;
    case 'doctor':
    case 'check':
      await cmdDoctor();
      break;
    case 'version':
    case '--version':
    case '-v':
      console.log(await version());
      break;
    default:
      cmdHelp();
  }
}
