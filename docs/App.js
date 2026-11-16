import Component, { html } from "janus-elements";
import "janus-elements/ui/base-theme";
import "janus-elements/ui/button";
import "janus-elements/ui/input";
import "janus-elements/ui/card";
import "janus-elements/ui/field";
import SearchIcon from "janus-elements/ui/icons/search";
import MapPinIcon from "janus-elements/ui/icons/map-pin";
import SunIcon from "janus-elements/ui/icons/sun";
import MoonIcon from "janus-elements/ui/icons/moon";
import DayNightIcon from "janus-elements/ui/icons/day-night";

import { ensureGreenTheme } from "./theme.js";
import { loadMeta, resolveIpDetails } from "./lookup.js";
import { CountryMap } from "./map.js";

ensureGreenTheme();

const countryMap = new CountryMap();

const shellStyle = {
  maxWidth: "720px",
  margin: "0 auto",
  padding: "32px 20px 64px",
};

const brandRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  marginBottom: "8px",
};

const formRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  alignItems: "center",
  marginTop: "16px",
};

const resultGridStyle = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "16px 20px",
  alignItems: "center",
};

const flagStyle = {
  width: "72px",
  height: "48px",
  objectFit: "cover",
  borderRadius: "4px",
  border: "1px solid var(--janus-border)",
  background: "var(--janus-raised)",
};

const codeBlockStyle = {
  display: "block",
  padding: "10px 12px",
  borderRadius: "var(--janus-radius)",
  background: "var(--janus-raised)",
  border: "1px solid var(--janus-border)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "0.8rem",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
};

const mutedStyle = {
  color: "var(--janus-text-muted)",
  fontSize: "0.95rem",
  margin: "0 0 20px",
};

class Ip2cApp extends Component {
  constructor() {
    super();
    this.state = {
      mode: "system",
      ip: "",
      loading: false,
      error: null,
      result: null,
      meta: null,
    };
  }

  componentDidMount() {
    loadMeta()
      .then((meta) => this.setState({ meta }))
      .catch(() => {});
    this.detectVisitorIp();
  }

  async detectVisitorIp() {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.ip && !this.state.ip) {
        this.setState({ ip: data.ip });
      }
    } catch {
      // optional convenience; ignore failures
    }
  }

  setMode(mode) {
    this.setState({ mode });
  }

  async resolve() {
    const ip = this.state.ip.trim();
    if (!ip) {
      this.setState({ error: "Enter an IPv4 or IPv6 address", result: null });
      return;
    }
    this.setState({ loading: true, error: null });
    try {
      const result = await resolveIpDetails(ip);
      if (!result) {
        this.setState({
          loading: false,
          result: null,
          error: "No match for that address",
        });
        countryMap.show(null);
        return;
      }
      this.setState({ loading: false, result, error: null });
      countryMap.show(result);
    } catch (err) {
      this.setState({
        loading: false,
        result: null,
        error: err instanceof Error ? err.message : String(err),
      });
      countryMap.show(null);
    }
  }

  renderResult() {
    const { result } = this.state;
    if (!result) return "";

    const flagImg = result.flag
      ? html`<img
          style=${flagStyle}
          alt=${`${result.description || result.code} flag`}
          src=${`data:image/svg+xml;base64,${result.flag}`}
        />`
      : html`<span style=${{ color: "var(--janus-text-muted)" }}>No flag</span>`;

    const coords =
      typeof result.lat === "number" && typeof result.lon === "number"
        ? `${result.lat}, ${result.lon}`
        : "—";

    return html`
      <Card title="Result" style=${{ marginTop: "20px" }}>
        <div style=${resultGridStyle}>
          ${flagImg}
          <div>
            <div style=${{ fontSize: "1.25rem", fontWeight: "600" }}>
              ${result.description || result.code}
            </div>
            <div style=${{ color: "var(--janus-text-muted)", marginTop: "4px" }}>
              ${result.countryCode || result.code}
              · ${result.type}
            </div>
            <div style=${{ marginTop: "8px", fontSize: "0.9rem" }}>
              Position: ${coords}
            </div>
          </div>
        </div>
      </Card>
    `;
  }

  render() {
    const { mode, ip, loading, error, meta } = this.state;
    const ModeIcon =
      mode === "light" ? SunIcon : mode === "dark" ? MoonIcon : DayNightIcon;

    return html`
      <BaseTheme mode=${mode}></BaseTheme>
      <main style=${shellStyle}>
        <div
          style=${{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div style=${brandRowStyle}>
            <img
              src="./logo.svg"
              width="72"
              height="72"
              alt="ip2country"
            />
            <div>
              <h1 style=${{ margin: "0", fontSize: "1.75rem" }}>ip2country</h1>
              <p style=${{ ...mutedStyle, margin: "4px 0 0" }}>
                Resolve IPv4 and IPv6 to country from static chunked data
              </p>
            </div>
          </div>
          <Button
            color="accent"
            headIcon=${ModeIcon}
            onClick=${() =>
              this.setMode(
                mode === "system"
                  ? "light"
                  : mode === "light"
                    ? "dark"
                    : "system",
              )}
          >
            ${mode}
          </Button>
        </div>

        <Card title="Lookup" subtitle="Loads only the chunk for that address">
          <div style=${formRowStyle}>
            <Field label="IP address" style=${{ flex: "1 1 240px" }}>
              <Input
                color="accent"
                headIcon=${SearchIcon}
                placeholder="8.8.8.8 or 2001:4860:4860::8888"
                value=${ip}
                onInput=${(event) =>
                  this.setState({ ip: event.target.value })}
              />
            </Field>
            <Button
              color="accent"
              headIcon=${MapPinIcon}
              disabled=${loading}
              onClick=${() => this.resolve()}
            >
              ${loading ? "Resolving…" : "Resolve"}
            </Button>
          </div>
          ${error
            ? html`<p
                style=${{
                  color: "var(--janus-error)",
                  margin: "12px 0 0",
                }}
              >${error}</p>`
            : ""}
        </Card>

        ${this.renderResult()}

        <Card
          title="Map"
          subtitle="Country centre point, not the address's precise location"
          style=${{ marginTop: "20px" }}
        >
          ${countryMap.host}
        </Card>

        <Card
          title="Static data API"
          subtitle="Fetch these from any frontend"
          style=${{ marginTop: "20px" }}
        >
          <p style=${mutedStyle}>
            Chunks are generated from the same RIR data as the npm package.
            Special ranges (loopback, private, link-local, cgnat) are resolved
            in the client and are not present in the range files.
          </p>
          <code style=${codeBlockStyle}
>data/meta.json
data/details.json
data/flags/{CC}.json
data/ipv4/{0-255}.json   → [{s,e,c}, ...]
data/ipv6/{hhhh}.json    → [{su,eu,sl,el,c}, ...]</code>
          ${meta
            ? html`<p
                style=${{
                  ...mutedStyle,
                  marginTop: "12px",
                  marginBottom: "0",
                }}
              >
                Data version ${meta.version} · ${meta.ipv4Ranges} IPv4 ranges ·
                ${meta.ipv6Ranges} IPv6 ranges · generated ${meta.generatedAt}
              </p>`
            : ""}
        </Card>
      </main>
    `;
  }
}

Component.register(Ip2cApp);
