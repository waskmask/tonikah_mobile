type Stage = 'tap' | 'close_ready' | 'dispatch' | 'focus' | 'focus_frame'
    | 'transition_start' | 'transition_end' | 'settled_frame';
type Measurement = {
    id: number;
    destination: string;
    stage: Stage;
    elapsedMs: number;
    sinceCloseMs?: number;
    sinceDispatchMs?: number;
};
type Sample = {
    id: number;
    destination: string;
    startedAt: number;
    closeAt?: number;
    dispatchAt?: number;
    routeKey?: string;
    focused: boolean;
    status: 'active' | 'canceled' | 'expired' | 'settled';
    measurements: Measurement[];
    frames: Set<number>;
};
type NativeEvent = { target?: string; data?: { closing?: boolean } };

const destinations = new Set([
    '/profile', '/hobbies-faith', '/partner-preference', '/language',
    '/memberships', '/verifications', '/blocked-users', '/settings',
]);
let sequence = 0;
let active: Sample | undefined;
let history: Sample[] | undefined;

function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now() : Date.now();
}

function stop(sample: Sample, status: Sample['status']) {
    sample.status = status;
    for (const frame of sample.frames) cancelAnimationFrame(frame);
    sample.frames.clear();
    if (active === sample) active = undefined;
}

function current(id?: number) {
    if (!__DEV__) return;
    if (active && now() - active.startedAt >= 30_000) stop(active, 'expired');
    return active && (id === undefined || active.id === id) ? active : undefined;
}

function record(sample: Sample, stage: Stage) {
    if (sample.measurements.some(mark => mark.stage === stage)) return;
    const time = now();
    const mark: Measurement = {
        id: sample.id, destination: sample.destination, stage,
        elapsedMs: Math.max(0, time - sample.startedAt),
        ...(sample.closeAt === undefined ? {} : { sinceCloseMs: Math.max(0, time - sample.closeAt) }),
        ...(sample.dispatchAt === undefined ? {} : { sinceDispatchMs: Math.max(0, time - sample.dispatchAt) }),
    };
    sample.measurements.push(mark);
    console.log(`[menu-navigation] ${JSON.stringify(mark)}`);
}

// These are JS frame milestones, not proof that native pixels are physically visible.
function afterTwoFrames(sample: Sample, stage: 'focus_frame' | 'settled_frame') {
    const schedule = (callback: () => void) => {
        const frame = requestAnimationFrame(() => {
            sample.frames.delete(frame);
            if (current(sample.id) === sample && sample.focused) callback();
        });
        sample.frames.add(frame);
    };
    schedule(() => schedule(() => {
        record(sample, stage);
        if (stage === 'settled_frame') stop(sample, 'settled');
    }));
}

export function beginMenuNavigation(destination: string): number | undefined {
    if (!__DEV__) return;
    const path = destination.split(/[?#]/, 1)[0];
    if (!destinations.has(path)) return;
    const previous = current();
    if (previous) stop(previous, 'canceled');
    const sample: Sample = {
        id: ++sequence, destination: path, startedAt: now(), focused: false,
        status: 'active', measurements: [], frames: new Set(),
    };
    active = sample;
    history ??= [];
    history.push(sample);
    if (history.length > 20) history.shift();
    record(sample, 'tap');
    return sample.id;
}

export function markMenuNavigation(id: number | undefined, stage: 'close_ready' | 'dispatch') {
    if (!__DEV__ || id === undefined) return;
    const sample = current(id);
    if (!sample) return;
    if (stage === 'close_ready') {
        if (sample.closeAt !== undefined || sample.dispatchAt !== undefined) return;
        sample.closeAt = now();
    } else {
        if (sample.closeAt === undefined || sample.dispatchAt !== undefined) return;
        sample.dispatchAt = now();
    }
    record(sample, stage);
}

export function cancelMenuNavigation(id: number | undefined) {
    if (!__DEV__ || id === undefined) return;
    const sample = current(id);
    if (sample) stop(sample, 'canceled');
}

export function menuNavigationScreenListeners({ route }: { route: { name: string; key: string } }) {
    if (!__DEV__) return {};
    const destination = route.name.startsWith('/') ? route.name : `/${route.name}`;
    // Navigation core re-evaluates this factory per event; lifecycle state belongs to the sample.
    const match = (event?: NativeEvent, claimRoute = true) => {
        const sample = current();
        if (!sample || sample.dispatchAt === undefined || sample.destination !== destination
            || (event?.target !== undefined && event.target !== route.key)
            || (sample.routeKey !== undefined && sample.routeKey !== route.key)) return;
        if (claimRoute) sample.routeKey = route.key;
        return sample;
    };
    return {
        focus: (event?: NativeEvent) => {
            const sample = match(event);
            if (!sample || sample.measurements.some(mark => mark.stage === 'focus')) return;
            sample.focused = true;
            record(sample, 'focus');
            afterTwoFrames(sample, 'focus_frame');
        },
        blur: (event?: NativeEvent) => {
            const sample = match(event, false);
            if (sample?.routeKey === route.key && sample.focused) stop(sample, 'canceled');
        },
        transitionStart: (event: NativeEvent) => {
            if (event.data?.closing !== false) return;
            const sample = match(event);
            if (!sample) return;
            record(sample, 'transition_start');
        },
        transitionEnd: (event: NativeEvent) => {
            if (event.data?.closing !== false) return;
            const sample = match(event, false);
            if (!sample || sample.routeKey !== route.key
                || !sample.measurements.some(mark => mark.stage === 'transition_start')
                || sample.measurements.some(mark => mark.stage === 'transition_end')) return;
            record(sample, 'transition_end');
            afterTwoFrames(sample, 'settled_frame');
        },
    };
}

export function getMenuNavigationMeasurements() {
    if (!__DEV__) return [];
    current();
    return (history ?? []).map(sample => ({
        id: sample.id, destination: sample.destination, status: sample.status,
        measurements: sample.measurements.map(mark => ({ ...mark })),
    }));
}
