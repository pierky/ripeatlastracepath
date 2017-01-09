# Copyright (c) 2017 Pier Carlo Chiodi - https://www.pierky.com
# Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT

from flask import Flask, request, jsonify, render_template
from pierky.ipdetailscache import IPDetailsCache
import os
import codecs
from config import *

CURRENT_RELEASE = "v0.5.0"

if "SERVERSIDE_SAVE_ENABLE" not in locals():
    # To have a backward compatible behaviour with <= v0.5.0,
    # where this configuration knob was not present, the
    # default value used when the variable is missing is False
    # while the default value in the distributed config file is
    # True.
    SERVERSIDE_SAVE_ENABLE=False

ripeatlastracepathapp = Flask(__name__)

requests = {}

cache = None

@ripeatlastracepathapp.route('/')
def main():
  if not CONFIG_DONE:
    return "Configuration not completed! " \
           "Edit config.py, configure the program and, finally, " \
           "set CONFIG_DONE = True."

  return render_template("index.html",
                         CURRENT_RELEASE=CURRENT_RELEASE,
                         CHECKUPDATES_ENABLE=CHECKUPDATES_ENABLE,
                         CHECKUPDATES_INTERVAL=CHECKUPDATES_INTERVAL,
                         CHECKUPDATES_PRERELEASE=CHECKUPDATES_PRERELEASE,
                         SERVERSIDE_SAVE_ENABLE=SERVERSIDE_SAVE_ENABLE)

@ripeatlastracepathapp.route('/getIPDetails', methods=['POST'])
def getIPDetails():
  result = {}

  global cache
  global requests

  ip_addresses = request.json['ip_addresses']
  request_id = request.json['request_id']

  requests[request_id] = {}
  requests[request_id]['status'] = 'init_cache'

  var = "%s/var" % BASE_DIR

  if not cache:
    try:
      cache = IPDetailsCache(MAX_CACHE=604800, Debug=DEBUG,
                             IP_ADDRESSES_CACHE_FILE="%s/ip_addr.cache" % var,
                             IP_PREFIXES_CACHE_FILE="%s/ip_pref.cache" % var)
      cache.UseIXPs(WhenUse=2, IXP_CACHE_FILE="%s/ixps.cache" % var,
                    MAX_CACHE=604800)
    except:
      return jsonify({"error":"Can't load IP addresses cache files; "
                              "please ensure they have proper r/w "
                              "permissions for the running process."})

  requests[request_id]['status'] = 'fetching_ip_info'
  requests[request_id]['cnt'] = len(ip_addresses)
  requests[request_id]['done'] = 0

  for ip in ip_addresses:
    details = cache.GetIPInformation(ip)
    result[ip] = details
    requests[request_id]['done'] = requests[request_id]['done'] + 1

  return jsonify(result)

@ripeatlastracepathapp.route('/getProgress')
def getProgress():
  global requests
  request_id = request.args['request_id']
  if request_id in requests:
    return jsonify(requests[request_id])
  else:
    return jsonify({'status':'init_cache', 'cnt':0,'done':0})

def mk_graphs_dir():
    if not os.path.exists("%s/graphs" % VAR_DIR):
        os.makedirs("%s/graphs" % VAR_DIR)

def validate_graph_filename(s):
    if not s:
        return False

    VALID = '-_.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    for c in s:
        if c not in VALID:
            return False
    return True

@ripeatlastracepathapp.route('/listGraphs')
def listGraphs():
    if not SERVERSIDE_SAVE_ENABLE:
        return jsonify({"error": "Server side saving not enabled."})

    try:
        mk_graphs_dir()
        files = [f for f in os.listdir("%s/graphs" % VAR_DIR)
                if os.path.isfile("%s/graphs/%s" % (VAR_DIR, f))]
        return jsonify({"error": "", "files": files})
    except Exception as e:
        return jsonify({"error": "Can't list graphs: %s" % str(e)})

@ripeatlastracepathapp.route('/saveGraph', methods=['POST'])
def saveGraph():
    if not SERVERSIDE_SAVE_ENABLE:
        return jsonify({"error": "Server side saving not enabled."})

    name = request.json['name']
    data = request.json['data']
    overwrite = request.json['overwrite']

    if not validate_graph_filename(name):
        return jsonify({"error": "Invalid file name"})

    if os.path.isfile("%s/graphs/%s" % (VAR_DIR, name)):
        if not overwrite:
            return jsonify({"error": "", "ask_overwrite": True})

    try:
        mk_graphs_dir()
        with codecs.open("%s/graphs/%s" % (VAR_DIR, name), "w", "utf-8") as f:
            f.write(data)
        return jsonify({"error": ""})
    except Exception as e:
        return jsonify({"error": "Can't save graph: %s" % str(e)})

@ripeatlastracepathapp.route('/loadGraph')
def loadGraph():
    if not SERVERSIDE_SAVE_ENABLE:
        return jsonify({"error": "Server side saving not enabled."})

    name = request.args['name']

    if not validate_graph_filename(name):
        return jsonify({"error": "Invalid file name"})

    try:
        mk_graphs_dir()
        with codecs.open("%s/graphs/%s" % (VAR_DIR, name), "r", "utf-8") as f:
            data = f.read()
        return jsonify({"error": "", "data": data})
    except Exception as e:
        return jsonify({"error": "Can't load graph: %s" % str(e)})

if __name__ == '__main__':
  ripeatlastracepathapp.debug = DEBUG
  ripeatlastracepathapp.run(host="0.0.0.0",threaded=True)
