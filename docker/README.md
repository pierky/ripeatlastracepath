# Overview

This image is based on the master branch of [RIPE Atlas Tracepath](https://github.com/pierky/ripeatlastracepath). It uses Flask builtin web server and `EXPOSE`s port 5000.

# Disclaimer

This image has been created to allow the quick deployment of the web-app to just have a glance at how it works; it's not meant to be used in a production environment, it does not implement any security best practice. Use it at your own risk.

# How to use this image

Create the local `var` directory where the container's `/opt/ripeatlastracepath/var` will be mounted and the IP addresses' details will be cached, then run the image and publish the container's port 5000 to the host port 80...

```
# mkdir var
# docker run -it --rm -p 80:5000 -v `pwd`/var:/opt/ripeatlastracepath/var pierky/ripeatlastracepath
```

... finally, point your web browser to your host IP address.

# Author

Pier Carlo Chiodi - https://pierky.com

Blog: https://blog.pierky.com Twitter: [@pierky](https://twitter.com/pierky)

