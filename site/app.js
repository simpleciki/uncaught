// Every number on the page is computed here from the repo's own result files.
const RUNS = {
  before: '/results/before.json',
  after: '/results/after.json',
  heldout: '/results/heldout.json',
  bobOnlyRun: '/results/heldout-bob-only.json',
  heldoutR3: '/results/heldout-r3.json',
  round3: '/results/round3.json',
  dp1: '/results/dot-prop-before.json',
  dp2: '/results/dot-prop-r2.json',
  dp2after: '/results/dot-prop-r2-after.json',
};

// Which mutant folder each run's ids live in.
const MUTANT_DIR = {
  before: 'mutants', after: 'mutants', heldout: 'mutants-heldout', bobOnlyRun: 'mutants-heldout',
  heldoutR3: 'mutants-heldout', round3: 'mutants-round3', dp1: 'mutants-dot-prop', dp2: 'mutants-dot-prop/r2', dp2after: 'mutants-dot-prop/r2',
};

const getJSON = async path => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
};

const summarize = run => {
  const ran = run.mutants.filter(m => m.status !== 'skipped');
  return {
    ...run,
    total: ran.length,
    caught: ran.filter(m => m.status === 'caught').length,
    survivedIds: ran.filter(m => m.status === 'survived').map(m => m.id),
  };
};

const lookup = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);

// Line diff via longest common subsequence; only changed lines are returned.
function diffLines(find, replace) {
  const a = find.split('\n');
  const b = replace.split('\n');
  const lcs = Array.from({length: a.length + 1}, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < a.length && (j === b.length || lcs[i + 1][j] >= lcs[i][j + 1])) {
      out.push(['del', a[i++].trim()]);
    } else {
      out.push(['add', b[j++].trim()]);
    }
  }
  return out;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCard(mutant, status) {
  const card = el('article', `card ${status === 'caught' ? 'is-caught' : 'is-survived'}`);
  const head = el('div', 'card-head');
  head.append(el('span', 'card-id', mutant.id));
  head.append(el('span', `tag ${mutant.kind === 'semantic' ? 'tag-semantic' : 'tag-classic'}`, mutant.kind));
  if (status) head.append(el('span', `tag ${status === 'caught' ? 'tag-caught' : 'tag-survived'}`, status));
  card.append(head);
  card.append(el('p', 'card-pattern', `${mutant.pattern} · ${mutant.targetFunction ?? ''}`));
  const pre = el('pre', 'diff');
  for (const [type, line] of diffLines(mutant.find, mutant.replace)) {
    pre.append(el('span', type, `${type === 'del' ? '-' : '+'} ${line}`));
  }
  card.append(pre);
  card.append(el('p', 'card-impact', mutant.productionImpact));
  return card;
}

const mutantCache = new Map();
async function loadMutant(dir, id) {
  const key = `${dir}/${id}`;
  if (!mutantCache.has(key)) mutantCache.set(key, getJSON(`/${key}.json`));
  return mutantCache.get(key);
}

