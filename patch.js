var patch = require('nodejs-patch');
// Patch the "node-phantom" module
patch.file('./node_modules/node-phantom/node-phantom.js', './patches/node-phantom/node-phantom.js.diff', function (error, result) {
    if (error) {
        throw error;
    }
    if (result) {
        console.log('Patched "node-phantom/node-phantom.js"');
    } else {
        console.log('Not patched "node-phantom/node-phantom.js" (either success or error, or updated version)');
    }
});
