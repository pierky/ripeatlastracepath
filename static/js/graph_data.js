// Copyright (c) 2017 Pier Carlo Chiodi - https://www.pierky.com
// Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT

// nodes
function Node(nodeType,nodeID) {
  this.NodeType = nodeType;
  this.NodeID = nodeID;
  this.NodeIdx = null; // idx of GraphData.nodes, populated by GraphData.addNode
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

function Probe(prb_id) {
  Node.call(this, 'Probe', prb_id);
  this.ProbeID = prb_id;
  this.SourceASN = null;
  this.Completed = false;
  this.RTT = null;
  this.Path = []; // list of index of GraphData.nodes traversed by probe to reach the target
}
Probe.prototype = Object.create(Node.prototype);
Probe.prototype.constructor = Probe;

// links
function Link(linkType) {
  this.LinkType = linkType;
}

function ASPath(asn_a,asn_b) {
  this.LinkType = 'ASPath';
  this.Source_ASN = asn_a;
  this.Target_ASN = asn_b;
}

function DataPath() {
  this.LinkType = 'DataPath';
  this.source = null; // idx of GraphData.nodes, needed by d3
  this.target = null; // idx of GraphData.nodes, needed by d3
}

function ProbeLink() {
  this.LinkType = 'ProbeLink';
  this.source = null; // idx of GraphData.nodes, needed by d3
  this.target = null; // idx of GraphData.nodes, needed by d3
}

// graph data
function GraphData(MsmID) {
  this.MsmID = MsmID;
  this.MsmInfo = null;
  this.nodes = [];    // used by d3
  this.links = [];    // used by d3
  this.as_paths = []; // used only internally to build path between probes and target

  // nodes

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

  this.indexOfNode = function(node) {
    return this.indexOf(node.NodeID, node.constructor);
  }

  this.indexOfASN = function(asn) {
    return this.indexOf(asn, AS);
  }

  this.indexOfProbe = function(prb_id) {
    return this.indexOf(prb_id, Probe);
  }

  this.get = function(node_id, node_class) {
    var existing_idx = this.indexOf(node_id, node_class);
    if( existing_idx >= 0 )
      return this.nodes[existing_idx];
    return null;
  }

  this.getAS = function(asn) {
    return this.get(asn, AS);
  }

  this.addNode = function(node_id, node_class) {
    var existing = this.get(node_id, node_class);
    if( existing )
      return existing;

    var newNode = new node_class(node_id);
    this.nodes.push(newNode);
    newNode.NodeIdx = this.nodes.length - 1;
    return newNode;
  }

  this.addAS = function(asn) {
    return this.addNode(asn, AS);
  }

  this.addIXP = function(name) {
    return this.addNode(name, IXP);
  }

  this.addProbe = function(prb_id,probe_asn) {
    var existing_idx = this.indexOfProbe(prb_id);
    if( existing_idx >= 0 )
      throw "Probe ID " + prb_id + " already exists";

    var newProbe = this.addNode(prb_id, Probe);
    newProbe.SourceASN = probe_asn;

    var newLink = new ProbeLink();

    newLink.source = newProbe.NodeIdx;

    newLink.target = this.indexOfASN(probe_asn);
    if( newLink.target < 0 )
      throw "Can't add the probe: probe's ASN not found (" + probe_asn + ")";

    this.links.push(newLink);
    return newProbe;
  }

  // AS paths, used only to build path between probes and target

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

  // links between nodes

  this.addDataPath = function(node_a,node_b) {
    var newLink = new DataPath();

    newLink.source = this.indexOfNode(node_a);
    if( newLink.source < 0 )
      throw "Can't add the path: source node not found";

    newLink.target = this.indexOfNode(node_b);
    if( newLink.target < 0 )
      throw "Can't add the path: target node not found";

    this.links.push(newLink);
    return newLink;
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


