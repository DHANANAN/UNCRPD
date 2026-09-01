// Three.js 3D Network Graph Visualization for UNCRPD Dashboard
class UNCRPDGraph3D {
  constructor(canvasId, wrapperId, onNodeSelected) {
    this.canvas = document.getElementById(canvasId);
    this.wrapper = document.getElementById(wrapperId);
    this.onNodeSelected = onNodeSelected;
    
    this.nodes = [];
    this.links = [];
    this.nodeMeshes = new Map();
    this.linkLabelMeshes = [];
    
    this.theme = 'dark'; // Active theme state: 'dark' or 'light'
    
    // Animation targets for smooth interpolation (Tweens)
    this.cameraTarget = new THREE.Vector3(0, 0, 450);
    this.cameraCurrent = new THREE.Vector3(0, 0, 700);
    this.worldRotationTarget = { x: 0.4, y: 0.1 };
    this.worldRotationCurrent = { x: 0.4, y: 0.1 };
    this.panTarget = new THREE.Vector3(0, 0, 0);
    this.panCurrent = new THREE.Vector3(0, 0, 0);
    
    // Zoom limits
    this.zoomTarget = 1.0;
    this.zoomCurrent = 0.8;
    this.densityScale = 1.0;
    
    // Interactivity
    this.selectedNodeId = null;
    this.hoveredNodeId = null;
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    
    // Active laser particles running along lines
    this.laserParticles = [];
    
    // Space Anomalies & Cruising 3D Rocket System
    this.spaceShips = [];
    this.orbitingRocket = null;
    this.blackHoles = [];
    this.solarFlares = [];
    this.meteors = [];
    this.shakeIntensity = 0;
    
    this.initThree();
    this.initEvents();
    this.initSpaceShips();
    this.animate();
  }
  
  initThree() {
    const width = this.wrapper.clientWidth;
    const height = this.wrapper.clientHeight;
    
    // Create Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.0009);
    
    // Create Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 1, 3200);
    this.camera.position.copy(this.cameraCurrent);
    
    // Create WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x030712, 1);
    
    // Parent group for all graph elements (allows rotation/pan)
    this.graphGroup = new THREE.Group();
    this.scene.add(this.graphGroup);
    
    // Add Ambient & Directional Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambientLight);
    
    this.dirLight1 = new THREE.DirectionalLight(0x00f0ff, 1.2);
    this.dirLight1.position.set(200, 400, 300);
    this.scene.add(this.dirLight1);
    
    this.dirLight2 = new THREE.DirectionalLight(0xbd93f9, 1.0);
    this.dirLight2.position.set(-200, -300, 200);
    this.scene.add(this.dirLight2);

    this.centerLight = new THREE.PointLight(0xffffff, 1.2, 900);
    this.centerLight.position.set(0, 0, 150);
    this.scene.add(this.centerLight);
    
    // Setup Cosmic Dust / Sparkling Background
    this.createStarsBackground();
    
    // HTML label overlay container
    this.labelsContainer = document.getElementById('nodes');
    if (!this.labelsContainer) {
      this.labelsContainer = document.createElement('div');
      this.labelsContainer.id = 'nodes';
      this.labelsContainer.style.position = 'absolute';
      this.labelsContainer.style.inset = '0';
      this.labelsContainer.style.pointerEvents = 'none';
      this.labelsContainer.style.zIndex = '5';
      this.wrapper.appendChild(this.labelsContainer);
    }
    
    // Raycaster for click selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
  }
  
  createStarsBackground() {
    const isLight = this.theme === 'light';
    const isReading = this.theme === 'reading';
    const starsCount = 550;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    const sizes = new Float32Array(starsCount);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      const idx = i / 3;
      // Random coordinates inside a large celestial sphere
      const r = 650 + Math.random() * 950;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);
      
      sizes[idx] = 2.0 + Math.random() * 3.5;
      
