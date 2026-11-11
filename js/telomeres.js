// telomeres.js: the telomeric repeat database. The index and sequences are
// built from tol_telomeres by scripts/build_telomere_db.py.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";
import { addDownloads } from "./plot-download.js";
import * as Fig1 from "./telomere-tree.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const int = d3.format(",");
const pc = (v) => (v == null || isNaN(v) ? "–" : d3.format(".0%")(v));
const nameOf = (k) => k.replace(/_/g, " ");
const groupName = (g) => (g ? g.replace(/-/g, " ") : "–");
const sci = (v) =>
  v == null
    ? "–"
    : v === 0
      ? "0"
      : v < 1e-3
        ? v
            .toExponential(1)
            .replace("e", "×10")
            .replace(/10([+-]?\d+)$/, (_, e) => `10<sup>${+e}</sup>`)
        : d3.format(".2g")(v);

// The three repeats that cover most of the tree get the three hues; the rest
// are neutral steps, with texture for losses in the tree
const STATES = ["AACCT", "AACCCT", "AAACCCT", "other", "lost", "unknown"];
const STATE_LABEL = {
  AACCT: "AACCT",
  AACCCT: "AACCCT",
  AAACCCT: "AAACCCT",
  other: "Another repeat",
  lost: "Telomerase lost",
  unknown: "No call",
};
const stateOf = (d) =>
  d.stateClass === "telomerase_lost"
    ? "lost"
    : !d.state
      ? "unknown"
      : STATES.includes(d.state)
        ? d.state
        : "other";

const TERT = {
  found: [
    "Found",
    "An intact TERT, aligned with miniprot and confirmed by its telomerase RNA-binding domain.",
  ],
  found_hmm: [
    "Found by profile HMM",
    "Missed by the protein alignments, then found by the TERT and RNA-binding domain profiles.",
  ],
  partial: [
    "Found, with breaks",
    "The best alignment has frameshifts or stops. This is usually an assembly or alignment error, not a pseudogene.",
  ],
  absent: ["Not found", "No TERT by alignment or profile search."],
  unresolved: ["Unresolved", "The searches disagree about this genome."],
};
// TR status, as in tol_telomeres shifts/tr_tol/src/final_tr_table.py: validated needs all three checks
const TR_RULE =
  "Validated means all three checks pass: a strong telomere call at the chromosome ends, a TR template that encodes that same repeat, and a TR model hit with E ≤ 1e-10.";
function trStatus(d) {
  if (!d.trLocus)
    return {
      key: "none",
      label: "not found",
      short: "not found",
      why: "No TR locus was found in this genome.",
    };
  if (d.validated === "yes")
    return {
      key: "validated",
      label: "validated",
      short: "validated",
      why: "Validated: a strong telomere call at the ends, a template that encodes the same repeat, and a model hit with E ≤ 1e-10.",
    };
  const fails = [],
    short = [];
  if (d.support !== "strong") {
    fails.push(
      d.support === "weak"
        ? "the telomere call at the ends is weak"
        : "there is no telomere call at the ends to compare with",
    );
    short.push(
      d.support === "weak" ? "weak telomere call" : "no telomere call",
    );
  }
  if (d.agrees === "no") {
    fails.push("the template encodes a different repeat");
    short.push("template encodes another repeat");
  } else if (d.agrees === "chance") {
    fails.push("the template match is no longer than in a shuffled sequence");
    short.push("template match could be chance");
  } else if (d.agrees === "no_template" || !d.agrees) {
    fails.push("no template-like stretch matches a telomeric repeat");
    short.push("no template match");
  }
  if (!(d.trEvalue <= 1e-10))
    (short.push("weak model hit"),
      fails.push(
        `the model hit is weak (E = ${d.trEvalue == null ? "–" : d3.format(".1e")(d.trEvalue)})`,
      ));
  return {
    key: "candidate",
    label: "candidate",
    short: `candidate (${short.join(", ") || "a check failed"})`,
    why: `Candidate: a TR locus was found, but not validated because ${fails.join(", and ") || "a check failed"}.`,
  };
}
// Telomere call, per species, from repeat_states.tsv (state_class, evidence, support, note)
const STATE_RULE =
  "The telomeric repeat: the repeat tidk finds at the chromosome ends, checked against the TR template and TERT. Hover over a value for that species.";
const EVIDENCE = {
  "ends+template":
    "it is at the chromosome ends and the TR template encodes it",
  "template+weak_ends":
    "it is at only some chromosome ends, but the TR template encodes it",
  ends: "it is at the chromosome ends (no validated TR template to confirm it)",
  curated: "it was set by hand on review",
};
function stateWhy(d) {
  const st = stateOf(d),
    ends = d.ends ? ` (${d.ends} ends)` : "";
  if (st === "lost")
    return `Telomerase lost: this species is in a lineage with no TERT, so its chromosome ends are not made by telomerase.${d.unit ? ` The commonest repeat at its ends, ${d.unit}, is not a telomere.` : ""}`;
  if (st === "unknown") {
    if (d.note) return `No call: ${d.note}`;
    if (!d.stateClass || d.stateClass !== "unknown")
      return "No call: this species is not in the set used for the repeat analysis.";
    if (d.support === "weak")
      return `No call: the repeat ${d.unit ?? ""} is at too few chromosome ends${ends} to be sure it is the telomere, and no TR template confirms it.`;
    return d.unit
      ? `No call: the commonest repeat, ${d.unit}, is not at the chromosome ends.`
      : "No call: no repeat was found at the chromosome ends.";
  }
  return `${d.state}: ${EVIDENCE[d.evidence] ?? "called at the chromosome ends"}${ends}.`;
}
function tertWhy(d) {
  const t = TERT[d.tert];
  if (!t) return "This genome was not in the TERT search.";
  let why = `${t[0]}: ${t[1]}`;
  if (d.tert === "absent") {
    if (stateOf(d) === "lost")
      why +=
        " Its relatives lack TERT too and the ends carry no telomeric repeat, so this lineage has lost telomerase.";
    else if ((d.flags ?? []).some((f) => f.startsWith("tert_missed")))
      why +=
        " The telomere still looks telomerase-made, so this is probably a search miss, not a loss.";
    else if (d.state)
      why += ` The ends still carry ${d.state}, so TERT is probably there but missed.`;
    else
      why +=
        " With no telomere call either, a loss cannot be told apart from a search miss.";
  }
  return why;
}
const TERT_RULE =
  "TERT is found by aligning known TERT proteins with miniprot, then by TERT and RNA-binding domain profiles for genomes the alignments miss.";

