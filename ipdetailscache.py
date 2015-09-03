# Copyright (c) 2014 Pier Carlo Chiodi - http://www.pierky.com
# Licensed under The MIT License (MIT) - http://opensource.org/licenses/MIT
#
# The MIT License (MIT)
# =====================
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#
# Part of this work is based on Google Python IP address manipulation library
# (https://code.google.com/p/ipaddr-py/).

"""A Python library to gather IP address details (ASN, prefix, resource holder, reverse DNS) using the 
RIPEStat API, with a basic cache to avoid flood of requests and to enhance performance."""

__version__ = "0.1"

# Usage
# =====
#
# Import the library, then setup a cache object and use it to gather IP address details.
# The cache object will automatically load and save data to the local cache files.
#
# Optionally, the cache object may be instantiated with the following arguments:
#  - IP_ADDRESSES_CACHE_FILE, path to the file where IP addresses cache will be stored (default: "ip_addr.cache");
#  - IP_PREFIXES_CACHE_FILE, path to the file where IP prefixes cache will be stored (default: "ip_pref.cache");
#  - MAX_CACHE, expiration time for cache entries, in seconds (default: 604800, 1 week);
#  - Debug, set to True to enable some debug messages (default: False).
#
# Results are given in a dictionary containing the following keys: ASN, Holder, Prefix, HostName, TS (time stamp).
#
# Hostname is obtained using the local socket.getfqdn function.
#
# import ipdetailscache
# cache = ipdetailscache.IPDetailsCache( IP_ADDRESSES_CACHE_FILE = "ip_addr.cache", IP_PREFIXES_CACHE_FILE = "ip_pref.cache", MAX_CACHE = 604800, Debug = False );
# result = cache.GetIPInformation( "IP_ADDRESS" )
#
# Example
# =======
#
# :~# python
# Python 2.7.2+ (default, Jul 20 2012, 22:15:08)
# [GCC 4.6.1] on linux2
# Type "help", "copyright", "credits" or "license" for more information.
# >>> import ipdetailscache
# >>> cache = ipdetailscache.IPDetailsCache();
# >>> result = cache.GetIPInformation( "193.0.6.139" )
# >>> result
# {u'Prefix': u'193.0.0.0/21', u'HostName': u'www.ripe.net', u'Holder': u'RIPE-NCC-AS Reseaux IP Europeens Network Coordination Centre (RIPE NCC),NL', u'TS': 1401781240, u'ASN': u'3333'}

import os.path
import time
import json
import ipaddr		# http://code.google.com/p/ipaddr-py/ - pip install ipaddr
import socket
import urllib2

