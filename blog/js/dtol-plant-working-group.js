/*      
* GLOBALS 
*/

function parseDate(date) {
    const dtf = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
    });
    const [{ value: mo }, , { value: da }, , { value: ye }] = dtf.formatToParts(
        date
    );
    return `${da}-${mo}-${ye}`;
}

const addTitle = (g, title, scale, type = 'title') =>
    g
        .attr(
            'transform',
            `translate(${margin.left * 0.5}, ${height * scale +
            (type == 'subtitle' ? 25 : 0)})`
        )
        .attr("font-family", "sans-serif")
        .attr("font-weight", 700)
        .attr("font-size", "28px")
        .append('text')
        .attr('class', type)
        .text(title)

const addText = (g, text, hscale, wscale) =>
    g
        .append("foreignObject")
        .attr("width", width - 100)
        .attr("height", height / 6)
        .attr('transform', `translate(${margin.left * wscale}, ${height * hscale})`)
        .attr("font-family", "sans-serif")
        .attr("font-weight", 200)
        .attr("font-size", "14px")
        .append('xhtml:div')
        .style("color", "black")
        .attr('class', 'paragraph')
        .html(`<p>${text}</p>`)

const footNote = (g, text, hscale, wscale) =>
    g
        .append("foreignObject")
        .attr("width", width - 100)
        .attr("height", height / 6)
        .attr('transform', `translate(${margin.left * wscale}, ${height * hscale})`)
        .attr("font-family", "sans-serif")
        .attr("font-weight", 100)
        .attr("font-size", "12px")
        .append('xhtml:div')
        .style("color", "grey")
        .attr('class', 'paragraph')
        .html(`<p>${text}</p>`)

const width = 700,
    height = 2000;
const margin = { left: 30, right: 20, top: 20, bottom: 50 };

// hardcoded species and family targets
const phase1FamTarget = { type: "phase1FamTarget", Vascular: 132, Bryophytes: 128 };
const phase1SpTarget = { type: "phase1SpTarget", Vascular: 275, Bryophytes: 450 };
const totalBItargetFamNeo = {
    type: "totalBItargetFamNeo",
    Vascular: 132,
    Bryophytes: 128
};
const totalBItargetSpNeo = {
    type: "totalBItargetSpNeo",
    Vascular: 1648,
    Bryophytes: 1098
};

// constants for the y arrangement of chart components
// the other heights are specified in the addTitle/Text functions.
const x0consts = { low: 0.115, high: 0.17 };
const x1consts = { low: 0.21, high: 0.4 };
const gsconsts = { low: 0.48, high: 0.62 };

// load all the data in a bunch of callbacks
// load json of counties in UK

/*
* PLOT
*/

// fetch data

