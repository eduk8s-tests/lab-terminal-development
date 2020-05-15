var express = require('express');
var path = require('path');

module.exports = function(app, prefix) {
    var router = express();

    router.set('views', path.join(__dirname, '..', 'views'));
    router.set('view engine', 'pug');

    router.use('/xterm.css', express.static(path.join(__dirname,
            '../node_modules/xterm/css/xterm.css')));
    router.use('/xterm.js', express.static(path.join(__dirname,
            '../node_modules/xterm/lib/xterm.js')));
    router.use('/xterm-addon-fit.js', express.static(path.join(__dirname,
            '../node_modules/xterm-addon-fit/lib/xterm-addon-fit.js')));

    router.use(function (req, res) {
        res.render('myterminal');
    });

    return router;
}
