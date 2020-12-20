---
title: Visualising GC content across chromosomes
updated: 2020-12-19 20:30
d3: "d3"
---

GC content is the proportion of DNA bases in a given sqeuence window which are either G or C. GC content varies througout a genome due to selection, mutational bias, and GC-biased gene conversion. I've visualised this in the genome of <i>Arabidopsis thaliana</i>, which is a model organism for botanical research across a variety of disciplines.

The dropdowns can be toggled to look at different chromosomes, and to look at one of three variables: GC content, GC skew, and tetranucleotide diversity. The slider changes the bin for the moving average (red line). The smaller graph at the bottom can be used to select a region of the graph and zoom in.

<select id="chromosomeDropdown"></select>

<select id="VariableDropdown"></select>

<input type="range" name="movingAverage" id=movingAverage min="1" max="1000" value="500">

<example>

<script>

function movingAverage(values, N) {
    let i = 0;
    let sum = 0;
    const means = new Float64Array(values.length).fill(NaN);
    for (let n = Math.min(N - 1, values.length); i < n; ++i) {
        sum += values[i];
    }
    for (let n = values.length; i < n; ++i) {
        sum += values[i];
        means[i] = sum / N;
        sum -= values[i - N + 1];
    }
    return means;
}

const margin = { top: 20, bottom: 120, left: 40, right: 20 };
const margin1 = { top: 300, bottom: 40, left: 40, right: 20 };

const height1 = 300;
const height2 = 80;

const width = 954;

const svg = d3
    .select("example")
    .append("svg")
    .attr("viewBox", [0, 0, 1000, 400])
    .attr("width", 900)
    .attr("height", 400);

svg.append("style").text(`

    svg {
    display: block;
    margin: left;
    -webkit-transform: translateX(-20%);
    -ms-transform: translateX(-20%);
    transform: translateX(-20%);
    }

`);

const data = d3.csv("./assets/data/Athaliana_genome_stats.csv", function (d) {

    return {
        ID: d.ID,
        bin: +d.bin.replace(/ [0-9]+-/, ""),
        GCPercent: +d['GC%'],
        GCSkew: +d.GCSkew,
        UniqueKmers: +d.UniqueKmers
    }
});

console.log(data);

