/**
 * ASCILINE Audio Bridge & Manager
 * =====================================
 * An independent, global event & sound bridge for ASCILINE physics and UI events.
 * Contains ZERO hardcoded sound files or paths. Gathers registered sounds dynamically.
 */
class AudioManager {
    constructor(options = {}) {
        this.sounds = {};
        this.soundSources = {};
        this.eventListeners = {};
        this.muted = false;
        this.masterVolume = options.masterVolume || 0.6;
        this.basePath = options.basePath || '';

        if (options.sources) {
            this.loadSoundSources(options.sources);
        }
    }

    /**
     * Configure base URL / directory path for audio assets
     */
    setBasePath(basePath) {
        this.basePath = basePath.endsWith('/') ? basePath : basePath + '/';
    }

    /**
     * Register a sound mapping for a generic event name (e.g. 'spawn', 'explode', 'bounce', 'click')
     */
    registerSound(eventName, pathOrUrl) {
        if (!pathOrUrl) return;
        this.soundSources[eventName] = pathOrUrl;
        
        const fullPath = pathOrUrl.startsWith('http') || pathOrUrl.startsWith('/') || pathOrUrl.startsWith('data:')
            ? pathOrUrl
            : this.basePath + pathOrUrl;
            
        try {
            const audio = new Audio(fullPath);
            audio.preload = 'auto';
            audio.onerror = () => {
                audio.isUnavailable = true;
            };
            this.sounds[eventName] = audio;
        } catch (e) {
            // Silently fallback if Audio constructor fails (e.g. non-browser test environment)
        }
    }

    /**
     * Bulk register sound mappings: { spawn: 'path/to/spawn.mp3', explode: 'path/to/explode.mp3' }
     */
    loadSoundSources(sourcesDict) {
        if (!sourcesDict || typeof sourcesDict !== 'object') return;
        for (const [eventName, path] of Object.entries(sourcesDict)) {
            this.registerSound(eventName, path);
        }
    }

    /**
     * Trigger / play a sound by event name
     */
    play(eventName, options = {}) {
        if (this.muted) return null;

        // Trigger custom JS event listeners if any registered
        this.emit(eventName, options);

        const baseAudio = this.sounds[eventName];
        if (!baseAudio || baseAudio.isUnavailable) {
            return null;
        }

        const {
            loop = false,
            volume = 1.0,
            overlap = true 
        } = options;

        try {
            const audioToPlay = overlap ? baseAudio.cloneNode() : baseAudio;
            if (!overlap) audioToPlay.currentTime = 0;

            audioToPlay.loop = loop;
            audioToPlay.volume = Math.max(0, Math.min(1, volume * this.masterVolume));

            const playPromise = audioToPlay.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    // Suppress browser autoplay restrictions
                });
            }

            return audioToPlay;
        } catch (err) {
            return null;
        }
    }

    /**
     * Stop a playing audio instance
     */
    stop(audioInstance) {
        if (audioInstance) {
            try {
                audioInstance.pause();
                audioInstance.currentTime = 0;
            } catch (e) {}
        }
    }

    /**
     * Subscribe to generic events (Global Event Bridge)
     */
    on(eventName, callback) {
        if (typeof callback !== 'function') return;
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    }

    /**
     * Emit generic events to subscribers
     */
    emit(eventName, data) {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName].forEach(fn => {
                try { fn(data); } catch (e) { console.error(e); }
            });
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }
}

// Expose global instance
if (typeof window !== 'undefined') {
    window.ASCILINE_AUDIO = window.ASCILINE_AUDIO || new AudioManager();
}
