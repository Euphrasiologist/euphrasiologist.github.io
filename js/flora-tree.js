// flora-tree.js: the dated phylogeny of the British flora (Brown et al. 2023,
// PNAS), laid out with lwphylo and drawn with d3. Mounts on [data-flora-tree].
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import * as lw from "https://cdn.jsdelivr.net/npm/@euphrasiologist/lwphylo@1.5.3/+esm";

const TAU = Math.PI * 2;
const GAP = 14; // degrees left open at 12 o'clock for the time scale
const ROT = -90 + GAP / 2;
const ROT_RAD = (ROT / 360) * TAU;
const TIP_FONT = 1.25; // tip labels, in tree units (1 unit = 1 Myr)
const MAX_K = 48;

// Geological periods (ICS 2023), in Mya
const PERIODS = [
  ["Carboniferous", 358.9, 298.9],
  ["Permian", 298.9, 251.9],
  ["Triassic", 251.9, 201.4],
  ["Jurassic", 201.4, 145],
  ["Cretaceous", 145, 66],
  ["Paleogene", 66, 23.03],
  ["Neogene", 23.03, 2.58],
  ["Quaternary", 2.58, 0],
];

// Each named clade is the most recent common ancestor of its marker genera.
// These were checked against this tree: every MRCA holds only that clade.
// The eight coloured groups take the palette slots in the order they appear
// around the circle.
const GROUPS = {
  Monocots: ["Poa", "Orchis", "Potamogeton", "Allium", "Arum"],
  Ranunculales: ["Ranunculus", "Papaver", "Fumaria"],
  Caryophyllales: ["Silene", "Rumex", "Chenopodium", "Drosera"],
  Fabids: ["Trifolium", "Rosa", "Quercus", "Salix"],
  Malvids: ["Brassica", "Malva", "Epilobium", "Geranium", "Acer"],
  Ericales: ["Erica", "Primula", "Impatiens"],
  Lamiids: ["Galium", "Veronica", "Solanum", "Myosotis"],
  Campanulids: ["Senecio", "Heracleum", "Lonicera", "Ilex"],
};
const CLADES = {
  "Seed plants": null, // the root
  Angiosperms: ["Nymphaea", "Poa", "Quercus"],
  Eudicots: ["Ranunculus", "Quercus", "Senecio", "Buxus"],
  Rosids: ["Trifolium", "Brassica", "Quercus", "Epilobium", "Geranium"],
  Asterids: ["Erica", "Senecio", "Veronica", "Cornus"],
};
const ORDERS = {
  Alismatales: ["Potamogeton", "Alisma", "Lemna", "Zostera", "Arum"],
  Asparagales: ["Orchis", "Allium", "Iris"],
  Poales: ["Poa", "Carex", "Juncus", "Typha"],
  Ranunculales: ["Ranunculus", "Papaver", "Fumaria"],
  Caryophyllales: ["Silene", "Rumex", "Chenopodium", "Drosera"],
  Saxifragales: ["Saxifraga", "Sedum", "Ribes", "Myriophyllum"],
  Fabales: ["Trifolium", "Vicia", "Polygala"],
  Rosales: ["Rosa", "Urtica", "Ulmus", "Rhamnus"],
  Fagales: ["Quercus", "Betula", "Myrica"],
  Malpighiales: ["Salix", "Viola", "Euphorbia", "Hypericum", "Linum"],
  Myrtales: ["Epilobium", "Lythrum"],
  Geraniales: ["Geranium", "Erodium"],
  Brassicales: ["Brassica", "Reseda"],
  Malvales: ["Malva", "Helianthemum", "Tilia", "Daphne"],
  Ericales: ["Erica", "Primula", "Impatiens"],
  Gentianales: ["Galium", "Gentiana", "Vinca"],
  Lamiales: ["Veronica", "Euphrasia", "Mentha", "Plantago", "Fraxinus"],
  Boraginales: ["Myosotis", "Echium"],
  Solanales: ["Solanum", "Convolvulus"],
  Asterales: ["Senecio", "Campanula", "Menyanthes"],
  Apiales: ["Heracleum", "Hedera"],
  Dipsacales: ["Lonicera", "Valeriana", "Sambucus"],
};
const FAMILIES = {
  Poaceae: ["Poa", "Nardus", "Phragmites", "Brachypodium", "Cynodon"],
  Cyperaceae: ["Carex", "Cyperus", "Eleocharis", "Schoenus"],
  Juncaceae: ["Juncus", "Luzula"],
  Typhaceae: ["Typha", "Sparganium"],
  Orchidaceae: ["Orchis", "Neottia", "Epipactis", "Liparis"],
  Asparagaceae: ["Asparagus", "Hyacinthoides", "Polygonatum", "Ruscus"],
  Amaryllidaceae: ["Allium", "Narcissus", "Leucojum"],
  Potamogetonaceae: ["Potamogeton", "Zannichellia", "Groenlandia"],
  Hydrocharitaceae: ["Hydrocharis", "Najas", "Stratiotes"],
  Alismataceae: ["Alisma", "Sagittaria"],
  Araceae: ["Arum", "Lemna", "Wolffia"],
  Ranunculaceae: ["Ranunculus", "Aconitum", "Caltha", "Thalictrum"],
  Papaveraceae: ["Papaver", "Fumaria", "Chelidonium"],
  Caryophyllaceae: ["Silene", "Stellaria", "Herniaria", "Corrigiola"],
  Amaranthaceae: ["Chenopodium", "Atriplex", "Salicornia", "Beta"],
  Polygonaceae: ["Rumex", "Persicaria", "Polygonum"],
  Plumbaginaceae: ["Armeria", "Limonium"],
  Saxifragaceae: ["Saxifraga", "Chrysosplenium"],
  Crassulaceae: ["Sedum", "Crassula", "Umbilicus"],
  Fabaceae: ["Trifolium", "Vicia", "Ulex", "Lotus"],
  Rosaceae: ["Rosa", "Prunus", "Dryas", "Sorbus"],
  Urticaceae: ["Urtica", "Parietaria"],
  Betulaceae: ["Betula", "Alnus", "Corylus"],
  Fagaceae: ["Quercus", "Fagus"],
  Salicaceae: ["Salix", "Populus"],
  Euphorbiaceae: ["Euphorbia", "Mercurialis"],
  Onagraceae: ["Epilobium", "Circaea"],
  Geraniaceae: ["Geranium", "Erodium"],
  Brassicaceae: ["Brassica", "Cardamine", "Iberis", "Alliaria", "Teesdalia"],
  Malvaceae: ["Malva", "Tilia", "Althaea"],
  Cistaceae: ["Helianthemum", "Tuberaria"],
  Ericaceae: ["Erica", "Vaccinium", "Pyrola", "Monotropa"],
  Primulaceae: ["Primula", "Lysimachia", "Samolus"],
  Rubiaceae: ["Galium", "Rubia", "Sherardia"],
  Gentianaceae: ["Gentiana", "Centaurium"],
  Lamiaceae: ["Lamium", "Mentha", "Ajuga", "Scutellaria"],
  Orobanchaceae: [
    "Euphrasia",
    "Orobanche",
    "Melampyrum",
    "Pedicularis",
    "Lathraea",
  ],
  Plantaginaceae: [
    "Veronica",
    "Plantago",
    "Digitalis",
    "Linaria",
    "Callitriche",
    "Hippuris",
  ],
  Scrophulariaceae: ["Scrophularia", "Verbascum"],
  Lentibulariaceae: ["Pinguicula", "Utricularia"],
  Oleaceae: ["Fraxinus", "Ligustrum"],
  Boraginaceae: ["Myosotis", "Echium", "Symphytum", "Cynoglossum"],
  Solanaceae: ["Solanum", "Atropa"],
  Convolvulaceae: ["Convolvulus", "Cuscuta"],
  Asteraceae: ["Senecio", "Cirsium", "Bellis", "Achillea", "Hypochaeris"],
  Campanulaceae: ["Campanula", "Lobelia", "Jasione"],
  Apiaceae: ["Heracleum", "Eryngium", "Sanicula", "Daucus"],
  Caprifoliaceae: ["Lonicera", "Valeriana", "Knautia", "Linnaea"],
  Adoxaceae: ["Sambucus", "Adoxa", "Viburnum"],
};

