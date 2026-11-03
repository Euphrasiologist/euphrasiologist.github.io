// organelles.js: the plant organelle genome atlas. The species index is built
// weekly from the database repo (scripts/build_organelle_index.py); graphs and
// annotation for a species are read from the repo itself when it is opened,
// pinned to the commit the index was built from.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";
import { addDownloads } from "./plot-download.js";
import { parseGFA, parseGFF, draw, CLASSES, classOf } from "./bandage.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const int = d3.format(",");
const kb = (v) => (v == null ? "–" : v >= 1e6 ? d3.format(".2f")(v / 1e6) + " Mb" : d3.format(".1f")(v / 1e3) + " kb");
const pc = (v) => (v == null ? "–" : d3.format(".0%")(v));
const nameOf = (k) => k.replace(/_/g, " ");
const ORGS = { mito: "Mitochondrion", pltd: "Plastid" };
const DIR = { mito: "mito", pltd: "plastid" };
const STATUS = ["pass", "flag", "fail"];
const RANK = { pass: 0, flag: 1, fail: 2 };
const REASONS = {
  size_outlier: "unusual size for its genus",
  non_circular: "no circular path",
  elevated_cross_organelle_alignment: "some sequence shared with the other organelle",
  high_cross_organelle_alignment: "much sequence shared with the other organelle",
  dead_end_nodes: "dead ends in the graph",
  missing_gfa: "no assembly graph",
  core_gene_pct: "core genes missing",
  fragmented: "fragmented graph",
  no_resolved_ctg_fasta: "graph could not be resolved into contigs",
};
const reason = (r) => {
  const key = r.replace(/[(<>].*$/, "");
  const detail = (r.match(/\(([^)]*)\)/) || [])[1];
  return (REASONS[key] ?? r.replace(/_/g, " ")) + (detail ? ` (${detail.replace(/n_fragment_subgraphs/, "subgraphs ")})` : "");
};
const FILES = {
  gfa: ["Assembly graph", "GFA"],
  fasta: ["Resolved contigs", "FASTA"],
  gff: ["Annotation on contigs", "GFF3"],
  ugff: ["Annotation on graph segments", "GFF3"],
  bed: ["Oatk gene hits", "BED"],
  annot: ["Oatk annotation", "TXT"],
  png: ["Bandage plot", "PNG"],
};
const PICKS = [
  ["Acer_campestre", "A clean worked example, from graph to gene models"],
  ["Arabidopsis_thaliana", "Checked against the RefSeq reference"],
  ["Dactylorhiza_fuchsii", "A mitogenome in 14 circular chromosomes"],
  ["Azolla_filiculoides", "A repeat-rich fern mitogenome"],
];

// --- colour ---

const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : dark.matches);
const palette = () => isDark()
  ? { status: ["#199e70", "#c98500", "#e66767"], org: ["#9085e9", "#199e70"], ramp: ["#2a4a6b", "#6da7ec", "#e8f1fb"] }
  : { status: ["#1baf7a", "#eda100", "#e34948"], org: ["#6250d6", "#1baf7a"], ramp: ["#dbe8f8", "#5d9be3", "#173f73"] };
const statusScale = () => ({ type: "ordinal", domain: STATUS, range: palette().status });

// --- state ---

const state = { species: null, hidden: new Set(), sort: "name", dir: 1, rows: 15, colour: { mito: "genes", pltd: "genes" } };
let index, all, raw;
const graphs = {};

// --- overview ---

