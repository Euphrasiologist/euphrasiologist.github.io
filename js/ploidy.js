// ploidy.js: the ploidyspec panel. data/ploidy.json and data/ploidy/<run>.json are built
// from ARU-life-sciences/ploidyspec by scripts/build_ploidy_db.py.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "")
    .replace(/([Dd]iploidi|[Pp]olyploidi|[Hh]omogeni)z/g, "$1s")
    .replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const int = d3.format(",");
const pc = (v) => (v == null ? "–" : d3.format(".0%")(v));
const dist = (v) => (v == null || v < 0 ? "–" : d3.format(".4f")(v / 1e5));
const mb = (bp) => `${d3.format(".1f")(bp / 1e6)} Mb`;
const chrLabel = (c) => String(c).replace(/^chr0*/, "");
const REPO = "https://github.com/ARU-life-sciences/ploidyspec";
const root = document.documentElement,
  dark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () =>
  root.dataset.theme ? root.dataset.theme === "dark" : dark.matches;
const css = (name) =>
  getComputedStyle($("app")).getPropertyValue(name).trim() || "#888";

// --- vocabulary ---

const QUESTIONS = [
  ["ploidy", "Ploidy"],
  ["origin_like_structure", "Auto- or allo-like?"],
  ["te_markers", "Transposon markers"],
  ["rediploidization", "Rediploidisation"],
];
// copy_state, in the fixed order of the site's categorical hues
const STATES = [
  [
    "tetrasomic_like",
    "Tetrasomic-like",
    "No split: the copies are interchangeable, as expected under polysomic inheritance.",
  ],
  [
    "candidate",
    "Candidate split",
    "One line of evidence for a split (distance, transposon markers or a windowed segment), not two.",
  ],
  [
    "partially_resolved",
    "Partly resolved",
    "Two lines of evidence for a split into lineages, or a split pair that keeps stretches of residual tetrasomy.",
  ],
  [
    "resolved_lineages",
    "Resolved lineages",
    "A balanced split into two lineages along the whole chromosome. In two-copy assemblies this is read across homeolog partners, and does not separate allopolyploidy from a long-diploidized autopolyploid.",
  ],
  [
    "fusion_lineages",
    "Fusion lineages",
    "Fused in some copies and not others, which splits the copies into a fused and an unfused lineage.",
  ],
  [
    "one_divergent_copy",
    "One copy apart",
    "One copy stands apart from the rest. If it is the same haplotype on most chromosomes, suspect assembly quality; if it changes, a divergent genome copy (AAAB-like).",
  ],
  [
    "not_assessable",
    "Not assessable",
    "Fewer than three copies and no homeolog partner to pool with.",
  ],
];
const STATE = Object.fromEntries(STATES.map(([k, l, w], i) => [k, { l, w, i }]));
const ORIGIN = [
  ["tetra", "Tetrasomic-like", "Most chromosomes have interchangeable copies (auto-like)."],
  ["di", "Disomic-like", "Duplicated sets that do not interchange (allo-like, or a long-rediploidized autopolyploid)."],
  ["mixed", "Mixed", "Interchangeable and split chromosomes in one genome."],
  ["one", "One copy apart", "One copy, or one chromosome set, stands apart on most chromosomes."],
  ["na", "Not assessable", "Too few copies, or no duplicated sets to compare."],
];
const ORIGIN_OF = Object.fromEntries(ORIGIN.map(([k, l, w], i) => [k, { l, w, i }]));
function originClass(d) {
  const a = (d.answers.origin_like_structure ?? [""])[0];
  if (/^Auto-like/.test(a)) return "tetra";
  if (/^Allo-like/.test(a)) return "di";
  if (/^Mixed/.test(a)) return "mixed";
  if (/^One copy apart|AAA?B-like/.test(a)) return "one";
  return "na";
}
const CONF = {
  high: "High confidence: the lines of evidence agree, and the assembly has enough copies to read this directly.",
  medium: "Medium confidence: the evidence points this way, but it is indirect (pooled across partner chromosomes) or not unanimous.",
  low: "Low confidence: a weak or single line of evidence; treat it as a hint.",
  "not assessable": "Not assessable from this assembly: too few copies, or no duplicated sets to compare.",
};
const VERDICT = {
  agrees: "Agrees with the literature",
  partly: "Agrees in part",
  context: "From the literature",
};
const PICKS = [
  ["daGleHede1", "An allopolyploid: every chromosome has a homeolog partner"],
  ["SchYoun1", "Five fusions split autotetraploid chromosomes into lineages"],
  ["drLytSali1", "An autotetraploid with tetrasomic inheritance"],
  ["lpTriTurg1", "Durum wheat, with its A and B subgenomes as separate runs"],
  ["OncMaso1", "A salmon, 90 million years after its genome duplication"],
  ["ddHesMatr1", "A segmental allotetraploid"],
];

// --- state ---

let index, all, byId, panel;
const state = { id: null, chrom: null, order: "pair", pref: "pair", scheme: "contrast", sort: "name", dir: 1, group: "", origin: "", rows: 15 };
const cache = new Map();
const load = (id) => {
  if (!cache.has(id))
    cache.set(
      id,
      fetch(`/data/ploidy/${id}.json`).then((r) => {
        if (!r.ok) throw new Error(id);
        return r.json();
      }),
    );
  return cache.get(id);
};

// --- colour ---

// ploidyspec's own scale: viridis reversed (close is yellow, far is dark), linear between lo and
// hi. "contrast" stretches it over the 2nd-98th percentile, as in its *_contrast.png heatmaps.
function heat(lo, hi) {
  const s = d3.scaleLinear().domain([hi, lo]).range([0, 1]).clamp(true);
  return (v) => d3.interpolateViridis(s(v));
}
function scaleRange(vals) {
  const v = vals.filter((x) => x >= 0).sort(d3.ascending);
  return state.scheme === "contrast"
    ? [d3.quantile(v, 0.02) ?? 0, d3.quantile(v, 0.98) ?? 1e4]
    : [0, v.at(-1) ?? 1e4];
}
const stateColour = (k) => css(`--st${STATE[k]?.i ?? 6}`);
const originColour = (k) => css(`--or${ORIGIN_OF[k].i}`);

// --- tooltips ---

