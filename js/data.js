// MicrobiologyRPG data: pathogens, immune cells, upgrades, glossary.
// Every virulence factor below is a real mechanism, rendered as a game rule.

export const TICK_MS = 700;
export const LANES = 3;
export const COLS = 10;

export const CELLS = {
  neutrophil: {
    code: "neutrophil", name: "Neutrophil", abbr: "N", color: "#e8e8e8",
    cost: 25, hp: 30, dmg: 10, range: 2, lifespan: 15,
    desc: "First responder. Phagocytoses and kills with an oxidative burst, then dies by apoptosis after ~15 ticks.",
    kind: "phagocyte",
  },
  macrophage: {
    code: "macrophage", name: "Macrophage", abbr: "Mφ", color: "#ffb74d",
    cost: 50, hp: 120, dmg: 8, range: 2, lifespan: 0,
    desc: "Tissue-resident phagocyte. Long-lived; kills it eats yield antigen samples for research.",
    kind: "phagocyte",
  },
  dendritic: {
    code: "dendritic", name: "Dendritic Cell", abbr: "DC", color: "#ba68c8",
    cost: 30, hp: 20, dmg: 0, range: 0, lifespan: 0,
    desc: "Professional antigen-presenting cell. After 5 ticks it presents antigen — without this, B cells cannot make antibodies against the invader.",
    kind: "apc",
  },
  nk: {
    code: "nk", name: "NK Cell", abbr: "NK", color: "#4fc3f7",
    cost: 50, hp: 40, dmg: 12, range: 2, lifespan: 0,
    desc: "Natural killer. Kills virus-infected and stressed host cells without prior sensitization. Bonus damage vs viruses and infected cells.",
    kind: "cytotoxic",
  },
  bcell: {
    code: "bcell", name: "B Cell", abbr: "B", color: "#81c784",
    cost: 40, hp: 25, dmg: 0, range: 0, lifespan: 0,
    desc: "After antigen is presented, differentiates into a plasma cell and secretes antibodies that opsonize invaders in its lane (+50% damage taken).",
    kind: "adaptive",
  },
  cd8: {
    code: "cd8", name: "Cytotoxic T Cell (CD8+)", abbr: "T8", color: "#f06292",
    cost: 70, hp: 60, dmg: 20, range: 2, lifespan: 0,
    desc: "Kills infected host cells and intracellular pathogens. The only cell that can clear M. tuberculosis hiding inside macrophages.",
    kind: "cytotoxic",
  },
};

