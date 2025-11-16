const $ = (id) => document.getElementById(id);

const init = (controlType, quality, hud, godmode) => {
  const hexGL = new bkcore.hexgl.HexGL({
    document: document,
    width: window.innerWidth,
    height: window.innerHeight,
    container: $('main'),
    overlay: $('overlay'),
    gameover: $('step-5'),
    quality: quality,
    difficulty: 0,
    hud: hud === 1,
    controlType: controlType,
    godmode: godmode,
    track: 'Cityscape'
  });
  window.hexGL = hexGL;

  const progressbar = $('progressbar');
  hexGL.load({
    onLoad: function() {
      console.log('LOADED.');
      hexGL.init();
      $('step-3').style.display = 'none';
      $('step-4').style.display = 'block';
      return hexGL.start();
    },
    onError: function(s) {
      return console.error(`Error loading ${s}.`);
    },
    onProgress: function(p, t, n) {
      console.log(`LOADED ${t} : ${n} ( ${p.loaded} / ${p.total} ).`);
      return progressbar.style.width = `${(p.loaded / p.total) * 100}%`;
    }
  });
};

const u = bkcore.Utils.getURLParameter;

const defaultControls = bkcore.Utils.isTouchDevice() ? 1 : 0;

const s = [
  ['controlType', ['KEYBOARD', 'TOUCH', 'LEAP MOTION CONTROLLER', 'GAMEPAD'], defaultControls, defaultControls, 'Controls: '],
  ['quality', ['LOW', 'MID', 'HIGH', 'VERY HIGH'], 3, 3, 'Quality: '],
  ['hud', ['OFF', 'ON'], 1, 1, 'HUD: '],
  ['godmode', ['OFF', 'ON'], 0, 1, 'Godmode: ']
];

const settingsHandler = (a) => {
  a[3] = u(a[0]) != null ? u(a[0]) : a[2];
  const e = $(`s-${a[0]}`);
  const f = function() {
    return e.innerHTML = a[4] + a[1][a[3]];
  };
  f();
  return e.onclick = function() {
    return f(a[3] = (a[3] + 1) % a[1].length);
  };
};

for (let i = 0; i < s.length; i++) {
  settingsHandler(s[i]);
}

$('step-2').onclick = function() {
  $('step-2').style.display = 'none';
  $('step-3').style.display = 'block';
  return init(s[0][3], s[1][3], s[2][3], s[3][3]);
};

$('step-5').onclick = function() {
  return window.location.reload();
};

$('s-credits').onclick = function() {
  $('step-1').style.display = 'none';
  return $('credits').style.display = 'block';
};

$('credits').onclick = function() {
  $('step-1').style.display = 'block';
  return $('credits').style.display = 'none';
};

const hasWebGL = function() {
  let gl = null;
  const canvas = document.createElement('canvas');
  try {
    gl = canvas.getContext("webgl");
  } catch (e) {
  }
  if (gl == null) {
    try {
      gl = canvas.getContext("experimental-webgl");
    } catch (e) {
    }
  }
  return gl != null;
};

if (!hasWebGL()) {
  const getWebGL = $('start');
  getWebGL.innerHTML = 'WebGL is not supported!';
  getWebGL.onclick = function() {
    return window.location.href = 'http://get.webgl.org/';
  };
} else {
  $('start').onclick = function() {
    $('step-1').style.display = 'none';
    $('step-2').style.display = 'block';
    return $('step-2').style.backgroundImage = `url(css/help-${s[0][3]}.png)`;
  };
}
