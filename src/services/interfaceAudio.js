export const INTERFACE_AUDIO_SOURCES = {
  slide: 'https://cdn.freesound.org/previews/367/367997_6512973-lq.mp3',
  accept: 'https://cdn.freesound.org/previews/220/220166_4100837-lq.mp3',
  reject: 'https://cdn.freesound.org/previews/657/657950_6142149-lq.mp3',
  hoverOption: 'https://cdn.freesound.org/previews/370/370962_5450487-lq.mp3',
  hoverButton: 'https://cdn.freesound.org/previews/703/703884_6142149-lq.mp3',
  keystroke: 'https://cdn.freesound.org/previews/185/185828_2567799-lq.mp3',
  terminal: 'https://cdn.freesound.org/previews/512/512137_11214653-lq.mp3',
};

export function createInterfaceAudio({ createAudio, onError, onReady }) {
  const tracks = new Map();
  let enabled = true;
  let disposed = false;
  let activeTrack = null;
  let request = 0;

  const stop = () => {
    request += 1;
    if (activeTrack) activeTrack.pause();
    activeTrack = null;
  };

  return {
    setEnabled(value) {
      enabled = value;
      if (!enabled) stop();
    },
    async play(kind) {
      if (!Object.hasOwn(INTERFACE_AUDIO_SOURCES, kind)) {
        throw new Error(`Unknown interface sound: ${kind}`);
      }
      if (!enabled || disposed) return;
      stop();
      const currentRequest = request;
      try {
        if (!tracks.has(kind)) {
          const audio = createAudio(INTERFACE_AUDIO_SOURCES[kind]);
          audio.preload = 'none';
          audio.volume = 0.25;
          tracks.set(kind, audio);
        }
        const audio = tracks.get(kind);
        activeTrack = audio;
        audio.currentTime = 0;
        await audio.play();
        if (!disposed && currentRequest === request) onReady();
      } catch (error) {
        // Pausing a superseded track can reject its pending play() promise.
        if (!disposed && currentRequest === request) {
          const failedTrack = tracks.get(kind);
          if (failedTrack) {
            failedTrack.pause();
            failedTrack.removeAttribute('src');
            failedTrack.load();
            tracks.delete(kind);
            activeTrack = null;
          }
          onError(error);
        }
      }
    },
    dispose() {
      disposed = true;
      stop();
      for (const audio of tracks.values()) {
        audio.removeAttribute('src');
        audio.load();
      }
      tracks.clear();
    },
  };
}
