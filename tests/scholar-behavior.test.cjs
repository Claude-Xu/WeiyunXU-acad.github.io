'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = process.argv[2] || path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(repo, '_includes/fetch_google_scholar_stats.html'), 'utf8');
const source = template
  .replace(/^\s*<script>\s*/, '')
  .replace(/\s*<\/script>\s*$/, '')
  .replace(/{{\s*site\.repository\s*}}/g, 'Claude-Xu/WeiyunXU-acad.github.io')
  .replace(/{%\s*if site\.google_scholar_stats_use_cdn\s*%}([\s\S]*?){%\s*else\s*%}[\s\S]*?{%\s*endif\s*%}/, '$1');
assert.ok(!source.includes('{%') && !source.includes('{{'), 'All Liquid placeholders should be resolved');

const now = Date.UTC(2026, 9, 2, 0, 0, 0);
const freshDate = '2026-10-01T12:00:00.000Z';
const oldDate = '2026-02-19 08:29:11.700637';
const ids = ['author:first', 'author:zero', 'author:last'];

class StrictFixedDate extends Date {
  constructor(...args) {
    // Model a standards-only parser: the ISO date format uses three millisecond digits.
    if (typeof args[0] === 'string' && /\.\d{4,}/.test(args[0])) super(NaN);
    else if (args.length === 0) super(now);
    else super(...args);
  }
  static now() { return now; }
  toLocaleDateString(locale, options) {
    return super.toLocaleDateString(locale, {...options, timeZone: 'UTC'});
  }
}

function element(data) {
  const attributes = new Map(data ? [['data', data]] : []);
  return {
    textContent: '',
    title: '',
    className: '',
    adjacent: [],
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    insertAdjacentElement(position, child) { this.adjacent.push({position, child}); },
  };
}

function dataset(updated = freshDate, citedby = 80, publications) {
  return {
    updated,
    citedby,
    publications: publications ?? {
      [ids[0]]: {author_pub_id: ids[0], num_citations: 11},
      [ids[1]]: {author_pub_id: ids[1], num_citations: 0},
      [ids[2]]: {author_pub_id: ids[2], num_citations: 7},
    },
  };
}

