import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const BH_CENTER_Y = 0;

// Group to hold ALL black hole objects
const bhGroup = new THREE.Group();
bhGroup.position.set(0, 0, 0);
scene.add(bhGroup);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
// Camera fixed position — looking slightly BELOW the black hole center
// This makes the black hole appear in the upper portion of the screen
const VISUAL_LIFT = 1.0; // << INCREASE to push black hole higher on screen, DECREASE to lower it
camera.position.set(0, 2.8, 9.5);
camera.lookAt(0, -VISUAL_LIFT, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
const root = document.getElementById('root') ?? document.body;
root.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 25;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;
controls.enablePan = false;
controls.target.set(0, -VISUAL_LIFT, 0);
controls.maxPolarAngle = Math.PI * 0.85;
controls.minPolarAngle = Math.PI * 0.05;

// Post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55, 0.75, 0.7
);
composer.addPass(bloomPass);

// Vignette pass
const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.95 },
    darkness: { value: 1.6 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float dist = length(uv);
      float vig = smoothstep(offset, offset + 0.7, dist) * darkness;
      texel.rgb *= 1.0 - vig;
      gl_FragColor = texel;
    }
  `
};
const vignettePass = new ShaderPass(VignetteShader);
composer.addPass(vignettePass);

composer.addPass(new OutputPass());

// ===== STARFIELD =====
const starCount = 15000;
const starGeo = new THREE.BufferGeometry();
const starPositions = new Float32Array(starCount * 3);
const starSizes = new Float32Array(starCount);
const starColors = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const r = 40 + Math.random() * 600;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  starPositions[i * 3 + 2] = r * Math.cos(phi);
  starSizes[i] = 1.0 + Math.random() * 3.5;
  const temp = Math.random();
  if (temp < 0.25) { starColors[i*3]=0.6; starColors[i*3+1]=0.8; starColors[i*3+2]=1.0; }
  else if (temp < 0.5) { starColors[i*3]=1.0; starColors[i*3+1]=0.92; starColors[i*3+2]=0.75; }
  else if (temp < 0.7) { starColors[i*3]=1.0; starColors[i*3+1]=0.65; starColors[i*3+2]=0.45; }
  else { starColors[i*3]=1.0; starColors[i*3+1]=1.0; starColors[i*3+2]=1.0; }
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starGeo.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
starGeo.setAttribute('aColor', new THREE.BufferAttribute(starColors, 3));

const starMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    attribute float aSize;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vBright;
    uniform float uTime;
    void main(){
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float twinkle = sin(uTime * 1.5 + position.x * 5.0 + position.z * 3.0) * 0.35 + 0.65;
      vBright = twinkle;
      gl_PointSize = aSize * (200.0 / -mv.z) * twinkle;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vBright;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if(d > 0.5) discard;
      float core = exp(-d * 12.0);
      float glow = exp(-d * 4.0) * 0.2;
      float alpha = core + glow;
      gl_FragColor = vec4(vColor * vBright * 1.2 * (core + glow), alpha * 1.0);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const stars = new THREE.Points(starGeo, starMat);
stars.name = 'starfield';
scene.add(stars);

// Near stars for foreground depth
const nearStarCount = 800;
const nearStarGeo = new THREE.BufferGeometry();
const nearStarPos = new Float32Array(nearStarCount * 3);
const nearStarSizes = new Float32Array(nearStarCount);
const nearStarColors = new Float32Array(nearStarCount * 3);
for (let i = 0; i < nearStarCount; i++) {
  const r = 20 + Math.random() * 60;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  nearStarPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
  nearStarPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
  nearStarPos[i * 3 + 2] = r * Math.cos(phi);
  nearStarSizes[i] = 0.4 + Math.random() * 1.2;
  const temp = Math.random();
  if (temp < 0.3) { nearStarColors[i*3]=0.5; nearStarColors[i*3+1]=0.7; nearStarColors[i*3+2]=1.0; }
  else if (temp < 0.6) { nearStarColors[i*3]=0.9; nearStarColors[i*3+1]=0.85; nearStarColors[i*3+2]=1.0; }
  else { nearStarColors[i*3]=1.0; nearStarColors[i*3+1]=1.0; nearStarColors[i*3+2]=1.0; }
}
nearStarGeo.setAttribute('position', new THREE.BufferAttribute(nearStarPos, 3));
nearStarGeo.setAttribute('aSize', new THREE.BufferAttribute(nearStarSizes, 1));
nearStarGeo.setAttribute('aColor', new THREE.BufferAttribute(nearStarColors, 3));
const nearStars = new THREE.Points(nearStarGeo, starMat.clone());
nearStars.name = 'nearStarfield';
scene.add(nearStars);

// ===== BLACK HOLE CORE =====
const bhGeo = new THREE.SphereGeometry(1.15, 64, 64);
const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const blackHole = new THREE.Mesh(bhGeo, bhMat);
blackHole.name = 'eventHorizon';
blackHole.position.y = BH_CENTER_Y;
blackHole.renderOrder = 10;
bhGroup.add(blackHole);

// ===== INNER GLOW RING =====
const innerRingGeo = new THREE.TorusGeometry(1.15, 0.04, 32, 128);
const innerRingMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main(){
      vUv = uv;
      vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform float uTime;
    void main(){
      float pulse = sin(uTime * 3.0 + vUv.x * 20.0) * 0.3 + 0.7;
      vec3 col = vec3(0.15, 0.35, 0.7) * pulse * 0.4;
      gl_FragColor = vec4(col, 0.15 * pulse);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
innerRing.rotation.x = Math.PI * 0.5;
innerRing.position.y = BH_CENTER_Y;
innerRing.name = 'innerGlowRing';
bhGroup.add(innerRing);

// ===== ACCRETION DISC =====

function createDiscShader() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenterY: { value: BH_CENTER_Y }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      void main(){
        vUv = uv;
        vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
        vLocalPos = position.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;
      uniform float uTime;
      uniform float uCenterY;

      float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        float a=hash(i), b=hash(i+vec2(1.0,0.0));
        float c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      float fbm(vec2 p){
        float v=0.0, a=0.5;
        mat2 rot = mat2(0.8,-0.6,0.6,0.8);
        for(int i=0;i<6;i++){ v+=a*noise(p); p=rot*p*2.1; a*=0.48; }
        return v;
      }

      void main(){
        float r = length(vWorldPos.xz);
        if(r < 0.001) discard;
        float angle = atan(vWorldPos.z, vWorldPos.x);
        float normR = clamp((r - 1.5) / 3.5, 0.0, 1.0);

        float speed = 1.4 / max(pow(r * 0.4, 1.5), 0.01);
        float rotAngle = angle + uTime * speed;

        vec2 nc = vec2(rotAngle * 3.0, r * 2.5);
        float turb1 = fbm(nc + uTime * 0.2);
        float turb2 = fbm(nc * 1.8 - uTime * 0.35);
        float turb3 = fbm(vec2(rotAngle * 12.0 + uTime * 0.8, r * 6.0));
        float fineTurb = fbm(vec2(rotAngle * 25.0 + uTime * 1.5, r * 10.0));

        float temp = pow(1.0 - normR, 2.2);

        vec3 hotCore  = vec3(0.5, 0.65, 0.95);
        vec3 hotColor = vec3(0.2, 0.45, 0.9);
        vec3 midColor = vec3(0.05, 0.15, 0.55);
        vec3 coolColor= vec3(0.005, 0.015, 0.15);
        vec3 accentColor = vec3(0.1, 0.3, 0.7);

        vec3 col = mix(coolColor, midColor, smoothstep(0.0, 0.4, temp));
        col = mix(col, hotColor, smoothstep(0.4, 0.7, temp));
        col = mix(col, hotCore, smoothstep(0.8, 1.0, temp));
        col += accentColor * fineTurb * 0.25 * temp;

        float brightness = turb1 * 0.35 + 0.55;
        brightness *= 1.0 + turb2 * 0.35;

        float spiralArm1 = sin(rotAngle * 3.0 + r * 5.0 - uTime * 1.5) * 0.5 + 0.5;
        float spiralArm2 = sin(rotAngle * 5.0 - r * 3.5 + uTime * 1.0) * 0.5 + 0.5;
        float spiralMask = spiralArm1 * 0.6 + spiralArm2 * 0.4;
        brightness *= 0.5 + spiralMask * 0.6;

        float streaks = pow(turb3, 2.0) * temp * 3.0;
        col += vec3(0.15, 0.35, 0.8) * streaks * 0.4;

        float innerFade = smoothstep(1.5, 1.9, r);
        float outerFade = smoothstep(5.0, 3.0, r);
        float alpha = innerFade * outerFade * brightness * (1.0 + turb1 * 0.2);

        float doppler = sin(angle + uTime * 0.4) * 0.2 + 1.0;
        col *= doppler;

        float innerEdge = smoothstep(2.0, 1.55, r) * smoothstep(1.5, 1.65, r);
        col += vec3(0.25, 0.45, 0.9) * innerEdge * 1.5;

        float innerStreaks = smoothstep(2.5, 1.5, r) * pow(fineTurb, 1.5) * 0.8;
        col += vec3(0.1, 0.25, 0.65) * innerStreaks * 0.5;

        col = pow(clamp(col * brightness, 0.0, 1.0), vec3(0.9));

        gl_FragColor = vec4(col, clamp(alpha * 0.75, 0.0, 1.0));
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

const discGeo = new THREE.RingGeometry(1.5, 5.0, 384, 48);
const discMat = createDiscShader();
const disc = new THREE.Mesh(discGeo, discMat);
disc.rotation.x = -Math.PI * 0.5;
disc.position.y = BH_CENTER_Y;
disc.name = 'accretionDisc';
bhGroup.add(disc);

const disc2Geo = new THREE.RingGeometry(1.6, 4.8, 384, 48);
const disc2Mat = createDiscShader();
const disc2 = new THREE.Mesh(disc2Geo, disc2Mat);
disc2.rotation.x = -Math.PI * 0.5 + 0.04;
disc2.position.y = BH_CENTER_Y + 0.07;
disc2.name = 'accretionDiscUpper';
bhGroup.add(disc2);

const disc3Geo = new THREE.RingGeometry(1.6, 4.8, 384, 48);
const disc3Mat = createDiscShader();
const disc3 = new THREE.Mesh(disc3Geo, disc3Mat);
disc3.rotation.x = -Math.PI * 0.5 - 0.04;
disc3.position.y = BH_CENTER_Y - 0.07;
disc3.name = 'accretionDiscLower';
bhGroup.add(disc3);

const haloGeo = new THREE.RingGeometry(4.5, 7.0, 128, 16);
const haloMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec3 vWorldPos;
    void main(){
      vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPos;
    uniform float uTime;
    float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      f=f*f*(3.0-2.0*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
    }
    void main(){
      float r = length(vWorldPos.xz);
      float a = atan(vWorldPos.z, vWorldPos.x);
      float speed = 0.3 / pow(r * 0.3, 1.5);
      float n = noise(vec2(a * 4.0 + uTime * speed, r * 2.0));
      float fade = smoothstep(7.0, 5.0, r) * smoothstep(4.5, 5.2, r);
      vec3 col = vec3(0.03, 0.1, 0.45) * n;
      gl_FragColor = vec4(col, fade * n * 0.15);
    }
  `,
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const halo = new THREE.Mesh(haloGeo, haloMat);
halo.rotation.x = -Math.PI * 0.5;
halo.position.y = BH_CENTER_Y;
halo.name = 'discHalo';
bhGroup.add(halo);



