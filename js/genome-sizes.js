// genome-sizes.js: DToL plant genome sizes, drawn with Observable Plot. The data
// are read live from the plant-sequencing-status pipeline, which updates weekly.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm";
import { addDownloads } from "./plot-download.js";

const DATA_URL =
  "https://dtol-plant-working-group.github.io/plant-sequencing-status/data/all_genome_size_data.tsv";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};
const gb = (v) =>
  v == null
    ? "–"
    : v >= 10
      ? d3.format(".1f")(v) + " Gb"
      : v >= 1
        ? d3.format(".2f")(v) + " Gb"
        : d3.format(".0f")(v * 1000) + " Mb";
const fold = (v) =>
  v == null
    ? "–"
    : "×" +
      (v >= 100
        ? d3.format(",.0f")(v)
        : v >= 10
          ? d3.format(".0f")(v)
          : d3.format(".2f")(v));
const pct = (v) => (v == null ? "–" : d3.format(".1f")(v) + "%");

// A GenomeScope fit this far from the assembly has almost certainly failed
const FAILED_FOLD = 8;
// Log-scale limits, in Gb, shared by the scatter plots
const DOMAIN = [0.08, 130];
const CLADES = {
  d: "Dicots",
  l: "Monocots",
  c: "Non-vascular",
  v: "Other vascular",
};
const LEVEL_RANK = { Chromosome: 3, Scaffold: 2, Contig: 1 };

// --- data ---

// Assemblies are joined to GenomeScope by species alone, so a species with
// several sequenced specimens repeats each assembly once per specimen. Keep
// the row whose ToLID matches the assembly, and flag those that have none.
function bestRows(raw) {
  const byAssembly = d3.group(
    raw.filter((d) => !/alternate/.test(d.assembly)),
    (d) => d.assembly,
  );
  return [...byAssembly.values()].map((rows) => {
    const tolid = rows[0].assembly.split(".")[0];
    const match = rows.find((d) => d.tolid === tolid);
    return {
      ...(match || rows[0]),
      asmTolid: tolid,
      otherSpecimen: !match && !!rows[0].tolid,
    };
  });
}

function toSpecies(rows) {
  return d3
    .groups(rows, (d) => d.species)
    .map(([species, group]) => {
      // Best level first, then primary or hap1 over the other haplotypes
      const hapRank = (d) => (/\.hap[2-9]/.test(d.assembly) ? 1 : 0);
      const r = group
        .slice()
        .sort(
          (a, b) =>
            d3.descending(LEVEL_RANK[a.level], LEVEL_RANK[b.level]) ||
            d3.ascending(hapRank(a), hapRank(b)) ||
            d3.ascending(a.assembly, b.assembly),
        )[0];
      const asm = num(r.assembly_ungapped_length) / 1e9;
      const gsMax = num(r.Genome_Haploid_Length_max_bp),
        gsMin = num(r.Genome_Haploid_Length_min_bp);
      const gs = gsMax != null ? gsMax / 1e9 : undefined;
      const c1 = num(r["1C/Gbp"]);
      const hetLo = num(r.Heterozygous_ab_min),
        hetHi = num(r.Heterozygous_ab_max);
      const repLo = num(r.Genome_Repeat_Length_min_bp),
        repHi = num(r.Genome_Repeat_Length_max_bp);
      const failed =
        gs != null && (asm / gs > FAILED_FOLD || asm / gs < 1 / FAILED_FOLD);
      const usable = !failed && !r.otherSpecimen;
      const haps = group.filter((d) => d.assembly.split(".")[0] === r.asmTolid);
      const estimates = [asm, usable ? gs : undefined, c1].filter((v) => v > 0);
      return {
        species,
        assembly: r.assembly,
        level: r.level,
        clade: CLADES[r.assembly[0]] ?? "Other vascular",
        asm,
        gs: usable ? gs : undefined,
        rawGs: gs,
        c1,
        failed,
        otherSpecimen: r.otherSpecimen,
        p: r.p ? String(+r.p) : undefined,
        het: hetLo != null && hetHi != null ? (hetLo + hetHi) / 2 : undefined,
        repeat:
          usable && repLo != null && gsMax
            ? (100 * (repLo + repHi)) / (gsMax + (gsMin ?? gsMax))
            : undefined,
        fit: num(r.Model_Fit_max_percent),
        family: r.Family || undefined,
        measuredBy: r["measured by"] || undefined,
        standard: r.Standard || undefined,
        comment: r["Comments on DToL sample"] || undefined,
        haps: haps.map((d) => ({
          name: d.assembly,
          len: num(d.assembly_ungapped_length) / 1e9,
        })),
        ratioGs: usable && gs ? asm / gs : undefined,
        ratio1C: c1 && asm ? c1 / asm : undefined,
        discord: d3.max(estimates) / d3.min(estimates),
      };
    });
}

