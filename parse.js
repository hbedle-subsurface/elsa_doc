/* ------------------------------------------------------------------
   parse.js

   Turns the Sabin Center opposition report into records the rest of
   the tool can filter.

   Two input routes:

     1. The CSV or XLSX downloads from oppositionreport.org. Clean
        columns, reliable. Use this when you can.
     2. The PDF of the report. The report has a very regular shape,
        so it can be split up, but PDF text extraction is never
        perfect. Anything parsed this way carries its raw source text
        so it can be checked against the original.

   Nothing is uploaded. Files are read in the browser.
------------------------------------------------------------------ */

const STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
  'Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois',
  'Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts',
  'Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
  'New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota',
  'Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming'
];

const STATE_ABBR = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC',
  'Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL',
  'Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA',
  'Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN',
  'Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV',
  'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY',
  'North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR',
  'Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD',
  'Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA',
  'Washington':'WA','West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY'
};

/* States within reach of a first field season out of Norman. */
const SOUTH_CENTRAL = ['Oklahoma','Texas','Kansas','Arkansas','Louisiana','Missouri','New Mexico','Colorado'];

/* ============================== PDF ============================== */

async function extractPdfText(file, onProgress) {
  const buf = await file.arrayBuffer();
  const task = pdfjsLib.getDocument({ data: buf });
  const pdf = await task.promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
    if (onProgress && (p % 5 === 0 || p === pdf.numPages)) {
      onProgress(p, pdf.numPages);
      await new Promise(r => setTimeout(r, 0));   // let the page repaint
    }
  }
  return pages.join('\n');
}

/* Strip running heads, page numbers, and footnote-only lines, then
   normalize whitespace so the section regexes have something regular
   to work with. */
function cleanPdfText(raw) {
  const dropped = [
    /^\s*\d{1,4}\s*$/,                              // bare page number
    /^\s*Sabin Center for Climate Change Law\s*$/i,
    /^\s*Columbia Law School\s*$/i,
    /^\s*Opposition to Renewable Energy Facilities.*$/i
  ];
  const kept = raw.split('\n').filter(l => !dropped.some(re => re.test(l)));
  return kept.join('\n')
    .replace(/-\n(?=[a-z])/g, '')      // word broken across a line
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Split the whole document into per-state blocks. Each state section
   opens with the state name followed by its siting framework, which
   is the most dependable anchor in the document. */
function splitStates(text) {
  const anchor = new RegExp(
    '(?:^|\\n)\\s*(' + STATES.map(esc).join('|') + ')\\s*\\n?\\s*State Siting Framework',
    'g'
  );
  const hits = [];
  let m;
  while ((m = anchor.exec(text)) !== null) {
    hits.push({ state: m[1], start: m.index, bodyStart: m.index + m[0].length });
  }
  return hits.map((h, i) => ({
    state: h.state,
    text: text.slice(h.bodyStart, i + 1 < hits.length ? hits[i + 1].start : text.length)
  }));
}

function sectionSlice(block, startLabel, endLabels) {
  const s = block.search(new RegExp('\\b' + esc(startLabel) + '\\b'));
  if (s < 0) return '';
  const after = block.slice(s + startLabel.length);
  let end = after.length;
  for (const lbl of endLabels) {
    const e = after.search(new RegExp('\\b' + esc(lbl) + '\\b'));
    if (e >= 0 && e < end) end = e;
  }
  return after.slice(0, end);
}

const RESTRICTION_STATUS = /Restrictions with Status\s+(In effect|Expired|Pending|Repealed|Unknown)/gi;
const PROJECT_STATUS     = /Projects with Status\s+(Canceled|Cancelled|Pending|Operational|Completed|Under Construction|Unknown)/gi;

function splitByStatus(section, re) {
  const hits = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(section)) !== null) {
    hits.push({ status: m[1], head: m.index, body: m.index + m[0].length });
  }
  if (!hits.length) return [{ status: '', text: section }];
  return hits.map((h, i) => ({
    status: h.status,
    text: section.slice(h.body, i + 1 < hits.length ? hits[i + 1].head : section.length)
  }));
}

/* An entry in the restriction lists is a jurisdiction name followed
   immediately by one or more rule tags: "Carroll County Rule 1: Ban /
   Moratorium (wind) | Rule 1: Ban / Moratorium (solar)". Find the
   first rule tag of each entry, then walk backwards for the name. */
/* A jurisdiction name is a run of capitalized words, possibly with a
   parenthetical county and a few lowercase joining words, sitting
   immediately before the rule tag. Matching that shape survives a
   preceding citation that ends in a URL or an abbreviation, which
   sentence punctuation does not. */
