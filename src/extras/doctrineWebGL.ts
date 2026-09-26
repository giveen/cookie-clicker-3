/* doctrineWebGL.ts — High-fidelity WebGL 3D sphere renderer for the Doctrine Solar System.
 * Wraps equirectangular world textures from public/img/doctrineWorlds.webp onto
 * celestial spheres (Sun, 13 planets, 26 moons) with directional solar lighting,
 * atmospheric Fresnel rim glow, continuous axial rotation, and camera synchronization.
 * Zero external dependencies: pure native WebGL 1.0 / 2.0 compatible. */

export interface DoctrineBody {
	id: string | number;
	x: number;
	y: number;
	z: number;
	radius: number;
	cellIndex: number;
	spinSpeed?: number | undefined;
	axialTilt?: number | undefined;
	isSun?: boolean | undefined;
	branchColor?: [number, number, number] | undefined;
	opacity?: number | undefined;
	orbitCenter?: { x: number; y: number; z: number } | undefined;
	orbitRadius?: number | undefined;
	orbitPeriod?: number | undefined;
	baseAngle?: number | undefined;
	inclination?: number | undefined;
	parentPlanetId?: number | undefined;
}

export interface DoctrineCameraState {
	rotX: number;
	rotZ: number;
	zoom: number;
	panX: number;
	panY: number;
	activePlanetId?: number | null | undefined;
}

export interface DoctrineWebGLRenderer {
	canvas: HTMLCanvasElement;
	setCamera(camera: DoctrineCameraState): void;
	setBodies(bodies: DoctrineBody[]): void;
	setOrbitRadii(radii: number[]): void;
	resize(): void;
	start(): void;
	stop(): void;
	destroy(): void;
}

/** UV Sphere mesh data. */
interface SphereGeometry {
	vertexBuffer: WebGLBuffer;
	normalBuffer: WebGLBuffer;
	uvBuffer: WebGLBuffer;
	indexBuffer: WebGLBuffer;
	indexCount: number;
}

/** Generate a UV Sphere mesh of radius 1 centered at origin. */
function createSphereGeometry(gl: WebGLRenderingContext, rings: number = 32, segments: number = 32): SphereGeometry | null {
	const vertexCount = (rings + 1) * (segments + 1);
	const positions = new Float32Array(vertexCount * 3);
	const normals = new Float32Array(vertexCount * 3);
	const uvs = new Float32Array(vertexCount * 2);

	let vIdx = 0;
	let uvIdx = 0;

	for (let r = 0; r <= rings; r++) {
		const v = r / rings;
		const theta = v * Math.PI; // 0 (North Pole, +Z) to PI (South Pole, -Z)
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);

		for (let s = 0; s <= segments; s++) {
			const u = s / segments;
			const phi = u * 2 * Math.PI; // 0 to 2*PI longitude
			const sinPhi = Math.sin(phi);
			const cosPhi = Math.cos(phi);

			// Celestial coordinate system: Z is polar axis, XY is orbital plane
			const x = sinTheta * cosPhi;
			const y = sinTheta * sinPhi;
			const z = cosTheta;

			positions[vIdx] = x;
			positions[vIdx + 1] = y;
			positions[vIdx + 2] = z;

			normals[vIdx] = x;
			normals[vIdx + 1] = y;
			normals[vIdx + 2] = z;

			uvs[uvIdx] = u;
			uvs[uvIdx + 1] = v;

			vIdx += 3;
			uvIdx += 2;
		}
	}

	const indexCount = rings * segments * 6;
	const indices = new Uint16Array(indexCount);
	let iIdx = 0;

	for (let r = 0; r < rings; r++) {
		for (let s = 0; s < segments; s++) {
			const first = r * (segments + 1) + s;
			const second = first + segments + 1;

			indices[iIdx++] = first;
			indices[iIdx++] = second;
			indices[iIdx++] = first + 1;

			indices[iIdx++] = second;
			indices[iIdx++] = second + 1;
			indices[iIdx++] = first + 1;
		}
	}

	const vertexBuffer = gl.createBuffer();
	const normalBuffer = gl.createBuffer();
	const uvBuffer = gl.createBuffer();
	const indexBuffer = gl.createBuffer();

	if (!vertexBuffer || !normalBuffer || !uvBuffer || !indexBuffer) return null;

	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

	return {
		vertexBuffer,
		normalBuffer,
		uvBuffer,
		indexBuffer,
		indexCount,
	};
}

