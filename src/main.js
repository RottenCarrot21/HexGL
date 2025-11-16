// Import CSS
import '../css/multi.css';
import '../css/fonts.css';

// Set up global bkcore namespace
window.bkcore = window.bkcore || {};

// Import utilities
import { Utils } from './bkcore/Utils.js';
import { Timer } from './bkcore/Timer.js';
import { ImageData } from './bkcore/ImageData.js';

window.bkcore.Utils = Utils;
window.bkcore.Timer = Timer;
window.bkcore.ImageData = ImageData;

// Load scripts sequentially to maintain order
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Load all scripts in sequence
const loadAllScripts = async () => {
  try {
    // Load legacy Three.js first (needed for old postprocessing libs)
    await loadScript('/libs/Three.dev.js');
    
    // Load third-party legacy libraries
    await loadScript('/libs/leap-0.4.1.min.js');
    await loadScript('/libs/ShaderExtras.js');
    await loadScript('/libs/postprocessing/EffectComposer.js');
    await loadScript('/libs/postprocessing/RenderPass.js');
    await loadScript('/libs/postprocessing/BloomPass.js');
    await loadScript('/libs/postprocessing/ShaderPass.js');
    await loadScript('/libs/postprocessing/MaskPass.js');
    await loadScript('/libs/Detector.js');
    await loadScript('/libs/Stats.js');
    await loadScript('/libs/DAT.GUI.min.js');
    
    // Load bkcore modules (in correct dependency order)
    await loadScript('/bkcore/Audio.js');
    await loadScript('/bkcore/threejs/RenderManager.js');
    await loadScript('/bkcore/threejs/Shaders.js');
    await loadScript('/bkcore/threejs/Particles.js');
    await loadScript('/bkcore/threejs/Loader.js');
    
    await loadScript('/bkcore/hexgl/RaceData.js');
    await loadScript('/bkcore/hexgl/ShipControls.js');
    await loadScript('/bkcore/hexgl/ShipEffects.js');
    await loadScript('/bkcore/hexgl/CameraChase.js');
    await loadScript('/bkcore/hexgl/HUD.js');
    await loadScript('/bkcore/hexgl/Gameplay.js');
    await loadScript('/bkcore/hexgl/Ladder.js');
    
    await loadScript('/bkcore/hexgl/tracks/Cityscape.js');
    await loadScript('/bkcore/hexgl/HexGL.js');
    
    // Load controller code
    await loadScript('/bkcore.coffee/controllers/TouchController.js');
    await loadScript('/bkcore.coffee/controllers/OrientationController.js');
    await loadScript('/bkcore.coffee/controllers/GamepadController.js');
    
    // Load launch logic (this starts the app)
    await loadScript('/launch.js');
  } catch (err) {
    console.error('Failed to load scripts:', err);
  }
};

// Start loading all scripts
loadAllScripts();
