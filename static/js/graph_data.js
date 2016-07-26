// nodes
function Node(nodeType,nodeID) {
  this.NodeType = nodeType;
  this.NodeID = nodeID;
}

function TransitNode(nodeType,nodeID) {
  Node.call(this,nodeType,nodeID);
  this.ProbesGoingThroughThisNode = 0;
}
TransitNode.prototype = Object.create(Node);
TransitNode.prototype.constructor = Node;

function AS(asn) {
  TransitNode.call(this, 'AS', asn);
  this.ASN = asn;
  this.Holder = null;
  this.ProbesFromThisAS = 0;
  this.Isolated = true;
  this.TargetAS = false;
  this.BestPathTowardATarget = null;
}
AS.prototype = Object.create(TransitNode.prototype);
AS.prototype.constructor = AS;

function IXP(name) {
  TransitNode.call(this, 'IXP', name);
  this.IXPName = name;
  this.ASN = null;
}
IXP.prototype = Object.create(TransitNode.prototype);
IXP.prototype.constructor = IXP;

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
  this.source = null; // idx of GraphData.nodes
  this.target = null; // idx of GraphData.nodes
}

function ASPath(asn_a,asn_b) {
  Link.call(this,'AS');

  this.Source_ASN = asn_a;
  this.Target_ASN = asn_b;
}
ASPath.prototype = Object.create(Link.prototype);
ASPath.prototype.constructor = ASPath;

function ProbeLink() {
  Link.call(this,'ProbeLink');
}
ProbeLink.prototype = Object.create(Link.prototype);
ProbeLink.prototype.constructor = ProbeLink();

function GraphData(MsmID) {
  this.MsmID = MsmID;
  this.MsmInfo = null;
  this.nodes = [];
  this.links = [];
  this.as_paths = [];

  this.indexOf = function(node_id, node_class) {
    for(var n = 0; n <= this.nodes.length-1; n++) {
      if(this.nodes[n] instanceof node_class) {
        if(this.nodes[n].NodeID===node_id) {
          return n;
        }
      }
    }
    return -1;
  }

  this.indexOfASN = function(asn) {
    return this.indexOf(asn, AS);
  }

  this.indexOfProbe = function(prb_id) {
    return this.indexOf(prb_id, Probe);
  }

  this.indexOfIXP = function(name) {
    return this.indexOf(name, IXP);
  }

  this.indexOfNode = function(node) {
    return this.indexOf(node.NodeID, node.constructor);
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

  this.getIXP = function(name) {
    var idx = this.indexOfIXP(name);
    if( idx >= 0 ) {
      return this.nodes[idx];
    }
    var newIXP = new IXP(name);
    this.nodes.push(newIXP);
    return newIXP;
  }

  this.indexOfASPath = function(asn_a,asn_b) {
    for(var l = 0; l <= this.as_paths.length-1; l++) {
      if(this.as_paths[l].Source_ASN===asn_a && this.as_paths[l].Target_ASN===asn_b) {
        return l;
      }
    }
    return -1;
  }

  this.addASPath = function(asn_a,asn_b) {
    var idx = this.indexOfASPath(asn_a,asn_b);
    if( idx >= 0 ) {
      return this.as_paths[idx];
    }

    var newASPath = new ASPath(asn_a,asn_b);
    newASPath.source = this.indexOfASN(asn_a);
    if( newASPath.source < 0 ) {
      throw "Can't add the path: source ASN not found (" + asn_a + ")";
    }
    newASPath.target = this.indexOfASN(asn_b);
    if( newASPath.target < 0 ) {
      throw "Can't add the path: target ASN not found (" + asn_b + ")";
    }
    this.as_paths.push(newASPath);
    return newASPath;
  }

  this.addDataPath = function(node_a,node_b) {
    var idx_a = this.indexOfNode(node_a);
    if( idx_a < 0 ) {
      throw "Can't add the path: source node not found";
    }

    var idx_b = this.indexOfNode(node_b);
    if( idx_b < 0 ) {
      throw "Can't add the path: target node not found";
    }

    var newLink = new Link('DataPath');
    newLink.source = idx_a;
    newLink.target = idx_b;
    
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

  this.getBestPathTowardATarget = function(asn,exclude_list,depth) {
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
    for( var as_path_idx = 0; as_path_idx <= this.as_paths.length-1; as_path_idx++ ) {
      var l = this.as_paths[as_path_idx];
      if( l.Source_ASN == asn ) {
        if( new_exclude_list.indexOf(l.Target_ASN) < 0 ) {
          paths.push( [asn].concat( this.getBestPathTowardATarget(l.Target_ASN,new_exclude_list,depth+1) ) );
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


