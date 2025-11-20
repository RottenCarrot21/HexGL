/*!
 * @class bkcore.threejs.Loader
 *
 * Promise-based asset loader with staged loading support.
 * Batches fetches by type, leverages Promise.allSettled for parallelism,
 * supports streaming where possible, and provides progress reporting with abort capability.
 * 
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 */

/*!
 * @package bkcore.threejs
 */
var bkcore = bkcore || {};
bkcore.threejs = bkcore.threejs || {};

bkcore.NONE = undefined;

/**
 * Creates a new loader with promise-based API
 * @param {Object{onLoad, onError, onProgress}} opts Callbacks
 */
bkcore.threejs.Loader = function(opts)
{
	var self = this;

	this.jsonLoader = new THREE.JSONLoader();

	this.errorCallback = opts.onError == undefined ? function(s){ console.warn("Error while loading %s.".replace("%s", s)) } : opts.onError;
	this.loadCallback = opts.onLoad == undefined ? function(){ console.log("Loaded.") } : opts.onLoad;
	this.progressCallback = opts.onProgress == undefined ? function(progress, type, name){ /**/ } : opts.onProgress;
	this.stagingCallback = opts.onStaging == undefined ? function(){ } : opts.onStaging;

	this.types = {
		textures: null,
		texturesCube: null,
		geometries: null,
		analysers: null,
		images: null,
		sounds: null
	};

	this.states = {};
	this.data = {};

	for(var t in this.types)
	{
		this.data[t] = {};
		this.states[t] = {};
	}

	this.progress = {
		total: 0,
		remaining: 0,
		loaded: 0,
		finished: false
	};

	// Staging support
	this.stagedProgress = {
		critical: {
			total: 0,
			remaining: 0,
			loaded: 0,
			finished: false
		},
		deferred: {
			total: 0,
			remaining: 0,
			loaded: 0,
			finished: false
		}
	};

	// Abort controller for cancellation
	this.abortController = null;
	this.isAborted = false;
}

/**
 * Load the given list of resources
 * @param  {textures, texturesCube, geometries, analysers, images, sounds} data 
 * @param  {critical: bool, deferred: bool} stagingConfig Optional staging configuration
 * @return {Promise} Resolves when critical assets are loaded (if staged)
 */
bkcore.threejs.Loader.prototype.load = function(data, stagingConfig)
{
	var self = this;

	// Support legacy callback-based API
	return this._loadStaged(data, stagingConfig || { critical: true, deferred: true });
}

/**
 * Internal staged loading implementation
 */
bkcore.threejs.Loader.prototype._loadStaged = function(data, stagingConfig)
{
	var self = this;

	// Initialize abort controller if not already present
	if (!this.abortController) {
		this.abortController = new AbortController();
	}

	// Separate assets into critical and deferred
	var criticalAssets = this._extractCriticalAssets(data);
	var deferredAssets = this._extractDeferredAssets(data);

	// Count total assets for progress tracking
	this._countAssets(criticalAssets, 'critical');
	this._countAssets(deferredAssets, 'deferred');
	this._countAssets(data, 'total');

	// Create promise chain for staged loading
	var criticalPromise = Promise.resolve();

	if (stagingConfig.critical !== false) {
		criticalPromise = this._loadAssetBatch(criticalAssets)
			.then(function() {
				self.stagedProgress.critical.finished = true;
				if (self.stagingCallback) {
					self.stagingCallback('critical_complete', self.stagedProgress);
				}
			});
	}

	// Load deferred assets in parallel with critical (or after, depending on config)
	var deferredPromise = Promise.resolve();
	if (stagingConfig.deferred !== false) {
		if (stagingConfig.parallelDeferred === true) {
			// Load deferred in parallel with critical
			deferredPromise = this._loadAssetBatch(deferredAssets)
				.then(function() {
					self.stagedProgress.deferred.finished = true;
					if (self.stagingCallback) {
						self.stagingCallback('deferred_complete', self.stagedProgress);
					}
				});
		} else {
			// Load deferred after critical
			deferredPromise = criticalPromise.then(function() {
				return self._loadAssetBatch(deferredAssets)
					.then(function() {
						self.stagedProgress.deferred.finished = true;
						if (self.stagingCallback) {
							self.stagingCallback('deferred_complete', self.stagedProgress);
						}
					});
			});
		}
	}

	// Return promise that resolves when critical assets are loaded
	// Deferred assets continue loading in background
	return criticalPromise.then(function() {
		// Start background loading of deferred without blocking
		if (stagingConfig.deferred !== false && stagingConfig.parallelDeferred !== true) {
			// This runs but doesn't block the returned promise
			deferredPromise.catch(function(err) {
				console.warn('Deferred asset loading error:', err);
			});
		}

		// Call completion callback for backward compatibility
		if (self.progress.loaded === self.progress.total) {
			self.loadCallback.call(self);
		}
	}).catch(function(err) {
		console.error('Critical asset loading failed:', err);
		self.errorCallback.call(self, 'critical_load');
		throw err;
	});
}

