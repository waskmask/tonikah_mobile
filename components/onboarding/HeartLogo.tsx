import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** Coral-gradient heart logomark from the design handoff (fixed colours in both themes). */
export function HeartLogo({ height }: { height: number }) {
    const width = height * (102.36 / 100);
    return (
        <Svg viewBox="0 0 102.36 100" width={width} height={height}>
            <Defs>
                <LinearGradient id="tn-heart" x1="0" y1="50" x2="102.36" y2="50" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor="#FF9C74" />
                    <Stop offset="0.83" stopColor="#EF5A86" />
                </LinearGradient>
            </Defs>
            <Path
                d="M60.82,58.07c-4.75,5.75-9.6,10.63-16.7,12.38,2.63,2.64,5.15,5.17,7.85,7.88,3.47-3.95,7.05-7.91,10.51-11.97,5.32-6.24,10.64-12.49,15.82-18.86,3.9-4.79,5.47-10.39,4.21-16.47-1.27-6.08-5.02-10.26-11.17-11.6-6.51-1.42-12.1.68-16.37,5.81-2.81,3.38-4.39,7.29-4.07,11.8-3.6-.2-6.53-2.89-7.4-6.69-1.97-8.58,2.57-19.41,10.49-25.04,12.69-9.02,30.01-6.3,40.21,6.32,11.67,14.43,10.84,34.82-2.59,48.46-13.28,13.48-27.05,26.48-40.84,39.91-1.73-1.74-4.14-4.14-6.53-6.55-11.51-11.59-23.23-22.97-34.47-34.82C-3.68,44.44-3.14,22.28,10.73,9.1,19.09,1.14,29-1.63,40.9,1.4c-8.1,3.89-14.76,8.82-18.27,16.86-3.54,8.1-3.38,16.34.48,24.29,5.66,11.64,19.45,20.03,37.7,15.52Z"
                fill="url(#tn-heart)"
            />
        </Svg>
    );
}