const SVGNS = "http://www.w3.org/2000/svg";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const norm = (a) => ((a % TAU) + TAU) % TAU;
const fmt = (n) => (n < 10 ? n.toFixed(1) : Math.round(n)).toString();
const genusOf = (label) => label.split("_")[0];
const speciesName = (label) => label.replace(/_/g, " ");
const esc = (s) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

function polar(r, a) {
  return [r * Math.cos(a), r * Math.sin(a)];
}
function pt(r, a) {
  const [x, y] = polar(r, a);
  return x.toFixed(2) + " " + y.toFixed(2);
}
// An arc at radius r from angle a0 to a1 (radians, clockwise on screen if a1 > a0)
function arc(r, a0, a1, move = true) {
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return (
    (move ? "M" + pt(r, a0) : "") +
    "A" +
    r.toFixed(2) +
    " " +
    r.toFixed(2) +
    " 0 " +
    large +
    " " +
    sweep +
    " " +
    pt(r, a1)
  );
}
function el(name, attrs, parent) {
  const node = document.createElementNS(SVGNS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

// Turn the lwphylo layout into linked nodes with angles unwrapped so they
// increase monotonically from ROT around the circle.
function buildNodes(layout) {
  const rows = layout.data;
  const byId = new Map();
  for (const d of rows) {
    byId.set(d.thisId, {
      id: d.thisId,
      label: d.thisLabel,
      isTip: d.isTip,
      r: d.r,
      a: ROT_RAD + norm(d.angle - ROT_RAD),
      parentId: d.parentId,
      childIds: d.children,
    });
  }
  let root;
  for (const n of byId.values()) {
    n.parent = n.parentId == null ? null : byId.get(n.parentId);
    n.children = n.childIds.map((id) => byId.get(id));
    if (!n.parent) root = n;
  }
  const order = [];
  (function walk(n, depth) {
    n.depth = depth;
    order.push(n);
    n.children.forEach((c) => walk(c, depth + 1));
  })(root, 0);
  // Post-order: tip counts, angular extent and genera for each clade
  for (let i = order.length - 1; i >= 0; i--) {
    const n = order[i];
    if (n.isTip) {
      n.tips = [n];
      n.amin = n.amax = n.a;
    } else {
      n.tips = n.children.flatMap((c) => c.tips);
      n.amin = Math.min(...n.children.map((c) => c.amin));
      n.amax = Math.max(...n.children.map((c) => c.amax));
    }
  }
  return {
    root,
    order,
    tips: order.filter((n) => n.isTip).sort((a, b) => a.a - b.a),
  };
}

function mrca(tree, genera) {
  const set = new Set(genera);
  const tips = tree.tips.filter((t) => set.has(genusOf(t.label)));
  if (!tips.length) return null;
  let anc = tips[0];
  for (const t of tips) {
    let a = anc,
      b = t;
    while (a.depth > b.depth) a = a.parent;
    while (b.depth > a.depth) b = b.parent;
    while (a !== b) {
      a = a.parent;
      b = b.parent;
    }
    anc = a;
  }
  return anc;
}

function mount(fig) {
  const svg = fig.querySelector(".flora-stage > svg");
  const card = fig.querySelector(".flora-card");
  const legend = fig.querySelector(".flora-legend");
  const input = fig.querySelector(".flora-search input");
  const list = fig.querySelector("datalist");
  const status = fig.querySelector(".flora-status");

  return fetch(fig.dataset.floraTree)
    .then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    })
    .then((newick) => {
      const parsed = lw.ladderize(lw.readTree(newick), { ascending: false });
      const layout = lw.radialLayout(parsed, {
        openAngleDeg: GAP,
        rotateDeg: ROT,
      });
      const tree = buildNodes(layout);
      draw(fig, svg, card, legend, input, list, tree);
      status.remove();
    })
    .catch(() => {
      status.textContent =
        "The tree could not be loaded. It is also on Observable (link below).";
    });
}

