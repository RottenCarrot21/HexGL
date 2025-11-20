/**
 * Integration tests for loader streaming refactor
 * Tests complete workflows including Cityscape integration
 */

describe('Loader Integration - Staged Loading Workflow', function() {
  var loader;
  var cityscape;
  var mockThreeImageUtils;
  var mockJSONLoader;
  var mockAudio;
  var mockImageData;

  beforeEach(function() {
    // Set up mocks
    mockThreeImageUtils = {
      loadTexture: jasmine.createSpy('loadTexture').and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(onLoad, 5);
        return { src: url };
      }),
      loadTextureCube: jasmine.createSpy('loadTextureCube').and.callFake(function(urls, mapping, onLoad, onError) {
        setTimeout(onLoad, 5);
        return { srcs: urls };
      })
    };

    mockJSONLoader = {
      load: jasmine.createSpy('load').and.callFake(function(url, onLoad, onError) {
        setTimeout(function() {
          onLoad({ type: 'Geometry', vertices: [] });
        }, 5);
      })
    };

    mockAudio = {
      addSound: jasmine.createSpy('addSound').and.callFake(function(src, name, loop, onLoad, onError) {
        setTimeout(onLoad, 5);
      }),
      play: jasmine.createSpy('play'),
      stop: jasmine.createSpy('stop'),
      volume: jasmine.createSpy('volume')
    };

    mockImageData = jasmine.createSpy('ImageData').and.callFake(function(url, onLoad, onError) {
      setTimeout(onLoad, 5);
    });

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
      NONE: undefined,
      threejs: {
        Loader: bkcore.threejs.Loader
      }
    };
  });

  describe('Complete game load workflow', function() {
    it('should complete critical load before deferred load completes', function(done) {
      var criticalComplete = false;
      var deferredComplete = false;

      var onStaging = jasmine.createSpy('onStaging').and.callFake(function(stage) {
        if (stage === 'critical_complete') {
          criticalComplete = true;
          expect(deferredComplete).toBe(false);
        } else if (stage === 'deferred_complete') {
          deferredComplete = true;
          expect(criticalComplete).toBe(true);
        }
      });

      loader = new bkcore.threejs.Loader({
        onError: jasmine.createSpy('onError'),
        onProgress: jasmine.createSpy('onProgress'),
        onStaging: onStaging
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'spark': 'textures/particles/spark.png',
          'ship.feisar.diffuse': 'textures/ships/feisar/diffuse.jpg'
        },
        texturesCube: {
          'skybox.dawnclouds': 'textures/skybox/dawnclouds/%1.jpg'
        },
        geometries: {
          'ship.feisar': 'geometries/ships/feisar/feisar.js',
          'bonus.base': 'geometries/bonus/base/base.js'
        },
        analysers: {
          'track.cityscape.collision': 'textures/tracks/cityscape/collision.png'
        },
        images: {
          'hud.bg': 'textures/hud/hud-bg.png'
        },
        sounds: {
          'bg': { src: 'audio/bg.ogg', loop: true },
          'crash': { src: 'audio/crash.ogg', loop: false }
        }
      };

      loader.load(assets, {
        critical: true,
        deferred: true,
        parallelDeferred: false
      }).then(function() {
        expect(criticalComplete).toBe(true);
        setTimeout(function() {
          expect(deferredComplete).toBe(true);
          done();
        }, 100);
      });
    });

    it('should load critical assets before deferred when parallelDeferred is false', function(done) {
      var stageTimes = {};

      loader = new bkcore.threejs.Loader({
        onError: jasmine.createSpy('onError'),
        onProgress: jasmine.createSpy('onProgress'),
        onStaging: jasmine.createSpy('onStaging').and.callFake(function(stage) {
          stageTimes[stage] = Date.now();
        })
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'spark': 'textures/particles/spark.png'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(assets, {
        critical: true,
        deferred: true,
        parallelDeferred: false
      }).then(function() {
        setTimeout(function() {
          expect(stageTimes['critical_complete']).toBeLessThan(stageTimes['deferred_complete']);
          done();
        }, 100);
      });
    });

    it('should load both critical and deferred in parallel when parallelDeferred is true', function(done) {
      var stageTimes = {};
      var criticalLoadTime = 0;
      var deferredLoadTime = 0;

      loader = new bkcore.threejs.Loader({
        onError: jasmine.createSpy('onError'),
        onProgress: jasmine.createSpy('onProgress'),
        onStaging: jasmine.createSpy('onStaging').and.callFake(function(stage) {
          stageTimes[stage] = Date.now();
        })
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'spark': 'textures/particles/spark.png'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      var startTime = Date.now();

      loader.load(assets, {
        critical: true,
        deferred: true,
        parallelDeferred: true
      }).then(function() {
        criticalLoadTime = stageTimes['critical_complete'] - startTime;
        setTimeout(function() {
          deferredLoadTime = stageTimes['deferred_complete'] - startTime;
          expect(Math.abs(criticalLoadTime - deferredLoadTime)).toBeLessThan(50);
          done();
        }, 100);
      });
    });
  });

  describe('Critical vs Deferred asset classification', function() {
    beforeEach(function() {
      loader = new bkcore.threejs.Loader({});
    });

    it('should classify HUD textures as critical', function() {
      var assets = {
        textures: {
          'hex': 'path',
          'hud.bg': 'path'
        }
      };

      var critical = loader._extractCriticalAssets(assets);
      expect(critical.textures['hex']).toBeDefined();
      expect(critical.textures['hud.bg']).toBeUndefined();
    });

    it('should classify ship and track geometries as critical', function() {
      var assets = {
        geometries: {
          'ship.feisar': 'path',
          'track.cityscape': 'path',
          'bonus.base': 'path'
        }
      };

      var critical = loader._extractCriticalAssets(assets);
      expect(critical.geometries['ship.feisar']).toBeDefined();
      expect(critical.geometries['track.cityscape']).toBeDefined();
      expect(critical.geometries['bonus.base']).toBeUndefined();
    });

    it('should classify collision and height maps as critical', function() {
      var assets = {
        analysers: {
          'track.cityscape.collision': 'path',
          'track.cityscape.height': 'path'
        }
      };

      var critical = loader._extractCriticalAssets(assets);
      expect(critical.analysers['track.cityscape.collision']).toBeDefined();
      expect(critical.analysers['track.cityscape.height']).toBeDefined();
    });

    it('should classify background music as critical', function() {
      var assets = {
        sounds: {
          'bg': { src: 'audio/bg.ogg', loop: true },
          'crash': { src: 'audio/crash.ogg', loop: false }
        }
      };

      var critical = loader._extractCriticalAssets(assets);
      expect(critical.sounds['bg']).toBeDefined();
      expect(critical.sounds['crash']).toBeUndefined();
    });

    it('should classify specular and normal maps as deferred', function() {
      var assets = {
        textures: {
          'ship.feisar.diffuse': 'path',
          'ship.feisar.specular': 'path',
          'ship.feisar.normal': 'path'
        }
      };

      var deferred = loader._extractDeferredAssets(assets);
      expect(deferred.textures['ship.feisar.diffuse']).toBeUndefined();
      expect(deferred.textures['ship.feisar.specular']).toBeDefined();
      expect(deferred.textures['ship.feisar.normal']).toBeDefined();
    });

    it('should classify skybox as deferred', function() {
      var assets = {
        texturesCube: {
          'skybox.dawnclouds': 'path/%1.jpg'
        }
      };

      var deferred = loader._extractDeferredAssets(assets);
      expect(deferred.texturesCube['skybox.dawnclouds']).toBeDefined();
    });

    it('should classify bonus geometry as deferred', function() {
      var assets = {
        geometries: {
          'bonus.base': 'path',
          'track.cityscape.bonus.speed': 'path'
        }
      };

      var deferred = loader._extractDeferredAssets(assets);
      expect(deferred.geometries['bonus.base']).toBeDefined();
      expect(deferred.geometries['track.cityscape.bonus.speed']).toBeDefined();
    });

    it('should classify SFX sounds as deferred', function() {
      var assets = {
        sounds: {
          'crash': { src: 'audio/crash.ogg', loop: false },
          'wind': { src: 'audio/wind.ogg', loop: true }
        }
      };

      var deferred = loader._extractDeferredAssets(assets);
      expect(deferred.sounds['crash']).toBeDefined();
      expect(deferred.sounds['wind']).toBeDefined();
    });
  });

  describe('Abort during staged load', function() {
    it('should abort critical load', function(done) {
      loader = new bkcore.threejs.Loader({
        onError: jasmine.createSpy('onError')
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      var loadPromise = loader.load(assets, {
        critical: true,
        deferred: false
      });

      loader.abort();

      loadPromise.then(function() {
        fail('Should not resolve after abort');
      }).catch(function(err) {
        expect(loader.getAbortStatus()).toBe(true);
        done();
      });
    });

    it('should clean up resources on abort', function() {
      loader = new bkcore.threejs.Loader({});
      
      loader.abort();
      
      expect(loader.isAborted).toBe(true);
      expect(loader.getAbortStatus()).toBe(true);
    });
  });

  describe('Progress reporting during staged load', function() {
    it('should report accurate critical progress', function(done) {
      var progressUpdates = [];

      loader = new bkcore.threejs.Loader({
        onProgress: jasmine.createSpy('onProgress').and.callFake(function(progress) {
          progressUpdates.push({
            loaded: progress.loaded,
            total: progress.total,
            remaining: progress.remaining
          });
        })
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'ship': 'textures/ships/feisar/diffuse.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(assets, {
        critical: true,
        deferred: false
      }).then(function() {
        expect(progressUpdates.length).toBeGreaterThan(0);
        var lastUpdate = progressUpdates[progressUpdates.length - 1];
        expect(lastUpdate.loaded).toBe(lastUpdate.total);
        done();
      });
    });

    it('should report staged progress accurately', function(done) {
      var stagingUpdates = [];

      loader = new bkcore.threejs.Loader({
        onStaging: jasmine.createSpy('onStaging').and.callFake(function(stage, progress) {
          stagingUpdates.push({
            stage: stage,
            criticalFinished: progress.critical.finished,
            deferredFinished: progress.deferred.finished
          });
        })
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(assets, {
        critical: true,
        deferred: false
      }).then(function() {
        var criticalUpdate = stagingUpdates.find(function(u) {
          return u.stage === 'critical_complete';
        });
        expect(criticalUpdate).toBeDefined();
        expect(criticalUpdate.criticalFinished).toBe(true);
        done();
      });
    });
  });

  describe('Quality-based asset loading', function() {
    it('should handle low-quality asset set', function(done) {
      loader = new bkcore.threejs.Loader({});

      var lowQualityAssets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'ship.feisar.diffuse': 'textures/ships/feisar/diffuse.jpg',
          'track.cityscape.diffuse': 'textures/tracks/cityscape/diffuse.jpg'
        },
        texturesCube: {},
        geometries: {
          'ship.feisar': 'geometries/ships/feisar/feisar.js',
          'track.cityscape': 'geometries/tracks/cityscape/track.js'
        },
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(lowQualityAssets, {
        critical: true,
        deferred: false
      }).then(function() {
        expect(loader.progress.total).toBe(5);
        expect(mockThreeImageUtils.loadTexture.calls.count()).toBe(3);
        expect(mockJSONLoader.load.calls.count()).toBe(2);
        done();
      });
    });

    it('should handle high-quality asset set with maps', function(done) {
      loader = new bkcore.threejs.Loader({});

      var highQualityAssets = {
        textures: {
          'ship.feisar.diffuse': 'path',
          'ship.feisar.specular': 'path',
          'ship.feisar.normal': 'path'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      var startTime = Date.now();
      var criticalTime = null;

      loader = new bkcore.threejs.Loader({
        onStaging: function(stage) {
          if (stage === 'critical_complete') {
            criticalTime = Date.now() - startTime;
          }
        }
      });

      loader.load(highQualityAssets, {
        critical: true,
        deferred: true,
        parallelDeferred: true
      }).then(function() {
        expect(mockThreeImageUtils.loadTexture.calls.count()).toBeGreaterThan(0);
        done();
      });
    });
  });

  describe('Error recovery during staged load', function() {
    it('should continue loading after individual asset failure', function(done) {
      var failureCount = 0;
      var successCount = 0;

      mockThreeImageUtils.loadTexture.and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(function() {
          if (url.indexOf('fail') > -1) {
            failureCount++;
            onError(new Error('Load failed'));
          } else {
            successCount++;
            onLoad();
          }
        }, 5);
        return { src: url };
      });

      loader = new bkcore.threejs.Loader({
        onError: jasmine.createSpy('onError')
      });

      var assets = {
        textures: {
          'hex': 'textures/hud/hex.jpg',
          'fail_tex': 'path/fail_texture.jpg',
          'ship': 'textures/ships/feisar/diffuse.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(assets, {
        critical: true,
        deferred: false
      }).then(function() {
        expect(failureCount).toBe(1);
        expect(successCount).toBe(2);
        done();
      });
    });

    it('should report error for failed assets', function(done) {
      var reportedErrors = [];

      mockThreeImageUtils.loadTexture.and.callFake(function(url, mapping, onLoad, onError) {
        setTimeout(function() {
          if (url.indexOf('fail') > -1) {
            onError(new Error('Load failed'));
          } else {
            onLoad();
          }
        }, 5);
        return { src: url };
      });

      loader = new bkcore.threejs.Loader({
        onError: function(name) {
          reportedErrors.push(name);
        }
      });

      var assets = {
        textures: {
          'fail_tex': 'path/fail_texture.jpg'
        },
        texturesCube: {},
        geometries: {},
        analysers: {},
        images: {},
        sounds: {}
      };

      loader.load(assets, {
        critical: true,
        deferred: false
      }).then(function() {
        expect(reportedErrors.length).toBe(1);
        expect(reportedErrors[0]).toBe('fail_tex');
        done();
      });
    });
  });
});