function renderOverview() {
  const rows = all.filter((d) => d.mito?.length && d.pltd?.length);
  const w1 = Math.max(260, $("plot1").clientWidth);
  const sel = rows.filter((d) => d.key === state.species);
  const plot1 = Plot.plot({
    width: w1, height: 380, marginLeft: 56, marginBottom: 40, grid: true,
    x: { type: "log", label: "Plastid genome →", tickFormat: (d) => kb(d), ticks: 4 },
    y: { type: "log", label: "↑ Mitochondrial genome", tickFormat: (d) => kb(d) },
    color: { ...statusScale(), label: "Mitochondrial QC" },
    marks: [
      Plot.dot(rows, { x: (d) => d.pltd.length, y: (d) => d.mito.length, fill: (d) => d.mito.status, r: 2.8, fillOpacity: 0.85, stroke: "var(--plot-background)", strokeWidth: 0.5,
        channels: { Species: (d) => nameOf(d.key), Mitochondrion: (d) => kb(d.mito.length), Plastid: (d) => kb(d.pltd.length) }, tip: { format: { x: false, y: false, fill: true } } }),
      Plot.dot(sel, { x: (d) => d.pltd.length, y: (d) => d.mito.length, r: 8, stroke: "currentColor", strokeWidth: 2 }),
      Plot.text(sel, { x: (d) => d.pltd.length, y: (d) => d.mito.length, text: (d) => nameOf(d.key), dy: -14, fontStyle: "italic", fontWeight: 600, fill: "currentColor", stroke: "var(--plot-background)", strokeWidth: 3 }),
    ],
  });
  plot1.addEventListener("click", () => plot1.value && open(plot1.value.key));
  $("plot1").replaceChildren(plot1);

  const BINS = ["1", "2–3", "4–7", "8–15", "16–31", "32–63", "64+"];
  const bin = (n) => BINS[Math.min(6, Math.floor(Math.log2(n)))];
  const counts = Object.keys(ORGS).flatMap((o) => d3.rollups(all.filter((d) => d[o]?.nodes), (v) => v.length, (d) => bin(d[o].nodes))
    .map(([b, n]) => ({ org: ORGS[o], bin: b, n })));
  const w2 = Math.max(260, $("plot2").clientWidth);
  $("plot2").replaceChildren(Plot.plot({
    width: w2, height: 380, marginLeft: 44, marginBottom: 40,
    fx: { domain: BINS, label: "Segments in the assembly graph →", padding: 0.12 },
    x: { axis: null, domain: Object.values(ORGS) }, y: { label: "↑ Species", grid: true },
    color: { domain: Object.values(ORGS), range: palette().org, legend: true },
    marks: [Plot.barY(counts, { fx: "bin", x: "org", y: "n", fill: "org", tip: { format: { fx: true, x: false, fill: true } } }), Plot.ruleY([0])],
  }));

  const mito = all.filter((d) => d.mito?.nodes), pl = all.filter((d) => d.pltd?.nodes);
  const medNodes = (rs, o) => d3.median(rs, (d) => d[o].nodes);
  const ratio = d3.median(rows, (d) => d.mito.length / d.pltd.length);
  $("note1").innerHTML = `Plastid genomes are remarkably uniform, a median ${kb(d3.median(pl, (d) => d.pltd.length))} assembled as a graph of ${medNodes(pl, "pltd")} segments. Mitochondrial genomes are typically ${d3.format(".1f")(ratio)} times larger and far more varied, from ${kb(d3.min(mito, (d) => d.mito.length))} to ${kb(d3.max(mito, (d) => d.mito.length))}, with a median of ${medNodes(mito, "mito")} segments as repeats tangle the graph. Click any point to open that species.`;
}

function renderTiles() {
  const share = (o) => d3.mean(all.filter((d) => d[o]?.status), (d) => (d[o].status === "pass" ? 1 : 0));
  const big = d3.greatest(all, (d) => d.mito?.length ?? 0);
  $("tiles").innerHTML = [
    [int(all.length), "species"],
    [int(all.filter((d) => d.mito?.files?.includes("gfa")).length + all.filter((d) => d.pltd?.files?.includes("gfa")).length), "assembly graphs"],
    [pc(share("mito")), "of mitogenomes pass QC"],
    [pc(share("pltd")), "of plastomes pass QC"],
    [kb(d3.median(all, (d) => d.mito?.length)), "median mitogenome"],
    [kb(big.mito.length), `largest: <i>${esc(nameOf(big.key))}</i>`],
  ].map(([a, b]) => `<div class="gs-tile"><b>${a}</b><span>${b}</span></div>`).join("");
}

// --- table ---