interface RingGeometry {
	vertexBuffer: WebGLBuffer;
	vertexCount: number;
}

function createCircleGeometry(gl: WebGLRenderingContext, segments: number = 96): RingGeometry | null {
	const positions = new Float32Array(segments * 3);
	for (let i = 0; i < segments; i++) {
		const theta = (i / segments) * 2 * Math.PI;
		positions[i * 3] = Math.cos(theta);
		positions[i * 3 + 1] = Math.sin(theta);
		positions[i * 3 + 2] = 0;
	}
	const vertexBuffer = gl.createBuffer();
	if (!vertexBuffer) return null;
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	return { vertexBuffer, vertexCount: segments };
}

const LINE_VERTEX_SHADER_SRC = `
attribute vec3 a_position;
uniform vec3 u_center;
uniform float u_radius;
uniform float u_rotZ;
uniform float u_rotX;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_canvasSize;
uniform float u_perspective;

void main() {
    vec3 worldPos = u_center + a_position * u_radius;

    float cosZ = cos(u_rotZ);
    float sinZ = sin(u_rotZ);
    float x1 = worldPos.x * cosZ - worldPos.y * sinZ;
    float y1 = worldPos.x * sinZ + worldPos.y * cosZ;
    float z1 = worldPos.z;

    float cosX = cos(u_rotX);
    float sinX = sin(u_rotX);
    float x2 = x1;
    float y2 = y1 * cosX - z1 * sinX;
    float z2 = y1 * sinX + z1 * cosX;

    float x3 = x2 * u_zoom + u_pan.x;
    float y3 = y2 * u_zoom + u_pan.y;
    float z3 = z2 * u_zoom;

    float w = 1.0 - z3 / u_perspective;
    if (w < 0.001) w = 0.001;

    float ndcX = (x3 / (u_canvasSize.x * 0.5)) / w;
    float ndcY = (-y3 / (u_canvasSize.y * 0.5)) / w;
    float ndcZ = clamp(z3 / 3000.0, -0.99, 0.99);

    gl_Position = vec4(ndcX * w, ndcY * w, -ndcZ * w, w);
}
`;

const LINE_FRAGMENT_SHADER_SRC = `
precision mediump float;
uniform vec4 u_lineColor;
void main() {
    gl_FragColor = u_lineColor;
}
`;

