"use strict";

import * as twgl from "twgl.js";
import GUI from "lil-gui";
import vs_phong from "./shaders/vs_phong.glsl?raw";
import fs_phong from "./shaders/fs_phong.glsl?raw";

// Server URI
const agent_server_uri = "http://localhost:8585/";

// Arrays for entities
const obstacles = [];
const destinations = [];
const trafficLights = [];
const roads = [];

// Object for cars
const cars = {};

// WebGL variables
let gl,
  programInfo,
  carBufferInfo,
  cubeBufferInfo,
  obstacleBufferInfo,
  trafficLightBufferInfo,
  destinationBufferInfo,
  roadBufferInfo,
  floorBufferInfo;
let carVAO,
  cubeVAO,
  obstacleVAO,
  trafficLightVAO,
  destinationVAO,
  roadVAO,
  floorVAO;

// Camera settings
let cameraPosition = { x: 10, y: 60, z: 20 };
// Frame variables
let frameCount = 0;
let framesSinceUpdate = 0;

// Lighting Settings
const lightingSettings = {
  ambientLight: [0.2, 0.2, 0.2, 1.0],
  diffuseLight: [0.7, 0.7, 0.7, 1.0],
  specularLight: [1.0, 1.0, 1.0, 1.0],
  lightPosition: { x: 10, y: 20, z: 10 },
};

// Declare global variables for floor dimensions
let floorWidth = 31;
let floorDepth = 31;

// Main function
async function main() {
  const canvas = document.querySelector("canvas");
  gl = canvas.getContext("webgl2");
  if (!gl) {
    console.error("WebGL2 not supported");
    return;
  }

  // Compile shaders and link program
  programInfo = twgl.createProgramInfo(gl, [vs_phong, fs_phong]);

  // Load and parse car model
  const carObjContent = await loadOBJFile("./car.obj");
  if (carObjContent) {
    const carVertexData = parseOBJ(carObjContent);
    if (carVertexData) {
      console.log("Parsed Car Model Data:", carVertexData);
      validateVertexData(carVertexData);
      carBufferInfo = twgl.createBufferInfoFromArrays(gl, carVertexData);
      carVAO = twgl.createVAOFromBufferInfo(gl, programInfo, carBufferInfo);
    }
  }

  // Load and parse obstacle model
  const obstacleObjContent = await loadOBJFile("./obstacle.obj");
  if (obstacleObjContent) {
    const obstacleVertexData = parseOBJ(obstacleObjContent);
    if (obstacleVertexData) {
      console.log("Parsed Obstacle Model Data:", obstacleVertexData);
      validateVertexData(obstacleVertexData);
      obstacleBufferInfo = twgl.createBufferInfoFromArrays(
        gl,
        obstacleVertexData
      );
      obstacleVAO = twgl.createVAOFromBufferInfo(
        gl,
        programInfo,
        obstacleBufferInfo
      );
    }
  }

  // Load and parse traffic light model
  const trafficLightObjContent = await loadOBJFile("./trafficLight.obj");
  if (trafficLightObjContent) {
    const trafficLightVertexData = parseOBJ(trafficLightObjContent);
    if (trafficLightVertexData) {
      console.log("Parsed Traffic Light Model Data:", trafficLightVertexData);
      validateVertexData(trafficLightVertexData);
      trafficLightBufferInfo = twgl.createBufferInfoFromArrays(
        gl,
        trafficLightVertexData
      );
      trafficLightVAO = twgl.createVAOFromBufferInfo(
        gl,
        programInfo,
        trafficLightBufferInfo
      );
    }
  }

  // Load and parse destination model
  const destinationObjContent = await loadOBJFile("./destination.obj");
  if (destinationObjContent) {
    const destinationVertexData = parseOBJ(destinationObjContent);
    if (destinationVertexData) {
      console.log("Parsed Destination Model Data:", destinationVertexData);
      validateVertexData(destinationVertexData);
      destinationBufferInfo = twgl.createBufferInfoFromArrays(
        gl,
        destinationVertexData
      );
      destinationVAO = twgl.createVAOFromBufferInfo(
        gl,
        programInfo,
        destinationBufferInfo
      );
    }
  }

  const roadObjContent = await loadOBJFile("./road.obj");
  if (roadObjContent) {
    const roadVertexData = parseOBJ(roadObjContent);
    if (roadVertexData) {
      console.log("Parsed Road Model Data:", roadVertexData);
      validateVertexData(roadVertexData);
      roadBufferInfo = twgl.createBufferInfoFromArrays(gl, roadVertexData);
      roadVAO = twgl.createVAOFromBufferInfo(gl, programInfo, roadBufferInfo);
    }
  }

  // Generate plane data for the floor
  const floorData = generatePlaneData(floorWidth, floorDepth);
  floorBufferInfo = twgl.createBufferInfoFromArrays(gl, floorData);
  floorVAO = twgl.createVAOFromBufferInfo(gl, programInfo, floorBufferInfo);

  // Generate cube data for roads
  const cubeData = generateCubeData(1);
  cubeBufferInfo = twgl.createBufferInfoFromArrays(gl, cubeData);
  cubeVAO = twgl.createVAOFromBufferInfo(gl, programInfo, cubeBufferInfo);

  // Initialize model on the server and fetch initial entities
  await initModel();
  await fetchEntities();

  // Setup the GUI for camera and lighting controls
  setupGUI();

  // Start rendering loop
  drawScene();
}