const COLS = [
  ["name", "Species", (d) => `<i>${esc(nameOf(d.key))}</i>`, "l"],
  ["mlen", "Mitochondrion", (d) => kb(d.mito?.length)],
  ["mseg", "Segments", (d) => d.mito?.nodes ?? "–"],
  ["mqc", "QC", (d) => badge(d.mito?.status), "l"],
  ["plen", "Plastid", (d) => kb(d.pltd?.length)],
  ["pseg", "Segments", (d) => d.pltd?.nodes ?? "–"],
  ["pqc", "QC", (d) => badge(d.pltd?.status), "l"],
];
const SORT = {
  name: (d) => d.key, mlen: (d) => d.mito?.length, mseg: (d) => d.mito?.nodes, mqc: (d) => RANK[d.mito?.status],
  plen: (d) => d.pltd?.length, pseg: (d) => d.pltd?.nodes, pqc: (d) => RANK[d.pltd?.status],
};
const badge = (s) => (s ? `<span class="og-badge ${s}">${s}</span>` : "–");

function renderTable() {
  const shown = all.filter((d) => [d.mito?.status, d.pltd?.status].some((s) => s && !state.hidden.has(s)));
  const key = SORT[state.sort];
  const rows = shown.slice().sort((a, b) => {
    const x = key(a), y = key(b);
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return state.dir * d3.ascending(x, y);
  });
  $("thead").innerHTML = "<tr>" + COLS.map(([k, label, , cls]) =>
    `<th class="${cls ?? ""}" aria-sort="${state.sort === k ? (state.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${k}">${label}${state.sort === k ? (state.dir > 0 ? " ↑" : " ↓") : ""}</button></th>`).join("") + "</tr>";
  $("tbody").innerHTML = rows.slice(0, state.rows).map((d) =>
    `<tr data-s="${esc(d.key)}"${d.key === state.species ? ' class="on"' : ""}>` + COLS.map(([, , f, cls]) => `<td class="${cls ?? ""}">${f(d)}</td>`).join("") + "</tr>").join("");
  $("more").hidden = rows.length <= 15;
  $("more").textContent = state.rows < rows.length ? `Show all ${int(rows.length)}` : "Show fewer";
}

// --- species view ---

const rawUrl = (path) => `https://raw.githubusercontent.com/${index.repo}/${index.commit}/${path}`;
function filePath(key, org, kind) {
  const e = index.species[key][org], pre = `data/${DIR[org]}/${key}/${e.prefix ?? key}`;
  return {
    gfa: `${pre}.${org}.gfa`, fasta: `${pre}.${org}.ctg.fasta`, bed: `${pre}.${org}.bed`, annot: `${pre}.annot_${org}.txt`,
    gff: `analysis/gff_export/results/${key}.${org}.gff`, ugff: `analysis/gff_export/results/unitig/${key}.${org}.unitig.gff`,
    png: `analysis/topology_plots/results/plots/${org}/${key}.genes.png`,
  }[kind];
}

