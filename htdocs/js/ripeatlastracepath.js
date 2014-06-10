		var tip = $("#tip").hide();
		var tipText = "";
		var over = false;

		var renderer;
		var maxProbesCount = 0;
		var mouseHovered = false;
		var mouseHoveredTimeout = null;

		var data = {};

		var g = new Graph();

		function DoSaveGraph() {
			for ( n in data.Nodes ) 
			{
				data.Nodes[n].Left = $('ellipse#' + data.Nodes[n].ASN).position().left;
				data.Nodes[n].Top = $('ellipse#' + data.Nodes[n].ASN).position().top;
			}
			$('#graphdata').text( JSON.stringify(data) ); $('#graphdataarea').show();
			console.log(data);
		}

		function addTip(shape, node, txt){

			$(shape).mouseenter(function(e){
				tipText = txt;

				if( node.ProbesCount > 0 ) {
					tipText += ' - ' + node.ProbesCount + ' probes';
				}

				node.TipText = tipText;

				$(shape).bind("mousemove", function(e) {
					tip.css("left", e.pageX+20).css("top", e.pageY+20);
				});

				if( mouseHoveredTimeout == null ) {
					mouseHoveredTimeout = setTimeout( function() {
						tip.text(tipText);
						tip.fadeIn();
						mouseHovered = true;
					}, 200 )
				}
			});

			$(shape).mouseleave(function(){
				$(shape).unbind("mousemove");

				if( mouseHovered ) {
					tip.fadeOut(200);
					mouseHovered = true;
				}

				if( mouseHoveredTimeout != null ) {
					clearTimeout(mouseHoveredTimeout);
					mouseHoveredTimeout = null;
				}
			});

		}

		function DoLoadGraph() {
			for( n in data.Nodes ) {
				g.addNode( data.Nodes[n].ASN );
				g.nodes[ data.Nodes[n].ASN ].ProbesCount = 0;
			}
			for( e in data.Edges ) {
				g.addEdge( data.Edges[e].A, data.Edges[e].B );
				g.nodes[ data.Edges[e].A ].ProbesCount += data.Edges[e].ProbesCount;
			}

			var layouter = new Graph.Layout.Spring(g);

			layouter.layout();

			$('#canvas').height( screen.height - 100 );
			renderer = new Graph.Renderer.Raphael('canvas', g, $('#canvas').width(), $('#canvas').height());

			renderer.draw();

			for( n in data.Nodes ) {
				addTip( $('ellipse#' + data.Nodes[n].ASN ), g.nodes[data.Nodes[n].ASN], data.Nodes[n].Holder );
				if ( ( data.Nodes[n].Left ) && ( data.Nodes[n].Top ) ) {
					console.log('Ok');
					$('ellipse#' + data.Nodes[n].ASN ).position( { left: data.Nodes[n].Left, top: data.Nodes[n].Top } );
				}
			}

			renderer.draw();

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
				}
			}

			$('#canvas').show();
		}

		function DoShowLoadGraph() {
			$('#graphdataarea').show();
		}

		function DoLoadGraphFromText() {
			data = $.parseJSON( $('#graphdata').val() );
			DoLoadGraph();
		}
