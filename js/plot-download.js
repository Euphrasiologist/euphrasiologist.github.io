// plot-download.js: small SVG and PNG download buttons for each chart card.
// The chart is exported as it is drawn at that moment, from the live data and
// in the current light or dark theme.

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
const today = () => new Date().toISOString().slice(0, 10);

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

// A self-contained copy of the chart, with a title, colour key and source
// line: page fonts, colours and CSS variables are resolved, and a background
// is added so it reads on any slide
function standalone(card, opts) {
  const plot = card.querySelector(".gs-plot > *");
  const svg = card.querySelector(".gs-plot svg");
  const css = getComputedStyle(svg);
  const bg = getComputedStyle(card).backgroundColor;
  const muted = getComputedStyle(card.querySelector("h3") || card).color;
  const { width, height } = svg.getBoundingClientRect();
  const W = Math.round(width),
    pad = 4;

  const chart = svg.cloneNode(true);
  chart.querySelectorAll('[aria-label="tip"]').forEach((n) => n.remove());
  chart.setAttribute("width", W);
  chart.setAttribute("height", Math.round(height));
  chart.style.color = css.color;
  chart.style.background = "none";
  // Resolve the CSS variables that the marks use for halos and outlines
  chart.querySelectorAll("*").forEach((n) => {
    for (const a of ["fill", "stroke"]) {
      const v = n.getAttribute(a);
      if (v && v.includes("var("))
        n.setAttribute(a, /plot-background/.test(v) ? bg : css.color);
    }
  });

  const out = el("svg", {
    xmlns: NS,
    width: W,
    "font-family": css.fontFamily,
    "font-size": 11,
  });
  out.style.color = css.color;
  const rect = el("rect", { width: "100%", height: "100%", fill: bg });
  out.append(rect);
  let y = pad + 14;
  out.append(
    el(
      "text",
      { x: pad, y, "font-size": 14, "font-weight": 600, fill: css.color },
      card.dataset.title,
    ),
  );
  y += 10;

  // Colour key from the chart's own colour scale
  const scale = plot.scale?.("color");
  if (scale && (scale.type === "ordinal" || scale.type === "categorical")) {
    let x = pad;
    y += 12;
    const label = scale.label || opts.colorLabel?.();
    if (label) {
      out.append(
        el(
          "text",
          { x, y: y + 0.5, fill: css.color, "font-weight": 600 },
          label,
        ),
      );
      x += label.length * 6.4 + 12;
    }
    scale.domain.forEach((d, i) => {
      const label = String(d),
        w = 18 + label.length * 6.2;
      if (x + w > W - pad && x > pad) {
        x = pad;
        y += 17;
      }
      out.append(
        el("rect", {
          x,
          y: y - 9,
          width: 11,
          height: 11,
          rx: 2,
          fill: scale.range[i % scale.range.length],
          stroke: css.color,
          "stroke-opacity": 0.35,
        }),
      );
      out.append(el("text", { x: x + 16, y: y + 0.5, fill: css.color }, label));
      x += w + 10;
    });
    y += 10;
  } else if (scale && plot.legend) {
    const ramp = plot.legend("color", { width: Math.min(300, W - 2 * pad) });
    const rs =
      ramp?.tagName?.toLowerCase() === "svg"
        ? ramp
        : ramp?.querySelector?.("svg");
    if (rs) {
      const rh = +rs.getAttribute("height") || 50;
      rs.setAttribute("x", pad);
      rs.setAttribute("y", y);
      rs.style.color = css.color;
      out.append(rs);
      y += rh;
    }
  }

  y += 6;
  chart.setAttribute("x", 0);
  chart.setAttribute("y", y);
  out.append(chart);
  y += Math.round(height) + 16;
  const src = `${location.host}${location.pathname} · live data as of ${today()}`;
  out.append(el("text", { x: pad, y, fill: muted, "font-size": 10 }, src));
  const H = y + pad + 4;
  out.setAttribute("height", H);
  out.setAttribute("viewBox", `0 0 ${W} ${H}`);
  return {
    text: new XMLSerializer().serializeToString(out),
    width: W,
    height: H,
  };
}

function save(blob, name) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: name,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function download(card, format, opts) {
  if (!card.querySelector(".gs-plot svg")) return;
  const name = `${card.dataset.name}-${today()}`;
  const { text, width, height } = standalone(card, opts);
  const svgBlob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  if (format === "svg") return save(svgBlob, name + ".svg");
  // PNG at three times screen size, sharp enough for slides and posters
  const scale = 3;
  const img = new Image();
  img.src = URL.createObjectURL(svgBlob);
  await img.decode();
  const canvas = Object.assign(document.createElement("canvas"), {
    width: width * scale,
    height: height * scale,
  });
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);
  canvas.toBlob((b) => save(b, name + ".png"), "image/png");
}

const ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';

export function addDownloads(root = document, opts = {}) {
  root.querySelectorAll(".gs-card").forEach((card) => {
    if (!card.querySelector(".gs-plot") || card.querySelector(".gs-dl")) return;
    const title =
      card.querySelector("h3")?.textContent ||
      card.closest(".gs-section")?.querySelector("h2")?.textContent ||
      "plot";
    card.dataset.name = slug(title);
    card.dataset.title = title;
    const bar = document.createElement("div");
    bar.className = "gs-dl";
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", `Download “${title}”`);
    bar.innerHTML =
      ICON +
      ["svg", "png"]
        .map(
          (f) =>
            `<button type="button" data-f="${f}" title="Download this chart as ${f.toUpperCase()}">${f.toUpperCase()}</button>`,
        )
        .join("");
    bar.addEventListener("click", (e) => {
      const f = e.target.closest("button")?.dataset.f;
      if (f) download(card, f, opts);
    });
    card.prepend(bar);
  });
}