function open(key, scroll = true) {
  if (!index.species[key]) return;
  state.species = key;
  if (location.hash.slice(1) !== key) history.replaceState(null, "", "#" + key);
  renderSpecies();
  renderOverview();
  renderTable();
  if (scroll) $("species").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSpecies() {
  const key = state.species, sp = index.species[key];
  Object.keys(graphs).forEach((k) => delete graphs[k]);
  const genus = key.split("_")[0];
  const congeners = all.filter((d) => d.key !== key && d.key.split("_")[0] === genus).map((d) => d.key);
  $("species").innerHTML = `
    <header class="og-head">
      <p class="eyebrow">Species</p>
      <h2><i>${esc(nameOf(key))}</i></h2>
      <p class="og-sub">${congeners.length ? `Also in <i>${esc(genus)}</i>: ${congeners.slice(0, 6).map((k) => `<a href="#${esc(k)}"><i>${esc(nameOf(k))}</i></a>`).join(", ")}${congeners.length > 6 ? ` and ${congeners.length - 6} more` : ""}` : "The only species of its genus in the atlas"}</p>
    </header>
    <div class="og-pair">${Object.keys(ORGS).map((o) => organelleCard(key, o, sp[o])).join("")}</div>`;
  for (const o of Object.keys(ORGS)) if (sp[o]?.files?.includes("gfa")) loadGraph(key, o);
}

function organelleCard(key, org, e) {
  if (!e) return `<section class="gs-card og-card"><h3>${ORGS[org]}</h3><p class="gs-status">Not in the database.</p></section>`;
  const row = (k, v) => (v == null || v === "–" ? "" : `<dt>${k}</dt><dd>${v}</dd>`);
  const files = (e.files || []).map((k) => `<button type="button" class="og-file" data-path="${esc(filePath(key, org, k))}" title="${esc(filePath(key, org, k))}"><b>${FILES[k][1]}</b>${FILES[k][0]}</button>`).join("");
  return `<section class="gs-card og-card" data-org="${org}">
    <div class="og-cardhead"><h3>${ORGS[org]}</h3>${badge(e.status)}<span class="og-size">${kb(e.length)}</span></div>
    ${e.reasons ? `<p class="og-reasons">Flagged for ${e.reasons.map(reason).join("; ")}.</p>` : ""}
    <div class="og-graph" id="g-${org}">
      ${e.files?.includes("gfa") ? `<svg role="img" aria-label="${ORGS[org]} assembly graph"></svg><p class="og-loading">Drawing the assembly graph…</p>` : `<p class="og-loading">No assembly graph for this genome.</p>`}
      <div class="og-tools">
        <span class="og-toggle" role="group" aria-label="Colour by"><button type="button" data-mode="genes" aria-pressed="${state.colour[org] === "genes"}">Genes</button><button type="button" data-mode="random" aria-pressed="${state.colour[org] === "random"}">Random</button><button type="button" data-mode="depth" aria-pressed="${state.colour[org] === "depth"}">Depth</button></span>
        <button type="button" data-act="in" aria-label="Zoom in">+</button><button type="button" data-act="out" aria-label="Zoom out">−</button><button type="button" data-act="reset" aria-label="Reset view">↺</button>
      </div>
      <div class="og-tip" hidden></div>
    </div>
    <div class="og-legend" id="l-${org}"></div>
    <dl class="og-meta">
      ${row("Graph", e.nodes != null ? `${int(e.nodes)} segments, ${int(e.edges)} links` : null)}
      ${row("Resolved into", e.contigs != null ? `${int(e.contigs)} contig${e.contigs === 1 ? "" : "s"}${e.circular ? ", circular" : e.circular === false ? ", not circular" : ""}` : null)}
      ${row("Subgraphs", e.subgraphs)}${row("Dead ends", e.deadEnds)}
      ${row("GC content", e.gc != null ? d3.format(".1%")(e.gc) : null)}${row("Mean depth", e.depth != null ? d3.format(",.0f")(e.depth) + "×" : null)}
      ${row("Core genes found", pc(e.coreGenes))}${row("Shared with the other organelle", pc(e.crossOrganelle))}
    </dl>
    <div class="og-genes" id="genes-${org}"></div>
    ${files ? `<div class="og-files"><h4>Download</h4><div class="og-filegrid">${files}</div><button type="button" class="og-copy" data-org="${org}">Copy curl commands for all files</button></div>` : ""}
  </section>`;
}

async function loadGraph(key, org) {
  const box = $(`g-${org}`);
  const e = index.species[key][org];
  try {
    const want = [fetch(rawUrl(filePath(key, org, "gfa"))).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))];
    if (e.files.includes("ugff")) want.push(fetch(rawUrl(filePath(key, org, "ugff"))).then((r) => (r.ok ? r.text() : "")).catch(() => ""));
    const [gfa, gff = ""] = await Promise.all(want);
    if (state.species !== key) return;
    const graph = parseGFA(gfa);
    const annot = gff ? parseGFF(gff) : { parts: [], genes: [] };
    // Let the loading message paint before the layout runs
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    const svg = box.querySelector("svg");
    const h = draw(svg, graph, annot, { seed: key + org });
    box.querySelector(".og-loading")?.remove();
    graphs[org] = { h, graph, annot };
    recolour(org);
    renderGenes(org, annot);
    wireGraph(org);
  } catch (err) {
    box.querySelector(".og-loading").textContent = "The assembly graph could not be loaded just now.";
    console.error(err);
  }
}

function depthScale(graph) {
  const v = graph.segs.map((s) => s.depth).filter((x) => x > 0);
  const [lo, hi] = d3.extent(v);
  return d3.scaleSequentialLog(d3.piecewise(d3.interpolateRgb, palette().ramp)).domain([lo || 1, hi > lo ? hi : (lo || 1) * 2]);
}

