'use strict';

const hashRequest = require('./hash-request');
const koa = require('koa');
const fs = require('mz/fs');
const path = require('path');
const request = require('co-request');
const tryCatch = require('co-try-catch');
const _ = require('lodash');
const rawBody = require('./raw-body');
const mkdirp = require('mkdirp');
const debug = require('debug');

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
    const data = yield rawBody.call(this);
    this.headers.host = CONFIG.host.replace(/https?:\/\//, '');
    this.headers['accept-encoding'] = undefined;

    const hash = hashRequest(CONFIG, this, data);
    const filePath = path.resolve(CONFIG.cache_dir, `${hash}.json`);
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

    const response = yield proxy.call(this, CONFIG, hash, data);

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
function *proxy(CONFIG, hash, data) {
  const requestConfig = {
    url: `${CONFIG.host}${this.url}`,
    headers: this.headers,
    method: this.method,
    body: data
  };

  const response = yield request(requestConfig);

  yield fs.writeFile(path.resolve(CONFIG.cache_dir, `${hash}.json`), JSON.stringify({
    request: requestConfig,
    response: {
      status: response.statusCode,
      headers: response.headers,
      body: response.body
    }
  }, 0, 2));

  return response;
}