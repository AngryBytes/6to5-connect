var path = require("path");
var to5  = require("6to5-core");
var url  = require("url");
var fs   = require("fs");
var _    = require("lodash");

module.exports = function (root, options) {
  var cache = Object.create(null);

  return function (req, res, next) {
    if (!to5.canCompile(req.url)) return next();

    var pathname = path.normalize(url.parse(req.url).pathname);
    var src = path.join(root, pathname);
    var srcStat;

    var send = function (data) {
      res.set('Content-Type', 'application/javascript');
      res.end(data);
    };

    var compile = function () {
      var transformOpts = _.extend({}, options);
      to5.transformFile(src, transformOpts, function (err, result) {
        if (err) {
          next(err);
        } else {
          cache[pathname] = {
            mtime: +srcStat.mtime,
            code: result.code
          };
          send(result.code);
        }
      });
    };

    fs.stat(src, function (err, stat) {
      srcStat = stat;
      var cacheObj = cache[pathname];
      if (err && err.code === 'ENOENT') {
        next();
      } else if (err) {
        next(err);
      } else if (cacheObj && cacheObj.mtime === +stat.mtime) {
        send(cacheObj.code);
      } else {
        compile();
      }
    });
  };
};