function recolour(org) {
  const g = graphs[org];
  if (!g) return;
  const mode = state.colour[org];
  const scale = depthScale(g.graph);
  g.h.colour(mode, scale, isDark());
  const present = new Set(g.annot.parts.map((p) => classOf(p.name)));
  const c = isDark() ? "dark" : "light";
  $(`l-${org}`).innerHTML = mode === "genes"
    ? CLASSES.map(([label], i) => (present.has(i) ? `<span><i class="og-sw c${i}"></i>${label}</span>` : "")).join("") + (g.annot.parts.length ? "" : "<span>No gene annotation for this graph.</span>")
    : mode === "random" ? `<span>Each segment in its own colour, as in Bandage. Wider segments have higher read depth.</span>` : `<span class="og-ramp"><i style="background:linear-gradient(90deg,${palette().ramp.join(",")})"></i>Read depth, ${d3.format(",.0f")(scale.domain()[0])}× to ${d3.format(",.0f")(scale.domain()[1])}×</span>`;
  $(`l-${org}`).dataset.theme = c;
}

function renderGenes(org, annot) {
  const box = $(`genes-${org}`);
  if (!annot.genes.length) { box.innerHTML = ""; return; }
  const groups = d3.groups(annot.genes, (g) => classOf(g.name)).sort((a, b) => a[0] - b[0]);
  box.innerHTML = `<h4>${int(annot.genes.length)} genes</h4>` + groups.map(([c, gs]) =>
    `<div class="og-group"><span class="og-glabel"><i class="og-sw c${c}"></i>${CLASSES[c][0]}</span>${gs.sort((a, b) => d3.ascending(a.name, b.name)).map((g) => {
      const notes = [g.copies > 1 && `${g.copies} copies`, g.exons > 1 && `${g.exons} exons`, g.spans > 1 && `spans ${g.spans} segments`, g.edits && `${g.edits} predicted RNA edit${g.edits > 1 ? "s" : ""}`, g.partial && "partial", g.tier && g.tier !== "raw" && `${g.tier} model`].filter(Boolean);
      return `<button type="button" class="og-gene${g.partial ? " partial" : ""}" data-gene="${esc(g.name)}" title="${esc(notes.join(", ") || g.name)}">${esc(g.name)}${g.copies > 1 ? `<sup>×${g.copies}</sup>` : ""}</button>`;
    }).join("")}</div>`).join("");
}

function wireGraph(org) {
  const card = document.querySelector(`.og-card[data-org="${org}"]`);
  const g = graphs[org];
  const tip = card.querySelector(".og-tip");
  const svg = card.querySelector("svg");
  let pinned = null;
  const setGene = (name) => g.h.highlight(name);
  card.querySelector(".og-genes").addEventListener("mouseover", (e) => { const b = e.target.closest(".og-gene"); if (b && !pinned) setGene(b.dataset.gene); });
  card.querySelector(".og-genes").addEventListener("mouseout", () => { if (!pinned) setGene(null); });
  card.querySelector(".og-genes").addEventListener("click", (e) => {
    const b = e.target.closest(".og-gene");
    if (!b) return;
    pinned = pinned === b.dataset.gene ? null : b.dataset.gene;
    card.querySelectorAll(".og-gene").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.gene === pinned)));
    setGene(pinned);
  });
  svg.addEventListener("pointermove", (e) => {
    const el = e.target.closest(".bd-seg, .bd-gene");
    if (!el) { tip.hidden = true; return; }
    const d = d3.select(el).datum(), s = d.s ?? d;
    const genes = [...new Set(g.annot.parts.filter((p) => p.seg === s.id).map((p) => p.name))];
    tip.innerHTML = `<b>${esc(s.id)}</b> · ${kb(s.len)}${s.depth ? ` · ${d3.format(",.0f")(s.depth)}× depth` : ""}${d.name ? `<br>Gene: <i>${esc(d.name)}</i>` : ""}${genes.length ? `<br><span>${genes.slice(0, 14).map(esc).join(", ")}${genes.length > 14 ? "…" : ""}</span>` : ""}`;
    const r = card.querySelector(".og-graph").getBoundingClientRect();
    tip.style.left = Math.min(r.width - 220, e.clientX - r.left + 12) + "px";
    tip.style.top = e.clientY - r.top + 12 + "px";
    tip.hidden = false;
  });
  svg.addEventListener("pointerleave", () => (tip.hidden = true));
}

