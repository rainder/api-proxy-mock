'use strict';

module.exports = function *() {
  let data = '';

  this.req.on('data', function (chunk) {
    data += chunk;
  });

  yield (cb) => this.req.on('end', cb);

  return data;
};