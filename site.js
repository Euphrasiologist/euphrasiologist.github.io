// site.js: small progressive enhancements; every page works without it.
(function () {
  var root = document.documentElement;

  // Theme toggle (initial theme is set inline in <head> to avoid a flash)
  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dark =
        root.dataset.theme === "dark" ||
        (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      root.dataset.theme = dark ? "light" : "dark";
      try {
        localStorage.setItem("theme", root.dataset.theme);
      } catch (e) {}
    });
  });

  // Mobile menu
  var menuBtn = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  // Header border once the page scrolls
  var header = document.querySelector(".site-header");
  var onScroll = function () {
    header.classList.toggle("scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Assemble email addresses at runtime to keep them away from scrapers
  document.querySelectorAll("[data-user]").forEach(function (el) {
    var addr = el.dataset.user + "@" + el.dataset.domain;
    el.href = "mailto:" + addr;
    if (!el.dataset.keepText) el.textContent = addr;
  });

  // Gentle reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("in");
    });
  }

  // Swap a static figure for its live Observable embed on request
  document.querySelectorAll(".load-embed").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var feature = btn.closest(".fig-feature");
      var slot = feature.querySelector(".embed-slot");
      var frame = document.createElement("iframe");
      frame.src = slot.dataset.embed;
      frame.title = slot.dataset.title;
      frame.loading = "lazy";
      slot.replaceChildren(frame);
      feature.classList.add("live");
      btn.remove();
    });
  });

  // Publications: search, topic filter and lead-author toggle
  var list = document.getElementById("pub-list");
  if (!list) return;
  var input = document.getElementById("pub-search");
  var chips = document.querySelectorAll(".chip[data-topic]");
  var leadChip = document.querySelector(".chip[data-lead]");
  var countEl = document.getElementById("pub-count");
  var empty = document.getElementById("pub-empty");
  var topic = "all";

  function apply() {
    var q = input.value.trim().toLowerCase();
    var leadOnly = leadChip.getAttribute("aria-pressed") === "true";
    var shown = 0;
    list.querySelectorAll(".year-group").forEach(function (group) {
      var any = false;
      group.querySelectorAll(".pub").forEach(function (pub) {
        var ok =
          (topic === "all" || pub.dataset.topics.split(" ").indexOf(topic) > -1) &&
          (!leadOnly || pub.dataset.lead === "1") &&
          (!q || pub.textContent.toLowerCase().indexOf(q) > -1);
        pub.hidden = !ok;
        if (ok) {
          any = true;
          shown++;
        }
      });
      group.hidden = !any;
    });
    countEl.textContent = shown;
    empty.hidden = shown > 0;
  }

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      chips.forEach(function (c) {
        c.setAttribute("aria-pressed", "false");
      });
      chip.setAttribute("aria-pressed", "true");
      topic = chip.dataset.topic;
      apply();
    });
  });
  leadChip.addEventListener("click", function () {
    var on = leadChip.getAttribute("aria-pressed") === "true";
    leadChip.setAttribute("aria-pressed", String(!on));
    apply();
  });
  input.addEventListener("input", apply);
})();