// Downloads go through fetch so they save under their own name
async function save(path) {
  const res = await fetch(rawUrl(path));
  const blob = await res.blob();
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: path.split("/").pop() });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// --- start ---

const res = await fetch("/data/organelles.json").catch(() => null);
if (!res || !res.ok) {
  $("status").textContent = "The atlas could not be loaded just now. Please try again later.";
  throw new Error("organelle index unavailable");
}
index = await res.json();
all = Object.entries(index.species).map(([key, v]) => ({ key, ...v }));
$("status").remove();
$("app").hidden = false;

$("names").replaceChildren(...all.map((d) => Object.assign(document.createElement("option"), { value: nameOf(d.key) })));
$("picks").innerHTML = PICKS.filter(([k]) => index.species[k]).map(([k, why]) => `<a class="chip" href="#${k}" title="${esc(why)}"><i>${esc(nameOf(k))}</i></a>`).join("");
$("source").innerHTML = `Data from <a href="https://github.com/${index.repo}">${index.repo}</a> at commit <a href="https://github.com/${index.repo}/tree/${index.commit}"><code>${index.commit.slice(0, 7)}</code></a> (${new Date(index.committed).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}). The index is rebuilt every week, and graphs, annotation and downloads come from that same commit. Assemblies are exploratory: check the QC status and its reasons before relying on one.`;
renderTiles();

$("search").addEventListener("change", (e) => {
  const q = e.target.value.trim().toLowerCase().replace(/\s+/g, "_");
  const hit = all.find((d) => d.key.toLowerCase() === q) || all.find((d) => d.key.toLowerCase().startsWith(q));
  if (q && hit) { open(hit.key); e.target.value = ""; }
});
$("random").addEventListener("click", () => {
  const good = all.filter((d) => d.mito?.files?.includes("gfa") && d.pltd?.files?.includes("gfa"));
  open(good[Math.floor(Math.random() * good.length)].key);
});
document.querySelectorAll(".og-filters .chip").forEach((b) => b.addEventListener("click", () => {
  const s = b.dataset.status, on = state.hidden.has(s);
  if (on) state.hidden.delete(s); else state.hidden.add(s);
  b.setAttribute("aria-pressed", String(on));
  renderTable();
}));
$("thead").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.k;
  if (!k) return;
  state.dir = state.sort === k ? -state.dir : k === "name" ? 1 : -1;
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
  const card = e.target.closest(".og-card");
  if (!card) return;
  const org = card.dataset.org, g = graphs[org];
  const mode = e.target.closest("[data-mode]")?.dataset.mode;
  const act = e.target.closest("[data-act]")?.dataset.act;
  const file = e.target.closest(".og-file")?.dataset.path;
  if (mode) {
    state.colour[org] = mode;
    card.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    recolour(org);
  } else if (act && g) {
    if (act === "reset") g.h.reset(); else g.h.zoomBy(act === "in" ? 1.6 : 1 / 1.6);
  } else if (file) {
    save(file).catch(() => window.open(rawUrl(file), "_blank"));
  } else if (e.target.closest(".og-copy")) {
    const key = state.species, cmds = index.species[key][org].files.map((k) => `curl -LO ${rawUrl(filePath(key, org, k))}`).join("\n");
    navigator.clipboard?.writeText(cmds).then(() => {
      const b = e.target.closest(".og-copy");
      b.textContent = "Copied";
      setTimeout(() => (b.textContent = "Copy curl commands for all files"), 1500);
    });
  }
});
addEventListener("hashchange", () => {
  const k = decodeURIComponent(location.hash.slice(1));
  if (k && k !== state.species) open(k);
});

state.species = index.species[decodeURIComponent(location.hash.slice(1))] ? decodeURIComponent(location.hash.slice(1)) : "Acer_campestre";
renderSpecies();
renderOverview();
renderTable();
addDownloads($("app"));

let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (innerWidth !== lastWidth) { lastWidth = innerWidth; renderOverview(); }
});
const rethemed = () => { renderOverview(); Object.keys(graphs).forEach(recolour); };
dark.addEventListener("change", rethemed);
new MutationObserver(rethemed).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
