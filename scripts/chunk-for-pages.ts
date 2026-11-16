import { mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import * as path from "path";
import * as zlib from "zlib";

const ROOT = path.join(__dirname, "..");
const DATAFILE = path.join(ROOT, "data.json.gz");
const OUT_DIR = path.join(ROOT, "docs", "data");

const SPECIAL_CODES = new Set(["loopback", "private", "link-local", "cgnat"]);

interface Ipv4Range {
  start: number;
  end: number;
  code: string;
}

interface Ipv6Range {
  startUpper: bigint;
  endUpper: bigint;
  startLower: bigint;
  endLower: bigint;
  code: string;
}

interface IpDetails {
  flag?: string;
  countryCode?: string;
  type: string;
  description: string;
  lat?: number;
  lon?: number;
}

interface RangesData {
  ipv4: Ipv4Range[];
  ipv6: Ipv6Range[];
  codeToDetails: Record<string, IpDetails>;
}

function loadDatabase(datafile: string): RangesData {
  const data = zlib.gunzipSync(readFileSync(datafile)).toString();
  return JSON.parse(data, (_, value) =>
    typeof value === "string" && value.startsWith("bigint:")
      ? BigInt(value.substring(7))
      : value
  ) as RangesData;
}

function ensureEmptyDir(dir: string) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, value: unknown) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value));
}

function main() {
  console.log(`Loading ${DATAFILE}...`);
  const db = loadDatabase(DATAFILE);
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")) as {
    version: string;
  };

  ensureEmptyDir(OUT_DIR);
  mkdirSync(path.join(OUT_DIR, "flags"), { recursive: true });
  mkdirSync(path.join(OUT_DIR, "ipv4"), { recursive: true });
  mkdirSync(path.join(OUT_DIR, "ipv6"), { recursive: true });

  const details: Record<string, Omit<IpDetails, "flag">> = {};
  let flagCount = 0;
  for (const [code, entry] of Object.entries(db.codeToDetails)) {
    const { flag, ...rest } = entry;
    details[code] = rest;
    if (flag) {
      writeJson(path.join(OUT_DIR, "flags", `${code}.json`), { flag });
      flagCount += 1;
    }
  }
  writeJson(path.join(OUT_DIR, "details.json"), details);

  const ipv4 = db.ipv4
    .filter((r) => !SPECIAL_CODES.has(r.code))
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const ipv4Chunks = new Map<number, { s: number; e: number; c: string }[]>();
  for (const range of ipv4) {
    const octet = (range.start >>> 24) & 0xff;
    let bucket = ipv4Chunks.get(octet);
    if (!bucket) {
      bucket = [];
      ipv4Chunks.set(octet, bucket);
    }
    bucket.push({ s: range.start, e: range.end, c: range.code });
  }
  for (const [octet, ranges] of ipv4Chunks) {
    writeJson(path.join(OUT_DIR, "ipv4", `${octet}.json`), ranges);
  }

  const ipv6 = db.ipv6
    .filter((r) => !SPECIAL_CODES.has(r.code))
    .slice()
    .sort((a, b) => {
      if (a.startUpper !== b.startUpper) {
        return a.startUpper < b.startUpper ? -1 : 1;
      }
      if (a.startLower !== b.startLower) {
        return a.startLower < b.startLower ? -1 : 1;
      }
      return 0;
    });

  const ipv6Chunks = new Map<string, {
    su: string;
    eu: string;
    sl: string;
    el: string;
    c: string;
  }[]>();
  for (const range of ipv6) {
    const hextet = (range.startUpper >> 48n).toString(16).padStart(4, "0");
    let bucket = ipv6Chunks.get(hextet);
    if (!bucket) {
      bucket = [];
      ipv6Chunks.set(hextet, bucket);
    }
    bucket.push({
      su: range.startUpper.toString(),
      eu: range.endUpper.toString(),
      sl: range.startLower.toString(),
      el: range.endLower.toString(),
      c: range.code,
    });
  }
  for (const [hextet, ranges] of ipv6Chunks) {
    writeJson(path.join(OUT_DIR, "ipv6", `${hextet}.json`), ranges);
  }

  writeJson(path.join(OUT_DIR, "meta.json"), {
    version: pkg.version,
    generatedAt: new Date().toISOString(),
    ipv4Ranges: ipv4.length,
    ipv6Ranges: ipv6.length,
    ipv4Chunks: ipv4Chunks.size,
    ipv6Chunks: ipv6Chunks.size,
    flagFiles: flagCount,
    codes: Object.keys(details).length,
    chunkScheme: {
      ipv4: "first-octet (/8), file data/ipv4/{0-255}.json, entries {s,e,c}",
      ipv6: "first-hextet (/16), file data/ipv6/{hhhh}.json, entries {su,eu,sl,el,c} as decimal strings",
      details: "data/details.json (no flags)",
      flags: "data/flags/{code}.json with {flag}",
      special: "loopback/private/link-local/cgnat checked client-side, not in chunks",
    },
  });

  console.log(
    `Wrote docs/data: ${ipv4Chunks.size} ipv4 chunks, ${ipv6Chunks.size} ipv6 chunks, ${flagCount} flags`
  );
}

main();