const SOURCE = {
  explore: "the commonest repeat found by <code>tidk explore</code>",
  discovered:
    "a repeat found by <code>tidk ends</code> at the sequence ends, below the top explore unit",
  known:
    "a known telomeric repeat, checked at the ends because it ranked below the top five",
};
const FLAG = {
  compound: (x) => `a longer compound of the repeat, ${x}`,
  mixed: (x) => `mixed with ${x}`,
  tert_missed: () =>
    "TERT not found although the telomere looks telomerase-made, so probably a search miss",
  tert_absent_weak_telomere: () => "no TERT and only a weak telomere call",
  call_replaced: () => "the tidk call was replaced on review",
  template_disagrees: () => "the TR template encodes a different repeat",
  no_c_run: () => "the call has no C run, unlike most telomeres",
};
const flagText = (f) => {
  const [k, rest] = f.split(/:(.*)/s);
  const m = rest && rest.match(/^([ACGT]+)\((\d+)\/(\d+)\)$/);
  const x = m
    ? `<code>${m[1]}</code> (${m[2]} of ${m[3]} ends)`
    : rest
      ? esc(rest)
      : "";
  return (FLAG[k] ?? (() => esc(f.replace(/_/g, " "))))(x);
};
const PICKS = [
  ["Arabidopsis_thaliana", "The plant repeat, TR and TERT, all in agreement"],
  [
    "Bombus_terrestris",
    "A bee with an 11-nucleotide repeat, encoded by its TR",
  ],
  [
    "Merodon_equestris",
    "A hoverfly: Diptera lost telomerase 290 million years ago",
  ],
  ["Acanthis_cabaret", "A bird with the vertebrate repeat, its TR and TERT"],
  ["Pecten_maximus", "A scallop that lost telomerase on its own"],
];

const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () =>
  root.dataset.theme ? root.dataset.theme === "dark" : dark.matches;
const theme = () =>
  isDark() ? Fig1.THEMES.dark : { ...Fig1.THEMES.light, bg: "#fffdf8" };
const palette = () => STATES.map((k) => theme().states[k]);
const ink = () =>
  isDark()
    ? ["#f0efec", "#c3c2b7", "#4a4945"]
    : ["#0b0b0b", "#52514e", "#d4d3cd"];
const stateScale = () => ({
  type: "ordinal",
  domain: STATES,
  range: palette(),
  tickFormat: (s) => STATE_LABEL[s],
});

// --- data ---

const state = {
  species: null,
  sort: "species",
  dir: 1,
  rows: 15,
  group: "",
  st: "",
  unit: "",
};
let index, all, byName, fig, figData;
const seqCache = new Map();

const comp = { A: "T", C: "G", G: "C", T: "A", N: "N" };
const revcomp = (s) =>
  [...s]
    .reverse()
    .map((c) => comp[c] ?? "N")
    .join("");
const CODE = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
const translate = (s) => {
  const idx = { T: 0, C: 1, A: 2, G: 3 };
  let out = "";
  for (let i = 0; i + 2 < s.length; i += 3) {
    const a = idx[s[i]],
      b = idx[s[i + 1]],
      c = idx[s[i + 2]];
    out += a == null || b == null || c == null ? "X" : CODE[a * 16 + b * 4 + c];
  }
  return out.replace(/\*$/, "");
};
const wrap = (s, n = 60) => s.match(new RegExp(`.{1,${n}}`, "g")).join("\n");
const jitter = (k) => {
  let h = 2166136261;
  for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};
const parseEnds = (e) => {
  const m = e && e.match(/^(\d+)\/(\d+)$/);
  return m ? [+m[1], +m[2]] : null;
};

async function sequences(sp) {
  if (!seqCache.has(sp))
    seqCache.set(
      sp,
      fetch(`/data/telomeres/seq/${sp}.json`)
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({})),
    );
  return seqCache.get(sp);
}

// --- tree (Fig 1 of the paper, js/telomere-tree.js) ---

const TERT_CAT = {
  found: "found",
  found_hmm: "found",
  partial: "partial",
  absent: "absent",
  unresolved: "unresolved",
};
function prepareTree() {
  const tips = new Map(
    all.map((d) => [
      d.species,
      {
        cat: stateOf(d),
        unit: d.state || d.unit || "",
        tr: d.validated === "yes",
        trWhy: trStatus(d).short,
        stateWhy:
          stateOf(d) === "lost" || stateOf(d) === "unknown"
            ? stateWhy(d)
            : null,
        tertWhy: TERT[d.tert]?.[0],
        tert: TERT_CAT[d.tert] ?? null,
        group: Fig1.groupLabel({
          phylum: d.phylum,
          klass: d.class,
          order: d.order,
        }),
      },
    ]),
  );
  return Fig1.prepare(index.tree, tips, index.transitions);
}

function renderTree() {
  const el = $("figTree");
  el.querySelector("svg")?.remove();
  fig = Fig1.render(el, figData, {
    theme: theme(),
    selected: state.species,
    onSelect: (sp) => open(sp),
    tip: $("treeTip"),
  });
  fig.setMarks($("markPos").value);
}

function saveTree() {
  const box = document.createElement("div");
  const { svg } = Fig1.render(box, figData, {
    theme: Fig1.THEMES.light,
    interactive: false,
  });
  svg.setAttribute("width", "178mm");
  svg.setAttribute("height", "232mm");
  saveText(
    "telomeres_tree.svg",
    new XMLSerializer().serializeToString(svg),
    "image/svg+xml",
  );
}

// --- overview charts ---

