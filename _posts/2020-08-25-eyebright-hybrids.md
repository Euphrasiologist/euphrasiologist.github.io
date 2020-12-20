---
title: How many eyebright hybrids are there?
updated: 2020-08-25 12:00
d3: "d3"
---

As part of my PhD, I explored hybridisation in this genus of plants called Eyebrights. Eyebrights are interesting for many reasons, but one of them is their apparent propensity to hybridise with one another. From 21 species in the UK, a staggering 71 hybrids have been recorded. Here, I've visualised this in a matrix where the green cells indicate hybridisation between species.

<example>

<script>

const data_recip = [
  {
    index: "rostkoviana",
    montana: 1,
    anglica: 1,
    rivularis: 1,
    vigursii: 1,
    nemorosa: 1,
    confusa: 1,
    micrantha: 1,
    arctica: 1
  },
  { index: "montana", rostkoviana: 1, arctica: 1, confusa: 1 },
  {
    index: "anglica",
    rostkoviana: 1,
    arctica: 1,
    tetraquetra: 1,
    nemorosa: 1,
    confusa: 1,
    micrantha: 1
  },
  { index: "rivularis", rostkoviana: 1, scottica: 1 },
  { index: "vigursii", tetraquetra: 1, rostkoviana: 1 },
  {
    index: "arctica",
    anglica: 1,
    rostkoviana: 1,
    montana: 1,
    tetraquetra: 1,
    nemorosa: 1,
    pseudokerneri: 1,
    confusa: 1,
    frigida: 1,
    foulaensis: 1,
    ostenfeldii: 1,
    marshallii: 1,
    campbelliae: 1,
    micrantha: 1,
    scottica: 1,
    heslop_harrisonii: 1
  },
  {
    index: "tetraquetra",
    anglica: 1,
    arctica: 1,
    vigursii: 1,
    nemorosa: 1,
    pseudokerneri: 1,
    confusa: 1,
    micrantha: 1,
    salisburgensis: 1
  },
  {
    index: "nemorosa",
    rostkoviana: 1,
    anglica: 1,
    arctica: 1,
    tetraquetra: 1,
    pseudokerneri: 1,
    stricta: 1,
    ostenfeldii: 1,
    scottica: 1,
    salisburgensis: 1,
    confusa: 1,
    foulaensis: 1,
    marshallii: 1,
    campbelliae: 1,
    micrantha: 1,
    heslop_harrisonii: 1
  },
  {
    index: "pseudokerneri",
    tetraquetra: 1,
    confusa: 1,
    arctica: 1,
    nemorosa: 1
  },
  { index: "stricta", nemorosa: 1 },
  {
    index: "confusa",
    rostkoviana: 1,
    montana: 1,
    anglica: 1,
    arctica: 1,
    tetraquetra: 1,
    nemorosa: 1,
    pseudokerneri: 1,
    frigida: 1,
    foulaensis: 1,
    cambrica: 1,
    ostenfeldii: 1,
    marshallii: 1,
    micrantha: 1,
    scottica: 1,
    campbelliae: 1
  },
  {
    index: "frigida",
    ostenfeldii: 1,
    micrantha: 1,
    scottica: 1,
    confusa: 1,
    arctica: 1
  },
  {
    index: "foulaensis",
    nemorosa: 1,
    ostenfeldii: 1,
    marshallii: 1,
    micrantha: 1,
    scottica: 1,
    arctica: 1,
    confusa: 1,
    campbelliae: 1
  },
  { index: "cambrica", ostenfeldii: 1, scottica: 1, confusa: 1 },
  {
    index: "ostenfeldii",
    scottica: 1,
    arctica: 1,
    nemorosa: 1,
    confusa: 1,
    frigida: 1,
    cambrica: 1,
    micrantha: 1,
    foulaensis: 1
  },
  {
    index: "marshallii",
    nemorosa: 1,
    micrantha: 1,
    scottica: 1,
    arctica: 1,
    confusa: 1,
    foulaensis: 1
  },
  { index: "rotundifolia" },
  {
    index: "campbelliae",
    nemorosa: 1,
    confusa: 1,
    foulaensis: 1,
    micrantha: 1,
    arctica: 1
  },
  {
    index: "micrantha",
    rostkoviana: 1,
    anglica: 1,
    arctica: 1,
    confusa: 1,
    frigida: 1,
    foulaensis: 1,
    tetraquetra: 1,
    nemorosa: 1,
    ostenfeldii: 1,
    marshallii: 1,
    campbelliae: 1,
    scottica: 1,
    salisburgensis: 1
  },
  {
    index: "scottica",
    micrantha: 1,
    marshallii: 1,
    ostenfeldii: 1,
    cambrica: 1,
    foulaensis: 1,
    frigida: 1,
    confusa: 1,
    nemorosa: 1,
    arctica: 1,
    rivularis: 1
  },
  { index: "heslop_harrisonii", nemorosa: 1, arctica: 1 },
  { index: "salisburgensis", tetraquetra: 1, nemorosa: 1, micrantha: 1 }
];

const species = [
  { name: "rostkoviana", ploidy: 2 },
  { name: "montana", ploidy: 2 },
  { name: "anglica", ploidy: 2 },
  { name: "rivularis", ploidy: 2 },
  { name: "vigursii", ploidy: 2 },
  { name: "arctica", ploidy: 4 },
  { name: "tetraquetra", ploidy: 4 },
  { name: "nemorosa", ploidy: 4 },
  { name: "pseudokerneri", ploidy: 4 },
  { name: "stricta", ploidy: 4 },
  { name: "confusa", ploidy: 4 },
  { name: "frigida", ploidy: 4 },
  { name: "foulaensis", ploidy: 4 },
  { name: "cambrica", ploidy: 4 },
  { name: "ostenfeldii", ploidy: 4 },
  { name: "marshallii", ploidy: 4 },
  { name: "rotundifolia", ploidy: 4 },
  { name: "campbelliae", ploidy: 4 },
  { name: "micrantha", ploidy: 4 },
  { name: "scottica", ploidy: 4 },
  { name: "heslop_harrisonii", ploidy: 4 },
  { name: "salisburgensis", ploidy: 4 }
];

