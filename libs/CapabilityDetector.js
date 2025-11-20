/**
 * Modern Capability Detection for HexGL
 * Replaces the outdated Detector.js with comprehensive feature detection
 */

var CapabilityDetector = {
  // WebGL detection
  webgl: (function() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch(e) {
      return false;
    }
  })(),

  // WebGL2 detection
  webgl2: (function() {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2'));
    } catch(e) {
      return false;
    }
  })(),

  // Compressed texture support detection
  compressedTextures: (function() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return false;
      
      const extensions = [
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_compressed_texture_etc',
        'WEBGL_compressed_texture_pvrtc',
        'WEBGL_compressed_texture_astc'
      ];
      
      return extensions.some(ext => gl.getExtension(ext));
    } catch(e) {
      return false;
    }
  })(),

  // Pointer Events detection
  pointerEvents: (function() {
    return !!(window.PointerEvent || navigator.pointerEnabled || navigator.msPointerEnabled);
  })(),

  // Gamepad API detection
  gamepad: (function() {
    return !!(navigator.getGamepads || navigator.webkitGetGamepads);
  })(),

  // Device Orientation detection
  deviceOrientation: (function() {
    return 'DeviceOrientationEvent' in window;
  })(),

  // Device Motion detection
  deviceMotion: (function() {
    return 'DeviceMotionEvent' in window;
  })(),

  // Touch detection
  touch: (function() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  })(),

  // Audio Context detection
  audioContext: (function() {
    return !!(window.AudioContext || window.webkitAudioContext);
  })(),

  // Web Audio API autoplay policy detection
  audioAutoplayRestricted: (function() {
    if (!CapabilityDetector.audioContext) return false;
    
    // Create a temporary context to check if it's suspended
    try {
      const testCtx = new (window.AudioContext || window.webkitAudioContext)();
      const isRestricted = testCtx.state === 'suspended';
      testCtx.close();
      return isRestricted;
    } catch(e) {
      return false;
    }
  })(),

  // Fullscreen API detection
  fullscreen: (function() {
    return !!(document.fullscreenEnabled || 
      document.webkitFullscreenEnabled || 
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled);
  })(),

  // Get comprehensive capability report
  getCapabilities: function() {
    return {
      webgl: this.webgl,
      webgl2: this.webgl2,
      compressedTextures: this.compressedTextures,
      pointerEvents: this.pointerEvents,
      gamepad: this.gamepad,
      deviceOrientation: this.deviceOrientation,
      deviceMotion: this.deviceMotion,
      touch: this.touch,
      audioContext: this.audioContext,
      audioAutoplayRestricted: this.audioAutoplayRestricted,
      fullscreen: this.fullscreen
    };
  },

  // Get user-friendly error message with actionable guidance
  getCapabilityErrorMessage: function() {
    const caps = this.getCapabilities();
    const issues = [];

    if (!caps.webgl) {
      issues.push({
        title: 'WebGL Not Supported',
        message: 'Your browser or graphics card doesn\'t support WebGL, which is required for 3D graphics.',
        action: 'Try updating your browser or graphics drivers, or use a modern browser like Chrome, Firefox, Safari, or Edge.',
        link: 'https://get.webgl.org/'
      });
    }

    if (caps.webgl && !caps.webgl2) {
      console.info('WebGL2 not available, falling back to WebGL1');
    }

    if (!caps.audioContext) {
      issues.push({
        title: 'Web Audio API Not Supported',
        message: 'Your browser doesn\'t support the Web Audio API for enhanced sound.',
        action: 'Audio will be limited. For full audio experience, try a modern browser.',
        link: null
      });
    }

    if (caps.audioAutoplayRestricted) {
      console.info('Audio autoplay is restricted - user interaction required to start audio');
    }

    return issues;
  },

  // Create and display capability error UI
  displayCapabilityErrors: function(containerId) {
    const issues = this.getCapabilityErrorMessage();
    
    if (issues.length === 0) {
      return true; // No issues
    }

    const container = document.getElementById(containerId) || document.body;
    
    // Clear existing error messages
    const existingError = document.getElementById('capability-error-message');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.id = 'capability-error-message';
    errorDiv.style.cssText = `
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      font-weight: normal;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2em;
      width: 90%;
      max-width: 500px;
      margin: 5em auto 0;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;

    let html = '<h2 style="margin-top: 0; color: white;">⚠️ Compatibility Issues</h2>';
    
    issues.forEach((issue, index) => {
      html += `
        <div style="margin-bottom: 1.5em; text-align: left;">
          <h3 style="color: #ffd700; margin-bottom: 0.5em;">${issue.title}</h3>
          <p style="margin-bottom: 0.5em; line-height: 1.4;">${issue.message}</p>
          <p style="margin-bottom: 0; font-style: italic;">${issue.action}</p>
          ${issue.link ? `<p style="margin-top: 0.5em;"><a href="${issue.link}" target="_blank" style="color: #ffd700; text-decoration: underline;">Learn More →</a></p>` : ''}
        </div>
      `;
    });

    html += `
      <button onclick="window.location.reload()" style="
        background: white;
        color: #667eea;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        margin-top: 1em;
      ">Reload Page</button>
    `;

    errorDiv.innerHTML = html;
    container.appendChild(errorDiv);

    return false; // Has issues
  },

  // Legacy compatibility
  canvas: !! window.CanvasRenderingContext2D,
  workers: !! window.Worker,
  fileapi: window.File && window.FileReader && window.FileList && window.Blob,

  // Legacy method for backward compatibility
  getWebGLErrorMessage: function() {
    const issues = this.getCapabilityErrorMessage();
    const webglIssue = issues.find(issue => issue.title.includes('WebGL'));
    
    if (!webglIssue) {
      return document.createElement('div'); // No WebGL issues
    }

    const element = document.createElement('div');
    element.id = 'webgl-error-message';
    element.style.fontFamily = 'monospace';
    element.style.fontSize = '13px';
    element.style.fontWeight = 'normal';
    element.style.textAlign = 'center';
    element.style.background = '#fff';
    element.style.color = '#000';
    element.style.padding = '1.5em';
    element.style.width = '400px';
    element.style.margin = '5em auto 0';
    
    element.innerHTML = webglIssue.message + '<br>' + webglIssue.action;
    
    return element;
  },

  // Legacy method for backward compatibility
  addGetWebGLMessage: function(parameters) {
    parameters = parameters || {};
    const parent = parameters.parent !== undefined ? parameters.parent : document.body;
    const id = parameters.id !== undefined ? parameters.id : 'oldie';
    
    const element = this.getWebGLErrorMessage();
    element.id = id;
    
    parent.appendChild(element);
  }
};

// Export for backward compatibility
window.Detector = CapabilityDetector;
window.CapabilityDetector = CapabilityDetector;