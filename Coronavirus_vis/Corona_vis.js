// visualise the number of corona cases per county
// split for each country
// add an all for each country option

var DATA = d3.csv("https://raw.githubusercontent.com/tomwhite/covid-19-uk-data/master/data/covid-19-cases-uk.csv", function (d) {
    return {
        date: d.Date,
        country: d.Country,
        area: d.Area,
        cases: +d.TotalCases
    }
})

// let's make the margins, height and width
var margin = ({
    top: 20,
    right: 20,
    bottom: 30,
    left: 30
})
var height = 600
var width = 1000

var svg = d3.select("#coronavis")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

DATA.then(function (d) {
    DATA2 = d.map(d => d).filter(d => d.area !== "England ")
    // Parse date function
    const parseDate = d3.utcParse("%Y-%m-%d");
    // make dates variable
    const dates = Array.from(new Set(DATA2.map(d => d.date)));
    // create the new data
    var DATA3 = {
        y: "Cases",
        series: Array.from(
            d3.rollup(DATA2,
                ([d]) => +d.cases,
                d => d.area + ", " + d.country,
                d => d.date),
            ([name, values]) => ({
                name,
                values: dates.map(values.get, values)
            })),
        dates: dates.map(parseDate)
    };
    //console.log(DATA3) wow that worked...

    // x scale
    var x = d3.scaleUtc()
        .domain(d3.extent(DATA3.dates))
        .range([margin.left, width - margin.right - 50])

    var xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 80).tickSizeOuter(0))

    // y scale
    var y = d3.scaleLinear()
        .domain([0, d3.max(DATA3.series, d => d3.max(d.values))]).nice()
        .range([height - margin.bottom, margin.top])

    var yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y))
        .call(g => g.select(".domain").remove())
        .call(g => g.select(".tick:last-of-type text").clone()
            .attr("x", 3)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .text(DATA3.y))

    // define the line function
    var line = d3.line()
        .defined(d => !isNaN(d))
        .x((d, i) => x(DATA3.dates[i]))
        .y(d => y(d))

    svg.append("g")
        .call(xAxis);

    svg.append("g")
        .call(yAxis);

    var path = svg.append("g")
        .attr("fill", "none")
        .attr("stroke", "#56b4e9")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .selectAll("path")
        .data(DATA3.series)
        .join("path")
        .style("mix-blend-mode", "multiply")
        .attr("d", d => line(d.values));
    
    // a hover function to be called later. Courtesy of https://observablehq.com/@d3/multi-line-chart

function hover(svg, path) {

    if ("ontouchstart" in document.documentElement) {
        svg
        .style("-webkit-tap-highlight-color", "transparent")
        .on("touchmove", moved)
        .on("touchstart", entered)
        .on("touchend", left)
    }
    else svg
        .on("mousemove", moved)
        .on("mouseenter", entered)
        .on("mouseleave", left);

    const dot = svg.append("g")
        .attr("display", "none");

    dot.append("circle")
        .attr("r", 2.5);

    dot.append("text")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "middle")
        .attr("y", -8);

    function moved() {
        d3.event.preventDefault();
        const xm = x.invert(d3.mouse(this)[0]);
        //console.log(xm)
        //console.log(x.invert(d3.event.layerX))
        const ym = y.invert(d3.mouse(this)[1]);
        const i1 = d3.bisectLeft(DATA3.dates, xm, 1);
        const i0 = i1 - 1;
        const i = xm - DATA3.dates[i0] > DATA3.dates[i1] - xm ? i1 : i0;
        const s = d3.least(DATA3.series, d => Math.abs(d.values[i] - ym));
        const v = DATA3.series.map(function (d) {
            if (d.name == s.name) {
                return d.values[i]
            }
        }).filter(d => d != null);
        path.attr("stroke", d => d === s ? null : "#ddd").filter(d => d === s).raise();
        dot.attr("transform", "translate(" + x(DATA3.dates[i]) + "," + y(s.values[i]) + ")");
        dot.select("text").text(s.name + ", " + v);
    }

    function entered() {
        path.style("mix-blend-mode", null).attr("stroke", "#ddd");
        dot.attr("display", null);
    }

    function left() {
        path.style("mix-blend-mode", "multiply").attr("stroke", null);
        dot.attr("display", "none");
    }
}

    svg.call(hover, path);

})


