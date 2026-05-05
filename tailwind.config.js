/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          gradient: {
            start: "#FE8A7B",
            end: "#F34B6F",
            center: "#F86774",
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
        primary: "#FE8A7B",
        secondary: "#F34B6F",
      },
      fontFamily: {
        heading: ["Manrope_700Bold"],
        "heading-semi": ["Manrope_600SemiBold"],
        "heading-medium": ["Manrope_500Medium"],
        "heading-extra": ["Manrope_800ExtraBold"],
        body: ["Inter_400Regular"],
        "body-medium": ["Inter_500Medium"],
        "body-semi": ["Inter_600SemiBold"],
        arabic: ["NotoSansArabic_400Regular"],
        "arabic-semi": ["NotoSansArabic_600SemiBold"],
        "arabic-bold": ["NotoSansArabic_700Bold"],
      },
    },
  },
  plugins: [],
};