// DNA halo: a faint field of bases revealed around the cursor. Mouse only,
// and skipped entirely for reduced motion.
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var BASES = "ACGT";
  var halo = document.createElement("div");
  halo.className = "dna-halo";
  halo.setAttribute("aria-hidden", "true");
  document.body.appendChild(halo);

  // The sequence is laid out as explicit rows so a screen position maps to a base
  var seq = [], cols = 0, rows = 0, cw = 9, lh = 22;
  function randomBase() {
    return BASES[(Math.random() * 4) | 0];
  }
  function fill() {
    // Measure one glyph, then make just enough sequence to cover the viewport
    var probe = document.createElement("span");
    probe.textContent = "ACGTACGTAC";
    halo.textContent = "";
    halo.appendChild(probe);
    cw = probe.getBoundingClientRect().width / 10 || 9;
    lh = parseFloat(getComputedStyle(halo).lineHeight) || 22;
    cols = Math.ceil(innerWidth / cw) + 1;
    rows = Math.ceil(innerHeight / lh) + 1;
    seq = [];
    for (var i = 0; i < cols * rows; i++) seq.push(randomBase());
    recent = [];
    render();
  }

  // Recently mutated bases flash green, then fade back (see .dna-halo .mut).
  // A negative animation-delay keeps each fade running across re-renders.
  var FLASH = 800;
  var recent = [];
  function render() {
    var now = performance.now();
    recent = recent.filter(function (m) {
      return now - m.t < FLASH;
    });
    var marks = {};
    recent.forEach(function (m) {
      marks[m.i] = m.t;
    });
    var out = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var i = r * cols + c;
        out += i in marks
          ? '<span class="mut" style="animation-delay:-' + (now - marks[i]).toFixed(0) + 'ms">' + seq[i] + "</span>"
          : seq[i];
      }
      out += "\n";
    }
    halo.innerHTML = out;
  }
  fill();

  var resizeTimer;
  addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fill, 200);
  });

  // A comet of soft mask blobs: the head eases toward the cursor, each trail
  // blob eases toward the one in front, and a faint lead runs ahead.
  var TRAIL = 7;
  var pts = [];
  for (var i = 0; i < TRAIL; i++) pts.push({ x: -999, y: -999 });
  var x = -999, y = -999, frame = 0, idle, mutator, started = false;
  // Fade the whole comet back while the pointer is over readable text
  var TEXT = "p, h1, h2, h3, h4, li, figcaption, blockquote, address, dt, dd, td, th, label, pre, .pub-title, .pub-authors";
  var dim = 1, dimTarget = 1;

  function blob(px, py, r, a) {
    a *= dim;
    return "radial-gradient(circle " + r.toFixed(0) + "px at " + px.toFixed(1) + "px " + py.toFixed(1) +
      "px, rgba(0,0,0," + a.toFixed(3) + "), rgba(0,0,0," + (a * 0.3).toFixed(3) + ") 45%, transparent)";
  }

  function draw() {
    var head = pts[0];
    var vx = x - head.x, vy = y - head.y;
    head.x += vx * 0.22;
    head.y += vy * 0.22;
    for (var i = 1; i < TRAIL; i++) {
      pts[i].x += (pts[i - 1].x - pts[i].x) * 0.3;
      pts[i].y += (pts[i - 1].y - pts[i].y) * 0.3;
    }
    dim += (dimTarget - dim) * 0.1;

    // Lead: a small blob ahead of the head, only while moving
    var speed = Math.min(Math.hypot(vx, vy), 160);
    var layers = [];
    if (speed > 2) {
      var k = 0.55;
      layers.push(blob(head.x + vx * k, head.y + vy * k, 70 + speed * 0.2, 0.19 * (speed / 160)));
    }
    layers.push(blob(head.x, head.y, 160, 0.38));
    // Trail blobs shrink and fade, and vanish as they catch up with the head
    for (var j = 1; j < TRAIL; j++) {
      var p = pts[j];
      var gap = Math.min(Math.hypot(p.x - head.x, p.y - head.y) / 60, 1);
      var t = 1 - j / TRAIL;
      if (gap > 0.02) layers.push(blob(p.x, p.y, 60 + 90 * t, 0.3 * t * gap));
    }
    var mask = layers.join(",");
    halo.style.webkitMaskImage = mask;
    halo.style.maskImage = mask;

    var tail = pts[TRAIL - 1];
    var settled =
      Math.hypot(x - head.x, y - head.y) < 0.5 &&
      Math.hypot(tail.x - head.x, tail.y - head.y) < 0.5 &&
      Math.abs(dimTarget - dim) < 0.005;
    frame = settled ? 0 : requestAnimationFrame(draw);
  }

  // A few point mutations near the head of the comet, where they can be seen
  function mutate() {
    var head = pts[0];
    for (var k = 0; k < 3; k++) {
      var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 130;
      var c = Math.floor((head.x + Math.cos(a) * d) / cw);
      var r = Math.floor((head.y + Math.sin(a) * d) / lh);
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      var i = r * cols + c;
      seq[i] = randomBase();
      recent.push({ i: i, t: performance.now() });
    }
    render();
  }
  function hide() {
    halo.classList.remove("on");
    clearInterval(mutator);
    mutator = 0;
  }

  document.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    x = e.clientX;
    y = e.clientY;
    if (!started) {
      // Start the comet at the cursor rather than sweeping in from off-screen
      pts.forEach(function (p) {
        p.x = x;
        p.y = y;
      });
      started = true;
    }
    dimTarget = e.target.closest && e.target.closest(TEXT) ? 0.3 : 1;
    if (!frame) frame = requestAnimationFrame(draw);
    halo.classList.add("on");
    if (!mutator) mutator = setInterval(mutate, 160);
    clearTimeout(idle);
    idle = setTimeout(hide, 1800);
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", function () {
    hide();
    started = false;
  });
})();
