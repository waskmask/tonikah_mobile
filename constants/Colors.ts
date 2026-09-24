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
                surface: "#FFFFFF",
                border: "#EEEEEE",
                // Kept as a compatibility alias; the UI uses one divider tone.
                borderStrong: "#EEEEEE",
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
                border: "#EEEEEE",
                title: "#1A1512",
                subtitle: "#7D7266",
                icon: "#5C5348",
                iconBackground: "#F4F4F4",
            },
            tabBar: {
                background: "rgba(255, 255, 255, 0.98)",
                border: "#EEEEEE",
                active: "#F34B6F",
                inactive: "#55555B",
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
                screen: "#FFFFFF",
                actionBar: "#FFFFFF",
                actionCircle: "#FFFFFF",
            },
            common: {
                card: "#FFFFFF",
                cardAlt: "#FFFFFF",
                subtleSurface: "#F4F4F4",
                skeleton: "#F4F4F4",
                inverseText: "#FFFFFF",
                textStrong: "#241E17",
                textSubtle: "#7D7266",
                textMuted: "#737378",
                iconNeutral: "#8A8073",
                shadow: "#1A130D",
                blueAction: "#38A8E8",
                successStrong: "#22C55E",
                primaryTint: "rgba(243,75,111,0.08)",
                // Solid equivalent of primaryTint over white — opaque chat bubble
                bubbleMine: "#FEF0F3",
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
                heading: "#F5F5F5",
                body: "#E5E5E7",
                subtitle: "#B0B0B5",
                muted: "#77777F",
            },
            bg: {
                primary: "#101011",
                surface: "#18181A",
                border: "#303033",
                // Kept as a compatibility alias; the UI uses one divider tone.
                borderStrong: "#303033",
            },
            accent: {
                link: "#9BB0FF",
                success: "#10B981",
                warning: "#F59E0B",
                error: "#EF4444",
            },
            pagination: {
                active: "#F5F5F5",
                inactive: "#303033",
            },
        },
        chrome: {
            primary: "#F34B6F",
            primaryEnd: "#F34B6F",
            loader: {
                background: "#101011",
                spinner: "#F34B6F",
            },
            header: {
                background: "#101011",
                border: "#303033",
                title: "#F5F5F5",
                subtitle: "#B0B0B5",
                icon: "#DEDEE2",
                iconBackground: "#29292C",
            },
            tabBar: {
                background: "#18181A",
                border: "#303033",
                active: "#F34B6F",
                inactive: "#A9A9B0",
                activePill: "rgba(243, 75, 111, 0.18)",
            },
            badge: {
                background: "#F34B6F",
                text: "#FFFFFF",
                border: "#18181A",
            },
            toast: {
                success: { bg: "#173226", border: "#35B66A", text: "#F7FAF8", icon: "#56D487" },
                error: { bg: "#3A2023", border: "#E85D68", text: "#FFF7F7", icon: "#FF7A83" },
                warning: { bg: "#3A2D1B", border: "#D99A2B", text: "#FFF9ED", icon: "#F2B84B" },
                info: { bg: "#1D2E45", border: "#4A8ED8", text: "#F6F9FD", icon: "#73AEEF" },
            },
            explore: {
                screen: "#101011",
                actionBar: "#101011",
                actionCircle: "#18181A",
            },
            common: {
                card: "#1D1D1F",
                cardAlt: "#18181A",
                subtleSurface: "#29292C",
                skeleton: "#303033",
                inverseText: "#FFFFFF",
                textStrong: "#E5E5E7",
                textSubtle: "#B0B0B5",
                textMuted: "#92929A",
                iconNeutral: "#B8B8BE",
                shadow: "#000000",
                blueAction: "#38A8E8",
                successStrong: "#22C55E",
                primaryTint: "rgba(243,75,111,0.12)",
                // Solid equivalent of primaryTint over the dark body — opaque chat bubble
                bubbleMine: "#2F191B",
                primaryGlow: "rgba(243,75,111,0.24)",
                primaryRing: "rgba(243,75,111,0.45)",
                dangerTint: "rgba(244,63,94,0.12)",
                dangerRing: "rgba(244,63,94,0.5)",
                blueTint: "rgba(56,168,232,0.14)",
                blueRing: "rgba(56,168,232,0.5)",
                neutralRing: "rgba(122,132,128,0.35)",
                darkOverlaySoft: "rgba(16, 16, 17,0.34)",
                darkOverlayMedium: "rgba(16, 16, 17,0.54)",
                darkOverlayStrong: "rgba(16, 16, 17,0.82)",
                hairline: "rgba(180, 180, 188,0.18)",
                seenTick: "#38BDF8",
            },
        },
    },
};

/** Theme-independent brand primary for static StyleSheets (same in light/dark). */
export const BRAND_PRIMARY = Colors.light.chrome.primary;