// --- colour ---

// Follow the site theme: an explicit toggle wins over the system setting
const root = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () =>
  root.dataset.theme ? root.dataset.theme === "dark" : dark.matches;
const palette = () =>
  isDark()
    ? {
        blue: "#3987e5",
        orange: "#d95926",
        aqua: "#199e70",
        yellow: "#c98500",
        magenta: "#d55181",
        violet: "#9085e9",
        ramp: ["#6da7ec", "#4a534e", "#f0884f"],
        none: "#2a332e",
      }
    : {
        blue: "#2a78d6",
        orange: "#eb6834",
        aqua: "#1baf7a",
        yellow: "#eda100",
        magenta: "#e87ba4",
        violet: "#6250d6",
        ramp: ["#1c5cab", "#d9d6cc", "#d4491b"],
        none: "#ece9e1",
      };

function colorSpec() {
  const c = palette();
  const specs = {
    p: {
      value: (d) => d.p,
      label: "GenomeScope ploidy (p)",
      domain: ["1", "2", "3", "4", "5", "6"],
      range: [c.aqua, c.blue, c.magenta, c.orange, c.violet, c.yellow],
    },
    clade: {
      value: (d) => d.clade,
      label: "Plant group",
      domain: Object.values(CLADES),
      range: [c.blue, c.orange, c.aqua, c.yellow],
    },
    het: {
      value: (d) => d.het,
      label: "Heterozygosity (%), fitted for p = 2 only",
      linear: true,
      type: "diverging-symlog",
    },
    repeat: {
      value: (d) => d.repeat,
      label: "Repeat content (%)",
      linear: true,
      type: "diverging",
    },
    fit: {
      value: (d) => d.fit,
      label: "GenomeScope model fit (%)",
      linear: true,
      type: "diverging",
    },
  };
  const s = specs[state.colorBy];
  // Continuous measures diverge around the median and span the middle 90% of
  // species, so the bulk of the data isn't flattened by a few extreme values
  if (s.linear) {
    const v = species
      .map(s.value)
      .filter((x) => x != null)
      .sort(d3.ascending);
    s.pivot = d3.quantileSorted(v, 0.5);
    s.domain = [d3.quantileSorted(v, 0.05), d3.quantileSorted(v, 0.95)];
  }
  s.scale = s.linear
    ? {
        type: s.type,
        domain: s.domain,
        pivot: s.pivot,
        interpolate: d3.piecewise(d3.interpolateRgb, c.ramp),
        clamp: true,
        unknown: c.none,
        label: s.label,
        ...(s.type === "diverging-symlog" ? { constant: 0.25 } : {}),
      }
    : {
        type: "ordinal",
        domain: s.domain,
        range: s.range,
        unknown: c.none,
        label: s.label,
      };
  return s;
}

// --- shared plot pieces ---

const state = {
  colorBy: "p",
  hidden: new Set(),
  selected: null,
  sort: "discord",
  dir: -1,
  rows: 12,
};
const widthOf = (id) => Math.max(260, $(id).clientWidth);
const logAxis = (label) => ({
  type: "log",
  domain: DOMAIN,
  label,
  ticks: [0.1, 0.3, 1, 3, 10, 30, 100],
  tickFormat: (d) => (d < 1 ? d * 1000 + " Mb" : d + " Gb"),
});

