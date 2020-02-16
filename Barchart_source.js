
          var w = 800;
          var h = 500;
          var barPadding = 1;

          var dataset = [5,10,15,20,25,30,35,40,45,50,55,60];
        // create the svg element before the closing body tag
          var svg = d3.select("body").append("svg")
                      .attr("width", w)
                      .attr("height", h);

          var rects = svg.selectAll("rect")
                            .data(dataset)
                            .enter()
                            .append("rect");

          rects.attr("x", function(d,i){
            return i*(w/dataset.length)
          })
                .attr("y", function(d){
                  return (h - d*4);
                })
                .attr("width", w/dataset.length - barPadding)
                .attr("height", function(d){
                  return d*4;
                })
                .attr("fill", function(d, i){
                  return "rgb(" + 128*(i) + "," + i*d + "," +  Math.round(d*2) + ")"; 
                });
           svg.selectAll("text")
              .data(dataset)
              .enter()     
              .append("text")
              .text(function(d){
                return d;
              })
              .attr("x", function(d,i){
                return i*(w/dataset.length) + (w/dataset.length-barPadding)/2;
              })
              .attr("y", function(d){
                return h-(d*4) - 15;
              })
              .attr("font-size", "20px")
              .attr("text-anchor", "right");

