var bkcore = bkcore || {};

bkcore.Audio = {};
bkcore.Audio.sounds = {};
bkcore.Audio.unlocked = false;
bkcore.Audio.unlockCallbacks = [];

bkcore.Audio.init = function(){
	if(window.AudioContext||window.webkitAudioContext){
		bkcore.Audio._ctx = new (window.AudioContext||window.webkitAudioContext)();
		bkcore.Audio._panner = bkcore.Audio._ctx.createPanner();
		bkcore.Audio._panner.connect(bkcore.Audio._ctx.destination);
		
		// Check if context is suspended (autoplay restrictions)
		if (bkcore.Audio._ctx.state === 'suspended') {
			console.info('Audio context is suspended - user interaction required to unlock audio');
			bkcore.Audio._setupUnlockListeners();
		} else {
			bkcore.Audio.unlocked = true;
		}
	}
	else {
		bkcore.Audio._ctx = null;
	}

	bkcore.Audio.posMultipler = 1.5;
};

bkcore.Audio.init();

/*
  @private - Setup listeners to unlock audio on user interaction
 */
bkcore.Audio._setupUnlockListeners = function() {
	var unlock = function() {
		if (bkcore.Audio.unlocked) return;
		
		// Create and play a silent sound to unlock the audio context
		if (bkcore.Audio._ctx && bkcore.Audio._ctx.state === 'suspended') {
			// Create a buffer source with a silent buffer
			var buffer = bkcore.Audio._ctx.createBuffer(1, 1, 22050);
			var source = bkcore.Audio._ctx.createBufferSource();
			source.buffer = buffer;
			source.connect(bkcore.Audio._ctx.destination);
			source.start(0);
			
			// Resume the context
			bkcore.Audio._ctx.resume().then(function() {
				console.log('Audio context unlocked successfully');
				bkcore.Audio.unlocked = true;
				bkcore.Audio._processUnlockCallbacks();
			}).catch(function(error) {
				console.error('Failed to unlock audio context:', error);
			});
		}
		
		// Remove the event listeners after first interaction
		document.removeEventListener('touchstart', unlock, true);
		document.removeEventListener('touchend', unlock, true);
		document.removeEventListener('mousedown', unlock, true);
		document.removeEventListener('keydown', unlock, true);
		document.removeEventListener('click', unlock, true);
	};
	
	// Add multiple event listeners to catch the first user interaction
	document.addEventListener('touchstart', unlock, true);
	document.addEventListener('touchend', unlock, true);
	document.addEventListener('mousedown', unlock, true);
	document.addEventListener('keydown', unlock, true);
	document.addEventListener('click', unlock, true);
};

/*
  @private - Process callbacks waiting for audio unlock
 */
bkcore.Audio._processUnlockCallbacks = function() {
	while (bkcore.Audio.unlockCallbacks.length > 0) {
		var callback = bkcore.Audio.unlockCallbacks.shift();
		try {
			callback();
		} catch (error) {
			console.error('Error in audio unlock callback:', error);
		}
	}
};

/*
  @public - Add a callback to be called when audio is unlocked
 */
bkcore.Audio.onUnlock = function(callback) {
	if (bkcore.Audio.unlocked) {
		// If already unlocked, call immediately
		try {
			callback();
		} catch (error) {
			console.error('Error in audio unlock callback:', error);
		}
	} else {
		// Otherwise, queue for later
		bkcore.Audio.unlockCallbacks.push(callback);
	}
};

bkcore.Audio.addSound = function(src, id, loop, callback, usePanner){
	var ctx = bkcore.Audio._ctx;
	var audio = new Audio();
	
	if(ctx){
		var audio = { src: null, gainNode: null, bufferNode: null, loop: loop };
		var xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';

		xhr.onload = function(){
			ctx.decodeAudioData(xhr.response, function(b){
				// Create Gain Node
				var gainNode = ctx.createGain();

				if(usePanner === true){
					gainNode.connect(bkcore.Audio._panner);
				}
				else {
					gainNode.connect(ctx.destination);
				}

				// Add the audio source
				audio.src = b;

				//Remember the gain node
				audio.gainNode = gainNode;
				
				// Call the callback
				if (callback) {
					callback();
				}
			}, function(e){
				console.error('Audio decode failed!', e);
				if (callback) {
					callback();
				}
			});
		};

		xhr.onerror = function() {
			console.error('Failed to load audio:', src);
			if (callback) {
				callback();
			}
		};

		xhr.open('GET', src, true);
		xhr.send(null);
	}
	else {
		// Workaround for old Safari
		audio.addEventListener('canplay', function(){
			audio.pause();
			audio.currentTime = 0;

			if (callback) {
				callback();
			}
		}, false);

		audio.addEventListener('error', function(e) {
			console.error('Audio element error:', e);
			if (callback) {
				callback();
			}
		}, false);

		audio.autoplay = true;
		audio.loop = loop;
		audio.src = src;
	}
	
	bkcore.Audio.sounds[id] = audio;
};

