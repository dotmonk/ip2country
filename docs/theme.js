const JANUS_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const greenTheme = {
  id: "green",
  name: "Green",
  dark: {
    bg: "#0c120e",
    surface: "#151c17",
    raised: "#1d2820",
    border: "#2e3d32",
    borderStrong: "#6f8575",
    text: "#e6efe8",
    textMuted: "#93a696",
    accent: "#6dcf7a",
    success: "#5ed98a",
    warning: "#e8b04a",
    error: "#f07870",
    info: "#7ab8a0",
    focus: "#6dcf7a",
    shadow: "0 8px 24px rgba(0, 0, 0, 0.48)",
    radius: "6px",
    font: JANUS_FONT,
  },
  light: {
    bg: "#f0f4f0",
    surface: "#ffffff",
    raised: "#ffffff",
    border: "#c8d4c9",
    borderStrong: "#4f6554",
    text: "#121a14",
    textMuted: "#4a5c4e",
    accent: "#1a6b2e",
    success: "#136a43",
    warning: "#8a5200",
    error: "#a82028",
    info: "#1a5c48",
    focus: "#1a6b2e",
    shadow: "0 8px 24px rgba(20, 40, 24, 0.12)",
    radius: "6px",
    font: JANUS_FONT,
  },
};

const tokensToCss = (tokens, colorScheme) => `
  color-scheme: ${colorScheme};
  --janus-bg: ${tokens.bg};
  --janus-surface: ${tokens.surface};
  --janus-raised: ${tokens.raised};
  --janus-border: ${tokens.border};
  --janus-border-strong: ${tokens.borderStrong};
  --janus-text: ${tokens.text};
  --janus-text-muted: ${tokens.textMuted};
  --janus-accent: ${tokens.accent};
  --janus-success: ${tokens.success};
  --janus-warning: ${tokens.warning};
  --janus-error: ${tokens.error};
  --janus-info: ${tokens.info};
  --janus-focus: ${tokens.focus};
  --janus-shadow: ${tokens.shadow};
  --janus-radius: ${tokens.radius};
  --janus-font: ${tokens.font};
`;

const themeStylesheet = `
:root {
  ${tokensToCss(greenTheme.dark, "dark")}
}

@media (prefers-color-scheme: light) {
  :root:not([data-janus-theme="dark"]) {
    ${tokensToCss(greenTheme.light, "light")}
  }
}

:root[data-janus-theme="light"] {
  ${tokensToCss(greenTheme.light, "light")}
}

:root[data-janus-theme="dark"] {
  ${tokensToCss(greenTheme.dark, "dark")}
}
`;

export const ensureGreenTheme = () => {
  if (typeof document === "undefined" || !document.head) {
    return;
  }
  if (document.getElementById("ip2c-green-theme")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "ip2c-green-theme";
  style.textContent = themeStylesheet;
  document.head.appendChild(style);
};
