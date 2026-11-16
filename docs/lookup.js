const DATA_BASE = new URL("./data/", import.meta.url);

function expandIPv6(ip) {
  const parts = ip.includes("::") ? ip.split("::") : [ip];
  const left = parts[0] ? parts[0].split(":").filter(Boolean) : [];
  const right = parts.length > 1 ? parts[1].split(":").filter(Boolean) : [];
  const missingZeros = 8 - (left.length + right.length);
  const zeros = Array(missingZeros).fill("0000");
  return [...left, ...zeros, ...right].map((part) => part.padStart(4, "0"));
}

export function ipv6ToBigInt(ip) {
  const parts = ip.includes("::")
    ? expandIPv6(ip)
    : ip.split(":").map((part) => part.padStart(4, "0"));
  if (parts.length !== 8) {
    throw new Error("Invalid IPv6 address");
  }
  const upper = BigInt(`0x${parts.slice(0, 4).join("")}`);
  const lower = BigInt(`0x${parts.slice(4, 8).join("")}`);
  return [upper, lower];
}

export function ipv4ToNumber(ip) {
  const octets = ip.split(".");
  if (octets.length !== 4) {
    throw new Error("Invalid IPv4 address");
  }
  // Match the npm package: JS bitwise ops are signed 32-bit, so high octets stay negative.
  return octets.reduce(
    (num, octet, i) => num + (parseInt(octet, 10) << (24 - i * 8)),
    0,
  );
}

function ipv4CidrToRange(cidr) {
  const [ip, value] = cidr.split("/");
  const prefixLength = parseInt(value, 10);
  const ipNum = ipv4ToNumber(ip);
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength));
  const start = ipNum & mask;
  const end = start + (2 ** (32 - prefixLength) - 1);
  return { start, end };
}

function ipv6CidrToRange(cidr) {
  const [network, prefix] = cidr.split("/");
  const prefixLength = parseInt(prefix, 10);
  const [baseUpper, baseLower] = ipv6ToBigInt(network);
  const variableBits = 128 - prefixLength;
  let startUpper = baseUpper;
  let startLower = baseLower;
  let endUpper = baseUpper;
  let endLower = baseLower;
  if (variableBits > 0) {
    if (variableBits >= 64) {
      startLower = 0n;
      endLower = 0xffffffffffffffffn;
      const upperVariableBits = variableBits - 64;
      if (upperVariableBits > 0) {
        const mask = (1n << BigInt(upperVariableBits)) - 1n;
        startUpper = baseUpper & ~mask;
        endUpper = baseUpper | mask;
      }
    } else {
      const mask = (1n << BigInt(variableBits)) - 1n;
      startLower = baseLower & ~mask;
      endLower = baseLower | mask;
    }
  }
  return { startUpper, startLower, endUpper, endLower };
}

const SPECIAL_V4 = [
  { ...ipv4CidrToRange("127.0.0.0/8"), code: "loopback" },
  { ...ipv4CidrToRange("10.0.0.0/8"), code: "private" },
  { ...ipv4CidrToRange("172.16.0.0/12"), code: "private" },
  { ...ipv4CidrToRange("192.168.0.0/16"), code: "private" },
  { ...ipv4CidrToRange("169.254.0.0/16"), code: "link-local" },
  { ...ipv4CidrToRange("100.64.0.0/10"), code: "cgnat" },
];

const SPECIAL_V6 = [
  { ...ipv6CidrToRange("::1/128"), code: "loopback" },
  { ...ipv6CidrToRange("fc00::/7"), code: "private" },
  { ...ipv6CidrToRange("fe80::/10"), code: "link-local" },
];

function cmp128(aUpper, aLower, bUpper, bLower) {
  if (aUpper < bUpper) return -1;
  if (aUpper > bUpper) return 1;
  if (aLower < bLower) return -1;
  if (aLower > bLower) return 1;
  return 0;
}

