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
    [code: string]: IpDetails;
}
export declare function ipv6ToBigInt(ip: string): bigint[];
export declare function ipv4ToNumber(ip: string): number;
export declare function ip2details(ip: string): IpDetails | null;
export declare function codeToDetails(): CodeToDetails;
export declare function ipv4fromNumber(num: number): string;
export declare function ipv6fromNumber(upper: bigint, lower: bigint): string;
export declare function codeToRanges(code: string): CodeRange[];
export declare function loadDatabase(datafile: string): void;
export interface CodeRange {
    start: string;
    end: string;
}
export interface RangesData {
    ipv4: Ipv4Range[];
    ipv6: Ipv6Range[];
    codeToDetails: CodeToDetails;
}
