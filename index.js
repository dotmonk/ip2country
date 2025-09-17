"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATAFILE = void 0;
exports.updateDataFile = updateDataFile;
exports.ip2details = ip2details;
exports.codeToDetails = codeToDetails;
exports.loadDatabase = loadDatabase;
var fs_1 = require("fs");
var path = require("path");
var https = require("https");
var url = require("url");
var zlib = require("zlib");
var util_1 = require("util");
var gzip = (0, util_1.promisify)(zlib.gzip);
exports.DATAFILE = path.join(__dirname, "data.json.gz");
var urls = [
    'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest',
    'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-extended-latest',
    'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
    'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest',
    'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest',
];
function downloadContent(originalUrl_1) {
    return __awaiter(this, arguments, void 0, function (originalUrl, retries, timeout, redirectCount, maxRedirects) {
        var _loop_1, attempt, state_1;
        if (retries === void 0) { retries = 3; }
        if (timeout === void 0) { timeout = 10000; }
        if (redirectCount === void 0) { redirectCount = 0; }
        if (maxRedirects === void 0) { maxRedirects = 5; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function (attempt) {
                        var _b, err_1;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    _c.trys.push([0, 2, , 4]);
                                    _b = {};
                                    return [4 /*yield*/, new Promise(function (resolve, reject) {
                                            var req = https.get(originalUrl, { family: 4, timeout: timeout }, function (res) {
                                                // Handle redirects (301, 302)
                                                if (res.statusCode === 301 || res.statusCode === 302) {
                                                    var redirectUrl = res.headers.location;
                                                    if (!redirectUrl) {
                                                        reject(new Error("Redirect (".concat(res.statusCode, ") without Location header")));
                                                        res.resume();
                                                        return;
                                                    }
                                                    if (redirectCount >= maxRedirects) {
                                                        reject(new Error("Max redirects (".concat(maxRedirects, ") exceeded")));
                                                        res.resume();
                                                        return;
                                                    }
                                                    // Redirecting...
                                                    res.resume();
                                                    // Resolve the redirect URL relative to the original
                                                    var resolvedUrl = url.resolve(originalUrl, redirectUrl);
                                                    // Recursively follow redirect
                                                    return downloadContent(resolvedUrl, retries, timeout, redirectCount + 1, maxRedirects)
                                                        .then(resolve)
                                                        .catch(reject);
                                                }
                                                if (res.statusCode !== 200) {
                                                    reject(new Error("Request Failed. Status Code: ".concat(res.statusCode)));
                                                    res.resume();
                                                    return;
                                                }
                                                var data = '';
                                                res.on('data', function (chunk) {
                                                    data += chunk;
                                                });
                                                res.on('end', function () {
                                                    resolve(data);
                                                });
                                            });
                                            req.on('error', function (err) {
                                                reject(new Error("Attempt ".concat(attempt, ": ").concat(err.message)));
                                            });
                                            req.on('timeout', function () {
                                                req.destroy();
                                                reject(new Error("Attempt ".concat(attempt, ": Request timed out")));
                                            });
                                        })];
                                case 1: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                case 2:
                                    err_1 = _c.sent();
                                    if (attempt === retries) {
                                        throw new Error("Failed after ".concat(retries, " attempts: ").concat(err_1 instanceof Error ? err_1.message : String(err_1)));
                                    }
                                    // Retrying...
                                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000 * attempt); })];
                                case 3:
                                    // Retrying...
                                    _c.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    };
                    attempt = 1;
                    _a.label = 1;
                case 1:
                    if (!(attempt <= retries)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(attempt)];
                case 2:
                    state_1 = _a.sent();
                    if (typeof state_1 === "object")
                        return [2 /*return*/, state_1.value];
                    _a.label = 3;
                case 3:
                    attempt++;
                    return [3 /*break*/, 1];
                case 4: throw new Error('downloadContent: All attempts failed and no result was returned.');
            }
        });
    });
}
function updateDataFile() {
    return __awaiter(this, void 0, void 0, function () {
        var newRangesData, _i, urls_1, url_1, content, ranges, _a, ranges_1, _b, type, cidr, code, _c, startNumber, endNumber, _d, startUpper, startLower, endUpper, endLower, jsonString, compressedData;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    newRangesData = {
                        ipv4: [],
                        ipv6: [],
                        codeToDetails: JSON.parse((0, fs_1.readFileSync)(path.join(__dirname, "details.json"), "utf8")),
                    };
                    _i = 0, urls_1 = urls;
                    _e.label = 1;
                case 1:
                    if (!(_i < urls_1.length)) return [3 /*break*/, 4];
                    url_1 = urls_1[_i];
                    return [4 /*yield*/, downloadContent(url_1)];
                case 2:
                    content = _e.sent();
                    content.split('\n')
                        .filter(function (line) { return line && !line.startsWith('#'); })
                        .forEach(function (line) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        var _a = line.split('|'), _ = _a[0], countryCode = _a[1], type = _a[2], start = _a[3], value = _a[4], __ = _a[5], status = _a[6];
                        if (!["assigned", "allocated"].includes(status) || !["ipv6", "ipv4"].includes(type)) {
                            return;
                        }
                        var cc = countryCode || "AP";
                        if (!newRangesData.codeToDetails.hasOwnProperty(cc)) {
                            throw Error("Mismatch in new data from Regional Internet Registries. Missing code \"".concat(cc, "\""));
                        }
                        if (type === 'ipv6') {
                            var cidr = "".concat(start, "/").concat(value);
                            var _b = ipv6CidrToRange(cidr), startUpper = _b.startUpper, startLower = _b.startLower, endUpper = _b.endUpper, endLower = _b.endLower;
                            newRangesData.ipv6.push({
                                startUpper: startUpper,
                                endUpper: endUpper,
                                startLower: startLower,
                                endLower: endLower,
                                code: cc
                            });
                        }
                        if (type === 'ipv4') {
                            var cidr = "".concat(start, "/").concat(value);
                            var _c = ipv4CidrToRange(cidr), startNumber = _c.startNumber, endNumber = _c.endNumber;
                            newRangesData.ipv4.push({
                                start: startNumber,
                                end: endNumber,
                                code: cc
                            });
                        }
                    });
                    _e.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4:
                    ranges = [
                        // IPv4 Local/Internal
                        { type: 'ipv4', cidr: '127.0.0.0/8', code: 'loopback' },
                        { type: 'ipv4', cidr: '10.0.0.0/8', code: 'private' },
                        { type: 'ipv4', cidr: '172.16.0.0/12', code: 'private' },
                        { type: 'ipv4', cidr: '192.168.0.0/16', code: 'private' },
                        { type: 'ipv4', cidr: '169.254.0.0/16', code: 'link-local' },
                        { type: 'ipv4', cidr: '100.64.0.0/10', code: 'cgnat' },
                        // IPv6 Local/Internal
                        { type: 'ipv6', cidr: '::1/128', code: 'loopback' },
                        { type: 'ipv6', cidr: 'fc00::/7', code: 'private' },
                        { type: 'ipv6', cidr: 'fe80::/10', code: 'link-local' },
                    ];
                    for (_a = 0, ranges_1 = ranges; _a < ranges_1.length; _a++) {
                        _b = ranges_1[_a], type = _b.type, cidr = _b.cidr, code = _b.code;
                        if (type === "ipv4") {
                            _c = ipv4CidrToRange(cidr), startNumber = _c.startNumber, endNumber = _c.endNumber;
                            newRangesData.ipv4.push({
                                start: startNumber,
                                end: endNumber,
                                code: code
                            });
                        }
                        else if (type === "ipv6") {
                            _d = ipv6CidrToRange(cidr), startUpper = _d.startUpper, startLower = _d.startLower, endUpper = _d.endUpper, endLower = _d.endLower;
                            newRangesData.ipv6.push({
                                startUpper: startUpper,
                                endUpper: endUpper,
                                startLower: startLower,
                                endLower: endLower,
                                code: code
                            });
                        }
                        else {
                            throw Error("Invalid type found in other ranges");
                        }
                        if (!newRangesData.codeToDetails.hasOwnProperty(code)) {
                            throw Error("Mismatch in loopback, private, link-local and cgnat ranges. Missing code \"".concat(code, "\""));
                        }
                    }
                    jsonString = JSON.stringify(newRangesData, function (_, value) { return (typeof value === 'bigint' ? "bigint:".concat(value.toString()) : value); }, 2);
                    return [4 /*yield*/, gzip(jsonString)];
                case 5:
                    compressedData = _e.sent();
                    // Write the compressed data to the file
                    (0, fs_1.writeFileSync)(exports.DATAFILE, compressedData);
                    return [2 /*return*/];
            }
        });
    });
}
// Helper function to expand a compressed IPv6 address
function expandIPv6(ip) {
    var parts = ip.includes('::') ? ip.split('::') : [ip];
    var left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
    var right = parts.length > 1 ? parts[1].split(':').filter(Boolean) : [];
    var missingZeros = 8 - (left.length + right.length);
    var zeros = Array(missingZeros).fill('0000');
    return __spreadArray(__spreadArray(__spreadArray([], left, true), zeros, true), right, true).map(function (part) { return part.padStart(4, '0'); });
}
// Function to convert an IPv6 address to two 64-bit BigInt values
function ipv6ToBigInt(ip) {
    // Expand the address if compressed
    var parts = ip.includes('::') ? expandIPv6(ip) : ip.split(':').map(function (part) { return part.padStart(4, '0'); });
    // Ensure we have 8 blocks
    if (parts.length !== 8) {
        throw new Error('Invalid IPv6 address');
    }
    // Convert to two 64-bit BigInt values (upper: first 4 blocks, lower: last 4 blocks)
    var upper = BigInt("0x".concat(parts.slice(0, 4).join('')));
    var lower = BigInt("0x".concat(parts.slice(4, 8).join('')));
    return [upper, lower];
}
// Function to convert an IPv4 address to a number
function ipv4ToNumber(ip) {
    return ip.split('.').reduce(function (num, octet, i) { return num + (parseInt(octet) << (24 - i * 8)); }, 0);
}
// Function to calculate the start and end addresses of a CIDR range as BigInt pairs
function ipv6CidrToRange(cidr) {
    var _a = cidr.split('/'), network = _a[0], prefix = _a[1];
    var prefixLength = parseInt(prefix, 10);
    if (prefixLength < 0 || prefixLength > 128) {
        throw new Error('Invalid CIDR prefix length');
    }
    // Get the base address as BigInt
    var _b = ipv6ToBigInt(network), baseUpper = _b[0], baseLower = _b[1];
    // Calculate the number of variable bits
    var totalBits = 128;
    var variableBits = totalBits - prefixLength;
    // Start address: Set variable bits to 0
    var startUpper = baseUpper;
    var startLower = baseLower;
    // End address: Set variable bits to 1
    var endUpper = baseUpper;
    var endLower = baseLower;
    if (variableBits > 0) {
        if (variableBits >= 64) {
            // All lower 64 bits are variable
            startLower = BigInt(0);
            endLower = BigInt('0xFFFFFFFFFFFFFFFF');
            // Adjust upper bits if variable bits exceed 64
            var upperVariableBits = variableBits - 64;
            if (upperVariableBits > 0) {
                var mask = (BigInt(1) << BigInt(upperVariableBits)) - BigInt(1);
                startUpper = baseUpper & (~mask); // Clear variable bits
                endUpper = baseUpper | mask; // Set variable bits to 1
            }
        }
        else {
            // Variable bits are in the lower 64 bits
            var mask = (BigInt(1) << BigInt(variableBits)) - BigInt(1);
            startLower = baseLower & (~mask); // Clear variable bits
            endLower = baseLower | mask; // Set variable bits to 1
        }
    }
    return {
        startUpper: startUpper,
        startLower: startLower,
        endUpper: endUpper,
        endLower: endLower
    };
}
function ipv4CidrToRange(cidr) {
    var _a = cidr.split('/'), ip = _a[0], value = _a[1];
    var prefixLength;
    // If value is a prefix (contains a dot, unlikely), parse as prefix, else treat as count
    if (parseInt(value, 10) <= 32) {
        prefixLength = parseInt(value, 10);
    }
    else {
        // Value is a count, so calculate prefix length
        var count = parseInt(value, 10);
        prefixLength = 32 - Math.log2(count);
    }
    var ipNum = ipv4ToNumber(ip);
    var mask = (0xffffffff << (32 - prefixLength)) >>> 0; // Unsigned 32-bit
    var startNumber = ipNum & mask;
    var endNumber = startNumber + (1 << (32 - prefixLength)) - 1;
    return { startNumber: startNumber, endNumber: endNumber };
}
function ip2details(ip) {
    var range;
    if (ip.includes('.')) {
        var ipNumber_1 = ipv4ToNumber(ip);
        range = rangesData.ipv4.find(function (range) { return (ipNumber_1 >= range.start && ipNumber_1 <= range.end); });
    }
    else if (ip.includes(':')) {
        var _a = ipv6ToBigInt(ip), ipUpper_1 = _a[0], ipLower_1 = _a[1];
        range = rangesData.ipv6.find(function (range) { return (ipUpper_1 >= range.startUpper && ipLower_1 >= range.startLower && ipUpper_1 <= range.endUpper && ipLower_1 <= range.endLower); });
    }
    if (range) {
        return rangesData.codeToDetails[range.code];
    }
    return null;
}
function codeToDetails() {
    return rangesData.codeToDetails;
}
function loadDatabase() {
    var data = zlib.gunzipSync((0, fs_1.readFileSync)(exports.DATAFILE)).toString();
    var newRangesData = JSON.parse(data, function (_, value) {
        return typeof value === 'string' && value.startsWith("bigint:") ? BigInt(value.substring(7)) : value;
    });
    rangesData.ipv4 = newRangesData.ipv4;
    rangesData.ipv6 = newRangesData.ipv6;
    rangesData.codeToDetails = newRangesData.codeToDetails;
}
var rangesData = {
    ipv4: [],
    ipv6: [],
    codeToDetails: {},
};
