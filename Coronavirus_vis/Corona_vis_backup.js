// visualise the number of corona cases per county
// split for each country
// add an all for each country option

const parseDate = d3.timeParse("%Y-%m-%d");
const formatDate = d3.timeFormat("%d %B %Y");

var Data = d3.csv("https://tom-e-white.com/covid-19-uk-data/data/covid-19-cases-uk.csv", function (d) {
    return {
        date: parseDate(d.Date),
        country: d.Country,
        areaCode: d.AreaCode,
        area: d.Area,
        cases: +d.TotalCases // TODO: how to handle old data of form "1 to 4"
    }
})

Data.then(function (data) {
    data = data.filter(d => d.area !== 'Awaiting confirmation')
        .filter(d => d.area !== 'To be confirmed')
        .filter(d => d.area !== 'awaiting clarification')
        .filter(d => d.area !== 'Cornwall')
        .filter(d => d.area !== 'Bournemouth')
        .filter(d => d.area !== 'Poole')
        .filter(d => d.area !== 'Isles of Scilly')
        .filter(d => d.area !== 'City of London')
        .filter(d => d.area !== 'Hackney');

    //
    console.log(data)
    // margins for the plot
    var margin = {
        top: 10,
        right: 50,
        bottom: 50,
        left: 50
    }
    var width = 1000 - margin.left - margin.right
    var height = 600 - margin.top - margin.bottom

    // group data

    var groupdata = d3.map(data, function (d) {
        return d.area;
    }).keys()

    console.log(groupdata)
    const maxCases = d3.max(data, d => d.cases);
    const latestDate = d3.max(data, d => d.date);

    const xScale = d3.scaleTime()
        .domain([
            d3.min(data, d => d.date),
            d3.max(data, d => d.date)
         ])
        .range([0, width])

    const yScale = d3.scaleLinear()
        .domain([0, maxCases])
        .range([height, 0]);

    // add the options to the button
    d3.select("#selectButton")
        .selectAll('myOptions')
        .data(groupdata)
        .enter()
        .append('option')
        .text(function (d) {
            return (d);
        }) // text showed in the menu
        .attr("value", function (d) {
            return d;
        }) // corresponding value returned by the button

    const svg = d3.select("#coronavis")
        .append("svg")
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform',
            'translate(' + margin.left + ',' + margin.top + ')')

    // add x scale to bottom
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));

    // add y scale to left side
    svg.append("g")
        .call(d3.axisLeft(yScale));

    // add line (first in list)
    // Initialize line with first group of the list
    var line = svg.append('g')
        .append("path")
        .datum(data.filter(function (d) {
            return d.area == groupdata[0]
        }))
        .attr("d", d3.line()
            .x(function (d) {
                return xScale(d.date)
            })
            .y(function (d) {
                return yScale(d.cases)
            })
        )
        .attr("stroke", "black")
        .style("stroke-width", 4)
        .style("fill", "none")
    
    
    // A function that update the chart
    function update(selectedGroup) {

      // Create new data with the selection?
      var dataFilter = data.filter(function(d){return d.area==selectedGroup})

      // Give these new data to update line
      line
          .datum(dataFilter)
          .transition()
          .duration(2000)
          .attr("d", d3.line()
            .defined(d => !isNaN(d.cases))
            .x(function(d) { return xScale(d.date) })
            .y(function(d) { return yScale(d.cases) })
          )
    }

    // When the button is changed, run the updateChart function
    d3.select("#selectButton").on("change", function(d) {
        // recover the option that has been chosen
        var selectedOption = d3.select(this).property("value")
        // run the updateChart function with this selected option
        update(selectedOption)
    })


});
