import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import kMark from "@/assets/brand/kretopia-k-mark.png.asset.json";
import { dampKretoAngle, glideKretoTurn, KRETO_DRAG_SENSITIVITY } from "./kretoMotion";

export interface NetworkPerson { user_id: string; full_name: string; avatar_url: string | null; role: string | null }

/** Volumetric binoculars Kreto; accepted links only, with no relationship writes. */
export function KretoNetworkScene({ connections, onProfile }: { connections: NetworkPerson[]; onProfile: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const labels = useRef<Map<string, HTMLDivElement>>(new Map());
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const mount = host.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setFailed(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    // Locally generated studio reflections: no remote HDR, model transfer or paid generation.
    const environmentGenerator = new THREE.PMREMGenerator(renderer);
    const environmentRoom = new RoomEnvironment();
    const environmentTarget = environmentGenerator.fromScene(environmentRoom, 0.04);
    scene.environment = environmentTarget.texture;
    environmentRoom.dispose(); environmentGenerator.dispose();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(0, 0.45, 12);
    const css = getComputedStyle(mount);
    const color = (token: string) => new THREE.Color(css.getPropertyValue(token).trim().startsWith("#") ? css.getPropertyValue(token).trim() : `hsl(${css.getPropertyValue(token).trim().replace(/\s+/g, ", ")})`);
    const suit = new THREE.MeshPhysicalMaterial({ color: color("--qr-paper"), roughness: 0.3, metalness: 0.08, clearcoat: 0.8, envMapIntensity: 0.35 });
    const black = new THREE.MeshPhysicalMaterial({ color: color("--qr-ink"), roughness: 0.22, metalness: 0.12, clearcoat: 0.9, envMapIntensity: 0.3 });
    const trim = new THREE.MeshPhysicalMaterial({ color: color("--muted-foreground"), roughness: 0.22, metalness: 0.8, clearcoat: 1 });
    const pink = new THREE.MeshStandardMaterial({ color: color("--k-g-3"), emissive: color("--k-g-3"), emissiveIntensity: 1.2, roughness: 0.3 });
    const amber = new THREE.MeshStandardMaterial({ color: color("--k-g-4"), emissive: color("--k-g-4"), emissiveIntensity: 0.7 });
    const violet = new THREE.MeshStandardMaterial({ color: color("--k-g-1"), emissive: color("--k-g-1"), emissiveIntensity: 0.8 });
    scene.add(new THREE.HemisphereLight(color("--qr-paper"), color("--k-g-1"), 2.2));
    const key = new THREE.DirectionalLight(color("--qr-paper"), 4); key.position.set(3, 5, 5); scene.add(key);
    const rim = new THREE.PointLight(color("--k-g-3"), 20); rim.position.set(-3, 1, 2); scene.add(rim);
    const warm = new THREE.PointLight(color("--k-g-4"), 16); warm.position.set(3, 0, 1); scene.add(warm);
    const robot = new THREE.Group(); scene.add(robot);
    const upperBody = new THREE.Group(); robot.add(upperBody);
    // Every ball is the same unit sphere, scaled per use: one geometry shared by all ~18 body parts and up to 8
    // connection markers, instead of allocating (and later disposing) a fresh 40x28 SphereGeometry per mesh.
    const sphereGeometry = new THREE.SphereGeometry(1, 40, 28);
    const ball = (parent: THREE.Group, material: THREE.Material, scale: [number, number, number], position: [number, number, number]) => {
      const mesh = new THREE.Mesh(sphereGeometry, material); mesh.scale.set(...scale); mesh.position.set(...position); parent.add(mesh); return mesh;
    };
    // Rounded rectangular helmet and inset visor: the original silhouette is not an oval sphere.
    const shell = (parent: THREE.Group, material: THREE.Material, width: number, height: number, depth: number, radius: number, position: [number, number, number]) => {
      const x = -width / 2, y = -height / 2;
      const shape = new THREE.Shape();
      shape.moveTo(x + radius, y); shape.lineTo(x + width - radius, y);
      shape.quadraticCurveTo(x + width, y, x + width, y + radius);
      shape.lineTo(x + width, y + height - radius); shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      shape.lineTo(x + radius, y + height); shape.quadraticCurveTo(x, y + height, x, y + height - radius);
      shape.lineTo(x, y + radius); shape.quadraticCurveTo(x, y, x + radius, y);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 8, steps: 1, bevelSize: 0.09, bevelThickness: 0.09, curveSegments: 24 });
      geometry.translate(0, 0, -depth / 2); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh;
    };
    ball(upperBody, black, [0.5, 0.59, 0.4], [0, -0.23, 0]);
    ball(upperBody, suit, [0.56, 0.62, 0.47], [0, -0.15, 0.06]);
    ball(upperBody, black, [0.27, 0.14, 0.26], [0, 0.46, 0]);
    const head = new THREE.Group(); head.position.set(0, 1.08, 0); upperBody.add(head);
    shell(head, suit, 1.92, 1.42, 1.06, 0.64, [0, 0, -0.09]);
    shell(head, black, 1.7, 1.19, 0.12, 0.51, [0, -0.02, 0.5]);
    shell(head, black, 1.61, 1.1, 0.14, 0.49, [0, -0.02, 0.56]);
    const barrelGeometry = new THREE.CylinderGeometry(1, 1, 1, 48);
    const ringGeometry = new THREE.TorusGeometry(1, 0.065, 12, 64);
    const barrel = (parent: THREE.Group, material: THREE.Material, radius: number, length: number, position: [number, number, number]) => {
      const mesh = new THREE.Mesh(barrelGeometry, material); mesh.rotation.x = Math.PI / 2; mesh.scale.set(radius, length, radius); mesh.position.set(...position); parent.add(mesh); return mesh;
    };
    const ring = (parent: THREE.Group, material: THREE.Material, radius: number, position: [number, number, number]) => {
      const mesh = new THREE.Mesh(ringGeometry, material); mesh.scale.setScalar(radius); mesh.position.set(...position); parent.add(mesh);
    };
    const glassCanvas = document.createElement("canvas"); glassCanvas.width = glassCanvas.height = 256;
    const glassContext = glassCanvas.getContext("2d");
    if (glassContext) {
      const gradient = glassContext.createLinearGradient(0, 256, 256, 0);
      gradient.addColorStop(0, color("--k-g-4").getStyle()); gradient.addColorStop(0.24, color("--k-g-3").getStyle()); gradient.addColorStop(0.46, color("--qr-ink").getStyle()); gradient.addColorStop(0.74, color("--k-g-1").getStyle()); gradient.addColorStop(1, color("--qr-ink").getStyle());
      glassContext.fillStyle = gradient; glassContext.fillRect(0, 0, 256, 256);
      glassContext.fillStyle = color("--k-g-3").getStyle(); glassContext.globalAlpha = 0.35;
      glassContext.beginPath(); glassContext.ellipse(175, 75, 45, 65, -0.4, 0, Math.PI * 2); glassContext.fill();
    }
    const glassTexture = new THREE.CanvasTexture(glassCanvas); glassTexture.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.MeshPhysicalMaterial({ map: glassTexture, emissiveMap: glassTexture, emissive: color("--qr-paper"), emissiveIntensity: 0.28, metalness: 0.55, roughness: 0.12, clearcoat: 1 });
    const binoculars = new THREE.Group(); binoculars.position.set(0, -0.08, 0.9); head.add(binoculars);
    shell(binoculars, black, 0.55, 0.16, 0.3, 0.06, [0, 0.08, 0]);
    for (const side of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(side * 1.02, 0, 0); ear.rotation.y = side * Math.PI / 2; head.add(ear);
      barrel(ear, black, 0.37, 0.16, [0, 0, 0]); barrel(ear, side < 0 ? violet : amber, 0.32, 0.05, [0, 0, 0.1]);
      barrel(ear, black, 0.25, 0.065, [0, 0, 0.14]); ring(ear, side < 0 ? pink : amber, 0.31, [0, 0, 0.145]);
      const x = side * 0.39;
      barrel(binoculars, black, 0.33, 0.65, [x, 0, 0]);
      barrel(binoculars, trim, 0.347, 0.06, [x, 0, 0.33]);
      barrel(binoculars, black, 0.302, 0.045, [x, 0, 0.367]);
      ball(binoculars, glass, [0.274, 0.274, 0.065], [x, 0, 0.397]);
      ring(binoculars, trim, 0.3, [x, 0, 0.407]);
      ball(binoculars, suit, [0.036, 0.065, 0.014], [x - 0.08, 0.12, 0.46]);
      // Raised segmented arms, gloves wrapped around the two optical barrels.
      ball(upperBody, black, [0.21, 0.23, 0.23], [side * 0.57, 0.16, 0]);
      const upper = ball(upperBody, suit, [0.23, 0.32, 0.26], [side * 0.73, 0.13, 0.23]); upper.rotation.z = side * 0.62;
      ball(upperBody, black, [0.23, 0.21, 0.24], [side * 0.85, 0.27, 0.43]);
      const forearm = ball(upperBody, suit, [0.24, 0.42, 0.27], [side * 0.8, 0.59, 0.64]); forearm.rotation.z = -side * 0.25;
      ball(upperBody, black, [0.235, 0.27, 0.25], [side * 0.69, 0.93, 0.85]);
      for (let finger = 0; finger < 3; finger++) ball(upperBody, black, [0.07, 0.145, 0.105], [side * (0.55 + finger * 0.075), 1.055, 1.02]);
      ball(robot, black, [0.21, 0.22, 0.24], [side * 0.31, -0.65, 0]);
      const leg = ball(robot, suit, [0.29, 0.48, 0.33], [side * 0.4, -1.04, 0.04]); leg.rotation.z = -side * 0.22;
      ball(robot, black, [0.3, 0.22, 0.37], [side * 0.5, -1.4, 0.15]);
    }
    const logoMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.38), logoMaterial); logo.position.set(0, -0.05, 0.527); upperBody.add(logo);
    let disposed = false;
    new THREE.TextureLoader().load(kMark.url, texture => { if (disposed) { texture.dispose(); return; } texture.colorSpace = THREE.SRGBColorSpace; logoMaterial.map = texture; logoMaterial.needsUpdate = true; });
    const graph = new THREE.Group(); scene.add(graph);
    const people = connections.slice(0, 8);
    const positions = people.map((_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      return new THREE.Vector3(side * (2.4 + (row % 2) * 0.12), 2.1 - row * 1.4, -0.3);
    });
    const arcs: THREE.Line[] = [];
    positions.forEach((position, index) => {
      ball(graph, index % 2 ? amber : pink, [0.05, 0.05, 0.05], [position.x, position.y, position.z]);
      const origin = new THREE.Vector3(0, -0.1, -0.4);
      const points = Array.from({ length: 20 }, (_, step) => {
        const t = step / 19;
        const point = origin.clone().lerp(position, t);
        point.y += Math.sin(t * Math.PI) * Math.sin(step * 2.1) * 0.07;
        return point;
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: color(index % 2 ? "--k-g-4" : "--k-g-3"), transparent: true, opacity: 0.4 })); graph.add(line); arcs.push(line);
    });
    const resize = () => { const width = mount.clientWidth; const height = mount.clientHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.position.z = width < 550 ? 14 : 10.5; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0; let visible = true; let yaw = 0.48; let targetYaw = 0.48; let pitch = 0; let targetPitch = 0; let dragging = false;
    let previousX = 0; let previousY = 0; let previousMove = 0; let turnVelocity = 0; let lastFrame = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (now: number) => {
      if (!visible) return;
      const seconds = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 1 / 60; lastFrame = now;
      if (!dragging && !reduce.matches) {
        const glide = glideKretoTurn(turnVelocity, seconds); targetYaw += glide.distance; turnVelocity = glide.velocity;
      }
      yaw = dampKretoAngle(yaw, targetYaw, seconds); pitch = dampKretoAngle(pitch, targetPitch, seconds);
      robot.rotation.y = yaw; robot.rotation.x = pitch;
      // Feet stay planted; the complete upper assembly breathes/sways so gloves never detach from the optics.
      upperBody.position.y = reduce.matches ? 0 : Math.sin(now * 0.0016) * 0.012;
      upperBody.rotation.z = reduce.matches ? 0 : Math.sin(now * 0.0007) * 0.012;
      upperBody.rotation.y = reduce.matches || dragging ? 0 : Math.sin(now * 0.00045) * 0.018;
      arcs.forEach((line, i) => { const material = line.material as THREE.LineBasicMaterial; material.opacity = reduce.matches ? 0.4 : 0.3 + 0.25 * Math.max(0, Math.sin(now * 0.001 - i * 0.8)); });
      renderer.render(scene, camera);
      mount.dataset.sceneReady = "true";
      positions.forEach((position, i) => { const element = labels.current.get(people[i].user_id); if (!element) return; const screen = position.clone().project(camera); element.style.left = `${(screen.x + 1) * 50}%`; element.style.top = `${(1 - screen.y) * 50}%`; });
      frame = requestAnimationFrame(draw);
    };
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; cancelAnimationFrame(frame); lastFrame = 0; if (visible) frame = requestAnimationFrame(draw); }); intersection.observe(mount);
    const down = (e: PointerEvent) => { if (!e.isPrimary || e.button !== 0) return; dragging = true; turnVelocity = 0; previousX = e.clientX; previousY = e.clientY; previousMove = e.timeStamp; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging || !e.isPrimary) return;
      const distance = (e.clientX - previousX) * KRETO_DRAG_SENSITIVITY;
      targetYaw += distance;
      if (e.pointerType !== "touch") targetPitch = THREE.MathUtils.clamp(targetPitch + (e.clientY - previousY) * 0.004, -0.25, 0.25);
      turnVelocity = THREE.MathUtils.clamp(distance / Math.max((e.timeStamp - previousMove) / 1000, 0.016), -3, 3);
      previousX = e.clientX; previousY = e.clientY; previousMove = e.timeStamp;
    };
    const up = (e: PointerEvent) => { if (!e.isPrimary) return; dragging = false; if (e.timeStamp - previousMove > 100 || e.type === "pointercancel") turnVelocity = 0; };
    const keydown = (e: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(e.key)) return;
      e.preventDefault(); turnVelocity = 0;
      if (e.key === "Home") reset.current();
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") targetYaw += e.key === "ArrowLeft" ? -0.22 : 0.22;
      else targetPitch = THREE.MathUtils.clamp(targetPitch + (e.key === "ArrowUp" ? -0.05 : 0.05), -0.25, 0.25);
    };
    reset.current = () => { targetYaw = 0.48; targetPitch = 0; turnVelocity = 0; };
    renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute("role", "img"); renderer.domElement.setAttribute("aria-label", "Kreto with binoculars, interactive 360 degree view");
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", up);
    renderer.domElement.addEventListener("keydown", keydown);
    frame = requestAnimationFrame(draw);
    return () => { disposed = true; delete mount.dataset.sceneReady; cancelAnimationFrame(frame); intersection.disconnect(); observer.disconnect(); const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>(); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { geometries.add(object.geometry); (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); } }); geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); environmentTarget.dispose(); glassTexture.dispose(); logoMaterial.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
  }, [connections]);
  return <div className="relative h-[390px] w-full min-w-0 overflow-hidden sm:h-[420px]" ref={host} role="region" aria-label="Kreto 3D connection map">
    {failed && <div className="absolute inset-0 flex items-center justify-center"><BrandLogo size="lg" iconOnly /></div>}
    {connections.slice(0, 8).map(person => <div key={person.user_id} ref={el => { if (el) labels.current.set(person.user_id, el); else labels.current.delete(person.user_id); }} className="absolute left-1/2 top-1/2 max-w-[106px] -translate-x-1/2 -translate-y-1/2">
      <Button variant="ghost" onClick={() => onProfile(person.user_id)} className="h-auto max-w-full flex-col gap-1 rounded-lg bg-background/85 p-2 backdrop-blur-sm" aria-label={`View ${person.full_name}'s Passport`}>
        <Avatar className="h-9 w-9 border border-border"><AvatarImage src={person.avatar_url || undefined} alt="" /><AvatarFallback>{person.full_name[0]}</AvatarFallback></Avatar>
        <span className="max-w-full truncate text-[10px] font-semibold">{person.full_name}</span>
      </Button>
    </div>)}
    <Button variant="ghost" size="icon" className="absolute bottom-2 right-2" aria-label="Reset Kreto view" title="Reset view" onClick={() => reset.current()}><RotateCcw className="h-4 w-4" /></Button>
  </div>;
}