function refLines(multiples) {
  return multiples.flatMap(({ k, label }) => {
    const x0 = Math.max(DOMAIN[0], DOMAIN[0] / k),
      x1 = Math.min(DOMAIN[1], DOMAIN[1] / k);
    const seg = [
      { x: x0, y: x0 * k },
      { x: x1, y: x1 * k },
    ];
    return [
      Plot.line(seg, {
        x: "x",
        y: "y",
        stroke: "currentColor",
        strokeOpacity: k === 1 ? 0.55 : 0.3,
        strokeDasharray: k === 1 ? null : "4,3",
      }),
      Plot.text([seg[1]], {
        x: "x",
        y: "y",
        text: () => label,
        dx: -6,
        dy: 9,
        textAnchor: "end",
        fill: "currentColor",
        fontSize: 11,
      }),
    ];
  });
}

function tipChannels(extra) {
  return {
    Species: "species",
    Assembly: (d) => gb(d.asm),
    GenomeScope: (d) => gb(d.gs),
    "1C": (d) => gb(d.c1),
    "Ploidy (p)": (d) => d.p ?? "–",
    ...extra,
  };
}

function dots(data, opts, spec, extraTip) {
  return Plot.dot(data, {
    r: 3.6,
    fill: spec.value,
    fillOpacity: 0.9,
    // Draw the most extreme values last so they aren't buried
    sort: spec.linear
      ? (d) =>
          spec.value(d) == null ? -1 : Math.abs(spec.value(d) - spec.pivot)
      : undefined,
    stroke: "var(--plot-background)",
    strokeWidth: 0.6,
    clip: true,
    channels: tipChannels(extraTip),
    tip: { format: { x: false, y: false, fill: false, r: false } },
    ...opts,
  });
}

function selection(data, opts) {
  const sel = data.filter((d) => d.species === state.selected);
  return [
    Plot.dot(sel, {
      r: 8,
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      clip: true,
      ...opts,
    }),
    Plot.text(sel, {
      ...opts,
      text: "species",
      dy: -14,
      fill: "currentColor",
      fontStyle: "italic",
      fontWeight: 600,
      stroke: "var(--plot-background)",
      strokeWidth: 3,
    }),
  ];
}

function mount(id, plot) {
  plot.addEventListener("click", () => {
    if (plot.value && plot.value.species) select(plot.value.species);
  });
  $(id).replaceChildren(plot);
}

// Stacked histogram of fold differences on a log2 axis, by the colour in use
function foldHist(id, data, value, spec, ticks) {
  const shown = data.filter((d) => Math.abs(Math.log2(value(d))) <= 3);
  const categorical = !spec.linear;
  mount(
    id,
    Plot.plot({
      width: widthOf(id),
      height: 330,
      marginLeft: 38,
      marginBottom: 38,
      x: {
        domain: [-3, 3],
        ticks,
        tickFormat: (d) => "×" + (d < 0 ? "1/" + 2 ** -d : 2 ** d),
        label: null,
      },
      y: { label: "Species", grid: true },
      color: categorical ? spec.scale : undefined,
      marks: [
        Plot.rectY(
          shown,
          Plot.binX(
            { y: "count" },
            {
              x: (d) => Math.log2(value(d)),
              thresholds: d3.range(-3, 3.01, 0.2),
              fill: categorical ? spec.value : palette().blue,
              inset: 0.5,
              tip: true,
            },
          ),
        ),
        ...ticks.map((t) =>
          Plot.ruleX([t], {
            stroke: "currentColor",
            strokeOpacity: t === 0 ? 0.55 : 0.25,
            strokeDasharray: t === 0 ? null : "4,3",
          }),
        ),
        Plot.ruleY([0]),
      ],
    }),
  );
}