async function run(responses, options = {}) {
  const summary = options.noSummary ? null : element();
  if (summary) summary.textContent = 'Citations on Google Scholar';
  const citations = options.noCitations ? [] : ids.map(element);
  const created = [];
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  const context = {
    Date: StrictFixedDate,
    AbortController,
    document: {
      getElementById(id) { assert.equal(id, 'scholar-citation-summary'); return summary; },
      querySelectorAll(selector) { assert.equal(selector, '.show_paper_citations'); return citations; },
      createElement(tag) { assert.equal(tag, 'span'); const value = element(); created.push(value); return value; },
    },
    setTimeout(callback, delay) { assert.equal(delay, 8000); const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    async fetch(url, options) {
      calls.push(url);
      assert.ok(options.signal instanceof AbortSignal, 'Fetch should be abortable');
      assert.ok(responses.length, 'Unexpected extra network request');
      const response = responses.shift();
      if (response instanceof Error) throw response;
      if (response.httpError) return {ok: false};
      return {ok: true, async json() { return response; }};
    },
  };
  vm.runInNewContext(source, context, {filename: '_includes/fetch_google_scholar_stats.html'});
  // Mock requests resolve immediately; allow the entire async chain to settle.
  await new Promise(setImmediate);
  assert.equal(timers.size, 0, 'Request timeout timers should always be cleared');
  const status = created[0];
  if (summary && status) assert.equal(summary.adjacent[0].child, status);
  if (status) assert.equal(status.getAttribute('role'), 'status');
  return {summary, citations, status, calls};
}

const cases = [];
function test(name, fn) { cases.push({name, fn}); }
function checkTotal(result, value) { assert.equal(result.summary.textContent, `Total citations: ${value}`); }
function checkFresh(result) {
  assert.match(result.status.textContent, /Oct 1, 2026/);
  assert.doesNotMatch(result.status.textContent, /pending|unavailable/);
}

test('dictionary, zero count, fresh source avoids extra request', async () => {
  const result = await run([dataset()]);
  checkTotal(result, 80);
  assert.deepEqual(result.citations.map(e => e.textContent), ['Citations: 11', 'Citations: 0', 'Citations: 7']);
  checkFresh(result);
  assert.equal(result.calls.length, 1);
  assert.match(result.calls[0], /cdn\.jsdelivr\.net/);
});

test('array publications and citedby compatibility', async () => {
  const result = await run([dataset(freshDate, 40, [
    {author_pub_id: ids[0], num_citations: 5},
    null,
    {ignored: true},
    {author_pub_id: ids[1], citedby: 0},
    {author_pub_id: ids[2], citedby: 12},
  ])]);
  checkTotal(result, 40);
  assert.deepEqual(result.citations.map(e => e.textContent), ['Citations: 5', 'Citations: 0', 'Citations: 12']);
});

test('missing paper does not interrupt later papers', async () => {
  const data = dataset();
  delete data.publications[ids[1]];
  const result = await run([data]);
  assert.deepEqual(result.citations.map(e => e.textContent), ['Citations: 11', 'Citations unavailable', 'Citations: 7']);
});

test('network failure falls back to raw data', async () => {
  const result = await run([new Error('Network unavailable'), dataset(freshDate, 101)]);
  checkTotal(result, 101);
  checkFresh(result);
  assert.equal(result.calls.length, 2);
  assert.match(result.calls[1], /raw\.githubusercontent\.com/);
});

test('HTTP failure falls back to raw data', async () => {
  const result = await run([{httpError: true}, dataset(freshDate, 102)]);
  checkTotal(result, 102);
  assert.equal(result.calls.length, 2);
});

test('invalid data schema falls back', async () => {
  const result = await run([{updated: freshDate, citedby: 1, publications: null}, dataset(freshDate, 103)]);
  checkTotal(result, 103);
  assert.equal(result.calls.length, 2);
});

test('both sources fail visibly without invented zero counts', async () => {
  const result = await run([new Error('CDN down'), new Error('Raw down')]);
  assert.match(result.status.textContent, /data unavailable/);
  assert.ok(result.citations.every(e => e.textContent === 'Citations unavailable'));
  assert.equal(result.summary.textContent, 'Citations on Google Scholar');
  assert.equal(result.calls.length, 2);
});

test('old Python microseconds are normalized and stale data survive fallback failure', async () => {
  const result = await run([dataset(oldDate, 151), new Error('Raw down')]);
  checkTotal(result, 151);
  assert.match(result.status.textContent, /Feb 19, 2026.*update pending/);
  assert.ok(result.citations[0].title.includes('Feb 19, 2026'));
  assert.equal(result.calls.length, 2);
});

test('stale CDN followed by fresh raw selects matching total, date and paper counts', async () => {
  const fresh = dataset(freshDate, 230);
  fresh.publications[ids[0]].num_citations = 42;
  const result = await run([dataset(oldDate, 151), fresh]);
  checkTotal(result, 230);
  checkFresh(result);
  assert.equal(result.citations[0].textContent, 'Citations: 42');
  assert.equal(result.calls.length, 2);
});

test('newer stale raw replaces older stale CDN', async () => {
  const result = await run([dataset(oldDate, 151), dataset('2026-08-01T12:00:00Z', 190)]);
  checkTotal(result, 190);
  assert.match(result.status.textContent, /Aug 1, 2026.*update pending/);
});

test('older fallback cannot downgrade a valid newer result', async () => {
  const result = await run([dataset('2026-08-01T12:00:00Z', 190), dataset(oldDate, 151)]);
  checkTotal(result, 190);
  assert.match(result.status.textContent, /Aug 1, 2026.*update pending/);
});

test('invalid initial date yields to valid fallback date', async () => {
  const result = await run([dataset('not-a-date', 151), dataset(freshDate, 200)]);
  checkTotal(result, 200);
  checkFresh(result);
});

test('zero total remains a valid count', async () => {
  const result = await run([dataset(freshDate, 0)]);
  checkTotal(result, 0);
});

test('no citation widgets cause no requests', async () => {
  const result = await run([], {noSummary: true, noCitations: true});
  assert.equal(result.calls.length, 0);
  assert.equal(result.status, undefined);
});

(async () => {
  for (const {name, fn} of cases) {
    await fn();
    console.log(`PASS ${name}`);
  }
  console.log(`All ${cases.length} scholar behavior cases passed.`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