// load data in a series of callbacks
d3.json("https://raw.githubusercontent.com/DToL-Plant-Working-Group/collections/main/data/uk.json").then(function (ukCounties, JSONerror) {
    if (JSONerror) return console.warn(JSONerror);
    // load the ireland topojson separately
    d3.json("https://raw.githubusercontent.com/DToL-Plant-Working-Group/collections/main/data/ireland.json").then(function (irelandCounties, JSONerror) {
        if (JSONerror) return console.warn(JSONerror);
        d3.csv("https://raw.githubusercontent.com/DToL-Plant-Working-Group/collections/main/data/COPO_parsed_DToL_plant_collections.csv").then(function (COPOdata, CSVerror) {
            // return csv of parsed data from R script
            if (CSVerror) return console.warn(CSVerror);
            // need genome size data here.
            d3.csv("https://raw.githubusercontent.com/DToL-Plant-Working-Group/collections/main/data/all_collected_final.csv").then(function (data_, CSVError) {
                if (CSVError) return console.warn(CSVError);
                d3.csv("https://raw.githubusercontent.com/DToL-Plant-Working-Group/collections/main/data/DTOL_genome_sizes_final.csv").then(function (gs_data, CSVError) {
                    if (CSVError) return console.warn(CSVError);

                    // get unique dates
                    dateData = COPOdata.map((d) => {
                        let date = new Date(d.collection_date_verbatim);
                        return date;
                    })
                        .filter(
                            (date, i, self) =>
                                self.findIndex((d) => d.getTime() === date.getTime()) === i
                        )
                        .sort(function (a, b) {
                            // Turn your strings into dates, and then subtract them
                            // to get a value that is either negative, positive, or zero.
                            return new Date(b) - new Date(a);
                        })
                        .map((d) => parseDate(d))

                    // per county data points
                    const countyArr = d3.rollups(
                        COPOdata,
                        (v) => v.length,
                        (d) => d.county
                    );
                    let countyData = [];
                    for (let i = 0; i < countyArr.length; i++) {
                        for (let j = 0; j < COPOdata.length; j++) {
                            if (countyArr[i][0] === COPOdata[j].county) {
                                countyData.push({
                                    county: countyArr[i][0],
                                    n: countyArr[i][1],
                                    county_lat: COPOdata[j].county_lat,
                                    county_lon: COPOdata[j].county_lon
                                });
                            }
                        }
                    }

                    countyData = countyData
                        .filter(
                            (v, i, a) =>
                                a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v)) === i
                        )
                        .filter((d) => d.county !== "")
                        .filter((d) => d.county_lat !== "");

                    // generate the land object
                    const ukLand = topojson.feature(ukCounties, ukCounties.objects.UK);
                    const irelandLand = topojson.feature(irelandCounties, irelandCounties.objects.IRL_adm1);

                    // generate the projection for our map
                    const projection = d3
                        .geoAlbersUk()
                        .translate([width / 2, height / 2]);
                    // spike length for map
                    const length = d3.scaleLinear([0, d3.max(countyData, d => d.n)], [0, 100]);
                    // spike function
                    const plant_spike = (length, width = 7) =>
                        `M${-width / 2},0L0,${-length}L${width / 2},0`;

                    // barchart data manipulation

                    const noSpecimensCollected = {
                        type: "noSpecimensCollected",
                        Vascular: data_.filter(
                            (d) =>
                                d.group === "Flowering plants" || // was Angiosperms
                                d.group === "Conifers" || // Gymnosperms
                                d.group === "Ferns & fern allies" // was Pteridophytes
                        ).length,
                        Bryophytes: data_.filter((d) => d.group === "Bryophyte").length // was Bryophytes
                    };

                    const noSpeciesCollected = {
                        type: "noSpeciesCollected",
                        Vascular: new Set(
                            data_
                                .filter(
                                    (d) =>
                                        d.group === "Flowering plants" || // was Angiosperms
                                        d.group === "Conifers" || // Gymnosperms
                                        d.group === "Ferns & fern allies" // was Pteridophytes
                                )
                                .map((d) => d.species)
                        ).size,
                        Bryophytes: new Set(
                            data_.filter((d) => d.group === "Bryophyte").map((d) => d.species)
                        ).size
                    };

                    const noGeneraCollected = {
                        type: "noSpeciesCollected",
                        Vascular: new Set(
                            data_
                                .filter(
                                    (d) =>
                                        d.group === "Flowering plants" || // was Angiosperms
                                        d.group === "Conifers" || // Gymnosperms
                                        d.group === "Ferns & fern allies" // was Pteridophytes
                                )
                                .map((d) => d.genus)
                        ).size,
                        Bryophytes: new Set(
                            data_.filter((d) => d.group === "Bryophyte").map((d) => d.genus)
                        ).size
                    };

                    const noFamiliesCollected = {
                        type: "noSpeciesCollected",
                        Vascular: new Set(
                            data_
                                .filter(
                                    (d) =>
                                        d.group === "Flowering plants" || // was Angiosperms
                                        d.group === "Conifers" || // Gymnosperms
                                        d.group === "Ferns & fern allies" // was Pteridophytes
                                )
                                .map((d) => d.family)
                        ).size,
                        Bryophytes: new Set(
                            data_.filter((d) => d.group === "Bryophyte").map((d) => d.family)
                        ).size
                    };

                    const familyBarPlotData = Object.assign(
                        [
                            {
                                type: "Vascular ",
                                value: noFamiliesCollected.Vascular,
                                group: "family",
                                yMax: noFamiliesCollected.Vascular + 10
                            },
                            {
                                type: "Bryophyte ",
                                value: noFamiliesCollected.Bryophytes,
                                group: "family",
                                yMax: noFamiliesCollected.Bryophytes + 10
                            },
                            {
                                type: "All ",
                                value: noFamiliesCollected.Vascular + noFamiliesCollected.Bryophytes,
                                group: "family",
                                yMax: noFamiliesCollected.Vascular + noFamiliesCollected.Bryophytes + 10
                            }
                        ],
                        { vascularLine: 132 },
                        { bryophyteLine: 128 },
                        { xLab: "Family" }
                    );

                    const genusBarPlotData = Object.assign(
                        [
                            {
                                type: "Vascular",
                                value: noGeneraCollected.Vascular,
                                group: "genus",
                                yMax: noGeneraCollected.Vascular + 20
                            },
                            {
                                type: "Bryophyte",
                                value: noGeneraCollected.Bryophytes,
                                group: "genus",
                                yMax: noGeneraCollected.Bryophytes + 20
                            },
                            {
                                type: "All",
                                value: noGeneraCollected.Vascular + noGeneraCollected.Bryophytes,
                                group: "genus",
                                yMax: noGeneraCollected.Vascular + noGeneraCollected.Bryophytes + 20
                            }
                        ],
                        { xLab: "Genus" }
                    );

                    const speciesBarPlotData = Object.assign(
                        [
                            {
                                type: "Vascular",
                                value: noSpeciesCollected.Vascular,
                                group: "species",
                                yMax: noSpeciesCollected.Vascular + 20
                            },
                            {
                                type: "Bryophyte",
                                value: noSpeciesCollected.Bryophytes,
                                group: "species",
                                yMax: noSpeciesCollected.Bryophytes + 20
                            },
                            {
                                type: "All",
                                value: noSpeciesCollected.Vascular + noSpeciesCollected.Bryophytes,
                                group: "species",
                                yMax: noSpeciesCollected.Vascular + noSpeciesCollected.Bryophytes + 20
                            }
                        ],
                        { xLab: "Species" }
                    );

                    const gs_data_ = gs_data.map((d) => {
                        return {
                            species: d.taxon_name,
                            GB: +d.GB
                        };
                    });

                    const bins = Object.assign(
                        d3.bin().thresholds(70)(
                            gs_data_.filter(d => d.GB > 0 && d.GB < 25).map(d => d.GB)
                        ),
                        { x: "Genome size (Gbp)" }
                    );

                    const GBRange = {
                        min: d3.min(gs_data_.filter(d => d.GB > 0).map(d => d.GB)),
                        max: d3.max(gs_data_.filter(d => d.GB > 0).map(d => d.GB))
                    };

                    const excludedBins = gs_data_.filter(d => d.GB >= 25);

                    // axes
                    const x0 = d3
                        .scaleLinear()
                        .domain([0, totalBItargetFamNeo.Vascular + 10])
                        .range([margin.left + 25, width - margin.right]);

                    const x1 = d3
                        .scaleBand()
                        .domain(familyBarPlotData.map(d => d.type))
                        .range([margin.left, (width - margin.left - margin.right) / 3]) // might need to change this
                        .padding(0.1);

                    const x2 = d3
                        .scaleBand()
                        .domain(genusBarPlotData.map(d => d.type))
                        .range([
                            (width - margin.left - margin.right) / 3 + 50,
                            ((width - margin.left - margin.right) / 3) * 2 + 20
                        ]) // might need to change this
                        .padding(0.1);

                    const x3 = d3
                        .scaleBand()
                        .domain(speciesBarPlotData.map(d => d.type))
                        .range([453.3333333333333 + 50, 453.3333333333333 + 187 + 50]) // might need to change this
                        .padding(0.1);

                    const gsx = d3
                        .scaleLinear()
                        .domain([bins[0].x0, bins[bins.length - 1].x1])
                        .range([margin.left, width - margin.right]);

                    const xAxis0 = g =>
                        g
                            .attr("transform", `translate(0,${height * x0consts.low})`)
                            .call(d3.axisTop(x0));

                    const xAxis1 = g =>
                        g
                            .attr("transform", `translate(0,${height * x1consts.high})`)
                            .call(d3.axisBottom(x1).tickSizeOuter(0))
                            .call(g =>
                                g
                                    .select(".tick text")
                                    .clone()
                                    .attr("x", x1.bandwidth())
                                    .attr("y", 25)
                                    .attr("text-anchor", "middle")
                                    .attr("font-weight", "bold")
                                    .text(familyBarPlotData.xLab)
                            );

                    const xAxis2 = g =>
                        g
                            .attr("transform", `translate(0,${height * x1consts.high})`)
                            .call(d3.axisBottom(x2).tickSizeOuter(0))
                            .call(g =>
                                g
                                    .select(".tick text")
                                    .clone()
                                    .attr("x", x2.bandwidth())
                                    .attr("y", 25)
                                    .attr("text-anchor", "middle")
                                    .attr("font-weight", "bold")
                                    .text(genusBarPlotData.xLab)
                            )

                    const xAxis3 = g =>
                        g
                            .attr("transform", `translate(0,${height * x1consts.high})`)
                            .call(d3.axisBottom(x3).tickSizeOuter(0))
                            .call(g =>
                                g
                                    .select(".tick text")
                                    .clone()
                                    .attr("x", x3.bandwidth())
                                    .attr("y", 25)
                                    .attr("text-anchor", "middle")
                                    .attr("font-weight", "bold")
                                    .text(speciesBarPlotData.xLab)
                            );

                    const gsAxis = g =>
                        g
                            .attr("transform", `translate(0,${height * gsconsts.high})`)
                            .call(d3.axisBottom(gsx).tickSizeOuter(0))
                            .call(g =>
                                g.call(g =>
                                    g
                                        .append("text")
                                        .attr("x", width / 2 + margin.left)
                                        .attr("y", 30)
                                        .attr("fill", "currentColor")
                                        .attr("font-weight", "bold")
                                        .attr("text-anchor", "end")
                                        .text(bins.x)
                                )
                            );

                    const y0 = d3
                        .scaleBand()
                        .domain(familyBarPlotData.filter(d => d.type !== "All ").map(d => d.type))
                        .range([height * x0consts.high, height * x0consts.low])
                        .padding(0.1);

                    const y1 = d3
                        .scaleLinear()
                        .domain([0, familyBarPlotData[2].yMax])
                        .range([height * x1consts.high, height * x1consts.low]);

                    const y2 = d3
                        .scaleLinear()
                        .domain([0, genusBarPlotData[2].yMax])
                        .range([height * x1consts.high, height * x1consts.low]);

                    const y3 = d3
                        .scaleLinear()
                        .domain([0, speciesBarPlotData[2].yMax])
                        .range([height * x1consts.high, height * x1consts.low]);

                    const gsy = d3
                        .scaleLinear()
                        .domain([0, d3.max(bins, d => d.length) + 5])
                        .nice()
                        .range([height * gsconsts.high, height * gsconsts.low]);

                    const yAxis0 = g =>
                        g
                            .attr("class", "yAxis")
                            .attr("transform", `translate(${margin.left + 25},0)`)
                            .call(d3.axisLeft(y0));

                    const yAxis1 = g =>
                        g
                            .attr("class", "yAxis")
                            .attr("transform", `translate(${margin.left},0)`)
                            .call(d3.axisLeft(y1))
                            //.call(g => g.select(".domain").remove())
                            .call(g =>
                                g
                                    .select(".tick:last-of-type text")
                                    .clone()
                                    .attr("x", 3)
                                    .attr("text-anchor", "start")
                                    .attr("font-weight", "bold")
                                    .attr("class", "show-phase1_1")
                                    .html(" ")
                            );

                    const yAxis2 = g =>
                        g
                            .attr("class", "yAxis")
                            .attr(
                                "transform",
                                `translate(${(width - margin.left - margin.right) / 3 + 50},0)`
                            )
                            .call(d3.axisLeft(y2))
                            //.call(g => g.select(".domain").remove())
                            .call(g =>
                                g
                                    .select(".tick:last-of-type text")
                                    .clone()
                                    .attr("x", 3)
                                    .attr("text-anchor", "start")
                                    .attr("font-weight", "bold")
                                    .attr("class", "show-phase1_2")
                                    .html(" ")
                            );

                    const yAxis3 = g =>
                        g
                            .attr("class", "yAxis")
                            .attr("transform", `translate(${453.3333333333333 + 50},0)`)
                            .call(d3.axisLeft(y3))
                            //.call(g => g.select(".domain").remove())
                            .call(g =>
                                g
                                    .select(".tick:last-of-type text")
                                    .clone()
                                    .attr("x", 3)
                                    .attr("text-anchor", "start")
                                    .attr("font-weight", "bold")
                                    .attr("class", "show-phase1_3")
                                    .html(" ")
                            );

                    const gsyAxis = (g) =>
                        g
                            .attr("transform", `translate(${margin.left},0)`)
                            .call(d3.axisLeft(gsy))
                            .call((g) =>
                                g
                                    .select(".tick:last-of-type text")
                                    .clone()
                                    .attr("x", 4)
                                    .attr("text-anchor", "start")
                                    .attr("font-weight", "bold")
                                    .text("Counts")
                            );

                    // make the plot itself

                    // make the svg
                    const svg = d3.select("example")
                        .append("svg")
                        .attr("width", width)
                        .attr("height", height);


                    // add the title
                    const title = svg.append("g");
                    title.append("g").call(addTitle, "DToL Plant Sampling Group Summary", 0.035);

                    // add the introductory sentences
                    const DATE = parseDate(new Date(data_[0].date));
                    const para1 = svg.append("g");
                    para1
                        .append("g")
                        .call(
                            addText,
                            `This document charts the progress made so far in collecting plant samples for the Darwin Tree of Life project. Overall, ${noSpecimensCollected.Bryophytes + noSpecimensCollected.Vascular
                            } specimens have been collected up until ${DATE}. A full and updated list of the DToL plant species, priorities, and collections can be found <b><a href="http://bit.ly/DToLbryophytes2021">here</a></b> for bryophytes, and <b><a href="http://bit.ly/DToLplants2021">here</a></b> for vascular plants.`,
                            0.04,
                            0.5
                        );

                    // add figure 1, the horizontal bar chart
                    const bars1 = svg
                        .append("g")
                        .selectAll("rect")
                        .data(familyBarPlotData.filter((d) => d.type !== "All "))
                        .join("rect")
                        .style("mix-blend-mode", "multiply")
                        .attr("fill", (d) => (d.type === "Bryophyte " ? "#e5f5e0" : "#a1d99b"))
                        .attr("x", (d) => x0(0))
                        .attr("y", (d) => y0(d.type))
                        .attr("width", (d) => x0(d.value) - x0(0))
                        .attr("height", y0.bandwidth())
                        .append("title")
                        .text(
                            (d) => `${d.type}: ${d.value} families
Target: ${d.type === "Vascular "
                                    ? familyBarPlotData.vascularLine
                                    : familyBarPlotData.bryophyteLine
                                }`
                        );
                    // add target lines
                    const vascularTargetLine = svg
                        .append("g")
                        .append("line")
                        .attr("x1", x0(totalBItargetFamNeo.Vascular))
                        .attr("x2", x0(totalBItargetFamNeo.Vascular))
                        .attr("y1", y0("Vascular ") + y0.bandwidth())
                        .attr("y2", y0("Vascular "))
                        .attr("stroke", "red")
                        .attr("stroke-dasharray", 3);

                    // add target lines
                    const bryophyteTargetLine = svg
                        .append("g")
                        .append("line")
                        .attr("x1", x0(totalBItargetFamNeo.Bryophytes))
                        .attr("x2", x0(totalBItargetFamNeo.Bryophytes))
                        .attr("y1", y0("Bryophyte ") + y0.bandwidth())
                        .attr("y2", y0("Bryophyte "))
                        .attr("stroke", "red")
                        .attr("stroke-dasharray", 3);

                    // add the axes for figure 1
                    const bars1x = svg.append("g").call(xAxis0);
                    const bars1y = svg.append("g").call(yAxis0);

                    // add the description for figure 1
                    const para2 = svg.append("g");
                    para2
                        .append("g")
                        .call(
                            addText,
                            `Fig. 1 - the bar shows the current number of plant families collected, split by vascular plants and bryophytes. The target is ${totalBItargetFamNeo.Vascular} for vascular plants, and ${totalBItargetFamNeo.Bryophytes} for bryophytes (red dashes).`,
                            0.17,
                            1.5
                        );

                    // add the three bar charts which split by family, genus, species (for vascular, bryophyte & total)
                    const bars2 = svg
                        .append("g")
                        .selectAll("rect")
                        .data(familyBarPlotData)
                        .join("rect")
                        .style("mix-blend-mode", "multiply")
                        .attr("fill", "#a1d99b")
                        .attr("x", (d) => x1(d.type))
                        .attr("y", (d) => y1(d.value))
                        .attr("height", (d) => y1(0) - y1(d.value))
                        .attr("width", x1.bandwidth())
                        .append("title")
                        .text((d) => `${d.type.trim()}: ${d.value} families`);

                    // add the axes for figure 2
                    const bars2x = svg.append("g").call(xAxis1);
                    const bars2y = svg.append("g").call(yAxis1);

                    const bars3 = svg
                        .append("g")
                        .selectAll("rect")
                        .data(genusBarPlotData)
                        .join("rect")
                        .style("mix-blend-mode", "multiply")
                        .attr("fill", "#a1d99b")
                        .attr("x", (d) => x2(d.type))
                        .attr("y", (d) => y2(d.value))
                        .attr("height", (d) => y2(0) - y2(d.value))
                        .attr("width", x2.bandwidth())
                        .append("title")
                        .text((d) => `${d.type.trim()}: ${d.value} genera`);

                    // add the axes for figure 2
                    const bars3x = svg.append("g").call(xAxis2);
                    const bars3y = svg.append("g").call(yAxis2);

                    const bars4 = svg
                        .append("g")
                        .selectAll("rect")
                        .data(speciesBarPlotData)
                        .join("rect")
                        .style("mix-blend-mode", "multiply")
                        .attr("fill", "#a1d99b")
                        .attr("x", (d) => x3(d.type))
                        .attr("y", (d) => y3(d.value))
                        .attr("height", (d) => y3(0) - y3(d.value))
                        .attr("width", x3.bandwidth())
                        .append("title")
                        .text((d) => `${d.type.trim()}: ${d.value} species`);

                    // add the axes for figure 2
                    // future Max, please sort out the axes positioning behind the scenes
                    const bars4x = svg.append("g").call(xAxis3);
                    const bars4y = svg.append("g").call(yAxis3);

                    // add the description for figure 2
                    const para3 = svg.append("g");
                    para3
                        .append("g")
                        .call(
                            addText,
                            `Fig. 2 - bar charts split by family, genus, and species which show the number of taxa collected at each taxonomic level.`,
                            0.42,
                            1.5
                        );

                    // the c-value distribution would be here, but no data yet...
                    const cvals_hist = svg
                        .append("g")
                        .selectAll("rect")
                        .data(bins)
                        .join("rect")
                        .attr("fill", "#a1d99b")
                        .attr("x", (d) => gsx(d.x0) + 1)
                        .attr("width", (d) => Math.max(0, gsx(d.x1) - gsx(d.x0) - 1))
                        .attr("y", (d) => gsy(d.length))
                        .attr("height", (d) => gsy(0) - gsy(d.length))
                        .append("title")
                        .text(
                            (d) => `${d.x0} - ${d.x1} Gb
${d.length} species`
                        );

                    const cvals_histx = svg.append("g").call(gsAxis);
                    const cvals_histy = svg.append("g").call(gsyAxis);

                    const para4 = svg.append("g");
                    para4
                        .append("g")
                        .call(
                            addText,
                            `Fig. 3 - the distribution of genome size variation in collected plants. Genomes greater than 25Gb excluded (${excludedBins.length
                            }). There is currently a ${Math.round(
                                GBRange.max / GBRange.min
                            )}-fold variation in genome sizes collected.`,
                            0.64,
                            1.5
                        );

                    // go on to the map

                    const path = d3.geoPath(projection);
                    // move the map
                    const transX = 0,
                        transY = height * 0.31;
                    const _ukCounties = svg
                        .append("g")
                        .selectAll("path")
                        .data(ukLand.features)
                        .join("path")
                        .attr("class", "provinceShape")
                        .attr("stroke", "white")
                        .attr("fill", "#e0e0e0")
                        .attr("transform", (d) => `translate(${transX},${transY})`)
                        .attr("d", path);

                    const _irelandCounties = svg
                        .append("g")
                        .selectAll("path")
                        .data(irelandLand.features)
                        .join("path")
                        .attr("class", "provinceShape")
                        .attr("stroke", "white")
                        .attr("fill", "#e0e0e0")
                        .attr("transform", (d) => `translate(${transX},${transY})`)
                        .attr("d", path);
                    // add the lat long for individual points
                    countyData.forEach(function (d) {
                        var coords = projection([d.county_lon, d.county_lat]);
                        d.position = [coords[0], coords[1]];
                    });
                    const spikes = svg
                        .append("g")
                        .attr("fill", "green")
                        .attr("fill-opacity", 0.3)
                        .attr("stroke", "green")
                        .attr("class", "spikes")
                        .selectAll("path")
                        .data(countyData)
                        .join("path")
                        .attr("transform", (d) => `translate(${d.position})`)
                        .attr("d", (d) => plant_spike(length(d.n)));
                    spikes.append("title").text((d) => `${d.county}`);
                    svg
                        .selectAll(".spikes")
                        .attr("transform", (d) => `translate(${transX},${transY})`);
                    const legend = svg
                        .append("g")
                        .attr("fill", "#777")
                        .attr("text-anchor", "middle")
                        .attr("font-family", "sans-serif")
                        .attr("font-size", 10)
                        .attr("class", "legend")
                        .selectAll("g")
                        .data(length.ticks(6).slice(1).reverse())
                        .join("g")
                        .attr("transform", (d, i) => `translate(${1 - (i + 1) * 18},0)`);
                    legend
                        .append("path")
                        .attr("fill", "green")
                        .attr("fill-opacity", 0.3)
                        .attr("stroke", "green")
                        .attr("d", (d) => plant_spike(length(d)));
                    legend.append("text").attr("dy", "1.3em").text(length.tickFormat(4, "s"));
                    // move the legend around
                    svg
                        .selectAll(".legend")
                        .attr(
                            "transform",
                            (d) => `translate(${width - margin.right},${height * 0.9})`
                        );

                    // add the description for figure 3(4)
                    const para5 = svg.append("g");
                    para5
                        .append("g")
                        .call(
                            addText,
                            `Fig. 4 - spike map of Great Britain and Ireland, showing areas where samples have been collected so far. Data drawn from COPO.`,
                            0.92,
                            1.5
                        );

                    const footer = svg.append("g");
                    footer
                        .append("g")
                        .call(
                            footNote,
                            `Summary charts by Max Brown, Lucia Campos-Dominguez, and Alex Twyford. Plant collections were made by Maarten Christenhusz at the Royal Botanic Garden Kew, David Bell and Markus Ruhsam at the Royal Botanic Garden Edinburgh, and by Darwin Tree of Life collaborators around Britain and Ireland. Genome size estimates were generated by Sahr Mian and Ilia Leitch at the Royal Botanical Gardens, Kew.`,
                            0.955,
                            1.5
                        );
                })
            })
        })
    })
});