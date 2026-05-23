// 1. Setup the 3D Scene, Camera, and Renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(0, 0, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add controls so you can rotate the 3D object with your mouse
const controls = new THREE.OrbitControls(camera, renderer.domElement);

// Add some lights so we can actually see the 3D depth
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

// 2. Load and Extrude the SVG
const loader = new THREE.SVGLoader();

// Replace 'your-icon.svg' with the path to your actual SVG file
loader.load('logo.svg', function (data) {
    const paths = data.paths;
    const group = new THREE.Group();

    // Settings to define the 3D thickness
    const extrusionSettings = {
        depth: 1000,           
        bevelEnabled: false,  
        bevelThickness: 1,   
        bevelSize: 0.5,      
        bevelSegments: 3    
    };

    // Loop through all the paths inside the SVG file
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        
        // Convert the SVG path into a 2D shape Three.js understands
        const shapes = THREE.SVGLoader.createShapes(path);

        for (let j = 0; j < shapes.length; j++) {
            const shape = shapes[j];
            
            // CRITICAL STEP: This turns the 2D shape into 3D using our settings
            const geometry = new THREE.ExtrudeGeometry(shape, extrusionSettings);
            
            // Give it a 3D material/color
            const material = new THREE.MeshStandardMaterial({ 
                color: path.color, // Keeps the original color from the SVG
                roughness: 0.3,
                metalness: 0.1
            });

            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
        }
    }

    // SVGs load upside down in Three.js by default; flip it right-side up
    group.scale.y = -1;
    
    // Center the object in the scene
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    group.position.x = -size.x / 2;
    group.position.y = size.y / 2;

    scene.add(group);
});

// 3. Animation Loop to render the scene
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, '');
}
animate();

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const glow = document.querySelector(".background-glow");
const cards = document.querySelectorAll(".card");

if (glow) {
  document.addEventListener("mousemove", (e) => {
    const cursorX = e.clientX;
    const cursorY = e.clientY;

    glow.style.left = cursorX + "px";
    glow.style.top = cursorY + "px";

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      const distanceX = cursorX - cardCenterX;
      const distanceY = cursorY - cardCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      const maxDistance = 350;
      const intensity = Math.max(0, 1 - distance / maxDistance);

      if (intensity > 0.1) {
        const length = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        const dirX = (distanceX / length) * intensity;
        const dirY = (distanceY / length) * intensity;

        card.style.setProperty("--glow-x", `${dirX * 15}px`);
        card.style.setProperty("--glow-y", `${dirY * 15}px`);
        card.style.setProperty("--glow-intensity", intensity * 0.4);
        card.classList.add("card-glow-active");
      } else {
        card.classList.remove("card-glow-active");
      }
    });
  });
}