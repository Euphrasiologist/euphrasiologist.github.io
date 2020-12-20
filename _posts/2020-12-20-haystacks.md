---
title: Haystacks
updated: 2020-12-20 09:00
d3: "d3"
---

Some falling haystacks implemented using some SVG path primitives. See <a href="https://github.com/Euphrasiologist/plotutils">this link</a> for more details.

<example>

<script>

const data = [];
const dim = 4;
for (let i = 0; i < dim * 100; i++) {
for (let j = 0; j < dim; j++) {
    data.push({
    x1: getRandomInt(j * 95, 95 + j * 95) + 10,
    y1: getRandomInt(j * 95, 95 + j * 95) + 10,
    x2: getRandomInt(j * 95, 95 + j * 95) + 10,
    y2: getRandomInt(j * 95, 95 + j * 95) + 10
    });
}
}

const svg = d3
    .select("example")
    .append("svg")
    .attr("width", 400)
    .attr("height", 400);

  svg
    .append("rect")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "#f8e9d9");

  svg.append("style").text(`

    .line--active {
        stroke: red
    }
    svg {
        display: block;
        margin: auto;
    }

`);

  const generator = line()
    .x1(d => d.x1)
    .y1(d => d.y1)
    .x2(d => d.x2)
    .y2(d => d.y2);

  const lines = svg
    .selectAll("path2")
    .data(data)
    .join("path")
    .attr("d", generator)
    .attr("id", (d, i) => "line_" + i)
    .attr("stroke", (d, i) => (i % 3 ? "black" : "#f8e9d9"))
    .attr("fill", "none");

  lines
    .on("mouseover", function(event, d) {
      d3.select(this).classed("line--active", true);
    })
    .on("mouseout", function(event, d) {
      d3.select(this).classed("line--active", false);
    });


function line() {
  let x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0;

  function draw(datum) {
    const x10 = typeof x1 === "function" ? x1(datum) : x1,
      y10 = typeof y1 === "function" ? y1(datum) : y1,
      x20 = typeof x2 === "function" ? x2(datum) : x2,
      y20 = typeof y2 === "function" ? y2(datum) : y2;

    return `M${x10},${y10}L${x20},${y20}`;
  }

  draw.x1 = function(_) {
    return arguments.length ? ((x1 = _), draw) : x1;
  };
  draw.y1 = function(_) {
    return arguments.length ? ((y1 = _), draw) : y1;
  };
  draw.x2 = function(_) {
    return arguments.length ? ((x2 = _), draw) : x2;
  };
  draw.y2 = function(_) {
    return arguments.length ? ((y2 = _), draw) : y2;
  };

  return draw;
}

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

</script>

</example>