const tip = () => $("plTip");
function showTip(html, x, y) {
  const t = tip();
  t.innerHTML = html;
  t.style.display = "block";
  const w = t.offsetWidth,
    h = t.offsetHeight;
  t.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x + 14))}px`;
  t.style.top = `${y + 16 + h > innerHeight ? y - h - 12 : y + 16}px`;
}
const hideTip = () => (tip().style.display = "none");

// --- overview ---

function renderTiles() {
  const runs = all.filter((d) => !d.parent);
  $("tiles").innerHTML = [
    [int(runs.length), "species"],
    [int(d3.sum(runs, (d) => d.units)), "chromosome copies compared"],
    [int(runs.filter((d) => d.copies >= 3).length), "assemblies with 3 or 4 copies of each chromosome"],
    [int(runs.filter((d) => d.homeoFrac >= 0.05).length), "with old duplicated chromosome sets"],
    [int(d3.sum(runs, (d) => d.fusions)), "chromosome fusions between copies"],
  ]
    .map(([a, b]) => `<div class="gs-tile"><b>${a}</b><span>${b}</span></div>`)
    .join("");
}

function renderScatter() {
  const el = $("figScatter");
  const pts = all.filter((d) => !d.parent && d.allelic != null && d.homeoFrac != null);
  const W = Math.max(320, el.clientWidth),
    H = 380,
    m = { t: 14, r: 16, b: 46, l: 52 };
  const floor = 1e-4;
  const x = d3
    .scaleLog()
    .domain([floor, 0.06])
    .range([m.l, W - m.r])
    .clamp(true);
  const y = d3.scaleLinear().domain([0, 0.85]).range([H - m.b, m.t]).nice();
  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("width", W)
    .attr("height", H)
    .attr("role", "img")
    .attr(
      "aria-label",
      "Scatter plot of how far apart the copies of each chromosome are against the share of the genome in duplicated blocks, one dot per species",
    );
  const ink3 = css("--ink-3"),
    rule = css("--rule");
  svg
    .append("g")
    .attr("transform", `translate(0,${H - m.b})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues([1e-4, 3e-4, 1e-3, 3e-3, 1e-2, 3e-2])
        .tickFormat((v) => (v === floor ? "≤0.0001" : d3.format("~g")(v))),
    )
    .call((g) => g.select(".domain").attr("stroke", rule))
    .call((g) => g.selectAll(".tick line").attr("stroke", rule))
    .call((g) => g.selectAll("text").attr("fill", ink3));
  svg
    .append("g")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")).tickSize(-(W - m.l - m.r)))
    .call((g) => g.select(".domain").remove())
    .call((g) => g.selectAll(".tick line").attr("stroke", rule).attr("stroke-opacity", 0.6))
    .call((g) => g.selectAll("text").attr("fill", ink3));
  svg
    .append("text")
    .attr("x", (m.l + W - m.r) / 2)
    .attr("y", H - 8)
    .attr("text-anchor", "middle")
    .attr("fill", ink3)
    .attr("font-size", 12)
    .text("How far apart copies of the same chromosome are (median k-mer distance)");
  svg
    .append("text")
    .attr("transform", `translate(13,${(m.t + H - m.b) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("fill", ink3)
    .attr("font-size", 12)
    .text("Genome in duplicated blocks");
  const surface = css("--surface"),
    ink = css("--ink");
  const g = svg.append("g");
  const dot = g
    .selectAll("circle")
    .data(pts, (d) => d.id)
    .join("circle")
    .attr("cx", (d) => x(Math.max(floor, d.allelic)))
    .attr("cy", (d) => y(d.homeoFrac))
    .attr("r", (d) => (d.id === state.id ? 8 : 6))
    .attr("fill", (d) => originColour(originClass(d)))
    .attr("stroke", (d) => (d.id === state.id ? ink : surface))
    .attr("stroke-width", 2)
    .style("cursor", "pointer");
  const picked = new Set(PICKS.map(([k]) => k).concat(state.id ? [state.id] : []));
  // labels for the picks, nudged apart where they would collide
  const labs = pts
    .filter((d) => picked.has(d.id))
    .map((d) => ({ d, x: x(Math.max(floor, d.allelic)) + 10, y: y(d.homeoFrac) + 4, w: shortName(d.name).length * 6.2 }))
    .sort((a, b) => b.y - a.y);
  for (let i = 0; i < labs.length; i++)
    for (let j = 0; j < i; j++) {
      const a = labs[i],
        b = labs[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && Math.abs(a.y - b.y) < 13) a.y = b.y - 13;
    }
  for (const l of labs) if (l.x + l.w > W - m.r) l.x -= l.w + 20;
  g.selectAll("text")
    .data(labs)
    .join("text")
    .attr("x", (l) => l.x)
    .attr("y", (l) => l.y)
    .attr("font-size", 11.5)
    .attr("font-style", "italic")
    .attr("fill", css("--ink-2"))
    .attr("paint-order", "stroke")
    .attr("stroke", surface)
    .attr("stroke-width", 3)
    .text((l) => shortName(l.d.name));
  // hit targets bigger than the dots
  g.append("g")
    .selectAll("circle")
    .data(pts)
    .join("circle")
    .attr("cx", (d) => x(Math.max(floor, d.allelic)))
    .attr("cy", (d) => y(d.homeoFrac))
    .attr("r", 12)
    .attr("fill", "transparent")
    .style("cursor", "pointer")
    .on("mousemove", (e, d) =>
      showTip(
        `<b><i>${esc(d.name)}</i></b><br>${ORIGIN_OF[originClass(d)].l} · ${d.copies} × ${d.numbers}<br><span>Copies ${d.allelic <= floor ? "≤ 0.0001" : d3.format(".4f")(d.allelic)} apart; ${pc(d.homeoFrac)} of the genome in duplicated blocks</span>`,
        e.clientX,
        e.clientY,
      ),
    )
    .on("mouseleave", hideTip)
    .on("click", (e, d) => open(d.id));
  el.replaceChildren(svg.node());
  $("scatterKey").innerHTML = ORIGIN.map(
    ([k, l, w]) =>
      `<span class="pl-key tl-help" tabindex="0" data-tip="${esc(w)}"><i style="background:${originColour(k)}"></i>${l}</span>`,
  ).join("");
}

const shortName = (n) => n.replace(/^(\w)\w+ /, "$1. ");

// --- table ---

function stateBar(d, w = 120) {
  const n = d3.sum(Object.values(d.states));
  if (!n) return "–";
  let x = 0;
  const parts = STATES.filter(([k]) => d.states[k]).map(([k, l]) => {
    const v = d.states[k],
      ww = (v / n) * w;
    const r = `<rect x="${x.toFixed(1)}" width="${Math.max(0, ww - 1).toFixed(1)}" height="10" rx="1.5" fill="${stateColour(k)}"><title>${l}: ${v}</title></rect>`;
    x += ww;
    return r;
  });
  const title = STATES.filter(([k]) => d.states[k])
    .map(([k, l]) => `${l} ${d.states[k]}`)
    .join(", ");
  return `<svg class="pl-bar" width="${w}" height="10" viewBox="0 0 ${w} 10" role="img" aria-label="${esc(title)}">${parts.join("")}</svg>`;
}
const originChip = (d) => {
  const k = originClass(d);
  return `<span class="pl-chip tl-help" data-tip="${esc((d.answers.origin_like_structure ?? [""])[0])}"><i style="background:${originColour(k)}"></i>${ORIGIN_OF[k].l}</span>`;
};
const COLS = [
  ["name", "Species", (d) => `<i>${esc(d.name)}</i>`, "l"],
  ["group", "Group", (d) => esc(d.group), "l"],
  ["copies", "Copies", (d) => `${d.copies} × ${d.numbers}`, "", "Haplotype copies of each chromosome × chromosome numbers"],
  ["origin", "Reading", originChip, "l", "ploidyspec's answer to whether the duplicated sets interchange (auto-like) or not (allo-like)"],
  ["states", "Chromosome states", (d) => stateBar(d), "l", "The state of each chromosome number, from tetrasomic-like to resolved lineages"],
  ["dup", "Duplicated", (d) => pc(d.homeoFrac), "", "Share of the genome in old duplicated (homeolog) blocks, from the homeology map"],
  ["allelic", "Copies apart", (d) => (d.allelic == null ? "–" : d3.format(".4f")(d.allelic)), "", "Median k-mer distance between copies of the same chromosome"],
  ["fusions", "Fusions", (d) => d.fusions || "–", "", "Chromosome fusions present in some copies and not others"],
  ["lit", "Literature", litShort, "l", "The ploidy level reported in the literature"],
];
function litShort(d) {
  const p = d.lit?.ploidy;
  if (!p) return "–";
  const s = p.replace(/\s*[(;:].*$/, "").replace(/,.*$/, "");
  return s.length <= 26 ? esc(s) : `<span class="tl-help" data-tip="${esc(p)}">${esc(s.slice(0, s.lastIndexOf(" ", 24)))}…</span>`;
}
const SORT = {
  name: (d) => d.name,
  group: (d) => d.group,
  copies: (d) => d.copies * 1000 + d.numbers,
  origin: (d) => ORIGIN_OF[originClass(d)].i,
  states: (d) => (d.states.tetrasomic_like ?? 0) / (d3.sum(Object.values(d.states)) || 1),
  dup: (d) => d.homeoFrac,
  allelic: (d) => d.allelic,
  fusions: (d) => d.fusions,
  lit: (d) => d.lit?.ploidy,
};
function renderTable() {
  const shown = all.filter(
    (d) =>
      !d.parent &&
      (!state.group || d.group === state.group) &&
      (!state.origin || originClass(d) === state.origin),
  );
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
        `<tr data-s="${esc(d.id)}"${d.id === runOf(state.id) ? ' class="on"' : ""}>` +
        COLS.map(([, , f, cls]) => `<td class="${cls ?? ""}">${f(d)}</td>`).join("") +
        "</tr>",
    )
    .join("");
  $("more").hidden = rows.length <= 15;
  $("more").textContent = state.rows < rows.length ? `Show all ${rows.length}` : "Show fewer";
  $("stateKey").innerHTML = STATES.map(
    ([k, l, w]) => `<span class="pl-key tl-help" tabindex="0" data-tip="${esc(w)}"><i style="background:${stateColour(k)}"></i>${l}</span>`,
  ).join("");
}
const runOf = (id) => byId.get(id)?.parent ?? id;

// --- species ---

function open(id, scroll = true) {
  if (!byId.has(id)) return;
  if (runOf(id) !== runOf(state.id)) state.chrom = null;
  if (id !== state.id) zooms.matrix = zooms.windows = d3.zoomIdentity;
  state.id = id;
  if (decodeURIComponent(location.hash.slice(1)) !== id) history.replaceState(null, "", "#" + id);
  renderSpecies();
  renderScatter();
  renderTable();
  if (scroll) $("species").scrollIntoView({ behavior: "smooth", block: "start" });
}

function answersCard(d) {
  return `<div class="pl-answers">${QUESTIONS.map(([k, label]) => {
    const a = d.answers[k];
    if (!a) return "";
    const cls = { high: "pass", medium: "flag", low: "fail" }[a[1]] ?? "tl-tag";
    return `<div class="gs-card pl-answer"><div class="og-cardhead"><h3>${label}</h3><span class="og-badge ${cls} tl-help" tabindex="0" data-tip="${esc(CONF[a[1]] ?? "ploidyspec's confidence in this reading")}">${esc(a[1])}</span></div><p>${esc(a[0])}</p><details><summary>Evidence</summary><p class="gs-note">${esc(a[2])}</p></details></div>`;
  }).join("")}</div>`;
}

function litCard(d) {
  const top = byId.get(runOf(d.id));
  const lit = top.lit,
    note = top.note;
  const bits = [];
  if (lit) {
    const rows = [
      ["Ploidy", lit.ploidy],
      ["Chromosome count", lit.count],
      ["Origin", lit.origin],
      ["Sources", lit.cites],
    ].filter(([, v]) => v);
    bits.push(
      `<dl class="pl-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>`,
    );
  }
  if (note)
    bits.push(
      `<p class="pl-note"><span class="pl-verdict pl-v-${note[0]}">${VERDICT[note[0]]}</span> ${esc(note[1])} <span class="pl-cite">${esc(note[2])}</span></p>`,
    );
  if (top.category)
    bits.push(
      `<p class="gs-note">Our reading, weighing these results against the literature: <b>${esc(top.category)}</b>.</p>`,
    );
  if (!bits.length) bits.push(`<p class="gs-note">No literature on this species' ploidy or origin has been checked yet.</p>`);
  return `<div class="gs-card pl-lit"><h3>What the literature says</h3>${bits.join("")}</div>`;
}

function chromStrip(d, data) {
  if (!data.chroms.length) return "";
  return `<div class="pl-strip" role="group" aria-label="Chromosome numbers">${data.chroms
    .map((c) => {
      const s = STATE[c.copy_state] ?? STATE.not_assessable;
      return `<button type="button" class="pl-chr${c.chrom === state.chrom ? " on" : ""}" data-chrom="${esc(c.chrom)}" style="--c:${stateColour(c.copy_state)}" data-tip="${esc(`Chromosome ${chrLabel(c.chrom)}: ${s.l}. ${chromWhy(c)}`)}">${esc(chrLabel(c.chrom))}</button>`;
    })
    .join("")}</div>`;
}
function chromWhy(c) {
  const out = [];
  if (c.fusion) out.push(`Fusion: ${c.fusion}.`);
  if (c.outlier_hap) out.push(`${c.outlier_hap} stands apart.`);
  if (c.split_segments) out.push(`Split segments: ${c.split_segments}.`);
  if (c.ancient_partner) out.push(`Homeolog partner: chromosome ${chrLabel(c.ancient_partner)}.`);
  if (c.dist_split != null) out.push(`Distance split ${d3.format(".2f")(c.dist_split)}.`);
  if (c.residual_bp) out.push(`Residual tetrasomy over ${mb(c.residual_bp)}.`);
  if (c.state_basis === "homeolog_pool" || c.state_basis === "partition_pool")
    out.push("Read by pooling with its partner chromosome.");
  return out.join(" ");
}

// "HAP1_chr01,HAP2_chr01" -> "HAP1 + HAP2"; keeps the chromosome when the group spans two
function lineage(g) {
  const us = g.split(",").map((u) => u.split("_chr"));
  const one = new Set(us.map((u) => u[1])).size === 1;
  return us.map(([h, c]) => (one ? h : `${h} chr ${chrLabel(c)}`)).join(" + ");
}

function chromDetail(d, data) {
  const c = data.chroms.find((x) => x.chrom === state.chrom);
  if (!c) return "";
  const s = STATE[c.copy_state] ?? STATE.not_assessable;
  const groups =
    c.group_a && c.group_b
      ? `<dt>Lineages</dt><dd>${esc(lineage(c.group_a))} | ${esc(lineage(c.group_b))}${c.state_basis?.endsWith("pool") ? " (pooled with its partner)" : ""}</dd>`
      : "";
  return `<p class="pl-state"><i style="background:${stateColour(c.copy_state)}"></i><b>Chromosome ${esc(chrLabel(c.chrom))}: ${s.l}.</b> ${esc(s.w)}</p>
    <dl class="pl-dl">${groups}${c.dist_split != null ? `<dt>Distance split</dt><dd>${d3.format(".2f")(c.dist_split)} <span class="tl-muted">(between-lineage over within-lineage distance)</span></dd>` : ""}${c.te_split != null ? `<dt>Transposon split</dt><dd>${d3.format(".2f")(c.te_split)}</dd>` : ""}${c.split_segments ? `<dt>Split segments</dt><dd>${esc(c.split_segments)}</dd>` : ""}${c.fusion ? `<dt>Fusion</dt><dd>${esc(c.fusion)}</dd>` : ""}${c.outlier_hap ? `<dt>Copy apart</dt><dd>${esc(c.outlier_hap)}</dd>` : ""}${c.ancient_partner ? `<dt>Homeolog partner</dt><dd>chromosome ${esc(chrLabel(c.ancient_partner))}${c.distance_ratio != null ? `, ${d3.format(".1f")(c.distance_ratio)}× the allelic distance` : ""}</dd>` : ""}${c.residual_bp ? `<dt>Residual tetrasomy</dt><dd>${mb(c.residual_bp)}${c.residual_terminal ? ` (${esc(c.residual_terminal)})` : ""}</dd>` : ""}</dl>`;
}

