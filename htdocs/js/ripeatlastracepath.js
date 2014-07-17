		var tipText = "";
		var over = false;

		var maxProbesCount = 0;
		var mouseHovered = false;
		var mouseHoveredTimeout = null;

		var data = {};

		function DoSaveGraph() {
			for ( n in data.Nodes ) 
			{
				data.Nodes[n].Left = $('ellipse#' + data.Nodes[n].ASN).position().left;
				data.Nodes[n].Top = $('ellipse#' + data.Nodes[n].ASN).position().top;
			}
			$('#graphdata').val( JSON.stringify(data) );
			$('#graphdatatext').text('Copy the following JSON data and save as you wish.');
			$('#graphdataarea').show();
		}

		function addTip(shape, node, txt){

			$(shape).mouseenter(function(e){
				tipText = txt;

				if( node.ProbesCount > 0 ) {
					tipText += ' - ';
					if( node.ProbesCount == node.TransitOnly_ProbesCount ) {
						tipText += node.TransitOnly_ProbesCount + ' probes, transit only';
					} else {
						tipText += node.ProbesCount + ' probes';
						if( node.TransitOnly_ProbesCount > 0 ) {
							tipText += ' (' + node.TransitOnly_ProbesCount + ' transit only)';
						}
					}
				}

				node.TipText = tipText;

				$(shape).bind("mousemove", function(e) {
					$('#tip').css("left", e.pageX+20).css("top", e.pageY+20);
				});

				if( mouseHoveredTimeout == null ) {
					mouseHoveredTimeout = setTimeout( function() {
						$('#tip').text(tipText);
						$('#tip').fadeIn();
						mouseHovered = true;
					}, 200 )
				}
			});

			$(shape).mouseleave(function(){
				$(shape).unbind("mousemove");

				if( mouseHovered ) {
					$('#tip').fadeOut(200);
					mouseHovered = true;
				}

				if( mouseHoveredTimeout != null ) {
					clearTimeout(mouseHoveredTimeout);
					mouseHoveredTimeout = null;
				}
			});

		}

		function DoLoadGraph() {
			var renderer;
			var g = new Graph();

			$('#canvas').empty();
			$('#canvas').show();

			for( n in data.Nodes ) {
				g.addNode( data.Nodes[n].ASN );
				g.nodes[ data.Nodes[n].ASN ].ProbesCount = 0;
				g.nodes[ data.Nodes[n].ASN ].TransitOnly_ProbesCount = 0;
			}
			for( e in data.Edges ) {
				g.addEdge( data.Edges[e].A, data.Edges[e].B, { directed: true } );
				g.nodes[ data.Edges[e].A ].ProbesCount += data.Edges[e].ProbesCount;
				g.nodes[ data.Edges[e].B ].TransitOnly_ProbesCount += data.Edges[e].ProbesCount;
			}

			var layouter = new Graph.Layout.Spring(g);

			layouter.layout();

			$('#canvas').height( screen.height - 100 );
			renderer = new Graph.Renderer.Raphael('canvas', g, $('#canvas').width(), $('#canvas').height());

			renderer.draw();

			var nodeLeft;
			var nodeTop;
			var nodeWidth;
			var nodeHeight;
			var wantedLeft;
			var wantedTop;
			var translateX;
			var translateY;
			var bRedrawEdges = false;

			for( n in data.Nodes ) {
				addTip( $('ellipse#' + data.Nodes[n].ASN ), g.nodes[data.Nodes[n].ASN], data.Nodes[n].Holder );

				if ( ( data.Nodes[n].Left ) && ( data.Nodes[n].Top ) ) {
					bRedrawEdges = true;

					nodeLeft = g.nodes[data.Nodes[n].ASN].point[0];
					nodeTop = g.nodes[data.Nodes[n].ASN].point[1];
					nodeWidth = g.nodes[data.Nodes[n].ASN].shape.getBBox().width;
					nodeHeight = g.nodes[data.Nodes[n].ASN].shape.getBBox().height;
					wantedLeft = data.Nodes[n].Left;
					wantedTop = data.Nodes[n].Top;

					translateX = wantedLeft - nodeLeft + ( nodeWidth / 2 );
					translateY = wantedTop - nodeTop + ( nodeHeight / 2 );

					g.nodes[data.Nodes[n].ASN].shape.translate( translateX, translateY );
				}
			}

			if( bRedrawEdges ) {
				for (var i in g.edges) {
					g.edges[i].connection.draw();
				}
			}

			for ( n in g.nodes ) {
				if ( g.nodes[n].ProbesCount > maxProbesCount ) {
					maxProbesCount = g.nodes[n].ProbesCount;
				}
			}

			var strokeWidth = 0;
			var strokeStep = Math.round( maxProbesCount / 4 );

			for( n in g.nodes ) {
				if( g.nodes[n].ProbesCount >= 1 ) {
					if ( g.nodes[n].ProbesCount == 1 ) {
						strokeWidth = 1;
					} else if ( g.nodes[n].ProbesCount >= maxProbesCount - strokeStep ) {
						strokeWidth = 5
					} else {
						strokeWidth = Math.floor( g.nodes[n].ProbesCount / strokeStep ) + 2;
					}
					$('ellipse#' + n).css('strokeWidth', strokeWidth + 'px');

					if( g.nodes[n].ProbesCount == g.nodes[n].TransitOnly_ProbesCount ) {
						$('ellipse#' + n).css('stroke-dasharray','5,5');
					}
				}
			}

			$('#savegraphbutton').removeAttr('disabled');
		}

		function DoShowLoadGraph() {
			$('#graphdataarea').show();
			$('#graphdatatext').text('Paste JSON data previously saved here, then click on the "Load graph from JSON above" button.');
		}

		function DoLoadGraphFromText() {
			data = $.parseJSON( $('#graphdata').val() );
			DoLoadGraph();
		}
