import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import * as path from 'path';
import * as https from 'https';
import * as url from 'url';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { ipv4ToNumber, ipv6ToBigInt, RangesData } from ".";

const gzip = promisify(zlib.gzip);

export const DATAFILE = path.join(__dirname, "data.json.gz");
export const DETAILSFILE = path.join(__dirname, "details.json")

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

export async function updateDataFile(datafile:string, detailsfile:string) {
    const newRangesData: RangesData = {
        ipv4: [],
        ipv6: [],
        codeToDetails: JSON.parse(readFileSync(detailsfile, "utf8")),
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
    writeFileSync(datafile, compressedData);
}

(async () => {
    if(process.env.THIS_IS_A_GITHUB_AUTOUPDATE !== "1") {
        console.error("This script is intended to be run only by GitHub Actions.");
        process.exit(1);
    }
    console.log("Updating data file...");
    const hashBefore = execSync(`sha256sum ${DATAFILE} | cut -d' ' -f1`, {encoding: "utf8"}).toString().trim();    
    await updateDataFile(DATAFILE, DETAILSFILE);
    const hashAfter = execSync(`sha256sum ${DATAFILE} | cut -d' ' -f1`, {encoding: "utf8"}).toString().trim();    
    if (hashBefore === hashAfter) {
        console.log("Data file is up to date, no changes.");
        process.exit(0);
    }
    console.log("Data file has been updated.");
    console.log("Running tests...");
    execSync("npm run test");
    console.log("Tests passed.");
    console.log("Updating version in package.json and README.md...");
    const packageJson = JSON.parse(readFileSync('./package.json', { encoding: 'utf8' })) as { version: string };
    const readme = readFileSync('./README.md', { encoding: 'utf8' });
    const currentVersion = `v${packageJson.version}`; // v1.0.0
    const newVersion = execSync("npm version patch --no-git-tag-version", { encoding: "utf8" }).replace("\n", ""); // v1.0.1
    writeFileSync('./README.md', readme.replaceAll(currentVersion, newVersion), { encoding: 'utf8' });
    console.log(`Version updated from ${currentVersion} to ${newVersion}`);
    console.log("Committing and pushing changes...");
    execSync(`git add .`);
    execSync(`git commit -m "Release ${newVersion}"`);
    execSync(`git tag ${newVersion}`);
    execSync(`git push --tags origin main`);
    console.log("All done!");
})();