// --- views ---

function current() {
  return species.filter((d) => !state.hidden.has(d.clade));
}

function render() {
  const data = current();
  const spec = colorSpec();
  renderLegend(spec);
  renderTiles(data);

  // 1. GenomeScope against the assembly
  const withGs = data.filter((d) => d.gs >= DOMAIN[0]);
  const xy1 = { x: "gs", y: "asm" };
  mount(
    "plot1",
    Plot.plot({
      width: widthOf("plot1"),
      height: 460,
      marginLeft: 58,
      marginBottom: 42,
      grid: true,
      x: logAxis("GenomeScope length →"),
      y: logAxis("↑ Assembly length"),
      color: spec.scale,
      marks: [
        ...refLines([
          { k: 1, label: "1:1" },
          { k: 2, label: "2:1" },
          { k: 4, label: "4:1" },
        ]),
        dots(withGs, xy1, spec),
        ...selection(withGs, xy1),
      ],
    }),
  );
  foldHist(
    "hist1",
    data.filter((d) => d.ratioGs),
    (d) => d.ratioGs,
    spec,
    [-2, -1, 0, 1, 2],
  );

  const near = (v, k) => v != null && Math.abs(Math.log2(v / k)) < 0.3;
  const n1 = data.filter((d) => near(d.ratioGs, 1)),
    n2 = data.filter((d) => near(d.ratioGs, 2));
  const n2p = n2.filter((d) => d.p === "4").length,
    n2d = n2.filter((d) => d.p === "2");
  const n2flow = d3.median(
    n2d.filter((d) => d.ratio1C),
    (d) => d.ratio1C,
  );
  const fitted = data.filter((d) => d.ratioGs).length;
  $("note1").textContent =
    `Of ${fitted} species with a usable fit, ${n1.length} sit on the 1:1 line and ${n2.length} on the 2:1 line. ` +
    `GenomeScope reports one monoploid set, so an assembly holding two subgenomes lands on the 2:1 line, and ${n2p} of those species were fitted as tetraploid. ` +
    `The other ${n2d.length} on that line were fitted as diploid, but with a median heterozygosity of ${pct(d3.median(n2d, (d) => d.het))} against ${pct(
      d3.median(
        n1.filter((d) => d.p === "2"),
        (d) => d.het,
      ),
    )} for diploid fits on the 1:1 line` +
    (n2flow != null
      ? `. Where they have a flow cytometry record, 1C is ${fold(n2flow)} the assembly length, the same as the dataset as a whole. That suggests the assemblies are about right and GenomeScope has found half the genome, as it might if divergent subgenomes of a polyploid were modelled as heterozygous haplotypes.`
      : ".");
  const failed = data.filter((d) => d.failed).length,
    other = data.filter((d) => d.otherSpecimen).length;
  const left = [
    failed &&
      `${failed} species whose GenomeScope length differs from the assembly by more than ${FAILED_FOLD}-fold, treated as a failed fit`,
    other && `${other} with GenomeScope data from a different specimen only`,
  ].filter(Boolean);
  $("cav1").textContent = left.length
    ? `Left out of these two panels, but listed in the table below: ${left.join(", and ")}.`
    : "";

  // 2. Flow cytometry against the assembly
  const withC = data.filter((d) => d.c1);
  const xy2 = { x: "asm", y: "c1" };
  mount(
    "plot2",
    Plot.plot({
      width: widthOf("plot2"),
      height: 460,
      marginLeft: 58,
      marginBottom: 42,
      grid: true,
      x: logAxis("Assembly length →"),
      y: logAxis("↑ 1C genome size"),
      color: spec.scale,
      marks: [
        ...refLines([
          { k: 1, label: "1:1" },
          { k: 2, label: "2:1" },
        ]),
        dots(withC, xy2, spec),
        ...selection(withC, xy2),
      ],
    }),
  );
  foldHist("hist2", withC, (d) => d.ratio1C, spec, [-1, 0, 1, 2]);
  const med = d3.median(withC, (d) => d.ratio1C);
  const above = withC.filter((d) => d.ratio1C > 1).length;
  $("note2").innerHTML = withC.length
    ? `${d3.format(".0%")(above / withC.length)} of the ${withC.length} species with a flow cytometry record lie above the 1:1 line: the typical 1C value is ${fold(med)} the assembly length. ` +
      `Some of that gap is unassembled sequence, such as satellite arrays and rDNA. Some is probably calibration: many plant flow cytometry standards trace back to older reference values that look inflated next to modern telomere-to-telomere and haplotype-resolved assemblies ` +
      `(<a href="https://doi.org/10.3389/fpls.2025.1548766">Soni &amp; Henry 2025</a>). The C-values here are shown as measured, without recalibration.`
    : "None of the species in this view have a flow cytometry record.";
  $("cav2").textContent =
    "1C is the C-value database's 1C/Gbp column, using each species' most recent measurement. Flow cytometry and sequencing often used different individuals.";

  // 3. Repeats against size, with a running median
  const withR = data.filter((d) => d.repeat != null);
  const sorted = withR.slice().sort((a, b) => a.asm - b.asm);
  const size = Math.max(5, Math.floor(sorted.length / 9));
  const trend = d3
    .range(0, Math.max(0, sorted.length - size + 1), size)
    .map((i) => {
      const bin = sorted.slice(i, i + size);
      return {
        x: d3.median(bin, (d) => d.asm),
        y: d3.median(bin, (d) => d.repeat),
      };
    });
  const xy3 = { x: "asm", y: "repeat" };
  mount(
    "plot3",
    Plot.plot({
      width: widthOf("plot3"),
      height: 400,
      marginLeft: 48,
      marginBottom: 42,
      grid: true,
      x: logAxis("Assembly length →"),
      y: { domain: [0, 100], label: "↑ Repeat content (%)" },
      color: spec.scale,
      marks: [
        dots(withR, xy3, spec, { Repeats: (d) => pct(d.repeat) }),
        Plot.line(trend, {
          x: "x",
          y: "y",
          stroke: "currentColor",
          strokeWidth: 2.5,
          curve: "monotone-x",
        }),
        Plot.text(trend.slice(-1), {
          x: "x",
          y: "y",
          text: () => "median",
          dy: -10,
          fill: "currentColor",
          fontWeight: 600,
        }),
        ...selection(withR, xy3),
      ],
    }),
  );
  const lo = trend[0],
    hi = trend[trend.length - 1];
  $("note3").textContent =
    trend.length > 1
      ? `Median repeat content climbs from ${pct(lo.y)} in genomes around ${gb(lo.x)} to ${pct(hi.y)} around ${gb(hi.x)}, in line with repeat expansion driving genome size.`
      : "Too few species in this view to show a trend.";
  $("cav3").textContent =
    "Repeat content is GenomeScope's repeat length as a share of its haploid length, so it is limited by k = 31 and leaves out failed fits. The line joins medians of equal-sized groups of species.";

  // 4. Families, largest median first
  const families = d3
    .rollups(
      data.filter((d) => d.family),
      (v) => ({ n: v.length, median: d3.median(v, (d) => d.asm) }),
      (d) => d.family,
    )
    .filter(([, v]) => v.n >= 5)
    .sort((a, b) => d3.descending(a[1].n, b[1].n))
    .slice(0, 16)
    .sort((a, b) => d3.descending(a[1].median, b[1].median));
  const names = families.map(([f]) => f);
  const fam = data.filter((d) => names.includes(d.family));
  const xy4 = { x: "asm", y: "family" };
  mount(
    "plot4",
    Plot.plot({
      width: widthOf("plot4"),
      height: Math.max(160, names.length * 28 + 50),
      marginLeft: 128,
      marginBottom: 38,
      x: { ...logAxis("Assembly length →"), grid: true },
      y: {
        domain: names,
        label: null,
        tickFormat: (f) => `${f} (${families.find((x) => x[0] === f)[1].n})`,
      },
      color: spec.scale,
      marks: [
        dots(fam, xy4, spec),
        Plot.tickX(families, {
          x: (d) => d[1].median,
          y: (d) => d[0],
          stroke: "currentColor",
          strokeWidth: 2.5,
        }),
        ...selection(fam, xy4),
      ],
    }),
  );
  $("note4").textContent = names.length
    ? `The ${names.length} largest families in this view, by species count, ordered by median assembly length (black tick). Genome size varies more than ${fold(
        d3.max(families, ([f]) => {
          const v = fam.filter((d) => d.family === f).map((d) => d.asm);
          return d3.max(v) / d3.min(v);
        }),
      )} within a single family here.`
    : "Too few species in this view.";

  renderTable(data);
  renderDetail();
}

