import fragmentShader from "./shaders/fragment.glsl";
import vertexShader from "./shaders/vertex.glsl";
import { useRef, useEffect } from "react";
import { throttle } from "lodash";

type ConfigType = {
  logoPath: string;
  logoSize: number;
  logoColor: string;
  canvasBg: string;
  distortionRadius: number;
  forceStrength: number;
  maxDisplacement: number;
  returnForce: number;
};

type ParticleType = {
  originalX: number;
  originalY: number;
  velocityX: number;
  velocityY: number;
};

const config: ConfigType = {
  logoPath: "/logo.png",
  logoSize: 350,
  logoColor: "#ffffff",
  canvasBg: "#141414",
  distortionRadius: 250,
  forceStrength: 0.0735,
  maxDisplacement: 150,
  returnForce: 0.085,
};

interface MousePosition {
  x: number;
  y: number;
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const particles = useRef<ParticleType[]>([]);
  const positionArray = useRef<Float32Array | null>(null);
  const colorArray = useRef<Float32Array | null>(null);
  const positionBuffer = useRef<WebGLBuffer | null>(null);
  const colorBuffer = useRef<WebGLBuffer | null>(null);
  const mouse = useRef<MousePosition>({ x: 0, y: 0 });
  const animationCount = useRef<number>(0);
  if (window.innerWidth < 600) {
    config.logoSize = 350;
  } else {
    config.logoSize = 450;
    config.distortionRadius = 450;
  }
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error("Canvas element is not available");
      return;
    }
    let gl: WebGLRenderingContext | null;
    try {
      gl = setUpGL(canvas);
      loadLogo();
      setupEvents();
    } catch (error) {
      console.error("WebGL setup failed:", error);
    }
    function setUpGL(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
      const gl = canvas.getContext("webgl", {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: true,
        powerPreference: "high-performance",
        premultipliedAlpha: false,
      });

      if (!gl) {
        console.error(
          "WebGL is not supported or canvas context could not be initialized"
        );
        return null;
      }

      glRef.current = gl;

      // Set canvas dimensions to match its CSS size
      const dpr: number = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Compile vertex and fragment shaders
      const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);

      // Create and link the WebGL program
      const program = gl.createProgram();
      if (!program) {
        throw new Error("Failed to create WebGL program");
      }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      programRef.current = program;
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
      }
      return gl;
    }
    // Compile shader function with error handling
    function compileShader(
      gl: WebGLRenderingContext,
      type: number,
      source: string
    ): WebGLShader {
      if (!gl) {
        throw new Error("WebGL context is not available");
      }

      const shader = gl.createShader(type);
      if (!shader) {
        throw new Error(`Failed to create shader of type ${type}`);
      }

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      // Check for compilation errors
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const infoLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${infoLog}`);
      }
      return shader;
    }
    function loadLogo() {
      const image = new Image();
      image.onload = function () {
        const tempCanvas = document.createElement("canvas");
        const ctx = tempCanvas.getContext("2d");
        tempCanvas.width = config.logoSize;
        tempCanvas.height = config.logoSize;

        const scale = 0.9;
        const size = config.logoSize * scale;
        const offset = (config.logoSize - size) / 2;
        ctx?.drawImage(image, offset, offset, size, size);

        const imageData = ctx?.getImageData(
          0,
          0,
          config.logoSize,
          config.logoSize
        );
        createParticles(imageData?.data);
      };
      image.src = config.logoPath;
    }
    function createParticles(pixels: Uint8ClampedArray | undefined) {
      if (!canvas || !pixels) throw new Error("Canvas is not defined");

      const centerX = canvas?.width / 2;
      const centerY = canvas?.height / 2;
      const positions = [];
      const colors = [];

      function hexToRGB(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16) / 255,
              g: parseInt(result[2], 16) / 255,
              b: parseInt(result[3], 16) / 255,
            }
          : { r: 1, g: 1, b: 1 };
      }
      const logoTint = hexToRGB(config.logoColor);
      for (let i = 0; i < config.logoSize; i += 2) {
        for (let j = 0; j < config.logoSize; j += 7) {
          const pixelIndex = (i * config.logoSize + j) * 4;
          const alpha = pixels[pixelIndex + 3];

          if (alpha > 10) {
            const particleX = centerX + (j - config.logoSize / 2) * 1;
            const particleY = centerY + (i - config.logoSize / 2) * 1;

            positions.push(particleX, particleY);

            const originalR = pixels[pixelIndex] / 255;
            const originalG = pixels[pixelIndex + 1] / 255;
            const originalB = pixels[pixelIndex + 2] / 255;
            const originalA = pixels[pixelIndex + 3] / 255;

            colors.push(
              originalR * logoTint.r,
              originalG * logoTint.g,
              originalB * logoTint.b,
              originalA
            );

            particles.current.push({
              originalX: particleX,
              originalY: particleY,
              velocityX: 0,
              velocityY: 0,
            });
          }
        }
      }
      positionArray.current = new Float32Array(positions);
      colorArray.current = new Float32Array(colors);
      createBuffers();
      animate();
    }
    function createBuffers() {
      if (!gl) throw new Error("Gl is not-defined");

      positionBuffer.current = gl?.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer.current);
      gl.bufferData(gl.ARRAY_BUFFER, positionArray.current, gl.DYNAMIC_DRAW);

      colorBuffer.current = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer.current);
      gl.bufferData(gl.ARRAY_BUFFER, colorArray.current, gl.STATIC_DRAW);
    }
    function animate() {
      const hasMovement: true | false = animationCount.current > 0;
      if (hasMovement) {
        updatePhysics();
      }
      render();
      requestAnimationFrame(animate);
    }
    function updatePhysics() {
      if (animationCount.current <= 0) return;

      animationCount.current--;
      const radiusSquared = config.distortionRadius * config.distortionRadius;

      if (!positionArray.current) throw new Error("positionArray is empty");
      for (let i = 0; i < particles.current.length; i++) {
        const particle = particles.current[i];
        const currentX = positionArray.current[i * 2];
        const currentY = positionArray.current[i * 2 + 1];

        const deltaX = mouse.current.x - currentX;
        const deltaY = mouse.current.y - currentY;
        const distanceSqured = deltaX * deltaX + deltaY * deltaY;

        if (distanceSqured < radiusSquared && distanceSqured > 0) {
          const force = -radiusSquared / distanceSqured;
          const angle = Math.atan2(deltaY, deltaX);
          const distFromOrigin = Math.sqrt(
            (currentX - particle.originalX) ** 2 +
              (currentY - particle.originalY) ** 2
          );
          const forceMutiplier = Math.max(
            0.1,
            1 - distFromOrigin / (config.maxDisplacement * 2)
          );
          particle.velocityX +=
            force * Math.cos(angle) * config.forceStrength * forceMutiplier;
          particle.velocityY +=
            force * Math.sin(angle) * config.forceStrength * forceMutiplier;
        }
        particle.velocityX *= 0.82;
        particle.velocityY *= 0.82;

        const targetX =
          currentX +
          particle.velocityX +
          (particle.originalX - currentX) * config.returnForce;
        const targetY =
          currentY +
          particle.velocityY +
          (particle.originalY - currentY) * config.returnForce;

        const offsetX = targetX - particle.originalX;
        const offsetY = targetY - particle.originalY;
        const distFromOrigin = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

        if (distFromOrigin > config.maxDisplacement) {
          const excess = distFromOrigin - config.maxDisplacement;
          const scale = config.maxDisplacement / distFromOrigin;
          const dampedScale = scale + (1 - scale) * Math.exp(-excess * 0.02);

          positionArray.current[i * 2] =
            particle.originalX + offsetX * dampedScale;
          positionArray.current[i * 2 + 1] =
            particle.originalY + offsetY * dampedScale;
          particle.velocityX *= 0.7;
          particle.velocityY *= 0.7;
        } else {
          positionArray.current[i * 2] = targetX;
          positionArray.current[i * 2 + 1] = targetY;
        }

        if (!gl) throw new Error("Gl is not defined");
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer.current);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, positionArray.current);
      }
    }
    function render() {
      if (!gl || !canvas || !programRef.current)
        throw new Error("Gl is not defined.");
      function hexToRGB(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
          ? {
              r: parseInt(result[1], 16) / 255,
              g: parseInt(result[2], 16) / 255,
              b: parseInt(result[3], 16) / 255,
            }
          : { r: 1, g: 1, b: 1 };
      }
      gl.viewport(0, 0, canvas?.width, canvas?.height);
      const bgColor = hexToRGB(config.canvasBg);
      gl.clearColor(bgColor.r, bgColor.g, bgColor.b, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (particles.current.length === 0) return;

      gl.useProgram(programRef.current);

      const resolutionLoc = gl.getUniformLocation(
        programRef.current,
        "u_resolution"
      );
      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer.current);
      const positionLoc = gl.getAttribLocation(
        programRef.current,
        "a_position"
      );
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer.current);
      const colorLoc = gl.getAttribLocation(programRef.current, "a_color");
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, particles.current.length);
    }
    function setupEvents() {
      if (!canvas) throw new Error("Canvas is not defined");
      const updateMouse = throttle((e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        mouse.current.x = (e.clientX - rect.left) * dpr;
        mouse.current.y = (e.clientY - rect.top) * dpr;
        animationCount.current = 400; // Reduced duration
      }, 6); // ~60 FPS
      document.addEventListener("mousemove", updateMouse);
    }
    (function resize() {
      let resizeTimeout: number;
      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout); // Prevent multiple reloads
        resizeTimeout = setTimeout(() => {
          location.reload();
        }, 50);
      });
    })();

    // Cleanup on component unmount
    return () => {
      if (gl && programRef.current) {
        gl.deleteProgram(programRef.current);
      }
    };
  }, []);

  return (
    <div>
      <canvas ref={canvasRef} className="w-full h-screen" />
    </div>
  );
};

export default App;
