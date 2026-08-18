export const RASTER_VERTEX_SHADER = [
  '#version 300 es',
  'in vec2 a_position;',
  'in vec2 a_texCoord;',
  'out vec2 v_texCoord;',
  'void main() {',
  '  gl_Position = vec4(a_position, 0.0, 1.0);',
  '  v_texCoord = a_texCoord;',
  '}',
].join('\n');
export const RASTER_FRAGMENT_SHADER = [
  '#version 300 es',
  'precision highp float;',
  'uniform sampler2D u_texture;',
  'in vec2 v_texCoord;',
  'out vec4 outColor;',
  'void main() {',
  '  outColor = texture(u_texture, v_texCoord);',
  '}',
].join('\n');
