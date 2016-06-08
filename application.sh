#! /bin/sh
case "$1" in
start)
cd /var/www/nodejs-proxy-crawler-incloak/
node bin/www &
;;
test)
node bin/www
;;
esac
exit 0
