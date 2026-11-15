// MicrobiologyRPG v2 — tower defense data.
// Same pathogens and real virulence factors as v1, retuned for a
// free-placement canvas tower defense (ranges in px, rates per second).

export const W = 960;
export const H = 540;

// The invasion path through the tissue, from the entry wound (right)
// to the heart (left). Enemies walk it; towers are placed off-path.
export const PATH = [
  { x: 960, y: 80 }, { x: 700, y: 80 }, { x: 700, y: 260 },
  { x: 450, y: 260 }, { x: 450, y: 430 }, { x: 200, y: 430 },
  { x: 200, y: 270 }, { x: 70, y: 270 },
];
export const HEART = { x: 48, y: 270 };

export const TOWERS = {
  neutrophil: {
    code: "neutrophil", name: "Neutrophil", abbr: "N", color: "#d7c9f5",
    cost: 25, hp: 30, dmg: 6, range: 65, rate: 0.5, lifespan: 20,
    desc: "First responder. Fast attacks, then dies by apoptosis after ~20 s.",
    kind: "phagocyte", radius: 14,
  },
  macrophage: {
    code: "macrophage", name: "Macrophage", abbr: "Mφ", color: "#ffb74d",
    cost: 50, hp: 120, dmg: 14, range: 75, rate: 1.2, lifespan: 0,
    desc: "Big eater. Slow, heavy hits; a kill yields +1 antigen.",
    kind: "phagocyte", radius: 20,
  },
  dendritic: {
    code: "dendritic", name: "Dendritic Cell", abbr: "DC", color: "#ba68c8",
    cost: 30, hp: 20, dmg: 0, range: 130, rate: 0, lifespan: 0,
    desc: "Samples antigen in its radius and presents it — without this, B cells cannot make antibodies.",
    kind: "apc", radius: 13,
  },
  bcell: {
    code: "bcell", name: "B Cell", abbr: "B", color: "#81c784",
    cost: 40, hp: 25, dmg: 0, range: 0, rate: 0, lifespan: 0,
    desc: "After antigen is presented, becomes a plasma cell and secretes antibodies that opsonize invaders (+50% damage taken).",
    kind: "adaptive", radius: 13,
  },
  cd8: {
    code: "cd8", name: "Cytotoxic T Cell (CD8+)", abbr: "T8", color: "#f06292",
    cost: 70, hp: 60, dmg: 22, range: 75, rate: 0.8, lifespan: 0,
    desc: "Kills infected cells and intracellular pathogens. The only clean killer of M. tuberculosis.",
    kind: "cytotoxic", radius: 13,
  },
  nk: {
    code: "nk", name: "NK Cell", abbr: "NK", color: "#4fc3f7",
    cost: 50, hp: 40, dmg: 12, range: 85, rate: 0.7, lifespan: 0,
    desc: "Kills virus-infected cells without prior sensitization. Bonus damage vs viruses and infected cells.",
    kind: "cytotoxic", radius: 13,
  },
  skin: {
    code: "skin", name: "Skin Barrier", abbr: "Skin", color: "#f4a988",
    cost: 40, hp: 0, dmg: 4, range: 60, rate: 0, lifespan: 0,
    desc: "Epithelium + mucus + defensins. A zone on the path that slows invaders 40% and damages them. Place it on the path.",
    kind: "barrier", radius: 60, max: 5,
  },
  marrow: {
    code: "marrow", name: "Bone Marrow Center", abbr: "BM", color: "#e57373",
    cost: 100, hp: 150, dmg: 0, range: 0, rate: 10, lifespan: 0,
    desc: "Hematopoiesis hub. Trains and releases a roaming white blood cell every 10 s to hunt invaders on its own.",
    kind: "producer", radius: 26, max: 3,
  },
};

