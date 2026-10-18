import * as THREE from "three";

/**
 * The guitar body's finish: a fresh, even gloss lacquer over the deep cherry paint. The model's own
 * roughness, metalness and specular maps are scanned wear (blotchy at this scale), so the body drops
 * them for one smooth surface under a full clearcoat; the paint colour and the ambient occlusion stay.
 */
export function lacquer(src: THREE.Material) {
  const phys = new THREE.MeshPhysicalMaterial();
  phys.copy(src as THREE.MeshPhysicalMaterial);
  phys.roughnessMap = null;
  phys.metalnessMap = null;
  phys.specularIntensityMap = null;
  phys.specularColorMap = null;
  phys.metalness = 0;
  phys.roughness = 0.34;
  phys.specularIntensity = 0.55;
  phys.clearcoat = 1;
  phys.clearcoatRoughness = 0.04;
  phys.envMapIntensity = 1.05;
  if (phys.map) phys.map.anisotropy = 8;
  return phys;
}

/** The guitar's painted body, by its material name in guitar-red.glb. */
export const GUITAR_BODY = "lambert4SG";
