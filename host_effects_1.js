// a script which takes the Manyhosts.csv file and creates interactive 
// boxplots. Four traits are visualised, though more could be added.

// Load the csv
var Data = d3.csv("dats/Manyhosts.csv",
    function (d) {
        return {
            // + turns to numeric!
            Host: d.Host,
            Height: +d.Height,
            Nodes_to_flower: +d.Nodes_to_flower_inc_coty,
            Corolla_length: +d.Standard_corolla_l,
            Days_to_flower: +d.Julian_days_to_flower
        };
    });
// this Data.then is essential but I don't understand why
Data.then(function (data) {
    // create the visualisation function
    // data is the object to load.
    function createVisualisation() {
        // margins for the plot
        var margin = {
                top: 10,
                right: 50,
                bottom: 50,
                left: 50
            },
            width = 1000 - margin.left - margin.right,
            height = 600 - margin.top - margin.bottom;

        // create the svg element (put in .row!)
        var svg = d3.select(".row1")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")")
            .attr("align", "center")
        
        // Create the x-scale (categorical TODO change names)
        var x = d3.scaleBand()
            .domain(["No host",
                         "Marchantia polymorpha",
                         "Equisetum arvense",
                         "Pinus sylvestris",
                         "Arabidopsis thaliana",
                         "Festuca rubra",
                         "Holcus lanatus",
                        "Plantago lanceolata",
                        "Trifolium repens"])
            .range([0, width])
            .paddingInner(1)
            .paddingOuter(.5)

        // call the x-scale
        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(x))

        // text label for the x axis
        svg.append("text")
            .attr("transform",
                "translate(" + (width / 2) + " ," +
                (height + margin.top + 30) + ")")
            .style("text-anchor", "middle")
            .text("Host species");

        // create y-scale
        // y scale needs to be greater than maximum point
        // but by maybe only 10%?
        var y = d3.scaleLinear()
            .domain([0, d3.max(data, function (d) {
                return d.Height + 0.1 * d.Height;
            })])
            .range([height, 0])

        // call y scale yAxis to update later
        var yAxis = d3.axisLeft().scale(y)

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        // text label for the y axis
        svg.append("text")
            .attr("class", "y label")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - margin.left)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text("Height (mm)");

        // create the boxplots
        // Compute quartiles, median, inter quantile range min and max --> these info are then used to draw the box.
        // I couldnt think of any other way but to calculate for each trait
        var sumstat = d3.nest() // nest function allows to group the calculation per level of a factor
            .key(function (d) {
                return d.Host;
            })
            .rollup(function (d) {

                // 1st quartile each trait
                q1Height = d3.quantile(d.map(function (g) {
                    return g.Height;
                }).sort(d3.ascending), .25)
                q1Nodes = d3.quantile(d.map(function (g) {
                    return g.Nodes_to_flower;
                }).sort(d3.ascending), .25)
                q1Corolla = d3.quantile(d.map(function (g) {
                    return g.Corolla_length;
                }).sort(d3.ascending), .25)
                q1Days = d3.quantile(d.map(function (g) {
                    return g.Days_to_flower;
                }).sort(d3.ascending), .25)

                // median each trait
                medianHeight = d3.quantile(d.map(function (g) {
                    return g.Height;
                }).sort(d3.ascending), .5)
                medianNodes = d3.quantile(d.map(function (g) {
                    return g.Nodes_to_flower;
                }).sort(d3.ascending), .5)
                medianCorolla = d3.quantile(d.map(function (g) {
                    return g.Corolla_length;
                }).sort(d3.ascending), .5)
                medianDays = d3.quantile(d.map(function (g) {
                    return g.Days_to_flower;
                }).sort(d3.ascending), .5)

                // q3 each trait
                q3Height = d3.quantile(d.map(function (g) {
                    return g.Height;
                }).sort(d3.ascending), .75)
                q3Nodes = d3.quantile(d.map(function (g) {
                    return g.Nodes_to_flower;
                }).sort(d3.ascending), .75)
                q3Corolla = d3.quantile(d.map(function (g) {
                    return g.Corolla_length;
                }).sort(d3.ascending), .75)
                q3Days = d3.quantile(d.map(function (g) {
                    return g.Days_to_flower;
                }).sort(d3.ascending), .75)

                // IQR each trait
                interQuantileRangeHeight = q3Height - q1Height
                interQuantileRangeNodes = q3Nodes - q1Nodes
                interQuantileRangeCorolla = q3Corolla - q1Corolla
                interQuantileRangeDays = q3Days - q1Days

                // min for each trait
                minHeight = q1Height - 1.5 * interQuantileRangeHeight
                maxHeight = q3Height + 1.5 * interQuantileRangeHeight
                minNodes = q1Nodes - 1.5 * interQuantileRangeNodes
                maxNodes = q3Nodes + 1.5 * interQuantileRangeNodes
                minCorolla = q1Corolla - 1.5 * interQuantileRangeCorolla
                maxCorolla = q3Corolla + 1.5 * interQuantileRangeCorolla
                minDays = q1Days - 1.5 * interQuantileRangeDays
                maxDays = q3Days + 1.5 * interQuantileRangeDays
                // return each trait, phew!
                return ({
                    q1Height: q1Height, //Height
                    medianHeight: medianHeight,
                    q3Height: q3Height,
                    interQuantileRangeHeight: interQuantileRangeHeight,
                    minHeight: minHeight,
                    maxHeight: maxHeight,
                    q1Nodes: q1Nodes, //Nodes
                    medianNodes: medianNodes,
                    q3Nodes: q3Nodes,
                    interQuantileRangeNodes: interQuantileRangeNodes,
                    minNodes: minNodes,
                    maxNodes: maxNodes,
                    q1Corolla: q1Corolla, //Corolla
                    medianCorolla: medianCorolla,
                    q3Corolla: q3Corolla,
                    interQuantileRangeCorolla: interQuantileRangeCorolla,
                    minCorolla: minCorolla,
                    maxCorolla: maxCorolla,
                    q1Days: q1Days, //Days
                    medianDays: medianDays,
                    q3Days: q3Days,
                    interQuantileRangeDays: interQuantileRangeDays,
                    minDays: minDays,
                    maxDays: maxDays,
                })
            })
            .entries(data)

        // Show the main vertical line
        var vertLine = svg.selectAll("vertLines")
            .data(sumstat)
            .enter()
            .append("line")
            .attr("x1", function (d) {
                return (x(d.key))
            })
            .attr("x2", function (d) {
                return (x(d.key))
            })
            .attr("y1", function (d) {
                if (d.value.minHeight > 0) {
                    return (y(d.value.minHeight))
                } else { // height here is the svg height!
                    return (height)
                }

            })
            .attr("y2", function (d) {
                return (y(d.value.maxHeight))
            })
            .attr("stroke", "black")
            .style("width", 40)

        // rectangle for the main box
        var boxWidth = width / 10

        var box = svg.selectAll("boxes")
            .data(sumstat)
            .enter()
            .append("rect")
            .attr("x", function (d) {
                return (x(d.key) - boxWidth / 2)
            })
            .attr("y", function (d) {
                return (y(d.value.q3Height))
            })
            .attr("height", function (d) {
                return (y(d.value.q1Height) - y(d.value.q3Height))
            })
            .attr("width", boxWidth)
            .attr("stroke", "black")
            .style("fill", "#B3B6B7")

        // Show the median
        var medianLine = svg.selectAll("medianLines")
            .data(sumstat)
            .enter()
            .append("line")
            .attr("x1", function (d) {
                return (x(d.key) - boxWidth / 2)
            })
            .attr("x2", function (d) {
                return (x(d.key) + boxWidth / 2)
            })
            .attr("y1", function (d) {
                return (y(d.value.medianHeight))
            })
            .attr("y2", function (d) {
                return (y(d.value.medianHeight))
            })
            .attr("stroke", "black")
            .style("width", 80)


        // create the circles
        var jitterWidth = 50
        var circle = svg.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", function (d) {
                return (x(d.Host) - jitterWidth / 2 + Math.random() * jitterWidth)
            })
            .attr("cy", function (d) {
                return (y(d.Height));
            })
            .attr("r", 5)
            .style("fill", "white")
            .attr("stroke", "black")
            .attr("stroke-width", "1.3");


        // UPDATES

        // transitions
        d3.select("#Nodes").on("click", function () {
            // update y scale domain
            y.domain([0, d3.max(data, function (d) {
                return d.Nodes_to_flower + 0.1 * d.Nodes_to_flower;
            })]);
            // update y axis name
            svg.select(".y.label")
                .transition()
                .duration(2000)
                .text("Number of nodes to flower")

            // vertical line
            vertLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    if (d.value.minNodes > 0) {
                        return (y(d.value.minNodes))
                    } else { // height here is the svg height!
                        return (height)
                    }

                })
                .attr("y2", function (d) {
                    return (y(d.value.maxNodes))
                })


            // box
            box
                .transition()
                .duration(2000)
                .attr("y", function (d) {
                    return (y(d.value.q3Nodes))
                })
                .attr("height", function (d) {
                    return (y(d.value.q1Nodes) - y(d.value.q3Nodes))
                })


            // median line
            medianLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    return (y(d.value.medianNodes))
                })
                .attr("y2", function (d) {
                    return (y(d.value.medianNodes))
                })


            // circles
            circle
                .transition()
                .duration(2000)
                .attr("cx", function (d) {
                    return (x(d.Host) - jitterWidth / 2 + Math.random() * jitterWidth)
                })
                .attr("cy", function (d) {
                    return (y(d.Nodes_to_flower));
                });
            // axis?
            svg.select(".y.axis")
                .transition()
                .duration(2000)
                .call(yAxis);

        });

        d3.select("#Height").on("click", function () {
            // update y scale domain
            y.domain([0, d3.max(data, function (d) {
                return d.Height + 0.1 * d.Height;
            })]);
            // update y axis name
            svg.select(".y.label")
                .transition()
                .duration(2000)
                .text("Height (mm)")

            // vertical line
            vertLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    if (d.value.minHeight > 0) {
                        return (y(d.value.minHeight))
                    } else { // height here is the svg height!
                        return (height)
                    }

                })
                .attr("y2", function (d) {
                    return (y(d.value.maxHeight))
                })


            // box
            box
                .transition()
                .duration(2000)
                .attr("y", function (d) {
                    return (y(d.value.q3Height))
                })
                .attr("height", function (d) {
                    return (y(d.value.q1Height) - y(d.value.q3Height))
                })


            // median line
            medianLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    return (y(d.value.medianHeight))
                })
                .attr("y2", function (d) {
                    return (y(d.value.medianHeight))
                })

            // circles
            circle
                .transition()
                .duration(2000)
                .attr("cx", function (d) {
                    return (x(d.Host) - jitterWidth / 2 + Math.random() * jitterWidth)
                })
                .attr("cy", function (d) {
                    return (y(d.Height));
                });
            // axis?
            svg.select(".y.axis")
                .transition()
                .duration(2000)
                .call(yAxis);
        });

        d3.select("#Corollalength").on("click", function () {
            // update y scale domain
            y.domain([0, d3.max(data, function (d) {
                return d.Corolla_length + 0.1 * d.Corolla_length;
            })]);
            // update y axis name
            svg.select(".y.label")
                .transition()
                .duration(2000)
                .text("Corolla length (mm)")

            // vertical line
            vertLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    if (d.value.minCorolla > 0) {
                        return (y(d.value.minCorolla))
                    } else { // height here is the svg height!
                        return (height)
                    }

                })
                .attr("y2", function (d) {
                    return (y(d.value.maxCorolla))
                })


            // box
            box
                .transition()
                .duration(2000)
                .attr("y", function (d) {
                    return (y(d.value.q3Corolla))
                })
                .attr("height", function (d) {
                    return (y(d.value.q1Corolla) - y(d.value.q3Corolla))
                })
                .attr("width", boxWidth)


            // median line
            medianLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    return (y(d.value.medianCorolla))
                })
                .attr("y2", function (d) {
                    return (y(d.value.medianCorolla))
                })


            // circles
            circle
                .transition()
                .duration(2000)
                .attr("cx", function (d) {
                    return (x(d.Host) - jitterWidth / 2 + Math.random() * jitterWidth)
                })
                .attr("cy", function (d) {
                    return (y(d.Corolla_length));
                });
            // axis?
            svg.select(".y.axis")
                .transition()
                .duration(2000)
                .call(yAxis);
        });

        d3.select("#Daystoflower").on("click", function () {
            // update y scale domain
            y.domain([0, d3.max(data, function (d) {
                return d.Days_to_flower + 0.1 * d.Days_to_flower;
            })]);
            // update y axis name
            svg.select(".y.label")
                .transition()
                .duration(2000)
                .text("Number of days to flower")

            // vertical line
            vertLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    if (d.value.minDays > 0) {
                        return (y(d.value.minDays))
                    } else { // height here is the svg height!
                        return (height)
                    }

                })
                .attr("y2", function (d) {
                    return (y(d.value.maxDays))
                })


            // box
            box
                .transition()
                .duration(2000)
                .attr("y", function (d) {
                    return (y(d.value.q3Days))
                })
                .attr("height", function (d) {
                    return (y(d.value.q1Days) - y(d.value.q3Days))
                })
                .attr("width", boxWidth)


            // median line
            medianLine
                .transition()
                .duration(2000)
                .attr("y1", function (d) {
                    return (y(d.value.medianDays))
                })
                .attr("y2", function (d) {
                    return (y(d.value.medianDays))
                })


            // circles
            circle
                .transition()
                .duration(2000)
                .attr("cx", function (d) {
                    return (x(d.Host) - jitterWidth / 2 + Math.random() * jitterWidth)
                })
                .attr("cy", function (d) {
                    return (y(d.Days_to_flower));
                });
            // axis?
            svg.select(".y.axis")
                .transition()
                .duration(2000)
                .call(yAxis);
        });
    }
    createVisualisation();
})