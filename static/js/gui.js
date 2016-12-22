// Copyright (c) 2016 Pier Carlo Chiodi - https://www.pierky.com
// Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT

var graph_data = null;    // Used to build the graph. D3 modifies/adds some elements
                          // to build the graph.
var currOrigData = null;  // Contains the original graph_data used to build the graph.
                          // It's used to save the graph without the additional 
                          // properties added by d3.

var DEMO_MEASUREMENTS = [1674977, 1115418];
var SELECTED_DEMO_MEASUREMENT = 0

// Progress bar support
var request_id;
var tmrLoadingProgress;

// Traceroute details popover helpers
var traceroute_popover_cache = {};

function GUI_Error(s) {
  if(s) {
    $('#alert_div').html(s);
    $('#alert_div').show();
  } else {
    $('#alert_div').hide();
  }
}

function GUI_LoadingMsm(loading,status_id,cnt,done) {
  $('#load_msm_btn').prop('disabled',loading);
  $('#loadgraph_btn').prop('disabled',loading);
  $('#options_btn').prop('disabled',loading);
  $('#msminfo_btn').prop('disabled',loading);

  if( !$DEMO ) {
    $('#msmid').prop('disabled',loading);
    $('#apikey').prop('disabled',loading);
  }

  if(loading) {
    $('#help').hide();

    if( !status_id )
      $('#info_text').text('Loading measurement...');
    else {
      if( status_id=='init_cache' )
        $('#info_text').text('Initializing cache for IP addresses and IXPs info...');
      else
        $('#info_text').text('Analysing IP address ' + done + '/' + cnt + '...');
    }

    var perc;
    if( done > 0 )
      perc = ( done / cnt ) * 100;
    else
      perc = 0;
    perc = perc.toFixed(0);

    $('#progress_text').text(perc + '%')
    $('#progress').css("width", perc + "%").attr("aria-valuenow", perc);
    $('#progress_div').show();
    $('#info_div').show();
  } else {
    clearInterval(tmrLoadingProgress);
    $('#info_div').hide();
    $('#progress_div').hide();
  }
}

function GUI_UpdateProgress() {
  $.ajax({
    url: $SCRIPT_ROOT + '/getProgress',
    data: {'request_id':request_id},
    type: 'GET',
    success: function(d) {
      GUI_LoadingMsm(true, d['status'], d['cnt'], d['done']);
    }
  });
}

function GUI_DoSaveGraph() {
  svg
  .selectAll('g.gnode')
  .filter(function(d) { return d.fixed; })
  .each( function(d) {
    currOrigData.nodes[d.index].x = d.x;
    currOrigData.nodes[d.index].y = d.y;
    currOrigData.nodes[d.index].fixed = true;
  });

  svg.selectAll('g.gnode')
  .each( function(d) {
    currOrigData.nodes[d.index].color = d.color;
  });

  $('.popover').popover('hide');

  $('#loadgraphfromjson_btn').hide();
  $('#savepng_btn').show();

  $('#graphdata').val(JSON.stringify(currOrigData));
  GUI_ToggleSVG(false);
  $('#graphdata').focus()
  $('#graphdata').select();
}

function GUI_ToggleSVG(show_graph) {
  if( show_graph === undefined ) {
    $('#graphdataarea').toggle();
    if( svg )
      $('#svg').toggle();
  } else {
    if( show_graph ) {
      $('#graphdataarea').hide();
      if( svg ) {
        $('#svg').show();
      }
    } else {
      if( svg ) {
        $('#svg').hide();
      }
      $('#graphdataarea').show();
    }
  }
}

function GUI_DoCloseLoadGraph() {
  GUI_ToggleSVG(true);
}

function GUI_DoLoadGraph() {
  $('.popover').popover('hide');
  $('#loadgraphfromjson_btn').show();
  $('#savepng_btn').hide();
  GUI_ToggleSVG(false);
}

