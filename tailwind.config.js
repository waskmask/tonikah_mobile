/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // ThemeSync drives the scheme via setColorScheme(); class mode is required
  // for the `.dark { --vars }` block in global.css to ever apply.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          gradient: {
            start: "#FF927B",
            end: "#F34B6F",
            center: "#F97078",
          },
          text: {
            heading: "var(--brand-text-heading)",
            body: "var(--brand-text-body)",
            subtitle: "var(--brand-text-subtitle)",
            muted: "var(--brand-text-muted)",
          },
          bg: {
            primary: "var(--brand-bg-primary)",
            surface: "var(--brand-bg-surface)",
            border: "var(--brand-bg-border)",
          },
          accent: {
            link: "#4B68C4",
            success: "#10B981",
            warning: "#F59E0B",
            error: "#EF4444",
          },
          pagination: {
            active: "var(--brand-pagination-active)",
            inactive: "var(--brand-pagination-inactive)",
          },
        },
        // Mapped for developer convenience
        primary: "#F34B6F",
        secondary: "#FF927B",
      },
      fontFamily: {
        heading: ["PlusJakartaSans_700Bold"],
        "heading-semi": ["PlusJakartaSans_600SemiBold"],
        "heading-medium": ["PlusJakartaSans_500Medium"],
        "heading-extra": ["PlusJakartaSans_800ExtraBold"],
        body: ["PlusJakartaSans_400Regular"],
        "body-medium": ["PlusJakartaSans_500Medium"],
        "body-semi": ["PlusJakartaSans_600SemiBold"],
        "body-bold": ["PlusJakartaSans_700Bold"],
        arabic: ["NotoSansArabic_400Regular"],
        "arabic-semi": ["NotoSansArabic_600SemiBold"],
        "arabic-bold": ["NotoSansArabic_700Bold"],
      },
    },
  },
  plugins: [],
};
