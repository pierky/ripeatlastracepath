# RIPE Atlas Tracepath

A JavaScript/Python web-app which reads results from RIPE Atlas traceroute measurements (both IPv4 and IPv6) and shows the Autonomous Systems that probes traverse to reach the target.

## Overview

Given a [RIPE Atlas](https://atlas.ripe.net/) traceroute measurement, it builds a graph with all the Autonomous Systems traversed by probes and shows their average RTT toward the target.
Graphs can be saved in JSON format and loaded later for further analysis, or they can be exported as PNG images.

![Example](https://raw.github.com/pierky/ripeatlastracepath/master/example.png)

A demo can be found at http://www.pierky.com/ripeatlastracepath/demo.

## Dependencies

### Python

Yes, Python 2.7 (probably it's already on your system).

- One step installation: `apt-get install python2.7` (Debian-like)

- More details: https://docs.python.org/2/

### Other modules

You can run

 `pip install -r requirements.txt`

to install dependencies.

## Installation

Simply fetch the GitHub repository (or its [last release](https://github.com/pierky/ripeatlastracepath/releases/latest)) into your local directory:

- One step installation:

 `git clone https://github.com/pierky/ripeatlastracepath.git /opt/ripeatlastracepath`

 (replace /opt/ripeatlastracepath with your preferred destination directory)

- More details: https://help.github.com/articles/fetching-a-remote/

## Configuration

### Application specific configurations

Rename the **config-distrib.py** to **config.py** and edit it with your preferred text editor.

 `mv config-distrib.py config.py`

**IMPORTANT**: when done, set the `CONFIG_DONE` at the end of the file to `True`.

### Local var directory

Build the *var* directory referenced by the `VAR_DIR` variable:

 `mkdir var`

Cached IP addresses' details will be stored here.

### Web front-end

The web front-end can be deployed in two flavors:

- using the **Flask builtin web server**, not suitable for production environment but useful to have a working application in few minutes;

- using [WSGI containers](http://flask.pocoo.org/docs/0.10/deploying/wsgi-standalone/) or **Apache with mod_wsgi**.

In this document you can find two brief guides about the builtin server and the Apache configuration.

Please consider security aspects of your network before installing RIPE Atlas Tracepath; it is intended for a restricted audience of trusted people and it does not implement any kind of security mechanism.

#### Flask builtin web server

- To change the listening IP address, edit the last line of **web.py**:

 `ripeatlastracepathapp.run(host="0.0.0.0",threaded=True)`

- From the directory where RIPE Atlas Tracepath has been downloaded, run

 `python web.py`

 The output will show how to reach the application:

 ```
 * Running on http://0.0.0.0:5000/
 * Restarting with reloader
 ```

 Any output debug message will be written to stdout.

- Point your browser to the given URL (http://your_ip:5000/ in the example).

#### Apache

- Install **mod_wsgi** (if not yet): `apt-get install libapache2-mod-wsgi` (Debian-like)

- Configure Apache to use **mod_wsgi**.

 An example is provided in the **ripeatlastracepath.apache** file.

 A quick setup guide is available on [Flask web-site](http://flask.pocoo.org/docs/0.10/deploying/mod_wsgi/).

 See http://www.modwsgi.org/ for more details.

- Edit **web.wsgi** and set ```BASE_DIR``` to the directory where RIPE Atlas Tracepath has been downloaded in (/opt/ripeatlastracepath for example).

- Ensure that the **var** directory has **write permissions** for the user used by Apache:

 ```
 chown -R :www-data var
 chmod -R g+w var
 chmod g+s var
 ```

- Visit the URL configured in your Apache *WSGIScriptAlias* configuration statement (http://your_ip//ripeatlastracepath/ripeatlastracepath for example).

## Third-party Libraries

Part of this work is based on [D3.js](http://d3js.org/) library. Please see its web sites to verify browser compatibility.

## Old releases

The old version of this tool, CGI-based, has been moved in the [old_style branch](https://github.com/pierky/ripeatlastracepath/tree/old_style).

## Bug? Issues?

Have a bug? Please create an issue here on GitHub at https://github.com/pierky/ripeatlastracepath/issues.

## Author

Pier Carlo Chiodi - https://www.pierky.com/

Blog: https://blog.pierky.com Twitter: <a href="http://twitter.com/pierky">@pierky</a>