function renderOverview() {
  const groups = d3
    .rollups(
      all,
      (v) => v.length,
      (d) => d.group,
    )
    .filter(([, n]) => n >= 8)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);
  const rows = all.filter((d) => groups.includes(d.group));
  const w1 = Math.max(260, $("plot1").clientWidth);
  const counts = d3
    .flatRollup(
      rows,
      (v) => v.length,
      (d) => d.group,
      stateOf,
    )
    .map(([group, st, n]) => ({ group, st, n }));
  const totals = d3.rollup(
    rows,
    (v) => v.length,
    (d) => d.group,
  );
  const plot1 = Plot.plot({
    width: w1,
    height: 40 + groups.length * 24,
    marginLeft: 150,
    marginRight: 16,
    x: { label: "Share of species (%) →", percent: true, ticks: 4 },
    y: {
      domain: groups,
      label: null,
      tickFormat: (g) => `${groupName(g)} (${totals.get(g)})`,
    },
    color: { ...stateScale(), legend: true, label: "Telomere" },
    marks: [
      Plot.barX(
        counts,
        Plot.stackX({
          x: "n",
          y: "group",
          fill: "st",
          offset: "normalize",
          order: STATES,
          inset: 0.5,
          insetLeft: 0,
          insetRight: 0,
          tip: { format: { x: false, n: true, fill: (s) => STATE_LABEL[s] } },
        }),
      ),
      Plot.ruleX([0]),
    ],
  });
  $("plot1").replaceChildren(plot1);

  // fraction of ends with the telomere, one jittered row per group
  const gi = new Map(groups.map((g, i) => [g, i]));
  const ends = rows
    .filter((d) => d.ends && stateOf(d) !== "lost")
    .map((d) => {
      const e = parseEnds(d.ends);
      return e && e[1]
        ? {
            group: d.group,
            y: gi.get(d.group) + (jitter(d.species) - 0.5) * 0.6,
            f: e[0] / e[1],
            st: stateOf(d),
            species: d.species,
            ends: d.ends,
            sel: d.species === state.species,
          }
        : null;
    })
    .filter(Boolean);
  const medians = d3
    .rollups(
      ends,
      (v) => d3.median(v, (d) => d.f),
      (d) => d.group,
    )
    .map(([g, m]) => ({ i: gi.get(g), m }));
  const plot2 = Plot.plot({
    width: Math.max(260, $("plot2").clientWidth),
    height: 40 + groups.length * 24,
    marginLeft: 110,
    marginRight: 16,
    x: {
      domain: [0, 1],
      label: "Share of chromosome ends with the telomere →",
      tickFormat: "%",
      ticks: 4,
    },
    y: {
      domain: [groups.length - 0.5, -0.5],
      label: null,
      ticks: groups.map((_, i) => i),
      tickFormat: (i) => groupName(groups[i]),
      tickSize: 0,
    },
    color: stateScale(),
    marks: [
      Plot.dot(ends, { x: "f", y: "y", fill: "st", r: 1.6, fillOpacity: 0.55 }),
      Plot.ruleX(medians, {
        x: "m",
        y1: (d) => d.i - 0.38,
        y2: (d) => d.i + 0.38,
        stroke: ink()[0],
        strokeWidth: 2.5,
      }),
      Plot.dot(
        ends.filter((d) => d.sel),
        {
          x: "f",
          y: "y",
          r: 5,
          stroke: ink()[0],
          strokeWidth: 2,
          fill: "none",
        },
      ),
      Plot.tip(
        ends,
        Plot.pointer({
          x: "f",
          y: "y",
          title: (d) =>
            `${nameOf(d.species)}\n${d.ends} ends · ${STATE_LABEL[d.st] === d.st ? d.st : STATE_LABEL[d.st]}`,
        }),
      ),
    ],
  });
  plot2.addEventListener("click", () => {
    const v = plot2.value;
    if (v) open(v.species);
  });
  $("plot2").replaceChildren(plot2);

  const losses = index.losses.map((l) => ({
    ...l,
    label: `${l.order}${l.n_species > 1 ? "" : `, ${nameOf(l.example)}`}`,
  }));
  const plot3 = Plot.plot({
    width: Math.max(260, $("plot3").clientWidth),
    height: 40 + losses.length * 26,
    marginLeft: 200,
    marginRight: 70,
    x: { label: "Million years ago →", reverse: true, grid: true },
    y: { domain: losses.map((l) => l.label), label: null },
    marks: [
      Plot.ruleY(losses, {
        x1: "stem_myr",
        x2: "crown_myr",
        y: "label",
        stroke: ink()[1],
        strokeWidth: 2,
      }),
      Plot.dot(losses, {
        x: "stem_myr",
        y: "label",
        r: 5,
        fill: theme().tert.absent,
        stroke: "var(--plot-background)",
        strokeWidth: 1.5,
      }),
      Plot.dot(
        losses.filter((l) => l.n_species > 1),
        { x: "crown_myr", y: "label", r: 3.5, fill: ink()[1] },
      ),
      Plot.text(losses, {
        x: "crown_myr",
        y: "label",
        text: (l) => (l.n_species > 1 ? `${l.n_species} species` : ""),
        dx: 8,
        textAnchor: "start",
        fill: "currentColor",
      }),
      Plot.tip(
        losses,
        Plot.pointerY({
          x: "stem_myr",
          y: "label",
          title: (l) =>
            `${l.order} (${l.class})\n${l.n_species} species in ${l.n_families} famil${l.n_families > 1 ? "ies" : "y"}\nLost after ${l.stem_myr} Myr ago${l.n_species > 1 ? `, before ${l.crown_myr}` : ""}\nExample: ${nameOf(l.example)}`,
        }),
      ),
    ],
  });
  plot3.addEventListener("click", () => {
    const v = plot3.value;
    if (v) open(v.example);
  });
  $("plot3").replaceChildren(plot3);

  const n = (f) => all.filter(f).length;
  $("note1").innerHTML =
    `Three repeats cover most of the tree: <code>AACCT</code> in ${int(n((d) => d.state === "AACCT"))} species (mostly arthropods), <code>AACCCT</code> in ${int(n((d) => d.state === "AACCCT"))} (most other animals and many fungi), and <code>AAACCCT</code> in ${int(n((d) => d.state === "AAACCCT"))} (plants). Another ${int(n((d) => stateOf(d) === "other"))} species have a different repeat, and ${int(n((d) => stateOf(d) === "lost"))} belong to lineages that have lost telomerase altogether. Hover over a tip for its species and click to open it; hover over a mark for the change. Hold ctrl or ⌘ to zoom with the wheel, or pinch.`;
  $("note3").innerHTML =
    `Twelve lineages lost telomerase, judged by TERT going missing along with the repeat. Each line runs from the stem age (after which the loss happened) to the crown age of the species that share it. The flies are the biggest: none of the ${int(losses[0]?.n_species ?? 0)} Diptera has TERT. Click a loss to open an example.`;
}