function renderLegend(spec) {
  $("legend").replaceChildren(
    Plot.legend({
      color: { ...spec.scale, label: spec.linear ? spec.label : undefined },
      width: 280,
      height: 40,
      tickSize: 0,
      marginBottom: 14,
    }),
  );
}

function renderTiles(data) {
  const small = d3.least(data, (d) => d.asm),
    big = d3.greatest(data, (d) => d.asm);
  const tiles = data.length
    ? [
        [d3.format(",")(data.length), "species in view"],
        [
          d3.format(",")(data.filter((d) => d.gs).length),
          "with a usable GenomeScope fit",
        ],
        [gb(d3.median(data, (d) => d.asm)), "median assembly length"],
        [gb(small.asm), `smallest: <i>${esc(small.species)}</i>`],
        [gb(big.asm), `largest: <i>${esc(big.species)}</i>`],
        [
          d3.format(",")(data.filter((d) => d.c1).length),
          "with flow cytometry",
        ],
      ]
    : [["0", "species in view"]];
  $("tiles").innerHTML = tiles
    .map(([a, b]) => `<div class="gs-tile"><b>${a}</b><span>${b}</span></div>`)
    .join("");
}

const COLS = [
  ["species", "Species", (d) => `<i>${esc(d.species)}</i>`, "l"],
  ["clade", "Group", (d) => esc(d.clade), "l"],
  ["asm", "Assembly", (d) => gb(d.asm)],
  ["rawGs", "GenomeScope", (d) => gb(d.rawGs)],
  ["c1", "1C", (d) => gb(d.c1)],
  ["p", "p", (d) => d.p ?? "–"],
  ["fit", "Model fit", (d) => pct(d.fit)],
  ["discord", "Discordance", (d) => fold(d.discord)],
  [
    "why",
    "Note",
    (d) => (d.failed ? "Failed fit?" : d.otherSpecimen ? "Other specimen" : ""),
    "l",
  ],
];