async function renderSpecies() {
  const d = byId.get(state.id),
    top = byId.get(runOf(state.id));
  const parts = all.filter((x) => x.parent === top.id);
  const tabs = parts.length
    ? `<div class="og-toggle pl-tabs" role="group" aria-label="Run">${[top, ...parts]
        .map(
          (x) =>
            `<button type="button" class="chip" data-run="${esc(x.id)}" aria-pressed="${x.id === d.id}">${esc(x.part ?? "Whole genome")}</button>`,
        )
        .join("")}</div>`
    : "";
  $("species").innerHTML = `
    <header class="og-head">
      <p class="eyebrow">${esc(top.group)}</p>
      <h2><i>${esc(top.name)}</i></h2>
      <p class="og-sub">${esc(d.id)} · ${d.copies} ${d.copies === 1 ? "copy" : "copies"} of ${d.numbers} chromosome numbers · ${mb(d.genome)} per copy · <a href="${REPO}/tree/main/results/${encodeURIComponent(d.id)}">results on GitHub</a></p>
      ${tabs}
    </header>
    <p class="gs-status" id="spLoading">Loading the chromosomes…</p>`;
  // what ploidyspec concludes, and what the literature says: after the figures they rest on
  const verdicts = `<h3 class="pl-subhead">What ploidyspec concludes</h3>${answersCard(d)}${litCard(d)}`;
  let data;
  try {
    data = await load(d.id);
  } catch {
    $("spLoading").outerHTML = `<p class="gs-status">This species' chromosome data could not be loaded just now.</p>${verdicts}`;
    return;
  }
  if (state.id !== d.id) return;
  state.order = state.pref === "pair" && !hasPairs(data) ? "chrom" : state.pref;
  if (!state.chrom || !data.chroms.some((c) => c.chrom === state.chrom)) {
    // start on the most interesting chromosome: the first split one, else the first
    const order = ["fusion_lineages", "partially_resolved", "resolved_lineages", "candidate", "one_divergent_copy", "tetrasomic_like"];
    // the first state on the list that has one; among those, the chromosome with most copies compared
    // among the chromosomes with every pair of copies compared
    const tracks = (c) => data.windows[c.chrom]?.length ?? 0;
    const most = d3.max(data.chroms, tracks) ?? 0;
    const best = order.map((k) => data.chroms.find((c) => c.copy_state === k && most && tracks(c) === most)).find(Boolean);
    state.chrom = best?.chrom ?? Object.keys(data.windows)[0] ?? data.chroms[0]?.chrom ?? null;
  }
  $("spLoading").outerHTML = `
    <div class="pl-figs">
      <div class="gs-card pl-matrixcard">
        <div class="pl-cardhead"><h3>Distance between every pair of chromosome copies</h3>
          <span class="og-toggle"><button type="button" class="chip" data-scheme="contrast" aria-pressed="${state.scheme === "contrast"}" data-tip="Colour stretched over the 2nd to 98th percentile of the distances, as in ploidyspec's contrast heatmaps">Contrast</button><button type="button" class="chip" data-scheme="full" aria-pressed="${state.scheme === "full"}" data-tip="Colour from zero to the largest distance">Full range</button></span>
          <span class="og-toggle">${hasPairs(data) ? `<button type="button" class="chip" data-order="pair" aria-pressed="${state.order === "pair"}" data-tip="Average-linkage clustering of the chromosome numbers, the order ploidyspec's own heatmaps use">Clustered</button>` : ""}<button type="button" class="chip" data-order="chrom" aria-pressed="${state.order === "chrom"}">By chromosome</button><button type="button" class="chip" data-order="hap" aria-pressed="${state.order === "hap"}">By haplotype</button></span></div>
        <div class="pl-matrix" id="figMatrix"></div>
        <div class="pl-legend" id="matrixKey"></div>
        <p class="gs-note">Whole-chromosome k-mer (Mash) distance, on ploidyspec's colour scale: yellow is close, dark blue far. Copies of the same chromosome sit in blocks on the diagonal, and old homeolog pairs show as lighter squares off it; <i>Clustered</i> orders the chromosomes as ploidyspec's own heatmaps do, so related chromosomes sit together. Click a cell to open that chromosome. Hold ctrl or ⌘ and scroll to zoom, drag to pan, double-click to reset.</p>
      </div>
    </div>
    <div class="gs-card pl-chroms" id="chromCard">
      <h3>Chromosome by chromosome</h3>
      <p class="gs-note">Each chromosome number, coloured by its state. Pick one to outline it in the matrix above and see it along its length below.</p>
      ${chromStrip(d, data) || '<p class="gs-note">No per-chromosome states for this assembly.</p>'}
      <div id="chromDetail">${chromDetail(d, data)}</div>
    </div>
    <div class="gs-card pl-wincard" id="winCard">
      <div class="pl-cardhead"><h3 id="winTitle"></h3></div>
      <div class="pl-win" id="figWindows"></div>
      <div class="pl-legend" id="winKey"></div>
      <p class="gs-note" id="winNote"></p>
    </div>
    <div class="gs-card pl-hmcard" id="hmCard">
      <div class="pl-cardhead"><h3>Homeology map</h3></div>
      <p class="gs-note" id="hmNote"></p>
      <div class="pl-hm" id="figHomeology"></div>
    </div>
    ${evidenceCard(d, data)}
    ${fusionCard(d, data)}
    ${verdicts}
    <div class="og-filegrid pl-files">
      <a class="og-file" href="/data/ploidy/${encodeURIComponent(d.id)}.json" download><b>JSON</b>Everything on this card</a>
      <a class="og-file" href="${REPO}/blob/main/results/${encodeURIComponent(d.id)}/summary.md"><b>MD</b>ploidyspec's summary</a>
      <a class="og-file" href="${REPO}/blob/main/results/${encodeURIComponent(d.id)}/matrix/whole_chrom_pairs.tsv"><b>TSV</b>Whole-chromosome distances</a>
      <a class="og-file" href="${REPO}/blob/main/results/${encodeURIComponent(d.id)}/rediploidization/rediploidization_by_chrom.tsv"><b>TSV</b>States by chromosome</a>
    </div>`;
  panel = { d, data };
  drawMatrix();
  drawWindows();
  drawHomeology();
  drawFusions();
}

// --- rediploidisation evidence ---

// "HAP1:51.0-56.2Mb(end)~chr29;..." and "HAP1:0.0-33.2Mb~HAP2;33.3-37.7Mb~HAP4|HAP2:..."
function parseSegs(str) {
  const out = [];
  for (const part of String(str ?? "").split("|")) {
    let hap = null;
    for (const m of part.matchAll(/(?:(HAP\w+):)?([\d.]+)-([\d.]+)Mb(?:\((\w+)\))?(?:~(\w+))?/g)) {
      hap = m[1] ?? hap;
      out.push({ hap, s: +m[2] * 1e6, e: +m[3] * 1e6, pos: m[4] ?? null, to: m[5] ?? null });
    }
  }
  return out;
}
const SPLIT_MIN = 1.25,
  TE_MIN = 2;
// rediploidization.copy_state: a windowed segment counts only for a balanced split (two lineages of
// equal size); one copy apart in some region is ordinary haplotype structure in a polysomic genome
const balanced = (c) => c.group_a && c.group_b && c.group_a.split(",").length === c.group_b.split(",").length;
const windowCounts = (c) => /whole|regional/.test(c.split_extent ?? "") && balanced(c);
const pooled = (c) => c.state_basis === "homeolog_pool" || c.state_basis === "partition_pool";
const hasEvidence = (c) =>
  (c.state_basis === "copies" && (c.dist_split >= SPLIT_MIN || c.te_split >= TE_MIN || windowCounts(c))) ||
  c.fusion || c.lineage_switches || c.residual_bp > 0 || c.exchange_bp > 0;

// a mark per test: filled when it passed, hollow when tested and not passed
const mark = (on, text, tip) =>
  `<span class="pl-ev${on ? " on" : ""}"${tip ? ` data-tip="${esc(tip)}"` : ""}><i aria-hidden="true"></i>${text}</span>`;
const none = `<span class="tl-muted">–</span>`;
const partnersOf = (c) =>
  (c.block_partners ?? "")
    .split(",")
    .filter(Boolean)
    .map((p) => p.split(":"))
    .map(([ch, mbs]) => `${chrLabel(ch)}${mbs ? ` <span class="tl-muted">${esc(mbs.replace("Mb", " Mb"))}</span>` : ""}`);

