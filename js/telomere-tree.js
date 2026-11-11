// telomere-tree.js: Fig 1 of the telomere paper (tol_telomeres, shifts/figures/fig1_d3/fig1.js),
// for the web. a: the whole dated tree, circular. b, c: Coleoptera and Hymenoptera enlarged.
// Layout from lwPhylo, drawing from D3. All lengths are millimetres on the printed page: the
// viewBox is the page, so the SVG download is the print figure.
// Changes for the site: colours follow the site theme (the download is always the light,
// print version), clicking a tip opens that species, and the selected species keeps its path
// to the root highlighted.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { readTree, ladderize, radialLayout } from "./vendor/lwphylo.js";

const PT = 25.4 / 72; // 1 pt in mm
const FONT = 6 * PT;
const PAGE_W = 178,
  PAGE_H = 232;

// ---- settings ----
const CENTRE = [89, 87];
const OPEN_DEG = 16; // wedge left open for the time axis
const TREE_R = 60.5;
const TIME_STEP = 250; // Myr between bands in a
const RINGS = {
  state: { r: 62.3, w: 2.8 },
  tr: { r: 64.8, w: 1.3 },
  tert: { r: 66.4, w: 1.3 },
};
const CLADE_R = 67.7;
const LABEL_R = 69.2;
const CLADE_GAP_MM = 0.7;
const LABEL_MIN_DEG = 1.85; // smallest angle between clade labels
const MIN_TIP_MM = 0.3; // short runs of tips are drawn at least this wide
const BRANCH_WIDTH = 0.25 * PT;
const CARRIER_WIDTH = 0.85 * PT; // branch carrying a transition

const ROWS = [
  { group: "Coleoptera", panel: "b", top: 177 },
  { group: "Hymenoptera", panel: "c", top: 205 },
];
const ROW = { left: 10, right: 177, tree: 17, gap: 0.5, state: 1.7, band: 0.8 };

// Colours: light is the print figure; dark is the same roles stepped for a dark surface
export const THEMES = {
  light: {
    bg: "#ffffff",
    ink: "#0b0b0b",
    ink2: "#52514e",
    rule: "#8d8b84",
    guide: "#e6e4dc",
    band: "#f3f2ec",
    track: "#f3f2ec",
    branch: "#77756e",
    clade: ["#26251f", "#a3a198"],
    trOn: "#4a4944",
    states: {
      AACCT: "#2a78d6",
      AACCCT: "#1baf7a",
      AAACCCT: "#eda100",
      other: "#c2410c",
      lost: "#26251f",
      unknown: "#dedcd6",
    },
    tert: {
      found: "#e6e4dc",
      partial: "#f0a44b",
      absent: "#c62f4a",
      unresolved: "#8f8d86",
    },
    routes: { 1: "#6250d6", 2: "#e0457b", other: "#3f3e39" },
    links: ["#6cbcc1", "#0b5f66"], // shared end satellites, 75% to 100% identity
  },
  dark: {
    bg: "#18211c",
    ink: "#ebebe3",
    ink2: "#b3bbb4",
    rule: "#6f766f",
    guide: "#2a332e",
    band: "#1e2822",
    track: "#29322d",
    branch: "#8f978f",
    clade: ["#e6e4dc", "#6f766f"],
    trOn: "#c3c2b7",
    states: {
      AACCT: "#3987e5",
      AACCCT: "#199e70",
      AAACCCT: "#c98500",
      other: "#e0692f",
      lost: "#e6e4dc",
      unknown: "#39413c",
    },
    tert: {
      found: "#3f4741",
      partial: "#d98b2b",
      absent: "#e0566f",
      unresolved: "#8f8d86",
    },
    routes: { 1: "#9085e9", 2: "#e8689a", other: "#c3c2b7" },
    links: ["#2f6b70", "#8ee6eb"],
  },
};
export const STATES = [
  ["AACCT", "AACCT (TTAGG)"],
  ["AACCCT", "AACCCT (TTAGGG)"],
  ["AAACCCT", "AAACCCT (TTTAGGG)"],
  ["other", "other units"],
  ["lost", "telomerase lost"],
  ["unknown", "unknown or no data"],
];
const TERT = [
  ["found", "found"],
  ["partial", "partial"],
  ["absent", "absent"],
  ["unresolved", "unresolved"],
];
const ROUTES = [
  ["1", "one edit", d3.symbolCircle, 1],
  ["2", "expansion keeping old unit", d3.symbolTriangle, 1.5],
  ["other", "other", d3.symbolSquare, 0.9],
];
const ROUTE = Object.fromEntries(
  ROUTES.map((d) => [d[0], { label: d[1], shape: d[2], area: d[3] }]),
);
const SHORT_NAME = { "mosses, liverworts, ferns": "other plants" };
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function cladeLabel(name) {
  const row = ROWS.find((r) => r.group === name);
  return capitalise(SHORT_NAME[name] || name) + (row ? ` (${row.panel})` : "");
}

// Same clade groups as common.group_label() in export_data.py
const NAMED_ORDERS = new Set([
  "Lepidoptera",
  "Diptera",
  "Coleoptera",
  "Hymenoptera",
  "Hemiptera",
  "Trichoptera",
]);
export function groupLabel({ phylum, klass, order }) {
  if (phylum === "Streptophyta")
    return klass === "Magnoliopsida"
      ? "flowering plants"
      : "mosses, liverworts, ferns";
  if (phylum === "Basidiomycota" || phylum === "Ascomycota") return "fungi";
  if (phylum === "Chordata")
    return (
      { Mammalia: "mammals", Aves: "birds", Actinopteri: "ray-finned fish" }[
        klass
      ] || "other vertebrates"
    );
  if (phylum === "Arthropoda") {
    if (klass === "Insecta")
      return NAMED_ORDERS.has(order) ? order : "other insects";
    return order === "Araneae" ? "spiders" : "other arthropods";
  }
  return (
    {
      Echinodermata: "echinoderms",
      Mollusca: "molluscs",
      Annelida: "annelids",
      Cnidaria: "cnidarians",
    }[phylum] || "other"
  );
}