function animateCount(node, target, format) {
  const show = value => {
    node.textContent = format === 'millions' ? `${Math.round(value / 1e6)}M` : String(Math.round(value));
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || target === 0) return show(target);
  const start = performance.now();
  const duration = 900;
  const step = now => {
    const t = Math.min(1, (now - start) / duration);
    show(target * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  // Browsers pause animation frames in background tabs; always land on the real number.
  setTimeout(() => show(target), duration + 100);
}

async function main() {
  const entries = await Promise.all(Object.entries(RUNS).map(async ([name, path]) => [name, summarize(await getJSON(path))]));
  const data = Object.fromEntries(entries);
  const meta = await getJSON('/site/subjects.json');
  const scout = await getJSON('/results/dot-prop-scout.json');
  const log = await (await fetch('/docs/VERIFICATION-LOG.md')).text();

  data.bobOnly = Object.fromEntries(data.bobOnlyRun.mutants.map(m => [m.id, m.status]));
  data.log = {rows: log.split('\n').filter(line => /^\| \d+ \|/.test(line)).length};

  // A bug "got past" if it survived the full suite of its round; it is "closed" if the final suite catches it.
  const roundRuns = ['before', 'heldout', 'round3', 'dp1', 'dp2'];
  const finalRuns = ['after', 'heldoutR3', 'round3', 'dp1', 'dp2after'];
  const escaped = new Set(roundRuns.flatMap(name => data[name].survivedIds));
  const finalCaught = new Set(finalRuns.flatMap(name => data[name].mutants.filter(m => m.status === 'caught').map(m => m.id)));
  const planted = new Set(roundRuns.flatMap(name => data[name].mutants.filter(m => m.status !== 'skipped').map(m => `${MUTANT_DIR[name]}/${m.id}`)));
  data.stats = {
    planted: planted.size,
    escapedFirst: escaped.size,
    closed: [...escaped].filter(id => finalCaught.has(id)).length,
    weekly: meta.subjects.reduce((sum, subject) => sum + subject.weeklyDownloads, 0),
  };

  for (const node of document.querySelectorAll('[data-bind]')) {
    const value = lookup(data, node.dataset.bind);
    node.textContent = value ?? '?';
  }

  for (const node of document.querySelectorAll('[data-cards]')) {
    const [run] = node.dataset.cards.split('.');
    const cards = await Promise.all(data[run].survivedIds.map(async id => renderCard(await loadMutant(MUTANT_DIR[run], id), 'survived')));
    node.replaceChildren(...cards);
  }

  for (const node of document.querySelectorAll('[data-card-id]')) {
    const [dir, id] = [node.dataset.cardId.split('/').slice(0, -1).join('/'), node.dataset.cardId.split('/').pop()];
    const status = dir === 'mutants' ? data.after.mutants.find(m => m.id === id)?.status : data.bobOnly[id];
    node.replaceChildren(renderCard(await loadMutant(dir, id), status));
  }

  const maxMentions = Math.max(...scout.ranked.map(fn => fn.mentions));
  document.querySelector('#scout').replaceChildren(...scout.ranked.map((fn, index) => {
    const row = el('div', `scout-row${index < 3 ? ' is-target' : ''}`);
    row.append(el('code', 'scout-name', fn.name));
    const bar = el('div', 'scout-bar');
    bar.style.setProperty('--w', `${(fn.mentions / maxMentions) * 100}%`);
    row.append(bar, el('span', 'scout-num', String(fn.mentions)));
    return row;
  }));

  document.querySelector('#subjects').textContent = meta.subjects
    .map(s => `${s.name} ${s.commit} (${s.tests} tests, ${Math.round(s.weeklyDownloads / 1e6)}M weekly downloads, npm ${s.downloadsWindow})`)
    .join(' · ');
  const flaky = [...new Set(Object.values(data).flatMap(run => run?.flakyTests ?? []).map(name => name.replace(/^test › /, '')))];
  document.querySelector('#flaky').textContent = flaky.length ? flaky.join(', ') : 'none';
  document.querySelector('#generated').textContent = data.dp2after.date.slice(0, 10);

  data.bobcoins = meta.bobcoins;
  for (const node of document.querySelectorAll('[data-bind^="bobcoins."]')) {
    node.textContent = lookup(data, node.dataset.bind) ?? '?';
  }

  // Run strips: one square per planted bug, filled in order as if the suite were running.
  for (const strip of document.querySelectorAll('[data-run]')) {
    const run = data[strip.dataset.run];
    const ran = run.mutants.filter(m => m.status !== 'skipped');
    const label = el('span', 'runstrip-label', `${run.testCount} tests × ${ran.length} bugs`);
    const cells = ran.map(m => {
      const cell = el('span', `cell is-${m.status}`, m.id);
      cell.title = `${m.id}: ${m.status}`;
      return cell;
    });
    strip.replaceChildren(label, ...cells);
  }

  // Write the real numbers first, so a reader who never triggers the animation still sees them.
  for (const node of document.querySelectorAll('[data-count]')) {
    const target = Number(lookup(data, node.dataset.count)) || 0;
    node.textContent = node.dataset.format === 'millions' ? `${Math.round(target / 1e6)}M` : String(target);
  }

  const observer = new IntersectionObserver(items => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      const node = item.target;
      animateCount(node, Number(lookup(data, node.dataset.count)) || 0, node.dataset.format);
      observer.unobserve(node);
    }
  }, {threshold: 0.6});
  for (const node of document.querySelectorAll('[data-count]')) observer.observe(node);

  setupMotion();
}

// Reveal-on-scroll and the run-strip sequence. Content is visible by default; motion is layered on top.
function setupMotion() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('motion');

  for (const section of document.querySelectorAll('main section')) {
    for (const child of section.children) child.classList.add('reveal');
  }

  const play = node => {
    node.classList.add('in');
    if (node.matches('.runstrip')) {
      node.querySelectorAll('.cell').forEach((cell, index) => {
        cell.style.setProperty('--delay', `${index * 140}ms`);
      });
    }
  };

  const observer = new IntersectionObserver(items => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      play(item.target);
      observer.unobserve(item.target);
    }
  }, {threshold: 0.25, rootMargin: '0px 0px -8% 0px'});
  for (const node of document.querySelectorAll('.reveal, .runstrip, .scout')) observer.observe(node);

  // Safety net: never leave content hidden, whatever the observer does.
  setTimeout(() => document.querySelectorAll('.reveal:not(.in), .runstrip:not(.in), .scout:not(.in)').forEach(play), 6000);
}

main().catch(error => {
  document.body.prepend(el('p', 'load-error', `Could not load results: ${error.message}`));
});