const EV_COLS = [
  {
    k: "basis",
    label: "Read from",
    tip: "What the state was read from: the chromosome's own three or more copies; copies pooled with a homeolog partner (two-copy assemblies), which does not separate allopolyploidy from an old, rediploidised autopolyploid; or a confirmed fusion.",
    show: () => true,
    cell: (c) =>
      c.state_basis === "copies"
        ? "own copies"
        : c.state_basis === "fusion"
          ? "fusion"
          : pooled(c)
            ? `<span class="tl-help" data-tip="Pooled with chromosome ${esc(chrLabel(c.pooled_with ?? c.ancient_partner ?? ""))}: any two different chromosomes look split this way, so the state alone is not evidence.">pooled with ${esc(chrLabel(c.pooled_with ?? c.ancient_partner ?? "?"))}</span>`
            : none,
  },
  {
    k: "dist",
    label: "Distance split",
    tip: `Between-lineage over within-lineage distance of the copies. Counts at ${SPLIT_MIN} or more, read from the chromosome's own copies.`,
    show: (cs) => cs.some((c) => c.state_basis === "copies"),
    cell: (c) =>
      c.dist_split == null || c.state_basis !== "copies"
        ? none
        : mark(c.dist_split >= SPLIT_MIN, d3.format(".2f")(c.dist_split)),
  },
  {
    k: "te",
    label: "Transposon split",
    tip: `Whether the copies' transposon markers follow the same lineages. Counts at ${TE_MIN} or more.`,
    show: (cs) => cs.some((c) => c.state_basis === "copies" && c.te_split != null),
    cell: (c) => (c.te_split == null || c.state_basis !== "copies" ? none : mark(c.te_split >= TE_MIN, d3.format(".2f")(c.te_split))),
  },
  {
    k: "win",
    label: "Along the chromosome",
    tip: "Share of the chromosome in split segments (bar; the red tick is the chance level, from splits that cut across the lineages). Counts as whole or regional when it beats chance and the copies split into two even lineages; a segment isolating one copy is not counted.",
    show: (cs) => cs.some((c) => c.window_covered != null && c.state_basis === "copies"),
    cell: (c) => {
      if (c.window_covered == null || c.state_basis !== "copies") return none;
      const seg = /whole|regional/.test(c.split_extent ?? ""),
        on = windowCounts(c);
      const w = 44,
        f = Math.min(1, c.window_covered),
        q = Math.min(1, c.window_null_q95 ?? 0);
      return `<span class="pl-ev${on ? " on" : ""}" data-tip="${esc(`${pc(c.window_covered)} of the chromosome in split segments; chance level ${pc(c.window_null_q95)}`)}"><svg width="${w}" height="8" aria-hidden="true"><rect width="${w}" height="8" rx="2" class="pl-evbg"/><rect width="${(f * w).toFixed(1)}" height="8" rx="2" class="pl-evfg"/><rect x="${(q * w - 0.75).toFixed(1)}" width="1.5" height="8" class="pl-evq"/></svg>${on ? esc(c.split_extent) : seg ? `${esc(c.split_extent)}, one copy <span class="tl-muted">(not counted)</span>` : "none"}</span>`;
    },
  },
  {
    k: "fusion",
    label: "Fusion",
    tip: "Fused with another chromosome in some copies and not others, which splits the copies into a fused and an unfused lineage.",
    show: (cs) => cs.some((c) => c.fusion),
    cell: (c) => {
      if (!c.fusion) return none;
      const other = (c.fusion.match(/chr\d+/) ?? [""])[0];
      const k = [c.chrom, other].sort().join("-");
      return mark(true, `<a href="#fusion-${esc(k)}" data-fusion="${esc(k)}">${esc(c.fusion.replace(/chr0*/g, "").replace(/,/g, ", "))}</a>`);
    },
  },
  {
    k: "switch",
    label: "Lineage switches",
    tip: "Copies that belong to one lineage along part of the chromosome and another elsewhere: an exchange between copies, or a phasing switch in the assembly.",
    show: (cs) => cs.some((c) => c.lineage_switches),
    cell: (c) => {
      if (!c.lineage_switches) return none;
      const n = new Set(parseSegs(c.lineage_switches).map((x) => x.hap)).size;
      return mark(true, `${n} ${n === 1 ? "copy" : "copies"}`);
    },
  },
  {
    k: "resid",
    label: "Residual tetrasomy",
    tip: "Stretches where this chromosome and its homeolog partner are still as close as alleles: the duplicate has not finished rediploidising there. Needs more than half the copies to agree.",
    show: (cs) => cs.some((c) => c.residual_support),
    cell: (c) => {
      if (!c.residual_support) return none;
      const on = c.residual_bp > 0;
      const term = c.residual_terminal_bp ? `, ${pc(c.residual_terminal_bp / c.residual_bp)} at the ends` : "";
      return mark(on, on ? mb(c.residual_bp) : "none", `Support ${c.residual_support.replace(/chr0*/g, "chromosome ")}${on ? term : ""}`);
    },
  },
  {
    k: "exch",
    label: "Homeologous exchange",
    tip: "Stretches where a copy carries its homeolog's sequence instead of its own: an exchange between homeologs, or a contig placed on the wrong chromosome.",
    show: (cs) => cs.some((c) => c.exchange_support || c.exchange_bp),
    cell: (c) =>
      c.exchange_bp > 0
        ? mark(true, `${mb(c.exchange_bp)} <span class="tl-muted">with ${esc([...new Set(parseSegs(c.exchange_segments).map((x) => chrLabel(x.to)))].join(", "))}</span>`)
        : c.residual_support
          ? mark(false, "none")
          : none,
  },
  {
    k: "partners",
    label: "Homeolog blocks with",
    tip: "Other chromosomes this one shares homeolog blocks with in the homeology map, with the block length. Several partners mean rearrangements since the duplication.",
    show: (cs) => cs.some((c) => c.block_partners || c.ancient_partner),
    cell: (c) => {
      const p = partnersOf(c);
      return p.length ? p.slice(0, 3).join(", ") + (p.length > 3 ? ` <span class="tl-muted">+${p.length - 3}</span>` : "") : c.ancient_partner ? esc(chrLabel(c.ancient_partner)) : none;
    },
  },
];

