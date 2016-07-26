var RADIUS = 10;
var svg = null;
var force = null;
var shiftKey;
var rtt_colors = [
  { rtt: 10, color:'#338e5c' },
  { rtt: 20, color:'#669d52' },
  { rtt: 30, color:'#99ac48' },
  { rtt: 40, color:'#ccbb3d' },
  { rtt: 50, color:'#ffca33' },
  { rtt: 100, color:'#e2a433' },
  { rtt: 200, color:'#c57e32' },
  { rtt: 300, color:'#a95832' },
  { rtt: 1000000, color:'#8c3232', lbl: '&gt; 300 ms' }
];
var rtt_colors_nodata = '#bbbbbb';
var options = [];

function LoadGraph() {
  currOrigData = JSON.parse(JSON.stringify(graph_data));

  GUI_ToggleSVG(true);
  
  if(svg) {
    svg.remove();
  }

  var width = window.innerWidth - 50,
    height = window.innerHeight - $('#header').outerHeight(true) - $('#footer').outerHeight(true) - 10;

  $('#savepng_canvas').remove();
  $('body').append('<canvas id="savepng_canvas" width="' + width + '" height="' + height + '" style="display:none"></canvas>');

  var colors = d3.scale.category20();

  svg = d3.select("body")
    .attr("tabindex", 1)
    .on("keydown.brush", keydown)
    .on("keyup.brush", keyup)
    .each(function() { this.focus(); })
    .select("#graph_div")
    .append("svg")
      .attr("id", "svg")
      .attr("width", width)
      .attr("height", height);
  svg.append("svg:defs")
    .append("svg:marker")
      .attr("id", "arrow")
      .attr("refX", 40)
      .attr("refY", 0)
      .attr("viewBox", "0 -5 10 10")
      .attr("fill", "#eee")
      .attr("markerWidth", RADIUS)
      .attr("markerHeight", RADIUS)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("orient", "auto")
      .append("svg:path")
        .attr("d", "M0,-5 L10,0 L0,5");

  var link = svg.append("g")
    .attr("class", "link")
    .style("fill", "none")
    .style("stroke", "#eee")
    .selectAll("line");

  var brush = svg.append("g")
    .datum(function() { return {selected: false, previouslySelected: false}; })
    .attr("class", "brush");

  link = link.data(graph_data.links).enter().append("line")
    .attr("class", function(d) {
      return d.LinkType;
    })
    .attr("marker-end", function(d) {
      if( d.LinkType === 'DataPath' ) {
        return "url(#arrow)";
      } else {
        return null;
      }
    })
    .attr("x1", function(d) { return d.source.x; })
    .attr("y1", function(d) { return d.source.y; })
    .attr("x2", function(d) { return d.target.x; })
    .attr("y2", function(d) { return d.target.y; });

  brush.call(d3.svg.brush()
    .x(d3.scale.identity().domain([0, width]))
    .y(d3.scale.identity().domain([0, height]))
    .on("brushstart", function(d) {
      gnode.each(function(d) { d.previouslySelected = shiftKey && d.selected; });
    })
    .on("brush", function() {
      var extent = d3.event.target.extent();
      gnode.classed("selected", function(d) {
        return d.selected = d.previouslySelected ^
          (extent[0][0] <= d.x && d.x < extent[1][0]
          && extent[0][1] <= d.y && d.y < extent[1][1]);
      });
    })
    .on("brushend", function() {
      d3.event.target.clear();
      d3.select(this).call(d3.event.target);
    }));

  force = d3.layout.force()
    .charge(function(d){
      if( d.NodeType == 'AS' ) {
        if (d.TargetAS) {
          return -500;
        }
        if (d.ProbesGoingThroughThisNode > 0) {
          return -100 * d.ProbesGoingThroughThisNode;
        }
        return 1;
      } else if( d.NodeType == 'IXP' ) {
        if (d.ProbesGoingThroughThisNode > 0) {
          return -100 * d.ProbesGoingThroughThisNode;
        }
        return 1;
      } else {
        return -120;
      }
    })
    .nodes(graph_data.nodes)
    .links(graph_data.links)
    .size([width, height])
    .start();

  var gnode = svg.selectAll('g.gnode').data(graph_data.nodes).enter().append("g")
    .attr("class","gnode")
    .classed("AS", function(d) { return d.NodeType === 'AS' })
    .classed("IXP", function(d) { return d.NodeType === 'IXP' })
    .classed("Probe", function(d) { return d.NodeType === 'Probe' })
    .on("mousedown", function(d) {
      if (!d.selected) { // Don't deselect on shift-drag.
        if (!shiftKey) {
          gnode.classed("selected", function(p){
            return p.selected = d === p;
          });
        } else {
          d3.select(this).classed("selected", d.selected = true);
        }
      }
    })
    .on("mouseup", function(d) {
      if (d.selected && shiftKey) d3.select(this).classed("selected", d.selected = false);
    })
    .on("dblclick", function(d) {
      gnode
        .filter(function(d) { return d.selected; })
        .each(function(d) {
          d.fixed = false;
        })

    })
    .call(d3.behavior.drag()
      .on("dragstart", function(d1) {
        gnode.filter(function(d) { return d.selected; })
        .each(function(d) { d.fixed |= 2; })
      })
      .on("drag", function(d1) {
        gnode
          .filter(function(d) { return d.selected; })
          .each(function(d) {
            d.fixed = true;

            d.x += d3.event.dx;
            d.y += d3.event.dy;

            d.px += d3.event.dx;
            d.py += d3.event.dy;
          })

        force.resume();
      })
      .on("dragend", function(d) {
        gnode
          .filter(function(d) { return d.selected; })
          .each(function(d) { d.fixed &= ~6; })
      })
    );

  var maxProbesCount = 0;
  graph_data.nodes.forEach( function(d) {
    if( d.NodeType == 'AS' || d.NodeType == 'IXP' ) {
      var ProbesCount = Math.max(d.ProbesFromThisAS, d.ProbesGoingThroughThisNode);
      if( ProbesCount > maxProbesCount ) maxProbesCount = ProbesCount;
    }
  });

  var node = gnode.append("circle")
    .attr("id", function(d) { return 'node' + d.NodeType + d.NodeID; })
    .attr("r", function(d) {
      if(d.NodeType == 'Probe') {
        d.radius = 5;
      } else if(d.NodeType == 'AS' && d.TargetAS ) {
        d.radius = RADIUS * 2;
      } else {
        var ProbesCount;
        if( d.NodeType == 'AS' )
          ProbesCount = Math.max(d.ProbesFromThisAS, d.ProbesGoingThroughThisNode)
        else
          ProbesCount = d.ProbesGoingThroughThisNode;

        d.radius = 0;

        if( ProbesCount == 1 ) {
          d.radius = RADIUS;
        } else if ( ProbesCount >= maxProbesCount ) {
          d.radius = RADIUS * 2;
        } else {
          d.radius = RADIUS + Math.floor( RADIUS / maxProbesCount * ProbesCount );
        }
      }

      return d.radius;
    })
    .style("stroke-width", "1px")
    .style("stroke-dasharray", function(d) {
      if(d.NodeType == 'Probe') { return null }

      if(d.NodeType == 'IXP') {
        if( d.ProbesGoingThroughThisNode > 0 )
          return '5,5';
      }

      if(d.NodeType == 'AS') {
        if( d.ProbesFromThisAS == 0 && d.ProbesGoingThroughThisNode > 0 )
          return '5,5';
      }

      return null;
    })
    .style("stroke", function(d,i) {
      if(d.NodeType == 'AS' || d.NodeType == 'IXP') {
        if(!('color' in d)) {
          d.color = colors(i);
        }
        return d3.rgb(d.color).darker().toString();
      }
    }) 
    .style("fill", function(d,i) {
      if('color' in d) {
        return d.color;
      }

      if(d.NodeType == 'AS' || d.NodeType == 'IXP') {
        d.color = colors(i);
      } else {
        d.color = rtt_colors_nodata;

        if( d.Completed ) {
          if( d.RTT ) {
            var rtt_color = rtt_colors.filter(function(e) { return d.RTT <= e.rtt });
            if( rtt_color.length > 0 ) {
              d.color = rtt_color[0].color;
            }
          }
        }
      }
      return d.color;
    });

  gnode.append("title")
  .text(function(d) {
      var s;

      if(d.NodeType == 'Probe') {
        s = 'Probe ID ' + d.ProbeID + '\n';
        if( d.Completed ) {
          s += 'Path completed';
          if( d.RTT ) {
            s += ' - avg RTT: ' + d.RTT.toFixed(2)
          }
        } else {
          s += 'Path NOT completed';
        }

      } else if (d.NodeType == 'IXP') {
        s = 'IXP ' + d.IXPName;

        if( d.ASN )
          s = s + '\n' + 'AS' + d.ASN;

        if( d.ProbesGoingThroughThisNode > 0 ) {
          s = s + '\n' + d.ProbesGoingThroughThisNode + ' probes transit through this IXP';
        }
      } else {

        s = d.ASN + ' - ' + d.Holder;
        if( d.ProbesFromThisAS == 0 && d.ProbesGoingThroughThisNode > 0 ) {
          s = s + '\nno probes from this AS, transit only';
        }
        if( d.ProbesFromThisAS > 0 ) {
          s = s + '\n' + d.ProbesFromThisAS + ' probes from this AS';
        }
        if( d.ProbesGoingThroughThisNode > 0 ) {
          s = s + '\n' + d.ProbesGoingThroughThisNode + ' probes transit through this AS';
        }
        if( d.TargetAS ) {
          s = s + '\nTarget AS';
        }
        if( d.Isolated ) {
          s = s + '\nIsolated: no probes have paths toward target AS';
        }
      }

      return s;
    });

  svg.selectAll(".AS").append("text")
    .text(function(d) {
      if(d.NodeType == 'AS') { return d.ASN }
      return null;
    })
    .attr("y", function(d) { return d.radius+10 } )
    .style("text-anchor", "middle")
    .style("font-weight", function(d){
      if( d.NodeType == 'AS' && d.TargetAS ) return "bold";
    })
    .style("font-size","10px");

  svg.selectAll(".IXP").append("text")
    .text(function(d) {
      if(d.NodeType == 'IXP') { return d.IXPName }
      return null;
    })
    .attr("y", function(d) { return d.radius+10 } )
    .style("text-anchor", "middle")
    .style("font-size","10px");

  force.on("tick", function tick() {
      link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

      gnode.attr("transform", function(d) {return 'translate(' + [d.x, d.y] + ')';});

  });

  GroupIsolatedNodes();
}

function GroupIsolatedNodes() {
  var isolatedNodesX = $('#svg').width() - ( 2*RADIUS ) - 50;
  var isolatedNodesY = RADIUS + 10;
  force.nodes().forEach( function(d) {
    if( d.NodeType === 'AS' && d.Isolated ){
      if( isolatedNodesY + ( 2*RADIUS ) + 10 > $('#svg').height() ) {
        isolatedNodesY = RADIUS + 10;
        isolatedNodesX = isolatedNodesX - ( 4*RADIUS )
      }
      d.fixed = true;
      d.x = isolatedNodesX;
      d.px = d.x;
      d.y = isolatedNodesY;
      d.py = d.y;
      isolatedNodesY = isolatedNodesY + ( 4*RADIUS ) + 20;
    }
  });
  force.tick();
}

function keydown() {
  shiftKey = d3.event.shiftKey || d3.event.metaKey;
}

function keyup() {
  shiftKey = d3.event.shiftKey || d3.event.metaKey;
}