// Updates agents' positions
async function update() {
  try {
    const response = await fetch(agent_server_uri + "update");
    if (response.ok) {
      await Promise.all([fetchCars(), fetchTrafficLights()]);
    }
  } catch (error) {
    console.error("Error updating agents:", error);
  }
}

// Validate the vertex data for consistency
function validateVertexData(data) {
  if (!data) {
    console.error("Invalid vertex data.");
    return;
  }
  console.assert(data.a_position.data.length > 0, "Missing position data");
  console.assert(data.indices.data.length > 0, "Missing indices");
  console.assert(
    data.a_normal.data.length / 3 === data.a_position.data.length / 3,
    "Mismatch between normals and positions"
  );
}

// Load the .obj file
async function loadOBJFile(filename) {
  try {
    const response = await fetch(filename);
    if (!response.ok) throw new Error(`Failed to load ${filename}`);
    const objContent = await response.text();
    return objContent; // Return raw string
  } catch (error) {
    console.error("Error loading OBJ file:", error);
    return null;
  }
}

// Parse the .obj file content
function parseOBJ(objContent) {
  if (typeof objContent !== "string") {
    console.error("OBJ content is not a string");
    return null;
  }

  const positions = [];
  const normals = [];
  const texCoords = [];
  const positionData = [];
  const normalData = [];
  const texCoordData = [];
  const colorData = [];
  const indices = [];

  const lines = objContent.split("\n");
  let vertexIndex = 0;

  lines.forEach((line) => {
    const parts = line.trim().split(" ");
    if (parts.length === 0) return;
    switch (parts[0]) {
      // Vertex positions
      case "v":
        positions.push(parts.slice(1).map(parseFloat));
        break;
      // Vertex normals
      case "vn":
        normals.push(parts.slice(1).map(parseFloat));
        break;
      // Texture coordinates
      case "vt":
        texCoords.push(parts.slice(1).map(parseFloat));
        break;
      // Faces
      case "f":
        const vertices = parts.slice(1);
        vertices.forEach((vertex) => {
          const [vIdx, vtIdx, vnIdx] = vertex
            .split("/")
            .map((n) => (n ? parseInt(n, 10) - 1 : undefined));

          // Add position data
          if (positions[vIdx]) {
            positionData.push(...positions[vIdx]);
          } else {
            console.error("Missing position for vertex", vIdx);
            positionData.push(0, 0, 0);
          }

          // Add texture coordinates
          if (vtIdx !== undefined && texCoords[vtIdx]) {
            texCoordData.push(...texCoords[vtIdx]);
          } else {
            // Default texture coordinates if missing
            texCoordData.push(0, 0);
          }

          // Add normal data
          if (vnIdx !== undefined && normals[vnIdx]) {
            normalData.push(...normals[vnIdx]);
          } else {
            // Default normal if missing
            normalData.push(0, 0, 1);
          }

          // Add default color
          colorData.push(0.5, 0.5, 0.5, 1);

          // Track indices
          indices.push(vertexIndex++);
        });
        break;
    }
  });

  // Ensure all arrays are consistent
  const vertexCount = positionData.length / 3;
  while (normalData.length / 3 < vertexCount) normalData.push(0, 0, 1);
  while (texCoordData.length / 2 < vertexCount) texCoordData.push(0, 0);
  while (colorData.length / 4 < vertexCount) colorData.push(0.5, 0.5, 0.5, 1);

  return {
    a_position: { numComponents: 3, data: positionData },
    a_normal: { numComponents: 3, data: normalData },
    a_texCoord: { numComponents: 2, data: texCoordData },
    a_color: { numComponents: 4, data: colorData },
    indices: { numComponents: 3, data: indices },
  };
}

