import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RotateCcw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import kMark from "@/assets/brand/kretopia-k-mark.png.asset.json";

export interface NetworkPerson { user_id: string; full_name: string; avatar_url: string | null; role: string | null }

/** A real volumetric mascot; lines show accepted links to the viewer, never invented peer-to-peer links. */
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(0, 0.45, 12);
    const css = getComputedStyle(mount);
    const color = (token: string) => new THREE.Color(css.getPropertyValue(token).trim().startsWith("#") ? css.getPropertyValue(token).trim() : `hsl(${css.getPropertyValue(token).trim().replace(/\s+/g, ", ")})`);
    const suit = new THREE.MeshPhysicalMaterial({ color: color("--qr-paper"), roughness: 0.23, metalness: 0.32, clearcoat: 1 });
    const black = new THREE.MeshPhysicalMaterial({ color: color("--qr-ink"), roughness: 0.2, metalness: 0.5, clearcoat: 1 });
    const pink = new THREE.MeshStandardMaterial({ color: color("--k-g-3"), emissive: color("--k-g-3"), emissiveIntensity: 1.2, roughness: 0.3 });
    const amber = new THREE.MeshStandardMaterial({ color: color("--k-g-4"), emissive: color("--k-g-4"), emissiveIntensity: 0.7 });
    const violet = new THREE.MeshStandardMaterial({ color: color("--k-g-1"), emissive: color("--k-g-1"), emissiveIntensity: 0.8 });
    scene.add(new THREE.HemisphereLight(color("--qr-paper"), color("--k-g-1"), 2.8));
    const key = new THREE.DirectionalLight(color("--qr-paper"), 5); key.position.set(3, 5, 5); scene.add(key);
    const rim = new THREE.PointLight(color("--k-g-3"), 28); rim.position.set(-3, 1, 2); scene.add(rim);
    const warm = new THREE.PointLight(color("--k-g-4"), 22); warm.position.set(3, 0, 1); scene.add(warm);
    const robot = new THREE.Group(); scene.add(robot);
    const ball = (parent: THREE.Group, material: THREE.Material, scale: [number, number, number], position: [number, number, number]) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material); mesh.scale.set(...scale); mesh.position.set(...position); parent.add(mesh); return mesh;
    };
    ball(robot, suit, [0.61, 0.73, 0.43], [0, -0.2, 0]);
    ball(robot, black, [0.28, 0.23, 0.28], [0, 0.48, 0]);
    const head = new THREE.Group(); head.position.set(0, 1.05, 0); robot.add(head);
    ball(head, suit, [1.02, 0.82, 0.68], [0, 0, 0]);
    ball(head, black, [0.88, 0.63, 0.2], [0, -0.02, 0.57]);
    for (const side of [-1, 1]) {
      ball(head, black, [0.16, 0.4, 0.4], [side * 0.96, -0.02, 0]);
      ball(head, side < 0 ? violet : amber, [0.075, 0.32, 0.29], [side * 1.07, 0, 0.06]);
      // Curved happy lenses, not a flat painted face.
      const points = Array.from({ length: 25 }, (_, i) => new THREE.Vector3(side * 0.36 - 0.18 + i / 24 * 0.36, 0.03 + Math.sin(i / 24 * Math.PI) * 0.14, 0.755));
      const lens = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.045, 10, false), side < 0 ? violet : pink); head.add(lens);
      ball(robot, black, [0.22, 0.25, 0.25], [side * 0.62, 0.1, 0]);
      const arm = new THREE.Group(); arm.position.set(side * 0.66, 0.06, 0); arm.rotation.z = side < 0 ? -0.36 : 0.85; robot.add(arm);
      ball(arm, suit, [0.2, 0.39, 0.22], [0, -0.28, 0]);
      ball(arm, black, [0.23, 0.23, 0.25], [0, -0.66, 0.04]);
      ball(robot, suit, [0.25, 0.4, 0.27], [side * 0.32, -0.94, 0]);
      ball(robot, black, [0.3, 0.2, 0.4], [side * 0.34, -1.26, 0.12]);
    }
    const logoMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.38), logoMaterial); logo.position.set(0, -0.12, 0.44); robot.add(logo);
    let disposed = false;
    new THREE.TextureLoader().load(kMark.url, texture => { if (disposed) { texture.dispose(); return; } texture.colorSpace = THREE.SRGBColorSpace; logoMaterial.map = texture; logoMaterial.needsUpdate = true; });
    const graph = new THREE.Group(); scene.add(graph);
    const people = connections.slice(0, 8);
    const positions = people.map((_, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const row = Math.floor(index / 2);
      return new THREE.Vector3(side * (2.4 + (row % 2) * 0.12), 2.1 - row * 1.4, -0.3);
    });
    positions.forEach((position, index) => {
      ball(graph, index % 2 ? amber : pink, [0.05, 0.05, 0.05], [position.x, position.y, position.z]);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.1, -0.4), position]), new THREE.LineBasicMaterial({ color: color(index % 2 ? "--k-g-4" : "--k-g-3"), transparent: true, opacity: 0.4 })); graph.add(line);
    });
    const resize = () => { const width = mount.clientWidth; const height = mount.clientHeight; renderer.setSize(width, height); camera.aspect = width / height; camera.position.z = width < 550 ? 14 : 10.5; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0; let visible = true; let yaw = -0.1; let targetYaw = -0.1; let pitch = 0; let dragging = false; let previousX = 0;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const draw = (now: number) => {
      if (!visible) return;
      yaw += (targetYaw - yaw) * 0.08; robot.rotation.y = yaw; robot.rotation.x = pitch;
      robot.position.y = reduce.matches ? 0 : Math.sin(now * 0.0014) * 0.065;
      head.rotation.z = reduce.matches ? 0 : Math.sin(now * 0.0008) * 0.025;
      renderer.render(scene, camera);
      positions.forEach((position, i) => { const element = labels.current.get(people[i].user_id); if (!element) return; const screen = position.clone().project(camera); element.style.left = `${(screen.x + 1) * 50}%`; element.style.top = `${(1 - screen.y) * 50}%`; });
      frame = requestAnimationFrame(draw);
    };
    const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; cancelAnimationFrame(frame); if (visible) frame = requestAnimationFrame(draw); }); intersection.observe(mount);
    const down = (e: PointerEvent) => { dragging = true; previousX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => { if (dragging) { targetYaw += (e.clientX - previousX) * 0.009; previousX = e.clientX; } else if (e.pointerType === "mouse" && !reduce.matches) { const box = mount.getBoundingClientRect(); targetYaw = (e.clientX - box.left - box.width / 2) / box.width * 0.5; pitch = -(e.clientY - box.top - box.height / 2) / box.height * 0.15; } };
    const up = () => { dragging = false; };
    reset.current = () => { targetYaw = -0.1; pitch = 0; };
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up); renderer.domElement.addEventListener("pointercancel", up);
    frame = requestAnimationFrame(draw);
    return () => { disposed = true; cancelAnimationFrame(frame); intersection.disconnect(); observer.disconnect(); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Line) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); logoMaterial.map?.dispose(); renderer.dispose(); renderer.domElement.remove(); };
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