# Reading the opposition report

A browser tool for working through the Sabin Center's record of local opposition to
renewable energy siting. Filter it down to the states and technologies you are studying,
read the entries, pull out the news articles and documents each one cites, and mark what
people actually objected to.

Live at **https://hbedle-subsurface.github.io/elsa_doc/**

It opens on **solar only**, since that is the subject of the study. Wind, storage and
transmission are one click away in the left rail — worth having, because a county that
banned wind often went on to restrict solar, and the same neighbors show up at both
hearings.

There are six sample entries built into the page, so it can be tried before anything is
downloaded. Nothing is uploaded. Files are read in your own browser and your coding is
stored there, with a backup button so it can move between machines.

---

## Getting the data

The source is the Sabin Center for Climate Change Law at Columbia Law School,
*Opposition to Renewable Energy Facilities in the United States*, and its companion
database at **https://oppositionreport.org**. The database is updated monthly.

Two routes in:

**The tabular downloads (recommended).** The current data page offers the restriction
data and the contested project data as separate files. They are already in columns, so
they read cleanly. Drop both in at once.

**The report PDF.** Also works. The report has a regular shape — state by state, then
siting framework, state restrictions, local restrictions, contested projects — so it can
be cut apart by pattern. PDF text extraction is never exact, so a small number of entries
come through with a ragged title. Every record keeps the original text it was built
from, and the tool says how many look ragged, so those can be checked against the report.

The PDF is around 17 MB and belongs to the Sabin Center. It is not in this repository and
should not be added to it. Download it fresh, which also means you are working from the
current edition.

---

## Working through it

**Filter.** The strip across the top is every state in the file. Each bar is that state's
full share of the data; the solid part is what survives the current filter. Bars are
scaled to the whole file and stay that way, so filtering visibly shrinks them rather than
quietly rescaling the axis. Click a bar to filter to that state. *South central* selects
Oklahoma, Texas, Kansas, Arkansas, Louisiana, Missouri, New Mexico and Colorado.

Every filter you apply appears as a removable chip above the results, with *Clear all* at
the end, so nothing is ever narrowing the view invisibly.

Beyond state, energy type and status, the rail separates out three things worth pulling
apart: projects involving **agrivoltaics** (grazing or cropping under the panels),
projects **sited on water** (canals, reservoirs, ponds, irrigation districts), and
projects **serving a data center**, which is increasingly what the fight is actually
about.

**Read.** Click an entry. You get the report's own account of it with the citation block
lifted off, then those references sorted into news coverage, opposition groups and
petitions, government records, and legal filings. The entry exactly as printed folds open
underneath, for checking against the source. Those citations are a curated reading list — the Sabin researchers have already
found the local coverage of each fight.

Arrow keys move between entries once one is open; escape goes back to the list. Entries
you have opened are marked read, and the results line counts how many of the current set
you have been through.

**Code.** Under each entry, the categories whose cue words appear in that entry are shown
first, in a small box. The remaining categories fold open underneath. A cue word matching
is a place to look, not a result — a category enters the data when you tick it, having
read the entry.

The counts panel shows word matches until you confirm your first code, then switches to
counting only your own codes and says so.

**Mark what to chase.** *Add to chase list* flags an entry worth following up. The chase
list is the input to the next step.

---

## What comes out

| Button | File | One row per | Use |
|---|---|---|---|
| Projects to look up next | `seed_list_<date>.csv` | entry on the chase list | Feeds the news and social media collection step. Carries a ready-made search string and every URL the report already cites. Falls back to the current filter if nothing is starred. |
| Your coding, as a table | `coded_records_<date>.csv` | entry in the current filter | Your codes as one column per category, 1 or 0. Reads straight into a statistics tool. |
| The reading list | `references_<date>.csv` | citation | Every article and document cited by the current filter, sorted by source type. |
| Back up your work | `coding_session_<date>.json` | — | Your codes, stars and notes. Load it on another machine, or after the database updates. |

Codes are stored against a fingerprint of each entry rather than its row number, so
loading next month's edition, or the other half of the data, reattaches your work to the
right entries.

If two people code the same 50 entries independently and export, comparing the two
`coded_records` files gives an inter-coder agreement figure. That is worth doing before
coding the rest.

---

## Changing the codebook

`codebook.js` holds the categories, in plain form:

```js
{
  id: 'farmland_loss',
  label: 'Loss of farmland',
  group: 'land',
  hint: 'Objection that productive or prime agricultural land is taken out of farming.',
  cues: ['farmland', 'prime farmland', 'agricultural land', ...]
}
```

Copy a block to add a category. `id` is what appears in the exported column names, so
changing an id after coding has started orphans that column. `cues` only produce
suggestions; nothing else in the tool depends on them.

The same file holds `FLAG_RULES`, which is where agrivoltaics, solar on water, offshore
wind and data-center-serving projects are detected.

---

## Files

```
index.html      the page, and all of the styling
app.js          loading, filtering, reading, coding, exporting
parse.js        the PDF and CSV/XLSX parsers
codebook.js     the concern categories and the technology flags
sample.js       six real entries, embedded so the page works with no download
```

To change what the page opens on, edit one line near the top of `app.js`:

```js
tech: new Set(['solar']),      // ['solar','wind'] for both, new Set() for everything
```

pdf.js and SheetJS load from a CDN. Everything else is local. To run it without a server,
open `index.html` directly in a browser.

To publish: in the repository settings, under Pages, serve from the `main` branch, root
folder.

---

## Credit

The underlying data is collected and maintained by the Sabin Center for Climate Change
Law at Columbia Law School, as part of the Renewable Energy Legal Defense Initiative.
Cite the report, not this tool, for any figure taken from it:

> Romany M. Webb and Ivonne C. Norman, *Opposition to Renewable Energy Facilities in the
> United States: September 2026 Edition*, Sabin Center for Climate Change Law.

Built for undergraduate research on public response to solar development in the
south-central states, at the University of Oklahoma.

## License

Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). See `LICENSE`.
This covers the tool. It does not cover the Sabin Center's data, which carries its own
terms.