function renderTable(data) {
  $("thead").innerHTML =
    "<tr>" +
    COLS.map(
      ([k, label, , cls]) =>
        `<th class="${cls ?? ""}" aria-sort="${state.sort === k ? (state.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${k}">${label}${state.sort === k ? (state.dir > 0 ? " ↑" : " ↓") : ""}</button></th>`,
    ).join("") +
    "</tr>";
  const key = state.sort;
  const rows = data.slice().sort((a, b) => {
    const x = a[key],
      y = b[key];
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    return state.dir * d3.ascending(x, y);
  });
  $("tbody").innerHTML = rows
    .slice(0, state.rows)
    .map(
      (d) =>
        `<tr data-s="${esc(d.species)}">` +
        COLS.map(
          ([, , f, cls]) => `<td class="${cls ?? ""}">${f(d)}</td>`,
        ).join("") +
        "</tr>",
    )
    .join("");
  $("more").hidden = rows.length <= 12;
  $("more").textContent =
    state.rows < rows.length ? `Show all ${rows.length}` : "Show fewer";
}

function renderDetail() {
  const d = species.find((s) => s.species === state.selected);
  $("detail").hidden = !d;
  if (!d) return;
  const row = (k, v) =>
    v == null || v === "–" ? "" : `<dt>${k}</dt><dd>${esc(v)}</dd>`;
  const flags = [
    d.failed && `GenomeScope (${gb(d.rawGs)}) looks like a failed fit.`,
    d.otherSpecimen &&
      "GenomeScope data come from a different specimen of this species.",
    d.comment && `Flow cytometry note: ${d.comment}.`,
  ].filter(Boolean);
  $("detail").innerHTML =
    `<button class="gs-close" type="button" aria-label="Close">×</button>
    <h3>${esc(d.species)}</h3><p>${esc([d.family, d.clade].filter(Boolean).join(" · "))}</p>
    <dl>${row("Assembly", gb(d.asm))}${row("GenomeScope", gb(d.rawGs))}${row("1C", gb(d.c1))}
    ${row("Ploidy (p)", d.p)}${row("Heterozygosity", d.het == null ? null : pct(d.het))}${row("Repeats", d.repeat == null ? null : pct(d.repeat))}
    ${row("Model fit", d.fit == null ? null : pct(d.fit))}${row("Level", d.level)}${row("Measured by", d.measuredBy)}
    ${d.haps.map((h) => row(h.name, gb(h.len))).join("")}</dl>
    ${flags.map((f) => `<p class="gs-flag">${esc(f)}</p>`).join("")}`;
}

