const themeInitScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("fortexa-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "light";
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export function ThemeInitScript() {
  return (
    <script
      id="fortexa-theme-init"
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
