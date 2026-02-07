const viewer = document.querySelector('#model-viewer');
const progressBar = document.getElementById('progress-bar');
const updateBar = document.getElementById('update-bar');
let currentModelUrl = './3D_Models/high_poly_plague_knight.glb';
let currentRenderMode = 'pbr';
let originalMaterials = new Map();

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.querySelector('.theme-icon');

themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', newTheme);
});

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.setAttribute('data-theme', savedTheme);
themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

// Model loading function
function loadModel(src, btn) {
    currentModelUrl = src;
    viewer.src = src;

    // Update active state
    document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    // Show progress bar
    progressBar.style.display = 'block';
    updateBar.style.width = '0%';

    // Reset materials map
    originalMaterials.clear();
}

// Progress tracking
viewer.addEventListener('progress', (event) => {
    const progress = event.detail.totalProgress;
    updateBar.style.width = (progress * 100) + '%';
});

viewer.addEventListener('load', () => {
    // Hide progress bar after load
    setTimeout(() => {
        progressBar.style.display = 'none';
        updateBar.style.width = '0%';
    }, 500);

    // Store original materials
    storeOriginalMaterials();

    // Reapply current render mode
    applyRenderMode(currentRenderMode);

    // Update statistics
    updateStatistics();
});

// File upload handler
document.getElementById('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        currentModelUrl = url;

        // Show progress bar
        progressBar.style.display = 'block';
        updateBar.style.width = '0%';

        viewer.src = url;

        // Deactivate preset buttons
        document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
    }
});

// Store original materials for render mode switching
function storeOriginalMaterials() {
    const scene = viewer.model;
    if (scene) {
        scene.traverse((node) => {
            if (node.isMesh && node.material) {
                if (!originalMaterials.has(node.uuid)) {
                    originalMaterials.set(node.uuid, {
                        material: node.material.clone(),
                        wireframe: node.material.wireframe
                    });
                }
            }
        });
    }
}

// Apply render mode
function applyRenderMode(mode) {
    const scene = viewer.model;
    if (!scene) return;

    currentRenderMode = mode;

    scene.traverse((node) => {
        if (node.isMesh && node.material) {
            const original = originalMaterials.get(node.uuid);

            switch (mode) {
                case 'pbr':
                    // Restore original PBR material
                    if (original) {
                        node.material = original.material.clone();
                    }
                    viewer.setAttribute('environment-image', 'neutral');
                    break;

                case 'solid':
                    // Flat color without environment
                    if (original) {
                        node.material = original.material.clone();
                        node.material.metalness = 0;
                        node.material.roughness = 1;
                    }
                    viewer.removeAttribute('environment-image');
                    break;

                case 'wireframe':
                    // Wireframe mode
                    if (node.material) {
                        node.material.wireframe = true;
                    }
                    break;

                case 'normals':
                    // Normals visualization using MeshNormalMaterial
                    const THREE = window.THREE || viewer.three;
                    if (THREE && THREE.MeshNormalMaterial) {
                        node.material = new THREE.MeshNormalMaterial();
                    }
                    break;

                case 'matcap':
                    // MatCap shading (simplified - uses basic material)
                    if (original) {
                        node.material = original.material.clone();
                        node.material.metalness = 0.5;
                        node.material.roughness = 0.5;
                    }
                    viewer.setAttribute('environment-image', 'neutral');
                    break;
            }

            node.material.needsUpdate = true;
        }
    });
}

// Render mode switching
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;

        // Update active state
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Apply render mode
        applyRenderMode(mode);
    });
});

// Update statistics with enhanced performance analysis
async function updateStatistics() {
    try {
        // Get file size
        const response = await fetch(currentModelUrl);
        const blob = await response.blob();
        const fileSizeBytes = blob.size;
        const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);

        // Wait for model to be fully loaded
        await viewer.updateComplete;

        // Access the Three.js scene to get actual geometry data
        const scene = viewer.model;
        if (scene) {
            let vertices = 0;
            let triangles = 0;
            let textureMemory = 0;

            scene.traverse((node) => {
                if (node.isMesh && node.geometry) {
                    const geometry = node.geometry;
                    if (geometry.attributes.position) {
                        vertices += geometry.attributes.position.count;
                    }
                    if (geometry.index) {
                        triangles += geometry.index.count / 3;
                    } else if (geometry.attributes.position) {
                        triangles += geometry.attributes.position.count / 3;
                    }
                }

                // Estimate texture memory
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(texType => {
                            if (mat[texType] && mat[texType].image) {
                                const img = mat[texType].image;
                                // Estimate: width * height * 4 bytes (RGBA)
                                textureMemory += (img.width || 1024) * (img.height || 1024) * 4;
                            }
                        });
                    });
                }
            });

            const textureMemoryMB = (textureMemory / (1024 * 1024)).toFixed(2);

            document.getElementById('triangles').textContent = Math.floor(triangles).toLocaleString();
            document.getElementById('filesize').textContent = `${fileSizeMB} MB`;
            document.getElementById('texture-memory').textContent = `${textureMemoryMB} MB`;

            // Calculate performance score with enhanced metrics
            calculatePerformanceScore(triangles, fileSizeBytes, textureMemory);
        }
    } catch (error) {
        console.error('Error calculating statistics:', error);
        document.getElementById('triangles').textContent = 'N/A';
        document.getElementById('filesize').textContent = 'N/A';
        document.getElementById('texture-memory').textContent = 'N/A';
    }
}

