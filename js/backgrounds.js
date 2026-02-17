
// Background Animation System
// Handles multiple Three.js scenes that are randomly selected on page load

document.addEventListener('DOMContentLoaded', () => {
    initDynamicBackground();
});

function initDynamicBackground() {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing

    // Setup Basic Scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Input State
    const input = { mouseX: 0, mouseY: 0 };
    document.addEventListener('mousemove', (event) => {
        input.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        input.mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    // Theme Definitions
    const themes = [
        // 1. Classic Particles (The original subtle background)
        {
            name: "Classic Particles",
            init: (scene, camera) => {
                camera.position.z = 4;
                const geometry = new THREE.BufferGeometry();
                const count = 800;
                const positions = new Float32Array(count * 3);
                for(let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 25;
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.PointsMaterial({ size: 0.05, color: 0x64ffda, transparent: true, opacity: 0.8 });
                const particles = new THREE.Points(geometry, material);
                scene.add(particles);
                return (input) => {
                    particles.rotation.y += 0.001;
                    particles.rotation.x += 0.0005;
                    particles.rotation.x += input.mouseY * 0.05;
                    particles.rotation.y += input.mouseX * 0.05;
                };
            }
        },
        // 2. Cyber Grid (Tron-like floor)
        {
            name: "Cyber Grid",
            init: (scene, camera) => {
                camera.position.z = 30;
                camera.position.y = 10;
                camera.rotation.x = -0.5;
                
                const geometry = new THREE.PlaneGeometry(60, 60, 40, 40);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0x64ffda, 
                    wireframe: true, 
                    transparent: true, 
                    opacity: 0.15 
                });
                const plane = new THREE.Mesh(geometry, material);
                scene.add(plane);
                
                const originalPositions = geometry.attributes.position.array.slice();
                
                return (input) => {
                    const time = Date.now() * 0.001;
                    const positions = plane.geometry.attributes.position.array;
                    
                    for(let i = 0; i < positions.length; i += 3) {
                        const x = originalPositions[i];
                        const y = originalPositions[i+1];
                        positions[i+2] = Math.sin(x * 0.5 + time) * 2 + Math.cos(y * 0.3 + time) * 2;
                    }
                    plane.geometry.attributes.position.needsUpdate = true;
                    plane.rotation.z += 0.002;
                };
            }
        },
        // 3. Neural Sphere (Connected nodes)
        {
            name: "Neural Sphere",
            init: (scene, camera) => {
                camera.position.z = 5;
                
                const geometry = new THREE.IcosahedronGeometry(2.5, 1);
                const material = new THREE.MeshBasicMaterial({ 
                    color: 0x64ffda, 
                    wireframe: true, 
                    transparent: true, 
                    opacity: 0.3 
                });
                const sphere = new THREE.Mesh(geometry, material);
                scene.add(sphere);
                
                const particlesGeo = new THREE.BufferGeometry();
                const particleCount = 200;
                const pPos = new Float32Array(particleCount * 3);
                for(let i=0; i<particleCount*3; i++) pPos[i] = (Math.random() - 0.5) * 10;
                particlesGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
                const pMat = new THREE.PointsMaterial({ size: 0.03, color: 0x8892b0 });
                const particles = new THREE.Points(particlesGeo, pMat);
                scene.add(particles);

                return (input) => {
                    sphere.rotation.y += 0.003;
                    sphere.rotation.x += 0.002;
                    particles.rotation.y -= 0.001;
                    
                    sphere.rotation.x += input.mouseY * 0.02;
                    sphere.rotation.y += input.mouseX * 0.02;
                };
            }
        },
        // 4. Digital Rain (Matrix style)
        {
            name: "Digital Rain",
            init: (scene, camera) => {
                camera.position.z = 50;
                const geometry = new THREE.BufferGeometry();
                const count = 1500;
                const positions = new Float32Array(count * 3);
                const speeds = new Float32Array(count);
                
                for(let i = 0; i < count; i++) {
                    positions[i*3] = (Math.random() - 0.5) * 100; // x
                    positions[i*3+1] = (Math.random() - 0.5) * 100; // y
                    positions[i*3+2] = (Math.random() - 0.5) * 50; // z
                    speeds[i] = 0.2 + Math.random() * 0.5;
                }
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.PointsMaterial({ 
                    size: 0.3, 
                    color: 0x64ffda, // Changed to primary color
                    transparent: true, 
                    opacity: 0.6 
                });
                const rain = new THREE.Points(geometry, material);
                scene.add(rain);
                
                return (input) => {
                    const positions = rain.geometry.attributes.position.array;
                    for(let i = 0; i < count; i++) {
                        positions[i*3+1] -= speeds[i];
                        if (positions[i*3+1] < -50) {
                            positions[i*3+1] = 50;
                        }
                    }
                    rain.geometry.attributes.position.needsUpdate = true;
                    rain.rotation.y = input.mouseX * 0.2;
                    rain.rotation.x = input.mouseY * 0.2;
                };
            }
        },
        // 5. Galaxy Spiral
        {
            name: "Galaxy Spiral",
            init: (scene, camera) => {
                camera.position.z = 10;
                camera.position.y = 5;
                camera.rotation.x = -0.5;

                const geometry = new THREE.BufferGeometry();
                const count = 2000;
                const positions = new Float32Array(count * 3);
                const colors = new Float32Array(count * 3);
                
                const color1 = new THREE.Color(0x64ffda);
                const color2 = new THREE.Color(0x8892b0);

                for(let i = 0; i < count; i++) {
                    const radius = Math.random() * 10;
                    const spinAngle = radius * 2;
                    const branchAngle = (i % 3) * 2 * Math.PI / 3;
                    
                    const x = Math.cos(branchAngle + spinAngle) * radius + (Math.random()-0.5);
                    const y = (Math.random()-0.5) * 0.5;
                    const z = Math.sin(branchAngle + spinAngle) * radius + (Math.random()-0.5);
                    
                    positions[i*3] = x;
                    positions[i*3+1] = y;
                    positions[i*3+2] = z;

                    const mixedColor = color1.clone().lerp(color2, Math.random());
                    colors[i*3] = mixedColor.r; 
                    colors[i*3+1] = mixedColor.g; 
                    colors[i*3+2] = mixedColor.b; 
                }
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                
                const material = new THREE.PointsMaterial({ 
                    size: 0.05, 
                    vertexColors: true,
                    transparent: true, 
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending
                });
                const galaxy = new THREE.Points(geometry, material);
                scene.add(galaxy);
                
                return (input) => {
                    galaxy.rotation.y += 0.001;
                    galaxy.rotation.y += input.mouseX * 0.01;
                };
            }
        },
        // 6. Floating Geometries (New)
        {
            name: "Floating Geometries",
            init: (scene, camera) => {
                camera.position.z = 15;
                const group = new THREE.Group();
                scene.add(group);

                const geometries = [
                    new THREE.IcosahedronGeometry(1, 0),
                    new THREE.OctahedronGeometry(1, 0),
                    new THREE.TetrahedronGeometry(1, 0),
                    new THREE.TorusGeometry(0.7, 0.3, 16, 100)
                ];

                const material = new THREE.MeshBasicMaterial({ 
                    color: 0x64ffda, 
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3
                });

                const shapes = [];

                for(let i=0; i<50; i++) {
                    const geom = geometries[Math.floor(Math.random() * geometries.length)];
                    const mesh = new THREE.Mesh(geom, material);
                    
                    mesh.position.set(
                        (Math.random() - 0.5) * 30,
                        (Math.random() - 0.5) * 30,
                        (Math.random() - 0.5) * 10
                    );
                    
                    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
                    
                    const scale = Math.random() * 0.5 + 0.5;
                    mesh.scale.set(scale, scale, scale);
                    
                    group.add(mesh);
                    shapes.push({
                        mesh: mesh,
                        rotSpeed: {
                            x: (Math.random() - 0.5) * 0.02,
                            y: (Math.random() - 0.5) * 0.02
                        }
                    });
                }

                return (input) => {
                    group.rotation.y += 0.001;
                    shapes.forEach(shape => {
                        shape.mesh.rotation.x += shape.rotSpeed.x;
                        shape.mesh.rotation.y += shape.rotSpeed.y;
                    });
                    group.rotation.x = input.mouseY * 0.1;
                    group.rotation.y += input.mouseX * 0.01;
                };
            }
        },
        // 7. DNA Helix (New)
        {
            name: "DNA Helix",
            init: (scene, camera) => {
                camera.position.z = 20;
                camera.position.y = 0;
                
                const particleCount = 200;
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(particleCount * 3 * 2); // 2 strands
                const colors = new Float32Array(particleCount * 3 * 2);
                
                const color1 = new THREE.Color(0x64ffda);
                const color2 = new THREE.Color(0x8892b0);

                for(let i = 0; i < particleCount; i++) {
                    const t = i * 0.2;
                    
                    // Strand 1
                    positions[i*3] = Math.cos(t) * 2;
                    positions[i*3+1] = (i - particleCount/2) * 0.2;
                    positions[i*3+2] = Math.sin(t) * 2;
                    
                    colors[i*3] = color1.r;
                    colors[i*3+1] = color1.g;
                    colors[i*3+2] = color1.b;

                    // Strand 2
                    const j = i + particleCount;
                    positions[j*3] = Math.cos(t + Math.PI) * 2;
                    positions[j*3+1] = (i - particleCount/2) * 0.2;
                    positions[j*3+2] = Math.sin(t + Math.PI) * 2;
                    
                    colors[j*3] = color2.r;
                    colors[j*3+1] = color2.g;
                    colors[j*3+2] = color2.b;
                }
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                
                const material = new THREE.PointsMaterial({ 
                    size: 0.15, 
                    vertexColors: true,
                    transparent: true,
                    opacity: 0.8
                });
                
                const dna = new THREE.Points(geometry, material);
                dna.rotation.z = Math.PI / 4;
                scene.add(dna);

                return (input) => {
                    dna.rotation.y += 0.01;
                    dna.rotation.x = input.mouseY * 0.2;
                    dna.position.x = input.mouseX * 2;
                };
            }
        },
        // 8. Wave Field (New)
        {
            name: "Wave Field",
            init: (scene, camera) => {
                camera.position.set(0, 10, 10);
                camera.lookAt(0, 0, 0);
                
                const countX = 50;
                const countY = 50;
                const geometry = new THREE.BufferGeometry();
                const positions = new Float32Array(countX * countY * 3);
                
                for(let x = 0; x < countX; x++) {
                    for(let y = 0; y < countY; y++) {
                        const i = (x * countY + y) * 3;
                        positions[i] = (x - countX/2) * 0.5;
                        positions[i+1] = 0;
                        positions[i+2] = (y - countY/2) * 0.5;
                    }
                }
                
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const material = new THREE.PointsMaterial({
                    size: 0.08,
                    color: 0x64ffda,
                    transparent: true,
                    opacity: 0.6
                });
                
                const waves = new THREE.Points(geometry, material);
                scene.add(waves);
                
                const originalY = new Float32Array(countX * countY);
                
                return (input) => {
                    const time = Date.now() * 0.002;
                    const pos = waves.geometry.attributes.position.array;
                    
                    for(let x = 0; x < countX; x++) {
                        for(let y = 0; y < countY; y++) {
                            const i = (x * countY + y) * 3;
                            const val = Math.sin(x * 0.2 + time) + Math.cos(y * 0.2 + time);
                            pos[i+1] = val * 0.5;
                        }
                    }
                    waves.geometry.attributes.position.needsUpdate = true;
                    waves.rotation.y = input.mouseX * 0.1;
                };
            }
        }
    ];

    // Pick random theme
    const theme = themes[Math.floor(Math.random() * themes.length)];
    console.log("Loading Theme:", theme.name);
    
    // Add theme name indicator (optional, mostly for debug/user info)
    // const themeIndicator = document.createElement('div');
    // themeIndicator.style.position = 'fixed';
    // themeIndicator.style.bottom = '10px';
    // themeIndicator.style.right = '10px';
    // themeIndicator.style.color = 'rgba(255,255,255,0.3)';
    // themeIndicator.style.fontFamily = 'monospace';
    // themeIndicator.style.fontSize = '10px';
    // themeIndicator.textContent = `Theme: ${theme.name}`;
    // document.body.appendChild(themeIndicator);

    const updateFn = theme.init(scene, camera);

    // Animation Loop
    const animate = () => {
        requestAnimationFrame(animate);
        if (updateFn) updateFn(input);
        renderer.render(scene, camera);
    };
    
    animate();

    // Handle Resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}
