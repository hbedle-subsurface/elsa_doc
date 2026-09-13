/* ------------------------------------------------------------------
   app.js — loading, filtering, reading, coding, exporting.
------------------------------------------------------------------ */

if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const SAVE_KEY = 'elsa_doc_marks_v2';

let ALL = [];                 // every parsed record
let PRINTS = loadPrints();    // fingerprint -> { tags:[], star:bool, note:'' }
let MARKS = {};               // record id -> the same objects, for this file
let SELECTED = null;
let SOURCE = [];              // file names loaded
let STATE_TOTALS = {};        // fixed denominators for the state strip
let CONCERN_TOTALS = {};      // fixed denominators for the concern tally

const F = {
  q: '',
  states: new Set(),
  tech: new Set(),
  flags: new Set(),
  kinds: new Set(),
  statuses: new Set(),
  marks: new Set()
};

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ========================== persistence ========================== */

/* Coding is stored against a fingerprint of the entry rather than its
   position in a file. Loading a newer edition of the report, or the
   other half of the data, reattaches earlier work to the right entries
   and leaves everything else untouched. */
function fingerprint(r) {
  return (r.state + '|' + r.kind + '|' + r.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
         .slice(0, 120);
}
function loadPrints() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveMarks() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(PRINTS)); }
  catch (e) { /* private browsing blocks this; the export button is the fallback */ }
}
/* Point the id-keyed view at the stored objects for the loaded file. */
function bindMarks() {
  MARKS = {};
  for (const r of ALL) {
    const p = PRINTS[fingerprint(r)];
    if (p) MARKS[r.id] = p;
  }
}
function markOf(r) {
  const p = fingerprint(r);
  if (!PRINTS[p]) PRINTS[p] = { tags: [], star: false, note: '' };
  MARKS[r.id] = PRINTS[p];
  return PRINTS[p];
}

/* ============================ loading ============================ */

$('#pick').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', e => loadFiles(Array.from(e.target.files)));

