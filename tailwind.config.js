/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          gradient: {
            start: "#F34B6F",
            end: "#E8447A",
            center: "#EE4976",
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
        secondary: "#E8447A",
      },
      fontFamily: {
        heading: ["Manrope_700Bold"],
        "heading-semi": ["Manrope_600SemiBold"],
        "heading-medium": ["Manrope_500Medium"],
        "heading-extra": ["Manrope_800ExtraBold"],
        body: ["Inter_400Regular"],
        "body-medium": ["Inter_500Medium"],
        "body-semi": ["Inter_600SemiBold"],
        "body-bold": ["Inter_700Bold"],
        arabic: ["NotoSansArabic_400Regular"],
        "arabic-semi": ["NotoSansArabic_600SemiBold"],
        "arabic-bold": ["NotoSansArabic_700Bold"],
      },
    },
  },
  plugins: [],
};