      if (isReading) {
        // Reading theme: warm slate, amber dust, and soft cream stars
        const rand = Math.random();
        if (rand < 0.45) {
          colors[i] = 0.70; colors[i + 1] = 0.64; colors[i + 2] = 0.58; // Soft warm slate
        } else if (rand < 0.8) {
          colors[i] = 0.82; colors[i + 1] = 0.58; colors[i + 2] = 0.22; // Amber bronze
        } else {
          colors[i] = 0.55; colors[i + 1] = 0.50; colors[i + 2] = 0.45; // Subtle brown
        }
      } else if (isLight) {
        // Light theme: soft sand/gold and sepia sparks
        const rand = Math.random();
        if (rand < 0.5) {
          colors[i] = 0.77; colors[i + 1] = 0.58; colors[i + 2] = 0.23; // Golden Gold
        } else {
          colors[i] = 0.45; colors[i + 1] = 0.38; colors[i + 2] = 0.31; // Soft sepia brown
        }
      } else {
        // Dark theme: Sparkling diamond silver, radiant cyan, and soft violet starlight
        const rand = Math.random();
        if (rand < 0.65) {
          // Pure Silver & Diamond White
          colors[i] = 0.95; colors[i + 1] = 0.97; colors[i + 2] = 1.0;
          sizes[idx] = 2.5 + Math.random() * 3.0;
        } else if (rand < 0.85) {
          // Neon Celestial Cyan
          colors[i] = 0.15; colors[i + 1] = 0.94; colors[i + 2] = 1.0;
        } else {
          // Electric Violet
          colors[i] = 0.82; colors[i + 1] = 0.68; colors[i + 2] = 1.0;
        }
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: (isLight || isReading) ? 4.5 : 4.0,
      vertexColors: true,
      transparent: true,
      opacity: (isLight || isReading) ? 0.45 : 0.85,
      blending: (isLight || isReading) ? THREE.NormalBlending : THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    
    this.stars = new THREE.Points(geometry, material);
    this.scene.add(this.stars);
  }
  
