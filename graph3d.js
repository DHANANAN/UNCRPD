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
    
    this.initThree();
    this.initEvents();
    this.animate();
  }
  
  initThree() {
    const width = this.wrapper.clientWidth;
    const height = this.wrapper.clientHeight;
    
    // Create Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x02060b, 0.0012);
    
    // Create Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 1, 3000);
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
    this.renderer.setClearColor(0x02060b, 1);
    
    // Parent group for all graph elements (allows rotation/pan)
    this.graphGroup = new THREE.Group();
    this.scene.add(this.graphGroup);
    
    // Add Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    
    this.dirLight1 = new THREE.DirectionalLight(0x00f0ff, 0.8);
    this.dirLight1.position.set(200, 400, 300);
    this.scene.add(this.dirLight1);
    
    this.dirLight2 = new THREE.DirectionalLight(0xbd93f9, 0.6);
    this.dirLight2.position.set(-200, -300, 200);
    this.scene.add(this.dirLight2);
    
    // Setup Cosmic Dust / Stars Background
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
    const starsCount = 400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);
    
    for (let i = 0; i < starsCount * 3; i += 3) {
      // Random coordinates inside a large sphere
      const r = 700 + Math.random() * 800;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i] = r * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = r * Math.cos(phi);
      
      // Color: cyan, purple, or white sparkles
      const rand = Math.random();
      if (rand < 0.4) {
        colors[i] = 0.0; colors[i + 1] = 0.94; colors[i + 2] = 1.0; // Cyan
      } else if (rand < 0.8) {
        colors[i] = 0.74; colors[i + 1] = 0.57; colors[i + 2] = 0.97; // Purple
      } else {
        colors[i] = 1.0; colors[i + 1] = 1.0; colors[i + 2] = 1.0; // White
      }
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    // Material using circular point textures
    const material = new THREE.PointsMaterial({
      size: 3.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
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
        // Track hover for raycasting
        this.updateMouseCoords(e);
        this.checkHover();
        return;
      }
      
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;
      
      // Rotate target
      this.worldRotationTarget.y += deltaX * 0.004;
      this.worldRotationTarget.x += deltaY * 0.004;
      
      // Limit vertical tilt
      this.worldRotationTarget.x = Math.max(0.1, Math.min(Math.PI / 2.2, this.worldRotationTarget.x));
      
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    this.canvas.addEventListener('pointerup', (e) => {
      this.isDragging = false;
      this.canvas.releasePointerCapture(e.pointerId);
      
      // If it was a quick click, perform raycasting check
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
    
    // Resize handler
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
    
    // Pre-create basic geometries
    const sphereGeom = new THREE.SphereGeometry(1, 16, 12);
    const starGeom = new THREE.IcosahedronGeometry(1, 1);
    
    // 1. Render Node Meshes
    this.nodes.forEach(node => {
      let size = 3;
      let color = 0xbd93f9;
      let emissive = 0x221133;
      let geom = sphereGeom;
      
      switch (node.type) {
        case 'article':
        case 'article center':
          size = 7.5;
          color = 0x00f0ff;
          emissive = 0x002244;
          break;
        case 'theme':
        case 'theme center':
          size = 6.0;
          color = 0xffb86c;
          emissive = 0x331e00;
          geom = starGeom;
          break;
        case 'source':
          size = 3.5;
          color = 0xff79c6;
          emissive = 0x33001e;
          break;
        case 'point':
        case 'point center':
        default:
          size = 2.8;
          color = 0xbd93f9;
          emissive = 0x110022;
          break;
      }
      
      // Node Glowing Material
      const material = new THREE.MeshPhongMaterial({
        color: color,
        emissive: emissive,
        shininess: 30,
        specular: 0xffffff,
        flatShading: node.type === 'theme'
      });
      
      const mesh = new THREE.Mesh(geom, material);
      mesh.scale.set(size, size, size);
      mesh.position.set(node.x, node.y, node.z || 0);
      mesh.userData = { nodeId: node.id, nodeData: node };
      
      this.graphGroup.add(mesh);
      this.nodeMeshes.set(node.id, mesh);
    });
    
    // 2. Render Connection Lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x486480,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    
    const strongLineMaterial = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    
    const dashedMaterial = new THREE.LineBasicMaterial({
      color: 0xff79c6,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
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
      
      // Trigger a laser data stream animation along the connection line
      if (Math.random() < 0.6) {
        this.createLaserParticle(fromMesh.position, toMesh.position, link.type);
      }
    });
    
    this.buildHTMLLabels();
  }
  
  createLaserParticle(start, end, linkType) {
    let color = 0x00f0ff;
    if (linkType === 'sourceEdge') color = 0xff79c6;
    if (linkType === 'strong') color = 0xffb86c;
    
    this.laserParticles.push({
      start: start.clone(),
      end: end.clone(),
      position: start.clone(),
      t: Math.random(), // Distributed offset
      speed: 0.006 + Math.random() * 0.01,
      color: color
    });
  }
  
  repositionNodes() {
    this.nodeMeshes.forEach((mesh, id) => {
      const node = this.nodes.find(n => n.id === id);
      if (node) {
        mesh.position.set(node.x * this.densityScale, node.y * this.densityScale, (node.z || 0) * this.densityScale);
      }
    });
    
    // Update lines geometry
    this.graphGroup.children.forEach(child => {
      if (child instanceof THREE.Line) {
        const fromId = child.parent ? null : null; // lines are drawn statically, we rebuild graph for absolute changes
      }
    });
    this.buildGraph(); // Simplest robust update
  }
  
  buildHTMLLabels() {
    this.labelsContainer.innerHTML = '';
    this.linkLabelMeshes = [];
    
    this.nodes.forEach(node => {
      // Create HTML node marker
      const el = document.createElement('div');
      el.className = `node-label-anchor node-${node.type.replace(' center', '')}`;
      el.dataset.id = node.id;
      
      // Label inner content
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
      
      // Make it clickable via pointer events on wrapper
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
    // Raycast only on children of graphGroup that are meshes
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
    
    // Highlight HTML elements
    document.querySelectorAll('.node-label-anchor').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === nodeId);
    });
    
    // Focus camera onto the selected node mesh
    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) {
      const pos = mesh.position;
      
      // Update pan targets to center this node
      this.panTarget.copy(pos).multiplyScalar(-1);
      
      // Adjust camera distance depending on node type
      let zoomDist = 200;
      if (mesh.userData.nodeData.type.includes('article')) zoomDist = 320;
      if (mesh.userData.nodeData.type.includes('theme')) zoomDist = 260;
      
      this.zoomTarget = 1.3;
      this.cameraTarget.set(0, 0, zoomDist);
      
      // Trigger callback
      if (this.onNodeSelected) {
        this.onNodeSelected(mesh.userData.nodeData);
      }
    }
  }
  
  resetView() {
    this.panTarget.set(0, 0, 0);
    this.zoomTarget = 0.9;
    this.cameraTarget.set(0, 0, 520);
    this.worldRotationTarget.x = 0.4;
    this.worldRotationTarget.y = 0.1;
    this.selectedNodeId = null;
    
    document.querySelectorAll('.node-label-anchor').forEach(el => {
      el.classList.remove('selected');
    });
  }
  
  updateProjectedLabels() {
    if (!this.linkLabelMeshes.length) return;
    
    const width = this.wrapper.clientWidth;
    const height = this.wrapper.clientHeight;
    const widthHalf = width / 2;
    const heightHalf = height / 2;
    const tempV = new THREE.Vector3();
    
    this.linkLabelMeshes.forEach(item => {
      tempV.copy(item.position);
      
      // Apply world Group rotations and pans first
      tempV.applyMatrix4(this.graphGroup.matrixWorld);
      
      // Project into screen space
      tempV.project(this.camera);
      
      // Check if node is behind camera view clip pane
      if (tempV.z > 1) {
        item.element.style.display = 'none';
        return;
      }
      
      // Map back to absolute pixel offsets
      const x = (tempV.x * widthHalf) + widthHalf;
      const y = -(tempV.y * heightHalf) + heightHalf;
      
      item.element.style.display = 'block';
      item.element.style.left = `${x}px`;
      item.element.style.top = `${y}px`;
      
      // Set z-index based on depth coordinate
      const zIndex = Math.round((1 - tempV.z) * 1000);
      item.element.style.zIndex = `${zIndex}`;
      
      // Apply scaling based on distance to feel realistic 3D
      const scale = Math.max(0.65, Math.min(1.15, 1 - (tempV.z * 0.5)));
      item.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      item.element.style.opacity = Math.max(0.2, 1.2 - tempV.z);
    });
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // 1. Interpolate rotations & pans smoothly (Lerps)
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
    
    // Rotate background dust slowly
    if (this.stars) {
      this.stars.rotation.y += 0.0003;
      this.stars.rotation.x += 0.0001;
    }
    
    // 2. Animate Laser Particles
    this.animateLasers();
    
    // Render WebGL frame
    this.renderer.render(this.scene, this.camera);
    
    // 3. Update position of HTML overlays on screen
    this.updateProjectedLabels();
  }
  
  animateLasers() {
    // We will render laser particles as dynamic tiny spheres in our scene
    // First, clear any temporary particle meshes from last frame
    if (this.particleMeshes) {
      this.particleMeshes.forEach(pm => this.graphGroup.remove(pm));
    }
    this.particleMeshes = [];
    
    const geom = new THREE.SphereGeometry(1.2, 8, 8);
    
    this.laserParticles.forEach(lp => {
      lp.t += lp.speed;
      if (lp.t >= 1) {
        lp.t = 0; // Loop back
      }
      
      // Interpolate position
      lp.position.lerpVectors(lp.start, lp.end, lp.t);
      
      // Render particle
      const mat = new THREE.MeshBasicMaterial({
        color: lp.color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      
      const mesh = new THREE.Mesh(geom, mat);
      // reposition with density scale
      mesh.position.copy(lp.position).multiplyScalar(this.densityScale);
      
      this.graphGroup.add(mesh);
      this.particleMeshes.push(mesh);
    });
  }
}
