// nodes
function Node(nodeType,nodeID) {
  this.NodeType = nodeType;
  this.NodeID = nodeType + nodeID;
}

function AS(asn) {
  Node.call(this, 'AS', asn);
  this.ASN = asn;
  this.Holder = null;
  this.ProbesFromThisAS = 0;
  this.ProbesGoingThroughThisAS = 0;
  this.Isolated = true;
  this.TargetAS = false;
  this.BestPathTowardATarget = null;
}
AS.prototype = Object.create(Node.prototype);
AS.prototype.constructor = AS;

function Probe(prb_id,source_asn) {
  Node.call(this, 'Probe', prb_id);
  this.ProbeID = prb_id;
  this.SourceASN = source_asn;
  this.Completed = false;
  this.RTT = null;
}
Probe.prototype = Object.create(Node.prototype);
Probe.prototype.constructor = Probe;

// links
function Link(linkType) {
  this.LinkType = linkType;
  this.source = null;
  this.target = null;
}

function ASPath(asn_a,asn_b) {
  Link.call(this,'AS');

  this.Source_ASN = asn_a;
  this.Target_ASN = asn_b;
}
ASPath.prototype = Object.create(Link.prototype);
ASPath.prototype.constructor = ASPath;

function ProbeLink() {
  Link.call(this,'Probe');
}
ProbeLink.prototype = Object.create(Link.prototype);
ProbeLink.prototype.constructor = ProbeLink();

function GraphData(MsmID) {
  this.MsmID = MsmID;
  this.MsmInfo = null;
  this.nodes = [];
  this.links = [];

  this.indexOfASN = function(asn) {
    for(var n = 0; n <= this.nodes.length-1; n++) {
      if(this.nodes[n] instanceof AS) {
        if(this.nodes[n].ASN===asn) {
          return n;
        }
      }
    }
    return -1;
  }

  this.indexOfProbe = function(prb_id) {
    for(var n = 0; n <= this.nodes.length-1; n++) {
      if(this.nodes[n] instanceof Probe) {
        if(this.nodes[n].ProbeID===prb_id) {
          return n;
        }
      }
    }
    return -1;
  }

  this.getAS = function(asn) {
    var idx = this.indexOfASN(asn);
    if( idx >= 0 ) {
      return this.nodes[idx];
    }
    var newAS = new AS(asn);
    this.nodes.push(newAS);
    return newAS;
  }

  this.indexOfASPath = function(asn_a,asn_b) {
    for(var l = 0; l <= this.links.length-1; l++) {
      if(this.links[l] instanceof ASPath) {
        if(this.links[l].Source_ASN===asn_a && this.links[l].Target_ASN===asn_b) {
          return l;
        }
      }
    }
    return -1;
  }

  this.addASPath = function(asn_a,asn_b) {
    var idx = this.indexOfASPath(asn_a,asn_b);
    if( idx >= 0 ) {
      return this.links[idx];
    }

    var newLink = new ASPath(asn_a,asn_b);
    newLink.source = this.indexOfASN(asn_a);
    if( newLink.source < 0 ) {
      throw "Can't add the path: source ASN not found (" + asn_a + ")";
    }
    newLink.target = this.indexOfASN(asn_b);
    if( newLink.target < 0 ) {
      throw "Can't add the path: target ASN not found (" + asn_b + ")";
    }
    this.links.push(newLink);
    return newLink;
  }

  this.addProbe = function(prb_id,probe_asn) {
    var asn_idx = this.indexOfASN(probe_asn);
    if( asn_idx < 0 ) {
      throw "Can't add the probe: probe's ASN not found (" + probe_asn + ")";
    }

    var probe_idx = this.indexOfProbe(prb_id);
    if( probe_idx >= 0 ) {
      if( this.nodes[probe_idx].SourceASN != probe_asn) {
        throw "Probe ID " + prb_id + " already exists but on a different source ASN (" + this.nodes[probe_idx].SourceASN + ")";
      }
      return this.nodes[probe_idx];
    }

    var newProbe = new Probe(prb_id,probe_asn);
    this.nodes.push(newProbe);
    var newLink = new ProbeLink();
    newLink.source = this.indexOfProbe(prb_id);
    newLink.target = this.indexOfASN(probe_asn);
    this.links.push(newLink);
    return newProbe;
  }

  this.getASBestPathTowardATarget = function(asn,exclude_list,depth) {
    if( depth > 100 ) throw 'Too much, maybe something went wrong.';

    var asn_idx = this.indexOfASN(asn);
    if( asn_idx < 0 ) throw 'ASN not found: ' + asn + '.';

    if( this.nodes[asn_idx].BestPathTowardATarget ) {
      return this.nodes[asn_idx].BestPathTowardATarget;
    }

    if( this.nodes[asn_idx].TargetAS ) {
      this.nodes[asn_idx].BestPathTowardATarget = [asn];
      return [asn];
    }

    var paths = [];
    var new_exclude_list = exclude_list.concat(asn);
    for( var link_idx = 0; link_idx <= this.links.length-1; link_idx++ ) {
      var l = this.links[link_idx];
      if( l.LinkType == 'AS' ) {
        if( l.Source_ASN == asn ) {
          if( new_exclude_list.indexOf(l.Target_ASN) < 0 ) {
            paths.push( [asn].concat( this.getASBestPathTowardATarget(l.Target_ASN,new_exclude_list,depth+1) ) );
          }
        }
      }
    }

    var path;
    paths.forEach(function(p) {
      if( p.indexOf(undefined) < 0 ) {
        if( !path ) {
          path = p
        } else {
          if( p.length < path.length ) {
            path = p;
          }
        }
      }
    });
    this.nodes[asn_idx].BestPathTowardATarget = path;
    return path;
  }
}