data.then(function (data) {
    const chromosomes = [...new Set(data.map(d => d.ID))];
    const variables = Object.keys(data[0]).slice(2, 5);

    d3.select("#chromosomeDropdown")
        .selectAll('myOptionsChrom')
        .data(chromosomes)
        .join('option')
        .text(d => d)
        .attr("value", d => d);

    d3.select("#VariableDropdown")
        .selectAll('myOptionsVar')
        .data(variables)
        .join('option')
        .text(d => d)
        .attr("value", d => d);

    let filteredData = d3.group(data, d => d.ID).get(chromosomes[0]);
    let filteredDataMA = movingAverage(filteredData.map(d => d[variables[0]]), 100);

    for (let i = 0; i < filteredData.length; i++) {
        filteredData[i].MA = filteredDataMA[i];
    }

    let xMin = 0;
    let xMax = d3.max(filteredData.map(d => d.bin));
    let yMin = 0;
    let yMax = d3.max(filteredData.map(d => d[variables[0]]));

    const x = d3
        .scaleLinear()
        .domain([xMin, xMax])
        .range([0, width]);

    const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height1, 0]);

    const x2 = d3
        .scaleLinear()
        .domain([xMin, xMax])
        .range([0, width]);

    const y2 = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height2, 50]);

    const xAxis = d3.axisBottom(x).tickFormat(x => `${x / 1000000}MB`);
    const yAxis = d3.axisLeft(y);
    const xAxis2 = d3.axisBottom(x2).tickFormat(x => `${x / 1000000}MB`);
    const yAxis2 = d3.axisLeft(y2);

    const line = d3
        .line()
        .x(d => x(d.bin))
        .y(d => y(d[variables[0]]));

    const line2 = d3
        .line()
        .x(d => x2(d.bin))
        .y(d => y2(d[variables[0]]));

    const movAvgLine = d3
        .line()
        .defined(d => !isNaN(d.MA))
        .x(d => x(d.bin))
        .y(d => y(d.MA));

    const clip = d3
        .selectAll(svg)
        .append('defs')
        .append('svg:clipPath')
        .attr('id', 'clip')
        .append('svg:rect')
        .attr('width', width)
        .attr('height', height1)
        .attr('x', 0)
        .attr('y', 0);

    const linechart = d3
        .selectAll(svg)
        .append('g')
        .attr('class', 'focus')
        .attr('transform', `translate(${margin.left} ${margin.top})`)
        .attr('clip-path', 'url(#clip)');

    const focus = d3
        .selectAll(svg)
        .append('g')
        .attr('class', 'focus')
        .attr('transform', `translate(${margin.left} ${margin.top})`);

    const context = d3
        .selectAll(svg)
        .append('g')
        .attr('class', 'context')
        .attr('transform', `translate(${margin.left} ${margin1.top})`);

    const focusXaxis = focus
        .append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0, ${height1})`)
        .call(xAxis);

    focus
        .append('g')
        .attr('class', 'axis axis--y')
        .call(yAxis);

    const yAxisLabel = d3.selectAll(svg)
        .append('text')
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr('x', 30)
        .attr('y', 13)
        .text(d3.select("#VariableDropdown").node().value + ": Moving average bin = " + d3.select("#movingAverage").node().value);

    d3.selectAll(svg)
        .append('text')
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr('x', width - margin.right - 35)
        .attr('y', height1 + 13)
        .text(data.x);

    const mainLine = linechart
        .append('path')
        .datum(filteredData)
        .attr('class', 'line')
        .attr('d', line)
        .style('fill', 'none')
        .attr('stroke', "black")
        .attr('stroke-width', 1);

    const movingAverageLine = linechart
        .append('path')
        .datum(filteredData)
        .attr('class', 'line1')
        .attr('d', movAvgLine)
        .style('fill', 'none')
        .attr('stroke', 'red')
        .attr('stroke-width', 0.8);

    const bottomLine = context
        .append('path')
        .datum(filteredData)
        .attr('class', 'line2')
        .attr('d', line2)
        .style('fill', 'none')
        .attr('stroke', "black")
        .attr('stroke-width', 0.1);

    context
        .append('g')
        .attr('class', 'axis axis--x')
        .attr('transform', `translate(0, ${height2})`)
        .call(xAxis2);

    const brush = d3
        .brushX()
        .extent([[0, 40], [width, height2]])
        .on('brush end', function (event, d) {
            if (event.sourceEvent && event.sourceEvent.type === "zoom") return;
            var s = event.selection || x2.range();
            x.domain(s.map(x2.invert, x2));
            linechart.selectAll(".line").attr("d", line);
            linechart.selectAll('.line1').attr('d', movAvgLine);
            linechart.selectAll(".line2").attr("d", line2);
            focus.selectAll(".axis--x").call(xAxis);
        });

    context
        .append('g')
        .attr('class', "brush")
        .call(brush);


    function updateChart(movingAverageBin, chromosome, variable) {

        let filteredData = d3.group(data, d => d.ID).get(chromosome);
        let filteredDataMA = movingAverage(filteredData.map(d => d[variable]), movingAverageBin);
        for (let i = 0; i < filteredData.length; i++) {
            filteredData[i].MA = filteredDataMA[i];
        };
        x.domain([xMin, d3.max(filteredData.map(d => d.bin))]);
        x2.domain([xMin, d3.max(filteredData.map(d => d.bin))]);
        y.domain([variable === "GCSkew" ? d3.min(filteredData.map(d => d[variable])) : 0, d3.max(filteredData.map(d => d[variable]))]);
        y2.domain([variable === "GCSkew" ? d3.min(filteredData.map(d => d[variable])) : 0, d3.max(filteredData.map(d => d[variable]))]);

        svg.selectAll('.axis--x')
            .transition()
            .duration(1000)
            .call(xAxis);

        line.y(d => y(d[variable]));
        line2.y(d => y2(d[variable]));

        movingAverageLine
            .datum(filteredData)
            .attr('d', movAvgLine);
        mainLine
            .datum(filteredData)
            .attr('d', line);
        bottomLine
            .datum(filteredData)
            .attr('d', line2);
        yAxisLabel.text(d3.select("#VariableDropdown").node().value + ": Moving average bin = " + d3.select("#movingAverage").node().value)

    }

    d3.select("#movingAverage").on("change", function (d) {
        selectedValue = this.value;
        updateChart(selectedValue, 
            d3.select("#chromosomeDropdown").node().value, 
            d3.select("#VariableDropdown").node().value)
    });
    d3.select("#chromosomeDropdown").on("change", function (d) {
        selectedGroup = this.value;
        updateChart(d3.select("#movingAverage").node().value, 
        selectedGroup, 
        d3.select("#VariableDropdown").node().value)
    });
    d3.select("#VariableDropdown").on("change", function (d) {
        selectedGroup = this.value;
        updateChart(d3.select("#movingAverage").node().value, 
        d3.select("#chromosomeDropdown").node().value, 
        selectedGroup)
    });
    }
)

</script>

</example>