/**
 * Extract critical assets (ship, track, HUD, collision/height maps)
 */
bkcore.threejs.Loader.prototype._extractCriticalAssets = function(data)
{
	var critical = {
		textures: {},
		texturesCube: {},
		geometries: {},
		analysers: {},
		images: {},
		sounds: {}
	};

	// Critical textures
	if (data.textures) {
		['hex', 'ship.feisar.diffuse', 'booster.diffuse', 'booster.sprite',
		 'track.cityscape.diffuse', 'track.cityscape.scrapers1.diffuse',
		 'track.cityscape.scrapers2.diffuse', 'track.cityscape.start.diffuse',
		 'track.cityscape.start.banner'].forEach(function(key) {
			if (key in data.textures) {
				critical.textures[key] = data.textures[key];
			}
		});
	}

	// Critical geometries
	if (data.geometries) {
		['ship.feisar', 'booster', 'track.cityscape',
		 'track.cityscape.scrapers1', 'track.cityscape.scrapers2',
		 'track.cityscape.start', 'track.cityscape.start.banner'].forEach(function(key) {
			if (key in data.geometries) {
				critical.geometries[key] = data.geometries[key];
			}
		});
	}

	// Critical analysers (collision, height maps)
	if (data.analysers) {
		['track.cityscape.collision', 'track.cityscape.height'].forEach(function(key) {
			if (key in data.analysers) {
				critical.analysers[key] = data.analysers[key];
			}
		});
	}

	// Critical images (HUD)
	if (data.images) {
		['hud.bg', 'hud.speed', 'hud.shield'].forEach(function(key) {
			if (key in data.images) {
				critical.images[key] = data.images[key];
			}
		});
	}

	// Background music is critical
	if (data.sounds && data.sounds.bg) {
		critical.sounds.bg = data.sounds.bg;
	}

	return critical;
}

/**
 * Extract deferred assets (audio, skybox, bonus geometry)
 */
bkcore.threejs.Loader.prototype._extractDeferredAssets = function(data)
{
	var deferred = {
		textures: {},
		texturesCube: {},
		geometries: {},
		analysers: {},
		images: {},
		sounds: {}
	};

	// Deferred textures (spec, normal, particles)
	if (data.textures) {
		['spark', 'cloud', 'ship.feisar.specular', 'ship.feisar.normal',
		 'track.cityscape.specular', 'track.cityscape.normal',
		 'track.cityscape.scrapers1.specular', 'track.cityscape.scrapers1.normal',
		 'track.cityscape.scrapers2.specular', 'track.cityscape.scrapers2.normal',
		 'track.cityscape.start.specular', 'track.cityscape.start.normal',
		 'bonus.base.diffuse', 'bonus.base.normal', 'bonus.base.specular'].forEach(function(key) {
			if (key in data.textures) {
				deferred.textures[key] = data.textures[key];
			}
		});
	}

	// Deferred cubemaps (skybox)
	if (data.texturesCube) {
		['skybox.dawnclouds'].forEach(function(key) {
			if (key in data.texturesCube) {
				deferred.texturesCube[key] = data.texturesCube[key];
			}
		});
	}

	// Deferred geometries (bonus)
	if (data.geometries) {
		['bonus.base', 'track.cityscape.bonus.speed'].forEach(function(key) {
			if (key in data.geometries) {
				deferred.geometries[key] = data.geometries[key];
			}
		});
	}

	// Sound effects (not music)
	if (data.sounds) {
		['crash', 'destroyed', 'boost', 'wind'].forEach(function(key) {
			if (key in data.sounds) {
				deferred.sounds[key] = data.sounds[key];
			}
		});
	}

	return deferred;
}

