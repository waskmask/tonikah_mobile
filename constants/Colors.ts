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
                // One step darker than border — list dividers on warm surfaces
                borderStrong: "#DCD2C3",
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
                // Warm chrome: header + status bar + page read as one surface
                background: "#F7F3ED",
                border: "#E8E1D6",
                title: "#1A1512",
                subtitle: "#7D7266",
                icon: "#5C5348",
                // One step deeper than the warm bar so chips stay visible
                iconBackground: "#ECE6DE",
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
                actionBar: "#F7F3ED",
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
                heading: "#F4EEE6",
                body: "#E8E1D6",
                subtitle: "#A99C8D",
                muted: "#7D7266",
            },
            bg: {
                primary: "#141210",
                surface: "#211D18",
                border: "#3A332B",
                // One step stronger than border — list dividers on dark surfaces
                borderStrong: "#4A4136",
            },
            accent: {
                link: "#9BB0FF",
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
                // Matches the dark page/status-bar surface (see light header note)
                background: "#141210",
                border: "#3A332B",
                title: "#F4EEE6",
                subtitle: "#A99C8D",
                icon: "#D8CFC2",
                iconBackground: "#2C2925",
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
                success: { bg: "#173226", border: "#35B66A", text: "#F7FAF8", icon: "#56D487" },
                error: { bg: "#3A2023", border: "#E85D68", text: "#FFF7F7", icon: "#FF7A83" },
                warning: { bg: "#3A2D1B", border: "#D99A2B", text: "#FFF9ED", icon: "#F2B84B" },
                info: { bg: "#1D2E45", border: "#4A8ED8", text: "#F6F9FD", icon: "#73AEEF" },
            },
            explore: {
                screen: "#141210",
                actionBar: "#141210",
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
                // Solid equivalent of primaryTint over the dark body — opaque chat bubble
                bubbleMine: "#2F191B",
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
