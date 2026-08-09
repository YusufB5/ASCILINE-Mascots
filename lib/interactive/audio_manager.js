class AudioManager {
    constructor() {
        this.sounds = {};
        this.muted = false;
        this.masterVolume = 0.6; // Base volume slightly lower for balance

        this.soundSources = {
            'catSpawn': 'assets/sounds/catSpawn.mp3',
            'dolphinSpawn': 'assets/sounds/dolphin-spawn.mp3',
            'dragonSpawn': 'assets/sounds/dragonSpawn.mp3',
            'defaultClick': 'assets/sounds/default-button-click.mp3',
            
            'bombFuse': 'assets/sounds/bomb/bombFuse.mp3',
            'bombExplode': 'assets/sounds/bomb/bombExplode.mp3',
            
            'excaliburSlide': 'assets/sounds/excalibur/excaliburPickSlide.mp3',
            'excaliburSuccess': 'assets/sounds/excalibur/excaliburPickSucsess.mp3',
            'excaliburRumble': 'assets/sounds/excalibur/excalibur-touch-rumble.mp3',
            'honoredCatsDrums': 'assets/sounds/honoredCatsDrums.mp3',

            'slimeJump': 'assets/sounds/slimejump.mp3',
            'bouncerBounce': 'assets/sounds/bouncing-effect.mp3',
            'blackholeExplode': 'assets/sounds/blackholeExplodeScfi.mp3'
        };

        this.preload();
    }

    preload() {
        for (const [alias, path] of Object.entries(this.soundSources)) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            this.sounds[alias] = audio;
        }
    }

    play(alias, options = {}) {
        if (this.muted) return null;
        if (!this.sounds[alias]) {
            console.warn(`Sound alias "${alias}" not found.`);
            return null;
        }

        const {
            loop = false,
            volume = 1.0,
            overlap = true 
        } = options;

        const baseAudio = this.sounds[alias];
        let audioToPlay;

        // If overlap is true, clone the node so multiple instances can play simultaneously
        if (overlap) {
            audioToPlay = baseAudio.cloneNode();
        } else {
            audioToPlay = baseAudio;
            audioToPlay.currentTime = 0; // reset to start
        }

        audioToPlay.loop = loop;
        audioToPlay.volume = volume * this.masterVolume;

        // Use a promise to catch and ignore play interruptions (e.g. user hasn't interacted yet)
        const playPromise = audioToPlay.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                // Auto-play was prevented by the browser. 
                // We silently ignore it until user interacts with the page.
                console.log(`Audio play prevented for ${alias}:`, error);
            });
        }

        return audioToPlay; // return instance in case caller wants to stop it later
    }

    stop(audioInstance) {
        if (audioInstance) {
            audioInstance.pause();
            audioInstance.currentTime = 0;
        }
    }
}

// Expose globally
window.ASCILINE_AUDIO = new AudioManager();