const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
['dragleave', 'drop'].forEach(ev =>
  drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
drop.addEventListener('drop', e => loadFiles(Array.from(e.dataTransfer.files)));

$('#reload').addEventListener('click', () => {
  $('#open').hidden = false; $('#top').hidden = true; $('#wrap').hidden = true;
  $('#progwrap').hidden = true; $('#progtxt').hidden = true;
});

async function loadFiles(files) {
  if (!files.length) return;
  const bar = $('#prog'), wrap = $('#progwrap'), txt = $('#progtxt');
  wrap.hidden = false; txt.hidden = false;
  let records = [];
  SOURCE = [];

  for (const f of files) {
    SOURCE.push(f.name);
    txt.textContent = 'Reading ' + f.name;
    bar.style.width = '4%';
    await new Promise(r => setTimeout(r, 30));
    try {
      if (f.name.toLowerCase().endsWith('.pdf')) {
        const raw = await extractPdfText(f, (p, n) => {
          bar.style.width = Math.round(88 * p / n) + '%';
          txt.textContent = 'Reading ' + f.name + ' — page ' + p + ' of ' + n;
        });
        txt.textContent = 'Cutting ' + f.name + ' into entries';
        await new Promise(r => setTimeout(r, 30));
        records = records.concat(parsePdfDocument(raw));
      } else {
        records = records.concat(await parseTabularFile(f));
      }
    } catch (err) {
      txt.textContent = 'Could not read ' + f.name + ': ' + err.message;
      console.error(err);
      return;
    }
    bar.style.width = '96%';
  }

  if (!records.length) {
    txt.textContent = 'No entries found in that file. The tabular downloads from '
                    + 'oppositionreport.org are the most reliable input.';
    return;
  }

  ALL = dedupe(records);
  bindMarks();
  computeFixedTotals();
  $('#open').hidden = true; $('#top').hidden = false; $('#wrap').hidden = false;
  $('#srcname').textContent = SOURCE.join(', ');
  buildControls();
  render();
}

function dedupe(recs) {
  const seen = new Map();
  for (const r of recs) {
    const key = fingerprint(r);
    const prev = seen.get(key);
    if (!prev || r.text.length > prev.text.length) seen.set(key, r);
  }
  return Array.from(seen.values());
}

/* Denominators are taken once, from the whole file. Bars then shrink
   as filters are applied instead of quietly rescaling. */
function computeFixedTotals() {
  STATE_TOTALS = {}; CONCERN_TOTALS = {};
  for (const r of ALL) {
    STATE_TOTALS[r.state] = (STATE_TOTALS[r.state] || 0) + 1;
    for (const c of r.suggested) CONCERN_TOTALS[c] = (CONCERN_TOTALS[c] || 0) + 1;
  }
}

/* =========================== filtering =========================== */

function passes(r) {
  if (F.states.size && !F.states.has(r.state)) return false;
  if (F.kinds.size && !F.kinds.has(r.kind)) return false;
  if (F.statuses.size && !F.statuses.has(r.status)) return false;
  if (F.tech.size && !r.technologies.some(t => F.tech.has(t))) return false;
  if (F.flags.size && !r.flags.some(t => F.flags.has(t))) return false;

  if (F.marks.size) {
    const m = MARKS[r.id];
    const starred = !!(m && m.star);
    const coded = !!(m && m.tags && m.tags.length);
    const noted = !!(m && m.note);
    let ok = false;
    if (F.marks.has('star') && starred) ok = true;
    if (F.marks.has('coded') && coded) ok = true;
    if (F.marks.has('noted') && noted) ok = true;
    if (F.marks.has('untouched') && !starred && !coded && !noted) ok = true;
    if (!ok) return false;
  }

  if (F.q) {
    const needle = F.q.toLowerCase();
    const hay = (r.name + ' ' + r.where + ' ' + r.state + ' ' + r.text).toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function current() { return ALL.filter(passes); }

/* ============================ controls =========================== */

function chip(label, count, on, onClick, cls) {
  const b = document.createElement('button');
  b.className = 'chip' + (cls ? ' ' + cls : '');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = esc4(label) + (count != null ? ' <span class="n">' + count + '</span>' : '');
  b.addEventListener('click', onClick);
  return b;
}
function esc4(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toggle(set, val) { set.has(val) ? set.delete(val) : set.add(val); }

function buildControls() {
  $('#q').addEventListener('input', e => { F.q = e.target.value.trim(); render(); });

  $('#preset').addEventListener('click', () => {
    F.states = new Set(SOUTH_CENTRAL.filter(s => STATE_TOTALS[s]));
    render();
  });
  $('#clearstates').addEventListener('click', () => { F.states = new Set(); render(); });

  $('#exSeeds').addEventListener('click', exportSeeds);
  $('#exCoded').addEventListener('click', exportCoded);
  $('#exRefs').addEventListener('click', exportRefs);
  $('#exSess').addEventListener('click', exportSession);
  $('#imSess').addEventListener('click', () => $('#sessfile').click());
  $('#sessfile').addEventListener('change', importSession);
}

function renderControls(hits) {
  /* state strip — outline is the state's full total, fill is the
     count surviving the current filter */
  const strip = $('#strip'); strip.innerHTML = '';
  const maxState = Math.max(1, ...Object.values(STATE_TOTALS));
  const liveByState = {};
  for (const r of hits) liveByState[r.state] = (liveByState[r.state] || 0) + 1;

  for (const s of STATES) {
    const total = STATE_TOTALS[s] || 0;
    if (!total) continue;
    const live = liveByState[s] || 0;
    const b = document.createElement('button');
    b.className = 'stbar';
    b.setAttribute('aria-pressed', F.states.has(s) ? 'true' : 'false');
    b.title = s + ' — ' + live + ' shown of ' + total;
    const outline = Math.max(2, Math.round(34 * total / maxState));
    const fill = total ? Math.round(outline * live / total) : 0;
    b.innerHTML =
      '<span class="bar"><span class="fill" style="height:' + outline + 'px">' +
      '<span class="fill live" style="display:block;height:' + fill + 'px;' +
      'margin-top:' + (outline - fill) + 'px"></span></span></span>' +
      '<span class="lbl">' + (STATE_ABBR[s] || s.slice(0, 2)) + '</span>';
    b.addEventListener('click', () => { toggle(F.states, s); render(); });
    strip.appendChild(b);
  }

  const count = (fn) => ALL.filter(fn).length;

  const tp = $('#techpick'); tp.innerHTML = '';
  for (const t of TECH_RULES) {
    const n = count(r => r.technologies.includes(t.id));
    if (!n) continue;
    tp.appendChild(chip(t.label, n, F.tech.has(t.id),
      () => { toggle(F.tech, t.id); render(); }));
  }

  const fp = $('#flagpick'); fp.innerHTML = '';
  for (const f of FLAG_RULES) {
    const n = count(r => r.flags.includes(f.id));
    if (!n) continue;
    fp.appendChild(chip(f.label, n, F.flags.has(f.id),
      () => { toggle(F.flags, f.id); render(); }, 'g'));
  }

  const kp = $('#kindpick'); kp.innerHTML = '';
  for (const [id, label] of [['project', 'Contested projects'], ['restriction', 'Restrictions']]) {
    const n = count(r => r.kind === id);
    if (!n) continue;
    kp.appendChild(chip(label, n, F.kinds.has(id),
      () => { toggle(F.kinds, id); render(); }));
  }

  const sp = $('#statuspick'); sp.innerHTML = '';
  const statuses = Array.from(new Set(ALL.map(r => r.status))).sort();
  for (const s of statuses) {
    const n = count(r => r.status === s);
    sp.appendChild(chip(s, n, F.statuses.has(s),
      () => { toggle(F.statuses, s); render(); }));
  }

  const mp = $('#markpick'); mp.innerHTML = '';
  const touched = m => m && (m.star || (m.tags && m.tags.length) || m.note);
  const marked = {
    star:  ALL.filter(r => MARKS[r.id] && MARKS[r.id].star).length,
    coded: ALL.filter(r => MARKS[r.id] && MARKS[r.id].tags.length).length,
    noted: ALL.filter(r => MARKS[r.id] && MARKS[r.id].note).length,
    none:  ALL.filter(r => !touched(MARKS[r.id])).length
  };
  mp.appendChild(chip('To chase', marked.star, F.marks.has('star'),
    () => { toggle(F.marks, 'star'); render(); }, 'g'));
  mp.appendChild(chip('Coded', marked.coded, F.marks.has('coded'),
    () => { toggle(F.marks, 'coded'); render(); }, 'g'));
  mp.appendChild(chip('With a note', marked.noted, F.marks.has('noted'),
    () => { toggle(F.marks, 'noted'); render(); }, 'g'));
  mp.appendChild(chip('Not looked at', marked.none,
    F.marks.has('untouched'), () => { toggle(F.marks, 'untouched'); render(); }, 'g'));
}

/* ============================ rendering ========================== */

function render() {
  const hits = current();
  renderControls(hits);

  const proj = ALL.filter(r => r.kind === 'project').length;
  const restr = ALL.length - proj;
  $('#counts').innerHTML =
    '<b>' + ALL.length + '</b> entries · ' + proj + ' projects · ' + restr + ' restrictions';

  $('#hits').textContent = hits.length + ' of ' + ALL.length + ' entries'
    + (describeFilter() ? ' — ' + describeFilter() : '');

  if (SELECTED && hits.some(r => r.id === SELECTED)) renderDetail(hits);
  else { SELECTED = null; renderList(hits); }

  renderWork();
  renderTally(hits);
  parseNotice();
}

function describeFilter() {
  const bits = [];
  if (F.states.size) bits.push(Array.from(F.states).map(s => STATE_ABBR[s] || s).join(', '));
  if (F.tech.size) bits.push(Array.from(F.tech).map(labelTech).join(', '));
  if (F.flags.size) bits.push(Array.from(F.flags).map(labelFlag).join(', '));
  if (F.q) bits.push('"' + F.q + '"');
  return bits.join(' · ');
}

function statusClass(r) {
  if (['Canceled', 'Expired', 'Repealed'].includes(r.status)) return 'blocked';
  if (['Operational', 'Under construction', 'In effect'].includes(r.status)) return 'live';
  return '';
}

function renderList(hits) {
  const list = $('#list'); list.innerHTML = '';
  if (!hits.length) {
    list.innerHTML = '<p class="empty">Nothing matches that combination. '
                   + 'Widen the states or clear the search box.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of hits.slice(0, 400)) {
    const m = MARKS[r.id];
    const d = document.createElement('div');
    d.className = 'rec ' + statusClass(r);
    d.tabIndex = 0;
    const tags = []
      .concat(r.technologies.map(t => '<span class="tag tech">' + labelTech(t) + '</span>'))
      .concat(r.flags.map(f => '<span class="tag flag">' + labelFlag(f) + '</span>'))
      .concat(m && m.star ? ['<span class="tag star">to chase</span>'] : [])
      .concat(m && m.tags && m.tags.length
        ? ['<span class="tag">' + m.tags.length + ' coded</span>'] : []);
    d.innerHTML =
      '<div class="nm">' + esc4(r.name) + '</div>' +
      '<div class="meta">' + esc4(r.state) +
        (r.where ? ' · ' + esc4(r.where) : '') +
        ' · ' + esc4(r.status) +
        (r.refs.length ? ' · ' + r.refs.length + ' reference'
            + (r.refs.length > 1 ? 's' : '') : '') + '</div>' +
      (r.text ? '<div class="snip">' + esc4(r.text.slice(0, 260)) + '</div>' : '') +
      (tags.length ? '<div>' + tags.join('') + '</div>' : '');
    const open = () => { SELECTED = r.id; render(); window.scrollTo(0, 0); };
    d.addEventListener('click', open);
    d.addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
    frag.appendChild(d);
  }
  list.appendChild(frag);
  if (hits.length > 400) {
    const p = document.createElement('p');
    p.className = 'quiet';
    p.textContent = 'Showing the first 400. Narrow the filter to see the rest.';
    list.appendChild(p);
  }
}

function labelTech(id) { const t = TECH_RULES.find(x => x.id === id); return t ? t.label : id; }
function labelFlag(id) { const f = FLAG_RULES.find(x => x.id === id); return f ? f.label : id; }

function renderDetail(hits) {
  const r = ALL.find(x => x.id === SELECTED);
  const m = markOf(r);
  const list = $('#list');
  const idx = hits.findIndex(x => x.id === r.id);

  const byType = { news: [], government: [], legal: [], opposition: [] };
  for (const ref of r.refs) (byType[ref.type] || byType.news).push(ref);

  const codeHtml = CONCERN_GROUPS.map(g => {
    const cats = CODEBOOK.filter(c => c.group === g.id);
    if (!cats.length) return '';
    return '<div><div class="codegroup">' + esc4(g.label) + '</div>' +
      cats.map(c => {
        const on = m.tags.includes(c.id);
        const sugg = r.suggested.includes(c.id);
        return '<label class="code' + (sugg ? ' sugg' : '') + '" title="' + esc4(c.hint) + '">' +
          '<input type="checkbox" data-code="' + c.id + '"' + (on ? ' checked' : '') + '>' +
          '<span>' + esc4(c.label) + (sugg ? ' <span class="dot">·</span>' : '') + '</span></label>';
      }).join('') + '</div>';
  }).join('');

  const refSection = (label, items) => items.length
    ? '<h4>' + label + '</h4><ul class="reflist">' + items.map(x =>
        '<li><span class="reftype ' + x.type + '">' + x.type + '</span>' +
        '<a href="' + esc4(x.url) + '" target="_blank" rel="noopener">' +
        esc4(x.url.length > 92 ? x.url.slice(0, 92) + '…' : x.url) + '</a>' +
        (x.cite ? '<span class="cite">' + esc4(x.cite.slice(0, 240)) + '</span>' : '') +
        '</li>').join('') + '</ul>'
    : '';

  list.innerHTML =
    '<p style="margin:0 0 10px"><button class="linkish" id="back">Back to results</button>' +
    (idx > 0 ? ' · <button class="linkish" id="prev">Previous</button>' : '') +
    (idx < hits.length - 1 ? ' · <button class="linkish" id="next">Next</button>' : '') +
    '</p>' +
    '<div class="detail">' +
      '<h3>' + esc4(r.name) + '</h3>' +
      '<div class="where">' + esc4(r.state) + (r.where ? ' · ' + esc4(r.where) : '') +
        ' · ' + esc4(r.status) +
        (r.kind === 'restriction' ? ' · restriction' : ' · contested project') +
        (r.date ? ' · ' + esc4(r.date) : '') + '</div>' +
      '<div>' +
        '<button class="btn' + (m.star ? '' : ' ghost') + '" id="star">' +
        (m.star ? 'On your chase list' : 'Add to chase list') + '</button></div>' +
      (r.rules.length
        ? '<h4>Rules cited</h4><div>' + r.rules.map(x =>
            '<span class="tag">' + esc4(x.number + ': ' + x.label + ' (' + x.tech + ')') +
            '</span>').join('') + '</div>'
        : '') +
      '<h4>What the report says</h4>' +
      '<div class="body">' + esc4(r.text) + '</div>' +
      refSection('News coverage', byType.news) +
      refSection('Opposition groups and petitions', byType.opposition) +
      refSection('Government records', byType.government) +
      refSection('Legal filings', byType.legal) +
      '<h4>What was raised — mark what the text actually says</h4>' +
      '<p class="quiet" style="margin:-2px 0 10px">A dot means a word in the entry matched '
        + 'that category. Read the entry and decide; a word match is not a code.</p>' +
      '<div class="codegrid">' + codeHtml + '</div>' +
      '<h4>Your note</h4>' +
      '<textarea class="note" id="note" placeholder="What to look for next, who to search '
        + 'for, anything the entry leaves open">' + esc4(m.note) + '</textarea>' +
    '</div>';

  $('#back').addEventListener('click', () => { SELECTED = null; render(); });
  const prev = $('#prev'), next = $('#next');
  if (prev) prev.addEventListener('click', () => { SELECTED = hits[idx - 1].id; render(); });
  if (next) next.addEventListener('click', () => { SELECTED = hits[idx + 1].id; render(); });

  $('#star').addEventListener('click', () => {
    m.star = !m.star; saveMarks(); render();
  });
  $$('#list input[data-code]').forEach(box => {
    box.addEventListener('change', () => {
      const id = box.dataset.code;
      if (box.checked) { if (!m.tags.includes(id)) m.tags.push(id); }
      else m.tags = m.tags.filter(t => t !== id);
      saveMarks(); renderTally(current()); renderWork();
    });
  });
  $('#note').addEventListener('input', e => {
    m.note = e.target.value; saveMarks();
  });
}

function renderWork() {
  const ul = $('#work'); ul.innerHTML = '';
  const starred = ALL.filter(r => MARKS[r.id] && MARKS[r.id].star);
  if (!starred.length) {
    $('#worknote').textContent = 'Open an entry and add it here when it is worth '
      + 'following up. The chase list becomes the seed file for collecting coverage.';
    return;
  }
  $('#worknote').textContent = starred.length + ' entr'
    + (starred.length === 1 ? 'y' : 'ies') + ' · '
    + starred.reduce((n, r) => n + r.refs.length, 0) + ' references between them';
  for (const r of starred) {
    const li = document.createElement('li');
    const m = MARKS[r.id];
    li.innerHTML = '<div class="wnm">' + esc4(r.name) + '</div>' +
      '<div class="wmeta">' + esc4(r.abbr || r.state) +
      (r.where ? ' · ' + esc4(r.where) : '') +
      (m.tags.length ? ' · ' + m.tags.length + ' coded' : ' · not yet coded') + '</div>';
    li.addEventListener('click', () => { SELECTED = r.id; render(); window.scrollTo(0, 0); });
    ul.appendChild(li);
  }
}

function renderTally(hits) {
  const ul = $('#tally'); ul.innerHTML = '';
  const confirmed = {}, suggested = {};
  for (const r of hits) {
    const m = MARKS[r.id];
    if (m) for (const t of m.tags) confirmed[t] = (confirmed[t] || 0) + 1;
    for (const s of r.suggested) suggested[s] = (suggested[s] || 0) + 1;
  }
  const anyCoded = Object.keys(confirmed).length > 0;
  const source = anyCoded ? confirmed : suggested;
  /* width scaled to the whole file, so the bars shrink under a filter */
  const denom = Math.max(1, ...Object.values(CONCERN_TOTALS));

  const rows = CODEBOOK
    .map(c => ({ c, n: source[c.id] || 0 }))
    .filter(x => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 14);

  if (!rows.length) {
    $('#tallynote').textContent = 'Nothing to count yet.';
    return;
  }
  for (const { c, n } of rows) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="tn">' + n + '</span>' +
      '<span class="tbar" style="width:' + Math.max(2, Math.round(70 * n / denom)) + 'px"></span>' +
      '<span class="tl" title="' + esc4(c.hint) + '">' + esc4(c.label) + '</span>';
    ul.appendChild(li);
  }
  $('#tallynote').textContent = anyCoded
    ? 'Counting the categories you confirmed.'
    : 'Counting word matches only — these are a place to start, not results. '
    + 'They are replaced by your own codes as soon as you confirm any.';
}

function parseNotice() {
  const el = $('#parsewarn');
  const fromPdf = SOURCE.some(n => n.toLowerCase().endsWith('.pdf'));
  const ragged = ALL.filter(r => r.name.length < 4 || r.name.length > 95
                              || /^\(unnamed/.test(r.name)).length;
  if (fromPdf && ragged) {
    el.innerHTML = '<div class="warn">' + ragged + ' of ' + ALL.length +
      ' entries came out of the PDF with a ragged title. Every entry keeps its original ' +
      'text, so check those against the report. The CSV or XLSX downloads avoid this.</div>';
  } else el.innerHTML = '';
}

/* ============================ exporting ========================== */

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
let download = function (name, text, mime) {
  const blob = new Blob([text], { type: (mime || 'text/csv') + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function stamp() { return new Date().toISOString().slice(0, 10); }

/* A search string a person or a collector script can use directly. */
function searchQuery(r) {
  const place = r.where ? r.where.replace(/\bCount(y|ies)\b/i, 'County') : '';
  return ['"' + r.name.replace(/"/g, '') + '"', place, r.state].filter(Boolean).join(' ');
}

/* The handoff to the collection step: one row per entry worth
   chasing, carrying the references the report already found. */
function exportSeeds() {
  const rows = ALL.filter(r => MARKS[r.id] && MARKS[r.id].star);
  const use = rows.length ? rows : current();
  const head = ['seed_id', 'state', 'state_abbr', 'county', 'name', 'kind', 'status',
                'technologies', 'flags', 'search_query', 'coded_concerns', 'note',
                'n_refs', 'news_urls', 'opposition_urls', 'government_urls', 'legal_urls'];
  const pick = (r, t) => r.refs.filter(x => x.type === t).map(x => x.url).join(' | ');
  const body = use.map(r => {
    const m = MARKS[r.id] || { tags: [], note: '' };
    return [r.id, r.state, r.abbr, r.where, r.name, r.kind, r.status,
            r.technologies.join(';'), r.flags.join(';'), searchQuery(r),
            m.tags.join(';'), m.note, r.refs.length,
            pick(r, 'news'), pick(r, 'opposition'),
            pick(r, 'government'), pick(r, 'legal')];
  });
  download('seed_list_' + stamp() + '.csv',
    [head, ...body].map(r => r.map(csvCell).join(',')).join('\n'));
}

/* One row per entry, one column per category, ready to read into a
   statistics tool. */
function exportCoded() {
  const use = current();
  const head = ['record_id', 'state', 'state_abbr', 'county', 'name', 'kind', 'scope',
                'status', 'year', 'technologies', 'flags', 'n_refs', 'n_codes',
                'on_chase_list', 'note']
    .concat(CODEBOOK.map(c => 'code_' + c.id));
  const body = use.map(r => {
    const m = MARKS[r.id] || { tags: [], note: '', star: false };
    return [r.id, r.state, r.abbr, r.where, r.name, r.kind, r.scope, r.status, r.date,
            r.technologies.join(';'), r.flags.join(';'), r.refs.length, m.tags.length,
            m.star ? 1 : 0, m.note]
      .concat(CODEBOOK.map(c => m.tags.includes(c.id) ? 1 : 0));
  });
  download('coded_records_' + stamp() + '.csv',
    [head, ...body].map(r => r.map(csvCell).join(',')).join('\n'));
}

/* One row per citation — the reading list. */
function exportRefs() {
  const use = current();
  const head = ['record_id', 'state', 'county', 'name', 'kind', 'status',
                'ref_type', 'citation', 'url'];
  const body = [];
  for (const r of use) {
    for (const ref of r.refs) {
      body.push([r.id, r.state, r.where, r.name, r.kind, r.status,
                 ref.type, ref.cite, ref.url]);
    }
  }
  if (!body.length) { alert('No references in the current filter.'); return; }
  download('references_' + stamp() + '.csv',
    [head, ...body].map(r => r.map(csvCell).join(',')).join('\n'));
}

function exportSession() {
  const out = {};
  for (const r of ALL) {
    const m = MARKS[r.id];
    if (!m) continue;
    if (!m.star && !m.note && !(m.tags && m.tags.length)) continue;
    out[fingerprint(r)] = { tags: m.tags, star: m.star, note: m.note, name: r.name,
                            state: r.state };
  }
  download('coding_session_' + stamp() + '.json',
    JSON.stringify({ saved: new Date().toISOString(), source: SOURCE, marks: out }, null, 2),
    'application/json');
}

async function importSession(e) {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const incoming = data.marks || {};
    let matched = 0;
    for (const r of ALL) {
      const hit = incoming[fingerprint(r)];
      if (!hit) continue;
      const m = markOf(r);
      m.tags = Array.from(new Set((m.tags || []).concat(hit.tags || [])));
      m.star = m.star || !!hit.star;
      m.note = m.note ? (m.note + (hit.note ? '\n' + hit.note : '')) : (hit.note || '');
      matched++;
    }
    saveMarks(); render();
    alert('Restored marks for ' + matched + ' of ' + Object.keys(incoming).length + ' entries.');
  } catch (err) {
    alert('That file could not be read: ' + err.message);
  }
  e.target.value = '';
}