class IPDetailsCache():

	def _Debug(self, s):
		if self.Debug:
			print("DEBUG - IPDetailsCache - %s" % s)

	# IPPrefixesCache[<ip prefix>]["TS"]
	# IPPrefixesCache[<ip prefix>]["ASN"]
	# IPPrefixesCache[<ip prefix>]["Holder"]

	# IPAddressesCache[<ip>]["TS"]
	# IPAddressesCache[<ip>]["ASN"]
	# IPAddressesCache[<ip>]["Holder"]
	# IPAddressesCache[<ip>]["Prefix"]
	# IPAddressesCache[<ip>]["HostName"]

	def GetIPInformation( self, in_IP ):
		Result = {}
		Result["TS"] = 0
		Result["ASN"] = ""
		Result["Holder"] = ""
		Result["Prefix"] = ""
		Result["HostName"] = ""

		IP = in_IP

		if not IP in self.IPAddressObjects:
			self.IPAddressObjects[IP] = ipaddr.IPAddress(IP)

		if self.IPAddressObjects[IP].version == 4:
			if self.IPAddressObjects[IP].is_private:
				Result["ASN"] = "unknown"
				return Result

		if self.IPAddressObjects[IP].version == 6:
			if self.IPAddressObjects[IP].is_reserved or \
				self.IPAddressObjects[IP].is_link_local or \
				self.IPAddressObjects[IP].is_site_local or \
				self.IPAddressObjects[IP].is_private or \
				self.IPAddressObjects[IP].is_multicast or \
				self.IPAddressObjects[IP].is_unspecified:

				Result["ASN"] = "unknown"
				return Result

			if IP != self.IPAddressObjects[IP].exploded:
				IP = self.IPAddressObjects[IP].exploded
				if not IP in self.IPAddressObjects:
					self.IPAddressObjects[IP] = ipaddr.IPAddress(IP)

		if IP in self.IPAddressesCache:
			if self.IPAddressesCache[IP]["TS"] >= int(time.time()) - self.MAX_CACHE:
				Result = self.IPAddressesCache[IP]
				self._Debug("IP address cache hit for %s" % IP)
				return Result
			else:
				self._Debug("Expired IP address cache hit for %s" % IP)

		for IPPrefix in self.IPPrefixesCache:
			if self.IPPrefixesCache[IPPrefix]["TS"] >= int(time.time()) - self.MAX_CACHE:
				if not IPPrefix in self.IPPrefixObjects:
					self.IPPrefixObjects[IPPrefix] = ipaddr.IPNetwork( IPPrefix )

				if self.IPPrefixObjects[IPPrefix].Contains( self.IPAddressObjects[IP] ):
					Result["TS"] = self.IPPrefixesCache[IPPrefix]["TS"]
					Result["ASN"] = self.IPPrefixesCache[IPPrefix]["ASN"]
					Result["Holder"] = self.IPPrefixesCache[IPPrefix].get("Holder","")
					Result["Prefix"] = IPPrefix
					self._Debug("IP prefix cache hit for %s (prefix %s)" % ( IP, IPPrefix ) )
					break

		if Result["ASN"] == "":
			self._Debug("No cache hit for %s" % IP )

			URL = "https://stat.ripe.net/data/prefix-overview/data.json?resource=%s" % IP

			obj = json.loads( urllib2.urlopen(URL).read() )

			if obj["status"] == "ok":
				Result["TS"] = int(time.time())

				if obj["data"]["asns"] != []:
					try:
						Result["ASN"] = str(obj["data"]["asns"][0]["asn"])
						Result["Holder"] = obj["data"]["asns"][0]["holder"]
						Result["Prefix"] = obj["data"]["resource"]

						self._Debug("Got data for %s: ASN %s, prefix %s" % ( IP, Result["ASN"], Result["Prefix"] ) )
					except:
						Result["ASN"] = "unknown"

						self._Debug("No data for %s" % IP )
				else:
					Result["ASN"] = "not announced"
					Result["Holder"] = ""
					Result["Prefix"] = obj["data"]["resource"]

			if Result["ASN"].isdigit() or Result["ASN"] == "not announced":
				HostName = socket.getfqdn(IP)
				if HostName == IP or HostName == "":
					Result["HostName"] = "unknown"
				else:
					Result["HostName"] = HostName

		if not IP in self.IPAddressesCache:
			self.IPAddressesCache[IP] = {}
			self._Debug("Adding %s to addresses cache" % IP)

		self.IPAddressesCache[IP]["TS"] = Result["TS"]
		self.IPAddressesCache[IP]["ASN"] = Result["ASN"]
		self.IPAddressesCache[IP]["Holder"] = Result["Holder"]
		self.IPAddressesCache[IP]["Prefix"] = Result["Prefix"]
		self.IPAddressesCache[IP]["HostName"] = Result["HostName"]

		if Result["Prefix"] != "":
			IPPrefix = Result["Prefix"]

			if not IPPrefix in self.IPPrefixesCache:
				self.IPPrefixesCache[ IPPrefix ] = {}
				self._Debug("Adding %s to prefixes cache" % IPPrefix)

			self.IPPrefixesCache[IPPrefix]["TS"] = Result["TS"]
			self.IPPrefixesCache[IPPrefix]["ASN"] = Result["ASN"]
			self.IPPrefixesCache[IPPrefix]["Holder"] = Result["Holder"]

		return Result

	def SaveCache( self ):
		# Save IP addresses cache
		self._Debug("Saving IP addresses cache to %s" % self.IP_ADDRESSES_CACHE_FILE)
		with open( self.IP_ADDRESSES_CACHE_FILE, "w" ) as outfile:
			json.dump( self.IPAddressesCache, outfile )

		# Save IP prefixes cache
		self._Debug("Saving IP prefixes cache to %s" % self.IP_PREFIXES_CACHE_FILE)
		with open( self.IP_PREFIXES_CACHE_FILE, "w" ) as outfile:
			json.dump( self.IPPrefixesCache, outfile )

	def __init__( self, IP_ADDRESSES_CACHE_FILE = "ip_addr.cache", IP_PREFIXES_CACHE_FILE = "ip_pref.cache", MAX_CACHE = 604800, Debug = False ):
		self.IPAddressesCache = {}
		self.IPPrefixesCache = {}
		self.IPAddressObjects = {}
		self.IPPrefixObjects = {}

		self.IP_ADDRESSES_CACHE_FILE = IP_ADDRESSES_CACHE_FILE
		self.IP_PREFIXES_CACHE_FILE = IP_PREFIXES_CACHE_FILE
		self.MAX_CACHE = MAX_CACHE
		self.Debug = Debug

		# Load IP addresses cache
		if os.path.exists( self.IP_ADDRESSES_CACHE_FILE ):
			self._Debug("Loading IP addresses cache from %s" % self.IP_ADDRESSES_CACHE_FILE)
			json_data = open( self.IP_ADDRESSES_CACHE_FILE )
			self.IPAddressesCache = json.load( json_data )
			json_data.close()
		else:
			self._Debug("No IP addresses cache file found: %s" % self.IP_ADDRESSES_CACHE_FILE)

		# Load IP prefixes cache
		if os.path.exists( self.IP_PREFIXES_CACHE_FILE ):
			self._Debug("Loading IP prefixes cache from %s" % self.IP_PREFIXES_CACHE_FILE)

			json_data = open( self.IP_PREFIXES_CACHE_FILE )
			self.IPPrefixesCache = json.load( json_data )
			json_data.close()
		else:
			self._Debug("No IP prefixes cache file found: %s" % self.IP_PREFIXES_CACHE_FILE)

		# Test write access to IP addresses cache file
		self._Debug("Testing write permissions on IP addresses cache file")
		with open( self.IP_ADDRESSES_CACHE_FILE, "w" ) as outfile:
			outfile.close()
		self._Debug("Write permissions on IP addresses cache file OK")

		# Test write access to IP prefixes cache file
		self._Debug("Testing write permissions on IP prefixes cache file")
		with open( self.IP_PREFIXES_CACHE_FILE, "w" ) as outfile:
			outfile.close()
		self._Debug("Write permissions on IP prefixes cache file OK")

	def __del__( self ):
		self.SaveCache()
