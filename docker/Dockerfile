FROM debian:stable

MAINTAINER Pier Carlo Chiodi <pierky@pierky.com>

EXPOSE 5000

RUN apt-get update && apt-get install -y \
	curl \
	python2.7 \
	python-pip \
	unzip

WORKDIR /root

RUN curl -o ripeatlastracepath.zip -L https://github.com/pierky/ripeatlastracepath/archive/master.zip && \
	unzip ripeatlastracepath.zip && \
	mv ripeatlastracepath-master /opt/ripeatlastracepath && \
	cd /opt/ripeatlastracepath && \
	pip install -r requirements.txt && \
	cat config-distrib.py | grep -v "CONFIG_DONE" > config.py && \
	echo "CONFIG_DONE = True" >> config.py && \
	mkdir var

CMD cd /opt/ripeatlastracepath && python web.py
