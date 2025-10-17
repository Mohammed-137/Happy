// You can change global variables here:
let radius = 240; // how big of the radius
const autoRotate = true; // auto rotate or not
const rotateSpeed = -60; // unit: seconds/360 degrees
const imgWidth = 120; // width of images (unit: px)
const imgHeight = 170; // height of images (unit: px)

// Link of background music - set 'null' if you dont want to play background music
const bgMusicURL = 'https://api.soundcloud.com/tracks/143041228/stream?client_id=587aa2d384f7333a886010d5f52f302a';
const bgMusicControls = true; // Show UI music control

// Main entry after DOM is ready
document.addEventListener('DOMContentLoaded', () => {

  // animation start after 1000 milliseconds
  setTimeout(init, 1000);

  const odrag = document.getElementById('drag-container');
  const ospin = document.getElementById('spin-container');
  const ground = document.getElementById('ground');
  const musicContainer = document.getElementById('music-container');

  // If required DOM elements are missing, bail out gracefully
  if (!odrag || !ospin) {
    console.warn('Required elements #drag-container or #spin-container missing from DOM.');
    return;
  }

  // collect imgs and videos inside spin container
  const aImg = ospin.getElementsByTagName('img');
  const aVid = ospin.getElementsByTagName('video');
  const aEle = [...aImg, ...aVid]; // combine 2 arrays

  // Size of images
  ospin.style.width = imgWidth + "px";
  ospin.style.height = imgHeight + "px";

  // Size of ground - depend on radius (if ground exists)
  if (ground) {
    ground.style.width = radius * 3 + "px";
    ground.style.height = radius * 3 + "px";
  }

  function init(delaySeconds) {
    // delaySeconds (number) is optional. If provided, we'll append 's' to make seconds string
    for (let i = 0; i < aEle.length; i++) {
      const el = aEle[i];
      const angle = i * (360 / aEle.length);
      el.style.transform = `rotateY(${angle}deg) translateZ(${radius}px)`;
      el.style.transition = "transform 1s";
      // if delaySeconds is provided (number), use it, else use the fallback formula
      const delayStr = (typeof delaySeconds === 'number')
        ? `${delaySeconds}s`
        : `${(aEle.length - i) / 4}s`;
      el.style.transitionDelay = delayStr;
    }
  }

  // rotation state applied to the parent drag container
  let sX, sY, desX = 0, desY = 0, tX = 0, tY = 10;

  function applyTranform(obj) {
    // Constrain the angle of camera (between 0 and 180)
    if (tY > 180) tY = 180;
    if (tY < 0) tY = 0;

    // Apply the angle
    obj.style.transform = `rotateX(${-tY}deg) rotateY(${tX}deg)`;
  }

  function playSpin(yes) {
    ospin.style.animationPlayState = (yes ? 'running' : 'paused');
  }

  // auto spin
  if (autoRotate) {
    const animationName = (rotateSpeed > 0 ? 'spin' : 'spinRevert');
    ospin.style.animation = `${animationName} ${Math.abs(rotateSpeed)}s infinite linear`;
  }

  // add background music
  if (bgMusicURL && musicContainer) {
    musicContainer.innerHTML += `
<audio src="${bgMusicURL}" ${bgMusicControls ? 'controls' : ''} autoplay loop>
  <p>If you are reading this, it is because your browser does not support the audio element.</p>
</audio>
`;
  }

  // pointer (drag) interactions
  document.addEventListener('pointerdown', function (e) {
    // clear any existing inertia timer on odrag
    if (odrag.timer) {
      clearInterval(odrag.timer);
      odrag.timer = null;
    }

    let startX = e.clientX;
    let startY = e.clientY;

    function onPointerMove(ev) {
      const nX = ev.clientX;
      const nY = ev.clientY;
      desX = nX - startX;
      desY = nY - startY;
      tX += desX * 0.1;
      tY += desY * 0.1;
      applyTranform(odrag);
      startX = nX;
      startY = nY;
    }

    function onPointerUp() {
      // inertia
      odrag.timer = setInterval(function () {
        desX *= 0.95;
        desY *= 0.95;
        tX += desX * 0.1;
        tY += desY * 0.1;
        applyTranform(odrag);
        playSpin(false);
        if (Math.abs(desX) < 0.5 && Math.abs(desY) < 0.5) {
          clearInterval(odrag.timer);
          odrag.timer = null;
          playSpin(true);
        }
      }, 17);

      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // prevent text selection / default dragging behavior
    e.preventDefault();
  });

  // modern wheel event for zooming radius
  window.addEventListener('wheel', function (e) {
    // normalize wheel delta
    const delta = (e.deltaY || e.detail || 0);
    // Use a scaled delta to make zooming smooth
    radius += (delta > 0 ? 10 : -10);
    // Clamp the radius to a sensible range
    radius = Math.max(50, Math.min(radius, 2000));
    // re-calc positions with a small transition delay of 0.2s
    init(0.2);
  }, { passive: true });

  // initialize positions once now (no delay)
  init(0);

  // ----------------------------
  // WebGL Canvas & shader part
  // ----------------------------
  const canvas = document.getElementById("canvas");
  if (!canvas) {
    console.warn('#canvas element not found — skipping WebGL part.');
    return;
  }

  // set size
  function setCanvasSizeToWindow() {
    // support devicePixelRatio for crisper output
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
  }
  setCanvasSizeToWindow();

  // Initialize the GL context
  const gl = canvas.getContext('webgl');
  if (!gl) {
    console.error("Unable to initialize WebGL.");
    return;
  }

  //Time
  let time = 0.0;

  //************** Shader sources **************
  const vertexSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const fragmentSource = `
precision highp float;

uniform float width;
uniform float height;
vec2 resolution = vec2(width, height);

uniform float time;

#define POINT_COUNT 8

vec2 points[POINT_COUNT];
const float speed = -0.5;
const float len = 0.25;
float intensity = 1.3;
float rads = 0.008;

// Signed distance to a quadratic bezier (from shadertoy example)
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C){
  vec2 a = B - A;
  vec2 b = A - 2.0*B + C;
  vec2 c = a * 2.0;
  vec2 d = A - pos;

  float kk = 1.0 / dot(b,b);
  float kx = kk * dot(a,b);
  float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
  float kz = kk * dot(d,a);

  float res = 0.0;

  float p = ky - kx*kx;
  float p3 = p*p*p;
  float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
  float h = q*q + 4.0*p3;

  if(h >= 0.0){
    h = sqrt(h);
    vec2 x = (vec2(h, -h) - q) / 2.0;
    vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
    float t = uv.x + uv.y - kx;
    t = clamp( t, 0.0, 1.0 );

    vec2 qos = d + (c + b*t)*t;
    res = length(qos);
  } else {
    float z = sqrt(-p);
    float v = acos( q/(p*z*2.0) ) / 3.0;
    float m = cos(v);
    float n = sin(v)*1.732050808;
    vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
    t = clamp( t, 0.0, 1.0 );

    vec2 qos = d + (c + b*t.x)*t.x;
    float dis = dot(qos,qos);
    res = dis;

    qos = d + (c + b*t.y)*t.y;
    dis = dot(qos,qos);
    res = min(res,dis);

    qos = d + (c + b*t.z)*t.z;
    dis = dot(qos,qos);
    res = min(res,dis);

    res = sqrt( res );
  }

  return res;
}

// Heart param
vec2 getHeartPosition(float t){
  return vec2(16.0 * sin(t) * sin(t) * sin(t),
              -(13.0 * cos(t) - 5.0 * cos(2.0*t)
                - 2.0 * cos(3.0*t) - cos(4.0*t)));
}

float getGlow(float dist, float rad, float intensity){
  return pow(rad/dist, intensity);
}

float getSegment(float t, vec2 pos, float offset, float scale){
  for(int i = 0; i < POINT_COUNT; i++){
    points[i] = getHeartPosition(offset + float(i)*len + fract(speed * t) * 6.283185307);
  }

  vec2 c = (points[0] + points[1]) / 2.0;
  vec2 c_prev;
  float dist = 10000.0;

  for(int i = 0; i < POINT_COUNT-1; i++){
    c_prev = c;
    c = (points[i] + points[i+1]) / 2.0;
    dist = min(dist, sdBezier(pos, scale * c_prev, scale * points[i], scale * c));
  }
  return max(0.0, dist);
}

void main(){
  vec2 uv = gl_FragCoord.xy/resolution.xy;
  float widthHeightRatio = resolution.x/resolution.y;
  vec2 centre = vec2(0.5, 0.5);
  vec2 pos = centre - uv;
  pos.y /= widthHeightRatio;
  pos.y += 0.02;
  float scale = 0.000015 * height;

  float t = time;

  float dist = getSegment(t, pos, 0.0, scale);
  float glow = getGlow(dist, rads, intensity);

  vec3 col = vec3(0.0);
  col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
  col += glow * vec3(1.0,0.05,0.3);

  dist = getSegment(t, pos, 3.4, scale);
  glow = getGlow(dist, rads, intensity);

  col += 10.0*vec3(smoothstep(0.003, 0.001, dist));
  col += glow * vec3(0.1,0.4,1.0);

  col = 1.0 - exp(-col);
  col = pow(col, vec3(0.4545));

  gl_FragColor = vec4(col,1.0);
}
`;

  //************** Utility functions **************

  window.addEventListener('resize', onWindowResize, false);

  function onWindowResize(){
    setCanvasSizeToWindow();
    gl.viewport(0, 0, canvas.width, canvas.height);
    // update uniform sizes later after program/link
    if (typeof widthHandle !== 'undefined' && widthHandle) {
      gl.uniform1f(widthHandle, canvas.width);
    }
    if (typeof heightHandle !== 'undefined' && heightHandle) {
      gl.uniform1f(heightHandle, canvas.height);
    }
  }

  //Compile shader and combine with source
  function compileShader(shaderSource, shaderType){
    const shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
      throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
    }
    return shader;
  }

  // Utility to complain loudly if we fail to find the attribute/uniform
  function getAttribLocation(program, name) {
    const attributeLocation = gl.getAttribLocation(program, name);
    if (attributeLocation === -1) {
      throw 'Cannot find attribute ' + name + '.';
    }
    return attributeLocation;
  }

  function getUniformLocation(program, name) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) {
      throw 'Cannot find uniform ' + name + '.';
    }
    return location;
  }

  //************** Create shaders **************
  //Create vertex and fragment shaders
  const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

  //Create shader programs
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program failed to link:', gl.getProgramInfoLog(program));
    return;
  }

  gl.useProgram(program);

  //Set up rectangle covering entire canvas
  const vertexData = new Float32Array([
    -1.0,  1.0,   // top left
    -1.0, -1.0,   // bottom left
     1.0,  1.0,   // top right
     1.0, -1.0,   // bottom right
  ]);

  //Create vertex buffer
  const vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  // Layout of our data in the vertex buffer
  const positionHandle = getAttribLocation(program, 'position');

  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(positionHandle,
    2,          // position is a vec2 (2 values per component)
    gl.FLOAT,   // each component is a float
    false,      // don't normalize values
    2 * 4,      // two 4 byte float components per vertex
    0           // how many bytes inside the buffer to start from
  );

  //Set uniform handle
  const timeHandle = getUniformLocation(program, 'time');
  const widthHandle = getUniformLocation(program, 'width');
  const heightHandle = getUniformLocation(program, 'height');

  // initialize uniforms
  gl.uniform1f(widthHandle, canvas.width);
  gl.uniform1f(heightHandle, canvas.height);

  let lastFrame = Date.now();
  let thisFrame;

  // set viewport initially
  gl.viewport(0, 0, canvas.width, canvas.height);

  function draw(){
    //Update time
    thisFrame = Date.now();
    time += (thisFrame - lastFrame)/1000;
    lastFrame = thisFrame;

    //Send uniforms to program
    gl.uniform1f(timeHandle, time);

    //Draw a triangle strip connecting vertices 0-4
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(draw);
  }

  draw();

}); // end DOMContentLoaded
