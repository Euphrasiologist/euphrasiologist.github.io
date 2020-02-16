
var w = 1000;
var h = 400;
var padding = 30;

var dataset = [
            [5, 20], [480, 90], [250, 50], [100, 33], [330, 95],
            [410, 12], [475, 44], [25, 67], [85, 21], [220, 88]
            ];

var xScale = d3.scaleLinear()
.domain([0, d3.max(dataset, function(d){
    return d[0];
})])
.range([padding, w-padding*2]);

var yScale = d3.scaleLinear()
.domain([0, d3.max(dataset, function(d){
return d[1];
})])
.range([h-padding,padding]);

var xAxis = d3.axisBottom()
            .scale(xScale);
var yAxis = d3.axisLeft()
            .scale(yScale);

var rScale = d3.scaleLinear()
                .domain([0, d3.max(dataset, function(d){
                return d[1];
                })])
                .range([10,10]);

var svg = d3.select("body")
            .append("svg")
            .attr("width", w)
            .attr("height", h);
svg.selectAll("circle")
    .data(dataset)
    .enter()
    .append("circle")
    .attr("cx", function(cx){
    return(xScale(cx[0]));
    })
    .attr("cy", function(cy){
    return(yScale(cy[1]));
    })
    .attr("r", function(r){
    return rScale(r[1]);
    })
svg.selectAll("text")
.data(dataset)
.enter()
.append("text")

.text(function(text){
return text[0] + "," + text[1];
})
.attr("x", function(x){
return xScale(x[0]);
})
.attr("y", function(y){
return yScale(y[1]);
})
.attr("font-family", "sans-serif")
.attr("font-size", "11px")
.attr("fill", "red");

svg.append("g")
    .attr("class", "axis")
    .attr("transform", "translate(0," + (h-padding) + ")")
    .call(xAxis);
svg.append("g")
.attr("class", "axis")
.attr("transform", "translate(" + (padding) + ",0)")
.call(yAxis);



