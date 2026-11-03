// bandage.js: Bandage-style drawings of organelle assembly graphs, in the
// browser, from a GFA and (optionally) a GFF3 on the same unitig coordinates.
//
// As in Bandage, every segment is drawn as a thick ribbon whose length grows
// with its sequence length, and links join segment ends. Each ribbon is a
// chain of points laid out with a force simulation; genes are painted onto
// the ribbon at their positions along the segment.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// --- parsing ---

// GFA segments carry their full sequence, so read only what is needed from
// each line and never split a sequence apart
export function parseGFA(text) {
  const segs = [], links = [], byId = new Map(), seen = new Set();
  let i = 0;
  while (i < text.length) {
    let j = text.indexOf("\n", i);
    if (j < 0) j = text.length;
    const type = text[i];
    if (type === "S") {
      const t1 = text.indexOf("\t", i), t2 = text.indexOf("\t", t1 + 1);
      const t3 = text.indexOf("\t", t2 + 1);
      const end = t3 < 0 || t3 > j ? j : t3;
      const id = text.slice(t1 + 1, t2);
      const tags = end < j ? text.slice(end + 1, j) : "";
      const tag = (k) => (tags.match(new RegExp(`(?:^|\\t)${k}:[ifZ]:([^\\t\\r]+)`)) || [])[1];
      const seqLen = text[t2 + 1] === "*" && end - t2 - 1 === 1 ? 0 : end - t2 - 1;
      const len = +tag("LN") || seqLen;
      const depth = +tag("SC") || (+tag("KC") && len ? +tag("KC") / len : undefined) || +tag("DP") || (+tag("RC") && len ? +tag("RC") / len : undefined);
      const seg = { id, len, depth, i: segs.length };
      byId.set(id, seg);
      segs.push(seg);
    } else if (type === "L") {
      const f = text.slice(i, j).replace(/\r$/, "").split("\t");
      const flip = (o) => (o === "+" ? "-" : "+");
      const key = `${f[1]}${f[2]}>${f[3]}${f[4]}`, rev = `${f[3]}${flip(f[4])}>${f[1]}${flip(f[2])}`;
      if (!seen.has(key) && !seen.has(rev)) {
        seen.add(key);
        links.push({ from: f[1], fromOrient: f[2], to: f[3], toOrient: f[4] });
      }
    }
    i = j + 1;
  }
  return { segs, links: links.filter((l) => byId.has(l.from) && byId.has(l.to)), byId };
}

// Gene models on unitigs. Where a gene has a reconstructed or edited model
// as well as the raw hit, keep only the better models, as the GFF3 keeps both
export function parseGFF(text) {
  const feats = new Map(), parts = [];
  for (const line of text.split("\n")) {
    if (!line || line[0] === "#") continue;
    const f = line.split("\t");
    if (f.length < 9) continue;
    const a = Object.fromEntries(f[8].split(";").map((kv) => kv.split("=")).filter((kv) => kv.length === 2));
    const rec = { seqid: f[0], type: f[2], start: +f[3], end: +f[4], strand: f[6], ...a };
    if (a.ID) feats.set(a.ID, rec);
    if (f[2] === "CDS" || f[2] === "tRNA" || f[2] === "rRNA" || f[2] === "exon") parts.push(rec);
  }
  const root = (rec) => {
    let r = rec;
    for (let k = 0; k < 4 && r?.Parent && feats.has(r.Parent); k++) r = feats.get(r.Parent);
    return r;
  };
  const genes = [...feats.values()].filter((r) => r.type === "gene" && r.Name);
  const byName = d3.group(genes, (g) => g.Name);
  const keep = new Set();
  for (const [, models] of byName) {
    const better = models.filter((g) => g.annotation_tier && g.annotation_tier !== "raw");
    (better.length ? better : models).forEach((g) => keep.add(g.ID));
  }
  const seenPart = new Set();
  const out = [];
  for (const p of parts) {
    const g = root(p);
    if (!g || !keep.has(g.ID)) continue;
    const k = `${g.Name}|${p.seqid}|${p.start}|${p.end}`;
    if (seenPart.has(k)) continue;
    seenPart.add(k);
    out.push({ seg: p.seqid, start: p.start, end: p.end, strand: p.strand, name: g.Name, type: p.type });
  }
  const list = [...byName].map(([name, models]) => {
    const kept = models.filter((g) => keep.has(g.ID));
    const mrna = [...feats.values()].filter((r) => r.type === "mRNA" && kept.some((g) => g.ID === r.Parent));
    return {
      name,
      tier: kept[0]?.annotation_tier,
      copies: d3.max(kept, (g) => +g.copy_number || 1),
      partial: kept.every((g) => g.partial === "true"),
      edits: d3.max(mrna, (m) => +m.n_edits || 0) || 0,
      exons: d3.max(mrna, (m) => +m.n_exons || 0) || 0,
      spans: d3.max(kept, (g) => (g.unitig_span || "").split(",").filter(Boolean).length) || 1,
    };
  });
  return { parts: out, genes: list };
}