export const PATHOGENS = {
  saureus: {
    code: "saureus", name: "Staphylococcus aureus", abbr: "Sa", color: "#ffd54f",
    gram: "Gram-positive cocci (clusters)", shape: "Coccus",
    hp: 50, speed: 22, dmg: 5, coreDmg: 10, count: 7,
    virulence: [
      { name: "Protein A", text: "Binds the Fc region of IgG backwards, so antibodies cannot opsonize it. Antibodies do nothing until you research the Protein A countermeasure." },
      { name: "Coagulase", text: "Converts fibrinogen to fibrin, walling itself off in a clot. Every 10 s it gains a +20 HP fibrin shield." },
      { name: "Catalase", text: "Detoxifies hydrogen peroxide, blunting the neutrophil oxidative burst (neutrophils deal 25% less damage)." },
    ],
    textbook: "The leading cause of skin abscesses, cellulitis, and MRSA bacteremia. Coagulase-positive; the coagulase test distinguishes it from coagulase-negative staphylococci.",
    counter: "Antibodies are useless at first — hold the line with neutrophils and macrophages, then research the Protein A countermeasure.",
  },
  spyogenes: {
    code: "spyogenes", name: "Streptococcus pyogenes", abbr: "Sp", color: "#ef5350",
    gram: "Gram-positive cocci (chains)", shape: "Coccus",
    hp: 62, speed: 22, dmg: 6, coreDmg: 10, count: 9,
    virulence: [
      { name: "M protein", text: "Anti-phagocytic surface protein. Phagocytes deal 50% damage unless the bacterium is opsonized by antibody + complement." },
      { name: "Streptolysin O", text: "Pore-forming toxin that lyses immune cells on contact (deals extra damage to towers it touches)." },
      { name: "Hyaluronic acid capsule", text: "Molecular mimicry — the capsule is chemically identical to host connective tissue, so it is poorly immunogenic." },
    ],
    textbook: "Group A Streptococcus. Causes strep throat, impetigo, and necrotizing fasciitis; post-infectious sequelae include rheumatic fever (molecular mimicry) and glomerulonephritis.",
    counter: "You need the full adaptive response: present antigen with a dendritic cell, then let antibodies + complement opsonize it before your phagocytes can eat it.",
  },
  mtb: {
    code: "mtb", name: "Mycobacterium tuberculosis", abbr: "Mtb", color: "#ff8a65",
    gram: "Acid-fast bacillus", shape: "Bacillus",
    hp: 100, speed: 14, dmg: 4, coreDmg: 15, count: 6,
    virulence: [
      { name: "Phagosome arrest", text: "Blocks phagosome-lysosome fusion. When a phagocyte tower lands the killing blow, the bacillus survives inside it instead — the tower stops firing and bursts after 6 s, releasing 2 bacilli onto the path." },
      { name: "Mycolic acid cell wall", text: "Waxy, lipid-rich wall resists drying, disinfectants, and complement. Takes 25% less damage from all sources." },
      { name: "Cord factor", text: "Trehalose dimycolate inhibits neutrophil migration and is toxic to host cells." },
    ],
    textbook: "Obligate aerobe, slow grower (18–24 h doubling time). Caseating granulomas wall it off; reactivation occurs when cell-mediated immunity wanes. Antibodies are essentially useless — control is entirely CD4/CD8 T-cell mediated.",
    counter: "Do not let your phagocytes eat it. Kill it with CD8+ T cells, and destroy infected towers before they burst.",
  },
  influenza: {
    code: "influenza", name: "Influenza A virus", abbr: "Flu", color: "#64b5f6",
    gram: "Enveloped (-)ssRNA virus", shape: "Virus",
    hp: 31, speed: 32, dmg: 4, coreDmg: 8, count: 14,
    virulence: [
      { name: "Antigenic drift", text: "Point mutations in hemagglutinin/neuraminidase. After 12 s the surface antigens change: all existing antibodies stop working and antigen must be presented again." },
      { name: "NS1 protein", text: "Antagonizes interferon, delaying the innate antiviral response (NK cells deal 25% less damage)." },
      { name: "Cellular infection", text: "Infects the roaming white blood cells it touches: an infected cell stops fighting and after 4 s bursts, releasing 2 virions." },
    ],
    textbook: "Orthomyxovirus with a segmented genome — reassortment of segments between strains causes antigenic shift and pandemics. Neuraminidase inhibitors (oseltamivir) block viral release.",
    counter: "NK cells and CD8+ T cells clear infected cells. Keep a dendritic cell ready: after the drift, you must present antigen again before antibodies work.",
  },
  paeruginosa: {
    code: "paeruginosa", name: "Pseudomonas aeruginosa", abbr: "Pa", color: "#4db6ac",
    gram: "Gram-negative bacillus", shape: "Bacillus",
    hp: 75, speed: 22, dmg: 7, coreDmg: 12, count: 10,
    virulence: [
      { name: "Biofilm (alginate)", text: "After 12 s on the field it encases itself in biofilm and takes 60% less damage. DNase burst (50 ATP) strips biofilm from every invader on the field." },
      { name: "Type III secretion system", text: "Injects effectors (ExoS/ExoT) directly into immune cells, disabling them (attackers deal 25% less damage)." },
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
  { term: "Hematopoiesis", def: "The formation of blood cells in the bone marrow. Stem cells differentiate into red cells, platelets, and all white blood cells — neutrophils, monocytes/macrophages, lymphocytes, and more." },
];
