import * as d3 from "https://cdn.skypack.dev/d3@7";

// unfortunately, yes I typed this all out...
const data = [
    {
        section: "Porphyrion",
        clade: "Engleria",
        hybrids: true,
        hybrid_arr: [
            { clade: "Kabschia", reliable: true },
            { clade: "Aizoonia", reliable: false }
        ]
    },
    {
        section: "Ligulatae",
        clade: "Aizoonia",
        hybrids: true,
        hybrid_arr: [
            { clade: "Engleria", reliable: false },
            { clade: "Gymnopera", reliable: true },
            { clade: "Xanthizoon", reliable: true }
        ]
    },
    {
        section: "Ligulatae",
        clade: "Florulentae",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Ligulatae",
        clade: "Mutatae",
        hybrids: true,
        hybrid_arr: [
            { clade: "Kabschia", reliable: false },
            { clade: "Xanthizoon", reliable: true }
        ]
    },
    {
        section: "Xanthizoon",
        clade: "Xanthizoon",
        hybrids: true,
        hybrid_arr: [
            { clade: "Kabschia", reliable: true },
            { clade: "Oppositifoliae", reliable: true },
            { clade: "Aizoonia", reliable: true },
            { clade: "Mutatae", reliable: true },
            { clade: "Gymnopera", reliable: false }
        ]
    },
    {
        section: "Trachyphyllum",
        clade: "Trachyphyllum",
        hybrids: true,
        hybrid_arr: [{ clade: "Holophyllae", reliable: false }]
    },
    {
        section: "Gymnopera",
        clade: "Gymnopera",
        hybrids: true,
        hybrid_arr: [
            { clade: "Xanthizoon", reliable: false },
            { clade: "Cotylea", reliable: false }
        ]
    },
    {
        section: "Cotylea",
        clade: "Cotylea",
        hybrids: true,
        hybrid_arr: [{ clade: "Gymnopera", reliable: false }]
    },
    {
        section: "Odontophyllae",
        clade: "Odontophyllae",
        hybrids: false,
        hybrid_arr: []
    },
    {
        section: "Mesogyne",
        clade: "Mesogyne",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Saxifraga",
        clade: "Saxifraga",
        hybrids: true,
        hybrid_arr: [{ clade: "Triplinervium", reliable: true }]
    },
    {
        section: "Saxifraga",
        clade: "Triplinervium",
        hybrids: true,
        hybrid_arr: [
            { clade: "Saxifraga", reliable: true },
            { clade: "Holophyllae", reliable: true },
            { clade: "Tridactylites", reliable: true }
        ]
    },
    {
        section: "Saxifraga",
        clade: "Holophyllum",
        hybrids: true,
        hybrid_arr: [
            { clade: "Triplinervium", reliable: true },
            { clade: "Trachyphyllum", reliable: false },
            { clade: "Kabschia", reliable: false }
        ]
    },
    {
        section: "Saxifraga",
        clade: "Tridactylites",
        hybrids: true,
        hybrid_arr: [{ clade: "Triplinervium", reliable: true }]
    },
    { section: "Ciliatae", clade: "Ciliatae", hybrids: false, hybrid_arr: [] },
    {
        section: "Cymbalaria",
        clade: "Cymbalaria",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Merkianae",
        clade: "Merkianae",
        hybrids: false,
        hybrid_arr: []
    },
    {
        section: "Micranthes",
        clade: "Stellares",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Micranthes",
        clade: "Cuneifoliatae",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Micranthes",
        clade: "Micranthes",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Micranthes",
        clade: "Rotundifoliae",
        hybrids: true,
        hybrid_arr: []
    },
    {
        section: "Irregulares",
        clade: "Irregulares",
        hybrids: false,
        hybrid_arr: []
    },
    { section: "Hetersia", clade: "Hetersia", hybrids: true, hybrid_arr: [] },
    {
        section: "Porphyrion",
        clade: "Kabschia",
        hybrids: true,
        hybrid_arr: [
            { clade: "Holophyllae", reliable: false },
            { clade: "Xanthizoon", reliable: true },
            { clade: "Mutatae", reliable: false },
            { clade: "Engleria", reliable: true }
        ]
    },
    {
        section: "Porphyrion",
        clade: "Oppositifoliae",
        hybrids: true,
        hybrid_arr: [{ clade: "Xanthizoon", reliable: true }]
    }
]

const CircleRadius = 150

function rotate(d) {
    return ((d.start + d.end) / 2 / Math.PI) * 180 + 90;
}

// make the nodes object 

let angle = (2 * Math.PI) / data.length;

for (let i = 0; i < data.length; i++) {
    let angle_i = angle * i;
    data[i].start = angle_i;

    data[i].x = CircleRadius * Math.cos(angle_i);
    data[i].y = CircleRadius * Math.sin(angle_i);

    data[i].xtext = (CircleRadius + 25) * Math.cos(angle_i);
    data[i].ytext = (CircleRadius + 25) * Math.sin(angle_i);
}


// get the x and y coords
const getXandY = function (clade) {
    for (let i = 0; i < data.length; i++) {
        if (data[i].clade === clade) {
            return {
                x: data[i].x,
                y: data[i].y
            };
        }
    }
}

// rotate the data around
function shiftData(data, n) {
    for (let i = 0; i < n; i++) {
        data.push(data.shift());
    }
    return data;
}


// make links

let arr = [];

// walk through array
for (let i = 0; i < data.length; i++) {
    // walk through hybrid array
    for (let j = 0; j < data[i].hybrid_arr.length; j++) {
        if (data[i].hybrid_arr.length > 0) {
            arr.push({
                clade1: data[i].clade,
                xy1: { x: data[i].x, y: data[i].y },
                clade2: data[i].hybrid_arr[j].clade,
                xy2: getXandY(data[i].hybrid_arr[j].clade),
                reliable: data[i].hybrid_arr[j].reliable
            });
        }
    }
}
let links = arr.filter((d) => d.xy2 !== undefined);

const d = 400;
const svg = d3
    .select("example")
    .append("svg")
    .attr("viewBox", `${-d / 2} ${-d / 2} ${d} ${d}`)
    .attr("width", d)
    .attr("height", d)
    .attr("font-family", "sans-serif")
    .attr("font-size", 10);

svg
    .append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .attr("r", 5)
    .attr("fill", (d) => (d.hybrids ? "black" : "white"))
    .attr("stroke", "black");

svg
    .append("g")
    .selectAll("text")
    .data(data)
    .join("text")
    .attr("x", (d) => d.xtext)
    .attr("y", (d) => d.ytext)
    .attr("text-anchor", "middle")
    .text((d) => d.clade.substring(0, 3).toUpperCase());

svg
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("x1", (d) => d.xy1.x)
    .attr("y1", (d) => d.xy1.y)
    .attr("x2", (d) => d.xy2.x)
    .attr("y2", (d) => d.xy2.y)
    .attr("stroke", "black")
    .attr("stroke-dasharray", (d) => (d.reliable ? 0 : 3));

const spokes = svg
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .attr("transform", (d) => `rotate(${d.angle})`)
    .attr("fill", "none")
    .attr("stroke-width", "0.02")
    .attr("stroke", "#fff");