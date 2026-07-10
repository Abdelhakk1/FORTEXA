const DASHBOARD_LOCALE = "en-US";

export function formatDashboardCount(
  value: number,
  locale = DASHBOARD_LOCALE
) {
  const exact = new Intl.NumberFormat(locale).format(value);

  return {
    exact,
    display:
      Math.abs(value) < 1_000
        ? exact
        : new Intl.NumberFormat(locale, {
            notation: "compact",
            compactDisplay: "short",
            maximumFractionDigits: 1,
          }).format(value),
  };
}

export interface DashboardTooltipItem {
  marker?: string;
  seriesName?: string;
  value?: unknown;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character
  );
}

function tooltipNumber(value: unknown) {
  const candidate = Array.isArray(value) ? value.at(-1) : value;
  const number = typeof candidate === "number" ? candidate : Number(candidate);

  return Number.isFinite(number) ? number : 0;
}

export function formatDashboardTooltip(
  heading: string,
  items: DashboardTooltipItem | DashboardTooltipItem[]
) {
  const rows = Array.isArray(items) ? items : [items];

  return [
    `<strong>${escapeHtml(heading)}</strong>`,
    ...rows.map(
      (item) =>
        `${item.marker ?? ""}${escapeHtml(item.seriesName ?? "Value")}: ${
          formatDashboardCount(tooltipNumber(item.value)).exact
        }`
    ),
  ].join("<br/>");
}