function generatePlaneData(width, depth) {
  const w = width / 2;
  const d = depth / 2;

  return {
    a_position: {
      numComponents: 3,
      data: [
        // Vertex positions (X, Y, Z)
        -w,
        0,
        -d, // Vertex 0
        w,
        0,
        -d, // Vertex 1
        w,
        0,
        d, // Vertex 2
        -w,
        0,
        d, // Vertex 3
      ],
    },
    a_normal: {
      numComponents: 3,
      data: [
        // Normals pointing up (Y-axis)
        0,
        1,
        0, // Vertex 0
        0,
        1,
        0, // Vertex 1
        0,
        1,
        0, // Vertex 2
        0,
        1,
        0, // Vertex 3
      ],
    },
    a_color: {
      numComponents: 4,
      data: [
        // Colors for each vertex (RGBA)
        0.6,
        0.6,
        0.6,
        1.0, // Vertex 0
        0.6,
        0.6,
        0.6,
        1.0, // Vertex 1
        0.6,
        0.6,
        0.6,
        1.0, // Vertex 2
        0.6,
        0.6,
        0.6,
        1.0, // Vertex 3
      ],
    },
    indices: {
      numComponents: 3,
      data: [
        // Two triangles forming the plane
        0, 1, 2, 0, 2, 3,
      ],
    },
  };
}

// Generate cube vertex data
function generateCubeData(size, isBorder = false) {
  const scaleFactor = isBorder ? 1.05 : 1.0;
  return {
    a_position: {
      numComponents: 3,
      data: [
        // Front face
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        // Back face
        -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
        // Top face
        -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5,
        // Bottom face
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
        // Right face
        0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
        // Left face
        -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
      ].map((v) => v * size * scaleFactor),
    },
    a_normal: {
      numComponents: 3,
      data: [
        // Front face normals
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // Back face normals
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Top face normals
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // Bottom face normals
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Right face normals
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // Left face normals
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
      ],
    },
    a_color: {
      numComponents: 4,
      data: Array(24)
        .fill(isBorder ? [1.0, 1.0, 1.0, 1.0] : [0.5, 0.5, 0.5, 1.0])
        .flat(),
    },
    indices: {
      numComponents: 3,
      data: [
        0,
        1,
        2,
        0,
        2,
        3, // Front
        4,
        5,
        6,
        4,
        6,
        7, // Back
        8,
        9,
        10,
        8,
        10,
        11, // Top
        12,
        13,
        14,
        12,
        14,
        15, // Bottom
        16,
        17,
        18,
        16,
        18,
        19, // Right
        20,
        21,
        22,
        20,
        22,
        23, // Left
      ],
    },
  };
}

