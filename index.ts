import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as url from 'url';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

export const DATAFILE = path.join(__dirname, "data.json.gz");

export interface Ipv4Range {
    start: number;
    end: number;
    code: string;
}

export interface Ipv6Range {
    startUpper: bigint;
    endUpper: bigint;
    startLower: bigint;
    endLower: bigint;
    code: string;
}

export interface IpDetails {
    flag?: string;
    countryCode?: string;
    type: "cgnat" | "private" | "loopback" | "link-local" | "region" | "country";
    description: string;
    lat?: number;
    lon?: number;
}

export interface CodeToDetails {
    [code: string]: IpDetails
}

const urls = [
    'https://ftp.apnic.net/apnic/stats/apnic/delegated-apnic-latest',
    'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-extended-latest',
    'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest',
    'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-extended-latest',
    'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-extended-latest',
];

async function downloadContent(originalUrl: string, retries = 3, timeout = 10000, redirectCount = 0, maxRedirects = 5): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                const req = https.get(originalUrl, { family: 4, timeout }, (res) => {
                    // Handle redirects (301, 302)
                    if (res.statusCode === 301 || res.statusCode === 302) {
                        const redirectUrl = res.headers.location;
                        if (!redirectUrl) {
                            reject(new Error(`Redirect (${res.statusCode}) without Location header`));
                            res.resume();
                            return;
                        }
                        if (redirectCount >= maxRedirects) {
                            reject(new Error(`Max redirects (${maxRedirects}) exceeded`));
                            res.resume();
                            return;
                        }
                        // Redirecting...
                        res.resume();
                        // Resolve the redirect URL relative to the original
                        const resolvedUrl = url.resolve(originalUrl, redirectUrl);
                        // Recursively follow redirect
                        return downloadContent(resolvedUrl, retries, timeout, redirectCount + 1, maxRedirects)
                            .then(resolve)
                            .catch(reject);
                    }
                    if (res.statusCode !== 200) {
                        reject(new Error(`Request Failed. Status Code: ${res.statusCode}`));
                        res.resume();
                        return;
                    }
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        resolve(data);
                    });
                });
                req.on('error', (err) => {
                    reject(new Error(`Attempt ${attempt}: ${err.message}`));
                });
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error(`Attempt ${attempt}: Request timed out`));
                });
            });
        } catch (err) {
            if (attempt === retries) {
                throw new Error(`Failed after ${retries} attempts: ${err instanceof Error ? err.message : String(err)}`);
            }
            // Retrying...
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
    throw new Error('downloadContent: All attempts failed and no result was returned.');
}

export async function updateDataFile() {
    const newRangesData: RangesData = {
        ipv4: [],
        ipv6: [],
        codeToDetails: JSON.parse(readFileSync(path.join(__dirname, "details.json"), "utf8")),
    };
    for (const url of urls) {
        // Downloading url...
        const content = await downloadContent(url);
        content.split('\n')
            .filter((line: string) => line && !line.startsWith('#'))
            .forEach((line: string) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [_, countryCode, type, start, value, __, status] = line.split('|');
                if (!["assigned", "allocated"].includes(status) || !["ipv6", "ipv4"].includes(type)) {
                    return;
                }
                let cc = countryCode || "AP";
                if (!newRangesData.codeToDetails.hasOwnProperty(cc)) {
                    throw Error(`Mismatch in new data from Regional Internet Registries. Missing code "${cc}"`);
                }
                if (type === 'ipv6') {
                    const cidr = `${start}/${value}`;
                    const { startUpper, startLower, endUpper, endLower } = ipv6CidrToRange(cidr);
                    newRangesData.ipv6.push({
                        startUpper,
                        endUpper,
                        startLower,
                        endLower,
                        code: cc
                    });
                }
                if (type === 'ipv4') {
                    const cidr = `${start}/${value}`;
                    const { startNumber, endNumber } = ipv4CidrToRange(cidr);
                    newRangesData.ipv4.push({
                        start: startNumber,
                        end: endNumber,
                        code: cc
                    });
                }
            });
    }
    const ranges: {
        type: "ipv4"|"ipv6";
        cidr:string;
        code:"loopback"|"private"|"link-local"|"cgnat";
    }[] = [
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
    for (const { type, cidr, code } of ranges) {
        if (type === "ipv4") {
            const { startNumber, endNumber } = ipv4CidrToRange(cidr);
            newRangesData.ipv4.push({
                start: startNumber,
                end: endNumber,
                code
            });
        } else if (type === "ipv6") {
            const { startUpper, startLower, endUpper, endLower } = ipv6CidrToRange(cidr);
            newRangesData.ipv6.push({
                startUpper,
                endUpper,
                startLower,
                endLower,
                code
            });
        } else {
            throw Error("Invalid type found in other ranges");
        }
        if (!newRangesData.codeToDetails.hasOwnProperty(code)) {
            throw Error(`Mismatch in loopback, private, link-local and cgnat ranges. Missing code "${code}"`);
        }

    }

    const jsonString = JSON.stringify(
        newRangesData,
        (_, value) => (typeof value === 'bigint' ? `bigint:${value.toString()}` : value),
        2
    );

    // Compress the JSON string
    const compressedData = await gzip(jsonString);

    // Write the compressed data to the file
    writeFileSync(DATAFILE, compressedData);
}

