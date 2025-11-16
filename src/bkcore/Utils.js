/**
 * Various useful methods
 *
 * @class bkcore.Utils
 * @author Thibaut 'BKcore' Despoulain <http://bkcore.com>
 */
export class Utils {
  /**
   * Creates a bkcore.threejs.Shaders["normalV"|"normal"] material
   * with given parameters
   */
  static createNormalMaterial(opts) {
    if (!opts) opts = {};
    if (opts.ambient === undefined) opts.ambient = 0x444444;
    if (opts.normalScale === undefined) opts.normalScale = 1.0;
    if (opts.reflectivity === undefined) opts.reflectivity = 0.9;
    if (opts.shininess === undefined) opts.shininess = 42;
    if (opts.metal === undefined) opts.metal = false;

    const shadername = opts.perPixel ? "normalV" : "normal";
    const shader = bkcore.threejs.Shaders[shadername];
    const uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms["enableDiffuse"].value = true;
    uniforms["enableSpecular"].value = true;
    uniforms["enableReflection"].value = !!opts.cube;
    uniforms["tNormal"].texture = opts.normal;
    uniforms["tDiffuse"].texture = opts.diffuse;
    uniforms["tSpecular"].texture = opts.specular;
    uniforms["uAmbientColor"].value.setHex(opts.ambient);
    uniforms["uAmbientColor"].value.convertGammaToLinear();
    uniforms["uNormalScale"].value = opts.normalScale;

    if (opts.cube !== undefined) {
      uniforms["tCube"].texture = opts.cube;
      uniforms["uReflectivity"].value = opts.reflectivity;
    }

    const parameters = {
      fragmentShader: shader.fragmentShader,
      vertexShader: shader.vertexShader,
      uniforms: uniforms,
      lights: true,
      fog: false
    };

    const material = new THREE.ShaderMaterial(parameters);
    material.perPixel = true;
    material.metal = opts.metal;

    return material;
  }

  /**
   * Projects an object origin vector to screen using given camera
   * @param  THREE.Object3D object The object which origin you want to project
   * @param  THREE.Camera camera The camera of the projection
   * @return THEE.Vector3 Projected vector
   */
  static projectOnScreen(object, camera) {
    const mat = new THREE.Matrix4();
    mat.multiply(camera.matrixWorldInverse, object.matrixWorld);
    mat.multiply(camera.projectionMatrix, mat);

    const c = mat.n44;
    const lPos = new THREE.Vector3(mat.n14 / c, mat.n24 / c, mat.n34 / c);
    return lPos.multiplyScalar(0.5).addScalar(0.5);
  }

  /**
   * Get an url parameter
   * @param  String name Parameter slug
   * @return Mixed
   */
  static getURLParameter(name) {
    if (!Utils.URLParameters) {
      Utils.URLParameters = {};
      window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, (m, key, val) => {
        Utils.URLParameters[key] = val;
      });
    }

    return Utils.URLParameters[name];
  }

  /**
   * Get top offset of an element
   * @param obj HTMLElement
   */
  static getOffsetTop(obj) {
    let curtop = obj.offsetTop;

    if (obj.offsetParent) {
      let o = obj.offsetParent;
      while (o) {
        curtop += o.offsetTop;
        o = o.offsetParent;
      }
    }

    return curtop;
  }

  /**
   * Scrolls page to given element id
   * @param  string id The ID of the element
   */
  static scrollTo(id) {
    window.scroll(0, Utils.getOffsetTop(document.getElementById(id)));
  }

  /**
   * Add or remove a class from an element
   * @param  string id       Element ID
   * @param  string cssclass CSS class name
   * @param  bool active   Whether to add or remove
   */
  static updateClass(id, cssclass, active) {
    const e = document.getElementById(id);
    if (!e) return;

    if (active) {
      e.classList.add(cssclass);
    } else {
      e.classList.remove(cssclass);
    }
  }

  /**
   * Performs an XMLHttpRequest
   * @param  string   url      URL to request
   * @param  bool   postData true = POST, false = GET
   * @param  {Function} callback Callback function
   * @param  {Object}   data     Data to send
   */
  static request(url, postData, callback, data) {
    const XMLHttpFactories = [
      () => new XMLHttpRequest(),
      () => new ActiveXObject("Msxml2.XMLHTTP"),
      () => new ActiveXObject("Msxml3.XMLHTTP"),
      () => new ActiveXObject("Microsoft.XMLHTTP")
    ];

    const createXMLHTTPObject = () => {
      let xmlhttp = false;

      for (let i = 0; i < XMLHttpFactories.length; i++) {
        try {
          xmlhttp = XMLHttpFactories[i]();
        } catch (e) {
          continue;
        }
        break;
      }

      return xmlhttp;
    };

    const req = createXMLHTTPObject();
    if (!req) return;

    const method = postData ? "POST" : "GET";

    let qdata = "o=bk";
    if (data) {
      for (let i in data) {
        qdata += "&" + i + "=" + data[i];
        if (postData) url += "?" + qdata;
      }
    }

    req.open(method, url, true);

    if (postData) {
      req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    }

    req.onreadystatechange = () => {
      if (req.readyState !== 4) return;
      if (req.status !== 200 && req.status !== 304) return;
      if (callback) callback(req);
    };

    req.send(qdata);

    return req;
  }

  /**
   * Checks whether the device supports Touch input
   */
  static isTouchDevice() {
    return ('ontouchstart' in window) ||
      (navigator.MaxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0);
  }
}

Utils.URLParameters = null;