// --- gene classes ---

export const CLASSES = [
  ["Complex I / NDH", /^(nad|ndh)/i],
  ["Complex III / cytochrome b6f", /^(cob|pet)/i],
  ["Complex IV", /^cox/i],
  ["ATP synthase", /^atp/i],
  ["Photosystems and RuBisCO", /^(psa|psb|rbc)/i],
  ["Ribosomal proteins", /^(rps|rpl)/i],
  ["rRNA", /^rrn/i],
  ["tRNA", /^trn/i],
  ["Other", /./],
];
export const classOf = (name) => CLASSES.findIndex(([, re]) => re.test(name));

// --- layout ---

// A small seeded generator, so each graph lays out the same way every time
function rng(seed) {
  let s = 0;
  for (const c of seed) s = (Math.imul(s ^ c.charCodeAt(0), 2654435761) >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

export function layout(graph, seed = "graph") {
  const { segs, links, byId } = graph;
  const SPACING = 6;
  const total = d3.sum(segs, (s) => s.len) || 1;
  const target = Math.max(120, Math.min(1100, segs.length * 8 + 160));
  const perBp = Math.max(0, target - 2 * segs.length) / total;
  const rand = rng(seed);
  const pts = [], chain = [];
  const R = Math.sqrt(target) * SPACING * 1.2;
  const counts = segs.map((s) => Math.max(2, Math.round(2 + s.len * perBp)));

  // Start each segment where a neighbour it links to ends, walking the graph
  // breadth first, so that joined ends begin side by side, not across the page
  const adj = new Map(segs.map((s) => [s.id, []]));
  for (const l of links) {
    adj.get(l.from).push({ id: l.to, here: l.fromOrient === "+" ? "end" : "start", there: l.toOrient === "+" ? "start" : "end" });
    adj.get(l.to).push({ id: l.from, here: l.toOrient === "+" ? "start" : "end", there: l.fromOrient === "+" ? "end" : "start" });
  }
  const placed = new Map();
  const lay = (s, x, y, a, fromEnd) => {
    const n = counts[s.i], bend = (rand() - 0.5) * 0.12;
    const arr = d3.range(n).map((k) => ({ x: x + Math.cos(a + k * bend) * k * SPACING, y: y + Math.sin(a + k * bend) * k * SPACING }));
    if (fromEnd) arr.reverse();
    s.pts = arr.map((q, k) => ({ seg: s.i, k, ...q }));
    s.pts.forEach((q) => pts.push(q));
    placed.set(s.id, s);
  };
  for (const s0 of segs) {
    if (placed.has(s0.id)) continue;
    lay(s0, (rand() - 0.5) * R, (rand() - 0.5) * R, rand() * Math.PI * 2, false);
    const queue = [s0];
    while (queue.length) {
      const s = queue.shift();
      for (const nb of adj.get(s.id)) {
        if (placed.has(nb.id)) continue;
        const p = nb.here === "end" ? s.pts[s.pts.length - 1] : s.pts[0];
        const t = byId.get(nb.id);
        lay(t, p.x + (rand() - 0.5) * SPACING, p.y + (rand() - 0.5) * SPACING, rand() * Math.PI * 2, nb.there === "end");
        queue.push(t);
      }
    }
  }
  for (const s of segs) {
    const n = s.pts.length;
    for (let k = 1; k < n; k++) chain.push({ source: s.pts[k - 1], target: s.pts[k], distance: SPACING, strength: 1 });
    for (let k = 2; k < n; k++) chain.push({ source: s.pts[k - 2], target: s.pts[k], distance: SPACING * 1.95, strength: 0.7 });
  }
  const endOf = (id, orient, leaving) => {
    const s = byId.get(id);
    return (orient === "+") === leaving ? s.pts[s.pts.length - 1] : s.pts[0];
  };
  const joins = links.map((l) => ({ source: endOf(l.from, l.fromOrient, true), target: endOf(l.to, l.toOrient, false), distance: SPACING * 1.5, strength: 1, link: l }));
  const sim = d3.forceSimulation(pts)
    .force("chain", d3.forceLink(chain).distance((d) => d.distance).strength((d) => d.strength))
    .force("join", d3.forceLink(joins).distance((d) => d.distance).strength((d) => d.strength))
    .force("charge", d3.forceManyBody().strength(-14).distanceMax(SPACING * 40).theta(0.9))
    .force("x", d3.forceX(0).strength(0.012))
    .force("y", d3.forceY(0).strength(0.012))
    .alphaDecay(0.012)
    .stop();
  const ticks = pts.length > 700 ? 380 : 560;
  for (let t = 0; t < ticks; t++) sim.tick();
  return { pts, joins };
}

// --- drawing ---

const ribbon = d3.line().x((p) => p.x).y((p) => p.y).curve(d3.curveCatmullRom.alpha(0.5));
const hue = (id) => {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 3600) / 10;
};

// Draw into an <svg>. Returns a handle to highlight genes and recolour.
export function draw(svgEl, graph, annot, opts) {
  const { segs, links, byId } = graph;
  layout(graph, opts.seed);
  const svg = d3.select(svgEl);
  svg.selectAll("*").remove();
  const xs = segs.flatMap((s) => s.pts.map((p) => p.x)), ys = segs.flatMap((s) => s.pts.map((p) => p.y));
  const pad = 28;
  const [x0, x1] = d3.extent(xs), [y0, y1] = d3.extent(ys);
  const vb = [x0 - pad, y0 - pad, Math.max(60, x1 - x0) + 2 * pad, Math.max(60, y1 - y0) + 2 * pad];
  svg.attr("viewBox", vb.join(" "));
  const size = Math.max(vb[2], vb[3]);
  const width = Math.max(3.5, Math.min(8, size / 75));

  // As in Bandage, read depth widens a segment: twice the depth of the graph
  // as a whole (a plastid's inverted repeat, say) draws about 1.4 times wider
  const median = d3.median(segs, (s) => s.depth) || 1;
  for (const s of segs) s.w = width * (s.depth ? Math.max(0.6, Math.min(2.4, Math.sqrt(s.depth / median))) : 1);

  // Links leave and enter segments along their direction, as smooth curves
  const end = (s, atEnd) => {
    const n = s.pts.length, p = atEnd ? s.pts[n - 1] : s.pts[0], q = atEnd ? s.pts[n - 2] : s.pts[1];
    const dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1;
    return { x: p.x, y: p.y, ux: dx / l, uy: dy / l };
  };
  const curves = links.map((l) => {
    const a = end(byId.get(l.from), l.fromOrient === "+"), b = end(byId.get(l.to), l.toOrient === "-");
    const c = Math.max(width * 2.5, Math.min(width * 9, Math.hypot(b.x - a.x, b.y - a.y) * 0.45));
    return { l, d: `M${a.x},${a.y}C${a.x + a.ux * c},${a.y + a.uy * c} ${b.x + b.ux * c},${b.y + b.uy * c} ${b.x},${b.y}` };
  });

  const root = svg.append("g").attr("class", "bd-root");
  root.append("g").attr("class", "bd-links").selectAll("path").data(curves).join("path").attr("d", (d) => d.d);
  const sw = (s) => `--sw:${s.w}`;
  root.append("g").attr("class", "bd-outlines").selectAll("path").data(segs).join("path")
    .attr("d", (s) => ribbon(s.pts)).attr("style", sw);
  const base = root.append("g").attr("class", "bd-segs").selectAll("path").data(segs).join("path")
    .attr("class", "bd-seg").attr("d", (s) => ribbon(s.pts)).attr("data-seg", (s) => s.id).attr("style", sw);
  base.each(function (s) { s.pathLen = this.getTotalLength(); });

  // Genes, painted along the ribbon with a dash that covers their span
  const parts = (annot?.parts || []).filter((p) => byId.has(p.seg)).map((p) => {
    const s = byId.get(p.seg);
    const a = Math.max(0, (p.start - 1) / s.len), b = Math.min(1, p.end / s.len);
    return { ...p, s, a, b, cls: classOf(p.name) };
  });
  const geneG = root.append("g").attr("class", "bd-genes");
  const geneSel = geneG.selectAll("path").data(parts).join("path")
    .attr("class", (d) => `bd-gene c${d.cls}`)
    .attr("d", (d) => ribbon(d.s.pts))
    .attr("style", (d) => sw(d.s))
    .attr("stroke-dasharray", (d) => {
      const L = d.s.pathLen, from = d.a * L, len = Math.max(1.5, (d.b - d.a) * L);
      return `0 ${from} ${len} ${L * 2}`;
    });

  // One label per gene and segment, at the middle of its longest part
  const labelData = d3.rollups(parts.filter((p) => p.cls !== 7), (v) => d3.greatest(v, (p) => p.b - p.a), (p) => p.name, (p) => p.seg)
    .flatMap(([, bySeg]) => bySeg.map(([, p]) => p))
    .map((p) => {
      const pt = svgEl.querySelector(`[data-seg="${CSS.escape(p.seg)}"]`).getPointAtLength(((p.a + p.b) / 2) * p.s.pathLen);
      return { ...p, x: pt.x, y: pt.y };
    });
  const labels = root.append("g").attr("class", "bd-labels").selectAll("text").data(labelData).join("text")
    .attr("x", (d) => d.x).attr("y", (d) => d.y).attr("dy", (d) => -(d.s.w / 2 + 3)).text((d) => d.name);

  // Markers for a highlighted gene: a ring and its name at every copy, so
  // that short genes such as tRNAs can be found as easily as long ones
  const marks = root.append("g").attr("class", "bd-marks");
  const pointOf = (p) => svgEl.querySelector(`[data-seg="${CSS.escape(p.seg)}"]`).getPointAtLength(((p.a + p.b) / 2) * p.s.pathLen);

  // Pan and zoom; outlines, links and labels keep a constant size on screen
  const zoom = d3.zoom().scaleExtent([0.5, 40]).on("zoom", (e) => {
    root.attr("transform", e.transform);
    svgEl.style.setProperty("--s", e.transform.k);
  });
  svg.call(zoom).on("dblclick.zoom", null);
  svgEl.style.setProperty("--s", 1);

  return {
    reset: () => svg.transition().duration(350).call(zoom.transform, d3.zoomIdentity),
    zoomBy: (k) => svg.transition().duration(250).call(zoom.scaleBy, k),
    // genes: grey segments with genes painted on (Bandage's BLAST hits view);
    // random: Bandage's default random colour per segment; depth: a ramp
    colour(mode, depthScale, dark) {
      base.style("stroke", (s) => (mode === "depth" && s.depth ? depthScale(s.depth)
        : mode === "random" ? d3.hsl(hue(s.id), dark ? 0.5 : 0.58, dark ? 0.52 : 0.68).formatHex() : null));
      geneG.attr("display", mode === "genes" ? null : "none");
      labels.attr("display", mode === "genes" ? null : "none");
    },
    highlight(name) {
      svgEl.classList.toggle("bd-dim", !!name);
      geneSel.classed("on", (d) => d.name === name);
      labels.classed("on", (d) => d.name === name);
      // One marker per stretch of gene: exons on the same segment close
      // together share a marker
      const hits = parts.filter((p) => p.name === name).sort((x, y) => d3.ascending(x.seg, y.seg) || x.a - y.a);
      const groups = [];
      for (const p of hits) {
        const g = groups[groups.length - 1];
        if (g && g.seg === p.seg && (p.a - g.b) * p.s.pathLen < width * 6) { g.b = Math.max(g.b, p.b); continue; }
        groups.push({ ...p });
      }
      const at = groups.map((g) => ({ ...g, pt: pointOf(g) }));
      const m = marks.selectAll("g").data(at).join((e) => {
        const g = e.append("g");
        g.append("circle");
        g.append("text");
        return g;
      });
      m.attr("transform", (d) => `translate(${d.pt.x},${d.pt.y})`).attr("class", (d) => `c${d.cls}`);
      m.select("circle").attr("style", (d) => `--r:${d.s.w / 2 + 5}`);
      m.select("text").attr("style", (d) => `--r:${d.s.w / 2 + 5}`).text((d) => d.name);
    },
    segs, parts,
  };
}
