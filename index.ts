import { readFileSync } from 'fs';
import * as zlib from 'zlib';

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
export function ipv6ToBigInt(ip: string) {
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
export function ipv4ToNumber(ip: string): number {
    return ip.split('.').reduce((num, octet, i) => num + (parseInt(octet) << (24 - i * 8)), 0);
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

export function ipv4fromNumber(num: number): string {
    return [
        (num >> 24) & 0xFF,
        (num >> 16) & 0xFF,
        (num >> 8) & 0xFF,
        num & 0xFF
    ].join('.');
}

// Converts two BigInt values (upper and lower) to an IPv6 string
export function ipv6fromNumber(upper: bigint, lower: bigint): string {
    const blocks: string[] = [];
    // upper: first 4 blocks
    let upperHex = upper.toString(16).padStart(16, '0');
    let lowerHex = lower.toString(16).padStart(16, '0');
    for (let i = 0; i < 4; i++) {
        blocks.push(upperHex.slice(i * 4, (i + 1) * 4));
    }
    for (let i = 0; i < 4; i++) {
        blocks.push(lowerHex.slice(i * 4, (i + 1) * 4));
    }
    // Remove leading zeros for each block
    return blocks.map(b => b.replace(/^0+/, '') || '0').join(':');
}

export function codeToRanges(code: string) {
    const codeRanges: CodeRange[] = [];
    for (const range of rangesData.ipv4) {
        if (range.code === code) {
            const start = ipv4fromNumber(range.start);
            const end = ipv4fromNumber(range.end);
            codeRanges.push({
                start,
                end
            });
        }
    }
    for (const range of rangesData.ipv6) {
        if (range.code === code) {
            const start = ipv6fromNumber(range.startUpper, range.startLower);
            const end = ipv6fromNumber(range.endUpper, range.endLower);
            codeRanges.push({
                start,
                end
            });
        }
    }
    return codeRanges;
}


export function loadDatabase(datafile:string) {
    const data = zlib.gunzipSync(readFileSync(datafile)).toString();
    const newRangesData: RangesData = JSON.parse(data, (_, value) =>
        typeof value === 'string' && value.startsWith("bigint:") ? BigInt(value.substring(7)) : value
    );
    rangesData.ipv4 = newRangesData.ipv4;
    rangesData.ipv6 = newRangesData.ipv6;
    rangesData.codeToDetails = newRangesData.codeToDetails;
}

export interface CodeRange {
    start: string,
    end: string
}

export interface RangesData {
    ipv4: Ipv4Range[],
    ipv6: Ipv6Range[],
    codeToDetails: CodeToDetails,
}

const rangesData: RangesData = {
    ipv4: [],
    ipv6: [],
    codeToDetails: {},
};