const VERTEX_SHADER_SRC = `
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;

uniform vec3 u_center;
uniform float u_radius;
uniform float u_rotZ;
uniform float u_rotX;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_canvasSize;
uniform float u_perspective;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_lightDir;

void main() {
    v_uv = a_uv;

    vec3 localNorm = a_normal;
    vec3 localPos = a_position * u_radius;
    vec3 worldPos = u_center + localPos;

    // 1. Yaw rotation (rotZ around Z axis)
    float cosZ = cos(u_rotZ);
    float sinZ = sin(u_rotZ);
    float x1 = worldPos.x * cosZ - worldPos.y * sinZ;
    float y1 = worldPos.x * sinZ + worldPos.y * cosZ;
    float z1 = worldPos.z;

    float nx1 = localNorm.x * cosZ - localNorm.y * sinZ;
    float ny1 = localNorm.x * sinZ + localNorm.y * cosZ;
    float nz1 = localNorm.z;

    // 2. Pitch rotation (rotX around X axis)
    float cosX = cos(u_rotX);
    float sinX = sin(u_rotX);
    float x2 = x1;
    float y2 = y1 * cosX - z1 * sinX;
    float z2 = y1 * sinX + z1 * cosX;

    float nx2 = nx1;
    float ny2 = ny1 * cosX - nz1 * sinX;
    float nz2 = ny1 * sinX + nz1 * cosX;

    v_normal = normalize(vec3(nx2, ny2, nz2));

    // 3. Viewport pan and zoom
    float x3 = x2 * u_zoom + u_pan.x;
    float y3 = y2 * u_zoom + u_pan.y;
    float z3 = z2 * u_zoom;

    // Light direction towards Sun at (0, 0, 0)
    vec3 sunPos = vec3(u_pan.x, u_pan.y, 0.0);
    v_lightDir = normalize(sunPos - vec3(x3, y3, z3));

    // 4. Perspective projection matching CSS perspective: 1000px
    float w = 1.0 - z3 / u_perspective;
    if (w < 0.001) w = 0.001;

    float ndcX = (x3 / (u_canvasSize.x * 0.5)) / w;
    float ndcY = (-y3 / (u_canvasSize.y * 0.5)) / w;
    float ndcZ = clamp(z3 / 3000.0, -0.99, 0.99);

    gl_Position = vec4(ndcX * w, ndcY * w, -ndcZ * w, w);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;

uniform sampler2D u_texture;
uniform vec2 u_cellOffset;
uniform vec2 u_cellSize;
uniform float u_spin;
uniform float u_isSun;
uniform vec3 u_branchColor;
uniform float u_opacity;

varying vec2 v_uv;
varying vec3 v_normal;
varying vec3 v_lightDir;

void main() {
    float uWrap = fract(v_uv.x + u_spin);
    float uClamped = clamp(uWrap, 0.0015, 0.9985);
    float vClamped = clamp(v_uv.y, 0.003, 0.997);

    vec2 texCoord = u_cellOffset + vec2(uClamped, vClamped) * u_cellSize;
    vec4 texColor = texture2D(u_texture, texCoord);

    vec3 normal = normalize(v_normal);
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    if (u_isSun > 0.5) {
        vec3 sunColor = texColor.rgb * 1.35 + vec3(0.25, 0.18, 0.05);
        float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        sunColor += vec3(1.0, 0.85, 0.4) * rim * 0.85;
        gl_FragColor = vec4(sunColor, u_opacity);
        return;
    }

    vec3 lightDir = normalize(v_lightDir);
    float diff = max(dot(normal, lightDir), 0.0);
    float ambient = 0.32;
    float lighting = ambient + diff * 0.82;

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfVec), 0.0), 16.0) * 0.35 * diff;

    vec3 litColor = texColor.rgb * lighting + vec3(spec);
    litColor += u_branchColor * (fresnel * 0.72);

    gl_FragColor = vec4(litColor, u_opacity * texColor.a);
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
	const shader = gl.createShader(type);
	if (!shader) return null;
	gl.shaderSource(shader, src);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.warn('Doctrine WebGL compile error:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
	if (!vs || !fs) return null;

	const prog = gl.createProgram();
	if (!prog) return null;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);

	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.warn('Doctrine WebGL link error:', gl.getProgramInfoLog(prog));
		gl.deleteProgram(prog);
		return null;
	}
	return prog;
}

/** Create and manage the WebGL 3D celestial renderer for Doctrine. */
export function initDoctrineWebGL(container: HTMLElement): DoctrineWebGLRenderer | null {
	const canvas = document.createElement('canvas');
	canvas.id = 'doctrineWebGLCanvas';
	canvas.style.cssText =
		'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';

	container.insertBefore(canvas, container.firstChild);

	const gl = (canvas.getContext('webgl', { alpha: true, antialias: true }) ||
		canvas.getContext('experimental-webgl', { alpha: true, antialias: true })) as WebGLRenderingContext | null;

	if (!gl) {
		canvas.remove();
		return null;
	}
	const ctx: WebGLRenderingContext = gl;

	const program = createProgram(gl, VERTEX_SHADER_SRC, FRAGMENT_SHADER_SRC);
	if (!program) {
		canvas.remove();
		return null;
	}

	const sphere = createSphereGeometry(gl, 32, 32);
	if (!sphere) {
		canvas.remove();
		return null;
	}

	// Shader attribute locations
	const aPosition = gl.getAttribLocation(program, 'a_position');
	const aNormal = gl.getAttribLocation(program, 'a_normal');
	const aUv = gl.getAttribLocation(program, 'a_uv');

	// Shader uniform locations
	const uCenter = gl.getUniformLocation(program, 'u_center');
	const uRadius = gl.getUniformLocation(program, 'u_radius');
	const uRotZ = gl.getUniformLocation(program, 'u_rotZ');
	const uRotX = gl.getUniformLocation(program, 'u_rotX');
	const uZoom = gl.getUniformLocation(program, 'u_zoom');
	const uPan = gl.getUniformLocation(program, 'u_pan');
	const uCanvasSize = gl.getUniformLocation(program, 'u_canvasSize');
	const uPerspective = gl.getUniformLocation(program, 'u_perspective');
	const uTexture = gl.getUniformLocation(program, 'u_texture');
	const uCellOffset = gl.getUniformLocation(program, 'u_cellOffset');
	const uCellSize = gl.getUniformLocation(program, 'u_cellSize');
	const uSpin = gl.getUniformLocation(program, 'u_spin');
	const uIsSun = gl.getUniformLocation(program, 'u_isSun');
	const uBranchColor = gl.getUniformLocation(program, 'u_branchColor');
	const uOpacity = gl.getUniformLocation(program, 'u_opacity');

	// Create 1x1 initial fallback texture
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texImage2D(
		gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0,
		gl.RGBA, gl.UNSIGNED_BYTE,
		new Uint8Array([218, 165, 32, 255])
	);

	// Load master spritesheet
	const img = new Image();
	img.crossOrigin = 'anonymous';
	img.src = 'img/doctrineWorlds.webp';
	img.onload = function () {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	};

	// Compile line program and geometry for 3D celestial orbit tracks
	const lineProgram = createProgram(gl, LINE_VERTEX_SHADER_SRC, LINE_FRAGMENT_SHADER_SRC);
	const circleRing = lineProgram ? createCircleGeometry(gl, 96) : null;

	const lineAttrPosition = lineProgram ? gl.getAttribLocation(lineProgram, 'a_position') : -1;
	const lineUCenter = lineProgram ? gl.getUniformLocation(lineProgram, 'u_center') : null;
	const lineURadius = lineProgram ? gl.getUniformLocation(lineProgram, 'u_radius') : null;
	const lineURotZ = lineProgram ? gl.getUniformLocation(lineProgram, 'u_rotZ') : null;
	const lineURotX = lineProgram ? gl.getUniformLocation(lineProgram, 'u_rotX') : null;
	const lineUZoom = lineProgram ? gl.getUniformLocation(lineProgram, 'u_zoom') : null;
	const lineUPan = lineProgram ? gl.getUniformLocation(lineProgram, 'u_pan') : null;
	const lineUCanvasSize = lineProgram ? gl.getUniformLocation(lineProgram, 'u_canvasSize') : null;
	const lineUPerspective = lineProgram ? gl.getUniformLocation(lineProgram, 'u_perspective') : null;
	const lineULineColor = lineProgram ? gl.getUniformLocation(lineProgram, 'u_lineColor') : null;

	let orbitRadii: number[] = [];

	let camera: DoctrineCameraState = {
		rotX: 58,
		rotZ: 0,
		zoom: 1,
		panX: 0,
		panY: 0,
		activePlanetId: null,
	};

	let bodies: DoctrineBody[] = [];
	let rafId: number | null = null;
	let isRunning = false;

	function resize(): void {
		const w = container.clientWidth || 800;
		const h = container.clientHeight || 600;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const pxW = Math.round(w * dpr);
		const pxH = Math.round(h * dpr);

		if (canvas.width !== pxW || canvas.height !== pxH) {
			canvas.width = pxW;
			canvas.height = pxH;
		}
		ctx.viewport(0, 0, canvas.width, canvas.height);
	}

	function render(timestamp: number): void {
		if (!gl || !sphere) return;

		const timeSec = timestamp / 1000;
		const w = container.clientWidth || 800;
		const h = container.clientHeight || 600;

		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Shared camera rotation angles in radians
		const radX = (camera.rotX * Math.PI) / 180;
		const radZ = (camera.rotZ * Math.PI) / 180;
		const inOrbital = camera.activePlanetId !== null && camera.activePlanetId !== undefined;

		// 1. Calculate live positions for all celestial bodies (planets around Sun, moons around planets)
		const positions = new Map<string | number, { x: number; y: number; z: number }>();
		for (let i = 0; i < bodies.length; i++) {
			const b = bodies[i]!;
			let posX = b.x;
			let posY = b.y;
			let posZ = b.z;

			if (b.orbitRadius && b.orbitPeriod) {
				let center = b.orbitCenter || { x: 0, y: 0, z: 0 };
				if (b.parentPlanetId !== undefined && positions.has(b.parentPlanetId)) {
					center = positions.get(b.parentPlanetId)!;
				}
				const angle = (b.baseAngle || 0) + (2 * Math.PI * (timeSec % b.orbitPeriod)) / b.orbitPeriod;
				const inc = b.inclination || 0;
				posX = center.x + b.orbitRadius * Math.cos(angle);
				posY = center.y + b.orbitRadius * Math.sin(angle) * Math.cos(inc);
				posZ = center.z + b.orbitRadius * Math.sin(angle) * Math.sin(inc);
			}

			positions.set(b.id, { x: posX, y: posY, z: posZ });
		}

		// 2. Render 3D orbit rings cleanly in WebGL (avoids CSS 3D perspective Skia clipping artifacts)
		if (lineProgram && circleRing) {
			gl.useProgram(lineProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, circleRing.vertexBuffer);
			gl.enableVertexAttribArray(lineAttrPosition);
			gl.vertexAttribPointer(lineAttrPosition, 3, gl.FLOAT, false, 0, 0);

			gl.uniform1f(lineURotX, radX);
			gl.uniform1f(lineURotZ, radZ);
			gl.uniform1f(lineUZoom, camera.zoom);
			gl.uniform2f(lineUPan, camera.panX, camera.panY);
			gl.uniform2f(lineUCanvasSize, w, h);
			gl.uniform1f(lineUPerspective, 1000.0);

			// Draw the 4 celestial tier orbit rings around Sun (0, 0, 0)
			const ringColors: [number, number, number, number][] = [
				[1.0, 0.85, 0.35, 0.22],
				[0.35, 0.75, 1.0, 0.22],
				[0.85, 0.5, 1.0, 0.22],
				[0.4, 1.0, 0.7, 0.22],
			];
			gl.uniform3f(lineUCenter, 0, 0, 0);
			for (let rIdx = 0; rIdx < orbitRadii.length; rIdx++) {
				const r = orbitRadii[rIdx]!;
				const c = ringColors[rIdx] || [1.0, 1.0, 1.0, 0.15];
				gl.uniform1f(lineURadius, r);
				gl.uniform4f(lineULineColor, c[0], c[1], c[2], inOrbital ? c[3] * 0.2 : c[3]);
				gl.drawArrays(gl.LINE_LOOP, 0, circleRing.vertexCount);
			}

			// Draw moon orbit rings around each parent planet
			const drawnMoonRings = new Set<string>();
			for (let i = 0; i < bodies.length; i++) {
				const b = bodies[i]!;
				if (b.orbitRadius && b.parentPlanetId !== undefined) {
					const ringKey = b.parentPlanetId + '-' + b.orbitRadius;
					if (drawnMoonRings.has(ringKey)) continue;
					drawnMoonRings.add(ringKey);

					const parentPos = positions.get(b.parentPlanetId);
					if (parentPos) {
						gl.uniform3f(lineUCenter, parentPos.x, parentPos.y, parentPos.z);
						gl.uniform1f(lineURadius, b.orbitRadius);
						const isTargetParent = camera.activePlanetId === b.parentPlanetId;
						const alpha = inOrbital ? (isTargetParent ? 0.45 : 0.03) : 0.15;
						gl.uniform4f(lineULineColor, 1.0, 1.0, 1.0, alpha);
						gl.drawArrays(gl.LINE_LOOP, 0, circleRing.vertexCount);
					}
				}
			}
		}

		// 3. Render each textured celestial body
		gl.useProgram(program);

		// Bind vertex geometry buffers
		gl.bindBuffer(gl.ARRAY_BUFFER, sphere.vertexBuffer);
		gl.enableVertexAttribArray(aPosition);
		gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, sphere.normalBuffer);
		gl.enableVertexAttribArray(aNormal);
		gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, sphere.uvBuffer);
		gl.enableVertexAttribArray(aUv);
		gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sphere.indexBuffer);

		gl.uniform1f(uRotX, radX);
		gl.uniform1f(uRotZ, radZ);
		gl.uniform1f(uZoom, camera.zoom);
		gl.uniform2f(uPan, camera.panX, camera.panY);
		gl.uniform2f(uCanvasSize, w, h);
		gl.uniform1f(uPerspective, 1000.0);

		// Active texture unit
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.uniform1i(uTexture, 0);

		// 4 columns, 6 rows spritesheet cell sizing
		const cellW = 1.0 / 4.0;
		const cellH = 1.0 / 6.0;
		gl.uniform2f(uCellSize, cellW, cellH);

		for (let i = 0; i < bodies.length; i++) {
			const b = bodies[i]!;

			// Orbital view focus fading
			let bodyOpacity = b.opacity ?? 1.0;
			if (inOrbital) {
				const isTarget = b.id === camera.activePlanetId ||
					(typeof b.id === 'string' && b.id.startsWith(camera.activePlanetId + '-'));
				if (!isTarget) {
					bodyOpacity *= 0.05;
				}
			}

			if (bodyOpacity < 0.01) continue;

			const pos = positions.get(b.id) || { x: b.x, y: b.y, z: b.z };

			gl.uniform3f(uCenter, pos.x, pos.y, pos.z);
			gl.uniform1f(uRadius, b.radius);

			// Cell UV offset in 4x6 grid
			const col = b.cellIndex % 4;
			const row = Math.floor(b.cellIndex / 4);
			gl.uniform2f(uCellOffset, col * cellW, row * cellH);

			// Axial spin: continuous rotation around polar axis
			const speed = b.spinSpeed ?? (b.isSun ? 0.012 : 0.035 + (b.cellIndex % 5) * 0.008);
			const spin = (timeSec * speed) % 1.0;
			gl.uniform1f(uSpin, spin);

			gl.uniform1f(uIsSun, b.isSun ? 1.0 : 0.0);

			const bc = b.branchColor ?? [0.8, 0.8, 0.9];
			gl.uniform3f(uBranchColor, bc[0], bc[1], bc[2]);
			gl.uniform1f(uOpacity, bodyOpacity);

			gl.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
		}

		if (isRunning) {
			rafId = requestAnimationFrame(render);
		}
	}

	function start(): void {
		if (isRunning) return;
		isRunning = true;
		resize();
		rafId = requestAnimationFrame(render);
	}

	function stop(): void {
		isRunning = false;
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function destroy(): void {
		stop();
		if (sphere) {
			ctx.deleteBuffer(sphere.vertexBuffer);
			ctx.deleteBuffer(sphere.normalBuffer);
			ctx.deleteBuffer(sphere.uvBuffer);
			ctx.deleteBuffer(sphere.indexBuffer);
		}
		if (circleRing) {
			ctx.deleteBuffer(circleRing.vertexBuffer);
		}
		if (texture) {
			ctx.deleteTexture(texture);
		}
		if (program) {
			ctx.deleteProgram(program);
		}
		if (lineProgram) {
			ctx.deleteProgram(lineProgram);
		}
		canvas.remove();
	}

	resize();

	return {
		canvas,
		setCamera(nextCamera: DoctrineCameraState): void {
			camera = { ...nextCamera };
		},
		setBodies(nextBodies: DoctrineBody[]): void {
			bodies = [...nextBodies];
		},
		setOrbitRadii(radii: number[]): void {
			orbitRadii = [...radii];
		},
		resize,
		start,
		stop,
		destroy,
	};
}
