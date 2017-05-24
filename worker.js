var configuration = require('./configuration');
var phantom = require('node-phantom');
var objectHash = require('object-hash');
var memoryCache = require('memory-cache');
module.exports = function (queueClient) {
    var self = this;
    self.queueClient = queueClient;
    self.processing = false;
    this.uri = 'http://incloak.com/proxy-list/';
    this.start = function () {
        setInterval(this.iterate, configuration.interval);
    };
    this.iterate = function () {
        if (self.processing) {
            console.log('Previous flow running. Will skip activation.');
            return false;
        }
        self.processing = true;
        console.log('Will create Phantom.js instance');
        self.phantomInstanceSpawnTimer = setTimeout(function () {
            console.log('Phantom.js instance spawn time-out, a possible crash');
            self.processing = false;
        }, 4 * configuration.interval);
        phantom.create(function (error, phantomInstance) {
            console.log('Created Phantom.js instance');
            clearTimeout(self.phantomInstanceSpawnTimer);
            delete self.phantomInstanceSpawnTimer;
            var terminatePhantomInstance = function () {
                if (phantomInstance) {
                    phantomInstance.exit();
                }
                delete self.phantomInstanceConnectionTimer;
                self.processing = false;
            };
            if (undefined != error) {
                console.log(error);
                console.log('Will terminate Phantom.js instance due to error');
                terminatePhantomInstance();
                return;
            }
            // Exit Phantom.js by timeout
            self.phantomInstanceConnectionTimer = setTimeout(function () {
                console.log('Will terminate Phantom.js instance due to time-out');
                terminatePhantomInstance();
            }, 2 * configuration.interval);
            return phantomInstance.createPage(function (error, page) {
                console.log('Created page');
                if (undefined != error) {
                    console.log(error);
                    return;
                }
                return page.open(self.uri, function (error, status) {
                    console.log('Opened page ' + self.uri);
                    if (undefined != error) {
                        console.log(error);
                        return;
                    }
                    page.evaluate(function () {
                        function _normalizeType(type) {
                            if ('HTTP' == type) {
                                return 1;
                            } else if ('HTTPS' == type) {
                                return 2;
                            } else if ('SOCKS4' == type) {
                                return 3;
                            } else if ('SOCKS5' == type) {
                                return 4;
                            } else {
                                return undefined;
                            }
                        }

                        var rows = [];
                        // There is a table containing rows with all necessary data
                        $('.proxy__t tr').each(function () {
                            var proxy = {
                                metadata: {}
                            };
                            var i = 0;
                            $(this).find('td').each(function () {
                                // Each row contains some columns with data
                                switch (i++) {
                                    // IP address
                                    case 0: {
                                        proxy.ipv4 = $(this)
                                            .text()
                                            .trim();
                                        break;
                                    }
                                    // Port
                                    case 1: {
                                        var port = $(this)
                                            .text()
                                            .trim();
                                        proxy.port = parseInt(port);
                                        break;
                                    }
                                    // Country, City
                                    case 2: {
                                        // The first text node contains country
                                        var country = $(this)
                                            .find('div')
                                            .contents()
                                            .filter(function () {
                                                return this.nodeType === 3;
                                            })
                                            .text()
                                            .trim();
                                        if (country) {
                                            proxy.metadata.country = country;
                                        }
                                        // The span contains the city
                                        var city = $(this)
                                            .find('div span')
                                            .text()
                                            .trim();
                                        if (city) {
                                            proxy.metadata.city = city;
                                        }
                                        break;
                                    }
                                    // Speed
                                    case 3: {
                                        var speed = $(this)
                                            .find('.bar .n-bar-wrapper p')
                                            .text()
                                            .trim();
                                        if (speed) {
                                            proxy.metadata.speed = speed;
                                        }
                                        break;
                                    }
                                    // Type
                                    case 4: {
                                        var typesString = $(this)
                                            .text()
                                            .trim();
                                        if (typesString) {
                                            var types = typesString.split(', ');
                                            if (types) {
                                                if (0 < types.length) {
                                                    var type = types[types.length - 1];
                                                    proxy.type = _normalizeType(type);
                                                }
                                            }
                                        }
                                        break;
                                    }
                                    // Anonymity
                                    case 5: {
                                        var anonymity = $(this)
                                            .text()
                                            .trim();
                                        if (anonymity) {
                                            proxy.metadata.anonymity = anonymity;
                                        }
                                        break;
                                    }
                                    // Last check
                                    case 6: {
                                        var lastCheck = $(this)
                                            .text()
                                            .trim();
                                        if (lastCheck) {
                                            proxy.metadata.lastCheck = lastCheck;
                                        }
                                        break;
                                    }
                                }
                            });
                            rows.push(proxy);
                        });
                        return rows;
                    }, function (error, proxies) {
                        console.log('Received extracted content');
                        try {
                            if (undefined != error) {
                                console.log(error);
                                return;
                            }
                            if (!proxies) {
                                // This happens when the Web socket connection to Phantom.js is broken.
                                // Web socket errors are not handled internally and "null" is sent as data.
                                console.log(new Error('Null data received'));
                                return;
                            }
                            for (var i = 0; i < proxies.length; i++) {
                                var proxy = proxies[i];
                                if (!self.validate(proxy)) {
                                    continue;
                                }
                                var hash = objectHash(proxy);
                                if (!memoryCache.get(hash)) {
                                    memoryCache.put(hash, true, configuration.cacheTimeToLive);
                                    console.log(proxy);
                                    self.queueClient.proxy.add.publish(proxy);
                                } else {
                                    console.log(hash + ' already processed');
                                }
                            }
                        } finally {
                            // Exit Phantom.js
                            phantomInstance.exit();
                            if (self.phantomInstanceConnectionTimer) {
                                clearTimeout(self.phantomInstanceConnectionTimer);
                                delete self.phantomInstanceConnectionTimer;
                            }
                            // Notify processing finished
                            self.processing = false;
                        }
                    });
                });
            });
        });
    };
    this.validate = function (proxy) {
        return (proxy.ipv4 || proxy.ipv6) && proxy.port && proxy.type;
    };
    return this;
};