const NAME_TAIL = new RegExp(
  '(' +
    '(?:[A-Z][A-Za-z.\u2019\'\\-]*|\\d{1,4})' +
    '(?:\\s+(?:of|the|and|for|de|at|on|in|A\\.?C\\.?A\\.?|' +
       '[A-Z][A-Za-z.\u2019\'\\-]*|\\d{1,4}|\\([^()]{2,50}\\)))*' +
  ')\\s*$'
);

function nameBefore(text, idx) {
  let prior = text.slice(Math.max(0, idx - 170), idx);
  prior = prior.replace(/https?:\/\/\S+\s*$/, ' ');       // drop a trailing URL
  prior = prior.replace(/[.,;:]\s*$/, ' ');
  const m = prior.match(NAME_TAIL);
  let name = m ? m[1].trim() : '';
  /* a run that swallowed a whole sentence is not a name */
  if (name.split(/\s+/).length > 9) name = name.split(/\s+/).slice(-6).join(' ');
  return { name, start: idx - (m ? (prior.length - m.index) : 0) };
}

function splitRestrictionEntries(text) {
  const ruleRe = /\bRule\s+\d+[a-z]?(?:\s+and\s+\d+[a-z]?)?\s*:/g;
  const marks = [];
  let m;
  while ((m = ruleRe.exec(text)) !== null) marks.push(m.index);
  if (!marks.length) return [];

  /* A rule tag after a pipe continues the entry already open. */
  const heads = marks.filter(idx => !/\|\s*$/.test(text.slice(Math.max(0, idx - 4), idx)));

  const found = heads.map(idx => {
    const n = nameBefore(text, idx);
    return { name: n.name, start: Math.max(0, n.start), ruleAt: idx };
  });

  return found.map((h, i) => ({
    name: h.name || '(unnamed jurisdiction)',
    text: text.slice(h.start, i + 1 < found.length ? found[i + 1].start : text.length).trim()
  }));
}

/* A contested project entry opens with the project name and the
   county in parentheses. */
function splitProjectEntries(text) {
  const headRe = /(?:^|[.;]\s|\n)\s*([A-Z][^\n.;]{2,110}?)\s*\(([^()]{2,70}?Count(?:y|ies)|[^()]{2,70}?Paris(?:h|hes)|[^()]{2,70}?Boroughs?)\)/g;
  const hits = [];
  let m;
  while ((m = headRe.exec(text)) !== null) {
    hits.push({ name: m[1].trim(), where: m[2].trim(), start: m.index, bodyStart: headRe.lastIndex });
  }
  if (!hits.length) return [];
  return hits.map((h, i) => ({
    name: h.name,
    where: h.where,
    text: text.slice(h.bodyStart, i + 1 < hits.length ? hits[i + 1].start : text.length).trim()
  }));
}

function parsePdfDocument(rawText) {
  const text = cleanPdfText(rawText);
  const out = [];
  const blocks = splitStates(text);

  for (const b of blocks) {
    const stateLevel = sectionSlice(b.text, 'State-Level Restrictions',
                                    ['Local Restrictions', 'Contested Projects']);
    const local      = sectionSlice(b.text, 'Local Restrictions', ['Contested Projects']);
    const projects   = sectionSlice(b.text, 'Contested Projects', []);

    for (const grp of splitByStatus(stateLevel, RESTRICTION_STATUS)) {
      for (const e of splitRestrictionEntries(grp.text)) {
        out.push(makeRecord('restriction', b.state, e.name, '', grp.status, e.text, 'state'));
      }
    }
    for (const grp of splitByStatus(local, RESTRICTION_STATUS)) {
      for (const e of splitRestrictionEntries(grp.text)) {
        out.push(makeRecord('restriction', b.state, e.name, '', grp.status, e.text, 'local'));
      }
    }
    for (const grp of splitByStatus(projects, PROJECT_STATUS)) {
      for (const e of splitProjectEntries(grp.text)) {
        out.push(makeRecord('project', b.state, e.name, e.where, grp.status, e.text, ''));
      }
    }
  }
  return out;
}

/* ========================= CSV and XLSX ========================== */

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

/* Column headers differ between the two downloads and may change
   between editions, so match on meaning rather than exact text. */
const COLUMN_HINTS = {
  state:        ['state'],
  jurisdiction: ['jurisdiction', 'locality', 'municipality', 'county', 'town', 'city', 'location'],
  name:         ['project', 'project name', 'name', 'facility'],
  status:       ['status'],
  rules:        ['rule', 'rules', 'restriction type', 'type of restriction', 'category'],
  tech:         ['technology', 'tech', 'energy type', 'resource'],
  text:         ['description', 'summary', 'detail', 'details', 'narrative', 'notes', 'text'],
  refs:         ['citation', 'citations', 'source', 'sources', 'reference', 'references', 'url', 'link'],
  date:         ['date', 'year', 'adopted', 'enacted']
};