// Enhanced performance score calculation
function calculatePerformanceScore(triangles, fileSize, textureMemory) {
    let score = 100;
    const tips = [];

    // Triangle count penalties
    if (triangles > 100000) {
        score -= 30;
        tips.push('Reduce polygon count for better performance');
    } else if (triangles > 50000) {
        score -= 15;
        tips.push('Consider optimizing mesh complexity');
    }

    // File size penalties (in bytes)
    if (fileSize > 50000000) { // > 50MB
        score -= 30;
        tips.push('Compress model file to reduce load time');
    } else if (fileSize > 10000000) { // > 10MB
        score -= 15;
        tips.push('File size could be optimized');
    }

    // Texture memory penalties
    if (textureMemory > 50000000) { // > 50MB
        score -= 20;
        tips.push('Reduce texture resolution to improve performance');
    } else if (textureMemory > 20000000) { // > 20MB
        score -= 10;
        tips.push('Consider texture atlas or compression');
    }

    score = Math.max(0, score);

    document.getElementById('score').textContent = score;

    const statusEl = document.getElementById('status');
    if (score >= 80) {
        statusEl.textContent = 'Good';
        statusEl.className = 'score-status excellent';
    } else if (score >= 55) {
        statusEl.textContent = 'Moderate';
        statusEl.className = 'score-status good';
    } else {
        statusEl.textContent = 'Poor';
        statusEl.className = 'score-status poor';
    }

    // Update optimization tips
    const tipsList = document.getElementById('tips-list');
    if (tips.length > 0) {
        tipsList.innerHTML = tips.slice(0, 2).map(tip => `<li>${tip}</li>`).join('');
    } else {
        tipsList.innerHTML = '<li>Model is well optimized!</li>';
    }
}

// Lighting controls
document.getElementById('light-intensity').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('intensity-value').textContent = value;
    // Note: model-viewer doesn't have direct light intensity control
    // This could be used with custom Three.js lights if implemented
});

document.getElementById('light-color').addEventListener('input', (e) => {
    const color = e.target.value;
    // Apply color filter to environment (simplified approach)
    viewer.style.filter = `hue-rotate(${parseInt(color.slice(1), 16) % 360}deg)`;
});

document.getElementById('exposure').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('exposure-value').textContent = value;
    viewer.exposure = value;
});

document.getElementById('shadow-intensity').addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('shadow-value').textContent = value;
    viewer.shadowIntensity = value;
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', () => {
    // Reset camera
    viewer.resetTurntableRotation();
    viewer.jumpCameraToGoal();

    // Reset lighting
    document.getElementById('light-intensity').value = 1;
    document.getElementById('intensity-value').textContent = '1.0';
    document.getElementById('exposure').value = 1;
    document.getElementById('exposure-value').textContent = '1.0';
    document.getElementById('shadow-intensity').value = 1;
    document.getElementById('shadow-value').textContent = '1.0';
    document.getElementById('light-color').value = '#ffffff';

    viewer.exposure = 1;
    viewer.shadowIntensity = 1;
    viewer.style.filter = '';

    // Reset to PBR mode
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="pbr"]').classList.add('active');
    applyRenderMode('pbr');
});

// AR Toggle
document.getElementById('ar-toggle').addEventListener('click', async () => {
    try {
        const arStatus = await viewer.canActivateAR;
        if (arStatus) {
            await viewer.activateAR();
        } else {
            alert('AR is not supported on this device/browser. AR requires:\n- iOS 12+ with Safari\n- Android 8+ with Chrome\n- WebXR compatible browser');
        }
    } catch (error) {
        console.error('AR activation failed:', error);
        alert('Could not activate AR mode. Please ensure you are using a compatible device and browser.');
    }
});

// Screenshot
document.getElementById('screenshot-btn').addEventListener('click', async () => {
    try {
        const screenshot = await viewer.toDataURL('image/png');

        const a = document.createElement('a');
        a.href = screenshot;
        a.download = `model-screenshot-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } catch (error) {
        console.error('Screenshot failed:', error);
        alert('Screenshot capture failed. This feature may require HTTPS or a compatible browser.');
    }
});

// Initialize statistics for default model
viewer.addEventListener('load', updateStatistics, { once: true });