function GUI_DoLoadGraphFromText() {
  GUI_Error();
  try {
    graph_data = JSON.parse($('#graphdata').val());

    try {
      LoadGraph(true);
      GUI_ToggleSVG(true);
      $('#help').hide();
      $('#text_result').html('');
      $('#savegraph_btn').prop('disabled',false);
      $('#msminfo_btn').prop('disabled',false);
      $('#msmid').val(graph_data.MsmID);
    } catch(err) {
      GUI_Error('Error while building the graph: ' + err);
    }
  } catch(err) {
    GUI_Error('Error while reading JSON data: ' + err);
  }
}

function GUI_DoSavePNG() {
  // source: http://techslides.com/save-svg-as-an-image
  var html = d3.select("svg")
        .attr("version", 1.1)
        .attr("xmlns", "http://www.w3.org/2000/svg")
        .node().parentNode.innerHTML;

  var imgsrc = 'data:image/svg+xml;base64,'+ btoa(html);
  var img = '<img src="'+imgsrc+'">'; 
  d3.select("#svgdataurl").html(img);

  var canvas = document.getElementById("savepng_canvas"),
    context = canvas.getContext("2d");

  var image = new Image;
  image.src = imgsrc;
  image.onload = function() {
    context.drawImage(image, 0, 0);

    var canvasdata = canvas.toDataURL("image/png");

    var pngimg = '<img src="'+canvasdata+'">'; 
      d3.select("#pngdataurl").html(pngimg);

    var a = document.createElement("a");
    a.download = "Msm" + graph_data.MsmID + ".png";
    a.href = canvasdata;
    a.click();
  };
}

function GetIPDetails({ip_addresses, success, error}) {
  // get details about the IP addresses given in ip_addresses
  // on success: success(ip_details)
  // on failure: error(err_descr)

  var getIPDetailsURL;
  var getIPDetailsMethod;
  var getIPDetailsData;
  if( $DEMO ) {
    getIPDetailsURL = $SCRIPT_ROOT + '/static/demo_' + DEMO_MEASUREMENTS[SELECTED_DEMO_MEASUREMENT] + '_ip.json';
    getIPDetailsMethod = 'GET';
    getIPDetailsData = null;
  } else {
    getIPDetailsURL = $SCRIPT_ROOT + '/getIPDetails';
    getIPDetailsMethod = 'POST';
    getIPDetailsData = JSON.stringify({
      'ip_addresses': ip_addresses,
      'request_id': request_id
    });
  }

  $.ajax({
    url: getIPDetailsURL,
    data: getIPDetailsData,
    type: getIPDetailsMethod,
    contentType: 'application/json',
    error: function(jqXHR, textStatus, errorThrown) {
      if( error )
        error('An error occurred while retrieving IP addresses\' details. Ensure the backend webserver is reachable and no errors occurred server-side.');
    },
    success: function(ip_details) {
      if( 'error' in ip_details ) {
        if( error )
          error('An error occurred while retrieving IP addresses\' details. ' + ip_details['error']);
        return;
      }

      if( success )
        success(ip_details);
    }
  })
}

function GetMsmResults({msm_id, api_key, probe_id, success, error, completed}) {
  // on success: success(data, ip_addresses, ip_details)
  // on failure: error(err_descr)

  var url;
  url = 'https://atlas.ripe.net/api/v2/measurements/' + msm_id + '/latest/';

  if( probe_id )
    url += '?probe_ids=' + probe_id;

  $.ajax({
    url: url,
    data: {
      'key': api_key
    },
    dataType: 'jsonp',
    timeout: 30000,
    error: function() {
      if( error )
        error('An error occurred while retrieving measurement\'s result. Ensure either that the measurement is marked as public or that an authorised API key has been provided.');
      if( completed )
        completed();
    },
    success: function(data) {
      // build the list of all the IP addresses involved in the measurement

      var ip_addresses = [];

      var prb;
      for( prb in data ) {
        var prb_response = data[prb];

        if( prb_response['type'] != 'traceroute' ) {
          if( error )
            error('The given measurement is not for a traceroute.');
          if( completed )
            completed();
          return;
        }

        var ip_addr;
        
        // from
        ip_addr = prb_response['from'];
        if( ip_addr == '' ) {
          ip_addr = prb_response['src_addr'];
        }
        if( ip_addr != '' ) {
          if( ip_addresses.indexOf(ip_addr) < 0 ) {
            ip_addresses.push(ip_addr);
          }
        }

        // hops from
        var hop;
        var hop_result;
        if( 'result' in prb_response ) {
          for( hop in prb_response['result'] ) {
            if( 'result' in prb_response['result'][hop] ) {
              for( hop_result in prb_response['result'][hop]['result'] ) {
                if( 'from' in prb_response['result'][hop]['result'][hop_result] ) {
                  ip_addr = prb_response['result'][hop]['result'][hop_result]['from'];
                  if( ip_addr != '' ) {
                    if( ip_addresses.indexOf(ip_addr) < 0 ) {
                      ip_addresses.push(ip_addr);
                    }
                  }
                }
              }
            }
          }
        }

        // dest
        if( 'dst_addr' in prb_response ) {
          ip_addr = prb_response['dst_addr'];
          if( ip_addr != '' ) {
            if( ip_addresses.indexOf(ip_addr) < 0 ) {
              ip_addresses.push(ip_addr);
            }
          }
        }
      }

      GetIPDetails({
        ip_addresses: ip_addresses,
        success: function(ip_details) {
          if( success )
            success(data, ip_addresses, ip_details);
          if( completed )
            completed();
        },
        error: function(err_descr) {
          if( error )
            error(err_descr)
          if( completed )
            completed();
        }
      });
    }
  })
}

