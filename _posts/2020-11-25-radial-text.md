---
title: Radial text with highlighting
updated: 2020-11-25 21:44
d3: "d3"
---

This is more of a test than anything, to see if I could get an interactive visualisation up and running in this blog format. It would seem you can!

The radial text here is useful for labelling radial diagrams (e.g. radial phylogenies).

<example>

<script>

  function rotate(d) {
  return ((d.start + d.end) / 2 / Math.PI) * 180 + 90;
}

  function letters(str) {
    return (
      str
        .split("")
        .map(a => ({ sort: Math.random(), value: a }))
        .sort((a, b) => a.sort - b.sort)
        .map(a => a.value)
        .join("")
    );
  }

  function obs(length) {
    let res = [];
    for (let i = 0; i < length; i++) {
      res.push({
        string: letters("maxbrown.xyz")
      });
    }

    let rotations = (Math.PI * 2) / res.length;

    for (let i = 1; i < res.length; i++) {
      res[0].start = 0;
      res[0].end = rotations;

      res[i].start = res[i - 1].start + rotations;
      res[i].end = res[i - 1].end + rotations;
    }

    return res;
}
  let diam = 400;
  const svg = d3.select("example")
    .append("svg")
    .attr("width", diam)
    .attr("height", diam)
    .attr("viewBox", `${-diam / 2} ${-diam / 2} ${diam} ${diam}`)
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .attr("align","right");

  svg.append("style").text(`

    .label--active {
      font-weight: bold;
      fill: red
    }
    svg {
    display: block;
    margin: auto;
    }

`);

const data = obs(40);
  const words = svg
    .append("g")
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("dy", ".31em")
    .attr("id", (d, i) => "word" + i)
    .attr(
      "transform",
      d =>
        `rotate(${rotate(d)}) translate(${diam/2},0) ${
          d.start > Math.PI ? "" : " rotate(180)"
        }`
    )
    .attr("text-anchor", d =>
      d.start < Math.PI + data[0].end ? "start" : "end"
    )
    .text(d => d.string);

  words
    .on("mouseover", function(event, d) {
      d3.select(this).classed("label--active", true);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).classed("label--active", false);
    })

</script>

</example>