function inIpv6Range(ipUpper, ipLower, range) {
  return (
    cmp128(ipUpper, ipLower, range.startUpper, range.startLower) >= 0 &&
    cmp128(ipUpper, ipLower, range.endUpper, range.endLower) <= 0
  );
}

const chunkCache = new Map();
let detailsPromise = null;
const flagCache = new Map();

async function fetchJson(relPath) {
  const response = await fetch(new URL(relPath, DATA_BASE));
  if (!response.ok) {
    throw new Error(`Failed to load ${relPath} (${response.status})`);
  }
  return response.json();
}

export async function loadDetails() {
  if (!detailsPromise) {
    detailsPromise = fetchJson("details.json");
  }
  return detailsPromise;
}

export async function loadFlag(code) {
  if (flagCache.has(code)) {
    return flagCache.get(code);
  }
  const promise = fetchJson(`flags/${encodeURIComponent(code)}.json`)
    .then((data) => data.flag || null)
    .catch(() => null);
  flagCache.set(code, promise);
  return promise;
}

export async function loadMeta() {
  return fetchJson("meta.json");
}

async function loadIpv4Chunk(octet) {
  const key = `v4:${octet}`;
  if (!chunkCache.has(key)) {
    chunkCache.set(
      key,
      fetchJson(`ipv4/${octet}.json`).catch(() => []),
    );
  }
  return chunkCache.get(key);
}

async function loadIpv6Chunk(hextet) {
  const key = `v6:${hextet}`;
  if (!chunkCache.has(key)) {
    chunkCache.set(
      key,
      fetchJson(`ipv6/${hextet}.json`).catch(() => []),
    );
  }
  return chunkCache.get(key);
}

function binarySearchIpv4(ranges, ipNumber) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = ranges[mid];
    if (ipNumber < range.s) {
      hi = mid - 1;
    } else if (ipNumber > range.e) {
      lo = mid + 1;
    } else {
      return range.c;
    }
  }
  return null;
}

function binarySearchIpv6(ranges, ipUpper, ipLower) {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = ranges[mid];
    const startUpper = BigInt(range.su);
    const startLower = BigInt(range.sl);
    const endUpper = BigInt(range.eu);
    const endLower = BigInt(range.el);
    if (cmp128(ipUpper, ipLower, startUpper, startLower) < 0) {
      hi = mid - 1;
    } else if (cmp128(ipUpper, ipLower, endUpper, endLower) > 0) {
      lo = mid + 1;
    } else {
      return range.c;
    }
  }
  return null;
}

export async function resolveIp(ip) {
  const trimmed = ip.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes(".")) {
    const ipNumber = ipv4ToNumber(trimmed);
    for (const range of SPECIAL_V4) {
      if (ipNumber >= range.start && ipNumber <= range.end) {
        return range.code;
      }
    }
    const octet = (ipNumber >>> 24) & 0xff;
    const chunk = await loadIpv4Chunk(octet);
    return binarySearchIpv4(chunk, ipNumber);
  }

  if (trimmed.includes(":")) {
    const [ipUpper, ipLower] = ipv6ToBigInt(trimmed);
    for (const range of SPECIAL_V6) {
      if (inIpv6Range(ipUpper, ipLower, range)) {
        return range.code;
      }
    }
    const hextet = (ipUpper >> 48n).toString(16).padStart(4, "0");
    const chunk = await loadIpv6Chunk(hextet);
    return binarySearchIpv6(chunk, ipUpper, ipLower);
  }

  throw new Error("Enter an IPv4 or IPv6 address");
}

export async function resolveIpDetails(ip) {
  const code = await resolveIp(ip);
  if (!code) {
    return null;
  }
  const details = await loadDetails();
  const entry = details[code] || {
    type: "unknown",
    description: code,
    countryCode: code,
  };
  const flag = await loadFlag(code);
  return { code, ...entry, flag };
}