function GUI_DoLoadMsm() {
  "use strict";
  GUI_Error();

  var msm_id = $('#msmid').val();
  var api_key = $('#apikey').val();

  if( !msm_id || msm_id == '' ) {
    GUI_Error('Missing measurement ID.');
    return;
  }
  if( !/^\d+$/.test(msm_id) ) {
    GUI_Error('Invalid measurement ID.');
    return;
  }

  request_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });

  GUI_LoadingMsm(true);

  GetMsmResults({
    msm_id: msm_id,
    api_key: api_key,
    completed: function() {
      GUI_LoadingMsm(false);
    },
    error: function(err_descr) {
      GUI_Error(err_descr);
    },
    success: function(data, ip_addresses, ip_details) {
      var s = '';
      graph_data = new GraphData(msm_id);

      for( var prb in data ) {
        if( s != '' ) {
          s += '\n';
        }
        s += 'probe ' + data[prb]['prb_id'] + '\n';

        var prb_response = data[prb];
        var from_ip_addr = prb_response['from'];
        if( from_ip_addr == '' ) {
          from_ip_addr = prb_response['src_addr'];
        }
        if( from_ip_addr == '' ) {
          continue;
        }

        var dest_ip_addr = prb_response['dst_addr'];

        var asn;
        var curr_node;
        var last_node;
        var last_as;
        var last_probe;

        // source AS
        asn = ip_details[from_ip_addr].ASN;

        if( ! /^\d+$/.test(asn) ) {
          s += 'unknown ASN for source IP address ' + from_ip_addr + '\n';
          continue
        }

        curr_node = graph_data.addAS(asn);
        curr_node.Holder = ip_details[from_ip_addr].Holder;
        curr_node.ProbesFromThisAS += 1;

        s += 'from ' + from_ip_addr;
        if( ip_details[from_ip_addr].HostName && (ip_details[from_ip_addr].HostName != 'unknown') )
          s += ' [' + ip_details[from_ip_addr].HostName + ']';
        s += ' - AS' + asn + ' (' + curr_node.Holder + ')\n';

        last_as = curr_node;
        last_node = curr_node;
        last_probe = graph_data.addProbe(prb_response['prb_id'],asn);
        last_probe.Path.push(last_as.NodeIdx);

        if( 'result' in prb_response ) {

          // hops
          for( var hop in prb_response['result'] ) {
            if( 'result' in prb_response['result'][hop] ) {

              // packets
              for( var packet_idx = 0; packet_idx <= prb_response['result'][hop]['result'].length-1; packet_idx++ ) {
                s += ' hop ' + prb_response['result'][hop]['hop'] + ' pkt ' + (packet_idx+1) + ' ';

                if( 'from' in prb_response['result'][hop]['result'][packet_idx] ) {
                  var ip_addr = prb_response['result'][hop]['result'][packet_idx]['from'];
                  asn = ip_details[ip_addr].ASN;

                  if( ip_addr === dest_ip_addr ) {
                    last_probe.Completed = true;
                  }

                  s += ip_addr;
                  if( ip_details[ip_addr].HostName && (ip_details[ip_addr].HostName != 'unknown') )
                    s += ' [' + ip_details[ip_addr].HostName + ']';
                  s += ' - ';

                  if( 'rtt' in prb_response['result'][hop]['result'][packet_idx] ) {
                    s += prb_response['result'][hop]['result'][packet_idx]['rtt'].toFixed(2) + ' ms';
                  } else {
                    s += 'no RTT';
                  }

                  if( ip_details[ip_addr].IsIXP ) {
                    curr_node = graph_data.addIXP(ip_details[ip_addr].IXPName);

                    if( curr_node != last_node ) {
                      // only consider the first usable packet for each hop to determine new node
                      if( /^\d+$/.test(asn) )
                        curr_node.ASN = asn;
                      curr_node.ProbesGoingThroughThisNode += 1;
                      graph_data.addDataPath(last_node,curr_node);
                      last_node = curr_node;
                      last_probe.Path.push(curr_node.NodeIdx);
                    }

                    if( /^\d+$/.test(asn) )
                      s += ' - IXP ' + curr_node.IXPName + ' (AS' + asn +')\n'
                    else
                      s += ' - IXP ' + curr_node.IXPName + '\n';

                  } else if( /^\d+$/.test(asn) ) {
                    curr_node = graph_data.addAS(asn);

                    if( curr_node != last_node ) {
                      // only consider the first usable packet for each hop to determine new node
                      curr_node.Holder = ip_details[ip_addr].Holder;
                      curr_node.ProbesGoingThroughThisNode += 1;
                      graph_data.addDataPath(last_node,curr_node);
                      last_node = curr_node;
                      last_probe.Path.push(curr_node.NodeIdx);

                      if( curr_node != last_as ) {
                        graph_data.addASPath(last_as.ASN, curr_node.ASN);
                        last_as = curr_node;
                      }

                      s += ' - AS' + asn + ' (' + curr_node.Holder + ')\n';
                    } else {
                      s += ' - AS' + asn + '\n';
                    }
                  } else {
                    s += ' - ' + asn + '\n';
                  }
                } else {
                  if( 'x' in prb_response['result'][hop]['result'][packet_idx] ) {
                    s += 'timeout';
                  }
                  s += '\n';
                }
              }

            } else {
              if( 'error' in prb_response['result'][hop] ) {
                s += 'error: ' + prb_response['result'][hop]['error'] + '\n';
              }
            }
          }

          if( last_probe.Completed  ) {
            s += 'completed\n';

            var rtt_tot = 0;
            var rtt_cnt = 0;
            for( var packet_idx = 0; packet_idx <= prb_response['result'][hop]['result'].length-1; packet_idx++ ) {
              if( 'from' in prb_response['result'][hop]['result'][packet_idx] ) {
                var ip_addr = prb_response['result'][hop]['result'][packet_idx]['from'];

                if( ip_addr === dest_ip_addr ) {
                  if( 'rtt' in prb_response['result'][hop]['result'][packet_idx] ) {
                    rtt_tot += prb_response['result'][hop]['result'][packet_idx]['rtt'];
                    rtt_cnt++;
                  }
                  break;
                }
              }
            }
            if( rtt_cnt > 0 ) {
              last_probe.RTT = ( rtt_tot / rtt_cnt );
            }
          }
        }

        // target ASN
        if( dest_ip_addr && dest_ip_addr in ip_details ) {
          asn = ip_details[dest_ip_addr].ASN;

          if( graph_data.indexOfASN(asn) >= 0 ) {
            graph_data.nodes[graph_data.indexOfASN(asn)].TargetAS = true;
          }
        }
      }

      graph_data.nodes.forEach(function(n){
        if( n.NodeType == 'AS' ) {
          if( graph_data.getBestPathTowardATarget(n.ASN,[],1) ) {
            n.Isolated = false;
          }
        }
      });

      $('#text_result').html( s.replace(/(?:\r\n|\r|\n)/g, '<br/>') );
      LoadGraph(false);
      GUI_ToggleProbes();

      $('#savegraph_btn').prop('disabled',false);
      $('#msminfo_btn').prop('disabled',false);
    }
  });

  if( !$DEMO )
    tmrLoadingProgress = setInterval( GUI_UpdateProgress, 3000 );
}

