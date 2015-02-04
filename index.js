var path = require("path");
var to5  = require("6to5-core");
var url  = require("url");
var fs   = require("fs");
var _    = require("lodash");

module.exports = function (root, options) {
  if (!options) {
    options = { sourceMap: true };
  }

  var cache = Object.create(null);

  return function (req, res, next) {
    var pathname = path.normalize(url.parse(req.url).pathname);

    var type = (pathname.slice(-4) === '.map') ? 'map' : 'code';
    if (type === 'map') {
      if (options.sourceMap !== true) {
        return next();
      }
      pathname = pathname.slice(0, -4);
    }

    if (!to5.canCompile(pathname)) {
      return next();
    }

    var src = path.join(root, pathname);
    var srcStat;

    var send = function (result) {
      res.set('Content-Type', 'application/javascript');
      res.end(result[type]);
    };

    var compile = function () {
      var file = path.basename(pathname);

      var transformOpts = _.clone(options);
      if (options.sourceMap === true) {
        transformOpts.filenameRelative = file;
      }
      to5.transformFile(src, transformOpts, function (err, result) {
        if (err) {
          return next(err);
        }

        var code = result.code;
        if (options.sourceMap === true) {
          result = cache[pathname] = {
            mtime: +srcStat.mtime,
            code: result.code + '\n\n//# sourceMappingURL=' + file + '.map\n',
            map: JSON.stringify(result.map)
          };
        } else {
          result = cache[pathname] = {
            mtime: +srcStat.mtime,
            code: result.code
          };
        }

        send(result);
      });
    };

    fs.stat(src, function (err, stat) {
      srcStat = stat;
      var result = cache[pathname];
      if (err && err.code === 'ENOENT') {
        next();
      } else if (err) {
        next(err);
      } else if (result && result.mtime === +stat.mtime) {
        send(result);
      } else {
        compile();
      }
    });
  };
};
