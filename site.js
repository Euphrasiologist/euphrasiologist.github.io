// site.js — small progressive enhancements; every page works without it.
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