function select(name) {
  state.selected = state.selected === name ? null : name;
  render();
}

// --- start ---

const res = await fetch(DATA_URL).catch(() => null);
if (!res || !res.ok) {
  $("status").textContent =
    "The data could not be loaded just now. Please try again later.";
  throw new Error("genome size data unavailable");
}
const species = toSpecies(bestRows(d3.tsvParse(await res.text())));

$("names").replaceChildren(
  ...species
    .map((d) =>
      Object.assign(document.createElement("option"), { value: d.species }),
    )
    .sort((a, b) => d3.ascending(a.value, b.value)),
);
$("clades").replaceChildren(
  ...Object.values(CLADES).map((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = c;
    b.setAttribute("aria-pressed", "true");
    b.addEventListener("click", () => {
      const on = state.hidden.has(c);
      if (on) state.hidden.delete(c);
      else state.hidden.add(c);
      b.setAttribute("aria-pressed", String(on));
      render();
    });
    return b;
  }),
);
$("colorBy").addEventListener("change", (e) => {
  state.colorBy = e.target.value;
  render();
});
$("search").addEventListener("change", (e) => {
  const q = e.target.value.trim().toLowerCase();
  const hit =
    species.find((d) => d.species.toLowerCase() === q) ||
    species.find((d) => d.species.toLowerCase().startsWith(q));
  if (q && hit) {
    state.selected = hit.species;
    render();
  }
});
$("thead").addEventListener("click", (e) => {
  const k = e.target.closest("button")?.dataset.k;
  if (!k) return;
  state.dir =
    state.sort === k ? -state.dir : k === "species" || k === "clade" ? 1 : -1;
  state.sort = k;
  renderTable(current());
});
$("tbody").addEventListener("click", (e) => {
  const s = e.target.closest("tr")?.dataset.s;
  if (s) select(s);
});
$("more").addEventListener("click", () => {
  state.rows = state.rows === 12 ? Infinity : 12;
  renderTable(current());
});
$("detail").addEventListener("click", (e) => {
  if (e.target.closest(".gs-close")) select(state.selected);
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.selected) select(state.selected);
});
dark.addEventListener("change", render);
new MutationObserver(render).observe(root, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

$("status").remove();
$("app").hidden = false;
addDownloads($("app"), {
  colorLabel: () => $("colorBy").selectedOptions[0].text,
});
render();
let width = innerWidth,
  timer;
addEventListener("resize", () => {
  if (innerWidth === width) return;
  width = innerWidth;
  clearTimeout(timer);
  timer = setTimeout(render, 150);
});
