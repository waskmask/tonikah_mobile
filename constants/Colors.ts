export type ThemePalette = (typeof Colors)["light"];

/**
 * Semantic aliases shared by both themes are defined below the palette.
 * Screens must consume colors via useColors() — never hardcode hex values.
 */
export const Colors = {
    light: {
        brand: {
            gradient: {
                start: "#FF927B",
                end: "#F34B6F",
                center: "#F97078",
            },
            text: {
                heading: "#1A1512",
                body: "#201B15",
                subtitle: "#7D7266",
                muted: "#A99C8D",
            },
            bg: {
                primary: "#FFFFFF",
                surface: "#F7F3ED",
                border: "#E8E1D6",
            },
            accent: {
                link: "#4B68C4",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
            },
            pagination: {
                active: "#221B14",
                inactive: "#D9D2C7",
            },
        },
        chrome: {
            primary: "#F34B6F",
            primaryEnd: "#F34B6F",
            loader: {
                background: "#FFFFFF",
                spinner: "#F34B6F",
            },
            header: {
                background: "#FFFFFF",
                border: "#E8E1D6",
                title: "#1A1512",
                subtitle: "#7D7266",
                icon: "#5C5348",
                iconBackground: "#F7F3ED",
            },
            tabBar: {
                background: "rgba(255, 255, 255, 0.98)",
                border: "#F0EAE0",
                active: "#F34B6F",
                inactive: "#988D80",
                activePill: "rgba(243, 75, 111, 0.12)",
            },
            badge: {
                background: "#F34B6F",
                text: "#FFFFFF",
                border: "rgba(255, 255, 255, 0.98)",
            },
            toast: {
                success: { bg: "#F0FDF4", border: "#22C55E", text: "#166534", icon: "#22C55E" },
                error: { bg: "#FEF2F2", border: "#EF4444", text: "#991B1B", icon: "#EF4444" },
                warning: { bg: "#FFFBEB", border: "#F59E0B", text: "#92400E", icon: "#F59E0B" },
                info: { bg: "#EFF6FF", border: "#3B82F6", text: "#1E40AF", icon: "#3B82F6" },
            },
            explore: {
                screen: "#F7F3ED",
                actionBar: "#FAFAF8",
                actionCircle: "#FFFFFF",
            },
            common: {
                card: "#FFFFFF",
                cardAlt: "#F4EEE6",
                inverseText: "#FFFFFF",
                textStrong: "#241E17",
                textSubtle: "#7D7266",
                textMuted: "#9A9083",
                iconNeutral: "#8A8073",
                shadow: "#1A130D",
                blueAction: "#38A8E8",
                successStrong: "#22C55E",
                primaryTint: "rgba(243,75,111,0.08)",
                primaryGlow: "rgba(243,75,111,0.24)",
                primaryRing: "rgba(243,75,111,0.45)",
                dangerTint: "rgba(244,63,94,0.10)",
                dangerRing: "rgba(244,63,94,0.5)",
                blueTint: "rgba(56,168,232,0.12)",
                blueRing: "rgba(56,168,232,0.5)",
                neutralRing: "rgba(122,132,128,0.35)",
                darkOverlaySoft: "rgba(24, 19, 14,0.34)",
                darkOverlayMedium: "rgba(24, 19, 14,0.54)",
                darkOverlayStrong: "rgba(24, 19, 14,0.82)",
                hairline: "rgba(160, 146, 128,0.18)",
                seenTick: "#38BDF8",
            },
        },
    },
    dark: {
        brand: {
            gradient: {
                start: "#FF927B",
                end: "#F34B6F",
                center: "#F97078",
            },
            text: {
                heading: "#F4EEE6",
                body: "#E8E1D6",
                subtitle: "#A99C8D",
                muted: "#7D7266",
            },
            bg: {
                primary: "#141210",
                surface: "#211D18",
                border: "#3A332B",
            },
            accent: {
                link: "#4B68C4",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
            },
            pagination: {
                active: "#F4EEE6",
                inactive: "#3A332B",
            },
        },
        chrome: {
            primary: "#F34B6F",
            primaryEnd: "#F34B6F",
            loader: {
                background: "#141210",
                spinner: "#F34B6F",
            },
            header: {
                background: "#1B1713",
                border: "#3A332B",
                title: "#F4EEE6",
                subtitle: "#A99C8D",
                icon: "#D8CFC2",
                iconBackground: "#211D18",
            },
            tabBar: {
                background: "rgba(33, 29, 24, 0.98)",
                border: "#3A332B",
                active: "#F34B6F",
                inactive: "#B3A797",
                activePill: "rgba(243, 75, 111, 0.18)",
            },
            badge: {
                background: "#F34B6F",
                text: "#FFFFFF",
                border: "rgba(33, 29, 24, 0.98)",
            },
            toast: {
                success: { bg: "rgba(20, 83, 45, 0.35)", border: "#22C55E", text: "#BBF7D0", icon: "#4ADE80" },
                error: { bg: "rgba(127, 29, 29, 0.35)", border: "#EF4444", text: "#FECACA", icon: "#F87171" },
                warning: { bg: "rgba(120, 53, 15, 0.35)", border: "#F59E0B", text: "#FDE68A", icon: "#FBBF24" },
                info: { bg: "rgba(30, 58, 138, 0.35)", border: "#3B82F6", text: "#BFDBFE", icon: "#60A5FA" },
            },
            explore: {
                screen: "#141210",
                actionBar: "#211D18",
                actionCircle: "#141210",
            },
            common: {
                card: "#1B1713",
                cardAlt: "#211D18",
                inverseText: "#FFFFFF",
                textStrong: "#E8E1D6",
                textSubtle: "#A99C8D",
                textMuted: "#9A9083",
                iconNeutral: "#B3A797",
                shadow: "#000000",
                blueAction: "#38A8E8",
                successStrong: "#22C55E",
                primaryTint: "rgba(243,75,111,0.12)",
                primaryGlow: "rgba(243,75,111,0.24)",
                primaryRing: "rgba(243,75,111,0.45)",
                dangerTint: "rgba(244,63,94,0.12)",
                dangerRing: "rgba(244,63,94,0.5)",
                blueTint: "rgba(56,168,232,0.14)",
                blueRing: "rgba(56,168,232,0.5)",
                neutralRing: "rgba(122,132,128,0.35)",
                darkOverlaySoft: "rgba(24, 19, 14,0.34)",
                darkOverlayMedium: "rgba(24, 19, 14,0.54)",
                darkOverlayStrong: "rgba(24, 19, 14,0.82)",
                hairline: "rgba(160, 146, 128,0.18)",
                seenTick: "#38BDF8",
            },
        },
    },
};

/** Theme-independent brand primary for static StyleSheets (same in light/dark). */
export const BRAND_PRIMARY = Colors.light.chrome.primary;
