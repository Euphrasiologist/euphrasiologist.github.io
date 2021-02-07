---
title: Guitar scales!
updated: 2021-01-07 21:00
d3: "d3"
tonal: "tonal"
guitarneck: "guitarneck"
---

An implementation of a guitar fretboard, and a multitude of scales in d3. Based on code written by Austin Whittier <a href="https://observablehq.com/@awhitty/fretboard#tonal">here</a>. It might take a second to load. I wrapped the fretboard code up into a class, so it may(?) be easier to use elsewhere if people want to! The code to get the dropdowns working is a bit knarly, and a bit more work may be done on it yet! See the source code <a href="https://github.com/Euphrasiologist/guitarneck">here</a>!


<select id="keyDropdown"></select>

<select id="scaleDropdown"></select>

<example>

<script type="module">
    import guitarneck from "https://unpkg.com/guitarneck@1.0.2/src/index.js?module";

    d3.select("#keyDropdown")
        .selectAll('myKeyOpts')
        .data(["A", "B", "Bb", "C", "Db", "D", "Eb", "E", "F", "Gb", "G"])
        .join('option')
        .text(d => d)
        .attr("value", d => d);

    d3.select("#scaleDropdown")
        .selectAll('myKeyopts')
        .data(Tonal.ScaleType.all().map(d => d.name))
        .join('option')
        .text(d => d)
        .attr("value", d => d);

    let scale = d3.select("#keyDropdown").node().value + " " + d3.select("#scaleDropdown").node().value;

    const w = 1000,
          h = 300;
    const svg = d3.select("example").append("svg").attr("width", w).attr("height", h);

      svg.append("style").text(`

    svg {
        display: block;
        margin: auto;
        position: relative;
        left: -200px;
    }

`);

    new guitarneck(svg).size(w, h).render(scale);

    function updateChart(key, scale) {

        let updatedScale = key + " " + scale;
        d3.select("svg").remove();
            const svg = d3.select("example").append("svg").attr("width", w).attr("height", h);

      svg.append("style").text(`

    svg {
        display: block;
        margin: auto;
        position: relative;
        left: -200px;
    }

`);
        new guitarneck(svg).size(w, h).render(updatedScale);
    }

    d3.select("#keyDropdown").on("change", function (d) {
        let selectedKey = this.value;
        updateChart(selectedKey, 
            d3.select("#scaleDropdown").node().value)
    });
    d3.select("#scaleDropdown").on("change", function (d) {
        let selectedScale = this.value;
        updateChart(d3.select("#keyDropdown").node().value, 
        selectedScale)
    });


</script>

</example>
