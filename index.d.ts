export declare const DATAFILE: string;
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
export declare function updateDataFile(): Promise<void>;
export declare function ip2details(ip: string): IpDetails | null;
export declare function codeToDetails(): CodeToDetails;
export declare function loadDatabase(): void;