function renderTiles() {
  const strong = all.filter((d) => d.support === "strong").length;
  const seqs = d3.sum(all, (d) => d.sequences ?? 0),
    t2t = d3.sum(all, (d) => d.t2t ?? 0);
  const units = new Set(
    all
      .filter((d) => d.stateClass === "telomeric" && d.state)
      .map((d) => d.state),
  );
  $("tiles").innerHTML = [
    [int(all.length), "species"],
    [int(strong), "with a strong telomere call"],
    [int(units.size), "different telomeric repeats"],
    [int(all.filter((d) => d.trLocus).length), "telomerase RNAs located"],
    [
      int(all.filter((d) => /^found|partial/.test(d.tert ?? "")).length),
      "TERT genes found",
    ],
    [pc(t2t / seqs), `of ${int(seqs)} chromosomes end to end`],
  ]
    .map(([a, b]) => `<div class="gs-tile"><b>${a}</b><span>${b}</span></div>`)
    .join("");
}

// --- table ---

const unitCell = (d) =>
  `<span class="tl-help" data-tip="${esc(stateWhy(d))}">${d.state && stateOf(d) !== "lost" ? `<code>${esc(d.state)}</code>` : `<span class="tl-muted">${STATE_LABEL[stateOf(d)]}</span>`}</span>`;
const COLS = [
  ["species", "Species", (d) => `<i>${esc(nameOf(d.species))}</i>`, "l"],
  ["group", "Group", (d) => esc(groupName(d.group)), "l"],
  ["order", "Order", (d) => esc(d.order ?? "–"), "l"],
  ["state", "Telomere", unitCell, "l", STATE_RULE],
  ["ends", "Ends", (d) => esc(d.ends ?? "–")],
  ["t2t", "T2T", (d) => (d.sequences ? `${d.t2t}/${d.sequences}` : "–")],
  [
    "tr",
    "TR",
    (d) => {
      const t = trStatus(d);
      return t.key === "none"
        ? "–"
        : `<span class="tl-help" data-tip="${esc(t.why)}">${t.label}</span>`;
    },
    "l",
    TR_RULE,
  ],
  [
    "tert",
    "TERT",
    (d) =>
      TERT[d.tert]
        ? `<span class="tl-help" data-tip="${esc(tertWhy(d))}">${TERT[d.tert][0]}</span>`
        : "–",
    "l",
    TERT_RULE,
  ],
];
const SORT = {
  species: (d) => d.species,
  group: (d) => d.group,
  order: (d) => d.order,
  state: (d) => d.state,
  ends: (d) => {
    const e = parseEnds(d.ends);
    return e ? e[0] / e[1] : null;
  },
  t2t: (d) => (d.sequences ? d.t2t / d.sequences : null),
  tr: (d) => (d.trLocus ? (d.validated === "yes" ? 2 : 1) : 0),
  tert: (d) => d.tert,
};

