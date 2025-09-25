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
npm install github:dotmonk/ip2country#v1.0.6
```

## Usage

```ts
import path from "path";
import { ip2details, loadDatabase, codeToDetails } from "ip2country";

// NOTE: Need to load the file first, you can also put this data wherever it is convienient
loadDatabase(path.join(process.cwd(), 'node_modules/ip2country/data.json.gz'));

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
fun side-project so it may be a bad idea to use it for production projects and it will require
some rewriting to support being used in the frontend.
