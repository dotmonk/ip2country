<p align="center"><img src="docs/logo.svg" width="96" alt="ip2country logo"></p>

# IP to Country library

- Resolves IPv4 and IPv6 addresses to:
  - country codes (sources: Regional Internet Registries)
  - flags (source: flagpedia.net)
  - positions (source: Grok)
  - descriptions (source: Grok)
  - types (country, region, loopback, private, link-local or cgnat)
- Resolve country code to IPv4 and IPv6 ranges
- Public Domain License
- Self contained
- Self updated on github via github actions to keep in sync with sources
- Zero runtime dependencies

## Installation

```sh
npm install @dotmonk/ip2country
```

Or from a GitHub Release tarball:

```sh
npm install https://github.com/dotmonk/ip2country/releases/download/v1.0.408/dotmonk-ip2country-1.0.408.tgz
```

## Demo

- Browser lookup (GitHub Pages): https://dotmonk.github.io/ip2country/
- Demo with a backend server: https://github.com/dotmonk/ip2country-demo

![Animated DEMO](https://raw.githubusercontent.com/dotmonk/ip2country-demo/main/demo.gif)

## GitHub Pages

The site under [`docs/`](docs/) is built with [janus-elements](https://github.com/dotmonk/janus-elements) (green theme) and chunked static JSON. The result map ([`docs/map.js`](docs/map.js)) uses [Leaflet](https://leafletjs.com/) 1.9.4 from unpkg with OpenStreetMap tiles, recoloured with CSS filters to match the light and dark theme. Enable **Settings → Pages → Source: GitHub Actions** so [`.github/workflows/pages.yml`](.github/workflows/pages.yml) can deploy. The daily update workflow rebuilds Pages after refreshing RIR data.

Chunked data (`docs/data/`) and the synced janus copy (`docs/lib/`) are **gitignored** and only produced in CI / local builds, so they do not grow git history.

### Local build

```sh
# needs data.json.gz (from a release tarball) in the repo root
npm run pages          # sync janus + chunk data into docs/
python3 -m http.server --directory docs
```

### Static data API

Public files on Pages (same paths under `docs/data/` locally):

```
data/meta.json
data/details.json
data/flags/{CC}.json
data/ipv4/{0-255}.json   → [{s,e,c}, ...]
data/ipv6/{hhhh}.json    → [{su,eu,sl,el,c}, ...]
```

IPv4 chunks are keyed by first octet; IPv6 by first hextet. Special ranges (loopback, private, link-local, cgnat) are resolved in the client.

## Usage

```ts
import path from "path";
import { ip2details, loadDatabase, codeToDetails } from "@dotmonk/ip2country";

// NOTE: Need to load the file first, you can also put this data wherever it is convenient
loadDatabase(path.join(process.cwd(), 'node_modules/@dotmonk/ip2country/data.json.gz'));

console.log(ip2details('2001:4200:abcd:1234:5678:9abc:def0:1234'));
/* prints out
{
  type: 'country',
  description: 'South Africa',
  countryCode: 'ZA',
  flag: 'A Base64 encoded SVG of the South African flag',
  lat: -30.5595,
  lon: 22.9375
}
*/

console.log(ip2details('94.79.51.169')?.description);
// prints out "Russia"

console.log(ip2details('192.168.0.1'));
// prints out { type: 'private', description: 'Private address' }

console.log(Object.values(codeToDetails()).filter(details => details.type === "country").map(details => details.countryCode));
// prints out a list of strings containing country codes

console.log(codeToDetails()["SE"]);
/* prints out
{
  type: 'country',
  description: 'Sweden',
  countryCode: 'SE',
  flag: '<Base64 encoded svg of Swedish flag>',
  lat: 60.1282,
  lon: 18.6435
}
*/

console.log(codeToDetails()["loopback"]);
// prints out { type: 'loopback', description: 'Loopback address' }

console.log(codeToDetails()["PX"])
// prints out undefined

console.log(codeToDetails()["SE"].flag)
// prints out a Base64 encoded SVG of the Swedish flag

console.log(codeToDetails()["loopback"].flag)
// prints out undefined

console.log(codeToRanges("VA"));
/*
prints out (This may change slightly over time)
[
  { start: '185.17.220.0', end: '185.17.223.255' },
  { start: '185.152.68.0', end: '185.152.71.255' },
  { start: '212.77.0.0', end: '212.77.31.255' },
  { start: '193.43.102.0', end: '193.43.103.255' },
  {
    start: '2a01:b8:0:0:0:0:0:0',
    end: '2a01:b8:ffff:ffff:ffff:ffff:ffff:ffff'
  },
  {
    start: '2a04:640:0:0:0:0:0:0',
    end: '2a04:647:ffff:ffff:ffff:ffff:ffff:ffff'
  },
  {
    start: '2a07:8100:0:0:0:0:0:0',
    end: '2a07:8107:ffff:ffff:ffff:ffff:ffff:ffff'
  }
]
*/
)
```

## Why
I didn't care for the attribution conditions or licenses of the pre-existant databases or solutions.
The data sources for this is public domain and I have made the code public domain.

## Caveats
I spent zero time on code quality or readability for this. I made it because I needed it for a
fun side-project so it may be a bad idea to use it for production projects. For browser use,
prefer the chunked GitHub Pages data API rather than loading the full `data.json.gz` client-side.
