<script type="text/javascript" src="./d3/d3.js"></script>

d3.csv("", function(d) {
    return {
        Host: d.Host,
        Mean: parseFloat(d.Mean),
        SEM: parseFloat(d.SEM)
          };
        }, function(error, data){
            if(error){
              console.log(error);
            } else {
              console.log(data);
            }
          });