function evidenceCard(d, data) {
  const cs = data.chroms;
  if (!cs.length) return "";
  const cols = EV_COLS.filter((col) => col.show(cs));
  const n = cs.filter(hasEvidence).length;
  const only = state.evOnly ?? cs.length > 20;
  const rows = only ? cs.filter(hasEvidence) : cs;
  const body = rows
    .map((c) => {
      const s = STATE[c.copy_state] ?? STATE.not_assessable;
      return `<tr data-chrom="${esc(c.chrom)}" tabindex="0"${c.chrom === state.chrom ? ' class="on"' : ""}><td class="l"><span class="pl-evstate${pooled(c) ? " pooled" : ""}" style="--c:${stateColour(c.copy_state)}" data-tip="${esc(`${s.l}. ${s.w}`)}"><b>${esc(chrLabel(c.chrom))}</b>${esc(s.l)}</span></td>${cols.map((col) => `<td class="l">${col.cell(c)}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<div class="gs-card pl-evcard" id="evCard">
    <div class="pl-cardhead"><h3>Evidence for rediploidisation</h3>${cs.length > 1 ? `<button type="button" class="chip" data-evonly aria-pressed="${only}">Only chromosomes with evidence (${n})</button>` : ""}</div>
    <p class="gs-note">Each line of evidence ploidyspec weighs, chromosome by chromosome. A filled mark passed its test, a hollow one was tested and did not; a dash was not tested. Hatched states were read by pooling with a homeolog partner, which on its own is not evidence of rediploidisation: there, residual tetrasomy and exchange are what count. Click a row to open that chromosome.</p>
    <div class="gs-tablewrap"><table class="gs-table pl-evtable"><thead><tr><th class="l">Chromosome, state</th>${cols.map((col) => `<th class="l"><span class="tl-help" data-tip="${esc(col.tip)}">${col.label}</span></th>`).join("")}</tr></thead><tbody>${body || `<tr><td class="l" colspan="${cols.length + 1}"><span class="tl-muted">No chromosome passes any test.</span></td></tr>`}</tbody></table></div>
  </div>`;
}

// --- fusions ---

const fusedOnly = (data) => data.fusions.filter((f) => f.status === "fusion");
function fusionCard(d, data) {
  const fs = fusedOnly(data);
  if (!fs.length) return "";
  const groups = d3.groups(fs, (f) => f.components);
  return `<div class="gs-card pl-fuscard" id="fusCard">
    <div class="pl-cardhead"><h3>Chromosome fusions</h3></div>
    <p class="gs-note">${groups.length} fusion${groups.length === 1 ? "" : "s"} where two chromosomes are joined in some copies and separate in others. Each panel is one <b>fused copy</b>, read along its own length:</p>
    <ul class="pl-howto">
      <li><b>x</b>: position along the fused copy, in Mb. The bar on top shows which part comes from which chromosome, and the red dashed line is the junction.</li>
      <li><b>Dots</b>: each 250 kb window of the fused copy, looked up in the <b>unfused copies</b> (named under each panel); the k-mer distance to the closest one (<b>y</b>), coloured by the chromosome it matched.</li>
      <li><b>Grey line</b>: the same window's distance to the <b>other fused copy</b>, the baseline within the fused lineage.</li>
      <li><b>Shaded bands</b>: the windows nearest the junction and at the far ends of each arm (inner and outer 20%). Their medians (short black lines) give the near-junction to arm-end ratio. Above 1, the fused copies have drifted from the unfused ones most at the junction, where recombination between them stopped first, as Xie et al. (2026) found in snow carps.</li>
    </ul>
    ${groups
      .map(([k, copies]) => {
        const [a, b] = k.split("+");
        const g = d3.mean(copies, (f) => f.junction_gradient),
          nj = d3.mean(copies, (f) => f.near_junction_div),
          ae = d3.mean(copies, (f) => f.arm_end_div);
        const verdict =
          g == null
            ? ""
            : g > 1.2
              ? `Divergence from the unfused copies is ${d3.format(".1f")(g)}× higher near the junction (${d3.format(".4f")(nj)}) than at the arm ends (${d3.format(".4f")(ae)}): highest at the fusion site.`
              : g < 0.83
                ? `Divergence from the unfused copies is lower near the junction (${d3.format(".4f")(nj)}) than at the arm ends (${d3.format(".4f")(ae)}), a ratio of ${d3.format(".2f")(g)}: not highest at the fusion site.`
                : `Divergence from the unfused copies is about even along the arms (${d3.format(".4f")(nj)} near the junction, ${d3.format(".4f")(ae)} at the ends).`;
        return `<div class="pl-fusion" id="fusion-${esc(k.replace("+", "-"))}">
          <h4>Chromosomes ${esc(chrLabel(a))} + ${esc(chrLabel(b))} <span class="tl-muted">· fused in ${esc(copies.map((f) => f.hap).join(" and "))}</span></h4>
          <p class="gs-note">${verdict}${copies[0].lineage_divergence ? ` Fused and unfused lineages differ by ${esc(copies[0].lineage_divergence.split(",").map((x) => x.split(":")).map(([c, v]) => `${d3.format(".4f")(+v)} on ${chrLabel(c)}`).join(" and "))}.` : ""}</p>
          <div class="pl-fusgrid">${copies.map((f) => `<div class="pl-fuspanel" data-scaffold="${esc(f.scaffold)}"></div>`).join("")}</div>
        </div>`;
      })
      .join("")}
  </div>`;
}

function drawFusions() {
  const { data } = panel;
  const fs = fusedOnly(data);
  if (!fs.length) return;
  const all = fs.flatMap((f) => (f.profile ?? []).flatMap((p) => [p[2], p[3]])).filter((v) => v >= 0);
  const ymax = (d3.quantile(all.sort(d3.ascending), 0.99) ?? 1e4) * 1.08;
  const ink2 = css("--ink-2"),
    ink3 = css("--ink-3"),
    rule = css("--rule"),
    surface = css("--surface");
  const partCol = [css("--p0"), css("--p1")];
  for (const f of fs) {
    const el = document.querySelector(`.pl-fuspanel[data-scaffold="${CSS.escape(f.scaffold)}"]`);
    if (!el) continue;
    const prof = f.profile ?? [];
    const [ca, cb] = f.components.split("+");
    const left = prof[0]?.[1] ?? ca,
      right = left === ca ? cb : ca;
    const col = (c) => (c === left ? partCol[0] : partCol[1]);
    // the unfused copies each window was compared with, and the other fused copies
    const fusedHaps = new Set(fs.filter((g) => g.components === f.components).map((g) => g.hap));
    const unfused = (c) =>
      data.units.filter((u) => u[2] === +chrLabel(c) && !fusedHaps.has(u[1])).map((u) => u[1]);
    const sibs = [...fusedHaps].filter((h) => h !== f.hap);
    const W = Math.max(300, el.clientWidth),
      H = 196,
      m = { l: 52, r: 26, t: 34, b: 38 };
    const x = d3.scaleLinear().domain([0, f.length]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, ymax]).range([H - m.b, m.t + 8]);
    const J = (f.junction_mb ?? 0) * 1e6;
    const svg = d3
      .create("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", W)
      .attr("height", H)
      .attr("role", "img")
      .attr("aria-label", `Fused copy ${f.hap}: chromosomes ${chrLabel(left)} and ${chrLabel(right)} joined at ${f.junction_mb} Mb, with divergence along it`);
    svg.append("text").attr("x", m.l).attr("y", 11).attr("font-size", 11).attr("font-weight", 600).attr("fill", ink2).text(`${f.hap}`);
    svg
      .append("text")
      .attr("x", W - m.r)
      .attr("y", 11)
      .attr("text-anchor", "end")
      .attr("font-size", 10)
      .attr("fill", ink3)
      .text(`${f.scaffold} · ${mb(f.length)}${f.origin === "placed_long_copy" ? " · assembled as chromosome " + chrLabel(f.scaffold.split("_chr")[1] ?? "") : ""}`);
    // the fused copy: two parts and the junction
    const bar = svg.append("g").attr("transform", `translate(0,17)`);
    for (const [c, s0, s1] of [[left, 0, J], [right, J, f.length]]) {
      bar.append("rect").attr("x", x(s0)).attr("width", Math.max(0, x(s1) - x(s0))).attr("height", 12).attr("fill", col(c)).attr("rx", 2);
      if (x(s1) - x(s0) > 50)
        bar
          .append("text")
          .attr("x", (x(s0) + x(s1)) / 2)
          .attr("y", 6)
          .attr("dy", "0.35em")
          .attr("text-anchor", "middle")
          .attr("font-size", 9.5)
          .attr("font-weight", 600)
          .attr("fill", "#fff")
          .text(`chromosome ${chrLabel(c)}`);
    }
    // axes
    svg
      .append("g")
      .attr("transform", `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(3).tickFormat((v) => d3.format(".3~f")(v / 1e5)).tickSize(-(W - m.l - m.r)))
      .call((g) => g.select(".domain").remove())
      .call((g) => g.selectAll(".tick line").attr("stroke", rule).attr("stroke-opacity", 0.7))
      .call((g) => g.selectAll("text").attr("fill", ink3).attr("font-size", 9.5));
    svg
      .append("g")
      .attr("transform", `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, W / 70)).tickFormat((v) => d3.format("~g")(v / 1e6)))
      .call((g) => g.select(".domain").attr("stroke", rule))
      .call((g) => g.selectAll(".tick line").attr("stroke", rule))
      .call((g) => g.selectAll("text").attr("fill", ink3).attr("font-size", 9.5));
    svg
      .append("text")
      .attr("x", (m.l + W - m.r) / 2)
      .attr("y", H - 6)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", ink3)
      .text(`Position along ${f.hap}'s fused copy (Mb)`);
    svg
      .append("text")
      .attr("transform", `translate(11,${(m.t + 8 + H - m.b) / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("fill", ink3)
      .text("k-mer distance");
    // junction
    svg
      .append("line")
      .attr("x1", x(J))
      .attr("x2", x(J))
      .attr("y1", 14)
      .attr("y2", H - m.b)
      .attr("stroke", "#d13b3a")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4 3");
    const pts = prof.map((p) => ({ x: (p[0] + 0.5) * 250000, c: p[1], du: p[2], df: p[3] }));
    // near-junction (inner 20%) and arm-end (outer 20%) windows of each arm, with their medians
    const bands = [
      [0, 0.2 * J, "end"],
      [0.8 * J, J, "near"],
      [J, J + 0.2 * (f.length - J), "near"],
      [f.length - 0.2 * (f.length - J), f.length, "end"],
    ];
    const bandG = svg.append("g");
    for (const [b0, b1, kind] of bands) {
      bandG
        .append("rect")
        .attr("x", x(b0))
        .attr("width", Math.max(0, x(b1) - x(b0)))
        .attr("y", m.t + 8)
        .attr("height", H - m.b - m.t - 8)
        .attr("fill", kind === "near" ? "#d13b3a" : ink3)
        .attr("fill-opacity", kind === "near" ? 0.08 : 0.07);
      const med = d3.median(pts.filter((p) => p.x >= b0 && p.x < b1 && p.du >= 0), (p) => p.du);
      if (med != null)
        bandG
          .append("line")
          .attr("x1", x(b0) + 2)
          .attr("x2", x(b1) - 2)
          .attr("y1", y(med))
          .attr("y2", y(med))
          .attr("stroke", css("--ink"))
          .attr("stroke-width", 2);
    }
    for (const [cx, txt] of [[(x(0.8 * J) + x(J + 0.2 * (f.length - J))) / 2, "near junction"], [(x(0) + x(0.2 * J)) / 2, "arm end"], [(x(f.length - 0.2 * (f.length - J)) + x(f.length)) / 2, "arm end"]])
      bandG.append("text").attr("x", cx).attr("y", m.t + 17).attr("text-anchor", "middle").attr("font-size", 9).attr("fill", ink3).text(txt);
    svg
      .append("path")
      .attr("fill", "none")
      .attr("stroke", ink3)
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.8)
      .attr(
        "d",
        d3
          .line()
          .defined((p) => p.df >= 0)
          .x((p) => x(p.x))
          .y((p) => y(Math.min(p.df, ymax)))(pts),
      );
    svg
      .append("g")
      .selectAll("circle")
      .data(pts.filter((p) => p.du >= 0))
      .join("circle")
      .attr("cx", (p) => x(p.x))
      .attr("cy", (p) => y(Math.min(p.du, ymax)))
      .attr("r", 2.2)
      .attr("fill", (p) => col(p.c))
      .attr("stroke", surface)
      .attr("stroke-width", 0.5);
    svg
      .append("rect")
      .attr("x", m.l)
      .attr("y", 14)
      .attr("width", W - m.l - m.r)
      .attr("height", H - m.b - 14)
      .attr("fill", "transparent")
      .on("mousemove", (e) => {
        const [px] = d3.pointer(e);
        const pos = x.invert(px),
          p = pts[Math.max(0, Math.min(pts.length - 1, Math.floor(pos / 250000)))];
        if (!p) return hideTip();
        showTip(
          `<b>${esc(f.hap)}, ${d3.format(".2f")((p.x - 125000) / 1e6)} Mb</b> · chromosome ${chrLabel(p.c)} part${Math.abs(pos - J) < 1e6 ? " · at the junction" : ""}<br>to the closest unfused copy: ${dist(p.du)}<br>to the other fused copy: ${dist(p.df)}`,
          e.clientX,
          e.clientY,
        );
      })
      .on("mouseleave", hideTip);
    const key = document.createElement("p");
    key.className = "pl-fuskey";
    key.innerHTML = `<span><i style="background:${col(left)}"></i>vs unfused chromosome ${esc(chrLabel(left))} (${esc(unfused(left).join(", ") || "–")})</span><span><i style="background:${col(right)}"></i>vs unfused chromosome ${esc(chrLabel(right))} (${esc(unfused(right).join(", ") || "–")})</span>${sibs.length ? `<span><i class="ln"></i>vs the other fused copy (${esc(sibs.join(", "))})</span>` : `<span class="tl-muted">no other fused copy to compare with</span>`}`;
    el.replaceChildren(svg.node(), key);
  }
}

// --- matrix ---

// ploidyspec's ordering (whole_matrix.average_linkage_order on homeologs.cross_chrom_distances):
// average-linkage clustering of the chromosome numbers, each the mean over all its copy pairs
function pairRank(data) {
  const units = data.units,
    n = units.length;
  const nums = [...new Set(units.map((u) => u[2]))].sort((a, b) => a - b);
  const at = new Map(nums.map((c, i) => [c, i]));
  const m = nums.length;
  const sum = Array.from({ length: m }, () => new Float64Array(m)),
    cnt = Array.from({ length: m }, () => new Float64Array(m));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = at.get(units[i][2]),
        b = at.get(units[j][2]),
        v = data.matrix[tri(n, i, j)];
      if (a === b || v < 0) continue;
      sum[a][b] += v;
      sum[b][a] += v;
      cnt[a][b]++;
      cnt[b][a]++;
    }
  const dist = new Map();
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let a = 0; a < m; a++) for (let b = a + 1; b < m; b++) dist.set(key(a, b), cnt[a][b] ? sum[a][b] / cnt[a][b] : 1e9);
  const size = new Map(nums.map((_, i) => [i, 1])),
    children = new Map();
  let active = nums.map((_, i) => i),
    next = m;
  while (active.length > 1) {
    let best = null;
    for (let ii = 0; ii < active.length; ii++)
      for (let jj = ii + 1; jj < active.length; jj++) {
        const d = dist.get(key(active[ii], active[jj]));
        if (!best || d < best[0]) best = [d, active[ii], active[jj]];
      }
    const [, a, b] = best,
      na = size.get(a),
      nb = size.get(b);
    for (const c of active)
      if (c !== a && c !== b) dist.set(key(next, c), (na * dist.get(key(a, c)) + nb * dist.get(key(b, c))) / (na + nb));
    size.set(next, na + nb);
    children.set(next, [a, b]);
    active = active.filter((c) => c !== a && c !== b).concat([next]);
    next++;
  }
  const rank = new Map();
  const visit = (node) => {
    if (node < m) rank.set(nums[node], rank.size);
    else children.get(node).forEach(visit);
  };
  if (m) visit(active[0]);
  return rank;
}
const hasPairs = (data) => new Set(data.units.map((u) => u[2])).size >= 3;

function matrixOrder(units) {
  const idx = units.map((u, i) => i);
  if (state.order === "hap")
    idx.sort((a, b) => d3.ascending(units[a][1], units[b][1]) || units[a][2] - units[b][2]);
  else if (state.order === "pair") {
    const rank = pairRank(panel.data);
    idx.sort((a, b) => rank.get(units[a][2]) - rank.get(units[b][2]) || d3.ascending(units[a][1], units[b][1]));
  }
  return idx;
}
const tri = (n, i, j) => {
  if (i > j) [i, j] = [j, i];
  return i * n - (i * (i + 1)) / 2 + (j - i - 1);
};

// ctrl/cmd + wheel (or a pinch) zooms; drag pans once zoomed; double-click resets
const zoomFilter = (e) => (e.type === "wheel" ? e.ctrlKey || e.metaKey : !e.button && e.type !== "dblclick");
const zooms = { matrix: d3.zoomIdentity, windows: d3.zoomIdentity };
// gentler than d3's default, which multiplies ctrl + wheel by ten (for pinches)
const zoomDelta = (e) => -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) * (e.ctrlKey ? 3 : 1);

function drawMatrix() {
  const { data } = panel;
  const el = $("figMatrix");
  const units = data.units,
    n = units.length;
  const get = (i, j) => (i === j ? 0 : data.matrix[tri(n, i, j)]);
  // contrast as ploidyspec's chromosome-number heatmap: the range of distances between
  // different chromosome numbers (copies of the same number fall below it, in yellow)
  const between = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (units[i][2] !== units[j][2]) between.push(get(i, j));
  const [lo, hi] = scaleRange(between.length ? between : data.matrix);
  const colour = heat(lo, hi);
  const order = matrixOrder(units);
  const pairSet = new Set(data.pairs.map((p) => [p.chrom_a, p.chrom_b].sort().join("|")));
  const L = 34,
    T = 4,
    S = Math.min(560, Math.max(260, el.clientWidth - L - 8));
  const cell = S / n;
  // one pixel per cell, scaled up without smoothing
  const off = document.createElement("canvas");
  off.width = off.height = n;
  const octx = off.getContext("2d");
  const selfColour = css("--surface"),
    paper2 = css("--paper-2");
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      const i = order[a],
        j = order[b];
      const v = get(i, j);
      octx.fillStyle = i === j ? selfColour : v < 0 ? paper2 : colour(Math.max(v, lo));
      octx.fillRect(b, a, 1, 1);
    }
  const key = (u) => (state.order === "hap" ? u[1] : u[2]);
  const runs = [];
  order.forEach((i, a) => {
    const k = key(units[i]);
    if (!runs.length || runs.at(-1).k !== k) runs.push({ k, a0: a, a1: a });
    else runs.at(-1).a1 = a;
  });
  const sel = state.chrom ? +chrLabel(state.chrom) : null;
  const dpr = devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  const CW = L + S + 4,
    CH = T + S + 30;
  canvas.width = CW * dpr;
  canvas.height = CH * dpr;
  canvas.style.width = `${CW}px`;
  canvas.style.height = `${CH}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", `Heatmap of the k-mer distance between all ${n} chromosome copies`);
  const ctx = canvas.getContext("2d");
  const ink3 = css("--ink-3"),
    surface = css("--surface"),
    gold = css("--gold");
  const render = (t) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CW, CH);
    const px = (a) => t.applyX(L + a * cell),
      py = (a) => t.applyY(T + a * cell);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, T, S, S);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, px(0), py(0), S * t.k, S * t.k);
    ctx.strokeStyle = surface;
    ctx.lineWidth = n / t.k > 60 ? 0.6 : 1;
    for (const r of runs.slice(1)) {
      ctx.beginPath();
      ctx.moveTo(L, py(r.a0));
      ctx.lineTo(L + S, py(r.a0));
      ctx.moveTo(px(r.a0), T);
      ctx.lineTo(px(r.a0), T + S);
      ctx.stroke();
    }
    if (sel != null) {
      // the selected chromosome's rows and columns: a white line edged in red, visible on any colour
      const spans = [];
      let a0 = null;
      order.concat([-1]).forEach((i, a) => {
        const on = i >= 0 && units[i][2] === sel;
        if (on && a0 == null) a0 = a;
        if (!on && a0 != null) spans.push([a0, a]), (a0 = null);
      });
      for (const [w, c] of [[7, "#d13b3a"], [3.5, "#fff"]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        for (const [s0, s1] of spans) {
          ctx.strokeRect(L, py(s0), S, py(s1) - py(s0));
          ctx.strokeRect(px(s0), T, px(s1) - px(s0), S);
        }
      }
    }
    ctx.restore();
    ctx.fillStyle = ink3;
    ctx.font = "10.5px Inter, system-ui, sans-serif";
    const every = Math.ceil(12 / ((S * t.k) / runs.length || 1));
    runs.forEach((r, i) => {
      if (i % every) return;
      const mid = (r.a0 + r.a1 + 1) / 2;
      const lab = state.order === "hap" ? r.k : chrLabel(r.k);
      const yy = py(mid),
        xx = px(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      if (yy >= T && yy <= T + S) ctx.fillText(lab, L - 4, yy);
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      if (xx >= L && xx <= L + S) ctx.fillText(lab, xx, T + S + 4);
    });
    ctx.textAlign = "center";
    ctx.fillText(state.order === "hap" ? "haplotype" : "chromosome", L + S / 2, T + S + 17);
  };
  el.replaceChildren(canvas);
  const z = d3
    .zoom()
    .filter(zoomFilter)
    .wheelDelta(zoomDelta)
    .scaleExtent([1, Math.max(2, n / 4)])
    .extent([[L, T], [L + S, T + S]])
    .translateExtent([[L, T], [L + S, T + S]])
    .on("zoom", (e) => {
      zooms.matrix = e.transform;
      hideTip();
      render(e.transform);
    });
  const sel3 = d3.select(canvas).call(z).on("dblclick.zoom", null);
  sel3.call(z.transform, zooms.matrix);
  canvas.ondblclick = () => sel3.transition().duration(300).call(z.transform, d3.zoomIdentity);
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    const X = zooms.matrix.invertX(e.clientX - r.left),
      Y = zooms.matrix.invertY(e.clientY - r.top);
    if (e.clientX - r.left < L || e.clientY - r.top > T + S) return null;
    const b = Math.floor((X - L) / cell),
      a = Math.floor((Y - T) / cell);
    return a >= 0 && b >= 0 && a < n && b < n ? [order[a], order[b]] : null;
  };
  canvas.onmousemove = (e) => {
    if (e.buttons) return;
    const p = at(e);
    if (!p) return hideTip();
    const [i, j] = p,
      ua = units[i],
      ub = units[j];
    const rel =
      i === j
        ? "the same copy"
        : ua[2] === ub[2]
          ? "two copies of the same chromosome"
          : pairSet.has([`chr${String(ua[2]).padStart(2, "0")}`, `chr${String(ub[2]).padStart(2, "0")}`].sort().join("|"))
            ? "an accepted homeolog pair"
            : "different chromosomes";
    showTip(
      `<b>${esc(ua[1])} chr ${chrLabel(ua[2])} × ${esc(ub[1])} chr ${chrLabel(ub[2])}</b><br>${i === j ? "" : `distance ${dist(get(i, j))}<br>`}<span>${rel}</span>`,
      e.clientX,
      e.clientY,
    );
  };
  canvas.onmouseleave = hideTip;
  canvas.onclick = (e) => {
    if (e.defaultPrevented) return;
    const p = at(e);
    if (!p) return;
    const c = data.chroms.find((x) => +chrLabel(x.chrom) === units[p[0]][2]);
    if (c) selectChrom(c.chrom, el);
  };
  legend($("matrixKey"), colour, lo, hi, "Distance, whole chromosome");
}