function GUI_ToggleProbes() {
  var show_probes = options.indexOf('show_prbs') >= 0;
  if(show_probes) {
    $('.ProbeLink').show();
    $('.Probe').show();
  } else {
    $('.ProbeLink').hide();
    $('.Probe').hide();
  }
}

function GUI_DoCloseMsmInfo() {
  $('#msminfo_div').hide();
}

function GUI_WriteMsmInfo(data) {
  function AddDef(lbl,txt) {
    $('#msminfo_dl').append('<dt>' + lbl + ':</dt><dd>' + txt + '</dd>');
  }

  $('#msminfo_dl').empty();

  AddDef( 'Measurement ID', data['id'] );

  if( 'description' in data )
    AddDef( 'Description', data['description'] );

  AddDef( 'Address family', 'IPv' + data['af']);

  if( 'target' in data ) {
    AddDef( 'Target name', data['target'] );

    if( 'resolve_on_probe' in data ) {
      AddDef( 'Resolve on probe', data['resolve_on_probe'] ? 'Yes' : 'No' );
    }
  }

  if( 'target_ip' in data ) {
    AddDef( 'Target IP address', data['target_ip'] );
  }

  if( 'participant_count' in data ) {
    AddDef( 'Participant', data['participant_count']);
  }
}

function GUI_MsmInfo() {
  if( $('#msminfo_div').is(':visible') ) {
    $('#msminfo_div').hide();
    return;
  }

  var msm_id = graph_data.MsmID;
  if(!msm_id) {
    GUI_Error('Measurement ID not provided yet.');
    return;
  }

  if( graph_data.MsmInfo ) {
    GUI_WriteMsmInfo(graph_data.MsmInfo);
    $('#msminfo_div').show();
  } else {

    $('#msminfo_btn').prop('disabled',true);

    $.ajax({
      url: 'https://atlas.ripe.net/api/v2/measurements/' + msm_id + '/',
      dataType: 'jsonp',
      timeout: 15000,
      error: function() {
        GUI_Error('An error occurred while retrieving measurement\'s info. Ensure either that the measurement is marked as public or that an authorised API key has been provided.');
        $('#msminfo_btn').prop('disabled',false);
      },
      success: function(data) {
        graph_data.MsmInfo = data;
        GUI_WriteMsmInfo(data);
        $('#msminfo_div').show();
        $('#msminfo_btn').prop('disabled',false);
      }
    });
  }
}

