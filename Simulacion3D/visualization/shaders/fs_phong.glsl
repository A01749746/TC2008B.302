#version 300 es
precision highp float;

in vec3 v_normal;
in vec3 v_cameraDirection;
in vec3 v_lightDirection;
in vec3 v_worldPosition; // Receive the world position

// Light properties
uniform vec4 u_ambientLight;
uniform vec4 u_diffuseLight;
uniform vec4 u_specularLight;

// Material properties
uniform vec4 u_ambientColor;
uniform vec4 u_diffuseColor;
uniform vec4 u_specularColor;
uniform float u_shininess;

// Traffic light properties
#define MAX_TRAFFIC_LIGHTS 27
uniform int u_numTrafficLights;
uniform vec3 u_trafficLightPositions[MAX_TRAFFIC_LIGHTS];
uniform vec4 u_trafficLightColors[MAX_TRAFFIC_LIGHTS];

out vec4 outColor;

void main() {
    // Normalize the input vectors
    vec3 normalVector = normalize(v_normal);
    vec3 cameraVector = normalize(v_cameraDirection);

    // Calculate the ambient component
    vec4 ambient = u_ambientLight * u_ambientColor;

    // Calculate the diffuse component
    vec3 lightVector = normalize(v_lightDirection);
    float lambertian = max(dot(normalVector, lightVector), 0.0);
    vec4 diffuse = vec4(0.0);
    if (lambertian > 0.0) {
        diffuse = u_diffuseLight * u_diffuseColor * lambertian;
    }

    // Calculate the specular component
    vec3 halfVector = normalize(lightVector + cameraVector);
    float specAngle = max(dot(normalVector, halfVector), 0.0);
    vec4 specular = vec4(0.0);
    if (lambertian > 0.0) {
        float specFactor = pow(specAngle, u_shininess);
        specular = u_specularLight * u_specularColor * specFactor;
    }

    // Combine all lighting components
    vec4 totalColor = ambient + diffuse + specular;

    // --- Traffic light contributions ---
    for (int i = 0; i < u_numTrafficLights; ++i) {
        vec3 trafficLightPos = u_trafficLightPositions[i];
        vec4 trafficLightColor = u_trafficLightColors[i];

        // Vector from fragment to traffic light
        vec3 lightDir = trafficLightPos - v_worldPosition;
        float distance = length(lightDir);

        // Normalize the light direction
        lightDir = normalize(lightDir);

        // Simple attenuation based on distance
        float attenuation = 1.0 / (distance * distance);

        // Limit the influence to a certain radius
        float radius = 4.0;
        if (distance < radius) {
            // Diffuse component
            float diff = max(dot(normalVector, lightDir), 0.0);
            vec4 trafficDiffuse = trafficLightColor * u_diffuseColor * diff * attenuation;

            // Specular component
            vec3 halfDir = normalize(lightDir + cameraVector);
            float spec = pow(max(dot(normalVector, halfDir), 0.0), u_shininess);
            vec4 trafficSpecular = trafficLightColor * u_specularColor * spec * attenuation;

            // Add to total color
            totalColor += trafficDiffuse + trafficSpecular;
        }
    }

    outColor = totalColor;
}