function renderTable() {
  const shown = all.filter(
    (d) =>
      (!state.group || d.group === state.group) &&
      (!state.st || stateOf(d) === state.st) &&
      (!state.unit || d.state === state.unit),
  );
  $("unitChip").hidden = !state.unit;
  $("unitChip").innerHTML = state.unit
    ? `Repeat <code>${esc(state.unit)}</code> ×`
    : "";
  const key = SORT[state.sort];
  const rows = shown.slice().sort((a, b) => {
    const x = key(a),
      y = key(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return state.dir * d3.ascending(x, y);
  });
  $("thead").innerHTML =
    "<tr>" +
    COLS.map(
      ([k, label, , cls, help]) =>
        `<th class="${cls ?? ""}" aria-sort="${state.sort === k ? (state.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${k}"${help ? ` data-tip="${esc(help)}"` : ""}>${label}${state.sort === k ? (state.dir > 0 ? " ↑" : " ↓") : ""}</button></th>`,
    ).join("") +
    "</tr>";
  $("tbody").innerHTML = rows
    .slice(0, state.rows)
    .map(
      (d) =>
        `<tr data-s="${esc(d.species)}"${d.species === state.species ? ' class="on"' : ""}>` +
        COLS.map(
          ([, , f, cls]) => `<td class="${cls ?? ""}">${f(d)}</td>`,
        ).join("") +
        "</tr>",
    )
    .join("");
  $("more").hidden = rows.length <= 15;
  $("more").textContent =
    state.rows < rows.length ? `Show all ${int(rows.length)}` : "Show fewer";
}

// --- species view ---

function open(sp, scroll = true) {
  if (!byName.has(sp)) return;
  if (state.species !== sp) {
    state.sat = null;
    state.satAll = false;
  }
  state.species = sp;
  if (decodeURIComponent(location.hash.slice(1)) !== sp)
    history.replaceState(null, "", "#" + sp);
  renderSpecies();
  fig?.select(sp);
  renderOverview();
  renderTable();
  if (scroll)
    $("species").scrollIntoView({ behavior: "smooth", block: "start" });
}

function repeatStrip(unit) {
  const n = Math.max(2, Math.min(6, Math.floor(36 / unit.length)));
  const g = revcomp(unit);
  const run = (u) =>
    Array.from(
      { length: n },
      (_, i) => `<span class="${i % 2 ? "b" : "a"}">${u}</span>`,
    ).join("");
  return `<div class="tl-strip" aria-label="The repeat ${unit} and its complement">
    <div><small>C-rich strand</small><code>5′ ${run(unit)} … 3′</code></div>
    <div><small>G-rich strand</small><code>3′ ${run([...g].reverse().join(""))} … 5′</code></div>
  </div>`;
}

function endsGraphic(d) {
  if (!d.sequences) return "";
  const n = d.sequences,
    both = d.t2t ?? 0,
    one = d.oneEnd ?? 0,
    none = d.noEnds ?? Math.max(0, n - both - one);
  const kinds = [
    ...Array(both).fill(2),
    ...Array(one).fill(1),
    ...Array(none).fill(0),
  ];
  const shown = kinds.slice(0, 120);
  return `<div class="tl-ends" role="img" aria-label="${both} of ${n} sequences have the telomere at both ends and ${one} at one end">
    ${shown.map((k) => `<span class="tl-chr k${k}"><i></i><b></b><i></i></span>`).join("")}${kinds.length > shown.length ? `<em>+${kinds.length - shown.length} more</em>` : ""}
  </div>
  <p class="tl-endkey"><span><i class="k2"></i>Both ends (${both})</span><span><i class="k1"></i>One end (${one})</span><span><i class="k0"></i>Neither (${none})</span></p>`;
}

function telomereCard(d) {
  const st = stateOf(d);
  const e = parseEnds(d.ends);
  const row = (k, v) =>
    v == null || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
  let lead;
  if (st === "lost")
    lead = `<p class="tl-lead">This species belongs to a lineage that has <b>lost telomerase</b>. ${d.unit ? `The commonest repeat at its sequence ends, <code>${esc(d.unit)}</code>, is not a telomerase-made telomere.` : ""}${d.satFamilies ? ` Its chromosome ends carry satellite repeats instead: see <a href="#sat-card" data-jump="sat">the end satellites</a> below.` : ""}</p>`;
  else if (!d.state)
    lead = `<p class="tl-lead">No telomeric repeat could be called for this genome${d.unit ? `. The best candidate was <code>${esc(d.unit)}</code>, at ${esc(d.ends ?? "few")} ends` : ""}. Assemblies with few complete chromosomes often give no call whatever the biology.</p>`;
  else
    lead = `${repeatStrip(d.state)}<p class="tl-lead">${d.support === "strong" ? "A strong call" : "A weak call"}${e ? `: the repeat is at <b>${e[0]} of ${e[1]}</b> chromosome ends` : ""}.${d.evidence?.includes("template") ? " The telomerase RNA template encodes it too." : ""}</p>`;
  const flags = (d.flags || []).map(flagText);
  return `<section class="gs-card og-card">
    <div class="og-cardhead"><h3>Telomere</h3>${d.state && st !== "lost" ? `<span class="tl-unit tl-help" tabindex="0" data-tip="${esc(stateWhy(d))}">${esc(d.state)}</span>` : `<span class="og-badge ${st === "lost" ? "fail" : "flag"} tl-help" tabindex="0" data-tip="${esc(stateWhy(d))}">${STATE_LABEL[st]}</span>`}</div>
    ${lead}
    ${endsGraphic(d)}
    <dl class="og-meta">
      ${row("tidk call", d.unit ? `<code>${esc(d.unit)}</code>, ${SOURCE[d.source] ?? esc(d.source ?? "")}` : "none")}
      ${row("Copies", d.copies != null ? int(d.copies) : null)}
      ${d.topUnit && d.topUnit !== d.unit ? row("Commonest repeat", `<code>${esc(d.topUnit)}</code> (${int(d.topCopies)} copies)`) : ""}
      ${row("Evidence", d.evidence ? esc(d.evidence.replace(/\+/g, " + ").replace(/_/g, " ")) : null)}
      ${row("Sequences ≥ 1 Mb", d.sequences != null ? `${d.sequences}, of which ${d.t2t} telomere to telomere` : null)}
    </dl>
    ${flags.length ? `<p class="og-reasons">Note: ${flags.join("; ")}.</p>` : ""}
    ${d.note ? `<p class="og-reasons">${esc(d.note)}</p>` : ""}
  </section>`;
}

function trSequence(tr) {
  const seq = tr.seq,
    t = tr.template;
  const marked = t
    ? esc(seq.slice(0, t[0])) +
      `<mark>${esc(seq.slice(t[0], t[0] + t[1]))}</mark>` +
      esc(seq.slice(t[0] + t[1]))
    : esc(seq);
  return `<pre class="tl-seq">${marked}</pre>`;
}

function trCard(d, seqs) {
  const row = (k, v) =>
    v == null || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
  if (!d.trLocus)
    return `<section class="gs-card og-card"><div class="og-cardhead"><h3>Telomerase RNA</h3><span class="og-badge flag tl-help" tabindex="0" data-tip="No TR locus was found in this genome by any of the TR models.">not found</span></div>
    <p class="tl-lead">No TR was found in this genome. TRs evolve quickly, so a miss here usually means no close relative's model was sensitive enough.</p></section>`;
  const tr = seqs?.tr;
  const t = tr?.template;
  return `<section class="gs-card og-card" data-card="tr">
    <div class="og-cardhead"><h3>Telomerase RNA</h3><span class="og-badge ${d.validated === "yes" ? "pass" : "flag"} tl-help" tabindex="0" data-tip="${esc(TR_RULE)}">${trStatus(d).label}</span></div>
    <p class="tl-lead">${d.template ? `The template ${t ? "(highlighted) " : ""}matches <code>${esc(d.template)}</code> over ${d.templateMatch} nucleotides${d.agrees === "yes" ? ", the same repeat as at the chromosome ends." : d.agrees === "no" ? `, <b>not</b> the repeat called at the ends.` : "."}` : "No template-like stretch matches a telomeric repeat."}</p>
    <p class="tl-why">${esc(trStatus(d).why)}</p>
    ${tr ? trSequence(tr) : seqs ? `<p class="gs-note">The locus sequence is not in this release.</p>` : `<p class="og-loading">Loading the sequence…</p>`}
    <dl class="og-meta">
      ${row("Locus", `<code>${esc(d.trLocus)}</code>`)}
      ${row("Model", esc(d.trModel?.replace(/_/g, " ") ?? ""))}
      ${row("E-value", sci(d.trEvalue))}
      ${row("Copies in the genome", d.trCopies)}
      ${row("Length", tr ? `${int(tr.seq.length)} nt` : null)}
    </dl>
    ${tr ? `<div class="og-filegrid"><button type="button" class="og-file" data-dl="tr"><b>FASTA</b>TR locus</button><button type="button" class="og-file" data-copy="tr"><b>Copy</b>Sequence</button></div>` : ""}
  </section>`;
}

function tertCard(d, seqs) {
  const row = (k, v) =>
    v == null || v === "" ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
  const t = TERT[d.tert];
  const tert = seqs?.tert;
  const prot = tert ? translate(tert.cds) : null;
  const ref = tert?.ref?.split("|");
  const refText = ref
    ? ref[0] === "dtol"
      ? `<i>${esc(nameOf(ref[1]))}</i> TERT (from this database)`
      : ref[0] === "sp" || ref[0] === "tr"
        ? `<a href="https://www.uniprot.org/uniprotkb/${esc(ref[1])}">${esc(ref[2] ?? ref[1])}</a> (UniProt)`
        : esc(tert.ref)
    : null;
  return `<section class="gs-card og-card" data-card="tert">
    <div class="og-cardhead"><h3>TERT</h3><span class="og-badge ${/^found/.test(d.tert ?? "") ? "pass" : d.tert === "partial" || d.tert === "unresolved" ? "flag" : "fail"} tl-help" tabindex="0" data-tip="${esc(tertWhy(d))}">${t ? t[0].toLowerCase() : "not searched"}</span></div>
    <p class="tl-lead">${t ? t[1] : "This genome was not in the TERT search."}</p>
    ${tert ? `<div class="tl-prot" role="img" aria-label="Protein of ${int(prot.length)} amino acids"><span style="width:${Math.min(100, (prot.length / 1300) * 100)}%"></span></div><p class="gs-note">${int(prot.length)} amino acids, ${int(tert.cds.length)} nt of coding sequence</p>` : seqs || !t ? "" : /^found|partial/.test(d.tert) ? `<p class="og-loading">Loading the sequence…</p>` : ""}
    <dl class="og-meta">
      ${row("Locus", tert?.locus ? `<code>${esc(tert.locus)}</code>` : null)}
      ${row("Aligned from", refText)}
      ${row("Reference covered", tert?.cover ? pc(+tert.cover) : null)}
    </dl>
    ${tert ? `<div class="og-filegrid"><button type="button" class="og-file" data-dl="cds"><b>FASTA</b>Coding sequence</button><button type="button" class="og-file" data-dl="prot"><b>FASTA</b>Protein</button></div>` : /^found|partial/.test(d.tert ?? "") && seqs ? `<p class="gs-note">The TERT sequence for this genome is not in this release.</p>` : ""}
  </section>`;
}

// --- end satellites of telomerase-loss genomes (tol_telomeres shifts/d2_ends/satlib) ---

const kb = (bp) => (bp >= 1e6 ? `${(bp / 1e6).toFixed(1)} Mb` : bp >= 1000 ? `${(bp / 1000).toFixed(bp >= 1e4 ? 0 : 1)} kb` : `${bp} bp`);
const SAT_TIP = {
  unit: "The repeat unit: the length of the consensus of one copy. Units over 2 kb were found from recurring 16-mers, as TRF cannot report them.",
  ends: "Chromosome ends carrying at least 1 kb of this family, out of all ends in the assembly's chromosome-scale sequences.",
  quality: "How well the consensus is supported: the copies (monomers) aligned to build it, and their mean identity to the consensus.",
  dfam: "The best match in Dfam 3.8's curated repeat library (RepeatMasker), and how much of the consensus it covers. Most end satellites match nothing known.",
};
function satQuality(f) {
  if (f.method === "seed") return `<span class="tl-help" data-tip="Too few copies to rebuild: this is the unit of the longest array, as found.">single array</span>`;
  return `<span class="tl-help" data-tip="${esc(`${int(f.aligned)} of ${int(f.monomers)} copies aligned, from ${f.arrays} array${f.arrays === 1 ? "" : "s"}.`)}">${int(f.aligned)} copies, ${f.identity}%</span>`;
}
function satDfam(f) {
  if (!f.dfam?.best) return `<span class="tl-muted">none</span>`;
  if (f.dfam.cover < 0.1)
    return `<span class="tl-muted tl-help" data-tip="${esc(`Only small fragments match known repeats: the best, ${f.dfam.best}, covers ${pc(f.dfam.cover)} of the consensus.`)}">none</span>`;
  return `<span class="tl-help" data-tip="${esc(`${f.dfam.best}${f.dfam.class ? ` (${f.dfam.class})` : ""} covers ${pc(f.dfam.cover)} of the consensus; known repeats cover ${pc(f.dfam.any)} in all.`)}">${esc(f.dfam.best)} ${pc(f.dfam.cover)}</span>`;
}
function satCard(d, seqs) {
  if (!d.satFamilies) return "";
  const fams = seqs?.sat;
  if (!fams) return `<section class="gs-card og-card tl-sat" id="sat-card"><div class="og-cardhead"><h3>End satellites</h3></div><p class="og-loading">Loading the satellites…</p></section>`;
  const sel = fams.find((f) => f.id === state.sat) ?? fams[0];
  const cap = fams.find((f) => f.cap);
  const shown = state.satAll ? fams : fams.slice(0, 8);
  const flags = (f) => [f.cap ? `<span class="og-badge pass tl-help" data-tip="The cap: the end family at the most chromosome ends.">cap</span>` : "", f.long ? `<span class="og-badge tl-tag tl-help" data-tip="A long unit, over 2 kb.">long</span>` : "", f.lowComplexity >= 0.5 ? `<span class="og-badge flag tl-help" data-tip="${esc(`${pc(f.lowComplexity)} of the consensus is low-complexity sequence (dustmasker).`)}">low complexity</span>` : ""].join("");
  return `<section class="gs-card og-card tl-sat" id="sat-card" data-card="sat">
    <div class="og-cardhead"><h3>End satellites</h3><span class="og-badge tl-tag tl-help" tabindex="0" data-tip="Tandem-repeat families at the chromosome ends: at least 2 kb at ends, and at most 20% of their bp elsewhere.">${int(fams.length)} famil${fams.length === 1 ? "y" : "ies"}</span></div>
    <p class="tl-lead">Without telomerase, the chromosome ends of this genome are capped by satellite repeats.${cap ? ` The main one is a ${kb(cap.period)} unit with at least 1 kb at <b>${cap.endsCap} of ${cap.endsTotal}</b> chromosome ends.` : ""}</p>
    <div class="gs-tablewrap"><table class="gs-table tl-sattable">
      <thead><tr><th class="l">Family</th><th><span class="tl-help" tabindex="0" data-tip="${esc(SAT_TIP.unit)}">Unit</span></th><th><span class="tl-help" tabindex="0" data-tip="${esc(SAT_TIP.ends)}">Ends</span></th><th class="l"><span class="tl-help" tabindex="0" data-tip="${esc(SAT_TIP.quality)}">Consensus</span></th><th class="l"><span class="tl-help" tabindex="0" data-tip="${esc(SAT_TIP.dfam)}">Known repeat</span></th></tr></thead>
      <tbody>${shown.map((f) => `<tr data-sat="${esc(f.id)}"${f === sel ? ' class="on"' : ""} tabindex="0"><td class="l"><code>${esc(f.id)}</code> ${flags(f)}</td><td>${kb(f.period)}</td><td>${f.endsCap}/${f.endsTotal}</td><td class="l">${satQuality(f)}</td><td class="l">${satDfam(f)}</td></tr>`).join("")}</tbody>
    </table></div>
    ${fams.length > 8 ? `<button type="button" class="chip gs-more" data-satall>${state.satAll ? "Show fewer" : `Show all ${fams.length}`}</button>` : ""}
    <h4>Consensus of <code>${esc(sel.id)}</code>, ${int(sel.len)} bp</h4>
    <p class="tl-why">${sel.method === "seed" ? "The unit of the longest array: too few copies to build a consensus." : `Built from ${int(sel.aligned)} aligned copies (${sel.identity}% identity). `}Oriented as most end copies read from the chromosome tip${sel.orientation != null && sel.orientation < 1 ? ` (${pc(sel.orientation)} of them)` : ""}; ${int(sel.bpEnd)} bp at ends${sel.bpInterior ? `, ${int(sel.bpInterior)} bp inside chromosomes` : ", none found inside chromosomes"}.</p>
    <pre class="tl-seq">${esc(sel.cons)}</pre>
    <div class="og-filegrid"><button type="button" class="og-file" data-dl="sat"><b>FASTA</b>This family</button><button type="button" class="og-file" data-copy="sat"><b>Copy</b>Sequence</button><button type="button" class="og-file" data-dl="satall"><b>FASTA</b>All ${int(fams.length)} families</button></div>
  </section>`;
}

async function renderSpecies() {
  const sp = state.species,
    d = byName.get(sp);
  const genus = sp.split("_")[0];
  const congeners = all.filter(
    (x) => x.species !== sp && x.species.split("_")[0] === genus,
  );
  const tax = [d.phylum, d.class, d.order, d.family]
    .filter(Boolean)
    .map(esc)
    .join(" › ");
  const draw = (seqs) => {
    $("species").innerHTML = `
      <header class="og-head">
        <p class="eyebrow">${esc(groupName(d.group))}</p>
        <h2><i>${esc(nameOf(sp))}</i></h2>
        <p class="og-sub">${tax}${d.assembly ? ` · assembly <a href="${d.gca ? `https://www.ncbi.nlm.nih.gov/datasets/genome/${d.gca}/` : `https://www.ncbi.nlm.nih.gov/datasets/genome/?taxon=${encodeURIComponent(nameOf(sp))}`}">${esc(d.assembly)}</a>${d.gca ? ` (${d.gca})` : ""}` : ""}</p>
        <p class="og-sub">${
          congeners.length
            ? `Also in <i>${esc(genus)}</i>: ${congeners
                .slice(0, 6)
                .map(
                  (x) =>
                    `<a href="#${esc(x.species)}"><i>${esc(nameOf(x.species))}</i></a> ${unitCell(x)}`,
                )
                .join(
                  ", ",
                )}${congeners.length > 6 ? ` and ${congeners.length - 6} more` : ""}`
            : "The only species of its genus in the database"
        }</p>
      </header>
      <div class="tl-three">${telomereCard(d)}${trCard(d, seqs)}${tertCard(d, seqs)}</div>
      ${satCard(d, seqs)}`;
  };
  draw(d.seq ? seqCache.get(sp)?.done : {});
  if (d.seq) {
    const seqs = await sequences(sp);
    seqCache.get(sp).done = seqs;
    if (state.species === sp) draw(seqs);
  }
}

function saveText(name, text, type = "text/plain") {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([text], { type })),
    download: name,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- start ---

const res = await fetch("/data/telomeres.json").catch(() => null);
if (!res || !res.ok) {
  $("status").textContent =
    "The database could not be loaded just now. Please try again later.";
  throw new Error("telomere index unavailable");
}
index = await res.json();
all = index.rows.map((r) =>
  Object.fromEntries(index.fields.map((f, i) => [f, r[i]])),
);
byName = new Map(all.map((d) => [d.species, d]));
figData = prepareTree();
$("status").remove();
$("app").hidden = false;

$("names").replaceChildren(
  ...all.map((d) =>
    Object.assign(document.createElement("option"), {
      value: nameOf(d.species),
    }),
  ),
);
$("picks").innerHTML = PICKS.filter(([k]) => byName.has(k))
  .map(
    ([k, why]) =>
      `<a class="chip" href="#${k}" title="${esc(why)}"><i>${esc(nameOf(k))}</i></a>`,
  )
  .join("");
const groups = d3
  .rollups(
    all,
    (v) => v.length,
    (d) => d.group,
  )
  .sort((a, b) => b[1] - a[1]);
$("groupFilter").innerHTML =
  `<option value="">All</option>` +
  groups
    .map(
      ([g, n]) =>
        `<option value="${esc(g)}">${esc(groupName(g))} (${n})</option>`,
    )
    .join("");
const date = (s) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
$("source").innerHTML =
  `Built from the <code>tol_telomeres</code> analysis at commit <code>${index.commit.slice(0, 7)}</code> (${date(index.committed)}): <a href="https://github.com/tolkit/telomeric-identifier">tidk</a> 0.3 telomere calls, TR searches with nhmmer and Infernal, and TERT searches with miniprot and HMMER. Calls are automated and come from assemblies of varying completeness: check the support and the notes before relying on one. Please cite the database if you use it.`;
$("bulk").innerHTML = [
  [
    "telomeres/telomeres.tsv",
    "TSV",
    `Every species: telomere call, chromosome ends, TR and TERT (${int(all.length)} rows)`,
  ],
  [
    "telomeres/tr.fa",
    "FASTA",
    `Telomerase RNA loci (${int(all.filter((d) => d.seq & 1).length)})`,
  ],
  [
    "telomeres/tert_cds.fa",
    "FASTA",
    `TERT coding sequences (${int(all.filter((d) => d.seq & 2).length)})`,
  ],
  [
    "telomeres/satellites.fa",
    "FASTA",
    `End-satellite consensus library of the ${int(all.filter((d) => d.satFamilies).length)} telomerase-loss genomes (${int(d3.sum(all, (d) => d.satFamilies))} families)`,
  ],
  [
    "telomeres/satellites.tsv",
    "TSV",
    "One row per end-satellite family: unit, ends, consensus quality and Dfam match",
  ],
  [
    "telomeres.json",
    "JSON",
    "The database as this page reads it, with the dated tree",
  ],
]
  .map(
    ([p, k, label]) =>
      `<a class="og-file" href="/data/${p}" download><b>${k}</b>${label}</a>`,
  )
  .join("");
renderTiles();

$("search").addEventListener("change", (e) => {
  const raw = e.target.value.trim(),
    q = raw.toLowerCase().replace(/\s+/g, "_");
  if (!q) return;
  if (/^[acgt]+$/i.test(raw) && raw.length >= 4) {
    const u = raw.toUpperCase(),
      forms = new Set();
    for (const x of [u, revcomp(u)])
      for (let i = 0; i < x.length; i++) forms.add(x.slice(i) + x.slice(0, i));
    const hit = all.filter((d) => d.state && forms.has(d.state));
    if (hit.length) {
      Object.assign(state, { st: "", group: "", unit: hit[0].state, rows: 15 });
      $("stateFilter").value = $("groupFilter").value = "";
      renderTable();
      $("tbody").closest(".gs-section").scrollIntoView({ behavior: "smooth" });
      e.target.value = "";
      return;
    }
  }
  const hit =
    all.find((d) => d.species.toLowerCase() === q) ||
    all.find((d) => d.species.toLowerCase().startsWith(q));
  if (hit) {
    open(hit.species);
    e.target.value = "";
  }
});
// hover (or focus, or tap) on anything with data-tip
const helpTip = $("helpTip");
const showHelp = (el) => {
  helpTip.textContent = el.dataset.tip;
  helpTip.style.display = "block";
  const r = el.getBoundingClientRect(),
    w = helpTip.offsetWidth,
    h = helpTip.offsetHeight;
  helpTip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  helpTip.style.top = `${r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8}px`;
};
const hideHelp = () => (helpTip.style.display = "none");
for (const ev of ["mouseover", "focusin"])
  $("app").addEventListener(ev, (e) => {
    const el = e.target.closest?.("[data-tip]");
    el ? showHelp(el) : hideHelp();
  });
$("app").addEventListener("mouseleave", hideHelp);
$("app").addEventListener("focusout", hideHelp);
addEventListener("scroll", hideHelp, { passive: true });

$("random").addEventListener("click", () => {
  const good = all.filter((d) => d.trLocus && d.state);
  open(good[Math.floor(Math.random() * good.length)].species);
});
$("treeIn").addEventListener("click", () => fig.zoomBy(1.6));
$("treeOut").addEventListener("click", () => fig.zoomBy(1 / 1.6));
$("treeReset").addEventListener("click", () => fig.reset());
$("markPos").addEventListener("change", (e) => fig.setMarks(e.target.value));
$("treeSave").addEventListener("click", saveTree);
$("groupFilter").addEventListener("change", (e) => {
  state.group = e.target.value;
  state.rows = 15;
  renderTable();
});
$("unitChip").addEventListener("click", () => {
  state.unit = "";
  renderTable();
});
$("stateFilter").addEventListener("change", (e) => {
  state.st = e.target.value;
  state.rows = 15;
  renderTable();
});
$("thead").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.k;
  if (!k) return;
  state.dir =
    state.sort === k
      ? -state.dir
      : ["species", "group", "order", "state"].includes(k)
        ? 1
        : -1;
  state.sort = k;
  renderTable();
});
$("tbody").addEventListener("click", (e) => {
  const s = e.target.closest("tr")?.dataset.s;
  if (s) open(s);
});
$("more").addEventListener("click", () => {
  state.rows = state.rows === 15 ? Infinity : 15;
  renderTable();
});
$("species").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-sat]")) {
    e.preventDefault();
    e.target.click();
  }
});
$("species").addEventListener("click", async (e) => {
  const row = e.target.closest("tr[data-sat]");
  if (row || e.target.closest("[data-satall]")) {
    if (row) state.sat = row.dataset.sat;
    else state.satAll = !state.satAll;
    const y = $("sat-card").getBoundingClientRect().top;
    await renderSpecies();
    window.scrollBy(0, $("sat-card").getBoundingClientRect().top - y);
    return;
  }
  if (e.target.closest("[data-jump]")) {
    e.preventDefault();
    $("sat-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const dl = e.target.closest("[data-dl]")?.dataset.dl,
    cp = e.target.closest("[data-copy]");
  if (!dl && !cp) return;
  const sp = state.species,
    d = byName.get(sp),
    seqs = await sequences(sp);
  const satSel = seqs.sat?.find((f) => f.id === state.sat) ?? seqs.sat?.[0];
  const satFa = (f) => `>${sp}|${f.id} period=${f.period} ends=${f.endsCap}/${f.endsTotal}${f.cap ? " cap" : ""} method=${f.method}\n${wrap(f.cons)}\n`;
  if (cp && cp.dataset.copy === "sat" && satSel) {
    navigator.clipboard?.writeText(satSel.cons).then(() => {
      cp.querySelector("b").textContent = "Copied";
      setTimeout(() => (cp.querySelector("b").textContent = "Copy"), 1500);
    });
  } else if (dl === "sat" && satSel) {
    saveText(`${sp}.${satSel.id}.satellite.fa`, satFa(satSel));
  } else if (dl === "satall" && seqs.sat) {
    saveText(`${sp}.end_satellites.fa`, seqs.sat.map(satFa).join(""));
  } else if (cp && seqs.tr) {
    navigator.clipboard?.writeText(seqs.tr.seq).then(() => {
      cp.querySelector("b").textContent = "Copied";
      setTimeout(() => (cp.querySelector("b").textContent = "Copy"), 1500);
    });
  } else if (dl === "tr" && seqs.tr) {
    saveText(
      `${sp}.TR.fa`,
      `>${sp} TR ${seqs.tr.locus} model=${seqs.tr.model} evalue=${seqs.tr.evalue}\n${wrap(seqs.tr.seq)}\n`,
    );
  } else if (dl === "cds" && seqs.tert) {
    saveText(
      `${sp}.TERT.cds.fa`,
      `>${sp} TERT ${seqs.tert.locus} CDS\n${wrap(seqs.tert.cds)}\n`,
    );
  } else if (dl === "prot" && seqs.tert) {
    saveText(
      `${sp}.TERT.faa`,
      `>${sp} TERT ${seqs.tert.locus}\n${wrap(translate(seqs.tert.cds))}\n`,
    );
  }
});
addEventListener("hashchange", () => {
  const k = decodeURIComponent(location.hash.slice(1));
  if (k && k !== state.species) open(k);
});

const start = decodeURIComponent(location.hash.slice(1));
state.species = byName.has(start) ? start : "Arabidopsis_thaliana";
renderSpecies();
renderTree();
renderOverview();
renderTable();
addDownloads($("app"));

let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (innerWidth !== lastWidth) {
    lastWidth = innerWidth;
    renderOverview();
  }
});
const rethemed = () => {
  renderOverview();
  renderTree();
};
dark.addEventListener("change", rethemed);
new MutationObserver(rethemed).observe(root, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
