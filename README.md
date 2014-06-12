ripeatlastracepath
==================

A Python script/CGI which reads results from RIPE Atlas traceroute measurements (both IPv4 and IPv6) and shows the Autonomous Systems that probes traverse to reach the target.

Overview
--------

The script can be used in two ways: **command line mode** and **CGI mode** (recommended).

* When used in command line mode, the script analyzes the traceroute results and then shows a plain text summary of traversed ASes:

        [...]
    
        2 probes:  7922, COMCAST-7922 - Comcast Cable Communications, Inc.,US
                   3356, LEVEL3 - Level 3 Communications, Inc.,US
                   3333, RIPE-NCC-AS Reseaux IP Europeens Network Coordination Centre (RIPE NCC),NL
        
        3 probes:  1273, CW Cable and Wireless Worldwide plc,GB
                   1200, AMS-IX1 Amsterdam Internet Exchange B.V.,NL
                   3333, RIPE-NCC-AS Reseaux IP Europeens Network Coordination Centre (RIPE NCC),NL
        
        [...]

* When run in CGI mode, the script also returns a web page containing a graph of the traversed ASes, which may offer a clearer view of the results:

  ![Graph example](https://raw.github.com/pierky/ripeatlastracepath/master/example.png)

  (the graph is rendered using external client-side JavaScript libraries: please see the *Third-party Libraries* section fore more information).

In the example, a traceroute toward www.ripe.net is shown (measurement ID 1674977).
Even if AS3333 (RIPE-NCC-AS) is not directly announced by AS1200 (AMS-IX1), some paths from remote probes to the target host traverse the AMS-IX infrastructure, which conversely announces its peering LAN prefixes, resulting in an additional "AS hop" in the path.

A **demo** can be found on my blog: http://blog.pierky.com/ripe-atlas-a-script-to-show-ases-traversed-in-traceroute

Installation
------------

Please consider security aspects of your network before installing this script, especially if you want to use it in CGI mode; it is intended for a restricted audience of trusted people and it does not implement any kind of security mechanism.

### ipdetailscache library

The **ipdetailscache** library is required to run this script: its installation and requirements can be found at https://github.com/pierky/ipdetailscache.
Download it and simply put the *ipdetailscache.py* in the same directory of this script.

In order to make it work, a local directory must be created with r&w permissions; it is used to store IP addresses details cache files. 
By default, this script uses **/opt/ripeatlastracepath**, but it can be changed by simply editing the *DATA_DIR* variable.
If you plan to run the script in CGI mode, please ensure that web server process has the correct permissions on this directory.

### CGI mode

An example of Apache configuration and directories layout follows. Be sure to set right permissions on files and directories.

#### Directories tree

* /var/www/ripeatlastracepath/cgi-bin

  files: ripeatlastracepath and ipdetailscache.py (from "ipdetailscache" library - https://github.com/pierky/ipdetailscache)

* /var/www/ripeatlastracepath/htdocs/js

  * graphdracula

    files: dracula_algorithms.js, dracula_graffle.js and dracula_graph.js (from Dracula Graph Library by Johann Philipp Strathausen - http://www.graphdracula.net/)

  * raphaeljs

    files: raphael-min.js (from Raphael JavaScript Library by Dmitry Baranovskiy - http://raphaeljs.com)

#### Apache configuration

        ScriptAlias /ripeatlastracepath/ripeatlastracepath.cgi /var/www/ripeatlastracepath/cgi-bin/ripeatlastracepath
        Alias /ripeatlastracepath /var/www/ripeatlastracepath/htdocs
        <Directory "/var/www/ripeatlastracepath/cgi-bin">
                AllowOverride None
                Options +ExecCGI -MultiViews +SymLinksIfOwnerMatch

                # Security, authentication and so on...
                Order allow,deny
                Allow from all
        </Directory>

Usage
-----

For each run, the RIPE Atlas measurement ID is required; if the measurement is not public, the API key is also needed in order to access the results.

Results are then downloaded in a local file for later use; traceroute hops IP addresses are analyzed using the "ipdetailscache" library (https://github.com/pierky/ipdetailscache) and their details locally cached.

Radius from the target may be specified as an option (default is 3); this value is used to build an aggregate count of how many probes reach the target by traversing the last *radius* ASes.

Command line mode syntax:

    ./ripeatlastracepath [-k api_key ] [-r radius] [-i] [-f] measurement_id
    
    Options:
        -k      RIPEAtlas API key to access the measurement
        -r      Number of ASes from the target to summarize paths (default: 3)
        -i      Include paths from probes which did not complete the traceroute
        -f      Skip local measurement cache and force its download

Third-party Libraries
---------------------

Part of this work is based on Raphael JavaScript Library by Dmitry Baranovskiy (http://raphaeljs.com/) and Dracula Graph Library by Johann Philipp Strathausen (http://www.graphdracula.net/).
Please see their web sites to verify browser compatibility.

Bug? Issues?
------------

Have a bug? Please create an issue here on GitHub at https://github.com/pierky/ripeatlastracepath/issues.

Author
------

Pier Carlo Chiodi - http://pierky.com/aboutme

Blog: http://blog.pierky.com Twitter: <a href="http://twitter.com/pierky">@pierky</a>