function draw(fig, svg, card, legend, input, list, tree) {
  const R = Math.max(...tree.tips.map((t) => t.r)); // root age; tips sit here
  const step =
    (tree.tips[tree.tips.length - 1].a - tree.tips[0].a) /
    (tree.tips.length - 1);
  const FAM_R = R + 25,
    ORD_R = R + 34,
    V = R + 50;
  svg.setAttribute("viewBox", [-V, -V, 2 * V, 2 * V].join(" "));

  // Name the clades, then let every node inherit its group, order and family
  const named = (defs, key) => {
    const out = [];
    for (const name in defs) {
      const n = defs[name] ? mrca(tree, defs[name]) : tree.root;
      if (!n) continue;
      n[key] = name;
      out.push({ name, node: n });
    }
    return out;
  };
  const groups = named(GROUPS, "groupName").sort(
    (a, b) => a.node.amin - b.node.amin,
  );
  groups.forEach((g, i) => (g.node.slot = i + 1));
  named(CLADES, "cladeName");
  const orders = named(ORDERS, "orderName");
  const families = named(FAMILIES, "familyName");
  for (const n of tree.order) {
    const p = n.parent || {};
    n.slot = n.slot || p.slot || 0;
    n.group = n.groupName || p.group;
    n.ord = n.orderName || p.ord;
    n.fam = n.familyName || p.fam;
  }

  const edgePath = (n) => arc(n.parent.r, n.parent.a, n.a) + "L" + pt(n.r, n.a);
  const subtreePath = (n) => {
    let d = "";
    (function walk(m) {
      m.children.forEach((c) => {
        d += edgePath(c);
        walk(c);
      });
    })(n);
    if (n.parent) d += "M" + pt(n.parent.r, n.a) + "L" + pt(n.r, n.a);
    return d;
  };
  const lineagePath = (n) => {
    let d = "";
    for (let m = n.parent; m && m.parent; m = m.parent) d += edgePath(m);
    if (n.parent) d += arc(n.parent.r, n.parent.a, n.a);
    return d;
  };
  const sector = (n, r0, r1) => {
    const a0 = n.amin - step / 2,
      a1 = n.amax + step / 2;
    return arc(r1, a0, a1) + "L" + pt(r0, a1) + arc(r0, a1, a0, false) + "Z";
  };

  svg.replaceChildren();
  const defs = el("defs", {}, svg);
  const clip = el("clipPath", { id: "flora-reveal" }, defs);
  const clipCircle = el("circle", { r: reduceMotion ? V * 1.5 : 0 }, clip);
  const world = el("g", { class: "world" }, svg);

  // Geological periods as alternate bands, named in the gap at the top
  const time = el("g", { class: "time" }, world);
  PERIODS.forEach(([name, from, to], i) => {
    const r0 = Math.max(R - from, 0),
      r1 = R - to;
    if (i % 2 === 0) {
      el(
        "path",
        {
          class: "band",
          d:
            "M" +
            r1 +
            " 0A" +
            r1 +
            " " +
            r1 +
            " 0 1 1 " +
            -r1 +
            " 0A" +
            r1 +
            " " +
            r1 +
            " 0 1 1 " +
            r1 +
            " 0" +
            (r0 > 0
              ? "M" +
                r0 +
                " 0A" +
                r0 +
                " " +
                r0 +
                " 0 1 0 " +
                -r0 +
                " 0A" +
                r0 +
                " " +
                r0 +
                " 0 1 0 " +
                r0 +
                " 0"
              : ""),
        },
        time,
      );
    }
    if (r1 - r0 > 12) {
      const t = el("text", { class: "period", x: 0, y: -(r0 + r1) / 2 }, time);
      t.textContent = name;
    }
    if (from < R && i > 0 && from > 10) {
      el("circle", { class: "boundary", r: r0 }, time);
      const t = el("text", { class: "tick", x: 0, y: -r0 }, time);
      t.textContent = fmt(from) + " Mya";
    }
  });
  const now = el("text", { class: "tick", x: 0, y: -R - 3 }, time);
  now.textContent = "Present";

  const hl = el("g", { class: "highlight" }, world);
  const wedge = el("path", { class: "wedge" }, hl);
  const tree$ = el(
    "g",
    { class: "branches", "clip-path": "url(#flora-reveal)" },
    world,
  );

  // One path per colour: a few thousand edges in nine elements
  const byslot = new Map();
  for (const n of tree.order)
    if (n.parent) byslot.set(n.slot, (byslot.get(n.slot) || "") + edgePath(n));
  for (const [slot, d] of byslot)
    el("path", { class: "edges g" + slot, d }, tree$);

  const over = el("g", { class: "overlay" }, world);
  const lineage = el("path", { class: "lineage" }, over);
  const clade = el("path", { class: "clade" }, over);
  const marks = el("g", { class: "marks" }, over);

  // Family and order rings around the outside
  const rings = el("g", { class: "rings" }, world);
  const ringLabels = [];
  const ring = (items, r, cls) => {
    items.forEach(({ name, node }, i) => {
      const a0 = node.amin - step * 0.4,
        a1 = node.amax + step * 0.4;
      el("path", { class: cls + " g" + node.slot, d: arc(r, a0, a1) }, rings);
      // Flip labels on the lower half so they read left to right
      const mid = (a0 + a1) / 2,
        flip = Math.sin(mid) > 0;
      const lr = r + (cls === "ord" ? 5.5 : 4.5);
      const id = "flora-" + cls + "-" + i;
      el(
        "path",
        { id, class: "guide", d: flip ? arc(lr, a1, a0) : arc(lr, a0, a1) },
        defs,
      );
      const t = el("text", { class: cls + "-label" }, rings);
      const tp = el("textPath", { href: "#" + id, startOffset: "50%" }, t);
      tp.textContent = name;
      ringLabels.push({ t, cls, name, len: lr * (a1 - a0) });
    });
  };
  ring(families, FAM_R, "fam");
  ring(orders, ORD_R, "ord");

  // Tip labels, flipped on the left so none read upside down
  const labels = el("g", { class: "tips" }, world);
  for (const t of tree.tips) {
    const deg = (t.a * 360) / TAU;
    const left = Math.cos(t.a) < 0;
    t.text = el(
      "text",
      {
        class: "tip-label",
        transform:
          "rotate(" +
          deg.toFixed(3) +
          ") translate(" +
          (R + 1.6) +
          " 0)" +
          (left ? " rotate(180)" : ""),
        "text-anchor": left ? "end" : "start",
      },
      labels,
    );
    t.text.textContent = speciesName(t.label);
  }

  // Zoom. --s is screen pixels per tree unit, so text can stay a fixed size.
  let current = d3.zoomIdentity;
  const zoom = d3
    .zoom()
    .scaleExtent([1, MAX_K])
    .translateExtent([
      [-V * 1.2, -V * 1.2],
      [V * 1.2, V * 1.2],
    ])
    .on("zoom", (e) => {
      current = e.transform;
      world.setAttribute("transform", current.toString());
      scaleText();
    });
  const sel = d3.select(svg).call(zoom).on("dblclick.zoom", null);

  function scaleText() {
    const s =
      (Math.min(svg.clientWidth, svg.clientHeight) / (2 * V)) * current.k;
    fig.style.setProperty("--s", s);
    fig.classList.toggle("labels-on", TIP_FONT * s >= 7);
    fig.classList.toggle("fams-on", s >= 2.4);
    for (const l of ringLabels) {
      const size = Math.min(11 / s, l.cls === "ord" ? 9 : 4.5);
      l.t.style.display = l.name.length * size * 0.6 < l.len ? "" : "none";
    }
  }
  scaleText();
  new ResizeObserver(scaleText).observe(svg);

  function zoomTo(n, k) {
    let t;
    if (!n || n === tree.root) {
      t = d3.zoomIdentity;
    } else {
      // Fit the clade's sector, from its stem out to the tip labels
      const r0 = n.parent ? n.parent.r : 0,
        r1 = R + 22;
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = n.amin + ((n.amax - n.amin) * i) / 16;
        pts.push(polar(r0, a), polar(r1, a));
      }
      const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs),
        h = Math.max(...ys) - Math.min(...ys);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2,
        cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const kk =
        k || Math.min(MAX_K, Math.max(1, (0.9 * 2 * V) / Math.max(w, h, 1)));
      t = d3.zoomIdentity.scale(kk).translate(-cx, -cy);
    }
    sel
      .transition()
      .duration(reduceMotion ? 0 : 900)
      .ease(d3.easeCubicInOut)
      .call(zoom.transform, t);
  }

  // Pointer → the lineage under it at that point in time
  function hit(e) {
    const [x, y] = d3.pointer(e, world);
    const rho = Math.hypot(x, y);
    if (rho > R + 44) return null;
    const a = ROT_RAD + norm(Math.atan2(y, x) - ROT_RAD);
    const i = d3.bisector((t) => t.a).center(tree.tips, a);
    const tip = tree.tips[i];
    if (Math.abs(tip.a - a) > step * 1.5) return null;
    if (rho >= tip.parent.r) return tip;
    let n = tip;
    while (n.parent && n.parent.r > rho) n = n.parent;
    return n;
  }

  let pinned = null,
    hovered = null;
  function show(n) {
    fig.classList.toggle("selecting", !!n);
    tree.tips.forEach((t) => t.text.classList.remove("on"));
    marks.replaceChildren();
    if (!n) {
      wedge.setAttribute("d", "");
      clade.setAttribute("d", "");
      lineage.setAttribute("d", "");
      card.innerHTML = cardIdle;
      return;
    }
    const slot = "g" + n.slot;
    wedge.setAttribute("class", "wedge " + slot);
    wedge.setAttribute("d", sector(n, n.parent ? n.parent.r : 0, R + 22));
    clade.setAttribute("class", "clade " + slot);
    clade.setAttribute("d", n.isTip ? edgePath(n) : subtreePath(n));
    lineage.setAttribute("d", lineagePath(n));
    if (n.isTip) {
      n.text.classList.add("on");
      el(
        "circle",
        {
          class: "dot " + slot,
          cx: polar(R, n.a)[0],
          cy: polar(R, n.a)[1],
          r: 1.4,
        },
        marks,
      );
    }
    card.innerHTML = describe(n);
  }
  function describe(n) {
    const crown = R - n.r,
      stem = n.parent ? R - n.parent.r : null;
    const where = [n.fam, n.ord, n.group].filter(
      (x, i, arr) => x && x !== n.cladeName && arr.indexOf(x) === i,
    );
    if (n.isTip) {
      return (
        '<p class="flora-title"><i>' +
        esc(speciesName(n.label)) +
        "</i></p>" +
        (where.length
          ? '<p class="flora-where">' + esc(where.join(" · ")) + "</p>"
          : "") +
        "<dl><dt>Diverged from its closest relative here</dt><dd>" +
        fmt(stem) +
        " Mya</dd></dl>"
      );
    }
    const genera = [...new Set(n.tips.map((t) => genusOf(t.label)))];
    const name = n.familyName || n.orderName || n.groupName || n.cladeName;
    const title =
      genera.length === 1
        ? "<i>" + esc(genera[0]) + "</i>"
        : name
          ? esc(name)
          : "A clade within " + esc(where[0] || "the seed plants");
    const ctx = where.filter(
      (x) => x !== name && !(genera.length > 1 && !name && x === where[0]),
    );
    return (
      '<p class="flora-title">' +
      title +
      "</p>" +
      (ctx.length
        ? '<p class="flora-where">' + esc(ctx.join(" · ")) + "</p>"
        : "") +
      "<dl><dt>Species</dt><dd>" +
      n.tips.length.toLocaleString("en-GB") +
      "</dd>" +
      (genera.length > 1
        ? "<dt>Genera</dt><dd>" + genera.length + "</dd>"
        : "") +
      "<dt>Crown age</dt><dd>" +
      fmt(crown) +
      " Mya</dd>" +
      (stem != null ? "<dt>Stem age</dt><dd>" + fmt(stem) + " Mya</dd>" : "") +
      "</dl>" +
      (genera.length > 1 && genera.length <= 12
        ? '<p class="flora-genera">' +
          genera.map((g) => "<i>" + esc(g) + "</i>").join(", ") +
          "</p>"
        : "")
    );
  }
  const cardIdle = card.innerHTML;

  svg.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || pinned) return;
    const n = hit(e);
    if (n !== hovered) show((hovered = n));
  });
  svg.addEventListener("pointerleave", () => {
    hovered = null;
    if (!pinned) show(null);
  });
  sel.on("click", (e) => {
    if (e.defaultPrevented) return; // the end of a drag
    const n = hit(e);
    pin(n && n !== pinned ? n : null, !!n);
  });
  function pin(n, move) {
    pinned = n;
    fig.classList.toggle("pinned", !!n);
    show(n);
    if (move) zoomTo(n, n && n.isTip ? Math.max(current.k, 9) : undefined);
  }
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && pinned) pin(null, false);
  });

  // Legend: the coloured groups, each a shortcut to its clade
  legend.replaceChildren(
    ...groups.map((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "flora-key";
      b.innerHTML =
        '<span class="sw g' +
        g.node.slot +
        '"></span>' +
        esc(g.name) +
        ' <span class="n">' +
        g.node.tips.length +
        "</span>";
      b.addEventListener("click", () => pin(g.node, true));
      b.addEventListener("pointerenter", () => !pinned && show(g.node));
      b.addEventListener("pointerleave", () => !pinned && show(null));
      return b;
    }),
  );

  // Search across species and genera
  const genera = d3.rollup(
    tree.tips,
    (v) => v.length,
    (t) => genusOf(t.label),
  );
  const options = [...genera]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([g, c]) => g + " (" + c + (c > 1 ? " species)" : " species)"))
    .concat(tree.tips.map((t) => speciesName(t.label)).sort());
  list.replaceChildren(
    ...options.map((o) =>
      Object.assign(document.createElement("option"), { value: o }),
    ),
  );
  function find(q) {
    q = q
      .trim()
      .replace(/\s*\(.*$/, "")
      .toLowerCase();
    if (!q) return null;
    const tip =
      tree.tips.find((t) => speciesName(t.label).toLowerCase() === q) ||
      tree.tips.find(
        (t) =>
          speciesName(t.label).toLowerCase().startsWith(q) && q.includes(" "),
      );
    if (tip) return tip;
    const g =
      [...genera.keys()].find((x) => x.toLowerCase() === q) ||
      [...genera.keys()].find((x) => x.toLowerCase().startsWith(q));
    if (g) return mrca(tree, [g]);
    const all = Object.assign({}, FAMILIES, ORDERS, GROUPS, CLADES);
    const name = Object.keys(all).find((x) => x.toLowerCase().startsWith(q));
    return name ? (all[name] ? mrca(tree, all[name]) : tree.root) : null;
  }
  function search() {
    const n = find(input.value);
    input.setCustomValidity(n || !input.value ? "" : "No match");
    if (n) pin(n, true);
  }
  input.addEventListener("change", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") search();
  });

  fig
    .querySelector('[data-act="in"]')
    .addEventListener("click", () =>
      sel.transition().duration(300).call(zoom.scaleBy, 2),
    );
  fig
    .querySelector('[data-act="out"]')
    .addEventListener("click", () =>
      sel.transition().duration(300).call(zoom.scaleBy, 0.5),
    );
  fig.querySelector('[data-act="reset"]').addEventListener("click", () => {
    input.value = "";
    pin(null, false);
    zoomTo(null);
  });
  const fs = fig.querySelector('[data-act="full"]');
  if (fig.requestFullscreen) {
    fs.hidden = false;
    fs.addEventListener("click", () =>
      document.fullscreenElement
        ? document.exitFullscreen()
        : fig.requestFullscreen(),
    );
  }

  // Grow the tree outward from the root on first view
  if (!reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        d3.select(clipCircle)
          .transition()
          .duration(1600)
          .ease(d3.easeCubicOut)
          .attr("r", V * 1.5);
      },
      { threshold: 0.2 },
    );
    io.observe(svg);
  }
}

document.querySelectorAll("[data-flora-tree]").forEach(mount);
