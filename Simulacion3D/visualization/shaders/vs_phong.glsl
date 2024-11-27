#version 300 es
in vec4 a_position;
in vec3 a_normal;

// Uniforms for camera and light positions
uniform vec3 u_viewWorldPosition;
uniform vec3 u_lightWorldPosition;

// Model transformation matrices
uniform mat4 u_world;
uniform mat4 u_worldInverseTranspose;
uniform mat4 u_worldViewProjection;

// Varyings to pass data to the fragment shader
out vec3 v_normal;
out vec3 v_cameraDirection;
out vec3 v_lightDirection;
out vec3 v_worldPosition; // Add this line

void main() {
    // Transform the vertex position to clip space
    gl_Position = u_worldViewProjection * a_position;

    // Transform the normal to world space and normalize it
    v_normal = mat3(u_worldInverseTranspose) * a_normal;

    // Compute the world space position of the vertex
    vec3 worldPosition = (u_world * a_position).xyz;
    v_worldPosition = worldPosition; // Pass the world position to the fragment shader

    // Compute vectors from the vertex to the light and camera
    v_lightDirection = u_lightWorldPosition - worldPosition;
    v_cameraDirection = u_viewWorldPosition - worldPosition;
}