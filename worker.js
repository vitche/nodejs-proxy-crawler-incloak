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
        // To make this work:
        // "Changed window.location.hostname to window.location.host in node-phantom.js file." (c)
        // As given at: http://stackoverflow.com/questions/31998719/phantomjs-error-on-basic-tests
        phantom.create(function (error, phantomInstance) {
            if (undefined != error) {
                console.log(error);
                return;
            }
            return phantomInstance.createPage(function (error, page) {
                if (undefined != error) {
                    console.log(error);
                    return;
                }
                return page.open(self.uri, function (error, status) {
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
                                metadata: {
                                }
                            };
                            var i = 0;
                            $(this).find('td').each(function () {
                                // Each row contains some columns with data
                                switch (i++) {
                                    // IP address
                                    case 0:
                                    {
                                        proxy.ipv4 = $(this)
                                            .text()
                                            .trim();
                                        break;
                                    }
                                    // Port
                                    case 1:
                                    {
                                        var port = $(this)
                                            .text()
                                            .trim();
                                        proxy.port = parseInt(port);
                                        break;
                                    }
                                    // Country, City
                                    case 2:
                                    {
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
                                    case 3:
                                    {
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
                                    case 4:
                                    {
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
                                    case 5:
                                    {
                                        var anonymity = $(this)
                                            .text()
                                            .trim();
                                        if (anonymity) {
                                            proxy.metadata.anonymity = anonymity;
                                        }
                                        break;
                                    }
                                    // Last check
                                    case 6:
                                    {
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
                        if (undefined != error) {
                            console.log(error);
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
                        // Exit Phantom.js
                        phantomInstance.exit();
                        // Notify processing finished
                        self.processing = false;
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