function legend(el, colour, lo, hi, label) {
  const W = 220,
    stops = d3.range(0, 1.0001, 0.05).map((t) => `<stop offset="${t}" stop-color="${colour(hi + t * (lo - hi))}"/>`);
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  el.innerHTML = `<span>${label}</span><svg width="${W}" height="12" aria-hidden="true"><defs><linearGradient id="${id}">${stops.join("")}</linearGradient></defs><rect width="${W}" height="12" rx="2" fill="url(#${id})"/></svg><span class="pl-ends"><span>${dist(hi)}${state.scheme === "contrast" ? " or more" : ""}</span><span>${dist(lo)}${state.scheme === "contrast" ? " or less" : ""}</span></span>`;
}

// anchor: the element clicked, kept still on screen while the chromosome details above it
// change height
function selectChrom(chrom, anchor) {
  if (chrom !== state.chrom) zooms.windows = d3.zoomIdentity;
  state.chrom = chrom;
  const { d, data } = panel;
  const y0 = anchor?.getBoundingClientRect().top;
  $("chromDetail").innerHTML = chromDetail(d, data);
  for (const b of document.querySelectorAll(".pl-chr, .pl-evtable tr[data-chrom]")) b.classList.toggle("on", b.dataset.chrom === chrom);
  drawMatrix();
  drawWindows();
  drawHomeology();
  // instant: the site scrolls smoothly by default, which would show the jump being undone
  if (anchor) window.scrollBy({ top: anchor.getBoundingClientRect().top - y0, behavior: "instant" });
}

// --- along the chromosome ---

