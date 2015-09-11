# Copyright (c) 2015 Pier Carlo Chiodi - http://www.pierky.com
# Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT

from flask import Flask, request, jsonify, render_template
from ipdetailscache import IPDetailsCache
import os
from config import *

CURRENT_RELEASE = "v0.3.1"

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
                         CHECKUPDATES_PRERELEASE=CHECKUPDATES_PRERELEASE)

@ripeatlastracepathapp.route('/getIPDetails', methods=['POST'])
def getIPDetails():
  result = {}

  global cache
  global requests

  var = "%s/var" % BASE_DIR

  if not cache:
    try:
      cache = IPDetailsCache(MAX_CACHE = 604800, Debug = DEBUG,
                             IP_ADDRESSES_CACHE_FILE="%s/ip_addr.cache" % var,
                             IP_PREFIXES_CACHE_FILE="%s/ip_pref.cache" % var)
    except:
      return jsonify({"error":"Can't load IP addresses cache files; "
                              "please ensure they have proper r/w "
                              "permissions for the running process."})

  ip_addresses = request.json['ip_addresses']
  request_id = request.json['request_id']

  requests[request_id] = {}
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
    return jsonify({'cnt':0,'done':0})

if __name__ == '__main__':
  ripeatlastracepathapp.debug = DEBUG
  ripeatlastracepathapp.run(host="0.0.0.0",threaded=True)
