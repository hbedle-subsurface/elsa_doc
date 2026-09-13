/* ------------------------------------------------------------------
   codebook.js

   The concern categories used to code what people object to (or
   support) when a renewable energy project is proposed near them.

   Each category has:
     id       short machine name, used in exported files
     label    what shows in the interface
     group    which family of concern it belongs to
     hint     a sentence describing what counts, for the coder
     cues     words and phrases that trigger a *suggestion* only

   The cues are a first pass, nothing more. The tool marks a category
   as "suggested" when a cue appears in the text; a category only
   becomes part of the data once a person confirms it. Keyword hits
   are not codes.

   To add a category, copy a block and add it to the list. To change
   what a cue picks up, edit the cues array. Nothing else needs to
   change.
------------------------------------------------------------------ */

const CONCERN_GROUPS = [
  { id: 'land',       label: 'Land and agriculture' },
  { id: 'landscape',  label: 'Landscape and place' },
  { id: 'economic',   label: 'Economic' },
  { id: 'environment',label: 'Environment and water' },
  { id: 'safety',     label: 'Safety and health' },
  { id: 'process',    label: 'Process and trust' },
  { id: 'cultural',   label: 'Cultural and tribal' },
  { id: 'support',    label: 'Stated in support' }
];

const CODEBOOK = [
  /* ---- Land and agriculture ---- */
  {
    id: 'farmland_loss',
    label: 'Loss of farmland',
    group: 'land',
    hint: 'Objection that productive or prime agricultural land is taken out of farming.',
    cues: ['farmland', 'prime farmland', 'agricultural land', 'agriculture', 'cropland',
           'farming', 'soil', 'ranchland', 'pasture', 'food production']
  },
  {
    id: 'forest_loss',
    label: 'Tree and forest clearing',
    group: 'land',
    hint: 'Objection to removing woodland, core forest, or individual protected trees.',
    cues: ['core forest', 'tree removal', 'removing trees', 'cutting down trees', 'forested',
           'woodland', 'oak', 'joshua tree', 'deforest']
  },
  {
    id: 'land_use_conflict',
    label: 'Wrong land for it',
    group: 'land',
    hint: 'Objection that the site is zoned for, or better suited to, some other use — '
        + 'including calls to put the project on industrial or already-disturbed land instead.',
    cues: ['zoning', 'rezoning', 'zoned', 'industrial area', 'more remote', 'open space',
           'land use', 'relocate the project', 'overlay']
  },

  /* ---- Landscape and place ---- */
  {
    id: 'visual',
    label: 'Views and visual impact',
    group: 'landscape',
    hint: 'Objection to how the project looks: sightlines, ridgelines, scenic vistas, '
        + 'turbine height, glare from panels.',
    cues: ['viewshed', 'visual impact', 'scenic', 'vista', 'sightline', 'aesthetic',
           'eyesore', 'skyline', 'ridgeline', 'glare', 'visibility', 'height of the turbines']
  },
  {
    id: 'rural_character',
    label: 'Rural character',
    group: 'landscape',
    hint: 'Objection framed around what kind of place this is — that an industrial '
        + 'facility does not belong in a rural or small-town community.',
    cues: ['rural character', 'rural', 'industrial nature', 'quality of life',
           'community values', 'small town', 'way of life', 'character of the community']
  },
  {
    id: 'recreation_tourism',
    label: 'Recreation and tourism',
    group: 'landscape',
    hint: 'Objection about lost access to or enjoyment of hunting, fishing, boating, '
        + 'hiking, parks, or visitor economy. Common for reservoir and canal solar.',
    cues: ['recreation', 'tourism', 'hunting', 'fishing', 'boating', 'hiking', 'trail',
           'park', 'tourist', 'visitors', 'campground']
  },

  /* ---- Economic ---- */
  {
    id: 'property_values',
    label: 'Property values',
    group: 'economic',
    hint: 'Objection that nearby property will be worth less.',
    cues: ['property value', 'property values', 'depreciation', 'home values',
           'resale', 'devalue']
  },
  {
    id: 'tax_revenue_doubt',
    label: 'Doubt about promised benefits',
    group: 'economic',
    hint: 'Objection that the promised tax revenue, jobs, or local power do not '
        + 'materialize, or go somewhere else. Includes "the power leaves the county".',
    cues: ['over an hour away', 'not their own', 'no benefits', 'benefits to the community',
           'data center', 'out-of-state', 'outside the county', 'few jobs', 'temporary jobs']
  },
  {
    id: 'decommissioning',
    label: 'Decommissioning and end of life',
    group: 'economic',
    hint: 'Objection about who removes the equipment, whether bonds are posted, and '
        + 'what happens to panels or blades afterward.',
    cues: ['decommission', 'abandoned', 'removal bond', 'end of life', 'panel waste',
           'disposal', 'reclamation', 'left behind']
  },

  /* ---- Environment and water ---- */
  {
    id: 'wildlife',
    label: 'Wildlife and habitat',
    group: 'environment',
    hint: 'Objection about animals, birds, bats, pollinators, migration corridors, '
        + 'or habitat connectivity.',
    cues: ['wildlife', 'habitat', 'birds', 'bats', 'eagle', 'tortoise', 'bighorn',
           'condor', 'migration corridor', 'endangered', 'species', 'pollinator',
           'biological resources', 'ecosystem']
  },
  {
    id: 'water_quality',
    label: 'Water quality and supply',
    group: 'environment',
    hint: 'Objection about wells, aquifers, groundwater, runoff into drinking water, '
        + 'or water used by the project. Central to canal and reservoir solar.',
    cues: ['well water', 'groundwater', 'aquifer', 'water supply', 'water pollution',
           'water quality', 'drinking water', 'water demand', 'runoff', 'contaminate']
  },
  {
    id: 'drainage_erosion',
    label: 'Drainage, erosion, dust',
    group: 'environment',
    hint: 'Objection about stormwater, flooding, soil erosion during construction, '
        + 'or dust from grading.',
    cues: ['stormwater', 'drainage', 'flooding', 'flood', 'erosion', 'dust', 'grading',
           'sediment', 'wetland']
  },
  {
    id: 'heat_island',
    label: 'Heat and microclimate',
    group: 'environment',
    hint: 'Objection that a large array raises local temperature or changes local weather.',
    cues: ['heat island', 'heat', 'temperature', 'microclimate', 'hotter']
  },

  /* ---- Safety and health ---- */
  {
    id: 'fire_risk',
    label: 'Fire risk',
    group: 'safety',
    hint: 'Objection about ignition, wildfire spread, or difficulty fighting fire at '
        + 'the site. Very common for battery storage.',
    cues: ['fire risk', 'wildfire', 'fires', 'thermal runaway', 'burn', 'firefighting',
           'fire department', 'explosion']
  },
  {
    id: 'noise_flicker',
    label: 'Noise and shadow flicker',
    group: 'safety',
    hint: 'Objection about sound levels or rotating shadows. Mostly wind, sometimes '
        + 'inverters and transformers at solar sites.',
    cues: ['noise', 'decibel', 'dba', 'sound', 'shadow flicker', 'flicker', 'hum']
  },
  {
    id: 'health',
    label: 'Health effects',
    group: 'safety',
    hint: 'Objection that the facility makes people sick — includes claims that are '
        + 'not scientifically supported, which are recorded as stated, not endorsed.',
    cues: ['health', 'turbine syndrome', 'toxic', 'leach', 'cadmium', 'chemicals',
           'emf', 'cancer', 'sick']
  },
  {
    id: 'traffic_roads',
    label: 'Traffic and road damage',
    group: 'safety',
    hint: 'Objection about construction traffic, heavy equipment, and who pays to '
        + 'repair county roads.',
    cues: ['road', 'roads', 'traffic', 'truck', 'haul', 'road maintenance', 'county roads']
  },

  /* ---- Process and trust ---- */
  {
    id: 'notice_process',
    label: 'Notice and public process',
    group: 'process',
    hint: 'Objection about how the decision was made: short notice, no hearing, '
        + 'rushed vote, records withheld, surveyors on private land.',
    cues: ['lack of public notice', 'public notice', 'without their permission',
           'public hearing', 'notification', 'timing of', 'records raise questions',
           'rushed', 'no opportunity', 'transparency']
  },
  {
    id: 'developer_trust',
    label: 'Distrust of the developer',
    group: 'process',
    hint: 'Objection aimed at the company: out-of-state ownership, changed plans, '
        + 'inconsistent filings, broken promises, hidden funding behind opposition ads.',
    cues: ['out-of-state developer', 'texas-based', 'inconsistencies', 'misleading',
           'dark money', 'does not reveal', 'differ from the original', 'promises']
  },
  {
    id: 'local_control',
    label: 'Local control and preemption',
    group: 'process',
    hint: 'Objection that a state agency or state law overrides the county or town. '
        + 'Includes opting into state siting to bypass a local ban.',
    cues: ['preempt', 'bypass any local', 'override', 'state siting', 'local approval process',
           'home rule', 'supersede']
  },
  {
    id: 'fairness',
    label: 'Who benefits, who lives with it',
    group: 'process',
    hint: 'Objection about distribution: leasing landowners paid while neighbors '
        + 'carry the effects, or absentee owners deciding for residents.',
    cues: ['non-participating', 'neighbors', 'absentee', 'leaseholders', 'participating landowner',
           'nearby residents', 'adjacent']
  },

  /* ---- Cultural and tribal ---- */
  {
    id: 'tribal',
    label: 'Tribal consultation and sovereignty',
    group: 'cultural',
    hint: 'Objection raised by a tribe or nation, including inadequate consultation '
        + 'under NHPA or NEPA.',
    cues: ['tribe', 'tribal', 'nation', 'consultation', 'nhpa', 'sovereign',
           'chapter resolution', 'indigenous']
  },
  {
    id: 'sacred_historic',
    label: 'Sacred and historic sites',
    group: 'cultural',
    hint: 'Objection about burial grounds, prayer sites, cultural landscapes, '
        + 'archaeological resources, or historic districts.',
    cues: ['sacred', 'burial', 'cultural resources', 'archaeological', 'historic',
           'prayer site', 'cultural landscape', 'artifacts']
  },

  /* ---- Stated in support ---- */
  {
    id: 'support_revenue',
    label: 'Tax revenue and local funding',
    group: 'support',
    hint: 'Stated in favor: county revenue, school funding, lease payments, scholarships.',
    cues: ['tax revenue', 'revenue for', 'scholarship', 'community investment',
           'lease payment', 'public education', 'county revenue']
  },
  {
    id: 'support_jobs',
    label: 'Jobs and construction work',
    group: 'support',
    hint: 'Stated in favor: construction jobs, long-term operations jobs.',
    cues: ['job opportunities', 'jobs', 'employment', 'construction jobs', 'workforce']
  },
  {
    id: 'support_energy',
    label: 'Local or clean energy supply',
    group: 'support',
    hint: 'Stated in favor: more locally produced power, climate benefit, grid reliability.',
    cues: ['locally-produced', 'locally produced', 'renewable energy to the county',
           'climate', 'reliability', 'power approximately', 'homes']
  },
  {
    id: 'support_concessions',
    label: 'Concessions won by neighbors',
    group: 'support',
    hint: 'Not support exactly — record where opposition produced setbacks, screening, '
        + 'fencing, conservation acreage, or a community benefit agreement.',
    cues: ['setback', 'screening', 'privacy fence', 'plant trees', 'conservation commitment',
           'community benefits agreement', 'good neighbor', 'concession', 'mitigation']
  }
];

