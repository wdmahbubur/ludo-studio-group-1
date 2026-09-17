/** Authored GLSL. The board uses this ShaderMaterial, not a renamed built-in material.
 * The r140 shadow chunks supply shadow coordinates/sampling; all surface lighting,
 * texture cross-fade, varnish specular highlight, and turn pulse below are explicit.
 */
export const boardVertexShader = /* glsl */ `
  varying vec2 vBoardUv;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;
  #include <common>
  #include <shadowmap_pars_vertex>
  void main() {
    vBoardUv = uv;
    vec3 transformedNormal = normalMatrix * normal;
    vViewNormal = normalize(transformedNormal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = mvPosition.xyz;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    #include <shadowmap_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`;
export const boardFragmentShader = /* glsl */ `
  uniform sampler2D uPreviousMap;
  uniform sampler2D uMap;
  uniform float uMix;
  uniform float uTime;
  uniform float uLightPower;
  uniform float uActivePlayer;
  uniform vec3 uLightDirection;
  varying vec2 vBoardUv;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;
  #include <common>
  #include <packing>
  #include <lights_pars_begin>
  #include <shadowmap_pars_fragment>
  #include <shadowmask_pars_fragment>
  vec3 decodeSRGB(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
  void main() {
    vec3 oldColor = decodeSRGB(texture2D(uPreviousMap, vBoardUv).rgb);
    vec3 newColor = decodeSRGB(texture2D(uMap, vBoardUv).rgb);
    vec3 albedo = mix(oldColor, newColor, smoothstep(0.0, 1.0, uMix));
    vec3 N = normalize(vViewNormal);
    vec3 L = normalize(uLightDirection);
    vec3 V = normalize(-vViewPosition);
    vec3 H = normalize(L + V);
    float diffuse = max(dot(N, L), 0.0);
    float specular = pow(max(dot(N, H), 0.0), 72.0) * 0.065 * step(0.0, dot(N,L));
    float shadow = mix(0.48, 1.0, getShadowMask());
    vec2 q = vBoardUv;
    float quadrant = q.y > 0.60 ? (q.x < 0.40 ? 0.0 : 1.0) : (q.x > 0.60 ? 2.0 : 3.0);
    float inYard = float((q.x < 0.4 || q.x > 0.6) && (q.y < 0.4 || q.y > 0.6));
    float pulse = inYard * (1.0 - step(0.1, abs(quadrant-uActivePlayer))) * (0.012 + 0.008*sin(uTime*2.0));
    vec3 lit = albedo * (0.62 + uLightPower*0.62*diffuse*shadow) + specular*uLightPower*shadow + pulse*albedo;
    gl_FragColor = vec4(lit, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }
`;