function drawWindows() {
  const { d, data } = panel;
  const el = $("figWindows"),
    c = data.chroms.find((x) => x.chrom === state.chrom);
  const tracks = data.windows[state.chrom];
  $("winTitle").textContent = state.chrom ? `Chromosome ${chrLabel(state.chrom)}, along its length` : "Along the chromosome";
  if (!tracks?.length) {
    el.innerHTML = "";
    $("winKey").innerHTML = "";
    $("winNote").textContent =
      d.copies < 2
        ? "This assembly has one copy of each chromosome, so there is nothing to compare along it."
        : "No windowed comparison for this chromosome.";
    return;
  }
  const step = data.step || 250000;
  const ga = new Set((c?.group_a ?? "").split(",")),
    gb = new Set((c?.group_b ?? "").split(","));
  const lin = (u) => (ga.has(u) ? "a" : gb.has(u) ? "b" : "");
  const kind = (t) => {
    const la = lin(t[0]),
      lb = lin(t[1]);
    return !la || !lb ? 1 : la === lb ? 0 : 2;
  };
  const rows = tracks.slice().sort((p, q) => kind(p) - kind(q) || d3.ascending(p[0], q[0]) || d3.ascending(p[1], q[1]));
  const [lo, hi] = scaleRange(Object.values(data.windows).flatMap((ts) => ts.flatMap((t) => t[2])));
  const colour = heat(lo, hi);
  const hasGroups = c?.group_a && c?.group_b && c.state_basis === "copies";
  const L = hasGroups ? 186 : 128,
    R = 30,
    rowH = rows.length > 8 ? 12 : 16,
    gap = 6;
  const W = Math.max(420, el.clientWidth);
  const maxLen = d3.max(rows, (t) => t[2].length) * step;
  const x0 = d3.scaleLinear().domain([0, maxLen]).range([L, W - R]);
  const kinds = hasGroups ? [...new Set(rows.map(kind))] : [1];
  let y = 4;
  const ys = rows.map((t, i) => {
    if (hasGroups && i && kind(rows[i - 1]) !== kind(t)) y += gap;
    const r = y;
    y += rowH;
    return r;
  });
  const anchor = Object.entries(data.homeology).find(([, v]) => v.chrom === state.chrom);
  // annotation tracks: one per kind of evidence along this chromosome
  const hapCol = (h) => css(`--p${(+String(h).replace(/\D/g, "") || 1) - 1}`);
  const lanes = [];
  const split = parseSegs(c?.split_segments);
  if (split.length) lanes.push({ label: "split segments", items: split.map((x) => ({ ...x, col: css("--gold"), tip: `${x.hap}: split from the other lineage` })) });
  const resid = parseSegs(c?.residual_segments);
  if (resid.length)
    lanes.push({ label: "residual tetrasomy", items: resid.map((x) => ({ ...x, col: css("--p7"), tip: `${x.hap}: still as close as alleles to chromosome ${chrLabel(x.to)}${x.pos && x.pos !== "interior" ? `, at the chromosome ${x.pos}` : ""}` })) });
  const exch = parseSegs(c?.exchange_segments);
  if (exch.length)
    lanes.push({ label: "homeologous exchange", items: exch.map((x) => ({ ...x, col: css("--p5"), tip: `${x.hap}: carries chromosome ${chrLabel(x.to)}'s sequence${x.pos && x.pos !== "interior" ? `, at the chromosome ${x.pos}` : ""}` })) });
  for (const [hap, items] of d3.group(parseSegs(c?.lineage_switches), (x) => x.hap))
    lanes.push({ label: `${hap} follows`, items: items.map((x) => ({ ...x, col: hapCol(x.to), text: x.to, tip: `${hap} follows ${x.to}'s lineage here` })) });
  const laneH = 9,
    laneGap = 4;
  y += lanes.length ? 8 : 0;
  lanes.forEach((ln) => {
    ln.y = y;
    y += laneH + laneGap;
  });
  const hmY = y + 6;
  const H = (anchor ? hmY + 14 : y) + 28;
  const dpr = devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `Heatmap of k-mer distance in ${step / 1000} kb windows along chromosome ${chrLabel(state.chrom)}, one row per pair of copies`,
  );
  const ctx = canvas.getContext("2d");
  const ink2 = css("--ink-2"),
    ink3 = css("--ink-3"),
    paper2 = css("--paper-2"),
    rule = css("--rule"),
    pcol = pairColours(data);
  let x = x0;
  const render = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.font = "10.5px Inter, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    const wpx = x(step) - x(0);
    const [d0, d1] = x.domain();
    const w0 = Math.max(0, Math.floor(d0 / step)),
      w1 = Math.ceil(d1 / step);
    ctx.save();
    ctx.beginPath();
    ctx.rect(L, 0, W - R - L, H);
    ctx.clip();
    rows.forEach((t, r) => {
      for (let w = w0; w < Math.min(w1, t[2].length); w++) {
        const v = t[2][w];
        ctx.fillStyle = v < 0 ? paper2 : colour(Math.max(v, lo));
        ctx.fillRect(x(w * step), ys[r], Math.ceil(wpx) + 0.5, rowH - 1);
      }
    });
    for (const ln of lanes) {
      ctx.fillStyle = rule;
      ctx.fillRect(L, ln.y + laneH / 2 - 0.5, W - R - L, 1);
      for (const it of ln.items) {
        const x1 = x(it.s),
          x2 = Math.max(x1 + 2, x(it.e));
        ctx.fillStyle = it.col;
        ctx.fillRect(x1, ln.y, x2 - x1, laneH);
        if (it.text && x2 - x1 > 34) {
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.font = "600 8.5px Inter, system-ui, sans-serif";
          ctx.fillText(it.text, (x1 + x2) / 2, ln.y + laneH / 2 + 0.5);
          ctx.font = "10.5px Inter, system-ui, sans-serif";
        }
      }
    }
    if (anchor) {
      const [aid, hm] = anchor;
      const hw = x(250000) - x(0);
      hm.w.forEach((w, i) => {
        if (!w) return;
        const b = blockAt(data, aid, i * 250000 + 1);
        ctx.fillStyle = b ? (pcol.of(b.chrom, b.partner) ?? ink3) : rule;
        ctx.globalAlpha = b && b.reciprocal !== "yes" ? 0.35 : 1;
        ctx.fillRect(x(i * 250000), hmY, Math.ceil(hw) + 0.5, 12);
      });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.fillStyle = ink3;
    ctx.textAlign = "right";
    rows.forEach((t, r) => ctx.fillText(`${t[0].split("_")[0]} → ${t[1].split("_")[0]}`, L - 8, ys[r] + rowH / 2));
    if (anchor) ctx.fillText(`${anchor[0].split("_")[0]} homeology`, L - 8, hmY + 6);
    for (const ln of lanes) ctx.fillText(ln.label, L - 8, ln.y + laneH / 2);
    if (hasGroups) {
      const names = { 0: "same lineage", 2: "across lineages", 1: "" };
      ctx.fillStyle = ink2;
      ctx.textAlign = "left";
      for (const k of kinds) {
        const idx = rows.map((t, i) => (kind(t) === k ? i : -1)).filter((i) => i >= 0);
        if (idx.length && names[k]) ctx.fillText(names[k], 10, (ys[idx[0]] + ys[idx.at(-1)] + rowH) / 2);
      }
    }
    const axY = H - 16;
    ctx.fillStyle = ink3;
    ctx.textAlign = "center";
    for (const t of x.ticks(Math.min(8, W / 90))) {
      ctx.fillRect(x(t), axY - 4, 1, 4);
      ctx.fillText(`${d3.format("~g")(t / 1e6)}`, x(t), axY + 6);
    }
    ctx.textAlign = "left";
    ctx.fillText("Mb", W - R + 6, axY + 6);
  };
  el.replaceChildren(canvas);
  const z = d3
    .zoom()
    .filter(zoomFilter)
    .wheelDelta(zoomDelta)
    .scaleExtent([1, Math.max(2, maxLen / step / 8)])
    .extent([[L, 0], [W - R, H]])
    .translateExtent([[L, 0], [W - R, H]])
    .on("zoom", (e) => {
      zooms.windows = e.transform;
      x = e.transform.rescaleX(x0);
      hideTip();
      render();
    });
  const sel3 = d3.select(canvas).call(z).on("dblclick.zoom", null);
  sel3.call(z.transform, zooms.windows);
  canvas.ondblclick = () => sel3.transition().duration(300).call(z.transform, d3.zoomIdentity);
  canvas.onmousemove = (e) => {
    if (e.buttons) return;
    const rc = canvas.getBoundingClientRect(),
      px = e.clientX - rc.left,
      py = e.clientY - rc.top;
    const w = Math.floor(x.invert(px) / step);
    if (px < L || px > W - R || w < 0) return hideTip();
    const r = ys.findIndex((yy) => py >= yy && py < yy + rowH);
    const pos = `${d3.format(".2f")((w * step) / 1e6)}–${d3.format(".2f")(((w + 1) * step) / 1e6)} Mb`;
    if (r >= 0) {
      const t = rows[r],
        v = t[2][w];
      if (v == null) return hideTip();
      return showTip(
        `<b>${esc(t[0].split("_")[0])} → ${esc(t[1].split("_")[0])}</b>, ${pos}<br>distance ${dist(v)}<br><span>This window of ${esc(t[0].split("_")[0])}, looked up in all of ${esc(t[1].split("_")[0])}${hasGroups ? `; ${["same lineage", "", "across lineages"][kind(t)]}` : ""}</span>`,
        e.clientX,
        e.clientY,
      );
    }
    const ln = lanes.find((l) => py >= l.y - 1 && py < l.y + laneH + 1);
    if (ln) {
      const p = x.invert(px),
        it = ln.items.find((i) => p >= i.s && p <= i.e);
      if (!it) return hideTip();
      return showTip(
        `<b>${d3.format(".1f")(it.s / 1e6)}–${d3.format(".1f")(it.e / 1e6)} Mb</b><br>${esc(it.tip)}<br><span>${esc(ln.label[0].toUpperCase() + ln.label.slice(1))}</span>`,
        e.clientX,
        e.clientY,
      );
    }
    if (anchor && py >= hmY && py < hmY + 12) {
      const hw = anchor[1].w[Math.floor(x.invert(px) / 250000)],
        b = blockAt(data, anchor[0], x.invert(px));
      if (!hw) return hideTip();
      return showTip(
        `<b>${pos}</b><br>${b ? `in a block duplicated on chromosome ${chrLabel(b.partner)}${b.reciprocal === "yes" ? "" : " (not reciprocal)"}` : `closest other chromosome: ${chrLabel(hw[0])} (distance ${dist(hw[1])})`}<br><span>${b ? "Homeolog block" : "Not in a homeolog block"}</span>`,
        e.clientX,
        e.clientY,
      );
    }
    hideTip();
  };
  canvas.onmouseleave = hideTip;
  legend($("winKey"), colour, lo, hi, `Distance, ${step / 1000} kb windows`);
  const fusedNote = c?.fusion
    ? `<b>${esc(c.fusion.replace(/^with chr0*(\d+) in (.*)$/, (m, o, h) => `${h.split(",").join(" and ")} of this chromosome ${h.includes(",") ? "are" : "is"} fused with chromosome ${o}`))}, so ${c.fusion.includes(",") ? "they are" : "it is"} not among the rows here unless assembled under this chromosome's name; see Chromosome fusions below.</b> `
    : "";
  $("winNote").innerHTML = fusedNote + `Each row is one copy's windows looked up anywhere in another copy, so the assemblies need not line up${hasGroups ? `; rows are grouped by the lineages ploidyspec found (${esc(lineage(c.group_a))} | ${esc(lineage(c.group_b))})` : ""}. ${lanes.length ? `Under the heatmap, one track per line of evidence along this chromosome (${lanes.map((l) => l.label).join(", ")}), on the coordinates of the copy named in each segment; hover for details. ` : ""}${anchor ? "The track below marks this chromosome's homeolog blocks, coloured as in the homeology map (hover for the partner). " : ""}Window distances run lower than whole-chromosome ones, so compare shapes, not values, with the matrix. Hold ctrl or ⌘ and scroll to zoom along the chromosome, drag to pan, double-click to reset.`;
}

// --- homeology map ---

// One colour per reciprocal homeolog pair (blocks found from both sides), as ploidyspec's
// homeology_map.png paints them, and each chromosome's dominant reciprocal partner
function pairColours(data) {
  const key = (a, b) => [a, b].sort().join("|");
  const bp = new Map();
  for (const b of data.blocks)
    if (b.reciprocal === "yes") bp.set(key(b.chrom, b.partner), (bp.get(key(b.chrom, b.partner)) ?? 0) + (b.end - b.start));
  const pal = d3.range(10).map((i) => css(`--p${i}`));
  const col = new Map([...bp.keys()].sort().map((k, i) => [k, pal[i % pal.length]]));
  const dom = new Map();
  for (const [k, v] of bp) for (const c of k.split("|")) if (!dom.has(c) || dom.get(c)[1] < v) dom.set(c, [k, v]);
  return {
    key,
    of: (a, b) => col.get(key(a, b)),
    label: (c) => (dom.has(c) ? col.get(dom.get(c)[0]) : null),
    partner: (c) => (dom.has(c) ? dom.get(c)[0].split("|").find((x) => x !== c) : null),
  };
}
const blockAt = (data, anchor, pos) => data.blocks.find((b) => b.anchor === anchor && pos >= b.start && pos <= b.end);

