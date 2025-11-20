# Loader Streaming Refactor Documentation

## Overview

This document describes the refactored asset loader system that prioritizes critical resources, enables parallelism, and eliminates UI stalls during initialization.

## Architecture

### Promise-Based API

The loader has been refactored from a callback-only system to a hybrid approach supporting both callbacks and promises:

```javascript
// Promise-based usage
var loader = new bkcore.threejs.Loader({
  onError: function(name) { console.error('Load error: ' + name); },
  onProgress: function(progress, type, name) { /* update UI */ },
  onStaging: function(stage, progress) { /* stage callbacks */ }
});

loader.load(assets, { 
  critical: true, 
  deferred: true, 
  parallelDeferred: true 
}).then(function() {
  console.log('Critical assets loaded, game can start!');
}).catch(function(err) {
  console.error('Failed to load critical assets:', err);
});
```

### Staged Loading

Assets are classified into two categories:

#### Critical Assets (Block Game Start)
These must be loaded before the game can begin:
- **Textures**: hex, ship diffuse, booster, track diffuse (all variants), start banner
- **Geometries**: ship, booster, track (all track parts), start banner
- **Analysers**: collision map, height map
- **Images**: HUD background, speed, shield
- **Sounds**: background music

#### Deferred Assets (Load During Gameplay)
These are loaded in the background after the game starts:
- **Textures**: specular maps, normal maps, particle textures
- **Cubemaps**: skybox
- **Geometries**: bonus items
- **Sounds**: SFX (crash, boost, wind, destroyed)

### Configuration Options

```javascript
loader.load(assets, {
  critical: true,          // Load critical assets
  deferred: true,          // Load deferred assets
  parallelDeferred: true   // Load deferred in parallel with critical
});
```

## Performance Benefits

### Time-to-First-Frame (TTFF)

By deferring non-critical assets, TTFF is significantly improved:

- **Before**: Wait for all assets (estimated 3-5s on broadband)
- **After**: Critical assets only (estimated 2-3s on broadband)
- **Target improvement**: 30% reduction in time-to-first-frame

### Key Optimizations

1. **Batching by Type**: Assets are batched by type (textures, geometries, etc.) for efficient loading
2. **Promise.allSettled**: Ensures all loads complete without blocking on individual failures
3. **Parallel Loading**: Critical and deferred assets load in parallel when configured
4. **Progress Tracking**: Real-time progress updates for UI feedback

## Usage Examples

### Basic Usage with Staged Loading

```javascript
var hexGL = new bkcore.hexgl.HexGL({...});

hexGL.load({
  onLoad: function() {
    console.log('Critical assets ready');
  },
  onError: function(name) {
    console.error('Failed to load: ' + name);
  },
  onProgress: function(progress, type, name) {
    var percent = (progress.loaded / progress.total * 100);
    progressBar.style.width = percent + '%';
  },
  onStaging: function(stage, stagingProgress) {
    if (stage === 'critical_complete') {
      // Start game, deferred assets load in background
      hexGL.init();
      hexGL.start();
      progressBar.style.width = '100%';
    }
  }
});
```

### Launch Integration

The launch.js file has been updated to use staged loading:

```javascript
// Progress bar shows critical asset loading
// After critical assets load, game starts immediately
// Deferred assets continue loading during gameplay
// No visible stalls or delays
```

## Abort Functionality

The loader supports aborting pending requests:

```javascript
// Abort all pending loads
loader.abort();

// Check abort status
if (loader.getAbortStatus()) {
  console.log('Loader has been aborted');
}
```

Use cases:
- User navigates away from loading screen
- User changes quality settings mid-load
- Timeout due to network issues

## Progress Tracking

### Overall Progress

```javascript
var progress = loader.progress;
console.log(progress.loaded + ' / ' + progress.total);
```

### Staged Progress

```javascript
var criticalProgress = loader.getCriticalProgress();
// { total: X, remaining: Y, loaded: Z, finished: false }

var deferredProgress = loader.getDeferredProgress();
// { total: X, remaining: Y, loaded: Z, finished: false }
```

## Error Handling and Retry

The loader uses `Promise.allSettled` to ensure robust error handling:

1. Individual asset failures don't block other loads
2. Failed assets are logged via the error callback
3. Progress updates reflect successful and failed loads
4. Game can start with critical assets even if some deferred assets fail

## Backward Compatibility

Legacy methods are still supported for compatibility:

```javascript
loader.loadTexture('name', 'url');
loader.loadImage('name', 'url');
loader.loadSound('url', 'name', loop);
loader.loadGeometry('name', 'url');
loader.loadTextureCube('name', 'url');
loader.loadAnalyser('name', 'url');
```

## Testing

Comprehensive test coverage includes:

- **Success paths**: Normal asset loading scenarios
- **Failure paths**: Individual asset failures and abort scenarios
- **Abort paths**: Cancellation and cleanup
- **Staging paths**: Critical vs. deferred loading
- **Progress tracking**: Accurate progress reporting

Run tests:
```bash
npm test
```

## Integration with Quality Settings

The loader automatically adjusts asset lists based on quality settings:

- **Low quality**: Basic textures, minimal assets
- **High quality**: Full textures with specular/normal maps, enhanced effects

All quality levels follow the staged loading pattern.

## HUD Status Updates

The HUD can be updated during deferred loading:

```javascript
// In HUD update loop
if (loader.getDeferredProgress().finished === false) {
  var deferredPercent = (
    loader.getDeferredProgress().loaded / 
    loader.getDeferredProgress().total * 100
  );
  console.log('Background loading: ' + deferredPercent + '%');
}
```

## Compression and glTF Support

The loader is compatible with:
- Compressed textures (.ktx, .astc formats)
- glTF models (.glb, .gltf formats)
- Legacy JSON geometries (.js)

Error handling and retry logic is consolidated for all formats.

## Performance Metrics

Target improvements:
- TTFF: 30% reduction
- Memory usage: Deferred assets load on-demand
- Network efficiency: Parallel batch loading
- No UI stalls during initial loading sequence

## Migration Guide

### From Old Callback API

```javascript
// Old: Called only when everything is loaded
loader.load(assets);
// No way to know when critical assets are ready

// New: Separate critical and deferred stages
loader.load(assets, { critical: true, deferred: true })
  .then(function() {
    // Critical assets loaded, game starts
  });
```

### For Track Implementations

Tracks automatically use staged loading via the updated `Cityscape.load` method:

```javascript
// No changes needed - Cityscape.load automatically uses staging
this.lib.load(allAssets, { 
  critical: true, 
  deferred: true, 
  parallelDeferred: true 
});
```

## Console Logging

The loader provides helpful console messages:

```
Critical assets loaded, starting gameplay.
Background loading deferred assets...
Asset loader aborted
Asset load failed: asset_name
Deferred asset loading error: error_message
```

## Future Enhancements

Potential improvements for future iterations:
- Streaming download progress for large files
- Adaptive quality selection based on connection speed
- Predictive pre-loading based on user behavior
- Asset caching and versioning
- Service worker integration for offline support
