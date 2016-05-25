'use strict';

const crypto = require('crypto');
const _ = require('lodash');

module.exports = function (req, CONFIG, data) {
  const clean = cleanup(CONFIG, req);
  const object = {
    method: req.method,
    headers: clean.headers,
    url: clean.url,
    data
  };

  const hash = crypto.createHash('md5').update(JSON.stringify(object)).digest('hex');

  return { hash, clean };
};

/**
 *
 * @param CONFIG
 * @param url
 * @param headers
 * @returns {{url: *, headers: *}}
 */
function cleanup(CONFIG, req) {
  let url = req.url;
  let headers = _.clone(req.headers);

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

  return { url, headers }
}