// ===== ORBITING MATTER =====
const orbitCount = 3000;
const orbitGeo = new THREE.BufferGeometry();
const orbitPos = new Float32Array(orbitCount * 3);
const orbitMeta = [];
for (let i = 0; i < orbitCount; i++) {
  const r = 1.8 + Math.random() * 3.5;
  const a = Math.random() * Math.PI * 2;
  const speed = 0.6 / Math.pow(r * 0.4, 1.5);
  const yOff = (Math.random() - 0.5) * 0.25 / r;
  orbitPos[i*3] = Math.cos(a) * r;
  orbitPos[i*3+1] = yOff + BH_CENTER_Y;
  orbitPos[i*3+2] = Math.sin(a) * r;
  orbitMeta.push({ r, a, speed, yOff });
}
orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));

const orbitMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying float vTemp;
    uniform float uTime;
    void main(){
      float r = length(position.xz);
      vTemp = 1.0 - clamp((r - 1.8) / 3.5, 0.0, 1.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = max(1.0, (1.5 + vTemp * 2.5) * (80.0 / -mv.z));
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    varying float vTemp;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      if(d > 0.5) discard;
      float alpha = exp(-d * 6.0);
      vec3 hot = vec3(0.45, 0.6, 0.85);
      vec3 cool = vec3(0.04, 0.1, 0.4);
      vec3 col = mix(cool, hot, vTemp);
      gl_FragColor = vec4(col * 0.8, alpha * 0.3);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const orbitParticles = new THREE.Points(orbitGeo, orbitMat);
orbitParticles.name = 'orbitingMatter';
bhGroup.add(orbitParticles);

function updateOrbitParticles(t) {
  const pos = orbitParticles.geometry.attributes.position.array;
  for (let i = 0; i < orbitCount; i++) {
    const m = orbitMeta[i];
    const angle = m.a + t * m.speed;
    pos[i*3] = Math.cos(angle) * m.r;
    pos[i*3+1] = m.yOff + BH_CENTER_Y + Math.sin(t * 2.5 + angle) * 0.015;
    pos[i*3+2] = Math.sin(angle) * m.r;
  }
  orbitParticles.geometry.attributes.position.needsUpdate = true;
}

// ===== HUD NAV LINKS =====

const beasigneFont = document.createElement('style');
beasigneFont.textContent = `
  @font-face {
    font-family: 'Beasigne';
    src: url('Beasigne.ttf') format('truetype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
`;
document.head.appendChild(beasigneFont);

const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@200;400;600&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

const lineCanvas = document.createElement('canvas');
lineCanvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9;';
document.body.appendChild(lineCanvas);
const lineCtx = lineCanvas.getContext('2d');

function resizeLineCanvas() {
  lineCanvas.width = window.innerWidth;
  lineCanvas.height = window.innerHeight;
}
resizeLineCanvas();

const navLinks = [
  { label: 'EVENTS',   left: '55px',  top: '50px',   right: 'auto', bottom: 'auto', align: 'left',  connectorType: 'arc-right'},
  { label: 'RULES',    left: 'auto',  top: '70px',   right: '55px', bottom: 'auto', align: 'right', connectorType: 'zigzag' },
  { label: 'LEGACY',   left: 'auto',  top: 'auto',   right: '55px', bottom: '110px', align: 'right', connectorType: 'curve-s' },
  { label: 'CONTACTS', left: '55px',  top: 'auto',   right: 'auto', bottom: '110px', align: 'left',  connectorType: 'step-down' },
];

const posKeys = ['tl', 'tr', 'br', 'bl'];
const linkElements = navLinks.map((link, i) => {
  const el = document.createElement('div');
  el.className = 'nav-item';
  el.setAttribute('data-pos', posKeys[i]);
  el.style.cssText = `
    position: fixed;
    left: ${link.left};
    top: ${link.top};
    right: ${link.right};
    bottom: ${link.bottom};
    pointer-events: auto;
    cursor: pointer;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: ${link.align === 'right' ? 'flex-end' : 'flex-start'};
    opacity: 0;
    transform-origin: ${link.align === 'right' ? 'top right' : 'top left'};
    animation: navFadeIn${link.align === 'right' ? 'Right' : 'Left'} 1.0s cubic-bezier(0.16,1,0.3,1) ${0.8 + i * 0.25}s forwards;
  `;

  const markerSide = link.align === 'right' ? 'margin-left: auto;' : 'margin-right: auto;';

  el.innerHTML = `
    <div class="nav-marker" style="
      width: 18px; height: 2px;
      background: rgba(60, 150, 255, 0.4);
      ${markerSide}
      margin-bottom: 8px;
    "></div>
    <div class="nav-label" data-idx="${i}" style="
      font-family: 'Beasigne', 'Inter', sans-serif;
      font-size: 26px;
      font-weight: 400;
      letter-spacing: 6px;
      color: rgba(60, 150, 255, 0.9);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      text-shadow: 0 0 12px rgba(60, 150, 255, 0.25);
      padding-bottom: 6px;
      text-align: ${link.align};
    ">${link.label}</div>
    <div class="nav-underline" style="
      width: 0%;
      height: 1.5px;
      background: linear-gradient(${link.align === 'right' ? '270deg' : '90deg'}, rgba(60, 150, 255, 0.9), rgba(60, 150, 255, 0.0));
      transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      ${link.align === 'right' ? 'margin-left: auto;' : ''}
    "></div>
    <div class="nav-subtitle" style="
      font-family: 'Inter', sans-serif;
      font-size: 9px;
      letter-spacing: 3px;
      color: rgba(100, 170, 255, 0.3);
      margin-top: 6px;
      text-align: ${link.align};
    ">${['001 — UPCOMING', '002 — GUIDELINES', '003 — HISTORY', '004 — GET IN TOUCH'][i]}</div>
  `;

  const label = el.querySelector('.nav-label');
  const underline = el.querySelector('.nav-underline');
  const marker = el.querySelector('.nav-marker');

  el.addEventListener('mouseenter', () => {
    label.style.color = 'rgba(130, 200, 255, 1.0)';
    label.style.textShadow = '0 0 25px rgba(80, 170, 255, 0.5), 0 0 50px rgba(60, 150, 255, 0.2)';
    label.style.transform = link.align === 'right' ? 'translateX(-8px)' : 'translateX(8px)';
    underline.style.width = '100%';
    marker.style.width = '35px';
    marker.style.background = 'rgba(80, 180, 255, 0.7)';
  });
  el.addEventListener('mouseleave', () => {
    label.style.color = 'rgba(60, 150, 255, 0.9)';
    label.style.textShadow = '0 0 12px rgba(60, 150, 255, 0.25)';
    label.style.transform = 'translateX(0)';
    underline.style.width = '0%';
    marker.style.width = '18px';
    marker.style.background = 'rgba(60, 150, 255, 0.4)';
  });

  document.body.appendChild(el);
  return { el, link, index: i };
});

  // Add click handlers for nav labels to navigate to local pages
  const navTargets = [
    '../eventsv1-main/index.html',
    '../rules/index.html',
    '../leg/index.html',
    '../contacts-main/index.html'
  ];

  linkElements.forEach((item, i) => {
    const labelEl = item.el.querySelector('.nav-label');
    if (!labelEl) return;
    labelEl.style.cursor = 'pointer';
    labelEl.addEventListener('click', (e) => {
      window.location.href = navTargets[i];
    });
  });

// Inject keyframe animations + responsive styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes navFadeInLeft {
    from { opacity: 0; transform: translateX(-50px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes navFadeInRight {
    from { opacity: 0; transform: translateX(50px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes taglineFadeIn {
    from { opacity: 0; transform: translateY(12px); letter-spacing: 12px; padding-left: 12px; }
    to { opacity: 1; transform: translateY(0); letter-spacing: 7px; padding-left: 7px; }
  }
  @keyframes titleGlow {
    0% { text-shadow: 0 0 20px rgba(60, 150, 255, 0.4), 0 0 50px rgba(40, 120, 255, 0.2), 0 0 90px rgba(30, 100, 255, 0.1); }
    100% { text-shadow: 0 0 25px rgba(80, 170, 255, 0.55), 0 0 60px rgba(50, 140, 255, 0.3), 0 0 100px rgba(40, 110, 255, 0.15); }
  }
  .nav-marker, .nav-underline { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); }

  .top-title {
    opacity: 0;
    animation: topTitleFadeIn 1.5s cubic-bezier(0.16,1,0.3,1) 0.3s forwards;
  }
  @keyframes topTitleFadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); letter-spacing: 24px; padding-left: 24px; }
    to { opacity: 1; transform: translateX(-50%) translateY(0); letter-spacing: 18px; padding-left: 18px; }
  }

  @media (max-width: 1024px) {
    .nav-item { transform: scale(0.85); }
    .nav-item[data-pos="tl"] { left: 30px !important; top: 40px !important; }
    .nav-item[data-pos="tr"] { right: 30px !important; top: 55px !important; }
    .nav-item[data-pos="br"] { right: 30px !important; bottom: 80px !important; }
    .nav-item[data-pos="bl"] { left: 30px !important; bottom: 80px !important; }
    .nav-item .nav-label { font-size: 18px !important; letter-spacing: 4px !important; }
    .nav-item .nav-subtitle { font-size: 7px !important; letter-spacing: 2px !important; }
    .bottom-title { transform: translateX(-50%) scale(0.85) !important; bottom: 25px !important; }
    .top-title .top-title-main { font-size: 42px !important; letter-spacing: 14px !important; }
    .top-title { padding-top: 24px !important; }
    .bottom-title .bottom-title-tagline, .bottom-title .bottom-title-tagline2 { font-size: 12px !important; letter-spacing: 5px !important; }
  }

  @media (max-width: 768px) {
    .nav-item { transform: scale(0.75); }
    .nav-item[data-pos="tl"] { left: 15px !important; top: 25px !important; }
    .nav-item[data-pos="tr"] { right: 15px !important; top: 25px !important; }
    .nav-item[data-pos="br"] { right: 15px !important; bottom: 55px !important; }
    .nav-item[data-pos="bl"] { left: 15px !important; bottom: 55px !important; }
    .nav-item .nav-label { font-size: 14px !important; letter-spacing: 3px !important; }
    .nav-item .nav-subtitle { font-size: 6px !important; letter-spacing: 1.5px !important; }
    .nav-item .nav-marker { width: 12px !important; margin-bottom: 5px !important; }
    .bottom-title { transform: translateX(-50%) scale(0.7) !important; bottom: 15px !important; }
    .top-title .top-title-main { font-size: 34px !important; letter-spacing: 10px !important; margin-top: 50px !important; }
    .top-title { padding-top: 18px !important; }
    .top-title .top-title-year { display: none !important; }
    .bottom-title .bottom-title-tagline, .bottom-title .bottom-title-tagline2 { font-size: 10px !important; letter-spacing: 4px !important; }
  }

  @media (max-width: 480px) {
    .nav-item { transform: scale(0.65); }
    .nav-item[data-pos="tl"] { left: 10px !important; top: 18px !important; }
    .nav-item[data-pos="tr"] { right: 10px !important; top: 18px !important; }
    .nav-item[data-pos="br"] { right: 10px !important; bottom: 42px !important; }
    .nav-item[data-pos="bl"] { left: 10px !important; bottom: 42px !important; }
    .nav-item .nav-label { font-size: 11px !important; letter-spacing: 2px !important; }
    .nav-item .nav-subtitle { font-size: 5px !important; letter-spacing: 1px !important; }
    .nav-item .nav-marker { width: 8px !important; margin-bottom: 3px !important; }
    .bottom-title { transform: translateX(-50%) scale(0.55) !important; bottom: 8px !important; }
    .top-title .top-title-main { font-size: 24px !important; letter-spacing: 8px !important; margin-top: 50px !important; }
    .top-title { padding-top: 12px !important; }
    .bottom-title .bottom-title-tagline, .bottom-title .bottom-title-tagline2 { font-size: 8px !important; letter-spacing: 3px !important; }
    .top-title .top-title-deco-top, .top-title .top-title-deco-bottom { display: none !important; }
    .top-title .top-title-year { display: none !important; }
  }

  @media (max-width: 360px) {
    .nav-item { transform: scale(0.55); }
    .nav-item[data-pos="tl"] { left: 5px !important; top: 12px !important; }
    .nav-item[data-pos="tr"] { right: 5px !important; top: 12px !important; }
    .nav-item[data-pos="br"] { right: 5px !important; bottom: 35px !important; }
    .nav-item[data-pos="bl"] { left: 5px !important; bottom: 35px !important; }
    .nav-item .nav-label { font-size: 9px !important; letter-spacing: 1.5px !important; }
    .nav-item .nav-subtitle { display: none !important; }
    .bottom-title { transform: translateX(-50%) scale(0.45) !important; bottom: 5px !important; }
    .top-title .top-title-main { font-size: 18px !important; letter-spacing: 6px !important; margin-top: 50px !important; }
    .top-title { padding-top: 8px !important; }
    .bottom-title .bottom-title-tagline, .bottom-title .bottom-title-tagline2 { font-size: 7px !important; letter-spacing: 2px !important; }
  }
`;
document.head.appendChild(styleSheet);

// ===== TOP TITLE: LA 2K26 =====
const topTitleEl = document.createElement('div');
topTitleEl.className = 'top-title';
topTitleEl.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:10;text-align:center;pointer-events:none;padding-top:32px;';
topTitleEl.innerHTML = `
  <div class="top-title-deco-top" style="
    width: 40px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(80,160,255,0.4), transparent);
    margin: 0 auto 14px;
  "></div>
  <div class="top-title-main" style="
    font-family: 'Beasigne', 'Inter', sans-serif;
    font-size: 36px;
    font-weight: 400;
    letter-spacing: 18px;
    padding-left: 18px;
    text-indent: 0;
    color: rgba(140, 200, 255, 0.9);
    text-shadow: 0 0 20px rgba(60, 150, 255, 0.45), 0 0 50px rgba(40, 120, 255, 0.25), 0 0 90px rgba(30, 100, 255, 0.12);
    line-height: 1.1;
    position: relative;
    animation: titleGlow 3s ease-in-out infinite alternate;
  ">LAFEST 26</div>
  <div class="top-title-deco-bottom" style="
    width: 80px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(80,160,255,0.3), transparent);
    margin: 14px auto 0;
  "></div>
  <div class="top-title-year" style="
    font-family: 'Inter', sans-serif;
    font-size: 8px;
    font-weight: 200;
    letter-spacing: 5px;
    color: rgba(100, 170, 255, 0.22);
    margin-top: 8px;
  ">2 0 2 6</div>
`;
document.body.appendChild(topTitleEl);

// Title at bottom center
const titleEl = document.createElement('div');
titleEl.className = 'bottom-title';
titleEl.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);z-index:10;text-align:center;pointer-events:none;';
titleEl.innerHTML = `
  <div class="bottom-title-line" style="width:60px;height:1px;background:rgba(100,170,255,0.2);margin:0 auto 14px;"></div>
  <div class="bottom-title-tagline" style="font-size:16px;letter-spacing:7px;padding-left:7px;color:rgba(140,190,255,0.6);font-family:'Beasigne','Inter',sans-serif;line-height:2.0;opacity:0;animation:taglineFadeIn 1.2s cubic-bezier(0.16,1,0.3,1) 1.8s forwards;text-indent:0;">A CHRONICLE FORGED</div>
  <div class="bottom-title-tagline2" style="font-size:16px;letter-spacing:7px;padding-left:7px;color:rgba(140,190,255,0.6);font-family:'Beasigne','Inter',sans-serif;opacity:0;animation:taglineFadeIn 1.2s cubic-bezier(0.16,1,0.3,1) 2.2s forwards;text-indent:0;">A GENESIS EXALTED</div>
  <div class="bottom-title-line2" style="width:40px;height:1px;background:rgba(100,170,255,0.15);margin:14px auto 0;opacity:0;animation:taglineFadeIn 1.0s ease 2.5s forwards;"></div>
`;
document.body.appendChild(titleEl);

// ===== CONNECTOR DRAWING =====

function drawConnectorLine(ctx, points, t, index) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  const lastPoint = points[points.length - 1];
  const grad = ctx.createLinearGradient(points[0].x, points[0].y, lastPoint.x, lastPoint.y);
  grad.addColorStop(0, 'rgba(60, 140, 255, 0.0)');
  grad.addColorStop(0.15, 'rgba(60, 140, 255, 0.15)');
  grad.addColorStop(0.5, 'rgba(60, 150, 255, 0.35)');
  grad.addColorStop(1, 'rgba(80, 170, 255, 0.55)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  for (let i = 1; i < points.length - 1; i++) {
    const pulse = Math.sin(t * 2.5 + index * 1.5 + i) * 0.3 + 0.7;
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(100, 180, 255, ${0.5 * pulse})`;
    ctx.fill();
  }

  const totalLen = getPathLength(points);
  const dotT = (t * 0.5 + index * 0.5) % 2.5;
  if (dotT < 1.5) {
    const frac = dotT / 1.5;
    const pos = getPointAlongPath(points, frac, totalLen);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(160, 210, 255, 0.9)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80, 160, 255, 0.15)';
    ctx.fill();
  }
}

