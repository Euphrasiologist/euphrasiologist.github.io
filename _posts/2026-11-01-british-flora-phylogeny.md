---
title: "Explore a dated tree of the British flora"
summary: An interactive, time-calibrated phylogeny of 1,406 native British plant species, from our 2023 PNAS paper on hybridisation, drawn with lwPhylo.
---

For our 2023 *PNAS* paper, [*Genetic factors predict hybrid formation in the British flora*](https://doi.org/10.1073/pnas.2220261120), we needed a phylogeny of (almost) every native British plant species. The result is a dated tree of 1,406 species, which has turned out to be useful well beyond that paper for seeing how British plants are related, and how long ago their lineages split.

You can now explore it below. Hover over (or tap) any branch to see the clade it belongs to and how old it is, click to zoom in, or search for a species, genus, family or order. Zoom in far enough and every species is labelled.

<figure class="flora" data-flora-tree="/data/british-flora.nwk">
  <div class="flora-bar">
    <label class="search flora-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input type="search" list="flora-names" placeholder="Find a species, genus, family or order" aria-label="Find a species, genus, family or order" autocomplete="off">
    </label>
    <datalist id="flora-names"></datalist>
    <div class="flora-tools">
      <button type="button" data-act="in" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
      <button type="button" data-act="out" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>
      <button type="button" data-act="reset" aria-label="Reset view" title="Reset view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>
      <button type="button" data-act="full" aria-label="Full screen" title="Full screen" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
    </div>
  </div>
  <div class="flora-stage">
    <svg role="img" aria-label="Circular dated phylogeny of 1,406 British plant species, with geological periods as rings"></svg>
    <p class="flora-status">Loading 1,406 species…</p>
    <div class="flora-card" aria-live="polite"><p class="flora-title">1,406 species</p><p class="flora-hint">Seed plants of the British flora, rooted about 360 million years ago. Hover over a branch to explore, or click to zoom.</p></div>
  </div>
  <div class="flora-legend"></div>
  <figcaption>Maximum likelihood tree from <i>rbcL</i>, <i>matK</i> and ITS, inferred with IQ-TREE and dated with <a href="https://github.com/blackrim/treePL">treePL</a> using fossil calibrations from <a href="https://doi.org/10.1038/s41559-020-1241-3">Ramírez-Barahona et al. (2020)</a>. Branch colours mark major clades and the outer rings mark orders and, when zoomed in, families. Drawn with <a href="https://github.com/Euphrasiologist/lwPhylo">lwPhylo</a>; the original notebook is <a href="https://observablehq.com/@euphrasiologist/dated-phylogeny-of-the-british-flora">on Observable</a>, and the <a href="/data/british-flora.nwk">Newick file</a> is free to download.</figcaption>
</figure>
<script type="module" src="/js/flora-tree.js"></script>

A few things stand out. Almost all of the British flora descends from the flowering plant radiation of the Cretaceous, yet the big families (grasses, sedges, daisies, crucifers) only began to diversify within the last 50 million years. Some of the largest genera are strikingly young: the 73 *Carex* species in the tree share an ancestor only about 10 million years ago, and our 18 *Euphrasia* about 4 million.

If you use the tree, please cite:

Brown MR, Hollingsworth PM, Forrest L, Hart M, Leitch IJ, Jones L, Ford C, de Vere N, Twyford AD (2023). Genetic factors predict hybrid formation in the British flora. *Proceedings of the National Academy of Sciences*, 120(16), e2220261120.
