"use strict";
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
exports.ipv6ToBigInt = ipv6ToBigInt;
exports.ipv4ToNumber = ipv4ToNumber;
exports.ip2details = ip2details;
exports.codeToDetails = codeToDetails;
exports.ipv4fromNumber = ipv4fromNumber;
exports.ipv6fromNumber = ipv6fromNumber;
exports.codeToRanges = codeToRanges;
exports.loadDatabase = loadDatabase;
var fs_1 = require("fs");
var zlib = require("zlib");
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
function ipv4fromNumber(num) {
    return [
        (num >> 24) & 0xFF,
        (num >> 16) & 0xFF,
        (num >> 8) & 0xFF,
        num & 0xFF
    ].join('.');
}
// Converts two BigInt values (upper and lower) to an IPv6 string
function ipv6fromNumber(upper, lower) {
    var blocks = [];
    // upper: first 4 blocks
    var upperHex = upper.toString(16).padStart(16, '0');
    var lowerHex = lower.toString(16).padStart(16, '0');
    for (var i = 0; i < 4; i++) {
        blocks.push(upperHex.slice(i * 4, (i + 1) * 4));
    }
    for (var i = 0; i < 4; i++) {
        blocks.push(lowerHex.slice(i * 4, (i + 1) * 4));
    }
    // Remove leading zeros for each block
    return blocks.map(function (b) { return b.replace(/^0+/, '') || '0'; }).join(':');
}
function codeToRanges(code) {
    var codeRanges = [];
    for (var _i = 0, _a = rangesData.ipv4; _i < _a.length; _i++) {
        var range = _a[_i];
        if (range.code === code) {
            var start = ipv4fromNumber(range.start);
            var end = ipv4fromNumber(range.end);
            codeRanges.push({
                start: start,
                end: end
            });
        }
    }
    for (var _b = 0, _c = rangesData.ipv6; _b < _c.length; _b++) {
        var range = _c[_b];
        if (range.code === code) {
            var start = ipv6fromNumber(range.startUpper, range.startLower);
            var end = ipv6fromNumber(range.endUpper, range.endLower);
            codeRanges.push({
                start: start,
                end: end
            });
        }
    }
    return codeRanges;
}
function loadDatabase(datafile) {
    var data = zlib.gunzipSync((0, fs_1.readFileSync)(datafile)).toString();
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