export const PATHOGENS = {
  saureus: {
    code: "saureus", name: "Staphylococcus aureus", abbr: "Sa", color: "#ffd54f",
    gram: "Gram-positive cocci (clusters)", shape: "Coccus",
    hp: 40, speed: 0.5, dmg: 5, coreDmg: 10, count: 8,
    virulence: [
      { name: "Protein A", text: "Binds the Fc region of IgG backwards, so antibodies cannot opsonize it. Antibodies do nothing until you research the Protein A countermeasure." },
      { name: "Coagulase", text: "Converts fibrinogen to fibrin, walling itself off in a clot. Every 10 ticks it gains a +20 HP fibrin shield." },
      { name: "Catalase", text: "Detoxifies hydrogen peroxide, blunting the neutrophil oxidative burst (neutrophils deal 25% less damage)." },
    ],
    textbook: "The leading cause of skin abscesses, cellulitis, and MRSA bacteremia. Coagulase-positive; the coagulase test distinguishes it from coagulase-negative staphylococci.",
    counter: "Antibodies are useless at first — hold the line with neutrophils and macrophages, then research the Protein A countermeasure.",
  },
  spyogenes: {
    code: "spyogenes", name: "Streptococcus pyogenes", abbr: "Sp", color: "#ef5350",
    gram: "Gram-positive cocci (chains)", shape: "Coccus",
    hp: 50, speed: 0.5, dmg: 6, coreDmg: 10, count: 9,
    virulence: [
      { name: "M protein", text: "Anti-phagocytic surface protein. Phagocytes deal 50% damage unless the bacterium is opsonized by antibody + complement." },
      { name: "Streptolysin O", text: "Pore-forming toxin that lyses immune cells on contact (deals extra damage to adjacent cells)." },
      { name: "Hyaluronic acid capsule", text: "Molecular mimicry — the capsule is chemically identical to host connective tissue, so it is poorly immunogenic." },
    ],
    textbook: "Group A Streptococcus. Causes strep throat, impetigo, and necrotizing fasciitis; post-infectious sequelae include rheumatic fever (molecular mimicry) and glomerulonephritis.",
    counter: "You need the full adaptive response: present antigen with a dendritic cell, then let antibodies + complement opsonize it before your phagocytes can eat it.",
  },
  mtb: {
    code: "mtb", name: "Mycobacterium tuberculosis", abbr: "Mtb", color: "#ff8a65",
    gram: "Acid-fast bacillus", shape: "Bacillus",
    hp: 80, speed: 0.33, dmg: 4, coreDmg: 15, count: 5,
    virulence: [
      { name: "Phagosome arrest", text: "Blocks phagosome-lysosome fusion. When a macrophage or neutrophil lands the killing blow, the bacillus survives inside it instead — the cell becomes infected and bursts after 6 ticks, releasing 2 bacilli." },
      { name: "Mycolic acid cell wall", text: "Waxy, lipid-rich wall resists drying, disinfectants, and complement. Takes 25% less damage from all sources." },
      { name: "Cord factor", text: "Trehalose dimycolate inhibits neutrophil migration and is toxic to host cells." },
    ],
    textbook: "Obligate aerobe, slow grower (18–24 h doubling time). Caseating granulomas wall it off; reactivation occurs when cell-mediated immunity wanes. Antibodies are essentially useless — control is entirely CD4/CD8 T-cell mediated.",
    counter: "Do not let your macrophages eat it. Kill it with CD8+ T cells, and destroy infected macrophages before they burst.",
  },
  influenza: {
    code: "influenza", name: "Influenza A virus", abbr: "Flu", color: "#64b5f6",
    gram: "Enveloped (-)ssRNA virus", shape: "Virus",
    hp: 25, speed: 0.75, dmg: 4, coreDmg: 8, count: 12,
    virulence: [
      { name: "Antigenic drift", text: "Point mutations in hemagglutinin/neuraminidase. After 12 ticks the surface antigens change: all existing antibodies stop working and antigen must be presented again." },
      { name: "NS1 protein", text: "Antagonizes interferon, delaying the innate antiviral response (NK cells deal 25% less damage)." },
      { name: "Cellular infection", text: "Infects the immune cells it touches: an infected cell stops fighting and after 4 ticks bursts, releasing 2 virions." },
    ],
    textbook: "Orthomyxovirus with a segmented genome — reassortment of segments between strains causes antigenic shift and pandemics. Neuraminidase inhibitors (oseltamivir) block viral release.",
    counter: "NK cells and CD8+ T cells clear infected cells. Keep a dendritic cell ready: after the drift, you must present antigen again before antibodies work.",
  },
  paeruginosa: {
    code: "paeruginosa", name: "Pseudomonas aeruginosa", abbr: "Pa", color: "#4db6ac",
    gram: "Gram-negative bacillus", shape: "Bacillus",
    hp: 60, speed: 0.5, dmg: 7, coreDmg: 12, count: 8,
    virulence: [
      { name: "Biofilm (alginate)", text: "After 12 ticks on the field it encases itself in biofilm and takes 60% less damage. DNase burst (50 ATP) strips biofilm from every invader on the field." },
      { name: "Type III secretion system", text: "Injects effectors (ExoS/ExoT) directly into immune cells, disabling them (adjacent cells deal 25% less damage)." },
      { name: "Efflux pumps", text: "MexAB-OprM pumps out antimicrobials — a stand-in for its intrinsic multidrug resistance." },
    ],
    textbook: "Opportunistic, oxidase-positive, non-fermenting Gram-negative rod. Classic in cystic fibrosis lungs, burn wounds, and ventilator-associated pneumonia. Produces pyocyanin (blue-green pigment) and a grape-like odor.",
    counter: "Hit it hard before the biofilm forms, or keep 50 ATP in reserve for a DNase burst. Research biofilm disruption between waves to stop it forming at all.",
  },
};

export const WAVES = [
  { pathogen: "saureus", note: "A cluster of golden cocci breaches a cut in the skin." },
  { pathogen: "spyogenes", note: "Chains of cocci colonize the pharynx and push inward." },
  { pathogen: "mtb", note: "Acid-fast bacilli inhaled into the alveoli. They do not behave like the others." },
  { pathogen: "influenza", note: "Droplets deliver virions to the respiratory epithelium. They mutate as they spread." },
  { pathogen: "paeruginosa", note: "A green-pigmented opportunist arrives — and it builds walls." },
];

