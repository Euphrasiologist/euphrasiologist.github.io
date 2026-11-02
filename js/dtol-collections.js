// dtol-collections.js: DToL Plant Working Group sampling dashboard, drawn with
// Observable Plot. The data are read live from the collectors' published sheets.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";

const SHEET = "https://docs.google.com/spreadsheets/d/e/";
const URLS = {
  vascular: SHEET + "2PACX-1vQnttoVuGLAaqVzqaCjb7Qyc7gKgSNCb7INVIDdS8X83S78nZ_szlHcOxpveueKSrDkRzlqmUGWmtHx/pub?gid=0&single=true&output=csv",
  bryophyte: SHEET + "2PACX-1vSWzz8Sut3hQFB4DyxYE_wiZZrHB41VXokc8eihEGAOKdMPDhGw2KkJIl-zjAob6oeDcqgri1zcF3d8/pub?gid=0&single=true&output=csv",
  cvalue: SHEET + "2PACX-1vSt0R1T3MpoOM6UFNMaT_Q9gR5TYyUZC1wgLqW_6_cH9zzII8ehadrbHX8bpktjTv2_yt_KHaj3x_e1/pub?output=csv",
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const int = d3.format(",");
const pc = (a, b) => (b ? d3.format(".0%")(a / b) : "–");
const gb = (v) => (v == null ? "–" : v >= 10 ? d3.format(".1f")(v) + " Gb" : v >= 1 ? d3.format(".2f")(v) + " Gb" : d3.format(".0f")(v * 1000) + " Mb");
const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const yes = (v) => clean(v) !== "" && !/^(no|n)$/i.test(clean(v));

// Plant groups, in display order, and the two kingdoms of the target list
const GROUPS = ["Flowering plants", "Ferns & lycophytes", "Conifers", "Mosses", "Liverworts", "Hornworts"];
const KINDS = ["Vascular plants", "Bryophytes"];
const STATUS = { dtol_family_representative: "Family representatives", dtol_other_priority: "Other priority species", dtol: "Rest of the target list" };
const SHORT = { dtol_family_representative: "family reps", dtol_other_priority: "other priority", dtol: "rest of list" };

// --- data ---

const firstYear = (row, keys) => d3.min(keys.filter((k) => yes(row[k])), (k) => +k.match(/20\d\d/)[0]);
const yearKeys = (rows) => rows.columns.filter((k) => /^Collected/.test(k) && /20\d\d/.test(k));
const findKey = (rows, re) => rows.columns.find((k) => re.test(k));

function vascular(rows) {
  const years = yearKeys(rows), collected = findKey(rows, /^Collected \(any/);
  const group = (g) => (/fern/i.test(g) ? "Ferns & lycophytes" : /conifer|ginkgo/i.test(g) ? "Conifers" : "Flowering plants");
  return rows.filter((d) => clean(d.Genus)).map((d) => ({
    kind: "Vascular plants", group: group(d["Plant group"]), family: clean(d.Family),
    species: clean(d.Genus + " " + d.Species), status: clean(d.Status), priority: clean(d.Priority) === "yes",
    native: clean(d["Native status"]), collected: yes(d[collected]), year: firstYear(d, years), notes: clean(d.Notes),
  }));
}

function bryophyte(rows) {
  const years = yearKeys(rows), collected = findKey(rows, /^Collected \(any/);
  const group = (g) => (/liver/i.test(g) ? "Liverworts" : /horn/i.test(g) ? "Hornworts" : "Mosses");
  return rows.filter((d) => clean(d.Genus)).map((d) => ({
    kind: "Bryophytes", group: group(d["Taxonomic Division"]), family: clean(d.Family),
    species: clean(d.Genus + " " + d.Species), status: clean(d.Status), priority: clean(d.Priority) === "yes",
    collected: yes(d[collected]), year: firstYear(d, years), notes: clean(d.Notes),
  }));
}

// One value per species: the mean of the 1C estimates in Gb
function cvalues(rows, bySpecies) {
  const gs = findKey(rows, /1C\/Gbp/), sp = findKey(rows, /^Species/);
  const measured = rows.filter((d) => clean(d["ID Number"]) && +d[gs] > 0);
  const higher = (h) => (/angio/i.test(h) ? "Flowering plants" : /bryo/i.test(h) ? "Bryophytes" : /fern|monilo|lyco/i.test(h) ? "Ferns & lycophytes" : /gymno/i.test(h) ? "Conifers" : undefined);
  return d3.groups(measured, (d) => clean(d.Genus + " " + d[sp])).map(([species, g]) => {
    const t = bySpecies.get(species);
    const grp = t?.group ?? higher(g.map((d) => d["Higher Group"]).find(Boolean));
    return {
      species, gb: d3.mean(g, (d) => +d[gs]), n: g.length, family: t?.family || clean(g[0].Family) || undefined,
      group: grp === "Bryophytes" ? "Mosses" : grp, kind: t?.kind ?? (grp === "Bryophytes" ? "Bryophytes" : grp ? "Vascular plants" : undefined),
      measuredBy: clean(g[0]["measured by"]) || undefined,
    };
  }).filter((d) => d.group);
}

// --- colour ---

// Follow the site theme: an explicit toggle wins over the system setting
const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : dark.matches);
// Greens, after the original Observable dashboard: vascular plants in
// yellow-greens and bryophytes in blue-greens, each light to dark, so that
// neighbouring groups differ in both hue and lightness. A darker outline
// keeps the pale fills readable against the page.
const GREENS = ["#d9f0a3", "#78c679", "#238443", "#99d8c9", "#3aa38f", "#0b6b5f"];
const palette = () => ({ range: GREENS, edge: isDark() ? "#74c476" : "#31a354" });
const edge = () => ({ stroke: palette().edge, strokeWidth: 0.8 });
const groupScale = () => ({ type: "ordinal", domain: GROUPS, range: palette().range });
const kindScale = () => ({ type: "ordinal", domain: KINDS, range: [palette().range[0], palette().range[3]] });

// --- views ---

const state = { selected: null };
const widthOf = (id) => Math.max(260, $(id).clientWidth);
const tip = { format: { x: false, y: false, fill: false, fy: false } };

function mount(id, plot) {
  plot.addEventListener("click", () => {
    if (plot.value?.species) select(plot.value.species);
  });
  $(id).replaceChildren(plot);
}

// Horizontal progress bars: collected, then what is left, labelled with the share
function progress(id, rows, fill, scale) {
  const w = widthOf(id);
  mount(id, Plot.plot({
    width: w, height: 40 + rows.length * 40, marginLeft: Math.min(170, w * 0.4), marginRight: 44, marginBottom: 32,
    x: { label: "Species →", grid: true, nice: true },
    y: { domain: rows.map((r) => r.label), label: null, tickSize: 0 },
    color: scale,
    marks: [
      Plot.barX(rows, { y: "label", x: "total", fill: "none", stroke: "currentColor", strokeOpacity: 0.35, strokeDasharray: "3,2", insetTop: 6, insetBottom: 6, rx: 3 }),
      Plot.barX(rows, { y: "label", x: "done", fill, ...edge(), insetTop: 6, insetBottom: 6, rx: 3,
        channels: { Collected: (d) => `${int(d.done)} of ${int(d.total)} (${pc(d.done, d.total)})` }, tip: { format: { x: false, y: true, fill: false } } }),
      Plot.text(rows, { y: "label", x: "total", text: (d) => pc(d.done, d.total), dx: 6, textAnchor: "start", fill: "currentColor", fontWeight: 600 }),
      Plot.ruleX([0]),
    ],
  }));
}

function render() {
  const targets = taxa.filter((d) => d.status.startsWith("dtol"));
  const got = taxa.filter((d) => d.collected);
  const tColl = targets.filter((d) => d.collected);
  const extras = got.length - tColl.length;
  $("legend").innerHTML = GROUPS.map((g, i) => `<span><i style="background:${GREENS[i]};border-color:${palette().edge}"></i>${g}</span>`).join("");

  // Tiles
  const kindFam = (k) => {
    const fams = d3.group(targets.filter((d) => d.kind === k), (d) => d.family);
    return [[...fams.values()].filter((g) => g.some((d) => d.collected)).length, fams.size];
  };
  const [vf, vt] = kindFam("Vascular plants"), [bf, bt] = kindFam("Bryophytes");
  const lastYear = d3.max(got, (d) => d.year);
  $("tiles").innerHTML = [
    [int(got.length), "species collected in all"],
    [pc(tColl.length, targets.length), `of the ${int(targets.length)} target species`],
    [`${vf}<small>/${vt}</small>`, "vascular plant families collected"],
    [`${bf}<small>/${bt}</small>`, "bryophyte families collected"],
    [int(got.filter((d) => d.year === lastYear).length), `species first collected in ${lastYear}`],
    [int(cv.length), "species with a flow cytometry genome size"],
  ].map(([a, b]) => `<div class="gs-tile"><b>${a}</b><span>${b}</span></div>`).join("");

  // 1. Progress by group and by priority
  const byGroup = GROUPS.map((g) => {
    const t = targets.filter((d) => d.group === g);
    return { label: g, group: g, total: t.length, done: t.filter((d) => d.collected).length };
  }).filter((r) => r.total);
  progress("plot1", byGroup, (r) => r.group, groupScale());
  const byStatus = KINDS.flatMap((k) => Object.entries(STATUS).map(([s, label]) => {
    const t = targets.filter((d) => d.kind === k && d.status === s);
    return { label: `${k === "Bryophytes" ? "Bryophytes" : "Vascular"}: ${SHORT[s]}`, kind: k, family: s === "dtol_family_representative", total: t.length, done: t.filter((d) => d.collected).length };
  })).filter((r) => r.total);
  progress("plot2", byStatus, (r) => r.kind, kindScale());
  const fam = byStatus.filter((r) => r.family);
  const vasc = byGroup.filter((r) => !/Moss|Liver|Horn/.test(r.group)), bryo = byGroup.filter((r) => /Moss|Liver|Horn/.test(r.group));
  const share = (rs) => pc(d3.sum(rs, (r) => r.done), d3.sum(rs, (r) => r.total));
  $("note1").innerHTML = `${int(tColl.length)} of the ${int(targets.length)} species on the target list have been collected: ${share(vasc)} of vascular plants and ${share(bryo)} of bryophytes. Family representatives, one chosen species for each family, come first, and ${fam.map((r) => `${pc(r.done, r.total)} of ${r.kind === "Bryophytes" ? "bryophyte" : "vascular plant"} families`).join(" and ")} now have theirs. A further ${int(extras)} species have been collected that are not on the target list, mostly introduced vascular plants.`;

  // 2. By year
  const dated = got.filter((d) => d.year);
  const years = d3.range(d3.min(dated, (d) => d.year), lastYear + 1);
  const perYear = d3.rollups(dated, (v) => v.length, (d) => d.year, (d) => d.group).flatMap(([year, g]) => g.map(([group, n]) => ({ year, group, n })));
  mount("plot3", Plot.plot({
    width: widthOf("plot3"), height: 320, marginLeft: 44, marginBottom: 32,
    x: { domain: years, label: null, tickFormat: (d) => String(d) }, y: { label: "↑ Species", grid: true },
    color: groupScale(),
    marks: [
      Plot.barY(perYear, { x: "year", y: "n", fill: "group", ...edge(), order: GROUPS, inset: 0.5, tip: { format: { x: true, y: true, fill: true } } }),
      Plot.ruleY([0]),
    ],
  }));
  const cum = KINDS.flatMap((k) => {
    let run = 0;
    return years.map((year) => ({ kind: k, year, n: (run += dated.filter((d) => d.kind === k && d.year === year).length) }));
  });
  mount("plot4", Plot.plot({
    width: widthOf("plot4"), height: 320, marginLeft: 48, marginRight: 96, marginBottom: 32,
    x: { domain: d3.extent(years), label: null, tickFormat: "d", ticks: years.filter((y) => y % (years.length > 7 ? 2 : 1) === 0) }, y: { label: "↑ Species", grid: true },
    color: kindScale(),
    marks: [
      Plot.areaY(cum, { x: "year", y: "n", fill: "kind", ...edge(), order: KINDS, curve: "monotone-x", tip: { format: { x: true, fill: true } } }),
      Plot.text(cum.filter((d) => d.year === lastYear), Plot.stackY({ x: "year", y: "n", z: "kind", order: KINDS, text: (d) => `${d.kind}\n${int(d.n)}`, dx: 8, textAnchor: "start", fill: "currentColor", lineAnchor: "middle" })),
      Plot.ruleY([0]),
    ],
  }));
  const best = d3.greatest(d3.rollups(dated, (v) => v.length, (d) => d.year), (d) => d[1]);
  const recent = d3.rollup(dated.filter((d) => d.year >= lastYear - 2), (v) => v.length, (d) => d.kind);
  $("note2").innerHTML = `The busiest season so far was ${best[0]}, with ${int(best[1])} species collected for the first time. With most of the vascular plant list done, recent seasons have turned to bryophytes: ${int(recent.get("Bryophytes") ?? 0)} bryophytes and ${int(recent.get("Vascular plants") ?? 0)} vascular plants were first collected from ${lastYear - 2} to ${lastYear}.`;

  // 3. Families: size of the target list against the share collected
  const fams = d3.groups(targets, (d) => d.kind, (d) => d.family).flatMap(([kind, fs]) => fs.map(([family, t]) => ({
    family, kind, group: d3.greatest(d3.rollups(t, (v) => v.length, (d) => d.group), (d) => d[1])[0],
    total: t.length, done: t.filter((d) => d.collected).length,
  }))).map((f) => ({ ...f, share: f.done / f.total }));
  const w5 = widthOf("plot5");
  const labelled = fams.slice().sort((a, b) => d3.descending(a.total, b.total)).slice(0, 8);
  mount("plot5", Plot.plot({
    width: w5, height: 440, marginLeft: 48, marginRight: 24, marginBottom: 40,
    x: { type: "log", label: "Target species in the family →", ticks: [1, 2, 5, 10, 20, 50, 100, 200], tickFormat: "d", grid: true },
    y: { domain: [0, 1], inset: 8, tickFormat: "%", label: "↑ Share collected", grid: true },
    color: groupScale(),
    marks: [
      Plot.ruleY([1], { stroke: "currentColor", strokeOpacity: 0.3 }),
      // Small families pile up on whole-number counts, so jitter them a little
      Plot.dot(fams, {
        x: (d) => d.total * (1 + (hash(d.family) - 0.5) * 0.16),
        y: (d) => Math.min(1, Math.max(0, d.share + (hash(d.family + "y") - 0.5) * 0.03)),
        r: 4.5, fill: "group", ...edge(),
        channels: { Family: "family", Collected: (d) => `${d.done} of ${d.total} (${pc(d.done, d.total)})` },
        tip: { format: { x: false, y: false, fill: false } },
      }),
      Plot.text(labelled, { x: "total", y: "share", text: "family", dy: -11, fill: "currentColor", fontSize: 11, stroke: "var(--plot-background)", strokeWidth: 2.5 }),
    ],
  }));
  const none = fams.filter((f) => f.done === 0).sort((a, b) => d3.descending(a.total, b.total));
  const big = fams.filter((f) => f.total >= 20).sort((a, b) => d3.ascending(a.share, b.share)).slice(0, 3);
  $("note3").innerHTML = `Each dot is a family on the target list, placed by how many target species it has and what share of them have been collected. Most small families are complete, and the largest gaps are in big families: ${big.map((f) => `${esc(f.family)} (${f.done} of ${f.total})`).join(", ")}.`;
  $("cav3").innerHTML = none.length
    ? `${none.length} target ${none.length === 1 ? "family has" : "families have"} no species collected yet: ${none.map((f) => esc(f.family)).join(", ")}.`
    : "Every family on the target list has at least one species collected.";

  // 4. Genome sizes
  const w6 = widthOf("plot6");
  const cvGroups = GROUPS.filter((g) => cv.some((d) => d.group === g));
  const ticks = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].filter((t) => t >= d3.min(cv, (d) => d.gb) / 1.5 && t <= d3.max(cv, (d) => d.gb) * 1.5);
  const r = w6 < 600 ? 1.7 : 2.2;
  mount("plot6", Plot.plot({
    width: w6, height: cvGroups.length * (w6 < 600 ? 100 : 135) + 50, marginLeft: w6 < 600 ? 10 : 130, marginBottom: 38, marginTop: 10,
    x: { type: "log", label: "1C genome size →", ticks, tickFormat: (d) => (d < 1 ? d * 1000 + " Mb" : d + " Gb"), grid: true },
    fy: { domain: cvGroups, label: null, axis: w6 < 600 ? null : "left", padding: 0.08 },
    color: groupScale(),
    marks: [
      Plot.dot(cv, Plot.dodgeY("middle", { x: "gb", fy: "group", r, fill: "group", ...edge(), strokeWidth: 0.6, sort: "gb",
        channels: { Species: "species", Family: "family", "1C": (d) => gb(d.gb) }, tip: { format: { x: false, fill: false, fy: false } } })),
      w6 < 600 ? Plot.text(cvGroups, { fy: (d) => d, text: (d) => d, frameAnchor: "top-left", dy: 2, fill: "currentColor", fontWeight: 600 }) : null,
      Plot.tickX(cvGroups.map((g) => ({ group: g, gb: d3.median(cv.filter((d) => d.group === g), (d) => d.gb) })), { x: "gb", fy: "group", stroke: "currentColor", strokeWidth: 1.5, strokeOpacity: 0.7 }),
      selected(cv, { x: "gb", fy: "group" }),
    ].filter(Boolean),
  }));
  const med = (g) => gb(d3.median(cv.filter((d) => d.group === g), (d) => d.gb));
  const small = d3.least(cv, (d) => d.gb), large = d3.greatest(cv, (d) => d.gb);
  $("note4").innerHTML = `Flow cytometry has now given a genome size for ${int(cv.length)} species, a ${d3.format(",.0f")(Math.round(large.gb / small.gb / 10) * 10)}-fold range from <i>${esc(small.species)}</i> (${gb(small.gb)}) to <i>${esc(large.species)}</i> (${gb(large.gb)}). The line in each row marks the median: ${med("Flowering plants")} for flowering plants, against ${med("Mosses")} for bryophytes.`;

  renderDetail();
}

// A stable pseudo-random number in [0, 1) for each name, used to jitter dots
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function selected(data, opts) {
  const sel = data.filter((d) => d.species === state.selected);
  return sel.length ? Plot.dot(sel, Plot.dodgeY("middle", { ...opts, r: 7, fill: "none", stroke: "currentColor", strokeWidth: 2 })) : null;
}

function renderDetail() {
  const name = state.selected;
  const t = bySpecies.get(name), c = cv.find((d) => d.species === name);
  $("detail").hidden = !name;
  if (!name) return;
  const row = (k, v) => (v == null || v === "" ? "" : `<dt>${k}</dt><dd>${esc(v)}</dd>`);
  const status = t ? (t.status === "dtol" ? "On the target list" : STATUS[t.status] ? `Target list: ${STATUS[t.status].toLowerCase().replace(/s$/, "")}` : "Not on the target list") : "Not on either collection list";
  $("detail").innerHTML = `<button class="gs-close" type="button" aria-label="Close">×</button>
    <h3>${esc(name)}</h3><p>${esc([t?.family ?? c?.family, t?.group ?? c?.group].filter(Boolean).join(" · "))}</p>
    <dl>${row("Collected", t ? (t.collected ? "Yes" + (t.year ? `, first in ${t.year}` : "") : "Not yet") : null)}
    ${row("Status", status)}${row("Native status", t?.native)}${row("1C genome size", c ? gb(c.gb) : null)}${row("Measured by", c?.measuredBy)}</dl>
    ${t?.notes ? `<p class="gs-flag">${esc(t.notes)}</p>` : ""}`;
}

function select(name) {
  state.selected = state.selected === name ? null : name;
  render();
}

// --- start ---

const load = (url) => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(r.status))).then(d3.csvParse);
const [vRows, bRows, cRows] = await Promise.all([load(URLS.vascular), load(URLS.bryophyte), load(URLS.cvalue).catch(() => null)]).catch(() => []);
if (!vRows || !bRows) {
  $("status").textContent = "The collection spreadsheets could not be loaded just now. Please try again later.";
  throw new Error("collection data unavailable");
}
const taxa = [...vascular(vRows), ...bryophyte(bRows)];
const bySpecies = new Map(taxa.map((d) => [d.species, d]));
const cv = cRows ? cvalues(cRows, bySpecies) : [];

$("status").remove();
$("app").hidden = false;
const names = [...new Set([...taxa.map((d) => d.species), ...cv.map((d) => d.species)])].sort(d3.ascending);
$("names").replaceChildren(...names.map((value) => Object.assign(document.createElement("option"), { value })));
$("search").addEventListener("change", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const hit = names.find((n) => n.toLowerCase() === q) || names.find((n) => n.toLowerCase().startsWith(q));
  if (q && hit) { state.selected = hit; render(); }
});
$("detail").addEventListener("click", (e) => {
  if (e.target.closest(".gs-close")) select(state.selected);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.selected) select(state.selected);
});
let lastWidth = innerWidth;
addEventListener("resize", () => {
  if (innerWidth !== lastWidth) { lastWidth = innerWidth; render(); }
});
dark.addEventListener("change", render);
new MutationObserver(render).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
render();