bkcore.Audio.play = function(id){
	var ctx = bkcore.Audio._ctx;

	if(ctx){
		// Check if audio is unlocked
		if (!bkcore.Audio.unlocked) {
			console.warn('Audio not unlocked yet - deferring play of:', id);
			// Queue the play to happen after unlock
			bkcore.Audio.onUnlock(function() {
				bkcore.Audio._playWithContext(id);
			});
			return;
		}
		
		bkcore.Audio._playWithContext(id);
	}
	else {
		if(bkcore.Audio.sounds[id].currentTime > 0){
			bkcore.Audio.sounds[id].pause();
			bkcore.Audio.sounds[id].currentTime = 0;
		}

		bkcore.Audio.sounds[id].play().catch(function(error) {
			console.warn('Audio play failed:', error);
		});
	}
};

/*
  @private - Internal method to play audio with Web Audio API
 */
bkcore.Audio._playWithContext = function(id) {
	var ctx = bkcore.Audio._ctx;
	var sound = bkcore.Audio.sounds[id];
	
	if (!sound || !sound.src) {
		console.warn('Sound not found or not loaded:', id);
		return;
	}
	
	// Stop previous instance if playing
	if (sound.bufferNode !== null) {
		try {
			sound.bufferNode.stop(ctx.currentTime);
		} catch (e) {
			// Ignore errors from stopping already stopped nodes
		}
	}
	
	var bufferSource = ctx.createBufferSource();
	bufferSource.connect(sound.gainNode);
	
	bufferSource.buffer = sound.src;
	bufferSource.loop = sound.loop;

	sound.gainNode.gain.value = 1;
	sound.bufferNode = bufferSource;

	try {
		bufferSource.start(0);
	} catch (error) {
		console.error('Failed to start audio source:', error);
	}
};

bkcore.Audio.stop = function(id){
	var ctx = bkcore.Audio._ctx;

	if(ctx){
		if(bkcore.Audio.sounds[id] && bkcore.Audio.sounds[id].bufferNode !== null){
			var bufferNode = bkcore.Audio.sounds[id].bufferNode;
			try {
				bufferNode.stop ? bufferNode.stop(ctx.currentTime) : bufferNode.noteOff(ctx.currentTime);
			} catch (error) {
				// Ignore errors from stopping already stopped nodes
			}
			bkcore.Audio.sounds[id].bufferNode = null;
		}
	}
	else {
		if(bkcore.Audio.sounds[id]){
			bkcore.Audio.sounds[id].pause();
			bkcore.Audio.sounds[id].currentTime = 0;
		}
	}
};

bkcore.Audio.volume = function(id, volume){
	var ctx = bkcore.Audio._ctx;

	if(ctx){
		if(bkcore.Audio.sounds[id] && bkcore.Audio.sounds[id].gainNode){
			bkcore.Audio.sounds[id].gainNode.gain.value = volume;
		}
	}
	else {
		if(bkcore.Audio.sounds[id]){
			bkcore.Audio.sounds[id].volume = volume;
		}
	}
};

bkcore.Audio.setListenerPos = function(vec){
	if(bkcore.Audio._ctx){
		var panner = bkcore.Audio._panner;
		var vec2 = vec.normalize();
		panner.setPosition(
			vec2.x * bkcore.Audio.posMultipler,
			vec2.y * bkcore.Audio.posMultipler,
			vec2.z * bkcore.Audio.posMultipler
		);
	}
};

bkcore.Audio.setListenerVelocity = function(vec){
	if(bkcore.Audio._ctx){
		var panner = bkcore.Audio._panner;
		//panner.setVelocity(vec.x, vec.y, vec.z);
	}
};

/*
  @public - Check if audio is unlocked
 */
bkcore.Audio.isUnlocked = function() {
	return bkcore.Audio.unlocked;
};

/*
  @public - Force unlock audio (call from user interaction handler)
 */
bkcore.Audio.forceUnlock = function() {
	if (bkcore.Audio._ctx && bkcore.Audio._ctx.state === 'suspended') {
		return bkcore.Audio._ctx.resume().then(function() {
			bkcore.Audio.unlocked = true;
			bkcore.Audio._processUnlockCallbacks();
			return true;
		}).catch(function(error) {
			console.error('Failed to force unlock audio:', error);
			return false;
		});
	}
	return Promise.resolve(true);
};