import { createLucideIcon } from 'lucide-react-native';

export const Pram = createLucideIcon('Pram', [
    ['path', { d: 'M18.7 4.4 14.5 10', key: 'handle' }],
    ['path', { d: 'M13 10V2a8.1 8.1 0 0 1 8 8v1c0 1.7-1.3 3-3 3H6c-1.7 0-3-1.3-3-3v-1h18', key: 'carriage' }],
    ['path', { d: 'm8.2 18.4 3.3-4.4', key: 'frame-short' }],
    ['circle', { cx: '7', cy: '20', r: '2', key: 'wheel-left' }],
    ['path', { d: 'M15.8 18.4 5.6 4.8A1.94 1.94 0 0 0 2 6', key: 'frame-long' }],
    ['circle', { cx: '17', cy: '20', r: '2', key: 'wheel-right' }],
]);