function drawHomeology() {
  const { data } = panel;
  const el = $("figHomeology");
  const anchors = Object.entries(data.homeology).sort((a, b) => d3.ascending(a[1].chrom, b[1].chrom));
  if (!anchors.length || !data.blocks.length) {
    $("hmCard").hidden = !anchors.length && !data.blocks.length;
    el.innerHTML = "";
    $("hmNote").textContent = anchors.length
      ? "No stretch of any chromosome is duplicated on another more than chance allows: no old duplicated sets in this genome."
      : "The homeology map was not run for this assembly.";
    return;
  }
  $("hmCard").hidden = false;
  const pc2 = pairColours(data);
  const W = Math.max(420, el.clientWidth),
    L = 44,
    R = 60,
    rowH = anchors.length > 30 ? 12 : 15,
    gap = 4;
  const maxW = d3.max(anchors, ([, v]) => v.w.length);
  const x = d3.scaleLinear().domain([0, maxW * 250000]).range([L, W - R]);
  const H = anchors.length * (rowH + gap) + 26;
  const rule = css("--rule"),
    ink = css("--ink"),
    ink3 = css("--ink-3"),
    surface = css("--surface");
  const blocksBy = d3.group(data.blocks, (b) => b.anchor);
  const svg = d3
    .create("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("width", W)
    .attr("height", H)
    .attr("role", "img")
    .attr("aria-label", "Each chromosome painted by the chromosome its duplicated blocks lie on");
  const row = svg
    .selectAll("g.row")
    .data(anchors)
    .join("g")
    .attr("class", "row")
    .attr("transform", (d, i) => `translate(0,${4 + i * (rowH + gap)})`);
  // chromosome numbers, on a pill in the colour of their dominant reciprocal partner
  const lab = row.append("g");
  lab
    .append("rect")
    .attr("x", L - 34)
    .attr("y", -0.5)
    .attr("width", 28)
    .attr("height", rowH + 1)
    .attr("rx", (rowH + 1) / 2)
    .attr("fill", ([, v]) => pc2.label(v.chrom) ?? "none");
  lab
    .append("text")
    .attr("x", L - 20)
    .attr("y", rowH / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr("font-size", 10.5)
    .attr("font-weight", ([, v]) => (pc2.label(v.chrom) || v.chrom === state.chrom ? 600 : 400))
    .attr("fill", ([, v]) => (pc2.label(v.chrom) ? "#fff" : ink3))
    .text(([, v]) => chrLabel(v.chrom));
  lab.append("title").text(([, v]) => {
    const p = pc2.partner(v.chrom);
    return p ? `Chromosome ${chrLabel(v.chrom)}: most of its reciprocal homeology is with chromosome ${chrLabel(p)}` : `Chromosome ${chrLabel(v.chrom)}: no reciprocal homeolog block`;
  });
  row
    .append("rect")
    .attr("class", "bar")
    .attr("x", L)
    .attr("width", ([, v]) => x(v.w.length * 250000) - L)
    .attr("height", rowH)
    .attr("rx", 3)
    .attr("fill", rule);
  const blk = row
    .selectAll("g.b")
    .data(([a]) => blocksBy.get(a) ?? [])
    .join("g")
    .attr("class", "b");
  blk
    .append("rect")
    .attr("x", (b) => x(b.start))
    .attr("width", (b) => Math.max(1.5, x(b.end) - x(b.start)))
    .attr("height", rowH)
    .attr("fill", (b) => pc2.of(b.chrom, b.partner) ?? ink3)
    .attr("fill-opacity", (b) => (b.reciprocal === "yes" ? 1 : 0.32))
    .attr("stroke", (b) => (b.reciprocal === "yes" ? surface : pc2.of(b.chrom, b.partner) ?? ink3))
    .attr("stroke-width", (b) => (b.reciprocal === "yes" ? 0.75 : 1))
    .attr("stroke-dasharray", (b) => (b.reciprocal === "yes" ? null : "3 2"));
  blk
    .filter((b) => x(b.end) - x(b.start) >= 18)
    .append("text")
    .attr("x", (b) => (x(b.start) + x(b.end)) / 2)
    .attr("y", rowH / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr("font-size", 9.5)
    .attr("font-weight", 600)
    .attr("fill", (b) => (b.reciprocal === "yes" ? "#fff" : ink))
    .attr("pointer-events", "none")
    .text((b) => chrLabel(b.partner));
  const sel = row.filter(([, v]) => v.chrom === state.chrom);
  sel.select("rect.bar").attr("stroke", ink).attr("stroke-width", 2);
  svg
    .append("g")
    .attr("transform", `translate(0,${H - 20})`)
    .call(d3.axisBottom(x).ticks(Math.min(8, W / 90)).tickFormat((v) => d3.format("~g")(v / 1e6)))
    .call((g) => g.select(".domain").attr("stroke", rule))
    .call((g) => g.selectAll(".tick line").attr("stroke", rule))
    .call((g) => g.selectAll("text").attr("fill", ink3))
    .append("text")
    .attr("x", W - R + 4)
    .attr("y", 14)
    .attr("fill", ink3)
    .attr("text-anchor", "start")
    .text("Mb");
  // hover: which chromosome is this stretch duplicated on? light up both
  const hit = svg
    .append("rect")
    .attr("x", L)
    .attr("width", W - L - R)
    .attr("height", H - 22)
    .attr("fill", "transparent")
    .style("cursor", "pointer");
  const nb = (i) => Math.floor((i - 4) / (rowH + gap));
  hit
    .on("mousemove", (e) => {
      const [px, py] = d3.pointer(e);
      const a = anchors[nb(py)];
      row.attr("opacity", 1);
      if (!a) return hideTip();
      const pos = x.invert(px),
        i = Math.floor(pos / 250000),
        w = a[1].w[i],
        b = blockAt(data, a[0], pos);
      if (b) row.attr("opacity", ([, v]) => (v.chrom === a[1].chrom || v.chrom === b.partner ? 1 : 0.3));
      if (!w && !b) return hideTip();
      showTip(
        b
          ? `<b>Chromosome ${chrLabel(a[1].chrom)}, ${d3.format(".1f")(b.start / 1e6)}–${d3.format(".1f")(b.end / 1e6)} Mb</b><br>duplicated on chromosome ${chrLabel(b.partner)} (median distance ${b.median_dist != null ? d3.format(".4f")(b.median_dist) : "–"})<br><span>${b.reciprocal === "yes" ? "Reciprocal: the partner has a block back" : "Not reciprocal: no block back from the partner, so not counted"}${b.position && b.position !== "interior" ? `; at the chromosome ${esc(b.position)}` : ""}</span>`
          : `<b>Chromosome ${chrLabel(a[1].chrom)}, ${d3.format(".2f")((i * 250000) / 1e6)} Mb</b><br>closest other chromosome: ${chrLabel(w[0])} (distance ${dist(w[1])}, z ${w[2] ?? "–"})<br><span>Not in a homeolog block</span>`,
        e.clientX,
        e.clientY,
      );
    })
    .on("mouseleave", () => {
      row.attr("opacity", 1);
      hideTip();
    })
    .on("click", (e) => {
      const a = anchors[nb(d3.pointer(e)[1])];
      if (a && data.chroms.some((c) => c.chrom === a[1].chrom)) selectChrom(a[1].chrom, el);
    });
  el.replaceChildren(svg.node());
  const frac = byId.get(state.id).homeoFrac;
  $("hmNote").innerHTML = `Each chromosome of ${esc(anchors[0][0].split("_")[0])}, painted where a block of it is duplicated on another chromosome, as in ploidyspec's homeology map. Each reciprocal pair (a block from both sides) has its own colour, and the number in a block is its partner; a chromosome's number is coloured by its main reciprocal partner. Faded, dashed blocks have no block back from the partner and are not counted. Reciprocal blocks cover ${pc(frac)} of the genome. Hover to light up the partner, click to open a chromosome.`;
}

// --- start ---

const res = await fetch("/data/ploidy.json").catch(() => null);
if (!res || !res.ok) {
  $("status").textContent = "The panel could not be loaded just now. Please try again later.";
  throw new Error("ploidy index unavailable");
}
index = await res.json();
all = index.species;
byId = new Map(all.map((d) => [d.id, d]));
$("status").remove();
$("app").hidden = false;

$("names").replaceChildren(
  ...all
    .filter((d) => !d.parent)
    .map((d) => Object.assign(document.createElement("option"), { value: d.name })),
);
$("picks").innerHTML = PICKS.filter(([k]) => byId.has(k))
  .map(([k, why]) => `<a class="chip" href="#${k}" title="${esc(why)}"><i>${esc(shortName(byId.get(k).name))}</i></a>`)
  .join("");
const groups = d3.rollups(all.filter((d) => !d.parent), (v) => v.length, (d) => d.group).sort((a, b) => b[1] - a[1]);
$("groupFilter").innerHTML =
  `<option value="">All</option>` + groups.map(([g, n]) => `<option value="${esc(g)}">${esc(g)} (${n})</option>`).join("");
$("originFilter").innerHTML =
  `<option value="">Any</option>` + ORIGIN.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
const date = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
$("source").innerHTML = `Built from <a href="${REPO}">ploidyspec</a> at commit <a href="${REPO}/tree/${index.commit}"><code>${index.commit.slice(0, 7)}</code></a> (${date(index.committed)}). Every reading comes from one individual's haplotype assemblies, and describes the data, not inheritance: check the evidence and the caveats above before relying on one.`;

renderTiles();

$("search").addEventListener("change", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return;
  const runs = all.filter((d) => !d.parent);
  const hit =
    runs.find((d) => d.name.toLowerCase() === q || d.id.toLowerCase() === q) ||
    runs.find((d) => d.name.toLowerCase().startsWith(q)) ||
    runs.find((d) => d.name.toLowerCase().includes(q));
  if (hit) {
    open(hit.id);
    e.target.value = "";
  }
});
$("random").addEventListener("click", () => {
  const runs = all.filter((d) => !d.parent && d.windowed);
  open(runs[Math.floor(Math.random() * runs.length)].id);
});
$("groupFilter").addEventListener("change", (e) => {
  state.group = e.target.value;
  state.rows = 15;
  renderTable();
});
$("originFilter").addEventListener("change", (e) => {
  state.origin = e.target.value;
  state.rows = 15;
  renderTable();
});
$("thead").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.k;
  if (!k) return;
  state.dir = state.sort === k ? -state.dir : ["name", "group", "origin", "lit"].includes(k) ? 1 : -1;
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
$("species").addEventListener("click", (e) => {
  const run = e.target.closest("[data-run]")?.dataset.run;
  if (run) return open(run, false);
  if (e.target.closest("[data-evonly]")) {
    const on = e.target.closest("[data-evonly]").getAttribute("aria-pressed") !== "true";
    state.evOnly = on;
    const y0 = $("evCard").getBoundingClientRect().top;
    $("evCard").outerHTML = evidenceCard(panel.d, panel.data);
    window.scrollBy({ top: $("evCard").getBoundingClientRect().top - y0, behavior: "instant" });
    return;
  }
  const fu = e.target.closest("[data-fusion]")?.dataset.fusion;
  if (fu) {
    e.preventDefault();
    document.getElementById(`fusion-${fu}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const row = e.target.closest(".pl-evtable tr[data-chrom]");
  if (row) return selectChrom(row.dataset.chrom, $("evCard"));
  const ch = e.target.closest("[data-chrom]")?.dataset.chrom;
  if (ch) return selectChrom(ch);
  const sc = e.target.closest("[data-scheme]")?.dataset.scheme;
  if (sc) {
    state.scheme = sc;
    for (const b of document.querySelectorAll("[data-scheme]")) b.setAttribute("aria-pressed", b.dataset.scheme === sc);
    drawMatrix();
    drawWindows();
    return;
  }
  const o = e.target.closest("[data-order]")?.dataset.order;
  if (o) {
    state.order = state.pref = o;
    zooms.matrix = d3.zoomIdentity;
    for (const b of document.querySelectorAll("[data-order]")) b.setAttribute("aria-pressed", b.dataset.order === o);
    drawMatrix();
  }
});

$("species").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches(".pl-evtable tr[data-chrom]")) {
    e.preventDefault();
    e.target.click();
  }
});

// hover (or focus) on anything with data-tip
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
addEventListener("scroll", () => (hideHelp(), hideTip()), { passive: true });

addEventListener("hashchange", () => {
  const k = decodeURIComponent(location.hash.slice(1));
  if (k && k !== state.id) open(k);
});
const start = decodeURIComponent(location.hash.slice(1));
state.id = byId.has(start) ? start : "SchYoun1";
renderSpecies();
renderScatter();
renderTable();

const redraw = () => {
  renderScatter();
  renderTable();
  if (panel && panel.d.id === state.id) {
    document.querySelectorAll(".pl-chr").forEach((b) => b.style.setProperty("--c", stateColour(panel.data.chroms.find((c) => c.chrom === b.dataset.chrom)?.copy_state)));
    drawMatrix();
    drawWindows();
    drawHomeology();
    drawFusions();
  }
};
let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (innerWidth !== lastWidth) {
    lastWidth = innerWidth;
    redraw();
  }
});
dark.addEventListener("change", redraw);
new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