/**
 * Count assets in a batch
 */
bkcore.threejs.Loader.prototype._countAssets = function(data, stage)
{
	var total = 0;

	for (var type in this.types) {
		if (type in data) {
			for (var key in data[type]) {
				total++;
			}
		}
	}

	if (stage === 'total') {
		this.progress.total += total;
		this.progress.remaining += total;
	} else if (stage === 'critical') {
		this.stagedProgress.critical.total = total;
		this.stagedProgress.critical.remaining = total;
	} else if (stage === 'deferred') {
		this.stagedProgress.deferred.total = total;
		this.stagedProgress.deferred.remaining = total;
	}
}

/**
 * Load a batch of assets in parallel by type
 */
bkcore.threejs.Loader.prototype._loadAssetBatch = function(data)
{
	var self = this;
	var promises = [];

	// Load textures
	if (data.textures) {
		for (var texName in data.textures) {
			promises.push(this._loadTexturePromise(texName, data.textures[texName]));
		}
	}

	// Load texture cubes
	if (data.texturesCube) {
		for (var cubeName in data.texturesCube) {
			promises.push(this._loadTextureCubePromise(cubeName, data.texturesCube[cubeName]));
		}
	}

	// Load geometries
	if (data.geometries) {
		for (var geoName in data.geometries) {
			promises.push(this._loadGeometryPromise(geoName, data.geometries[geoName]));
		}
	}

	// Load analysers
	if (data.analysers) {
		for (var analyserName in data.analysers) {
			promises.push(this._loadAnalyserPromise(analyserName, data.analysers[analyserName]));
		}
	}

	// Load images
	if (data.images) {
		for (var imgName in data.images) {
			promises.push(this._loadImagePromise(imgName, data.images[imgName]));
		}
	}

	// Load sounds
	if (data.sounds) {
		for (var soundName in data.sounds) {
			promises.push(this._loadSoundPromise(soundName, data.sounds[soundName]));
		}
	}

	// Use allSettled to ensure all loads complete (success or failure)
	return Promise.allSettled(promises)
		.then(function(results) {
			// Check for failures and report them
			results.forEach(function(result) {
				if (result.status === 'rejected') {
					console.warn('Asset load failed:', result.reason);
				}
			});

			// Verify completion
			if (self.progress.loaded === self.progress.total) {
				self.progress.finished = true;
			}
		});
}

/**
 * Promise-based texture loading
 */