/* Technology and sub-type flags. These describe what the project is,
   not what anyone thinks about it. */
const TECH_RULES = [
  { id: 'solar',        label: 'Solar',            cues: ['solar', 'photovoltaic', 'pv ', 'solar thermal'] },
  { id: 'wind',         label: 'Wind',             cues: ['wind', 'turbine'] },
  { id: 'storage',      label: 'Battery storage',  cues: ['battery', 'storage', 'bess', 'mwh'] },
  { id: 'transmission', label: 'Transmission',     cues: ['transmission line', 'power line', 'substation', 'utility lines'] },
  { id: 'hydro',        label: 'Hydro and pumped storage', cues: ['pumped storage', 'hydropower', 'hydroelectric'] }
];

const FLAG_RULES = [
  { id: 'agrivoltaic', label: 'Agrivoltaics',
    cues: ['agrivoltaic', 'sheep grazing', 'grazing', 'dual use', 'dual-use',
           'crops between', 'continue farming', 'pollinator habitat'] },
  { id: 'water_sited', label: 'Solar on water',
    cues: ['floating solar', 'floatovoltaic', 'canal', 'reservoir', 'pond',
           'sanitation district', 'water surface', 'irrigation district'] },
  { id: 'offshore',    label: 'Offshore wind',
    cues: ['offshore', 'floating turbines', 'wind energy area', 'lease area'] },
  { id: 'data_center', label: 'Serves a data center',
    cues: ['data center', 'hyperscale', 'meta-affiliated'] }
];
