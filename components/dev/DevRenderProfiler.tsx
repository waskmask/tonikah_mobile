import React from 'react';

export function DevRenderProfiler({ id, children }: { id: string; children: React.ReactNode }) {
    if (!__DEV__) return <>{children}</>;

    return (
        <React.Profiler
            id={id}
            onRender={(profileId, phase, actualDuration) => {
                if (actualDuration >= 24) {
                    console.debug(`[render] ${profileId}:${phase} ${Math.round(actualDuration)}ms`);
                }
            }}
        >
            {children}
        </React.Profiler>
    );
}
