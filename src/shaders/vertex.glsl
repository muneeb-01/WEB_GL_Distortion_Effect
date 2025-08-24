precision highp float;
uniform vec2 u_resolution;
attribute vec2 a_position;
attribute vec4 a_color;
varying vec4 v_color;

void main(){
    vec2 zeroToOne = a_position / u_resolution;
    vec2 clipSpace = (zeroToOne * 2.0 - 1.0);
    v_color = a_color;
    gl_Position = vec4(clipSpace* vec2(1.0,-1.0),0.0,1.0);
    gl_PointSize = 3.5;
}