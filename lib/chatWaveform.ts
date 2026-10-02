export function waveformPeaks(samples: number[], count: number): number[] {
    if (!samples.length || count <= 0) return [];
    const safe = samples.map((value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
    return Array.from({ length: count }, (_, index) => {
        const start = Math.floor(index * safe.length / count);
        const end = Math.max(start + 1, Math.ceil((index + 1) * safe.length / count));
        const bucket = safe.slice(start, end);
        const peak = Math.max(...bucket);
        const mean = bucket.reduce((sum, value) => sum + value, 0) / bucket.length;
        return Math.max(0, Math.min(1, peak * 0.7 + mean * 0.3));
    });
}
