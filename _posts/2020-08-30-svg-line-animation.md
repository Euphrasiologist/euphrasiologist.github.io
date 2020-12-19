---
title: Animating some SVG lines
updated: 2020-08-30 19:00
d3: "d3"
---

A bit of a challenge for me to set up an animation like this outside of the <a href="https://observablehq.com/@euphrasiologist/animating-path-elements-simply">Observable</a> runtime. Makes use of `requestAnimationFrame` in an SVG. And it looks pretty!

<example>

<script>

const svg = d3.select("example")
    .append("svg")
    .attr("width", 1000)
    .attr("height", 500);

let frame;

svg.append("style").text(`

    svg {
    display: block;
    margin: auto;
    }

`);

  svg
    .append("g")
    .selectAll("lines")
    .data(d3.range(100))
    .join("path")
    .attr("d", d =>
      describeArc(
        d * 3 + 150,
        d + 150,
        100 + d,
        Date.now() / 1000 - d / 100,
        Date.now() / 800 - d / 100
      )
    )
    .attr('fill-opacity', '0')
    .attr("class", "path")
    .attr("stroke", "#777");

function moveSVG(time) {
     const x = Date.now();
     d3.selectAll("path").attr("d", d =>
       describeArc(
         d * 3 + 150,
         d + 150,
         100 + d,
         Date.now() / 1000 - d / 100,
         Date.now() / 800 - d / 100
       )
     );
     frame = requestAnimationFrame(moveSVG);
   }

requestAnimationFrame(moveSVG);

function polarToCartesian(centerX, centerY, radius, angleInRadians) {
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

function describeArc(x, y, radius, startAngle, endAngle) {
  var start = polarToCartesian(x, y, radius, startAngle);
  var end = polarToCartesian(x, y, radius, endAngle);

  var d = [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    0,
    0,
    end.x,
    end.y
  ].join(" ");

  return d;
};

</script>

</example>
