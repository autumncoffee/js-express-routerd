const ACBodyParser = require('ac-bodyparser');

function ACExpressRouterDRequest(req) {
  const promise = new Promise();
  const deleters = [];

  req.delete = function() {
    for (const cb of deleters) {
      cb();
    }
  };

  req.body = undefined;
  req.getServiceResponse = function(service) {
    return undefined;
  };

  req.json = function() {
    if (req.body === undefined) {
      return undefined;
    }

    const json = JSON.parse(req.body.toString());

    req.json = function () {
      return json;
    };

    return json;
  };

  if (req.method != 'POST') {
    promise.resolve();
    return promise;
  }

  const contentLength = parseInt(req.get('Content-Length'), 10) || 0;
  const defaultChunk = req.get('X-AC-RouterD');

  if (defaultChunk) {
    req.method = req.get('X-AC-RouterD-Method').toUpperCase();
  }

  if (contentLength == 0) {
    promise.resolve();
    return promise;
  }

  let data = Buffer.allocUnsafe(contentLength);
  let length = 0;

  req.on('data', function (chunk) {
    length += chunk.length;

    if (length > contentLength) {
      promise.reject();
      throw 'Invalid content length';
    }

    chunk.copy(data, length - chunk.length);
  });

  req.on('end', function () {
    if (length != contentLength) {
      promise.reject();
      throw 'Invalid content length';
    }

    if (defaultChunk) {
      let boundary = undefined;
      const params = req.get('Content-Type').split(/;/);

      for (let i = 1; i < params.length; ++i) {
        const parts = params[i].split(/=/);

        if (parts[0].trim().toLowerCase() == 'boundary') {
          boundary = parts[1].trim();
          break;
        }
      }

      if (!boundary) {
        promise.reject();
        throw 'Invalid boundary';
      }

      const body = new ACBodyParser(boundary, data);
      deleters.push(function () {
        body.delete();
      });

      const chunk = body.chunk('"' + defaultChunk + '"');

      if (chunk) {
        req.body = chunk.content();
      }

      req.getServiceResponse = function (service) {
        return body.chunk('"' + service + '"');
      };

    } else {
      req.body = data;
    }

    promise.resolve();
  });

  return promise;
}

module.exports = {ACExpressRouterDRequest};