// Helper function to expand a compressed IPv6 address
function expandIPv6(ip: string) {
    const parts = ip.includes('::') ? ip.split('::') : [ip];
    const left = parts[0] ? parts[0].split(':').filter(Boolean) : [];
    const right = parts.length > 1 ? parts[1].split(':').filter(Boolean) : [];
    const missingZeros = 8 - (left.length + right.length);
    const zeros = Array(missingZeros).fill('0000');
    return [...left, ...zeros, ...right].map(part => part.padStart(4, '0'));
}

// Function to convert an IPv6 address to two 64-bit BigInt values
function ipv6ToBigInt(ip: string) {
    // Expand the address if compressed
    const parts = ip.includes('::') ? expandIPv6(ip) : ip.split(':').map(part => part.padStart(4, '0'));

    // Ensure we have 8 blocks
    if (parts.length !== 8) {
        throw new Error('Invalid IPv6 address');
    }

    // Convert to two 64-bit BigInt values (upper: first 4 blocks, lower: last 4 blocks)
    const upper = BigInt(`0x${parts.slice(0, 4).join('')}`);
    const lower = BigInt(`0x${parts.slice(4, 8).join('')}`);

    return [upper, lower];
}

// Function to convert an IPv4 address to a number
function ipv4ToNumber(ip: string): number {
    return ip.split('.').reduce((num, octet, i) => num + (parseInt(octet) << (24 - i * 8)), 0);
}

// Function to calculate the start and end addresses of a CIDR range as BigInt pairs
function ipv6CidrToRange(cidr: string) {
    const [network, prefix] = cidr.split('/');
    const prefixLength = parseInt(prefix, 10);

    if (prefixLength < 0 || prefixLength > 128) {
        throw new Error('Invalid CIDR prefix length');
    }

    // Get the base address as BigInt
    const [baseUpper, baseLower] = ipv6ToBigInt(network);

    // Calculate the number of variable bits
    const totalBits = 128;
    const variableBits = totalBits - prefixLength;

    // Start address: Set variable bits to 0
    let startUpper = baseUpper;
    let startLower = baseLower;

    // End address: Set variable bits to 1
    let endUpper = baseUpper;
    let endLower = baseLower;

    if (variableBits > 0) {
        if (variableBits >= 64) {
            // All lower 64 bits are variable
            startLower = BigInt(0);
            endLower = BigInt('0xFFFFFFFFFFFFFFFF');
            // Adjust upper bits if variable bits exceed 64
            const upperVariableBits = variableBits - 64;
            if (upperVariableBits > 0) {
                const mask = (BigInt(1) << BigInt(upperVariableBits)) - BigInt(1);
                startUpper = baseUpper & (~mask); // Clear variable bits
                endUpper = baseUpper | mask; // Set variable bits to 1
            }
        } else {
            // Variable bits are in the lower 64 bits
            const mask = (BigInt(1) << BigInt(variableBits)) - BigInt(1);
            startLower = baseLower & (~mask); // Clear variable bits
            endLower = baseLower | mask; // Set variable bits to 1
        }
    }

    return {
        startUpper,
        startLower,
        endUpper,
        endLower
    };
}

function ipv4CidrToRange(cidr: string) {
    const [ip, value] = cidr.split('/');
    let prefixLength: number;
    // If value is a prefix (contains a dot, unlikely), parse as prefix, else treat as count
    if (parseInt(value, 10) <= 32) {
        prefixLength = parseInt(value, 10);
    } else {
        // Value is a count, so calculate prefix length
        const count = parseInt(value, 10);
        prefixLength = 32 - Math.log2(count);
    }
    const ipNum = ipv4ToNumber(ip);
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0; // Unsigned 32-bit
    const startNumber = ipNum & mask;
    const endNumber = startNumber + (1 << (32 - prefixLength)) - 1;
    return { startNumber, endNumber };
}

export function ip2details(ip: string): IpDetails | null {
    let range;
    if (ip.includes('.')) {
        const ipNumber = ipv4ToNumber(ip);
        range = rangesData.ipv4.find(range => (
            ipNumber >= range.start && ipNumber <= range.end
        ));
    } else if (ip.includes(':')) {
        const [ipUpper, ipLower] = ipv6ToBigInt(ip);
        range = rangesData.ipv6.find(range => (
            ipUpper >= range.startUpper && ipLower >= range.startLower && ipUpper <= range.endUpper && ipLower <= range.endLower
        ));
    }
    if (range) {
        return rangesData.codeToDetails[range.code];
    }
    return null;
}

export function codeToDetails() {
    return rangesData.codeToDetails;
}

export function loadDatabase() {
    const data = zlib.gunzipSync(readFileSync(DATAFILE)).toString();
    const newRangesData: RangesData = JSON.parse(data, (_, value) =>
        typeof value === 'string' && value.startsWith("bigint:") ? BigInt(value.substring(7)) : value
    );
    rangesData.ipv4 = newRangesData.ipv4;
    rangesData.ipv6 = newRangesData.ipv6;
    rangesData.codeToDetails = newRangesData.codeToDetails;
}

interface RangesData {
    ipv4: Ipv4Range[],
    ipv6: Ipv6Range[],
    codeToDetails: CodeToDetails,
}

const rangesData: RangesData = {
    ipv4: [],
    ipv6: [],
    codeToDetails: {},
};


