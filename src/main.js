// Import Three.js from CDN
import * as THREE from 'three';

// Import utilities
import { Utils } from './bkcore/Utils.js';
import { Timer } from './bkcore/Timer.js';
import { ImageData } from './bkcore/ImageData.js';

// Set up global bkcore namespace
window.bkcore = window.bkcore || {};
window.bkcore.Utils = Utils;
window.bkcore.Timer = Timer;
window.bkcore.ImageData = ImageData;
window.THREE = THREE;

// Load third-party legacy scripts dynamically
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Load all required legacy libraries
Promise.all([
  loadScript('libs/leap-0.4.1.min.js'),
  loadScript('libs/ShaderExtras.js'),
  loadScript('libs/postprocessing/EffectComposer.js'),
  loadScript('libs/postprocessing/RenderPass.js'),
  loadScript('libs/postprocessing/BloomPass.js'),
  loadScript('libs/postprocessing/ShaderPass.js'),
  loadScript('libs/postprocessing/MaskPass.js'),
  loadScript('libs/Detector.js'),
  loadScript('libs/Stats.js'),
  loadScript('libs/DAT.GUI.min.js')
]).catch(err => console.error('Failed to load libraries:', err));

// Import legacy JavaScript files - they define on bkcore namespace
import './bkcore/Audio.js';
import './bkcore/threejs/RenderManager.js';
import './bkcore/threejs/Shaders.js';
import './bkcore/threejs/Particles.js';
import './bkcore/threejs/Loader.js';

import './bkcore/hexgl/RaceData.js';
import './bkcore/hexgl/ShipControls.js';
import './bkcore/hexgl/ShipEffects.js';
import './bkcore/hexgl/CameraChase.js';
import './bkcore/hexgl/HUD.js';
import './bkcore/hexgl/Gameplay.js';
import './bkcore/hexgl/Ladder.js';

import './bkcore/hexgl/tracks/Cityscape.js';

import './bkcore/hexgl/HexGL.js';

// Import controller code
import './bkcore/controllers/TouchController.js';
import './bkcore/controllers/OrientationController.js';
import './bkcore/controllers/GamepadController.js';

// Import the launch logic
import './launch.js';
