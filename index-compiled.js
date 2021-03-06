'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var axios = require('axios'),
    Mask = require('generic-bitmask').Mask,
    iconv = require('iconv-lite'),
    Descriptor = require('generic-bitmask').Descriptor,
    config = require('./config.js'),
    apiUrl = `http://opengtindb.org/`,
    paramRegex = /^\s*([\w\.\-\_]+)\s*=\s*(.*?)\s*$/,
    contentsMask = config.contentsMask,
    packMask = config.packMask,
    errorMessages = config.errors,
    cat1 = config.cat1,
    cat2 = config.cat2;

/**
 * Class to do query the OpenGtinDB API
 */

var OpenGtinDB = function () {

    /**
     * Create a OpenGtinDB-Client instance
     * @param {string} apiKey - The API key.
     * @param {Object} [contentsMask] - The Bitmask-Descriptor for the "contents" of a product as described at: http://opengtindb.org/api.php
     * @return {Object} the OpenGtinDB-Client instance
     * @throws {Error}
     */
    function OpenGtinDB(apiKey) {
        _classCallCheck(this, OpenGtinDB);

        if (typeof apiKey !== 'string') throw new Error('Please provide the userID as a String');
        this.apiKey = apiKey;
        this.contentsDescriptor = new Descriptor(contentsMask);
        this.packDescriptor = new Descriptor(packMask);
        return this;
    }

    /**
     * @param {arraybuffer} data - The query result as an ArrayBuffer
     * @return {string} data - The decoded Data as UTF-8
     */


    _createClass(OpenGtinDB, [{
        key: '_cleanResponse',
        value: function _cleanResponse(data) {
            return iconv.decode(data, 'iso-8859-15');
        }

        /**
         * Gets a product by its EAN
         * @param {string} ean - The EAN
         * @returns {Promise}
         */

    }, {
        key: 'get',
        value: function get(ean) {
            var _this = this;

            ean = ean + '';
            return axios({
                method: 'get',
                url: apiUrl,
                params: {
                    queryid: this.apiKey,
                    ean: ean,
                    cmd: 'query'
                },
                responseType: 'arraybuffer'
            }).then(function (res) {
                return _this.parseResponse(res);
            });
        }

        /**
         * Posts a new product to the API
         * @param {object} options - Mandatory: ean, Optional options: fullname, descr, vendor, contflag (@see: http://opengtindb.org/api.php)
         * @param {boolean} test - testmode
         * @returns {promise}
         */

    }, {
        key: 'post',
        value: function post() {
            var _this2 = this;

            var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
            var test = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;


            ['ean', 'name', 'fcat1', 'fcat2'].forEach(function (param) {
                if (!options.hasOwnProperty(param) || typeof options[param] === 'undefined' || options[param] === '') {
                    return Promise.reject('Please provide all mandatory parameters: ean, name, fcat1, fcat2');
                }
            });

            if (cat1.indexOf(options.fcat1) < 0) {
                return Promise.reject('Please provide a valid category');
            } else {
                options.fcat1 = cat1.indexOf(options.fcat1);
            }

            if (cat2[options.fcat1].indexOf(options.fcat2) < 0) {
                return Promise.reject('Please provide a valid subcategory');
            } else {
                options.fcat2 = cat2[options.fcat1].indexOf(options.fcat2);
            }

            var postOptions = {
                queryid: parseInt(this.apiKey),
                cmd: 'submit',
                maincatnum: options.fcat1 + 1,
                subcatnum: options.fcat2 + 1,
                test: test ? 1 : 0
            };
            Object.assign(options, postOptions);
            return axios({
                method: 'post',
                url: apiUrl + 'submit.php',
                params: options,
                responseType: 'arraybuffer'
            }).then(function (res) {
                return _this2.parseResponse(res);
            });
        }

        /**
         * Parses the (ascii) opengtindb response and converts it to a JavaScript-Object
         * @param {Object} resp - The Response
         * @returns {Object}
         */

    }, {
        key: 'parseResponse',
        value: function parseResponse(resp) {
            var _this3 = this;

            resp.data = this._cleanResponse(resp.data);
            var lines = resp.data.split(/\r\n|\r|\n/),
                cnt = -1,
                retVal = {
                error: true,
                data: []
            };
            lines.forEach(function (line) {
                // check if it's a param
                if (paramRegex.test(line)) {
                    var match = line.match(paramRegex),
                        currentProduct = retVal.data[cnt];
                    switch (match[1]) {
                        case "error":
                            retVal.error = match[2];
                            break;
                        case "contents":
                            currentProduct['contents'] = _this3.contentsDescriptor.extract(new Mask(match[2] + ''));
                            break;
                        case "pack":
                            currentProduct['pack'] = _this3.packDescriptor.extract(new Mask(match[2] + ''));
                            break;
                        default:
                            retVal.data[cnt][match[1]] = match[2];
                            break;
                    }
                } else {
                    // add a new product
                    if (line.indexOf('---') === 0) {
                        cnt++;
                        retVal.data[cnt] = {};
                    }
                }
            });
            if (retVal.error > 0) {
                throw new Error(errorMessages[parseInt(retVal.error, 10)].msg);
            }
            return retVal;
        }
    }]);

    return OpenGtinDB;
}();

module.exports = OpenGtinDB;
