var phantom = require('node-phantom');
module.exports = function (queueClient) {
    var self = this;
    self.queueClient = queueClient;
    this.uri = 'http://incloak.com/proxy-list/';
    this.start = function () {
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
                                        proxy.port = $(this)
                                            .text()
                                            .trim();
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
                                    // TODO: Parse this value
                                    case 4:
                                    {
                                        proxy.type = 1;
                                        break;
                                    }
                                    // Anonymity
                                    // TODO: Parse this value
                                    case 5:
                                    {
                                        break;
                                    }
                                    // Last check
                                    // TODO: Parse this value
                                    case 6:
                                    {
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
                            console.log(proxy);
                            self.queueClient.proxy.add.publish(proxy);
                        }
                    });
                });
            });
        });
    };
    return this;
};
