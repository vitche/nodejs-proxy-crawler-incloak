#! /bin/sh
case "$1" in
start)
cd /applications/nodejs-proxy-crawler-incloak/
node bin/www >logs/www.log 2>&1 &
;;
test)
node bin/www
;;
esac
exit 0
