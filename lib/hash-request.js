'use strict';

const crypto = require('crypto');
const _ = require('lodash');

module.exports = function (CONFIG, req, data) {
  let url = req.url;
  let headers = _.cloneDeep(req.headers);

  if (CONFIG.ignore_query_params) {
    for (let item of CONFIG.ignore_query_params) {
      url = url.replace(new RegExp(`&?${item}=[^&]*`), '');
    }
  }

  if (CONFIG.ignore_headers) {
    for (let item of CONFIG.ignore_headers) {
      delete headers[item];
    }
  }
  const object = {
    method: req.method,
    headers: headers,
    url: url,
    data: data
  };

  return crypto.createHash('md5').update(JSON.stringify(object)).digest('hex');
};