function mapColumns(header) {
  const norm = header.map(h => (h || '').toLowerCase().trim());
  const map = {};
  for (const [key, hints] of Object.entries(COLUMN_HINTS)) {
    let best = -1, bestScore = 0;
    norm.forEach((h, i) => {
      for (const hint of hints) {
        const score = h === hint ? 3 : h.includes(hint) ? 2 : 0;
        if (score > bestScore) { bestScore = score; best = i; }
      }
    });
    if (best >= 0) map[key] = best;
  }
  return map;
}

function parseTable(rows, kindHint) {
  if (rows.length < 2) return [];
  const map = mapColumns(rows[0]);
  const get = (r, k) => (map[k] !== undefined ? (r[map[k]] || '').trim() : '');
  const out = [];

  for (const r of rows.slice(1)) {
    const state = get(r, 'state');
    if (!state) continue;
    const stateName = STATES.find(s => s.toLowerCase() === state.toLowerCase())
                   || STATES.find(s => STATE_ABBR[s] === state.toUpperCase())
                   || state;
    const name = get(r, 'name') || get(r, 'jurisdiction') || '(unnamed)';
    const kind = kindHint
      || (get(r, 'rules') || /restrict|moratorium|setback|ban/i.test(get(r, 'text'))
            ? 'restriction' : 'project');
    const body = [get(r, 'rules'), get(r, 'text'), get(r, 'refs')]
                   .filter(Boolean).join(' ');
    const rec = makeRecord(kind, stateName, name, get(r, 'jurisdiction'),
                           get(r, 'status'), body, '');
    const techCol = get(r, 'tech');
    if (techCol) {
      for (const t of TECH_RULES) {
        if (t.cues.some(c => techCol.toLowerCase().includes(c.trim())) &&
            !rec.technologies.includes(t.id)) rec.technologies.push(t.id);
      }
    }
    const d = get(r, 'date');
    if (d) rec.date = d;
    out.push(rec);
  }
  return out;
}

async function parseTabularFile(file) {
  const lower = file.name.toLowerCase();
  const kindHint = /restrict/.test(lower) ? 'restriction'
                 : /project|contest/.test(lower) ? 'project' : '';
  if (lower.endsWith('.csv') || lower.endsWith('.tsv') || lower.endsWith('.txt')) {
    return parseTable(parseCsv(await file.text()), kindHint);
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  let all = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false });
    const sheetKind = /restrict/i.test(sheetName) ? 'restriction'
                    : /project|contest/i.test(sheetName) ? 'project' : kindHint;
    all = all.concat(parseTable(rows.map(r => r.map(v => v == null ? '' : String(v))), sheetKind));
  }
  return all;
}

/* ======================= shared record build ===================== */

let _recordSeq = 0;

