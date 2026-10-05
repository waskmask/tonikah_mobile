import { useEffect, useRef } from 'react';
import { PixelRatio, StyleSheet, View, type ImageURISource } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Image as SvgImage } from 'react-native-svg';

export type NativeTabAvatar = { url: string; source: ImageURISource };

type Props = {
    url: string;
    size: number;
    onReady: (avatar: NativeTabAvatar) => void;
};

// Give UIKit a bounded circular bitmap so it can lay out the icon and badge together.
export function NativeTabAvatarRenderer({ url, size, onReady }: Props) {
    const svg = useRef<Svg>(null);
    const active = useRef(true);
    const exporting = useRef(false);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, []);

    const exportAvatar = () => {
        if (exporting.current) return;
        exporting.current = true;
        frame.current = requestAnimationFrame(() => {
            if (!active.current) return;
            svg.current?.toDataURL((base64) => {
                if (!active.current || !base64) return;
                onReady({
                    url,
                    source: {
                        uri: `data:image/png;base64,${base64}`,
                        width: size,
                        height: size,
                        scale: PixelRatio.get(),
                    },
                });
            }, { width: size, height: size });
        });
    };

    return (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.renderer, { width: size, height: size }]}>
            <Svg ref={svg} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Defs>
                    <ClipPath id="tabAvatarCircle">
                        <Circle cx={size / 2} cy={size / 2} r={size / 2} />
                    </ClipPath>
                </Defs>
                <SvgImage
                    href={{ uri: url }}
                    width={size}
                    height={size}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath="url(#tabAvatarCircle)"
                    onLoad={exportAvatar}
                />
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    renderer: { position: 'absolute', top: 0, left: 0, opacity: 0 },
});
