"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { markReady } from "@/store/preloader";

/** Canvases being prewarmed: PauseOffscreen leaves their render loop alone until it's done. */
export const prewarming = new WeakSet<HTMLCanvasElement>();

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Gets a canvas ready before anyone looks at it, without one big stall:
 *   1. holds its render loop (otherwise the first frame uploads every texture and compiles every
 *      shader at once — 100-200ms with the instruments' 2048px maps)
 *   2. compiles every material's shader, hidden objects included, with KHR_parallel_shader_compile
 *      where the browser has it (compileAsync), so the main thread mostly isn't blocked
 *   3. uploads the textures one per frame
 *   4. draws a few frames through the canvas's real pipeline (a post-processing composer renders into
 *      its own target, which needs different shader variants than compiling for the screen does), with
 *      the hidden pieces forced visible so their variants are built too; then lets go of the loop and
 *      reports `name` ready (the preloader waits on it)
 * Mount it inside the Suspense boundary that loads the scene's models, after them.
 */
export default function Prewarm({ name, needEnv = true }: { name: string; needEnv?: boolean }) {
  const get = useThree((s) => s.get);
  // during the last frames: everything hidden is drawn too (restored afterwards). This runs after the
  // scene's own frame callbacks (it mounts last), so pieces that hide themselves each frame are caught.
  const forced = useRef<THREE.Object3D[] | null>(null);
  useFrame(({ scene }) => {
    const list = forced.current;
    if (!list) return;
    scene.traverse((o) => {
      if (!o.visible) {
        o.visible = true;
        list.push(o);
      }
    });
  });

  // before the first frame with the models in it: hold the loop
  useLayoutEffect(() => {
    const st = get();
    prewarming.add(st.gl.domElement);
    st.setFrameloop("never");
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    const el = get().gl.domElement;
    const release = () => {
      prewarming.delete(el);
      el.dispatchEvent(new Event("prewarmed"));
    };
    (async () => {
      const t0 = performance.now();
      // the lighting changes which shader each material needs: wait for the environment map
      while (needEnv && !get().scene.environment && performance.now() - t0 < 4000) {
        await frame();
        if (cancelled) return;
      }
      const { gl, scene, camera } = get();

      // compile everything, the hidden pieces too (compile only walks visible objects)
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        /* older browsers: the first frame compiles instead */
      }
      hidden.forEach((o) => (o.visible = false));
      if (cancelled) return;

      // the textures, one per frame
      const textures = new Set<THREE.Texture>();
      scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        if (!mats) return;
        for (const m of Array.isArray(mats) ? mats : [mats]) {
          for (const v of Object.values(m)) if (v && (v as THREE.Texture).isTexture && !(v as THREE.Texture).isRenderTargetTexture) textures.add(v as THREE.Texture);
          const u = (m as THREE.ShaderMaterial).uniforms;
          if (u) for (const { value } of Object.values(u)) if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
        }
      });
      for (const t of textures) {
        if (cancelled) return;
        gl.initTexture(t);
        await frame();
      }
      if (cancelled) return;

      // a few frames through the real pipeline, hidden pieces included, then hand the loop back
      const st = get();
      forced.current = [];
      st.setFrameloop("demand");
      st.invalidate(3);
      await frame();
      await frame();
      await frame();
      await frame();
      const shown = forced.current;
      forced.current = null;
      shown.forEach((o) => (o.visible = false));
      st.invalidate();
      if (cancelled) return;
      release();
      markReady(name);
    })();
    return () => {
      cancelled = true;
      release();
    };
  }, [get, name, needEnv]);

  return null;
}