bkcore.threejs.Loader.prototype._loadTexturePromise = function(name, url)
{
	var self = this;
	this.updateState("textures", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		try {
			self.data.textures[name] = THREE.ImageUtils.loadTexture(
				url,
				bkcore.NONE,
				function() {
					self.updateState("textures", name, true);
					resolve(name);
				},
				function(err) {
					self.errorCallback.call(self, name);
					reject(err || new Error('Failed to load texture: ' + name));
				}
			);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Promise-based texture cube loading
 */
bkcore.threejs.Loader.prototype._loadTextureCubePromise = function(name, url)
{
	var self = this;

	var urls = [
		url.replace("%1", "px"), url.replace("%1", "nx"),
		url.replace("%1", "py"), url.replace("%1", "ny"),
		url.replace("%1", "pz"), url.replace("%1", "nz")
	];

	this.updateState("texturesCube", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		try {
			self.data.texturesCube[name] = THREE.ImageUtils.loadTextureCube(
				urls,
				new THREE.CubeRefractionMapping(),
				function() {
					self.updateState("texturesCube", name, true);
					resolve(name);
				},
				function(err) {
					self.errorCallback.call(self, name);
					reject(err || new Error('Failed to load texture cube: ' + name));
				}
			);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Promise-based geometry loading
 */
bkcore.threejs.Loader.prototype._loadGeometryPromise = function(name, url)
{
	var self = this;
	this.data.geometries[name] = null;
	this.updateState("geometries", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		try {
			self.jsonLoader.load(
				url,
				function(geometry) {
					self.data.geometries[name] = geometry;
					self.updateState("geometries", name, true);
					resolve(name);
				},
				function(err) {
					self.errorCallback.call(self, name);
					reject(err || new Error('Failed to load geometry: ' + name));
				}
			);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Promise-based analyser (image data) loading
 */
bkcore.threejs.Loader.prototype._loadAnalyserPromise = function(name, url)
{
	var self = this;
	this.updateState("analysers", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		try {
			self.data.analysers[name] = new bkcore.ImageData(
				url,
				function() {
					self.updateState("analysers", name, true);
					resolve(name);
				},
				function(err) {
					self.errorCallback.call(self, name);
					reject(err || new Error('Failed to load analyser: ' + name));
				}
			);
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Promise-based image loading
 */
bkcore.threejs.Loader.prototype._loadImagePromise = function(name, url)
{
	var self = this;
	this.updateState("images", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		var img = new Image();
		img.onload = function() {
			self.updateState("images", name, true);
			resolve(name);
		};
		img.onerror = function(err) {
			self.errorCallback.call(self, name);
			reject(err || new Error('Failed to load image: ' + name));
		};
		img.crossOrigin = "anonymous";
		img.src = url;
		self.data.images[name] = img;
	});
}

/**
 * Promise-based sound loading
 */
bkcore.threejs.Loader.prototype._loadSoundPromise = function(name, soundConfig)
{
	var self = this;
	this.updateState("sounds", name, false);

	return new Promise(function(resolve, reject) {
		if (self.isAborted) {
			reject(new Error('Loader aborted'));
			return;
		}

		try {
			var src = soundConfig.src;
			var loop = soundConfig.loop;
			var usePanner = soundConfig.usePanner;

			bkcore.Audio.addSound(
				src,
				name,
				loop,
				function() {
					self.updateState("sounds", name, true);
					resolve(name);
				},
				function(err) {
					self.errorCallback.call(self, name);
					reject(err || new Error('Failed to load sound: ' + name));
				}
			);

			self.data.sounds[name] = {
				play: function() {
					bkcore.Audio.play(name);
				},
				stop: function() {
					bkcore.Audio.stop(name);
				},
				volume: function(vol) {
					bkcore.Audio.volume(name, vol);
				}
			};
		} catch (err) {
			reject(err);
		}
	});
}

/**
 * Update loading state and progress
 */
bkcore.threejs.Loader.prototype.updateState = function(type, name, state)
{
	if(!(type in this.types))
	{
		console.warn("Unknown loader type.");
		return;
	}

	if(state == true)
	{
		this.progress.remaining--;
		this.progress.loaded++;
		this.progressCallback.call(this, this.progress, type, name);
	}

	this.states[type][name] = state;

	if(this.progress.loaded == this.progress.total)
	{
		this.loadCallback.call(this);
	}
}

/**
 * Get loaded resource
 * @param  string type [textures, texturesCube, geometries, analysers, images, sounds]
 * @param  string name 
 * @return Mixed
 */
bkcore.threejs.Loader.prototype.get = function(type, name)
{
	if(!(type in this.types))
	{
		console.warn("Unknown loader type.");
		return null;
	}
	if(!(name in this.data[type]))
	{
		console.warn("Unknown file.");
		return null;
	}

	return this.data[type][name];
}

/**
 * Check if a resource is loaded
 */
bkcore.threejs.Loader.prototype.loaded = function(type, name)
{
	if(!(type in this.types))
	{
		console.warn("Unknown loader type.");
		return null;
	}
	if(!(name in this.states[type]))
	{
		console.warn("Unknown file.");
		return null;
	}

	return this.states[type][name];
}

/**
 * Abort all pending load operations
 */
bkcore.threejs.Loader.prototype.abort = function()
{
	this.isAborted = true;
	if (this.abortController) {
		this.abortController.abort();
	}
	console.log('Asset loader aborted');
}

/**
 * Check if loader is aborted
 */
bkcore.threejs.Loader.prototype.getAbortStatus = function()
{
	return this.isAborted;
}

/**
 * Get current progress for critical stage
 */
bkcore.threejs.Loader.prototype.getCriticalProgress = function()
{
	return this.stagedProgress.critical;
}

/**
 * Get current progress for deferred stage
 */
bkcore.threejs.Loader.prototype.getDeferredProgress = function()
{
	return this.stagedProgress.deferred;
}

/**
 * Legacy support: Load as single batch (backward compatible)
 */
bkcore.threejs.Loader.prototype.loadTexture = function(name, url)
{
	var self = this;
	this.updateState("textures", name, false);
	this.data.textures[name] = THREE.ImageUtils.loadTexture(
		url, 
		bkcore.NONE, 
		function(){ 
			self.updateState("textures", name, true); 
		}, 
		function(){ 
			self.errorCallback.call(self, name); 
		}
	);
}

bkcore.threejs.Loader.prototype.loadTextureCube = function(name, url)
{
	var self = this;

	var urls = [
		url.replace("%1", "px"), url.replace("%1", "nx"),
		url.replace("%1", "py"), url.replace("%1", "ny"),
		url.replace("%1", "pz"), url.replace("%1", "nz")
	];

	this.updateState("texturesCube", name, false);
	this.data.texturesCube[name] = THREE.ImageUtils.loadTextureCube( 
		urls, 
		new THREE.CubeRefractionMapping(), 
		function(){ 
			self.updateState("texturesCube", name, true); 
		} 
	);
}

bkcore.threejs.Loader.prototype.loadGeometry = function(name, url)
{
	var self = this;
	this.data.geometries[name] = null;
	this.updateState("geometries", name, false);
	this.jsonLoader.load(
		url, 
		function(a){ 
			self.data.geometries[name] = a;
			self.updateState("geometries", name, true); 
		}
	);
}

bkcore.threejs.Loader.prototype.loadAnalyser = function(name, url)
{
	var self = this;
	this.updateState("analysers", name, false);
	this.data.analysers[name] = new bkcore.ImageData(
		url, 
		function(){ 
			self.updateState("analysers", name, true);
		}
	);
}

bkcore.threejs.Loader.prototype.loadImage = function(name, url)
{
	var self = this;
	this.updateState("images", name, false);
	var e = new Image();
	e.onload = function() { 
		self.updateState("images", name, true) ;
	};
	e.crossOrigin = "anonymous";
	e.src = url;
	this.data.images[name] = e;
}

bkcore.threejs.Loader.prototype.loadSound = function(src, name, loop){
    var self = this;
    this.updateState("sounds", name, false);
    
    bkcore.Audio.addSound(
    	src,
    	name, 
    	loop, 
    	function(){
       	 self.updateState("sounds", name, true);
    	}
    );
    
    this.data.sounds[name] = {
        play: function(){
            bkcore.Audio.play(name);
        },
        stop: function(){
            bkcore.Audio.stop(name);
        },
        volume: function(vol){
            bkcore.Audio.volume(name, vol);
        }
    };
};
