async function startFieldScene() {
  const fieldHost = document.querySelector(".field-map");
  const canvas = document.getElementById("field-canvas");
  if (!fieldHost || !canvas) return;

  try {
    const [THREE, { OrbitControls }] = await Promise.all([
      import("three"),
      import("three/addons/controls/OrbitControls.js")
    ]);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bfd3bf");
    scene.fog = new THREE.Fog("#bfd3bf", 25, 58);

    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 90);
    camera.position.set(16, 18, 23);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    scene.add(new THREE.HemisphereLight(0xe6f1db, 0x69794c, 2.1));
    const sunlight = new THREE.DirectionalLight(0xfff3d8, 2.4);
    sunlight.position.set(-10, 19, 11);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    sunlight.shadow.camera.left = -24;
    sunlight.shadow.camera.right = 24;
    sunlight.shadow.camera.top = 24;
    sunlight.shadow.camera.bottom = -24;
    scene.add(sunlight);

    const makeMaterial = (color, roughness = 0.88, options = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...options });
    const makeBox = (width, height, depth, color, position, options = {}) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), makeMaterial(color, 0.9, options));
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(48, 42), makeMaterial("#879365"));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const road = makeBox(2.35, 0.12, 25, "#a39776", [0, 0.01, 0]);
    makeBox(0.12, 0.015, 22, "#e5d6a6", [0, 0.08, 0]);
    makeBox(26, 0.11, 1.35, "#9b9070", [0, 0, 0]);
    for (let dash = -10; dash <= 10; dash += 2.2) makeBox(0.13, 0.018, 0.8, "#e8dda9", [0, 0.08, dash]);
    road.receiveShadow = true;

    const canalMaterial = makeMaterial("#42a6a4", 0.28, { metalness: 0.12, emissive: "#14585b", emissiveIntensity: 0.2 });
    const canals = [];
    for (const canalX of [-1.52, 1.52]) {
      const canal = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.045, 24), canalMaterial);
      canal.position.set(canalX, 0.105, 0);
      scene.add(canal);
      canals.push(canalX);
      makeBox(0.08, 0.09, 24, "#c4b88c", [canalX - 0.21, 0.08, 0]);
      makeBox(0.08, 0.09, 24, "#c4b88c", [canalX + 0.21, 0.08, 0]);
    }

    const parcels = [
      { x: -7.1, z: -5.25, width: 9.7, depth: 9.25 },
      { x: -7.1, z: 5.25, width: 9.7, depth: 9.25 },
      { x: 7.1, z: -5.25, width: 9.7, depth: 9.25 },
      { x: 7.1, z: 5.25, width: 9.7, depth: 9.25 }
    ];
    const fieldModels = [];
    const farmTones = ["#7fac59", "#a8a955", "#bd8050", "#79a55a"];

    for (const [parcelIndex, parcel] of parcels.entries()) {
      const soilMaterial = makeMaterial(parcelIndex % 2 === 0 ? "#756f43" : "#82794a");
      const soil = new THREE.Mesh(new THREE.PlaneGeometry(parcel.width, parcel.depth), soilMaterial);
      soil.rotation.x = -Math.PI / 2;
      soil.position.set(parcel.x, 0.06, parcel.z);
      soil.receiveShadow = true;
      scene.add(soil);

      const cropCoordinates = [];
      for (let xOffset = -parcel.width / 2 + 0.35; xOffset < parcel.width / 2 - 0.2; xOffset += 0.52) {
        for (let zOffset = -parcel.depth / 2 + 0.35; zOffset < parcel.depth / 2 - 0.2; zOffset += 0.5) {
          cropCoordinates.push([parcel.x + xOffset, parcel.z + zOffset]);
        }
      }

      const stems = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.024, 0.045, 0.24, 5),
        makeMaterial("#657a39"),
        cropCoordinates.length
      );
      const leaves = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.145, 0),
        makeMaterial("#ffffff", 0.8),
        cropCoordinates.length * 3
      );
      const dummy = new THREE.Object3D();
      const leafColor = new THREE.Color(farmTones[parcelIndex]);
      for (const [plantIndex, [plantX, plantZ]] of cropCoordinates.entries()) {
        dummy.position.set(plantX, 0.2, plantZ);
        dummy.scale.set(0.8, 0.88, 0.8);
        dummy.updateMatrix();
        stems.setMatrixAt(plantIndex, dummy.matrix);
        for (let leafIndex = 0; leafIndex < 3; leafIndex++) {
          const angle = leafIndex * Math.PI * 2 / 3 + (plantIndex % 5) * 0.15;
          dummy.position.set(plantX + Math.cos(angle) * 0.075, 0.3 + (leafIndex % 2) * 0.025, plantZ + Math.sin(angle) * 0.075);
          dummy.rotation.set(0, angle, leafIndex === 1 ? 0.2 : -0.12);
          dummy.scale.set(1.15, 0.72 + (plantIndex % 3) * 0.08, 0.9);
          dummy.updateMatrix();
          const leafInstance = plantIndex * 3 + leafIndex;
          leaves.setMatrixAt(leafInstance, dummy.matrix);
          leaves.setColorAt(leafInstance, leafColor);
        }
      }
      stems.instanceMatrix.needsUpdate = true;
      leaves.instanceMatrix.needsUpdate = true;
      if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
      stems.castShadow = true;
      leaves.castShadow = true;
      stems.receiveShadow = true;
      leaves.receiveShadow = true;
      scene.add(stems, leaves);

      const irrigationLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.035, parcel.depth - 0.5),
        makeMaterial("#4aa5a0", 0.4, { emissive: "#12605d", emissiveIntensity: 0.25 })
      );
      irrigationLine.position.set(parcel.x, 0.15, parcel.z);
      scene.add(irrigationLine);
      fieldModels.push({ soilMaterial, leaves, irrigationLine });
    }

    const movingWater = [];
    for (const canalX of canals) {
      for (let beadIndex = 0; beadIndex < 5; beadIndex++) {
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), makeMaterial("#b7f0dd", 0.25, { emissive: "#64d7ce", emissiveIntensity: 0.8 }));
        bead.position.set(canalX, 0.17, -10 + beadIndex * 4.3);
        scene.add(bead);
        movingWater.push({ bead, offset: beadIndex * 4.3, direction: canalX < 0 ? 1 : -1 });
      }
    }

    makeBox(4.1, 1.35, 2.6, "#e6dec5", [0, 0.72, -10.8]);
    const shedRoof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.2, 4), makeMaterial("#687b51"));
    shedRoof.rotation.y = Math.PI / 4;
    shedRoof.position.set(0, 1.95, -10.8);
    shedRoof.castShadow = true;
    scene.add(shedRoof);
    makeBox(0.8, 1.05, 0.08, "#526149", [0, 0.55, -9.46]);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 2.6, 12), makeMaterial("#d2d5c5", 0.58, { metalness: 0.08 }));
    silo.position.set(2.8, 1.3, -10.9);
    silo.castShadow = true;
    scene.add(silo);
    const siloCap = new THREE.Mesh(new THREE.ConeGeometry(0.64, 0.65, 12), makeMaterial("#778568"));
    siloCap.position.set(2.8, 2.92, -10.9);
    scene.add(siloCap);

    for (let treeIndex = 0; treeIndex < 14; treeIndex++) {
      const treeX = -13 + treeIndex * 2;
      const treeZ = treeIndex % 2 === 0 ? -13.6 : -14.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1, 5), makeMaterial("#65573d"));
      trunk.position.set(treeX, 0.48, treeZ);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 6), makeMaterial(treeIndex % 2 === 0 ? "#50724a" : "#668454"));
      crown.position.set(treeX, 1.72, treeZ);
      crown.castShadow = true;
      scene.add(crown);
    }

    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.64, 32),
      new THREE.MeshBasicMaterial({ color: "#e8f49a", side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.22;
    selectionRing.scale.set(2.8, 2.3, 1);
    scene.add(selectionRing);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.1, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 16;
    controls.maxDistance = 37;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.25;
    controls.update();
    const initialCameraPosition = camera.position.clone();
    const initialTarget = controls.target.clone();

    const resizeScene = () => {
      const bounds = fieldHost.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      camera.aspect = bounds.width / bounds.height;
      camera.updateProjectionMatrix();
      renderer.setSize(bounds.width, bounds.height, false);
    };
    const resizeObserver = new ResizeObserver(resizeScene);
    resizeObserver.observe(fieldHost);
    resizeScene();
    fieldHost.classList.add("three-ready");

    function updateFarms(data) {
      if (!data?.farms?.length) return;
      for (const [parcelIndex, model] of fieldModels.entries()) {
        const farm = data.farms[parcelIndex % data.farms.length];
        const moisture = farm.soilMoisture;
        const cropColor = moisture < 25 ? "#bd8050" : moisture < 35 ? "#a8a955" : "#7fac59";
        model.leaves.material.color.set("#ffffff");
        for (let leafIndex = 0; leafIndex < model.leaves.count; leafIndex++) {
          model.leaves.setColorAt(leafIndex, new THREE.Color(cropColor).offsetHSL(0, 0, (leafIndex % 3) * 0.025));
        }
        model.leaves.instanceColor.needsUpdate = true;
        model.soilMaterial.color.set(moisture < 25 ? "#82714c" : moisture < 35 ? "#80784a" : "#756f43");
        model.irrigationLine.material.emissiveIntensity = moisture < 30 ? 0.55 : 0.22;
      }
      const activeIndex = Math.max(0, data.farms.findIndex((farm) => farm.id === data.activeFarmId));
      const parcel = parcels[activeIndex % parcels.length];
      selectionRing.position.set(parcel.x, 0.22, parcel.z);
    }

    window.addEventListener("agriflow:farm-selection", (event) => updateFarms(event.detail));
    if (window.agriflowFarmData) updateFarms(window.agriflowFarmData);

    const resetButton = document.getElementById("scene-reset");
    const motionButton = document.getElementById("scene-motion");
    resetButton?.addEventListener("click", () => {
      camera.position.copy(initialCameraPosition);
      controls.target.copy(initialTarget);
      controls.update();
    });
    let animationRunning = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!animationRunning && motionButton) {
      motionButton.textContent = "▶";
      motionButton.title = "Resume scene animation";
      motionButton.setAttribute("aria-label", "Resume scene animation");
      motionButton.setAttribute("aria-pressed", "true");
    }
    motionButton?.addEventListener("click", () => {
      animationRunning = !animationRunning;
      motionButton.textContent = animationRunning ? "Ⅱ" : "▶";
      motionButton.title = animationRunning ? "Pause scene animation" : "Resume scene animation";
      motionButton.setAttribute("aria-label", motionButton.title);
      motionButton.setAttribute("aria-pressed", String(!animationRunning));
    });

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const elapsed = clock.getElapsedTime();
      if (animationRunning) {
        for (const water of movingWater) {
          water.bead.position.z = ((water.offset + elapsed * 0.9 * water.direction + 12) % 24) - 12;
        }
      }
      controls.update();
      renderer.render(scene, camera);
    });
  } catch (error) {
    fieldHost.classList.add("visualizer-fallback");
    canvas.hidden = true;
    console.warn("AgriFlow 3D field view is unavailable; using the field image fallback.", error);
  }
}

startFieldScene();