function GUI_PrepareDemoMsm(idx) {
  SELECTED_DEMO_MEASUREMENT = idx;

  msm_id = DEMO_MEASUREMENTS[SELECTED_DEMO_MEASUREMENT];

  $('#msmid').val(msm_id);
  $.ajax({
    url: $SCRIPT_ROOT + '/static/demo_' + msm_id + '_graph.json',
    contentType: 'application/json',
    success: function(data) {
      $('#graphdata').val(JSON.stringify(data));
    }
  });
}

$( document ).ready(function() {
  if( $DEMO ) {
    $('#msmid').prop('disabled',true);
    $('#apikey').val('');
    $('#apikey').prop('disabled',true);
 
    $('.demomsgs').show();

    $('.demomsm_radiobnt').on('click', function(event) {
      var $target = $(event.currentTarget);
      GUI_PrepareDemoMsm($target.val());
    });

    GUI_PrepareDemoMsm(0);
  }

  $('#curr_release').html($CURRENT_RELEASE);

  rtt_colors.concat({ color: rtt_colors_nodata, lbl: 'No Data'}).forEach(function(e){
    var lbl = e.lbl ? e.lbl : '&lt; ' + e.rtt + ' ms';
    $('#rtt_colors').append('<span class="label label-primary" style="background-color: ' + e.color + '">' + lbl + '</span> ');
  });

  options.push('show_prbs');
  $('#opt_show_prbs').find('input').prop('checked', true);

  $('.dropdown-menu a').on( 'click', function( event ) {
    var $target = $( event.currentTarget ),
      val = $target.attr( 'data-value' ),
      $inp = $target.find( 'input' ),
      idx;

    if ( ( idx = options.indexOf( val ) ) > -1 ) {
      options.splice( idx, 1 );
      setTimeout( function() { $inp.prop( 'checked', false ) }, 0);
    } else {
      options.push( val );
      setTimeout( function() { $inp.prop( 'checked', true ) }, 0);
    }

    $( event.target ).blur();
    
    if( options.indexOf('show_text') >= 0 ) {
      $('#text_div').show();
    } else {
      $('#text_div').hide();
    }

    GUI_ToggleProbes();

    return false;
  });

  if( $CHECKUPDATES_ENABLE ) {
    setTimeout( function() {
      CheckNewRelease( {
        current_release: $CURRENT_RELEASE,
        owner: 'pierky',
        repo: 'ripeatlastracepath',
        include_pre_releases: $CHECKUPDATES_PRERELEASE,
        check_interval: $CHECKUPDATES_INTERVAL,

        done: function( Results ) {
          if( Results['new_release_found'] ) {
            var NewReleaseTitle = '';
            NewReleaseTitle += Results['new_release']['version'];
            if( Results['new_release']['name'] != '' ) {
              NewReleaseTitle += ' - ' + Results['new_release']['name'];
            }
            NewReleaseTitle += '\n';
            NewReleaseTitle += Results['new_release']['published_at'];

            if( Results['new_release']['prerelease'] ) {
              NewReleaseTitle += '\n';
              NewReleaseTitle += 'pre-release';
            }
            
            $('#newrelease').attr( 'href', Results['new_release']['url'] );
            $('#newrelease').attr( 'title', NewReleaseTitle );
            $('#newrelease').show();
          }
        },
        error: function( ErrMsg ) {
          console.log( 'Error while checking for updates: ' + ErrMsg );
        }
      } );
    }, 1000 );
  }

  if( ! $DEMO ) {
    try {
      var msmID = getParameterByName('msmid');
      if( msmID ) {
        if( /^\d+$/.test(msmID) ) {
          $('#msmid').val(msmID);
          GUI_DoLoadMsm();
        }
      }
    } catch(e) {
    }
  }
});