export const UPGRADES = {
  complement: {
    name: "Complement Cascade", max: 3, cost: (l) => ({ atp: 40 + l * 40, ag: 2 + l * 2 }),
    desc: "Opsonized invaders take +15% damage per level and leak complement (small damage over time).",
  },
  affinity: {
    name: "Affinity Maturation", max: 3, cost: (l) => ({ atp: 30 + l * 30, ag: 3 + l * 2 }),
    desc: "Somatic hypermutation in germinal centers: antibody opsonization bonus +25% per level.",
  },
  classSwitch: {
    name: "Class Switching (IgM → IgG)", max: 1, cost: () => ({ atp: 60, ag: 5 }),
    desc: "IgG crosses tissue better and fixes complement: opsonized invaders are also slowed 20%.",
  },
  memoryCells: {
    name: "Memory Cell Bank", max: 2, cost: (l) => ({ atp: 50 + l * 50, ag: 4 + l * 3 }),
    desc: "Secondary responses hit harder: +50% damage vs previously defeated pathogens per level.",
  },
  fever: {
    name: "Fever Response", max: 2, cost: (l) => ({ atp: 40 + l * 40, ag: 2 + l }),
    desc: "Raising core temperature slows all invaders 10% per level.",
  },
  barrier: {
    name: "Mucosal Barrier", max: 2, cost: (l) => ({ atp: 30 + l * 30, ag: 1 + l }),
    desc: "Stronger epithelium and mucus: invaders enter with 10% less HP per level.",
  },
  neutrophilTraining: {
    name: "Neutrophil Priming", max: 3, cost: (l) => ({ atp: 30 + l * 20, ag: 1 + l }),
    desc: "Primed neutrophils: +4 damage per level.",
  },
  ifnGamma: {
    name: "IFN-γ Macrophage Activation", max: 2, cost: (l) => ({ atp: 50 + l * 50, ag: 3 + l * 2 }),
    desc: "Activated macrophages: +50% damage per level. Essential against intracellular pathogens.",
  },
  proteinA: {
    name: "Protein A Countermeasure", max: 1, cost: () => ({ atp: 50, ag: 4 }),
    desc: "Anti-Protein A antibodies: opsonization finally works on S. aureus.",
  },
  dnase: {
    name: "Biofilm Disruption (DNase)", max: 1, cost: () => ({ atp: 60, ag: 4 }),
    desc: "P. aeruginosa biofilms never form. DNase burst remains available as a backup.",
  },
};

export const GLOSSARY = [
  { term: "Opsonization", def: "Coating a pathogen with antibody or complement (C3b) so phagocytes can grip and engulf it. Without opsonization, encapsulated and M-protein bacteria resist phagocytosis." },
  { term: "Phagocytosis", def: "Engulfment of a particle by a neutrophil or macrophage into a phagosome, which then fuses with a lysosome. Some pathogens (M. tuberculosis) survive inside the phagosome." },
  { term: "Antigen presentation", def: "Dendritic cells display peptide fragments on MHC-II to activate CD4+ T cells, which in turn license B cells to make antibodies. No presentation, no adaptive response." },
  { term: "Affinity maturation", def: "Somatic hypermutation in germinal centers selects B-cell clones whose antibodies bind antigen ever more tightly." },
  { term: "Class switching", def: "B cells switch the constant region of their antibody (IgM → IgG/IgA/IgE) while keeping the same antigen specificity, changing effector function." },
  { term: "Memory cells", def: "Long-lived B and T cells left after an infection. On re-exposure they mount a secondary response: faster, stronger, and higher-affinity." },
  { term: "Complement", def: "A cascade of plasma proteins (C1–C9) that opsonizes (C3b), recruits phagocytes (C3a, C5a), and lyses targets via the membrane attack complex (C5b–9)." },
  { term: "Antigenic drift", def: "Gradual accumulation of point mutations in surface proteins (e.g. influenza hemagglutinin), eroding antibody recognition and requiring updated vaccines." },
  { term: "Antigenic shift", def: "Sudden reassortment of segmented viral genomes (influenza), producing a novel strain against which the population has no immunity." },
  { term: "Biofilm", def: "A structured community of bacteria embedded in self-produced extracellular matrix (polysaccharides, DNA, protein). Biofilm bacteria are up to 1,000× more resistant to antibiotics and immune clearance." },
  { term: "Virulence factor", def: "A molecule a pathogen uses to colonize, evade immunity, or damage the host — capsules, toxins, adhesins, secretion systems." },
  { term: "Type III secretion system", def: "A needle-like apparatus Gram-negative bacteria use to inject effector proteins directly into host cell cytoplasm, paralyzing phagocytes." },
  { term: "Oxidative burst", def: "The neutrophil respiratory burst: NADPH oxidase generates superoxide and hydrogen peroxide inside the phagosome to kill ingested microbes. Catalase-positive organisms resist it." },
  { term: "Granuloma", def: "A walled-off collection of macrophages (some epithelioid or multinucleated giant cells) that contains pathogens the immune system cannot eliminate — the hallmark of tuberculosis." },
];