  initEvents() {
    // Pointer Drag to Rotate
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture(e.pointerId);
    });
    
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) {
        this.updateMouseCoords(e);
        this.checkHover();
        return;
      }
      
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      
      this.worldRotationTarget.y += deltaX * 0.004;
      this.worldRotationTarget.x += deltaY * 0.004;
      
      // Limit vertical tilt
      this.worldRotationTarget.x = Math.max(0.1, Math.min(Math.PI / 2.2, this.worldRotationTarget.x));
      
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('pointerup', (e) => {
      this.isDragging = false;
      this.canvas.releasePointerCapture(e.pointerId);
      
      const deltaX = Math.abs(e.clientX - this.previousMousePosition.x);
      const deltaY = Math.abs(e.clientY - this.previousMousePosition.y);
      if (deltaX < 3 && deltaY < 3) {
        this.handleClick(e);
      }
    });
    
    // Scroll Wheel to Zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomAmount = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomTarget = Math.max(0.3, Math.min(2.5, this.zoomTarget * zoomAmount));
    }, { passive: false });
    
    window.addEventListener('resize', () => this.resize());
  }
  
  updateMouseCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  resize() {
    const width = this.wrapper.clientWidth;
    const height = this.wrapper.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  setData(nodes, links) {
    this.nodes = nodes;
    this.links = links;
    this.buildGraph();
  }
  
  setDensity(density) {
    this.densityScale = density;
    this.repositionNodes();
  }
  
  setTilt(tiltDegrees) {
    const rad = (tiltDegrees * Math.PI) / 180;
    this.worldRotationTarget.x = rad;
  }
  
  setTheme(themeName) {
    this.theme = themeName;
    const isLight = themeName === 'light';
    const isReading = themeName === 'reading';
    
    // 1. Update clear color and fog matching theme background
    let bgColor = 0x030712; // Dark theme default
    if (isReading) {
      bgColor = 0xf4ede4; // Warm reading parchment
    } else if (isLight) {
      bgColor = 0xfaf4e3; // Light gold graph paper
    }
    
    this.renderer.setClearColor(bgColor, 1);
    this.scene.fog.color.setHex(bgColor);
    this.scene.fog.density = (isLight || isReading) ? 0.0010 : 0.0009;
    
    // 2. Update directional & ambient lighting colors
    if (isReading) {
      this.ambientLight.color.setHex(0xfff8ee);
      this.ambientLight.intensity = 0.85;
      this.dirLight1.color.setHex(0xd97706);
      this.dirLight2.color.setHex(0x9a3412);
      if (this.centerLight) this.centerLight.color.setHex(0xb45309);
    } else if (isLight) {
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.85;
      this.dirLight1.color.setHex(0xb37d14);
      this.dirLight2.color.setHex(0x7a3ebb);
      if (this.centerLight) this.centerLight.color.setHex(0xc4943c);
    } else {
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.55;
      this.dirLight1.color.setHex(0x00f0ff);
      this.dirLight2.color.setHex(0xbd93f9);
      if (this.centerLight) this.centerLight.color.setHex(0xffffff);
    }
    
    // 3. Dispose and recreate star background
    if (this.stars) {
      this.scene.remove(this.stars);
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    this.createStarsBackground();
    
    // 4. Rebuild all materials and meshes
    this.buildGraph();
  }
  
  buildGraph() {
    // Clear previous geometries
    while(this.graphGroup.children.length > 0) {
      const obj = this.graphGroup.children[0];
      this.graphGroup.remove(obj);
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    }
    
    this.nodeMeshes.clear();
    this.laserParticles = [];
    
    const isLight = this.theme === 'light';
    const isReading = this.theme === 'reading';
    
    // Pre-create basic geometries
    const sphereGeom = new THREE.SphereGeometry(1, 20, 16);
    const starGeom = new THREE.IcosahedronGeometry(1, 1);
    const centerGeom = new THREE.DodecahedronGeometry(1, 1);
    
    // 1. Render Node Meshes with enhanced brightness and emissive glow
    this.nodes.forEach(node => {
      let size = 3.8;
      let color = 0xc4b5fd;
      let emissive = 0x3b1d6e;
      let geom = sphereGeom;
      let shininess = 50;
      
      switch (node.type) {
        case 'center':
          size = (isLight || isReading) ? 8.5 : 9.8;
          color = isReading ? 0xb45309 : (isLight ? 0xc4943c : 0x00f0ff);
          emissive = isReading ? 0x331400 : (isLight ? 0x3d2805 : 0x006688);
          geom = centerGeom;
          shininess = 80;
          break;
        case 'article':
        case 'article center':
          size = (isLight || isReading) ? 7.5 : 8.5;
          color = isReading ? 0xb45309 : (isLight ? 0xc4943c : 0x00f0ff);
          emissive = isReading ? 0x2e1503 : (isLight ? 0x3d2805 : 0x005577);
          shininess = 65;
          break;
        case 'theme':
        case 'theme center':
          size = (isLight || isReading) ? 6.2 : 7.2;
          color = isReading ? 0xc2410c : (isLight ? 0xb37d14 : 0xffb86c);
          emissive = isReading ? 0x2e0d00 : (isLight ? 0x221300 : 0x663300);
          geom = starGeom;
          shininess = 60;
          break;
        case 'source':
          size = (isLight || isReading) ? 4.0 : 4.6;
          color = isReading ? 0xbe123c : (isLight ? 0xd81b60 : 0xff79c6);
          emissive = isReading ? 0x33000f : (isLight ? 0x33000a : 0x550033);
          shininess = 50;
          break;
        case 'point':
        case 'point center':
        default:
          size = (isLight || isReading) ? 3.2 : 3.8;
          color = isReading ? 0x475569 : (isLight ? 0x7a3ebb : 0xc4b5fd);
          emissive = isReading ? 0x0f172a : (isLight ? 0x0d001a : 0x3b1d6e);
          shininess = 60;
          break;
      }
      
      // Node Glowing Material
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: emissive,
        shininess: shininess,
        specular: (isLight || isReading) ? 0xeeeeee : 0xffffff,
        flatShading: node.type === 'theme' || node.type === 'theme center'
      });
      
      const mesh = new THREE.Mesh(geom, material);
      mesh.scale.set(size, size, size);
      mesh.position.set(node.x, node.y, node.z || 0);
      mesh.userData = { nodeId: node.id, nodeData: node };
      
      this.graphGroup.add(mesh);
      this.nodeMeshes.set(node.id, mesh);
    });
    
    // 2. Render Sparkling Silver & Luminous Connection Lines
    let lineMatColor = 0xcbd5e1; // Silver default for dark mode
    let strongLineColor = 0xffffff; // Brilliant platinum silver for dark mode
    let dashedLineColor = 0xf472b6; // Silver rose for dark mode
    let lineOpacity = 0.70;
    let strongOpacity = 0.92;
    let dashedOpacity = 0.70;
    let blendingMode = THREE.AdditiveBlending;
    
    if (isReading) {
      lineMatColor = 0x78716c; // Soft warm graphite
      strongLineColor = 0xb45309; // Warm bronze
      dashedLineColor = 0xbe123c; // Warm crimson
      lineOpacity = 0.55;
      strongOpacity = 0.82;
      dashedOpacity = 0.65;
      blendingMode = THREE.NormalBlending;
    } else if (isLight) {
      lineMatColor = 0x9c8f80;
      strongLineColor = 0xc4943c;
      dashedLineColor = 0xd81b60;
      lineOpacity = 0.55;
      strongOpacity = 0.80;
      dashedOpacity = 0.60;
      blendingMode = THREE.NormalBlending;
    }
    
    const lineMaterial = new THREE.LineBasicMaterial({
      color: lineMatColor,
      transparent: true,
      opacity: lineOpacity,
      blending: blendingMode
    });
    
    const strongLineMaterial = new THREE.LineBasicMaterial({
      color: strongLineColor,
      transparent: true,
      opacity: strongOpacity,
      blending: blendingMode
    });
    
    const dashedMaterial = new THREE.LineBasicMaterial({
      color: dashedLineColor,
      transparent: true,
      opacity: dashedOpacity,
      blending: blendingMode
    });
    
    this.links.forEach(link => {
      const fromMesh = this.nodeMeshes.get(link.source);
      const toMesh = this.nodeMeshes.get(link.target);
      if (!fromMesh || !toMesh) return;
      
      const points = [fromMesh.position, toMesh.position];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      let mat = lineMaterial;
      if (link.type === 'strong') mat = strongLineMaterial;
      if (link.type === 'sourceEdge') mat = dashedMaterial;
      
      const line = new THREE.Line(geometry, mat);
      this.graphGroup.add(line);
      
      // Generate sparkling stardust particles traveling along connection threads
      if (Math.random() < 0.75) {
        this.createLaserParticle(fromMesh.position, toMesh.position, link.type);
      }
    });
    
    this.buildHTMLLabels();
  }
  
  createLaserParticle(start, end, linkType) {
    const isLight = this.theme === 'light';
    const isReading = this.theme === 'reading';
    
    let color = 0xffffff; // Pure silver default
    if (isReading) {
      color = (linkType === 'sourceEdge') ? 0xbe123c : ((linkType === 'strong') ? 0xd97706 : 0x78716c);
    } else if (isLight) {
      color = (linkType === 'sourceEdge') ? 0xd81b60 : ((linkType === 'strong') ? 0xb37d14 : 0xc4943c);
    } else {
      // Dark Mode Silver & Diamond Sparkles
      const r = Math.random();
      if (r < 0.55) {
        color = 0xffffff; // Diamond Silver White
      } else if (r < 0.8) {
        color = 0xdbeafe; // Soft Ice Silver
      } else if (linkType === 'sourceEdge') {
        color = 0xf472b6; // Rose Sparkle
      } else {
        color = 0x00f0ff; // Cyan Stardust
      }
    }
    
    this.laserParticles.push({
      start: start.clone(),
      end: end.clone(),
      position: start.clone(),
      t: Math.random(),
      speed: 0.005 + Math.random() * 0.009,
      color: color,
      sparklePhase: Math.random() * Math.PI * 2,
      baseSize: 1.2 + Math.random() * 0.8
    });
  }
  
  repositionNodes() {
    this.nodeMeshes.forEach((mesh, id) => {
      const node = this.nodes.find(n => n.id === id);
      if (node) {
        mesh.position.set(node.x * this.densityScale, node.y * this.densityScale, (node.z || 0) * this.densityScale);
      }
    });
    this.buildGraph(); // Update connection coordinates
  }
  
  buildHTMLLabels() {
    this.labelsContainer.innerHTML = '';
    this.linkLabelMeshes = [];
    
    this.nodes.forEach(node => {
      const el = document.createElement('div');
      el.className = `node-label-anchor node-${node.type.replace(' center', '')}`;
      el.dataset.id = node.id;
      
      let name = node.label;
      if (typeof name === 'string' && name.length > 20) {
        name = name.substring(0, 18) + '...';
      }
      
      el.innerHTML = `
        <div class="label-box">
          <span class="label-text">${name}</span>
          ${node.badge ? `<span class="label-badge">${node.badge}</span>` : ''}
        </div>
      `;
      
      el.style.position = 'absolute';
      el.style.transform = 'translate(-50%, -50%)';
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      
      el.onclick = (e) => {
        e.stopPropagation();
        this.selectNode(node.id);
      };
      
      this.labelsContainer.appendChild(el);
      this.linkLabelMeshes.push({
        element: el,
        position: new THREE.Vector3(node.x * this.densityScale, node.y * this.densityScale, (node.z || 0) * this.densityScale)
      });
    });
  }
  
  checkHover() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const nodeId = mesh.userData.nodeId;
      if (this.hoveredNodeId !== nodeId) {
        this.hoveredNodeId = nodeId;
        document.querySelectorAll('.node-label-anchor').forEach(el => {
          el.classList.toggle('hovered', el.dataset.id === nodeId);
        });
      }
    } else {
      if (this.hoveredNodeId !== null) {
        this.hoveredNodeId = null;
        document.querySelectorAll('.node-label-anchor').forEach(el => {
          el.classList.remove('hovered');
        });
      }
    }
  }
  
  handleClick(e) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);
    
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this.selectNode(mesh.userData.nodeId);
    }
  }
  
  selectNode(nodeId) {
    if (this.selectedNodeId === nodeId) return;
    this.selectedNodeId = nodeId;
    
    document.querySelectorAll('.node-label-anchor').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === nodeId);
    });
    
    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      const pos = mesh.position;
      
      this.panTarget.copy(pos).multiplyScalar(-1);
      
      let zoomDist = 200;
      if (mesh.userData.nodeData.type.includes('article')) zoomDist = 320;
      if (mesh.userData.nodeData.type.includes('theme')) zoomDist = 260;
      
      this.zoomTarget = 1.3;
      this.cameraTarget.set(0, 0, zoomDist);
      
      this.setOrbitingRocket(nodeId);
      
      if (this.onNodeSelected) {
        this.onNodeSelected(mesh.userData.nodeData);
      }
    }
  }
  
  initSpaceShips() {
    this.spaceShips = [];
    const colors = [0x00f0ff, 0xff79c6, 0xffb86c];
    
    for (let i = 0; i < 3; i++) {
      const shipGroup = new THREE.Group();
      
      // Rocket Fuselage (Cone)
      const bodyGeom = new THREE.ConeGeometry(2.0, 7.0, 8);
      const bodyMat = new THREE.MeshPhongMaterial({
        color: colors[i % colors.length],
        emissive: 0x112233,
        shininess: 80
      });
      const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
      bodyMesh.rotation.x = Math.PI / 2;
      shipGroup.add(bodyMesh);
      
      // Booster Flame Cone
      const flameGeom = new THREE.ConeGeometry(1.2, 3.5, 6);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0xff5555,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const flameMesh = new THREE.Mesh(flameGeom, flameMat);
      flameMesh.rotation.x = -Math.PI / 2;
      flameMesh.position.z = -4.5;
      shipGroup.add(flameMesh);
      
      this.graphGroup.add(shipGroup);
      
      this.spaceShips.push({
        group: shipGroup,
        flame: flameMesh,
        startPos: new THREE.Vector3((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 100),
        targetPos: new THREE.Vector3((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 400, (Math.random() - 0.5) * 100),
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.004
      });
    }
  }

  setOrbitingRocket(nodeId) {
    if (this.orbitingRocketGroup) {
      this.graphGroup.remove(this.orbitingRocketGroup);
    }
    
    const nodeMesh = this.nodeMeshes.get(nodeId);
    if (!nodeMesh) return;
    
    this.orbitingRocketGroup = new THREE.Group();
    
    // Orbital path visualizer ring
    const ringGeom = new THREE.RingGeometry(22, 23, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    this.orbitingRocketGroup.add(ringMesh);
    
    // Mini Orbiting Lander Probe
    const probeGeom = new THREE.ConeGeometry(1.6, 5.0, 6);
    const probeMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      emissive: 0x00f0ff,
      shininess: 90
    });
    const probeMesh = new THREE.Mesh(probeGeom, probeMat);
    probeMesh.rotation.x = Math.PI / 2;
    this.orbitingRocketProbe = probeMesh;
    this.orbitingRocketGroup.add(probeMesh);
    
    this.orbitingRocketGroup.position.copy(nodeMesh.position);
    this.graphGroup.add(this.orbitingRocketGroup);
    this.orbitAngle = 0;
  }

  triggerCosmicQuake() {
    this.shakeIntensity = 24.0;
    const overlay = document.querySelector('.app-container');
    if (overlay) {
      overlay.classList.remove('cosmic-quake-active');
      void overlay.offsetWidth; // Trigger reflow
      overlay.classList.add('cosmic-quake-active');
      setTimeout(() => overlay.classList.remove('cosmic-quake-active'), 900);
    }
  }

  triggerSolarFlare() {
    const flareOverlay = document.getElementById('solar-flare-overlay');
    if (flareOverlay) {
      flareOverlay.classList.remove('active');
      void flareOverlay.offsetWidth;
      flareOverlay.classList.add('active');
      setTimeout(() => flareOverlay.classList.remove('active'), 2500);
    }
    
    // 3D Visual Plasma Wave Sphere
    const geom = new THREE.SphereGeometry(10, 24, 24);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb86c,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      wireframe: true
    });
    const flareMesh = new THREE.Mesh(geom, mat);
    flareMesh.position.set(0, 0, 80);
    this.graphGroup.add(flareMesh);
    
    this.solarFlares.push({
      mesh: flareMesh,
      scale: 1,
      maxScale: 65,
      opacity: 0.85
    });
  }

  triggerBlackHole(x = 0, y = 0, z = 50) {
    const holeOverlay = document.getElementById('black-hole-overlay');
    if (holeOverlay) {
      holeOverlay.classList.remove('active');
      void holeOverlay.offsetWidth;
      holeOverlay.classList.add('active');
      setTimeout(() => holeOverlay.classList.remove('active'), 4000);
    }
    
    const bhGroup = new THREE.Group();
    bhGroup.position.set(x, y, z);
    
    // Event Horizon Sphere
    const sphereGeom = new THREE.SphereGeometry(14, 24, 24);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
    bhGroup.add(sphereMesh);
    
    // Accretion Disk
    const diskGeom = new THREE.RingGeometry(16, 42, 32);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0xbd93f9,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const diskMesh = new THREE.Mesh(diskGeom, diskMat);
    diskMesh.rotation.x = Math.PI / 2.5;
    bhGroup.add(diskMesh);
    
    this.graphGroup.add(bhGroup);
    this.blackHoles.push({
      group: bhGroup,
      disk: diskMesh,
      life: 300
    });
  }

  triggerMeteorShower() {
    for (let i = 0; i < 8; i++) {
      const geom = new THREE.CylinderGeometry(0.3, 1.2, 35, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(
        (Math.random() - 0.5) * 800,
        350 + Math.random() * 200,
        (Math.random() - 0.5) * 400
      );
      mesh.rotation.z = Math.PI / 3;
      this.graphGroup.add(mesh);
      
      this.meteors.push({
        mesh: mesh,
        vel: new THREE.Vector3(-14 - Math.random() * 6, -10 - Math.random() * 5, 0),
        life: 60 + Math.random() * 30
      });
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Camera shake decay (Cosmic Quake)
    if (this.shakeIntensity > 0.1) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= 0.88;
    }
    
    this.worldRotationCurrent.x += (this.worldRotationTarget.x - this.worldRotationCurrent.x) * 0.08;
    this.worldRotationCurrent.y += (this.worldRotationTarget.y - this.worldRotationCurrent.y) * 0.08;
    
    this.graphGroup.rotation.x = this.worldRotationCurrent.x;
    this.graphGroup.rotation.y = this.worldRotationCurrent.y;
    
    this.panCurrent.lerp(this.panTarget, 0.08);
    this.graphGroup.position.copy(this.panCurrent);
    
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * 0.08;
    this.cameraCurrent.lerp(this.cameraTarget, 0.08);
    
    this.camera.position.copy(this.cameraCurrent).multiplyScalar(1 / this.zoomCurrent);
    this.camera.lookAt(0, 0, 0);
    
    if (this.stars) {
      this.stars.rotation.y += 0.0003;
      this.stars.rotation.x += 0.0001;
    }
    
    // Animate Cruising Rocket Probes
    this.spaceShips.forEach(ship => {
      ship.t += ship.speed;
      if (ship.t >= 1) {
        ship.t = 0;
        ship.startPos.copy(ship.targetPos);
        // Choose a random node position as next waypoint
        if (this.nodes.length) {
          const randNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
          ship.targetPos.set(randNode.x * this.densityScale, randNode.y * this.densityScale, (randNode.z || 0) * this.densityScale);
        }
      }
      
      const currentPos = new THREE.Vector3().lerpVectors(ship.startPos, ship.targetPos, ship.t);
      ship.group.position.copy(currentPos);
      
      // Rotate ship towards direction of motion
      const dir = new THREE.Vector3().subVectors(ship.targetPos, ship.startPos).normalize();
      if (dir.lengthSq() > 0.001) {
        ship.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      }
      
      // Flickering booster flame
      ship.flame.scale.set(1 + Math.random() * 0.4, 1 + Math.random() * 0.6, 1 + Math.random() * 0.4);
    });

    // Animate Orbiting Rocket Probe
    if (this.orbitingRocketGroup && this.orbitingRocketProbe) {
      this.orbitAngle = (this.orbitAngle || 0) + 0.04;
      const radius = 22.5;
      this.orbitingRocketProbe.position.set(
        Math.cos(this.orbitAngle) * radius,
        Math.sin(this.orbitAngle) * radius * 0.5,
        Math.sin(this.orbitAngle) * radius * 0.8
      );
      this.orbitingRocketProbe.rotation.z = this.orbitAngle + Math.PI / 2;
    }

    // Animate Solar Flares
    for (let i = this.solarFlares.length - 1; i >= 0; i--) {
      const sf = this.solarFlares[i];
      sf.scale += 1.2;
      sf.opacity *= 0.95;
      sf.mesh.scale.set(sf.scale, sf.scale, sf.scale);
      sf.mesh.material.opacity = sf.opacity;
      
      if (sf.opacity < 0.02 || sf.scale > sf.maxScale) {
        this.graphGroup.remove(sf.mesh);
        sf.mesh.geometry.dispose();
        sf.mesh.material.dispose();
        this.solarFlares.splice(i, 1);
      }
    }

    // Animate Black Holes
    for (let i = this.blackHoles.length - 1; i >= 0; i--) {
      const bh = this.blackHoles[i];
      bh.disk.rotation.z += 0.06;
      bh.life -= 1;
      
      if (bh.life <= 0) {
        this.graphGroup.remove(bh.group);
        this.blackHoles.splice(i, 1);
      }
    }

    // Animate Meteors
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.mesh.position.add(m.vel);
      m.life -= 1;
      m.mesh.material.opacity = m.life / 60;
      
      if (m.life <= 0) {
        this.graphGroup.remove(m.mesh);
        m.mesh.geometry.dispose();
        m.mesh.material.dispose();
        this.meteors.splice(i, 1);
      }
    }
    
    this.animateLasers();
    this.renderer.render(this.scene, this.camera);
    this.updateProjectedLabels();
  }
  
  animateLasers() {
    if (this.particleMeshes) {
      this.particleMeshes.forEach(pm => this.graphGroup.remove(pm));
    }
    this.particleMeshes = [];
    
    const geom = new THREE.SphereGeometry(1.0, 8, 8);
    const now = Date.now();
    const isDark = this.theme === 'dark' || !this.theme;
    
    this.laserParticles.forEach(lp => {
      lp.t += lp.speed;
      if (lp.t >= 1) {
        lp.t = 0;
      }
      
      lp.position.lerpVectors(lp.start, lp.end, lp.t);
      
      // Dynamic sparkle pulse calculation
      const pulse = Math.sin(now * 0.008 + lp.sparklePhase);
      const currentSize = lp.baseSize * (1.0 + (isDark ? 0.45 * pulse : 0.25 * pulse));
      const opacity = isDark ? (0.80 + 0.20 * pulse) : 0.85;
      
      const mat = new THREE.MeshBasicMaterial({
        color: lp.color,
        transparent: true,
        opacity: Math.max(0.4, opacity),
        blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending
      });
      
      const mesh = new THREE.Mesh(geom, mat);
      mesh.scale.set(currentSize, currentSize, currentSize);
      mesh.position.copy(lp.position).multiplyScalar(this.densityScale);
      
      this.graphGroup.add(mesh);
      this.particleMeshes.push(mesh);
    });
  }
}
