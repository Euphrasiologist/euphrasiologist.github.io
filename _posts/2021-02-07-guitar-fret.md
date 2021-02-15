---
title: Guitar scales!
updated: 2021-01-07 21:00
d3: "d3"
tonal: "tonal"
guitarneck: "guitarneck"
---

An implementation of a guitar fretboard, and a multitude of scales in d3. Based on code written by Austin Whittier <a href="https://observablehq.com/@awhitty/fretboard#tonal">here</a>. It might take a second to load. I wrapped the fretboard code up into a class, so it may(?) be easier to use elsewhere if people want to. The code to get the dropdowns working is a bit knarly, and a bit more work may be done on it yet. See the source code <a href="https://github.com/Euphrasiologist/guitarneck">here</a>!


<select id="keyDropdown"></select>

<select id="scaleDropdown"></select>

<example>

<script>

    class GuitarNeck {
  constructor(parentSVG) {
    this.parent = parentSVG;
    this.totalWidth = 1024;
    this.totalHeight = Math.max(this.totalWidth / 6, 300);

    this.margin = {
      top: 120,
      right: 10,
      left: 30,
      bottom: 30
    };

    this.tuning = ["E4", "B3", "G3", "D3", "A2", "E2"];
    this.parsedTuning = this.tuning.map(Tonal.Note.get);
    this.numStrings = this.tuning.length;
    this.minFret = 0;
    this.maxFret = Math.round(this.totalWidth / 48);

    this.placements = null;
    this.scale = null;
    this.tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "svg-tooltip")
      .attr("class", "tiplabs")
      .style("font-family", "sans-serif")
      .style("position", "absolute")
      .style("text-align", "center")
      .style("visibility", "hidden")
      .style("border-style", "solid")
      .style("border-color", "black")
      .style("background-color", "white")
      .style("list-style", "none")
      .style("width", "20px");
  }

  size(width, height) {
    this.totalWidth = width;
    this.totalHeight = height;
    return this;
  }

  getNotes(scale) {
    let arr = [];
    for (let i = 0; i < 6; i++) {
      let int_string =
        scale.split(" ")[0] +
        i +
        " " +
        scale
          .split(" ")
          .slice(1, scale.split(" ").length)
          .join(" ");
      let notes = Tonal.Scale.get(int_string).notes;
      arr.push(notes);
    }
    return arr.flat();
  }

  placeNote(noteOrStr) {
    const note = Tonal.Note.get(noteOrStr);
    return this.parsedTuning
      .map(string => note.height - string.height)
      .map((fret, stringIndex) =>
        fret >= this.minFret && fret <= this.maxFret
          ? { note, fret, string: stringIndex + 1 }
          : null
      )
      .filter(Boolean);
  }

  addScale(scale) {
    this.scale = scale;
    this.placements = this.getNotes(scale)
      .map(d => this.placeNote(d))
      .flat();
  }

  drawFretBoard() {
    const stringToY = d3
      .scaleLinear()
      .domain([1, this.numStrings])
      .range([this.margin.top, this.totalHeight - this.margin.bottom]);

    const fretToX = d3
      .scaleLinear()
      .domain([this.minFret, this.maxFret])
      .range([this.margin.left, this.totalWidth - this.margin.right]);

    const g1 = this.parent.append("g");

    g1.selectAll('.string')
      .data(d3.range(1, this.numStrings + 1))
      .join('line')
      .attr('class', 'string')
      .attr('stroke', 'black')
      .attr('x1', fretToX(this.minFret))
      .attr('x2', fretToX(this.maxFret))
      .attr('y1', d => stringToY(d))
      .attr('y2', d => stringToY(d))
      .attr('stroke-width', 3);

    g1.selectAll('.fret')
      .data(d3.range(this.minFret, this.maxFret + 1))
      .join('line')
      .attr('class', 'fret')
      .attr('stroke', 'black')
      .attr('y1', stringToY(1) - .5)
      .attr('y2', stringToY(this.numStrings) + .5)
      .attr('x1', d => fretToX(d))
      .attr('x2', d => fretToX(d))
      .attr('stroke-width', d => (d === 0 ? 5 : 3));

    const g2 = this.parent.append("g");
    g2.append("g")
      .attr('transform', `translate(${this.margin.left - 10}, -0.5)`)
      .style("font-size", "20px")
      .call(
        d3
          .axisLeft()
          .scale(stringToY)
          .ticks(this.numStrings)
          .tickSize(0)
      )
      .call(g => g.select(".domain").remove());

    g2.append("g")
      .attr(
        'transform',
        `translate(${-(fretToX.range()[1] / this.maxFret) / 2}, ${this
          .totalHeight -
          this.margin.bottom +
          12})`
      )
      .style("font-size", "10px")
      .call(
        d3
          .axisBottom()
          .scale(fretToX)
          .ticks(this.maxFret - this.minFret)
          .tickSize(0)
          .tickFormat(x => (x > 0 ? x : ""))
      )
      .call(g => g.select(".domain").remove());

    const g3 = this.parent.append("g");
    const tooltip = this.tooltip;

    g3.selectAll('placement')
      .data(this.placements)
      .join('circle')
      .attr('class', 'placement')
      .attr('id', d =>
        d.note.pc.includes("#") ? d.note.pc.replace("#", "sharp") : d.note.pc
      )
      .attr('cx', d => fretToX(d.fret - 0.5))
      .attr('cy', d => stringToY(d.string))
      .attr('fill', 'black')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('r', d => (d.fret - 0.5 < 0 ? 0 : 8))
      .on("pointerenter", function(event, d) {
        let note = d.note.pc.includes("#")
          ? d.note.pc.replace("#", "sharp")
          : d.note.pc;
        g3.selectAll('#' + note).attr('fill', 'orange');
        tooltip.style("visibility", "visible");
      })
      .on("pointermove", function(event, d) {
        let note = d.note.pc.includes("#")
          ? d.note.pc.replace("#", "sharp")
          : d.note.pc;
        g3.selectAll('#' + note).attr('fill', 'orange');

        tooltip
          .style("top", event.pageY - 10 + "px")
          .style("left", event.pageX + 10 + "px")
          .style("color", "black")
          .style("font-style", "normal")
          .html(`${d.note.pc}`)
          .style("font-family", "sans-serif");
      })
      .on("pointerleave", function(event, d) {
        let note = d.note.pc.includes("#")
          ? d.note.pc.replace("#", "sharp")
          : d.note.pc;
        g3.selectAll('#' + note).attr('fill', 'black');
        tooltip.style("visibility", "hidden");
      });
  }

  addHTML() {
    const g4 = this.parent.append("g");

    g4.append("foreignObject")
      .attr("width", this.totalWidth / 2)
      .attr("height", this.margin.top)
      .append("xhtml:div")
      .attr("class", "textbox")
      .style("font", "19px 'Helvetica Neue'")
      .html(
        `<h1>Scale: ${this.scale}</h1><p>Containing the notes: ${Array.from(
          new Set(this.placements.map(d => d.note.pc))
        ).map(d => " " + d)}</p>`
      );
  }

  render(scale) {
    this.addScale(scale);
    this.drawFretBoard();
    this.addHTML();
    return this;
  }
}


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

    new GuitarNeck(svg).size(w, h).render(scale);

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
        new GuitarNeck(svg).size(w, h).render(updatedScale);
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
