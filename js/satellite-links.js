// satellite-links.js: shared end satellites in the telomerase-loss clades, a closer look than the
// circular tree allows. Each clade is drawn flat: the dated subtree above the tips, and below them
// an arc for every pair of species whose chromosome ends carry a related satellite. An arc reaches
// as deep as the pair's common ancestor is old, on the tree's own time scale, so the lower half
// mirrors the upper: sister species make shallow humps, old pairs deep loops.
// Uses the layout from telomere-tree.js prepare(); sizes are pixels of the viewBox.
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const W = 1000;
const PAD = { left: 46, right: 14 };
const TITLE = 16; // title line above each row
const BAND = 7; // taxonomic family band under the tips
const MIN_DEPTH = 5; // shallowest arc, so that sister pairs stay visible
const LABELS = 14; // family labels at the bottom of a row
const GAP = 22; // between rows

// clades: [{ title, tips: Set of species, height }], height in px for the tree (and the arcs)
// familyOf(species) -> taxonomic family; links: [a, b, identity, divergence, family pairs]
export function render(
  el,
  P,
  { theme, clades, familyOf, links, selected = null, onSelect = null, tip = null },
) {
  const { tips, byId, ageOf, mrca, tipByName, step } = P;
  const C = theme;
  const colour = d3
    .scaleLinear()
    .domain([75, 100])
    .range(C.links)
    .interpolate(d3.interpolateLab)
    .clamp(true);

  // rows: each clade's crown, its tips, and the links inside it
  let y0 = 0;
  const rows = clades.map((c) => {
    const members = tips.filter((d) => c.tips.has(d.thisLabel));
    const crown = mrca([members[0].thisLabel, members[members.length - 1].thisLabel]);
    const inside = new Set();
    (function walk(id) {
      inside.add(id);
      byId.get(id).children.forEach(walk);
    })(crown.thisId);
    const rowTips = tips.filter((d) => inside.has(d.thisId));
    const first = rowTips[0].index;
    const dx = (W - PAD.left - PAD.right) / rowTips.length;
    const xOf = (n) => PAD.left + ((n.angle - tips[first].angle) / step) * dx + dx / 2;
    const age = d3.scaleLinear().domain([ageOf(crown) * 1.03, 0]).range([0, c.height]);
    const top = y0 + TITLE;
    const base = top + c.height; // the tips
    const own = (links || [])
      .filter(([a, b]) => tipByName.has(a) && tipByName.has(b))
      .map(([a, b, pid, myr, n]) => {
        const ta = tipByName.get(a),
          tb = tipByName.get(b);
        return { a: ta, b: tb, pid, n, m: mrca([a, b]), myr };
      })
      .filter((l) => inside.has(l.a.thisId) && inside.has(l.b.thisId))
      .map((l) => ({ ...l, myr: l.myr ?? ageOf(l.m) }))
      .sort((p, q) => d3.descending(p.myr, q.myr));
    const row = {
      ...c,
      crown,
      inside,
      rowTips,
      first,
      dx,
      xOf,
      age,
      top,
      base,
      links: own,
      y: y0,
    };
    y0 = base + BAND + c.height + LABELS + GAP;
    return row;
  });
  const H = y0 - GAP + 4;

  const svg = d3
    .select(el)
    .append("svg")
    .attr("viewBox", [0, 0, W, H])
    .attr("font-family", "Helvetica, Arial, sans-serif")
    .attr("font-size", 10)
    .attr("fill", C.ink)
    .attr("role", "img")
    .attr(
      "aria-label",
      "Dated subtrees of the telomerase-loss clades, with arcs below the tips joining species whose chromosome ends share a related satellite",
    );
  svg.append("rect").attr("width", W).attr("height", H).attr("fill", C.bg);
  const zoomed = svg.append("g");

  const arcPath = (row, l) => {
    const xa = row.xOf(l.a),
      xb = row.xOf(l.b);
    const depth = Math.max(MIN_DEPTH, row.age(0) - row.age(l.myr));
    const y = row.base + BAND;
    // a cubic with both controls at 4/3 of the depth bottoms out at exactly the depth
    const c = y + (depth * 4) / 3;
    return `M${xa.toFixed(2)},${y}C${xa.toFixed(2)},${c.toFixed(2)} ${xb.toFixed(2)},${c.toFixed(2)} ${xb.toFixed(2)},${y}`;
  };

  for (const row of rows) {
    const g = zoomed.append("g");
    row.g = g;
    g.append("text")
      .attr("x", 2)
      .attr("y", row.y + 10)
      .attr("font-weight", 700)
      .text(`${row.title} (${row.rowTips.length} tips, ${row.links.length} shared pairs)`);

    // time axis: the tree above, the arcs below, on one scale
    const ticks = d3.range(0, ageOf(row.crown), ageOf(row.crown) > 150 ? 50 : 25);
    const axis = g.append("g").attr("fill", C.ink2).attr("font-size", 8.5);
    for (const t of ticks) {
      const up = row.top + row.age(t),
        down = row.base + BAND + (row.age(0) - row.age(t));
      for (const yy of t ? [up, down] : [up])
        axis
          .append("line")
          .attr("x1", PAD.left - 4)
          .attr("x2", W - PAD.right)
          .attr("y1", yy)
          .attr("y2", yy)
          .attr("stroke", C.guide)
          .attr("stroke-width", 0.6);
      for (const yy of t ? [up, down] : [up])
        axis
          .append("text")
          .attr("x", PAD.left - 7)
          .attr("y", yy)
          .attr("dy", "0.32em")
          .attr("text-anchor", "end")
          .text(t);
    }
    axis
      .append("text")
      .attr("transform", `translate(9,${row.top + row.height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .text("Myr ago");
    axis
      .append("text")
      .attr("transform", `translate(9,${row.base + BAND + row.height / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .text("Diverged, Myr");

    // the subtree
    const yOf = (n) => row.top + row.age(ageOf(n));
    let d = "";
    for (const id of row.inside) {
      const n = byId.get(id);
      const x = row.xOf(n).toFixed(2);
      const py = n === row.crown ? row.top : yOf(byId.get(n.parentId));
      d += `M${x},${py.toFixed(2)}V${yOf(n).toFixed(2)}`;
      if (n.children.length) {
        const xs = n.children.map((c) => row.xOf(byId.get(c)));
        d += `M${d3.min(xs).toFixed(2)},${yOf(n).toFixed(2)}H${d3.max(xs).toFixed(2)}`;
      }
    }
    g.append("path")
      .attr("d", d)
      .attr("fill", "none")
      .attr("stroke", C.branch)
      .attr("stroke-width", 0.6)
      .attr("stroke-linecap", "round");

    // taxonomic families: alternating band, with the larger ones named at the bottom
    const runs = [];
    row.rowTips.forEach((t, i) => {
      const f = familyOf(t.thisLabel) || "";
      const last = runs[runs.length - 1];
      if (last && last.f === f) last.end = i;
      else runs.push({ f, start: i, end: i });
    });
    row.runs = runs;
    g.append("g")
      .selectAll("rect")
      .data(runs)
      .join("rect")
      .attr("x", (r) => PAD.left + r.start * row.dx)
      .attr("width", (r) => (r.end - r.start + 1) * row.dx)
      .attr("y", row.base + 1)
      .attr("height", BAND - 2)
      .attr("fill", (r, i) => (i % 2 ? C.clade[1] : C.clade[0]))
      .attr("fill-opacity", (r, i) => (i % 2 ? 0.55 : 0.85));
    const labelY = row.base + BAND + row.height + LABELS - 3;
    g.append("g")
      .attr("fill", C.ink2)
      .attr("font-size", 8.5)
      .attr("text-anchor", "middle")
      .selectAll("text")
      .data(runs.filter((r) => r.f && (r.end - r.start + 1) * row.dx > r.f.length * 5 + 6))
      .join("text")
      .attr("x", (r) => PAD.left + ((r.start + r.end + 1) / 2) * row.dx)
      .attr("y", labelY)
      .text((r) => r.f);

    // arcs, oldest first so the many shallow ones sit on top
    row.arcCase = g
      .append("g")
      .attr("fill", "none")
      .attr("stroke", C.bg)
      .attr("stroke-width", 3)
      .selectAll("path")
      .data(row.links)
      .join("path")
      .attr("d", (l) => arcPath(row, l));
    row.arcSel = g
      .append("g")
      .attr("fill", "none")
      .attr("stroke-linecap", "round")
      .selectAll("path")
      .data(row.links)
      .join("path")
      .attr("d", (l) => arcPath(row, l))
      .attr("stroke", (l) => colour(l.pid))
      .attr("stroke-width", 1.6);
    const ends = [
      ...new Map(row.links.flatMap((l) => [[l.a.thisLabel, l.a], [l.b.thisLabel, l.b]])).values(),
    ];
    g.append("g")
      .attr("fill", C.links[1])
      .attr("stroke", C.bg)
      .attr("stroke-width", 0.5)
      .selectAll("circle")
      .data(ends)
      .join("circle")
      .attr("cx", (t) => row.xOf(t))
      .attr("cy", row.base + BAND)
      .attr("r", Math.min(2.4, Math.max(1.4, row.dx / 2)));
    row.marker = g.append("g").attr("pointer-events", "none");
    row.hit = g
      .append("g")
      .attr("class", "arcs")
      .attr("fill", "none")
      .attr("stroke", "transparent")
      .attr("stroke-width", 7)
      .selectAll("path")
      .data(row.links)
      .join("path")
      .attr("d", (l) => arcPath(row, l));
  }

  // identity key, top right
  const key = zoomed.append("g").attr("transform", `translate(${W - PAD.right - 200},0)`).attr("font-size", 9);
  const grad = svg.append("defs").append("linearGradient").attr("id", "satIdentity");
  grad.append("stop").attr("offset", 0).attr("stop-color", colour(75));
  grad.append("stop").attr("offset", 1).attr("stop-color", colour(100));
  key.append("text").attr("x", 0).attr("y", 10).attr("fill", C.ink2).text("Identity 75%");
  key.append("rect").attr("x", 64).attr("y", 4).attr("width", 80).attr("height", 7).attr("rx", 2).attr("fill", "url(#satIdentity)");
  key.append("text").attr("x", 150).attr("y", 10).attr("fill", C.ink2).text("100%");

  // ---- interaction ----
  const tipSel = d3.select(tip);
  function showTip(event, html) {
    tipSel.html(html).style("display", "block");
    const box = tipSel.node().getBoundingClientRect();
    const x = event.clientX + 14 + box.width > innerWidth ? event.clientX - box.width - 14 : event.clientX + 14;
    const yy = event.clientY + 14 + box.height > innerHeight ? event.clientY - box.height - 14 : event.clientY + 14;
    tipSel.style("left", `${x}px`).style("top", `${yy}px`);
  }
  const hideTip = () => tipSel.style("display", "none");
  const name = (t) => `<i>${t.thisLabel.replace(/_/g, " ")}</i>`;

  // Emphasises the arcs of one species (or one arc) and marks its tips; null restores the selection.
  function emphasise(sp, only = null, fade = true) {
    for (const row of rows) {
      const on = (l) => (only ? l === only : l.a.thisLabel === sp || l.b.thisLabel === sp);
      const any = row.links.some(on);
      row.arcSel
        .attr("stroke-width", (l) => (any && on(l) ? 2.6 : 1.6))
        .attr("stroke-opacity", (l) => (fade && any && !on(l) ? 0.3 : 1));
      row.arcCase.attr("stroke-width", (l) => (any && on(l) ? 4.2 : 3));
      if (any) {
        row.arcCase.filter(on).raise();
        row.arcSel.filter(on).raise();
      }
      row.marker.selectAll("*").remove();
      const marked = only ? [only.a, only.b] : sp && tipByName.has(sp) && row.inside.has(tipByName.get(sp).thisId) ? [tipByName.get(sp)] : [];
      for (const t of marked) {
        const x = row.xOf(t);
        row.marker
          .append("rect")
          .attr("x", x - Math.max(row.dx, 2) / 2)
          .attr("width", Math.max(row.dx, 2))
          .attr("y", row.top)
          .attr("height", row.height + BAND)
          .attr("fill", C.ink)
          .attr("fill-opacity", 0.1);
        row.marker
          .append("path")
          .attr("d", `M${x},${row.base - 1}l-3.5,-6h7z`)
          .attr("fill", C.ink);
      }
    }
  }
  const reset = () => emphasise(selected, null, false);
  reset();

  function tipUnder(event) {
    for (const row of rows) {
      const [x, y] = d3.pointer(event, row.g.node());
      if (y >= row.top && y <= row.base + BAND && x >= PAD.left && x <= W - PAD.right)
        return { row, t: row.rowTips[Math.floor((x - PAD.left) / row.dx)] };
    }
    return null;
  }
  const partners = (row, t) =>
    row.links
      .filter((l) => l.a === t || l.b === t)
      .map((l) => (l.a === t ? l.b : l.a));
  svg
    .on("pointermove", (event) => {
      if (event.target.closest(".arcs")) return;
      const hit = tipUnder(event);
      svg.style("cursor", hit ? "pointer" : null);
      if (!hit?.t) {
        hideTip();
        reset();
        return;
      }
      const ps = partners(hit.row, hit.t);
      showTip(
        event,
        `${name(hit.t)}<span>${familyOf(hit.t.thisLabel) ?? ""}</span><span>${
          ps.length ? `Shares an end satellite with ${ps.map(name).join(", ").replace(/<\/?i>/g, "")}` : "Shares no end satellite with another species"
        }</span><span class="tl-tiphint">Click to open</span>`,
      );
      emphasise(hit.t.thisLabel);
    })
    .on("pointerleave", () => {
      hideTip();
      reset();
    })
    .on("click", (event) => {
      if (event.defaultPrevented || event.target.closest(".arcs")) return;
      const hit = tipUnder(event);
      if (hit?.t && onSelect) onSelect(hit.t.thisLabel);
    });
  for (const row of rows)
    row.hit
      .on("pointerenter pointermove", (event, l) => {
        showTip(
          event,
          `<b>Shared end satellite</b>${name(l.a)}${name(l.b)}
          <span>${l.n === 1 ? "One end family" : `${l.n} end families`}, up to ${l.pid.toFixed(1)}% identity</span>
          <span>Diverged about ${l.myr.toFixed(0)} Myr ago</span>
          <span class="tl-tiphint">Click to open ${name(l.a)}</span>`,
        );
        emphasise(null, l);
      })
      .on("pointerleave", () => {
        hideTip();
        reset();
      })
      .on("click", (event, l) => {
        event.preventDefault();
        onSelect?.(l.a.thisLabel);
      });

  // zoom as in the main figure: wheel with ctrl or cmd (and pinches), two-finger touch, drag to pan
  const zoom = d3
    .zoom()
    .scaleExtent([1, 16])
    .translateExtent([
      [0, 0],
      [W, H],
    ])
    .filter((e) =>
      e.type === "wheel" ? e.ctrlKey || e.metaKey : e.type.startsWith("touch") ? e.touches.length > 1 : !e.button,
    )
    .on("zoom", (e) => zoomed.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  return {
    svg: svg.node(),
    select(sp) {
      selected = sp;
      reset();
    },
    zoomBy: (f) => svg.transition().duration(250).call(zoom.scaleBy, f),
    reset: () => svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity),
  };
}