// Initialize model on the server
async function initModel() {
  try {
    const response = await fetch(`${agent_server_uri}init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ N: 5 }),
    });
    if (!response.ok) {
      console.error("Error initializing model.");
    }
  } catch (error) {
    console.error("Error initializing model:", error);
  }
}

// Fetch all entities
async function fetchEntities() {
  await Promise.all([
    fetchCars(),
    fetchObstacles(),
    fetchDestinations(),
    fetchTrafficLights(),
    fetchRoads(),
  ]);
}

// Fetch cars
async function fetchCars() {
  try {
    const response = await fetch(`${agent_server_uri}getCars`);
    if (!response.ok) throw new Error("Failed to fetch cars.");
    const result = await response.json();
    const newPositions = result.positions;

    // Update cars object
    newPositions.forEach((newCar) => {
      const carId = newCar.id;
      if (cars[carId]) {
        // Existing car: update previous and current positions
        cars[carId].prevX = cars[carId].x;
        cars[carId].prevY = cars[carId].y;
        cars[carId].prevZ = cars[carId].z;
        cars[carId].x = newCar.x;
        cars[carId].y = newCar.y;
        cars[carId].z = newCar.z;

        // Reset interpolation factor
        cars[carId].interpolation = 0;
      } else {
        // New car: initialize positions
        cars[carId] = {
          id: carId,
          x: newCar.x,
          y: newCar.y,
          z: newCar.z,
          prevX: newCar.x,
          prevY: newCar.y,
          prevZ: newCar.z,
          // Initialize last known angle
          lastAngle: 0,
          // Initialize interpolation factor
          interpolation: 0,
        };
      }
    });

    // Remove cars that no longer exist
    Object.keys(cars).forEach((carId) => {
      if (!newPositions.some((car) => car.id === carId)) {
        delete cars[carId];
      }
    });
  } catch (error) {
    console.error("Error fetching cars:", error);
  }
}

// Fetch obstacles
async function fetchObstacles() {
  try {
    const response = await fetch(`${agent_server_uri}getObstacles`);
    if (!response.ok) throw new Error("Failed to fetch obstacles.");
    const result = await response.json();
    obstacles.length = 0;
    obstacles.push(...result.positions);
  } catch (error) {
    console.error("Error fetching obstacles:", error);
  }
}

// Fetch destinations
async function fetchDestinations() {
  try {
    const response = await fetch(`${agent_server_uri}getDestinations`);
    if (!response.ok) throw new Error("Failed to fetch destinations.");
    const result = await response.json();
    destinations.length = 0;
    destinations.push(...result.positions);
  } catch (error) {
    console.error("Error fetching destinations:", error);
  }
}

// Fetch traffic lights
async function fetchTrafficLights() {
  try {
    const response = await fetch(`${agent_server_uri}getTrafficLights`);
    if (!response.ok) throw new Error("Failed to fetch traffic lights.");
    const result = await response.json();
    trafficLights.length = 0;
    trafficLights.push(...result.positions);
  } catch (error) {
    console.error("Error fetching traffic lights:", error);
  }
}

// Fetch roads
async function fetchRoads() {
  try {
    const response = await fetch(`${agent_server_uri}getRoads`);
    if (!response.ok) throw new Error("Failed to fetch roads.");
    const result = await response.json();
    roads.length = 0;
    roads.push(...result.positions);
  } catch (error) {
    console.error("Error fetching roads:", error);
  }
}

// Render the scene
async function drawScene() {
  twgl.resizeCanvasToDisplaySize(gl.canvas);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0.9, 0.9, 0.9, 1);
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(programInfo.program);

  const viewProjectionMatrix = setupCamera();

  // Calculate camera position in world space
  const cameraPositionVector = [
    cameraPosition.x,
    cameraPosition.y,
    cameraPosition.z,
  ];

  // Prepare traffic light data
  let trafficLightPositions = [];
  let trafficLightColors = [];

  trafficLights.forEach((light) => {
    // Positions
    trafficLightPositions.push(light.x, light.y, light.z);

    // Colors based on state
    const color = light.state ? [0.0, 1.0, 0.0, 1.0] : [1.0, 0.0, 0.0, 1.0];
    trafficLightColors.push(...color);
  });

  // Set global lighting uniforms
  twgl.setUniforms(programInfo, {
    u_viewWorldPosition: cameraPositionVector,
    u_lightWorldPosition: [
      lightingSettings.lightPosition.x,
      lightingSettings.lightPosition.y,
      lightingSettings.lightPosition.z,
    ],
    u_ambientLight: lightingSettings.ambientLight,
    u_diffuseLight: lightingSettings.diffuseLight,
    u_specularLight: lightingSettings.specularLight,

    // Traffic light uniforms
    u_numTrafficLights: trafficLights.length,
    u_trafficLightPositions: trafficLightPositions,
    u_trafficLightColors: trafficLightColors,
  });

  drawEntities(viewProjectionMatrix);

  frameCount++;
  // Increment frames since last update
  framesSinceUpdate++;

  if (frameCount % 30 === 0) {
    frameCount = 0;
    // Reset frames since last update
    framesSinceUpdate = 0;
    await update();
  }

  requestAnimationFrame(drawScene);
}

// Draw all entities
function drawEntities(viewProjectionMatrix) {
  drawFloor(viewProjectionMatrix);
  drawRoads(viewProjectionMatrix);
  drawObstacles(viewProjectionMatrix);
  drawDestinations(viewProjectionMatrix);
  drawTrafficLights(viewProjectionMatrix);
  drawCars(viewProjectionMatrix);
}

// Draw cars
function drawCars(viewProjectionMatrix) {
  gl.bindVertexArray(carVAO);
  Object.values(cars).forEach((car) => {
    // Interpolation factor between 0 and 1
    const t = framesSinceUpdate / 30;

    // Interpolated position
    const x = car.prevX + (car.x - car.prevX) * t;
    const y = car.prevY + (car.y - car.prevY) * t;
    const z = car.prevZ + (car.z - car.prevZ) * t;

    // Direction vector
    const dirX = car.x - car.prevX;
    const dirZ = car.z - car.prevZ;

    // Calculate the angle of rotation
    let angle = Math.atan2(dirX, dirZ);

    // Handle cars with no movement
    if (dirX === 0 && dirZ === 0) {
      // Use the last known angle or default to 0
      angle = car.lastAngle || 0;
    } else {
      // Store the last known angle
      car.lastAngle = angle;
    }

    // Create a world matrix for the car
    let worldMatrix = twgl.m4.identity();
    worldMatrix = twgl.m4.translate(worldMatrix, [x, y - 0.27, z]);
    // Rotate the car
    worldMatrix = twgl.m4.rotateY(worldMatrix, angle);
    // Scale the car
    worldMatrix = twgl.m4.scale(worldMatrix, [0.15, 0.15, 0.15]);

    // Calculate the world-view-projection matrix
    const worldViewProjectionMatrix = twgl.m4.multiply(
      viewProjectionMatrix,
      worldMatrix
    );

    // Set uniforms specific to the car
    twgl.setUniforms(programInfo, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_world: worldMatrix,
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
      // Orange ambient color
      u_ambientColor: [1, 0.5, 0, 1],
      // Orange diffuse color
      u_diffuseColor: [1, 0.5, 0, 1],
      // White specular color
      u_specularColor: [1, 1, 1, 1],
      // Shininess factor
      u_shininess: 32.0,
    });

    // Draw the car
    twgl.drawBufferInfo(gl, carBufferInfo);
  });
}

// Draw obstacles
function drawObstacles(viewProjectionMatrix) {
  gl.bindVertexArray(obstacleVAO);
  obstacles.forEach((obstacle) => {
    // Create a world matrix for the obstacle
    let worldMatrix = twgl.m4.identity();
    worldMatrix = twgl.m4.translate(worldMatrix, [
      obstacle.x,
      obstacle.y - 0.4,
      obstacle.z,
    ]);
    // Scale the obstacle
    worldMatrix = twgl.m4.scale(worldMatrix, [0.7, 1.5, 0.7]);

    // Calculate the world-view-projection matrix
    const worldViewProjectionMatrix = twgl.m4.multiply(
      viewProjectionMatrix,
      worldMatrix
    );

    // Set uniforms specific to the obstacle
    twgl.setUniforms(programInfo, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_world: worldMatrix,
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
      // Low ambient color
      u_ambientColor: [0.1, 0.1, 0.1, 1],
      // Black diffuse color
      u_diffuseColor: [0, 0, 0, 1],
      // Gray specular color
      u_specularColor: [0.5, 0.5, 0.5, 1],
      // Shininess factor
      u_shininess: 16.0,
    });

    // Draw the obstacle
    twgl.drawBufferInfo(gl, obstacleBufferInfo);
  });
}

// Draw destinations
function drawDestinations(viewProjectionMatrix) {
  // Use destinationVAO
  gl.bindVertexArray(destinationVAO);
  destinations.forEach((destination) => {
    // Create a world matrix for the destination
    let worldMatrix = twgl.m4.identity();
    worldMatrix = twgl.m4.translate(worldMatrix, [
      destination.x,
      destination.y - 0.4,
      destination.z,
    ]);
    // Scale the destination
    worldMatrix = twgl.m4.scale(worldMatrix, [0.25, 0.5, 0.25]);

    // Calculate the world-view-projection matrix
    const worldViewProjectionMatrix = twgl.m4.multiply(
      viewProjectionMatrix,
      worldMatrix
    );

    // Set uniforms specific to the destination
    twgl.setUniforms(programInfo, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_world: worldMatrix,
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
      // Dark yellow ambient color
      u_ambientColor: [0.2, 0.2, 0.0, 1],
      // Yellow diffuse color
      u_diffuseColor: [1, 1, 0, 1],
      // Gray specular color
      u_specularColor: [0.5, 0.5, 0.5, 1],
      // Shininess factor
      u_shininess: 16.0,
    });

    // Draw the destination
    twgl.drawBufferInfo(gl, destinationBufferInfo);
  });
}

// Draw traffic lights
function drawTrafficLights(viewProjectionMatrix) {
  gl.bindVertexArray(trafficLightVAO);
  trafficLights.forEach((light) => {
    // Create a world matrix for the traffic light
    let worldMatrix = twgl.m4.identity();
    worldMatrix = twgl.m4.translate(worldMatrix, [light.x, light.y, light.z]);
    // Scale for Traffic Lights
    worldMatrix = twgl.m4.scale(worldMatrix, [0.3, 0.3, 0.3]);

    // Calculate the world-view-projection matrix
    const worldViewProjectionMatrix = twgl.m4.multiply(
      viewProjectionMatrix,
      worldMatrix
    );

    // Determine color based on light state (green or red)
    const color = light.state ? [0, 1, 0, 1] : [1, 0, 0, 1];

    // Set uniforms specific to the traffic light
    twgl.setUniforms(programInfo, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_world: worldMatrix,
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
      // Low ambient color
      u_ambientColor: [0.1, 0.1, 0.1, 1],
      // Green or Red diffuse color
      u_diffuseColor: color,
      // Gray specular color
      u_specularColor: [0.5, 0.5, 0.5, 1],
      // Shininess factor
      u_shininess: 16.0,
    });

    // Draw the traffic light
    twgl.drawBufferInfo(gl, trafficLightBufferInfo);
  });
}

// Draw roads
function drawRoads(viewProjectionMatrix) {
  gl.bindVertexArray(roadVAO);
  roads.forEach((road) => {
    // Create a world matrix for the road
    let worldMatrix = twgl.m4.identity();
    worldMatrix = twgl.m4.translate(worldMatrix, [
      road.x,
      road.y - 0.7,
      road.z,
    ]);

    // Initialize scaling factors
    let scaleX, scaleY, scaleZ;

    // Rotate and scale based on direction
    if (road.direction === "Left" || road.direction === "Right") {
      // Rotate 90 degrees around Y axis
      worldMatrix = twgl.m4.rotateY(worldMatrix, Math.PI / 2);

      // Apply scaling for Left/Right roads
      scaleX = 0.3;
      scaleY = 0.8;
      scaleZ = 0.15;
    } else if (road.direction === "Up" || road.direction === "Down") {
      // No rotation needed for Up/Down roads

      // Apply scaling for Up/Down roads
      scaleX = 0.25;
      scaleY = 0.8;
      scaleZ = 0.18;
    } else {
      // Default scaling in case direction is not specified
      scaleX = 0.1;
      scaleY = 0.1;
      scaleZ = 0.1;
    }

    // Apply scaling based on direction
    worldMatrix = twgl.m4.scale(worldMatrix, [scaleX, scaleY, scaleZ]);

    // Calculate the world-view-projection matrix
    const worldViewProjectionMatrix = twgl.m4.multiply(
      viewProjectionMatrix,
      worldMatrix
    );

    // Set uniforms specific to the road
    twgl.setUniforms(programInfo, {
      u_worldViewProjection: worldViewProjectionMatrix,
      u_world: worldMatrix,
      u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
      u_ambientColor: [0.1, 0.1, 0.1, 1],
      u_diffuseColor: [0.6, 0.6, 0.6, 1],
      u_specularColor: [0.3, 0.3, 0.3, 1],
      u_shininess: 16.0,
    });

    // Draw the road
    twgl.drawBufferInfo(gl, roadBufferInfo);
  });
}

function drawFloor(viewProjectionMatrix) {
  gl.bindVertexArray(floorVAO);

  // Create a world matrix for the floor
  let worldMatrix = twgl.m4.identity();

  // Position the floor
  worldMatrix = twgl.m4.translate(worldMatrix, [
    floorWidth / 2 - 1,
    0,
    floorDepth / 2,
  ]);

  // Calculate the world-view-projection matrix
  const worldViewProjectionMatrix = twgl.m4.multiply(
    viewProjectionMatrix,
    worldMatrix
  );

  // Set uniforms specific to the floor
  twgl.setUniforms(programInfo, {
    u_worldViewProjection: worldViewProjectionMatrix,
    u_world: worldMatrix,
    u_worldInverseTranspose: twgl.m4.transpose(twgl.m4.inverse(worldMatrix)),
    u_ambientColor: [0.1, 0.1, 0.1, 1],
    u_diffuseColor: [0.6, 0.6, 0.6, 1],
    u_specularColor: [0.3, 0.3, 0.3, 1],
    u_shininess: 16.0,
  });

  // Draw the floor
  twgl.drawBufferInfo(gl, floorBufferInfo);
}

// Setup GUI for Camera and Lighting Controls
function setupGUI() {
  const gui = new GUI();

  // Camera Controls
  const cameraFolder = gui.addFolder("Camera Position");
  cameraFolder
    .add(cameraPosition, "x", -50, 50)
    .name("Camera X")
    .onChange(() => {});
  cameraFolder
    .add(cameraPosition, "y", 0, 100)
    .name("Camera Y")
    .onChange(() => {});
  cameraFolder
    .add(cameraPosition, "z", -50, 50)
    .name("Camera Z")
    .onChange(() => {});
  cameraFolder.open();

  // Lighting Controls
  const lightFolder = gui.addFolder("Lighting Settings");

  // Light Position
  lightFolder
    .add(lightingSettings.lightPosition, "x", -50, 50)
    .name("Light X")
    .onChange(() => {});
  lightFolder
    .add(lightingSettings.lightPosition, "y", -50, 50)
    .name("Light Y")
    .onChange(() => {});
  lightFolder
    .add(lightingSettings.lightPosition, "z", -50, 50)
    .name("Light Z")
    .onChange(() => {});

  // Ambient Light Color
  lightFolder
    .addColor(lightingSettings, "ambientLight")
    .name("Ambient Light")
    .onChange(() => {});

  // Diffuse Light Color
  lightFolder
    .addColor(lightingSettings, "diffuseLight")
    .name("Diffuse Light")
    .onChange(() => {});

  // Specular Light Color
  lightFolder
    .addColor(lightingSettings, "specularLight")
    .name("Specular Light")
    .onChange(() => {});

  lightFolder.open();
}

// Setup the camera view
function setupCamera() {
  // Field of view in radians
  const fov = (45 * Math.PI) / 180;
  // Aspect ratio
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const projectionMatrix = twgl.m4.perspective(fov, aspect, 1, 200);

  // Look at the center
  const target = [10, 0, 10];
  const up = [0, 1, 0];
  const cameraMatrix = twgl.m4.lookAt(
    [cameraPosition.x, cameraPosition.y, cameraPosition.z],
    target,
    up
  );
  const viewMatrix = twgl.m4.inverse(cameraMatrix);
  return twgl.m4.multiply(projectionMatrix, viewMatrix);
}

// Start the application
main();