function getPathLength(points) {
  let len = 0;
  const count = points.length;
  for (let i = 1; i < count; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function getPointAlongPath(points, frac, totalLen) {
  const targetDist = frac * totalLen;
  let traveled = 0;
  const count = points.length;
  for (let i = 1; i < count; i++) {
    const dx = points[i].x - points[i-1].x;
    const dy = points[i].y - points[i-1].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (traveled + segLen >= targetDist) {
      const segFrac = (targetDist - traveled) / segLen;
      return {
        x: points[i-1].x + dx * segFrac,
        y: points[i-1].y + dy * segFrac
      };
    }
    traveled += segLen;
  }
  return points[count - 1];
}

function buildConnectorPoints(bhX, bhY, targetX, targetY, type) {
  switch(type) {
    case 'arc-right': {
      const deltaX = targetX - bhX;
      const deltaY = targetY - bhY;
      const midX = bhX + deltaX * 0.55;
      const midY = bhY + deltaY * 0.15;
      const mid2X = targetX + 40;
      const mid2Y = targetY - deltaY * 0.35;
      return [
        { x: bhX, y: bhY },
        { x: midX, y: midY },
        { x: mid2X, y: mid2Y },
        { x: targetX, y: targetY }
      ];
    }
    case 'zigzag': {
      const deltaX = targetX - bhX;
      const deltaY = targetY - bhY;
      const seg1X = bhX + deltaX * 0.3;
      const seg1Y = bhY + deltaY * 0.6;
      const seg2X = bhX + deltaX * 0.6;
      const seg2Y = bhY + deltaY * 0.25;
      return [
        { x: bhX, y: bhY },
        { x: seg1X, y: seg1Y },
        { x: seg2X, y: seg2Y },
        { x: targetX, y: targetY }
      ];
    }
    case 'curve-s': {
      const deltaX = targetX - bhX;
      const deltaY = targetY - bhY;
      const s1X = bhX + deltaX * 0.25;
      const s1Y = bhY + deltaY * 0.4;
      const s2X = bhX + deltaX * 0.55;
      const s2Y = bhY + deltaY * 0.65;
      const s3X = bhX + deltaX * 0.8;
      const s3Y = bhY + deltaY * 0.9;
      return [
        { x: bhX, y: bhY },
        { x: s1X, y: s1Y },
        { x: s2X, y: s2Y },
        { x: s3X, y: s3Y },
        { x: targetX, y: targetY }
      ];
    }
    case 'step-down': {
      const deltaY = targetY - bhY;
      const d1X = bhX + (targetX - bhX) * 0.2;
      const d1Y = bhY + deltaY * 0.5;
      const d2X = targetX + 30;
      const d2Y = bhY + deltaY * 0.7;
      return [
        { x: bhX, y: bhY },
        { x: d1X, y: d1Y },
        { x: d2X, y: d2Y },
        { x: targetX, y: targetY }
      ];
    }
    default:
      return [{ x: bhX, y: bhY }, { x: targetX, y: targetY }];
  }
}

// ===== ANIMATION LOOP =====
const clock = new THREE.Clock();
const tempVec = new THREE.Vector3();

function animate() {
  const t = clock.getElapsedTime();
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Update all shader uniforms
  innerRingMat.uniforms.uTime.value = t;

  discMat.uniforms.uTime.value = t;
  disc2Mat.uniforms.uTime.value = t;
  disc3Mat.uniforms.uTime.value = t;
  haloMat.uniforms.uTime.value = t;
  starMat.uniforms.uTime.value = t;
  orbitMat.uniforms.uTime.value = t;


  updateOrbitParticles(t);

  const breathe = Math.sin(t * 0.4) * 0.02;
  disc.rotation.x  = -Math.PI * 0.5 + breathe;
  disc.rotation.z  = t * 0.015;
  disc2.rotation.x = -Math.PI * 0.5 + 0.06 + breathe;
  disc2.rotation.z = t * 0.012;
  disc3.rotation.x = -Math.PI * 0.5 - 0.06 + breathe;
  disc3.rotation.z = t * 0.01;
  blackHole.scale.setScalar(1.0 + Math.sin(t * 2.0) * 0.008);



  stars.rotation.y = t * 0.003;
  nearStars.rotation.y = -t * 0.005;

  controls.update();

  // Project black hole center to screen coordinates (world position of group)
  tempVec.set(0, bhGroup.position.y, 0);
  bhGroup.getWorldPosition(tempVec);
  tempVec.project(camera);
  const bhX = (tempVec.x * 0.5 + 0.5) * width;
  const bhY = (-tempVec.y * 0.5 + 0.5) * height;

  // Draw connector lines
  lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);

  linkElements.forEach((item, i) => {
    const navEl = item.el;
    const rect = navEl.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    let targetX, targetY;
    if (item.link.align === 'right') {
      targetX = rect.left - 10;
      targetY = rect.top + rect.height * 0.45;
    } else {
      targetX = rect.right + 10;
      targetY = rect.top + rect.height * 0.45;
    }

    const points = buildConnectorPoints(bhX, bhY, targetX, targetY, item.link.connectorType);

    drawConnectorLine(lineCtx, points, t, i);
  });

  composer.render();
}

renderer.setAnimationLoop(animate);

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(window.innerWidth, window.innerHeight);
  resizeLineCanvas();
});

document.addEventListener("DOMContentLoaded", function () {
  // 1. Bulletproof check for genuine Safari (ignoring Chrome/Edge on Mac)
  const isSafari = /^((?!chrome|android|edg).)*safari/i.test(navigator.userAgent);

  if (isSafari) {
    // 2. Add a global flag to the body so CSS can handle the display safely
    document.body.classList.add("safari-fallback");
    
    // 3. Since the TV screen is hidden, make sure the backup layout displays immediately
    const mobileRules = document.querySelector(".mobile-rules");
    if (mobileRules) {
      mobileRules.style.display = "flex"; 
    }
  }
});