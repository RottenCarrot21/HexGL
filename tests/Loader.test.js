/**
 * Test suite for bkcore.threejs.Loader
 * Tests promise-based API, staging, and abort functionality
 */

describe('bkcore.threejs.Loader', function() {
  var loader;
  var mockThreeImageUtils;
  var mockImageData;
  var mockAudio;
  var mockJSONLoader;

  beforeEach(function() {
    // Mock THREE.ImageUtils
    mockThreeImageUtils = {
      loadTexture: jasmine.createSpy('loadTexture').and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(function() {
          onLoad();
        }, 10);
        return { src: url };
      }),
      loadTextureCube: jasmine.createSpy('loadTextureCube').and.callFake(function(urls, mapping, onLoad, onError) {
        setTimeout(function() {
          onLoad();
        }, 10);
        return { srcs: urls };
      })
    };

    // Mock bkcore.ImageData
    mockImageData = jasmine.createSpy('ImageData').and.callFake(function(url, onLoad, onError) {
      setTimeout(function() {
        onLoad();
      }, 10);
    });

    // Mock bkcore.Audio
    mockAudio = {
      addSound: jasmine.createSpy('addSound').and.callFake(function(src, name, loop, onLoad, onError) {
        setTimeout(function() {
          onLoad();
        }, 10);
      }),
      play: jasmine.createSpy('play'),
      stop: jasmine.createSpy('stop'),
      volume: jasmine.createSpy('volume')
    };

    // Mock JSONLoader
    mockJSONLoader = {
      load: jasmine.createSpy('load').and.callFake(function(url, onLoad, onError) {
        setTimeout(function() {
          onLoad({ type: 'Geometry' });
        }, 10);
      })
    };

    // Set up global mocks
    window.THREE = {
      ImageUtils: mockThreeImageUtils,
      CubeRefractionMapping: function() {},
      JSONLoader: function() {
        return mockJSONLoader;
      }
    };

    window.bkcore = {
      ImageData: mockImageData,
      Audio: mockAudio,
      NONE: undefined
    };

    // Create loader instance
    loader = new bkcore.threejs.Loader({
      onLoad: jasmine.createSpy('onLoad'),
      onError: jasmine.createSpy('onError'),
      onProgress: jasmine.createSpy('onProgress'),
      onStaging: jasmine.createSpy('onStaging')
    });
  });

  describe('initialization', function() {
    it('should initialize with default callbacks', function() {
      var testLoader = new bkcore.threejs.Loader({});
      expect(testLoader).toBeDefined();
      expect(testLoader.progress.total).toBe(0);
      expect(testLoader.progress.loaded).toBe(0);
    });

    it('should initialize staged progress tracking', function() {
      expect(loader.stagedProgress.critical).toBeDefined();
      expect(loader.stagedProgress.deferred).toBeDefined();
      expect(loader.stagedProgress.critical.total).toBe(0);
      expect(loader.stagedProgress.deferred.total).toBe(0);
    });

    it('should initialize abort controller', function() {
      expect(loader.abortController).toBeNull();
      expect(loader.isAborted).toBe(false);
    });
  });

  describe('asset classification', function() {
    it('should extract critical assets', function() {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg',
          'ship.feisar.diffuse': 'path/to/ship.jpg',
          'spark': 'path/to/spark.png'
        },
        geometries: {
          'ship.feisar': 'path/to/ship.js',
          'bonus.base': 'path/to/bonus.js'
        },
        sounds: {
          'bg': { src: 'audio/bg.ogg', loop: true },
          'crash': { src: 'audio/crash.ogg', loop: false }
        }
      };

      var critical = loader._extractCriticalAssets(data);

      expect(critical.textures['hex']).toBeDefined();
      expect(critical.textures['ship.feisar.diffuse']).toBeDefined();
      expect(critical.textures['spark']).toBeUndefined();
      expect(critical.geometries['ship.feisar']).toBeDefined();
      expect(critical.geometries['bonus.base']).toBeUndefined();
      expect(critical.sounds['bg']).toBeDefined();
      expect(critical.sounds['crash']).toBeUndefined();
    });

    it('should extract deferred assets', function() {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg',
          'ship.feisar.specular': 'path/to/specular.jpg',
          'spark': 'path/to/spark.png'
        },
        texturesCube: {
          'skybox.dawnclouds': 'path/to/skybox/%1.jpg'
        },
        geometries: {
          'ship.feisar': 'path/to/ship.js',
          'bonus.base': 'path/to/bonus.js'
        }
      };

      var deferred = loader._extractDeferredAssets(data);

      expect(deferred.textures['hex']).toBeUndefined();
      expect(deferred.textures['ship.feisar.specular']).toBeDefined();
      expect(deferred.textures['spark']).toBeDefined();
      expect(deferred.texturesCube['skybox.dawnclouds']).toBeDefined();
      expect(deferred.geometries['bonus.base']).toBeDefined();
    });
  });

  describe('promise-based loading', function() {
    it('should load textures and resolve promise', function(done) {
      var data = {
        textures: {
          'test': 'path/to/test.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(mockThreeImageUtils.loadTexture).toHaveBeenCalled();
        expect(loader.progress.total).toBe(1);
        done();
      }).catch(function(err) {
        fail('Promise should resolve: ' + err);
      });
    });

    it('should call progress callback for each loaded asset', function(done) {
      var data = {
        textures: {
          'test1': 'path/to/test1.jpg',
          'test2': 'path/to/test2.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        var callbacks = loader.progressCallback.calls.all();
        expect(callbacks.length).toBeGreaterThan(0);
        done();
      });
    });

    it('should track loaded resources', function(done) {
      var data = {
        textures: {
          'ship': 'path/to/ship.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(loader.get('textures', 'ship')).toBeDefined();
        expect(loader.loaded('textures', 'ship')).toBe(true);
        done();
      });
    });
  });

  describe('staged loading', function() {
    it('should resolve immediately after critical assets load', function(done) {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg',
          'spark': 'path/to/spark.png'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {
          'bg': { src: 'audio/bg.ogg', loop: true },
          'crash': { src: 'audio/crash.ogg', loop: false }
        }
      };

      var startTime = Date.now();
      loader.load(data, { 
        critical: true, 
        deferred: true, 
        parallelDeferred: false 
      }).then(function() {
        var elapsed = Date.now() - startTime;
        expect(loader.stagedProgress.critical.finished).toBe(true);
        expect(elapsed).toBeLessThan(200);
        done();
      });
    });

    it('should call staging callback when critical assets complete', function(done) {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        var calls = loader.stagingCallback.calls.all();
        var criticalCall = calls.find(function(call) {
          return call.args[0] === 'critical_complete';
        });
        expect(criticalCall).toBeDefined();
        done();
      });
    });

    it('should load deferred assets in parallel when configured', function(done) {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg',
          'spark': 'path/to/spark.png'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { 
        critical: true, 
        deferred: true, 
        parallelDeferred: true 
      }).then(function() {
        var calls = loader.stagingCallback.calls.all();
        var criticalCall = calls.find(function(call) {
          return call.args[0] === 'critical_complete';
        });
        expect(criticalCall).toBeDefined();
        done();
      });
    });
  });

  describe('abort functionality', function() {
    it('should have abort method', function() {
      expect(loader.abort).toBeDefined();
    });

    it('should set abort flag', function() {
      loader.abort();
      expect(loader.isAborted).toBe(true);
    });

    it('should abort AbortController', function() {
      loader.abortController = new AbortController();
      spyOn(loader.abortController, 'abort');
      loader.abort();
      expect(loader.abortController.abort).toHaveBeenCalled();
    });

    it('should reject promises when aborted', function(done) {
      var data = {
        textures: {},
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {
          'test': 'path/to/test.jpg'
        },
        sounds: {}
      };

      loader.abort();

      loader.load(data, { critical: true, deferred: false }).then(function() {
        fail('Promise should reject when aborted');
      }).catch(function(err) {
        expect(err).toBeDefined();
        done();
      });
    });

    it('should track abort status', function() {
      expect(loader.getAbortStatus()).toBe(false);
      loader.abort();
      expect(loader.getAbortStatus()).toBe(true);
    });
  });

  describe('error handling', function() {
    it('should call error callback on load failure', function(done) {
      var errorThrown = false;
      mockThreeImageUtils.loadTexture.and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(function() {
          onError(new Error('Load failed'));
        }, 10);
        return { src: url };
      });

      var data = {
        textures: {
          'test': 'path/to/test.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        done();
      }).catch(function(err) {
        expect(err).toBeDefined();
        done();
      });
    });

    it('should continue loading on individual asset failure', function(done) {
      var callCount = 0;
      mockThreeImageUtils.loadTexture.and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(function() {
          callCount++;
          if (callCount === 1) {
            onError(new Error('Load failed'));
          } else {
            onLoad();
          }
        }, 10);
        return { src: url };
      });

      var data = {
        textures: {
          'test1': 'path/to/test1.jpg',
          'test2': 'path/to/test2.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(callCount).toBe(2);
        done();
      });
    });
  });

  describe('progress tracking', function() {
    it('should track critical progress', function(done) {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        var progress = loader.getCriticalProgress();
        expect(progress.total).toBe(1);
        expect(progress.loaded).toBe(1);
        expect(progress.finished).toBe(true);
        done();
      });
    });

    it('should track deferred progress', function(done) {
      var data = {
        textures: {
          'hex': 'path/to/hex.jpg',
          'spark': 'path/to/spark.png'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      var interval = setInterval(function() {
        var deferredProgress = loader.getDeferredProgress();
        if (deferredProgress.finished) {
          clearInterval(interval);
          expect(deferredProgress.total).toBeGreaterThan(0);
          expect(deferredProgress.loaded).toBeGreaterThan(0);
          done();
        }
      }, 20);

      loader.load(data, { 
        critical: true, 
        deferred: true, 
        parallelDeferred: true 
      });
    });
  });

  describe('backward compatibility', function() {
    it('should support legacy loadTexture method', function() {
      loader.loadTexture('test', 'path/to/test.jpg');
      expect(mockThreeImageUtils.loadTexture).toHaveBeenCalled();
    });

    it('should support legacy loadImage method', function() {
      loader.loadImage('test', 'path/to/test.jpg');
      expect(loader.data.images['test']).toBeDefined();
    });

    it('should support legacy loadSound method', function() {
      loader.loadSound('path/to/sound.ogg', 'test', true);
      expect(mockAudio.addSound).toHaveBeenCalled();
    });

    it('should populate data correctly for legacy methods', function() {
      loader.loadTexture('tex', 'path/to/tex.jpg');
      loader.loadImage('img', 'path/to/img.jpg');
      loader.loadSound('path/to/snd.ogg', 'snd', false);

      expect(loader.get('textures', 'tex')).toBeDefined();
      expect(loader.get('images', 'img')).toBeDefined();
      expect(loader.get('sounds', 'snd')).toBeDefined();
    });
  });

  describe('geometry loading', function() {
    it('should load geometries via JSONLoader', function(done) {
      var data = {
        textures: {},
        texturesCube: {},
        geometries: {
          'ship': 'path/to/ship.js'
        },
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(mockJSONLoader.load).toHaveBeenCalled();
        expect(loader.get('geometries', 'ship')).toBeDefined();
        done();
      });
    });
  });

  describe('image data (analyser) loading', function() {
    it('should load image data via bkcore.ImageData', function(done) {
      var data = {
        textures: {},
        texturesCube: {},
        geometries: {},
        analysers: {
          'collision': 'path/to/collision.png'
        },
        images: {},
        sounds: {}
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(mockImageData).toHaveBeenCalled();
        expect(loader.get('analysers', 'collision')).toBeDefined();
        done();
      });
    });
  });

  describe('sound loading', function() {
    it('should load sounds via bkcore.Audio', function(done) {
      var data = {
        textures: {},
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {
          'bg': { src: 'audio/bg.ogg', loop: true }
        }
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        expect(mockAudio.addSound).toHaveBeenCalled();
        expect(loader.get('sounds', 'bg')).toBeDefined();
        done();
      });
    });

    it('should provide sound control methods', function(done) {
      var data = {
        textures: {},
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {
          'test': { src: 'audio/test.ogg', loop: false }
        }
      };

      loader.load(data, { critical: true, deferred: false }).then(function() {
        var sound = loader.get('sounds', 'test');
        expect(sound.play).toBeDefined();
        expect(sound.stop).toBeDefined();
        expect(sound.volume).toBeDefined();
        done();
      });
    });
  });
});