// stolen from http://stackoverflow.com/a/5158301
function getParameterByName(name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function GetPopoverContent(msm_id, probe_id, success, error, completed) {
  var cached_content = traceroute_popover_cache[msm_id + '_' + probe_id];
  if( cached_content ) {
    success(cached_content);
    completed();
    return;
  }
  
  GetMsmResults({
    msm_id: msm_id,
    api_key: $('#apikey').val(),
    probe_id: probe_id,
    error: function(err_descr) {
      error(err_descr);
      completed();
    },
    success: function(data, ip_addresses, ip_details) {
      var renderResource = function(resource, title) {
        return "<a class='label label-success' target='_blank' " +
          "href='https://stat.ripe.net/" + resource + "' " +
          "title='" + (title || "Open " + resource + " in RIPEstat") + "'>" + resource +
          "</a>";
      }

      var renderIPAddr = function(ip_addr) {
        return '<span>' + renderResource(ip_addr) + '</span>';
      }

      var renderHostName = function(hostname) {
        return '<span class="label label-primary">' + hostname + '</span>';
      }

      var renderASN = function(asn, holder) {
          return '<span>' + renderResource('AS' + asn, holder) + '</span>'
      }

      var renderIXP = function(ixp_name) {
        return '<span class="label label-info">' + ixp_name + '</span>'
      }

      var renderHopAddr = function(ip_addr) {
        var s = '';

        s += renderIPAddr(ip_addr);

        if( ip_details[ip_addr].HostName && (ip_details[ip_addr].HostName != 'unknown') )
          s += ' ' + renderHostName(ip_details[ip_addr].HostName);

        var asn = ip_details[ip_addr].ASN;
        if( /^\d+$/.test(asn) )
          s += ' ' + renderASN(asn, ip_details[ip_addr].Holder);

        if( ip_details[ip_addr].IsIXP )
          s += ' ' + renderIXP(ip_details[ip_addr].IXPName);

        return s;
      }

      data = data[0];

      var s = '';

      // header

      var from_addr;
      if( data.hasOwnProperty("from") )
        from_addr = data["from"];
      if( !from_addr && data.hasOwnProperty("src_addr") )
        from_addr = data["src_addr"];

      s += "<p class='small'>";
      s += "Traceroute";
      if( from_addr ) {
        s += " from " + renderHopAddr(from_addr);
      }

      var to_dst;
      if( data.hasOwnProperty("dst_name") ) {
        to_dst = renderHostName(data["dst_name"]);
      }
      if( data.hasOwnProperty("dst_addr") ) {
        if( !to_dst )
          to_dst = renderIPAddr(data["dst_addr"]);
        else if( data["dst_name"] != data["dst_addr"] ) {
          to_dst += ' (' + renderIPAddr(data["dst_addr"]) + ')'
        }
      }

      if( to_dst )
        s += " to " + to_dst;

      s += "</p>";

      if( !from_addr && !to_dst )
        s = "";

      // replies

      data.result.forEach(function(hop) {
        s += '<div class="small">';

        s += '<span style="font-family:monospace;">' + 
          ('   ' + hop.hop).substr(-3).replace(' ', '&nbsp;') + 
          ' </span> ';

        if (hop.hasOwnProperty("error")){
          s += '<span class="label label-danger">!' + hop.error + '</span> '
        } else {

          var hop_addresses = [];
          hop.result.forEach(function(reply, replyIndex) {
            if (reply.hasOwnProperty("late")) {return}
            if (reply.hasOwnProperty("from")) {
              if (hop_addresses.indexOf(reply.from) >= 0) {delete reply["from"]}
              else {
                ip_addr = reply.from;

                hop_addresses.push(ip_addr);

                s += renderHopAddr(ip_addr);
                s += ' ';
              }
            }
            if (reply.hasOwnProperty("rtt"))
              s += '<span class="label label-primary">' + (Math.round(reply.rtt * 1000) / 1000) + " ms</span> ";
            if (reply.hasOwnProperty("err"))
              s += '<span class="label label-danger">!' + reply.err + '</span> ';
            if (reply.x == "*")
              s += '<span class="label label-default">*</span> ';
          });
        }
        s += '</div>';
      }); // data.result.forEach(function(hop)

      traceroute_popover_cache[msm_id + '_' + probe_id] = s;
      success(s);
      completed();
    } // success
  });
}

function CreatePopover(div_id, title, content) {
  var pop = $('#' + div_id).popover({
    container: 'body',
    content: content,
    html: true,
    //placement: 'auto left',
    title: title,
    trigger: 'manual'
  }).on('shown.bs.popover', function () {
    var $popup = $(this);
    $('#close_' + div_id).click(function (e) {
      $popup.popover('hide');
    });
    var popover_id = $popup.attr('aria-describedby');
    $('#' + popover_id).draggable({handle: $('#' + popover_id + ' .popover-title')});
  });
  pop.on('show.bs.popover', function () {
    pop.data("bs.popover").tip().css({"max-width": "600px"});
  });
}

function GUI_ShowTraceroute(probe_id, clientX, clientY) {
  var msm_id = graph_data.MsmID;
  var div_id = 'traceroute_' + msm_id + '_' + probe_id;

  $("body").css("cursor", "progress");

  var title = 'Traceroute from probe ID ' + probe_id +
              '<button type="button" class="close" id="close_' + div_id + '">&times;</button>';

  var content;
  GetPopoverContent(msm_id, probe_id, function(html){
    // success
    content = html;
  }, function(err_descr) {
    // error
    content = err_descr;
  }, function() {
    // completed
    $("body").css("cursor", "default");
    if( $('#' + div_id).length == 0 ) {
      $('body').append('<div class="traceroute_details" id="' + div_id + '"></div>');

      CreatePopover(div_id, title, content);
    }
    $('#' + div_id).css({top: clientY, left: clientX}).show();
    $('#' + div_id).popover("show");
  });
}