// The layout depends only on the tree, so it is computed once and shared by every render.
// Ladderizing also matters for the geometry: fanAngles() in lwPhylo 1.5.2 puts a parent on
// the wrong side of its arc when its children span more than 180 degrees, and on this tree
// the ladderized order has no such node.
export function prepare(newick, tipData, transitions) {
  const tree = ladderize(readTree(newick));
  const layout = radialLayout(tree, { openAngleDeg: OPEN_DEG });
  const nodes = layout.data;
  const byId = new Map(nodes.map((d) => [d.thisId, d]));
  const height = d3.max(nodes, (d) => d.r); // root age, Myr
  const ageOf = (d) => height - d.r;
  const tips = nodes.filter((d) => d.isTip).sort((a, b) => a.angle - b.angle);
  const step =
    (tips[tips.length - 1].angle - tips[0].angle) / (tips.length - 1);
  tips.forEach((d, i) => {
    d.index = i;
    d.info = tipData.get(d.thisLabel) || {
      cat: "unknown",
      unit: "",
      tr: false,
      tert: null,
      group: "",
      noData: true,
    };
  });
  const tipByName = new Map(tips.map((d) => [d.thisLabel, d]));
  const ancestors = (node) => {
    const out = [];
    for (let n = node; n; n = byId.get(n.parentId)) out.push(n);
    return out;
  };
  const mrca = (names) => {
    const paths = names.map((n) => ancestors(tipByName.get(n)));
    const shared = new Set(paths[0].map((d) => d.thisId));
    if (paths.length === 1) return paths[0][0];
    return paths[1].find((d) => shared.has(d.thisId));
  };
  // The table's node_tips pair does not always span the transition's node (4 cases, where
  // its MRCA is younger than crown_myr), so the table's own age picks the node.
  const transitionNode = (t) =>
    ancestors(mrca(t.tips)).find((d) => Math.abs(ageOf(d) - t.crown) <= 0.2) ||
    mrca(t.tips);
  const marks = transitions
    .filter((t) => t.tips.every((n) => tipByName.has(n)))
    .map((t) => {
      const node = transitionNode(t);
      return {
        ...t,
        node,
        parent: byId.get(node.parentId),
        deep: t.scope === "deep",
      };
    });
  return {
    layout,
    nodes,
    byId,
    height,
    ageOf,
    tips,
    step,
    tipByName,
    ancestors,
    mrca,
    marks,
  };
}

