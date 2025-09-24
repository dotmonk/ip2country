import assert from "assert";
import { ip2details, codeToDetails, loadDatabase } from ".";
import path from "path";

type AddressTest = {
    ip: string;
    expectedCc?: string;
    expectedDescription: string;
    expectedType: string;
    missingFlag?: true;
};

loadDatabase(path.join(process.cwd(), 'data.json.gz'));

const addresses: AddressTest[] = [
    { ip: '2a05:1500:600:1:1c00:4aff:fe00:', expectedCc: "NL", expectedDescription: "Netherlands", expectedType: "country" },
    { ip: '2803:100:1234:5678:9abc:def0:1234:5678', expectedCc: "HN", expectedDescription: "Honduras", expectedType: "country" },
    { ip: '2001:4200:abcd:1234:5678:9abc:def0:1234', expectedCc: "ZA", expectedDescription: "South Africa", expectedType: "country" },
    { ip: '2a02:aa8:abcd:1234:5678:9abc:def0:1234', expectedCc: "ES", expectedDescription: "Spain", expectedType: "country" },
    { ip: '2a0e:c500:1234:5678:9abc:def0:1234:5678', expectedCc: "AT", expectedDescription: "Austria", expectedType: "country" },
    { ip: '2800:470:abcd:1234:5678:9abc:def0:1234', expectedCc: "SX", expectedDescription: "Sint Maarten", expectedType: "country" },
    { ip: '2401:4000:1234:5678:9abc:def0:1234:5678', expectedCc: "KR", expectedDescription: "South Korea", expectedType: "country" },
    { ip: '2400:8300:abcd:1234:5678:9abc:def0:1234', expectedCc: "JP", expectedDescription: "Japan", expectedType: "country" },
    { ip: '2402:8000:1234:5678:9abc:def0:1234:5678', expectedCc: "AU", expectedDescription: "Australia", expectedType: "country" },
    { ip: '::1', expectedDescription: "Loopback address", missingFlag: true, expectedType: "loopback" },
    { ip: '196.3.190.34', expectedCc: "JM", expectedDescription: "Jamaica", expectedType: "country" },
    { ip: "37.156.192.51", expectedCc: "SE", expectedDescription: "Sweden", expectedType: "country" },
    { ip: "94.79.51.169", expectedCc: "RU", expectedDescription: "Russia", expectedType: "country" },
    { ip: "192.168.0.1", expectedDescription: "Private address", missingFlag: true, expectedType: "private" },
    { ip: "127.0.0.1", expectedDescription: "Loopback address", missingFlag: true, expectedType: "loopback" },
    { ip: "138.199.64.1", expectedDescription: "European Union", expectedType: "region" },
    { ip: "165.101.120.1", expectedDescription: "Asia Pacific", missingFlag: true, expectedType: "region" },
    { ip: "10.0.0.1", expectedDescription: "Private address", missingFlag: true, expectedType: "private" },
    { ip: "172.16.0.1", expectedDescription: "Private address", missingFlag: true, expectedType: "private" },
    { ip: "169.254.0.1", expectedDescription: "Link-Local address", missingFlag: true, expectedType: "link-local" },
    { ip: "100.64.0.1", expectedDescription: "CGNAT - Shared Address Space, Carrier-grade NAT by ISPs", missingFlag: true, expectedType: "cgnat" },
    { ip: "fc00::1", expectedDescription: "Private address", missingFlag: true, expectedType: "private" },
    { ip: "fe80::1", expectedDescription: "Link-Local address", missingFlag: true, expectedType: "link-local" },
];

let failed = false;

for (const { ip, expectedCc, expectedDescription, missingFlag, expectedType } of addresses) {
    const details = ip2details(ip);
    if(!details) {
        console.error(`Test failed for IP ${ip}: Missing data`);
        failed = true;
        continue;
    }
    if (details.type !== expectedType) {
        console.error(`Test failed for IP ${ip}: expected type "${expectedType}", but got "${details.type}"`);
        failed = true;
    } else {
        console.log(`Test passed for IP ${ip}: type "${details.type}"`);
    }
    if (details.countryCode !== expectedCc) {
        console.error(`Test failed for IP ${ip}: expected country code "${expectedCc}", but got "${details.countryCode}"`);
        failed = true;
    } else {
        console.log(`Test passed for IP ${ip}: country code "${details.countryCode}"`);
    }
    if (details.description !== expectedDescription) {
        console.error(`Test failed for IP ${ip}: expected country name "${expectedDescription}", but got "${details.description}"`);
        failed = true;
    } else {
        console.log(`Test passed for IP ${ip}: country name "${details.description}"`);
    }
    if (details.flag === undefined && !missingFlag) {
        console.error(`Test failed for IP ${ip}: expected to be have country flag country but found none`);
        failed = true;
    } else if (details.flag !== undefined && missingFlag) {
        console.error(`Test failed for IP ${ip}: expected to be missing country flag country but found a country flag`);
        failed = true;
    } else if (missingFlag) {
        console.log(`Test passed for IP ${ip}: was correctly missing a country flag`);
    } else {
        console.log(`Test passed for IP ${ip}: was correctly having a country flag`);
    }
}

try {
    const map = codeToDetails();
    assert(Object.keys(map)[0].length > 1);
    console.log("Test passed for countryCodes function");
} catch (error) {
    console.error(`Test failed for countryCodes function. ${error}`);
    failed = true;
}

if (failed) {
    throw new Error("Some tests failed!");
}

console.log("All tests passed!");
