'use strict';

const koa = require('koa');
const _ = require('lodash');
const fs = require('mz/fs');
const crypto = require('crypto');
const path = require('path');
const debug = require('debug');
const mkdirp = require('mkdirp');
const request = require('co-request');
const tryCatch = require('co-try-catch');

const rawBody = require('./raw-body');
const hashRequest = require('./hash-request');

const app = koa();
const d = debug('app');

const CONFIG = {
  host: null,
  local_port: 17010,
  cache_dir: "/tmp",
  ignore_query_params: [],
  ignore_headers: []
};

module.exports = function *(program) {
  extendConfig(CONFIG, program);

  app.use(middleware);
  app.listen(CONFIG.local_port, () => {
    console.info(`Server is listening to ${CONFIG.local_port}`);
  });

  /**
   *
   */
  function *middleware() {
    const req = this;
    const data = yield rawBody.call(this);
    this.headers.host = CONFIG.host.replace(/https?:\/\//, '');
    this.headers['accept-encoding'] = undefined;

    const hash = hashRequest(req, CONFIG);
    const filePath = path.resolve(CONFIG.cache_dir, `${hash.hash}.json`);
    const fileContents = yield tryCatch(fs.readFile(filePath, { encoding: 'utf8' }));

    if (fileContents.result) {
      const capturedData = JSON.parse(fileContents.result);

      this.set(capturedData.response.headers);
      this.body = capturedData.response.body;
      return;
    }

    if (!program.capture) {
      this.statusCode = 404;
      return;
    }

    const response = yield proxy(CONFIG, req, hash, data);

    this.set(response.headers);
    this.body = response.body;

  }
};

/**
 *
 * @param config
 * @param program
 */
function extendConfig(config, program) {
  if (program.config) {
    _.merge(config, require(path.resolve(program.config)));
  }

  for (let key of Object.keys(config)) {
    config[key] = program[key] || config[key];
  }
}

/**
 *
 * @param CONFIG
 * @param hash
 * @param data
 * @returns {*}
 */
function *proxy(CONFIG, req, hash, data) {
  const response = yield request({
    url: `${CONFIG.host}${req.url}`,
    headers: req.headers,
    method: req.method,
    body: data
  });

  const json = JSON.stringify({
    request: {
      url: `${CONFIG.host}${hash.clean.url}`,
      headers: hash.clean.headers,
      method: req.method,
      body: data
    },
    response: {
      status: response.statusCode,
      headers: response.headers,
      body: response.body
    }
  }, 0, 2);

  yield fs.writeFile(path.resolve(CONFIG.cache_dir, `${hash.hash}.json`), json);

  return response;
}