function makeRecord(kind, state, name, where, status, text, scope) {
  const rec = {
    id: kind[0] + '-' + (++_recordSeq),
    kind,                       // 'restriction' or 'project'
    scope,                      // 'state' or 'local' for restrictions
    state,
    abbr: STATE_ABBR[state] || '',
    name: tidyName(name),
    where,
    status: normalizeStatus(status),
    date: '',
    text: text.trim(),
    rules: [],
    technologies: [],
    flags: [],
    refs: [],
    narrative: '',
    suggested: []
  };
  const hay = (rec.name + ' ' + rec.text).toLowerCase();

  const ruleRe = /Rule\s+(\d+[a-z]?(?:\s+and\s+\d+[a-z]?)?)\s*:\s*([^|(]{2,60}?)\s*\((wind|solar|storage|transmission)\)/g;
  let m;
  while ((m = ruleRe.exec(rec.text)) !== null) {
    rec.rules.push({ number: m[1].trim(), label: m[2].trim(), tech: m[3] });
    if (!rec.technologies.includes(m[3])) rec.technologies.push(m[3]);
  }

  for (const t of TECH_RULES) {
    if (!rec.technologies.includes(t.id) && t.cues.some(c => hay.includes(c))) {
      rec.technologies.push(t.id);
    }
  }
  for (const f of FLAG_RULES) {
    if (f.cues.some(c => hay.includes(c))) rec.flags.push(f.id);
  }
  for (const cat of CODEBOOK) {
    if (cat.cues.some(c => hay.includes(c))) rec.suggested.push(cat.id);
  }
  const found = extractRefs(rec.text);
  rec.refs = found.refs;
  /* the entry's own account, with the citation block left off */
  rec.narrative = found.citeStart > 40
    ? rec.text.slice(0, found.citeStart).replace(/[\s;,]*$/, '').trim()
    : rec.text;
  if (!rec.date) {
    const y = rec.text.match(/\b(19|20)\d{2}\b/g);
    if (y) rec.date = y[y.length - 1];
  }
  return rec;
}

function tidyName(n) {
  return (n || '').replace(/\s+/g, ' ')
                  .replace(/^[^A-Za-z0-9]+/, '')
                  .replace(/\s*\|\s*$/, '')
                  .trim();
}

function normalizeStatus(s) {
  const t = (s || '').trim().toLowerCase();
  if (!t) return 'Unknown';
  if (t.startsWith('cancel')) return 'Canceled';
  if (t.startsWith('pend')) return 'Pending';
  if (t.startsWith('oper')) return 'Operational';
  if (t.startsWith('complet')) return 'Operational';
  if (t.startsWith('under con')) return 'Under construction';
  if (t.includes('in effect')) return 'In effect';
  if (t.startsWith('expir')) return 'Expired';
  if (t.startsWith('repeal')) return 'Repealed';
  return s.trim();
}

/* Legal and news citations are dense with abbreviations, so a plain
   search backwards for ". " lands inside "Feb. 6" or "No. 23" and
   chops the citation in half. Skip any period that closes one of
   these, or an initial. */
const ABBREV = new RegExp(
  '(?:^|[\\s(])(?:' +
    'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|' +
    'No|Nos|Inc|Co|Corp|Cos|Ltd|Assn|Ass’n|Bros|' +
    'Ct|Cir|Cnty|Dept|Dep’t|Div|Comm’n|Comm|Ed|Rev|Stat|Ann|Art|Sec|Supp|' +
    'U\\.S|N\\.Y|D\\.C|v|ed|al|et al|Mr|Mrs|Ms|Dr|St|Ave|Rd|' +
    'Ala|Ariz|Ark|Cal|Colo|Conn|Del|Fla|Ga|Ill|Ind|Kan|Ky|La|Md|Mass|Mich|Minn|' +
    'Miss|Mo|Mont|Neb|Nev|Okla|Or|Pa|Tenn|Tex|Va|Wash|Wis|Wyo|' +
    '[A-Z]' +
  ')\\.$'
);

function citeStart(before) {
  for (let i = before.length - 2; i > 0; i--) {
    const c = before[i];
    if ((c !== '.' && c !== ';') || before[i + 1] !== ' ') continue;
    if (c === '.' && ABBREV.test(before.slice(Math.max(0, i - 12), i + 1))) continue;
    return i + 2;
  }
  return -1;
}

/* Pull every link out of the citation string and work out what kind
   of source it is, because that decides what to do with it next.
   Also report where the citation block begins, so the entry's own
   words can be shown without it repeated underneath. */
function extractRefs(text) {
  const urlRe = /https?:\/\/[^\s;)"'\]]+/g;
  const refs = [];
  let earliest = -1;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    const url = m[0].replace(/[.,;]+$/, '');
    const window = text.slice(Math.max(0, m.index - 260), m.index);
    const cut = citeStart(window);
    const abs = cut >= 0 ? m.index - (window.length - cut) : -1;
    const cite = (cut >= 0 ? window.slice(cut) : window).replace(/[,\s]*$/, '').trim();
    if (abs >= 0 && (earliest < 0 || abs < earliest)) earliest = abs;
    refs.push({ url, cite, type: classifyRef(url, cite) });
  }
  return { refs, citeStart: earliest };
}

function classifyRef(url, cite) {
  const u = url.toLowerCase(), c = (cite || '').toLowerCase();
  if (/change\.org|petitionsite|ipetitions|facebook\.com|\/stop|\/\/stop|\/save|\/\/save/.test(u)
      || /petition|stop |save /.test(c)) return 'opposition';
  if (/justia|casetext|courtlistener|caselaw|ferc\.gov/.test(u)
      || /\bv\.\s|f\.\s?supp|\bferc\b|no\. cv|docket no|case no/.test(c)) return 'legal';
  if (/\.gov\b|\.state\.[a-z]{2}\.us|legislature|legiscan|arkleg|capitol|municode|amlegal|legistar|civicweb|qcode|codelibrary|revize|municipalcodeonline|\.us\//.test(u))
    return 'government';
  if (/minutes|resolution no|ordinance|staff report|zoning|land use code|general plan|admin\. code|code ann/.test(c))
    return 'government';
  return 'news';
}