// Draws the figure into `el` and returns { select(name), svg }. onSelect(name) is called when
// a tip is clicked; tip is the tooltip element (position: fixed).
export function render(
  el,
  P,
  {
    theme = THEMES.light,
    selected = null,
    onSelect = null,
    tip = null,
    interactive = true,
    links = null, // [species_a, species_b, identity, divergence, family pairs]: shared end satellites
  } = {},
) {
  const {
    layout,
    nodes,
    byId,
    height,
    ageOf,
    tips,
    step,
    tipByName,
    ancestors,
    mrca,
    marks,
  } = P;
  const C = theme;
  const k = TREE_R / height;
  const STATE_COLOUR = C.states,
    TERT_COLOUR = C.tert;
  const routeColour = (r) => C.routes[r];

  const pt = (r, a) =>
    `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
  function arcPath(r, a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${pt(r, a0)}A${r},${r} 0 ${large} 1 ${pt(r, a1)}`;
  }
  const degrees = (a) => (a * 180) / Math.PI;
  const rotation = OPEN_DEG / 2; // centres the open wedge on the +x axis
  const fmt = (n) => n.toLocaleString("en-GB");

  // Runs of consecutive tips sharing a value, so each ring is a few merged paths rather
  // than one element per tip.
  function runs(list, value) {
    const out = [];
    list.forEach((d, i) => {
      const v = value(d);
      const last = out[out.length - 1];
      if (last && last.value === v) last.end = i;
      else out.push({ value: v, start: i, end: i });
    });
    return out;
  }

  // Draws one ring from tip runs. Long runs go first, then short ones on top, widened to
  // MIN_TIP_MM so that single tips survive printing.
  function drawRing(parent, list, value, colourFor, tipWidth, segment) {
    const all = runs(list, value).filter((r) => colourFor(r.value));
    const minTips = MIN_TIP_MM / tipWidth;
    for (const short of [false, true]) {
      const paths = d3.rollup(
        all.filter((r) => r.end - r.start + 1 < minTips === short),
        (v) =>
          v
            .map((r) => {
              const extra = short ? (minTips - (r.end - r.start + 1)) / 2 : 0;
              return segment(r.start - 0.5 - extra, r.end + 0.5 + extra);
            })
            .join(""),
        (r) => colourFor(r.value),
      );
      for (const [colour, d] of paths)
        parent.append("path").attr("d", d).attr("stroke", colour);
    }
  }

  // ---- svg ----
  const svg = d3
    .select(el)
    .append("svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", [0, 0, PAGE_W, PAGE_H])
    .attr("font-family", "Helvetica, Arial, sans-serif")
    .attr("font-size", FONT)
    .attr("fill", C.ink)
    .attr("role", "img")
    .attr(
      "aria-label",
      "Dated phylogeny with rings for repeat state, validated TR and TERT, marks for repeat transitions, and enlarged panels for Coleoptera and Hymenoptera",
    );
  svg
    .append("rect")
    .attr("width", PAGE_W)
    .attr("height", PAGE_H)
    .attr("fill", C.bg);
  const zoomed = svg.append("g").attr("id", "zoomed");

  const panelLetter = (x, y, text) =>
    zoomed
      .append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("font-size", 8 * PT)
      .attr("font-weight", 700)
      .text(text);
  panelLetter(0.5, 3.5, "a");

  // ---- panel a ----
  const circle = zoomed.append("g").attr("transform", `translate(${CENTRE})`);
  const plot = circle.append("g").attr("transform", `rotate(${rotation})`);
  const times = d3.range(TIME_STEP, height, TIME_STEP);
  const firstA = tips[0].angle - step / 2,
    lastA = tips[tips.length - 1].angle + step / 2;
  const band = d3
    .arc()
    .startAngle(firstA + Math.PI / 2)
    .endAngle(lastA + Math.PI / 2);
  plot
    .append("g")
    .attr("fill", C.band)
    .selectAll("path")
    .data(d3.range(0, height - TIME_STEP, 2 * TIME_STEP))
    .join("path")
    .attr("d", (t) =>
      band({
        innerRadius: Math.max(0, (height - t - TIME_STEP) * k),
        outerRadius: (height - t) * k,
      }),
    );

  plot
    .append("path")
    .attr("fill", "none")
    .attr("stroke", C.branch)
    .attr("stroke-width", BRANCH_WIDTH)
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr(
      "d",
      layout.radii
        .map(
          (s) =>
            `M${(s.x0 * k).toFixed(3)},${(s.y0 * k).toFixed(3)}L${(s.x1 * k).toFixed(3)},${(s.y1 * k).toFixed(3)}`,
        )
        .join("") +
        layout.arcs
          .map((a) => {
            const span = (a.end - a.start + 2 * Math.PI) % (2 * Math.PI);
            return arcPath(a.radius * k, a.start, a.start + span);
          })
          .join(""),
    );

  plot
    .append("g")
    .attr("fill", "none")
    .attr("stroke-width", CARRIER_WIDTH)
    .attr("stroke-linecap", "round")
    .selectAll("path")
    .data(marks)
    .join("path")
    .attr("stroke", (d) => routeColour(d.route))
    .attr(
      "d",
      (d) =>
        `M${pt(d.parent.r * k, d.node.angle)}L${pt(d.node.r * k, d.node.angle)}`,
    );

  const tipAngle = (i) => tips[0].angle + i * step;
  const ringG = (key) =>
    plot.append("g").attr("fill", "none").attr("stroke-width", RINGS[key].w);
  const tipMm = (r) => r * step;
  const polarSegment = (r) => (i0, i1) =>
    arcPath(r, tipAngle(i0), tipAngle(i1));
  const trackFor = (g, key) =>
    g
      .append("path")
      .attr("stroke", C.track)
      .attr("d", arcPath(RINGS[key].r, firstA, lastA));

  const stateRing = ringG("state");
  drawRing(
    stateRing,
    tips,
    (d) => d.info.cat,
    (v) => STATE_COLOUR[v],
    tipMm(RINGS.state.r),
    polarSegment(RINGS.state.r),
  );
  const trRing = ringG("tr");
  trackFor(trRing, "tr");
  drawRing(
    trRing,
    tips,
    (d) => d.info.tr,
    (v) => (v ? C.trOn : null),
    tipMm(RINGS.tr.r),
    polarSegment(RINGS.tr.r),
  );
  const tertRing = ringG("tert");
  trackFor(tertRing, "tert");
  drawRing(
    tertRing,
    tips,
    (d) => d.info.tert,
    (v) => TERT_COLOUR[v],
    tipMm(RINGS.tert.r),
    polarSegment(RINGS.tert.r),
  );

  // Clade arcs and labels. Small gaps inside a clade (up to 3 tips) do not split its arc.
  const merged = [];
  for (const run of runs(tips, (d) => d.info.group)) {
    if (!run.value) continue;
    const prev = [...merged].reverse().find((m) => m.value === run.value);
    if (prev && run.start - prev.end <= 4) prev.end = run.end;
    else merged.push({ ...run });
  }
  const groupSize = d3.rollup(
    tips,
    (v) => v.length,
    (d) => d.info.group,
  );
  // Clades are separated by a gap in the outer arc, alternating tones and a cut through the
  // rings at each boundary.
  const cladeArcs = merged.filter((m) => m.end - m.start >= 3);
  const arcGap = CLADE_GAP_MM / 2 / CLADE_R;
  cladeArcs.forEach((m, i) =>
    plot
      .append("path")
      .attr("fill", "none")
      .attr("stroke-width", 0.6)
      .attr("stroke", i % 2 ? C.clade[1] : C.clade[0])
      .attr(
        "d",
        arcPath(
          CLADE_R,
          tipAngle(m.start - 0.5) + arcGap,
          tipAngle(m.end + 0.5) - arcGap,
        ),
      ),
  );
  plot
    .append("path")
    .attr("stroke", C.bg)
    .attr("stroke-width", CLADE_GAP_MM * 0.6)
    .attr(
      "d",
      cladeArcs
        .slice(1)
        .map((m, i) => {
          const a = tipAngle((cladeArcs[i].end + m.start) / 2);
          return `M${pt(RINGS.state.r - RINGS.state.w / 2, a)}L${pt(RINGS.tert.r + RINGS.tert.w / 2, a)}`;
        })
        .join(""),
    );

  const labels = d3
    .groups(merged, (d) => d.value)
    .map(([name, list]) => {
      const main = d3.greatest(list, (d) => d.end - d.start);
      return {
        name,
        n: groupSize.get(name),
        a: tipAngle((main.start + main.end) / 2),
      };
    })
    .filter((d) => d.n >= 10)
    .sort((a, b) => a.a - b.a);
  const minGap = (LABEL_MIN_DEG * Math.PI) / 180;
  labels.forEach((d) => {
    d.at = d.a;
  });
  for (let pass = 0; pass < 400; pass++) {
    for (let i = 1; i < labels.length; i++) {
      const push = minGap - (labels[i].at - labels[i - 1].at);
      if (push > 0) {
        labels[i].at += push / 2;
        labels[i - 1].at -= push / 2;
      }
    }
  }
  plot
    .append("g")
    .attr("stroke", C.rule)
    .attr("stroke-width", 0.25 * PT)
    .selectAll("line")
    .data(labels)
    .join("line")
    .attr("x1", (d) => CLADE_R * Math.cos(d.a))
    .attr("y1", (d) => CLADE_R * Math.sin(d.a))
    .attr("x2", (d) => (LABEL_R - 0.4) * Math.cos(d.at))
    .attr("y2", (d) => (LABEL_R - 0.4) * Math.sin(d.at));
  const flipped = (d) => {
    const screen = (degrees(d.at) + rotation) % 360;
    return screen > 90 && screen < 270;
  };
  plot
    .append("g")
    .selectAll("text")
    .data(labels)
    .join("text")
    .attr("dy", ".34em")
    .attr(
      "transform",
      (d) =>
        `rotate(${degrees(d.at)}) translate(${LABEL_R},0)${flipped(d) ? " rotate(180)" : ""}`,
    )
    .attr("text-anchor", (d) => (flipped(d) ? "end" : "start"))
    .attr("font-weight", (d) =>
      ROWS.some((r) => r.group === d.name) ? 700 : 400,
    )
    .text((d) => cladeLabel(d.name));

  // Time axis along the open wedge (+x in screen space, so it is not rotated).
  const axis = circle.append("g").attr("fill", C.ink2);
  axis
    .append("line")
    .attr("x2", TREE_R)
    .attr("stroke", C.rule)
    .attr("stroke-width", 0.25 * PT);
  const ticks = axis
    .selectAll("g")
    .data([0, ...times])
    .join("g")
    .attr("transform", (t) => `translate(${(height - t) * k},0)`);
  ticks
    .append("line")
    .attr("y2", 0.8)
    .attr("stroke", C.rule)
    .attr("stroke-width", 0.25 * PT);
  ticks
    .append("text")
    .attr("y", 3)
    .attr("text-anchor", "middle")
    .attr("stroke", C.bg)
    .attr("stroke-width", 0.7)
    .attr("stroke-linejoin", "round")
    .attr("paint-order", "stroke")
    .text((t) => fmt(t));
  axis
    .append("text")
    .attr("x", TREE_R)
    .attr("y", -1)
    .attr("text-anchor", "end")
    .attr("font-weight", 700)
    .text("Myr ago");

  // Hover highlights are drawn here, above the rings and under the marks.
  const overlayA = plot.append("g").attr("pointer-events", "none");

  // Marks: filled at posterior >= 0.5, hollow below it.
  const confident = (d) => d.posterior >= 0.5;
  const symbol = (d) =>
    d3.symbol(
      d.deep ? d3.symbolDiamond : ROUTE[d.route].shape,
      d.deep ? 4.6 : (confident(d) ? 2.3 : 1.3) * ROUTE[d.route].area,
    )();
  function styleMarks(sel) {
    return sel
      .attr("d", symbol)
      .attr("fill", (d) =>
        d.deep || confident(d) ? routeColour(d.route) : C.bg,
      )
      .attr("stroke", (d) =>
        d.deep ? C.ink : confident(d) ? C.bg : routeColour(d.route),
      )
      .attr("stroke-width", (d) => (d.deep ? 0.25 : confident(d) ? 0.12 : 0.3));
  }
  const byOrder = (a, b) =>
    d3.ascending(a.deep, b.deep) || d3.ascending(a.posterior, b.posterior);
  // Shared end satellites: a curve between the two tips, pulled towards their common ancestor,
  // so sister species make a small bump at the rim and deep pairs sweep across the circle.
  const linkColour = d3
    .scaleLinear()
    .domain([75, 100])
    .range(C.links)
    .interpolate(d3.interpolateLab)
    .clamp(true);
  const linkData = (links || [])
    .filter(([a, b]) => tipByName.has(a) && tipByName.has(b))
    .map(([a, b, pid, myr, n]) => {
      const ta = tipByName.get(a),
        tb = tipByName.get(b),
        m = mrca([a, b]);
      return { a: ta, b: tb, pid, myr: myr ?? ageOf(m), n, m };
    })
    .sort((x, y) => d3.ascending(x.pid, y.pid));
  const linkPath = (d) =>
    `M${pt(TREE_R, d.a.angle)}Q${pt(d.m.r * k, d.m.angle)} ${pt(TREE_R, d.b.angle)}`;
  const linkG = plot
    .append("g")
    .attr("class", "satlinks")
    .attr("fill", "none")
    .attr("stroke-linecap", "round");
  const linkCase = linkG
    .append("g")
    .attr("stroke", C.bg)
    .attr("stroke-width", 0.95)
    .selectAll("path")
    .data(linkData)
    .join("path")
    .attr("d", linkPath);
  const linkSel = linkG
    .append("g")
    .selectAll("path")
    .data(linkData)
    .join("path")
    .attr("d", linkPath)
    .attr("stroke", (d) => linkColour(d.pid))
    .attr("stroke-width", 0.55);
  const ends = [
    ...new Map(linkData.flatMap((d) => [[d.a.thisLabel, d.a], [d.b.thisLabel, d.b]])).values(),
  ];
  linkG
    .append("g")
    .attr("fill", C.links[1])
    .attr("stroke", C.bg)
    .attr("stroke-width", 0.12)
    .selectAll("circle")
    .data(ends)
    .join("circle")
    .attr("r", 0.42)
    .attr("cx", (d) => (TREE_R - 0.2) * Math.cos(d.angle))
    .attr("cy", (d) => (TREE_R - 0.2) * Math.sin(d.angle));
  // wider invisible strokes, for hovering
  const linkHit = linkG
    .append("g")
    .attr("stroke", "transparent")
    .attr("stroke-width", 1.6)
    .selectAll("path")
    .data(linkData)
    .join("path")
    .attr("d", linkPath);
  // Links of the hovered or selected species are drawn heavier, the rest fade.
  function emphasiseLinks(name) {
    const on = (d) => d.a.thisLabel === name || d.b.thisLabel === name;
    const any = name && linkData.some(on);
    linkSel
      .attr("stroke-width", (d) => (any && on(d) ? 0.9 : 0.55))
      .attr("stroke-opacity", (d) => (any && !on(d) ? 0.35 : 1));
    linkCase.attr("stroke-width", (d) => (any && on(d) ? 1.3 : 0.95));
    if (any) linkSel.filter(on).raise();
  }

  const markG = plot.append("g").attr("class", "marks");
  const markSel = styleMarks(
    markG
      .selectAll("path")
      .data([...marks].sort(byOrder))
      .join("path"),
  );

  // ---- panels b and c ----
  ROWS.forEach((row) => panelLetter(0.5, row.top - 1.4, row.panel));
  const rowMaxAge = [];
  const built = ROWS.map((row) => {
    const members = tips.filter((d) => d.info.group === row.group);
    const crown = mrca([
      members[0].thisLabel,
      members[members.length - 1].thisLabel,
    ]);
    const inside = new Set();
    (function walk(id) {
      inside.add(id);
      byId.get(id).children.forEach(walk);
    })(crown.thisId);
    const rowTips = tips.filter((d) => inside.has(d.thisId));
    rowMaxAge.push(ageOf(crown));
    return {
      ...row,
      crown,
      inside,
      rowTips,
      nodes: nodes.filter((d) => inside.has(d.thisId)),
    };
  });
  const maxAge = d3.max(rowMaxAge) * 1.04;
  const ageY = d3.scaleLinear().domain([maxAge, 0]).range([0, ROW.tree]);

  for (const row of built) {
    const first = row.rowTips[0].index,
      n = row.rowTips.length;
    const dx = (ROW.right - ROW.left) / n;
    row.dx = dx;
    const xOf = (node) =>
      ((node.angle - tips[first].angle) / step) * dx + dx / 2;
    row.xOf = xOf;
    const g = zoomed
      .append("g")
      .attr("transform", `translate(${ROW.left},${row.top})`);
    row.g = g;
    g.append("text")
      .attr("y", -1.4)
      .attr("font-weight", 700)
      .text(`${row.group} (${n} tips)`);
    g.append("text")
      .attr("transform", `translate(-6.8,${ageY(100)}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", C.ink2)
      .text("Myr ago");

    // Age axis on the left, with faint guides across the tree.
    const axisG = g.append("g").attr("fill", C.ink2).attr("text-anchor", "end");
    const yTicks = d3.range(0, maxAge, 100);
    axisG
      .selectAll("line")
      .data(yTicks)
      .join("line")
      .attr("x2", ROW.right - ROW.left)
      .attr("y1", ageY)
      .attr("y2", ageY)
      .attr("stroke", C.guide)
      .attr("stroke-width", 0.25 * PT);
    axisG
      .selectAll("text")
      .data(yTicks)
      .join("text")
      .attr("x", -0.8)
      .attr("y", ageY)
      .attr("dy", ".34em")
      .text((t) => t);

    const y = (node) => ageY(ageOf(node));
    let d = "";
    for (const node of row.nodes) {
      const x = xOf(node).toFixed(3);
      const parentAge =
        node === row.crown ? null : ageOf(byId.get(node.parentId));
      d += `M${x},${(parentAge === null ? 0 : ageY(parentAge)).toFixed(3)}V${y(node).toFixed(3)}`;
      if (node.children.length) {
        const xs = node.children.map((id) => xOf(byId.get(id)));
        d += `M${d3.min(xs).toFixed(3)},${y(node).toFixed(3)}H${d3.max(xs).toFixed(3)}`;
      }
    }
    g.append("path")
      .attr("d", d)
      .attr("fill", "none")
      .attr("stroke", C.branch)
      .attr("stroke-width", BRANCH_WIDTH)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    row.marks = marks.filter((m) => row.inside.has(m.node.thisId));
    g.append("g")
      .attr("fill", "none")
      .attr("stroke-width", CARRIER_WIDTH)
      .attr("stroke-linecap", "round")
      .selectAll("path")
      .data(row.marks)
      .join("path")
      .attr("stroke", (m) => routeColour(m.route))
      .attr(
        "d",
        (m) =>
          `M${xOf(m.node).toFixed(3)},${Math.max(0, ageY(ageOf(m.parent))).toFixed(3)}V${y(m.node).toFixed(3)}`,
      );

    // Strips below the tips, in the same order as the rings of a.
    const strip = (top, h) => {
      const s = g.append("g").attr("fill", "none").attr("stroke-width", h);
      const mid = ROW.tree + top + h / 2;
      return [
        s,
        (i0, i1) =>
          `M${((i0 + 0.5) * dx).toFixed(3)},${mid}H${((i1 + 0.5) * dx).toFixed(3)}`,
      ];
    };
    const [stateG, stateSeg] = strip(ROW.gap, ROW.state);
    drawRing(
      stateG,
      row.rowTips,
      (d) => d.info.cat,
      (v) => STATE_COLOUR[v],
      dx,
      stateSeg,
    );
    const [trG, trSeg] = strip(ROW.gap + ROW.state + 0.25, ROW.band);
    trG
      .append("path")
      .attr("stroke", C.track)
      .attr("d", trSeg(-0.5, n - 0.5));
    drawRing(
      trG,
      row.rowTips,
      (d) => d.info.tr,
      (v) => (v ? C.trOn : null),
      dx,
      trSeg,
    );
    const [tertG, tertSeg] = strip(
      ROW.gap + ROW.state + ROW.band + 0.5,
      ROW.band,
    );
    tertG
      .append("path")
      .attr("stroke", C.track)
      .attr("d", tertSeg(-0.5, n - 0.5));
    drawRing(
      tertG,
      row.rowTips,
      (d) => d.info.tert,
      (v) => TERT_COLOUR[v],
      dx,
      tertSeg,
    );

    row.overlay = g.append("g").attr("pointer-events", "none");
    row.markSel = styleMarks(
      g
        .append("g")
        .attr("class", "marks")
        .selectAll("path")
        .data([...row.marks].sort(byOrder))
        .join("path"),
    );
  }

  let markWhere = "node";
  function placeMarks() {
    const radius = (d) =>
      markWhere === "mid" ? (d.node.r + d.parent.r) / 2 : d.node.r;
    markSel.attr(
      "transform",
      (d) =>
        `rotate(${degrees(d.node.angle)}) translate(${radius(d) * k},0) rotate(${-degrees(d.node.angle) - rotation})`,
    );
    for (const row of built) {
      row.markSel.attr(
        "transform",
        (d) => `translate(${row.xOf(d.node)},${ageY(height - radius(d))})`,
      );
    }
  }
  placeMarks();

  // ---- legends, in the corners of panel a ----
  const LINE = 2.75;
  function legendBlock(x, y, blocks) {
    const g = zoomed.append("g").attr("transform", `translate(${x},${y})`);
    let yy = 0;
    for (const block of blocks) {
      g.append("text").attr("y", yy).attr("font-weight", 700).text(block.title);
      yy += LINE;
      for (const row of block.rows) {
        row.draw(
          g.append("g").attr("transform", `translate(1.3,${yy - 0.75})`),
        );
        const t = g.append("text").attr("x", 3.4).attr("y", yy).text(row.label);
        if (row.n != null)
          t.append("tspan")
            .attr("fill", C.ink2)
            .text(`  ${fmt(row.n)}`);
        yy += LINE;
      }
      yy += 0.9;
    }
  }
  const swatch = (colour) => (g) =>
    g
      .append("rect")
      .attr("x", -1.3)
      .attr("y", -1)
      .attr("width", 2.6)
      .attr("height", 2)
      .attr("fill", colour);
  const count = (value) => tips.reduce((n, d) => n + (value(d) ? 1 : 0), 0);
  const routeRow = ([key, label, shape, area]) => ({
    label,
    n: marks.filter((d) => d.route === key && !d.deep).length,
    draw: (g) =>
      g
        .append("path")
        .attr("d", d3.symbol(shape, 2.3 * area)())
        .attr("fill", routeColour(key)),
  });

  legendBlock(7, 3.5, [
    {
      title: "Repeat state (inner ring)",
      rows: STATES.map(([key, label]) => ({
        label,
        n: count((d) => d.info.cat === key),
        draw: swatch(STATE_COLOUR[key]),
      })),
    },
  ]);
  legendBlock(141, 3.5, [
    {
      title: "Telomerase RNA (middle)",
      rows: [
        {
          label: "validated",
          n: count((d) => d.info.tr),
          draw: swatch(C.trOn),
        },
      ],
    },
    {
      title: "TERT (outer ring)",
      rows: TERT.map(([key, label]) => ({
        label,
        n: count((d) => d.info.tert === key),
        draw: swatch(TERT_COLOUR[key]),
      })),
    },
  ]);
  if (linkData.length) {
    const linkRow = (pid) => ({
      label: `${pid}% identity`,
      draw: (g) =>
        g
          .append("path")
          .attr("d", "M-1.3,0.4Q0,-1.4 1.3,0.4")
          .attr("fill", "none")
          .attr("stroke", linkColour(pid))
          .attr("stroke-width", 0.5),
    });
    legendBlock(141, 3.5 + 9 * LINE, [
      {
        title: `Shared end satellite (${linkData.length})`,
        rows: [linkRow(75), linkRow(100)],
      },
    ]);
  }
  legendBlock(0.5, 150, [
    {
      title: `Repeat transitions (${marks.filter((d) => !d.deep).length})`,
      rows: [
        ...ROUTES.map(routeRow),
        {
          label: "deep change",
          n: marks.filter((d) => d.deep).length,
          draw: (g) =>
            g
              .append("path")
              .attr("d", d3.symbol(d3.symbolDiamond, 3.4)())
              .attr("fill", routeColour("1"))
              .attr("stroke", C.ink)
              .attr("stroke-width", 0.2),
        },
      ],
    },
  ]);
  const notes = zoomed
    .append("g")
    .attr("transform", "translate(146,160)")
    .attr("fill", C.ink2);
  [
    "Filled: posterior ≥ 0.5",
    "Hollow: posterior < 0.5",
    "Thick branch: carries the change",
    "Single tips drawn 0.3 mm wide",
  ].forEach((line, i) =>
    notes
      .append("text")
      .attr("y", i * LINE)
      .text(line),
  );

  if (!interactive) return { svg: svg.node() };

  // ---- tooltips ----
  const tipSel = d3.select(tip);
  const code = (s) => (s ? `<code>${s}</code>` : "none");
  function showTip(event, html) {
    tipSel.html(html).style("display", "block");
    const box = tipSel.node().getBoundingClientRect();
    const x =
      event.clientX + 14 + box.width > innerWidth
        ? event.clientX - box.width - 14
        : event.clientX + 14;
    const yy =
      event.clientY + 14 + box.height > innerHeight
        ? event.clientY - box.height - 14
        : event.clientY + 14;
    tipSel.style("left", `${x}px`).style("top", `${yy}px`);
  }
  const hideTip = () => tipSel.style("display", "none");
  const stateName = Object.fromEntries(STATES);

  const speciesHtml = (d) => {
    const o = d.info;
    return o.noData
      ? `<i>${d.thisLabel}</i><span>Unnamed tree tip, no survey data</span>`
      : `<i>${d.thisLabel.replace(/_/g, " ")}</i><span>${capitalise(o.group)}</span>
         <span>Repeat: ${o.cat === "lost" ? stateName.lost : code(o.unit)}${o.cat === "unknown" && o.unit ? " (not in the analysis set)" : ""}</span>${o.stateWhy ? `<span class="tl-muted">${o.stateWhy.replace(/^[^:]+: /, "")}</span>` : ""}
         <span>TR: ${o.trWhy ?? (o.tr ? "validated" : "not validated")}</span>
         <span>TERT: ${o.tertWhy ?? o.tert ?? "–"}</span>${o.sat ? `<span>End satellites: ${o.sat}</span>` : ""}
         <span class="tl-tiphint">Click to open</span>`;
  };

  // ---- highlights ----
  const HIGHLIGHT = {
    ink: C.ink,
    path: 0.45,
    casing: 1,
    descendants: 0.3,
    tint: 0.12,
    minWedge: 1.2,
  };
  const STRIP_H = ROW.gap + ROW.state + 2 * ROW.band + 0.5;

  function subtreeNodes(node) {
    const out = [];
    (function walk(n) {
      out.push(n);
      n.children.forEach((id) => walk(byId.get(id)));
    })(node);
    return out;
  }
  function polarEdge(n) {
    const p = byId.get(n.parentId);
    if (!p) return "";
    const elbow =
      p.r > 0
        ? arcPath(
            p.r * k,
            Math.min(n.angle, p.angle),
            Math.max(n.angle, p.angle),
          )
        : "";
    return `M${pt(n.r * k, n.angle)}L${pt(p.r * k, n.angle)}${elbow}`;
  }
  function rowEdge(row, n) {
    const x = row.xOf(n),
      y = ageY(ageOf(n));
    if (n === row.crown) return `M${x},${y}V0`;
    const p = byId.get(n.parentId),
      py = ageY(ageOf(p));
    return `M${x},${y}V${py}H${row.xOf(p)}`;
  }
  function drawLines(layer, rootPath, below, colour) {
    if (below) {
      layer
        .append("path")
        .attr("d", below)
        .attr("fill", "none")
        .attr("stroke", colour)
        .attr("stroke-width", HIGHLIGHT.descendants)
        .attr("stroke-linecap", "round");
    }
    for (const [stroke, width] of [
      [C.bg, HIGHLIGHT.casing],
      [HIGHLIGHT.ink, HIGHLIGHT.path],
    ]) {
      layer
        .append("path")
        .attr("d", rootPath)
        .attr("fill", "none")
        .attr("stroke", stroke)
        .attr("stroke-width", width)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");
    }
  }

  // The wedge covers the tips from lo to hi, never narrower than minWedge at the rim.
  function drawWedge(lo, hi, colour) {
    const half =
      Math.max((hi - lo + 1) * step, HIGHLIGHT.minWedge / CLADE_R) / 2;
    const middle = tipAngle((lo + hi) / 2) + Math.PI / 2;
    const slice = (innerRadius, outerRadius) =>
      d3.arc()({
        innerRadius,
        outerRadius,
        startAngle: middle - half,
        endAngle: middle + half,
      });
    overlayA
      .append("path")
      .attr("d", slice(0, CLADE_R + 0.6))
      .attr("fill", colour)
      .attr("fill-opacity", HIGHLIGHT.tint);
    overlayA
      .append("path")
      .attr("d", slice(RINGS.state.r - RINGS.state.w / 2, CLADE_R + 0.6))
      .attr("fill", "none")
      .attr("stroke", HIGHLIGHT.ink)
      .attr("stroke-width", 0.2);
  }
  function drawBand(row, lo, hi, colour) {
    const middle = ((lo + hi + 1) / 2) * row.dx;
    const width = Math.max((hi - lo + 1) * row.dx, HIGHLIGHT.minWedge);
    const x = middle - width / 2,
      stripTop = ROW.tree;
    row.overlay
      .append("rect")
      .attr("x", x)
      .attr("width", width)
      .attr("height", ROW.tree + STRIP_H)
      .attr("fill", colour)
      .attr("fill-opacity", HIGHLIGHT.tint);
    row.overlay
      .append("rect")
      .attr("x", x)
      .attr("y", stripTop)
      .attr("width", width)
      .attr("height", STRIP_H)
      .attr("fill", "none")
      .attr("stroke", HIGHLIGHT.ink)
      .attr("stroke-width", 0.2);
  }

  // The selected species stays highlighted whenever nothing else is.
  let highlighted = null,
    selectedNode = selected ? tipByName.get(selected) : null;
  function clearHighlight() {
    highlighted = null;
    overlayA.selectAll("*").remove();
    for (const row of built) row.overlay.selectAll("*").remove();
    emphasiseLinks(selectedNode?.thisLabel);
    if (selectedNode) highlight(selectedNode, null, true);
  }
  // Highlights the path from node to the root. With a colour, also its whole subtree.
  function highlight(node, colour, quiet = false) {
    const key = `${node.thisId}:${colour}`;
    if (key === highlighted) return;
    overlayA.selectAll("*").remove();
    for (const row of built) row.overlay.selectAll("*").remove();
    highlighted = quiet ? `sel:${key}` : key;
    const rootPath = ancestors(node);
    const below = colour ? subtreeNodes(node).slice(1) : [];
    const under = node.isTip ? [node] : below.filter((d) => d.isTip);
    const tint = colour || HIGHLIGHT.ink;

    drawWedge(
      d3.min(under, (d) => d.index),
      d3.max(under, (d) => d.index),
      tint,
    );
    drawLines(
      overlayA,
      rootPath.map(polarEdge).join(""),
      below.map(polarEdge).join(""),
      colour,
    );

    for (const row of built) {
      const inRow = (d) => row.inside.has(d.thisId);
      const rowTips = under.filter(inRow);
      if (!rowTips.length) continue;
      const first = row.rowTips[0].index;
      drawBand(
        row,
        d3.min(rowTips, (d) => d.index) - first,
        d3.max(rowTips, (d) => d.index) - first,
        tint,
      );
      const edge = (n) => rowEdge(row, n);
      drawLines(
        row.overlay,
        rootPath.filter(inRow).map(edge).join(""),
        below.filter(inRow).map(edge).join(""),
        colour,
      );
    }
  }
  clearHighlight();

  function tipUnder(event) {
    const [x, y] = d3.pointer(event, plot.node());
    const r = Math.hypot(x, y);
    if (r >= TREE_R - 1 && r <= CLADE_R + 1) {
      const a = (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
      const i = Math.round((a - tips[0].angle) / step);
      if (i >= 0 && i < tips.length) return tips[i];
    }
    for (const row of built) {
      const [bx, by] = d3.pointer(event, row.g.node());
      if (
        by >= ROW.tree - 0.5 &&
        by <= ROW.tree + STRIP_H + 0.5 &&
        bx >= 0 &&
        bx <= ROW.right - ROW.left
      ) {
        return row.rowTips[Math.floor(bx / row.dx)];
      }
    }
    return null;
  }

  svg
    .on("pointermove", (event) => {
      if (event.target.closest(".marks, .satlinks")) return;
      const d = tipUnder(event);
      svg.style("cursor", d && !d.info.noData ? "pointer" : null);
      if (d) {
        showTip(event, speciesHtml(d));
        highlight(d, null);
        emphasiseLinks(d.thisLabel);
      } else {
        hideTip();
        clearHighlight();
      }
    })
    .on("pointerleave", () => {
      hideTip();
      clearHighlight();
    });
  svg.on("click", (event) => {
    if (event.defaultPrevented || event.target.closest(".marks, .satlinks"))
      return;
    const d = tipUnder(event);
    if (d && !d.info.noData && onSelect) onSelect(d.thisLabel);
  });

  const markHtml = (d) => {
    const age = d.node.isTip
      ? `0–${d.stem.toFixed(0)}`
      : `${d.crown.toFixed(0)}–${d.stem.toFixed(0)}`;
    return `<b>${code(d.frm)} → ${code(d.to)}</b>
      <span>${d.deep ? "Deep change, " : ""}${ROUTE[d.route].label}${d.reversal ? ", reversal" : ""}</span>
      <span>Edit distance: ${d.distance}</span>
      <span>Posterior: ${d.posterior.toFixed(3)}</span>
      <span>Branch: ${age} Myr ago</span>
      <span>Descendant tips: ${fmt(d.n_desc)}</span>
      <span>${d.node.isTip ? d.tips[0].replace(/_/g, " ") : d.group}</span>`;
  };
  for (const sel of [markSel, ...built.map((r) => r.markSel)]) {
    sel
      .on("pointerenter pointermove", (event, d) => {
        showTip(event, markHtml(d));
        highlight(d.node, routeColour(d.route));
      })
      .on("pointerleave", () => {
        hideTip();
        clearHighlight();
      });
  }

  const sp = (d) => `<i>${d.thisLabel.replace(/_/g, " ")}</i>`;
  linkHit
    .on("pointerenter pointermove", (event, d) => {
      showTip(
        event,
        `<b>Shared end satellite</b>
        <span>${sp(d.a)} and ${sp(d.b)}</span>
        <span>${d.n === 1 ? "One end family" : `${d.n} end families`}, up to ${d.pid.toFixed(1)}% identity</span>
        <span>Diverged about ${d.myr.toFixed(0)} Myr ago</span>
        <span class="tl-tiphint">Click to open ${sp(d.a)}</span>`,
      );
      highlight(d.m, C.links[1]);
      emphasiseLinks(null);
      linkSel.filter((x) => x === d).attr("stroke-width", 0.9).raise();
    })
    .on("pointerleave", () => {
      hideTip();
      clearHighlight();
    })
    .on("click", (event, d) => {
      event.preventDefault();
      onSelect?.(d.a.thisLabel);
    });

  // ---- zoom: the wheel zooms only with ctrl or cmd held (and trackpad pinches, which send
  // ctrl), and touch needs two fingers, so the page still scrolls past the figure ----
  const zoom = d3
    .zoom()
    .scaleExtent([1, 40])
    .filter((e) =>
      e.type === "wheel"
        ? e.ctrlKey || e.metaKey
        : e.type.startsWith("touch")
          ? e.touches.length > 1
          : !e.button,
    )
    .on("zoom", (e) => zoomed.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  return {
    svg: svg.node(),
    select(name) {
      selectedNode = name ? tipByName.get(name) : null;
      clearHighlight();
    },
    zoomBy: (f) => svg.transition().duration(250).call(zoom.scaleBy, f),
    reset: () =>
      svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity),
    setMarks(where) {
      markWhere = where;
      placeMarks();
    },
  };
}
