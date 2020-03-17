// a script which takes the WildCommon.csv file and creates interactive
// means and standard errors. Four traits are visualised, though more could be added.

// Load the csv
var Data = d3.csv('dats/Wildcommon.csv',
  function (d) {
    return {
      // + turns to numeric!
      Species: d.Species, // Euphrasia species
      E4E: d.E4E, // Euphrasia population
      Trait: d.Trait, // trait of interest (4)
      Cmean: +d.Cmean, // mean in the common garden
      Csem: +d.Csem, // standard error common garden
      Wmean: +d.Wmean, // mean in the 'wild'
      Wsem: +d.Wsem // standard error in 'wild'
    }
  })

Data.then(function (data) {
  // margins for the plot
  var margin = {
    top: 10,
    right: 50,
    bottom: 50,
    left: 50
  }
  var width = 1000 - margin.left - margin.right
  var height = 600 - margin.top - margin.bottom

  // create the svg element (put in .row!)
  var svg = d3.select('.row3')
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform',
      'translate(' + margin.left + ',' + margin.top + ')')

  // create the x-axis
  // wild goes on x
  var x = d3.scaleLinear()
    .domain([d3.min(data, function (d) {
      return d.Wmean - d.Wmean * 0.1
    }), d3.max(data, function (d) {
      return d.Wmean + d.Wmean * 0.1
    })])
    .range([0, width])

  // call x scale xAxis to update later
  var xAxis = d3.axisBottom().scale(x)

  svg.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .attr('class', 'x axis')
    .call(xAxis)

  // text label for the x axis
  svg.append('text')
    .attr('class', 'x label')
    .attr('transform', 'translate(' + (width / 2) + ' ,' + (height + margin.top + 36) + ')')
    .style('text-anchor', 'middle')
    .text('Nodes to flower (wild collected)')

  // create the y-axis
  var y = d3.scaleLinear()
    .domain([d3.min(data, function (d) {
      return d.Cmean - d.Cmean * 0.1
    }), d3.max(data, function (d) {
      return d.Cmean + d.Cmean * 0.1
    })])
    .range([height, 0])

  // call y scale yAxis to update later
  var yAxis = d3.axisLeft().scale(y)

  svg.append('g')
    .attr('class', 'y axis')
    .call(yAxis)

  // text label for the y axis
  svg.append('text')
    .attr('class', 'y label')
    .attr('transform', 'rotate(-90)')
    .attr('y', 0 - margin.left)
    .attr('x', 0 - (height / 2))
    .attr('dy', '1em')
    .style('text-anchor', 'middle')
    .text('Nodes to flower (common garden)')

  // colour data points by taxon
  var colour = d3.scaleOrdinal(d3.schemeTableau10).domain(function (d) {
    return d.Species
  })
    .range(d3.schemeTableau10)

  // add the error bars
  var errory = svg.selectAll('errory')
    .data(data.filter(function (d) {
      if (d.Trait === 'Nodes') {
        return d
      }
    }))
  var uerrory = errory
    .enter()
    .append('line')
    .attr('class', 'errory')
    .merge(errory)
    .attr('x1', function (d) {
      return (x(d.Cmean))
    })
    .attr('x2', function (d) {
      return (x(d.Cmean))
    })
    .attr('y1', function (d) {
      return (y(d.Wmean - d.Wsem))
    })
    .attr('y2', function (d) {
      return (y(d.Wmean + d.Wsem))
    })
    .attr('stroke', 'black')
    .attr('stroke-width', 2)
    .style('width', 40)

  var errorx = svg.selectAll('errorx')
    .data(data.filter(function (d) {
      if (d.Trait === 'Nodes') {
        return d
      }
    }))
  var uerrorx = errorx
    .enter()
    .append('line')
    .attr('class', 'errorx')
    .merge(errorx)
    .attr('y1', function (d) {
      return (y(d.Wmean))
    })
    .attr('y2', function (d) {
      return (y(d.Wmean))
    })
    .attr('x1', function (d) {
      return (x(d.Cmean - d.Csem))
    })
    .attr('x2', function (d) {
      return (x(d.Cmean + d.Csem))
    })
    .attr('stroke', 'black')
    .attr('stroke-width', 2)
    .style('width', 40)

  // add the points
  var circle = svg.selectAll('circle')
    .data(data.filter(function (d) {
      if (d.Trait === 'Nodes') {
        return d
      }
    }))
    .enter()
    .append('circle')
    .attr('cx', function (d) {
      return (x(d.Cmean))
    })
    .attr('cy', function (d) {
      return (y(d.Wmean))
    })
    .attr('r', 10)
    .style('fill', function (d, i) {
      return colour(d.Species)
    })
    .attr('stroke', 'black')
    .attr('stroke-width', '1.3')

  // Draw legend
  var legend = svg.selectAll('.legend')
    .data(d3.map(data, function(d){return d.Species;}).keys())
    .enter().append('g')
    .attr('class', 'legend')
    .attr('transform', function (d, i) { return 'translate(0,' + i * 19 + ')' })

  legend.append('rect')
    .attr('x', width - 890)
    .attr('width', 18)
    .attr('height', 18)
    .style('fill', function (d) {
      return colour(d)
    })

  legend.append('text')
    .attr('x', width - 870)
    .attr('y', 9)
    .attr('dy', '.35em')
    .style('text-anchor', 'start')
    .text(function (d, i) {
      switch (i) {
        case 0: return 'Euphrasia anglica x Euphrasia nemorosa'
        case 1: return 'Euphrasia anglica x Euphrasia rostkoviana'
        case 2: return 'Euphrasia arctica'
        case 3: return 'Euphrasia arctica x Euphrasia confusa'
        case 4: return 'Euphrasia arctica x Euphrasia nemorosa'
        case 5: return 'Euphrasia confusa'
        case 6: return 'Euphrasia confusa x Euphrasia nemorosa'
        case 7: return 'Euphrasia confusa x Euphrasia tetraquetra'
        case 8: return 'Euphrasia nemorosa'
        case 9: return 'Euphrasia pseudokerneri'
      }
    })
    .attr('font-size', "12px")

  /// /////////
  /// // UPDATES /////
  /// ////////
  // when I get the element e.g. Nodes3, do this function
  // define function to take trait
  var click = function (Trait, datatrait) {
    d3.select(Trait).on('click', function () {
      if (Trait === '#Corolla3') {
        var x_label = 'Corolla length (mm; wild collected)'
        var y_label = 'Corolla length (mm; common garden)'
        var BUFFERX = 0.2
        var BUFFERY = 0.2
      } else if (Trait === '#Nodes3') {
        var x_label = 'Nodes to flower (wild collected)'
        var y_label = 'Nodes to flower (common garden)'
        var BUFFERX = 0.2
        var BUFFERY = 0.2
      } else if (Trait === '#Teeth3') {
        var x_label = 'Number of leaf teeth (wild collected)'
        var y_label = 'Number of leaf teeth (common garden)'
        var BUFFERX = 0.2
        var BUFFERY = 0.4
      } else if (Trait === '#Internode3') {
        var x_label = 'Cauline:Internode length ratio (wild collected)'
        var y_label = 'Cauline:Internode length ratio (common garden)'
        var BUFFERX = 0.3
        var BUFFERY = 0.7
      }
      // update x axis scale
      x.domain([d3.min(data.filter(function (d) {
        return d.Trait === datatrait
      }), function (d) {
        return d.Cmean - BUFFERX * d.Cmean
      }), d3.max(data.filter(function (d) {
        return d.Trait === datatrait
      }), function (d) {
        return d.Cmean + BUFFERX * d.Cmean
      })])
      // update x axis name
      svg.select('.x.label')
        .transition()
        .duration(1000)
        .text(x_label)

      svg.select('.x.axis')
        .transition()
        .duration(1000)
        .call(xAxis)
      // update y axis scale
      y.domain([0, d3.max(data.filter(function (d) {
        return d.Trait === datatrait
      }), function (d) {
        return d.Wmean + BUFFERY * d.Wmean
      })])
      // update y axis name
      svg.select('.y.label')
        .transition()
        .duration(1000)
        .text(y_label)

      svg.select('.y.axis')
        .transition()
        .duration(1000)
        .call(yAxis)

      // update error y
      uerrory
        .data(data.filter(function (d) {
          return d.Trait === datatrait
        }))
        .transition()
        .duration(2000)
        .attr('x1', function (d) {
          return (x(d.Cmean))
        })
        .attr('x2', function (d) {
          return (x(d.Cmean))
        })
        .attr('y1', function (d) {
          return (y(d.Wmean - d.Wsem))
        })
        .attr('y2', function (d) {
          return (y(d.Wmean + d.Wsem))
        })

      // update error x
      uerrorx
        .data(data.filter(function (d) {
          return d.Trait === datatrait
        }))
        .transition()
        .duration(2000)
        .attr('x1', function (d) {
          return (x(d.Cmean - d.Csem))
        })
        .attr('x2', function (d) {
          return (x(d.Cmean + d.Csem))
        })
        .attr('y1', function (d) {
          return (y(d.Wmean))
        })
        .attr('y2', function (d) {
          return (y(d.Wmean))
        })

      // update circles.
      circle
        .data(data.filter(function (d) {
          return d.Trait === datatrait
        }))
        .transition()
        .duration(2000)
        .attr('cx', function (d) {
          return (x(d.Cmean))
        })
        .attr('cy', function (d) {
          return (y(d.Wmean))
        })
    })
  }
  document.getElementById('Nodes3').onclick = click('#Nodes3', 'Nodes')
  document.getElementById('Corolla3').onclick = click('#Corolla3', 'Corolla')
  document.getElementById('Teeth3').onclick = click('#Teeth3', 'Teeth')
  document.getElementById('Internode3').onclick = click('#Internode3', 'Internode')
})