const categories = data_recip.map(d => d.index);

const matrix = data_recip.map(d =>
  species.map(e => {
    return { x: d.index, y: e.name, count: d[e.name] };
  })
);

const upper_tri = [];
for (let i = 0; i < matrix.length; i++) {
    upper_tri.push(matrix[i].slice(0, i + 1));
};

const margin = {
  top: 10,
  right: 50,
  bottom: 80,
  left: 100
};
const width = 700;
const height = 700;

const legend_ = [
  { name: "Hybrid recorded", class: "no-hybrids" },
  { name: "Hybrid not (yet) recorded", class: "hybrids" }
];
const colours = d3.scaleOrdinal(["salmon", "green"]).domain(legend_);

const yAxis = g =>
  g
    .attr("transform", `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).ticks(null, "s"))
    .call(g => g.selectAll(".domain").remove());

const xAxis = g =>
  g
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .call(g => g.selectAll(".domain").remove())
    .selectAll("text")
    .style("text-anchor", "start")
    .attr("dx", "-.8em")
    .attr("dy", ".8em")
    .attr("transform", "rotate(30)");

const y = d3
  .scaleBand()
  .domain(categories)
  .range([height - margin.bottom, margin.top]);

const x = d3
  .scaleBand()
  .domain(categories)
  .range([margin.left, width - margin.right]);

const svg = d3
    .select("example")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("font-family", "sans-serif")
    .attr("font-size", 10)
    .attr("align","left");

svg.append("style").text(`

    svg {
    display: block;
    margin: auto;
    }

`);

for (let i = 0; i < matrix.length; i++) {
    const squares = svg
      .append("g")
      .selectAll("g")
      .data(upper_tri[i])
      .join("g");

    squares
      .append("rect")
      .attr("x", d => x(d.x))
      .attr("y", d => y(d.y))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("class", d => (d.count === undefined ? "no-hybrids" : "hybrids"))
      .style("fill", d =>
        d.x === d.y ? "#EFEFEF" : d.count === undefined ? "salmon" : "green"
      );
}

  const ploidy = species.map(d => d.ploidy === 2);

  svg
    .append("g")
    .call(xAxis)
    .selectAll('text')
    .text(d => "E. " + d.replace("_", "-"))
    .attr("font-family", "sans-serif")
    .attr("font-size", 12)
    .style("font-style", "italic")
    .style('font-weight', (d, i) => (ploidy[i] ? "bold" : "normal"));

  const ladderText = svg.append("g");
  const tickLen = 5;

  ladderText
    .selectAll("xText")
    .data(categories)
    .join("text")
    .attr("text-anchor", "end")
    .attr("x", d => x(d) - x.bandwidth() + 20)
    .attr("y", d => y(d) + y.bandwidth() / 2 + 3)
    .style("font-style", "italic")
    .style('font-weight', (d, i) => (ploidy[i] ? "bold" : "normal"))
    .text(d => "E. " + d);

  ladderText
    .selectAll("xLine")
    .data(categories)
    .join("line")
    .attr("x1", d => x(d) - tickLen)
    .attr("y1", d => y(d) + y.bandwidth() / 2)
    .attr("x2", d => x(d))
    .attr("y2", d => y(d) + y.bandwidth() / 2)
    .attr("stroke-width", 1)
    .attr("stroke", "black");

  const legend = svg
    .append("g")
    .attr("transform", `translate(${width / 4}, ${height / 8})`);

  const size = 50;
  const border_padding = 15;
  const item_padding = 20;
  const text_offset = 20;

  legend
    .selectAll("boxes")
    .data(legend_)
    .enter()
    .append("rect")
    .attr("x", border_padding - size)
    .attr("y", (d, i) => border_padding + i * (size + item_padding))
    .attr("width", size)
    .attr("height", size)
    .style("fill", d => colours(d.name))
    .on("pointerenter click", (event, d) =>
      svg.selectAll("rect." + d.class).style("fill-opacity", 0.3)
    )
    .on("pointerleave click", (event, d) =>
      svg.selectAll("rect." + d.class).style("fill-opacity", 1)
    );
  legend
    .selectAll("labels")
    .data(legend_)
    .enter()
    .append("text")
    .attr("x", border_padding + 16)
    .attr("y", (d, i) => border_padding + i * (size + item_padding) + size / 2)
    .text(d => d.name)
    .attr("text-anchor", "left")
    .style("alignment-baseline", "middle")
    .style("font-family", "sans-serif")
    .style("font-size", 15);

  const grid = svg.append("g");
  grid
    .selectAll("gridlinesv")
    .data(categories)
    .join("line")
    .attr("x1", d => x(d) + x.bandwidth())
    .attr("y1", d => y(d))
    .attr("x2", d => x(d) + x.bandwidth())
    .attr("y2", d => y("rostkoviana") + y.bandwidth())
    .attr("stroke-width", 1)
    .attr("stroke", "black");
  grid
    .selectAll("gridlinesh")
    .data(categories)
    .join("line")
    .attr("x1", d => x(d))
    .attr("y1", d => y(d) + y.bandwidth())
    .attr("x2", d => x("salisburgensis") + x.bandwidth())
    .attr("y2", d => y(d) + y.bandwidth())
    .attr("stroke-width", 1)
    .attr("stroke", "black");

</script>

</example>
