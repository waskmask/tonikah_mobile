type PausePlayback = () => void;
export type ChatAudioPlaybackOwner = symbol;

let activeOwner: ChatAudioPlaybackOwner | null = null;
let pauseActivePlayback: PausePlayback | null = null;

export function createChatAudioPlaybackOwner(label: string): ChatAudioPlaybackOwner {
    return Symbol(label);
}

export function claimChatAudioPlayback(owner: ChatAudioPlaybackOwner, pause: PausePlayback) {
    if (activeOwner !== owner) pauseActivePlayback?.();
    activeOwner = owner;
    pauseActivePlayback = pause;
}

export function releaseChatAudioPlayback(owner: ChatAudioPlaybackOwner) {
    if (activeOwner !== owner) return;
    activeOwner = null;
    pauseActivePlayback = null;
}
