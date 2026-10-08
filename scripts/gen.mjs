// Generates the splash-scene plates with OpenAI's image API, following GENERATION-GUIDE.md.
//
//   node scripts/gen.mjs <step> [count]      generate candidates  (steps: char, plateB, plateA, plateD, plateE, mobile)
//   node scripts/gen.mjs pick <step> <n>     promote candidate n of a step to output/final/
//
// Reads OPENAI_API_KEY from .env.local. Optional: IMAGE_MODEL, IMAGE_QUALITY.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK = path.resolve(HERE, "../../AUVOX Generation Pack");
const REF = path.join(PACK, "references");
const OUT = path.join(PACK, "output");
const FINAL = path.join(OUT, "final");

const env = Object.fromEntries(
  (await fs.readFile(path.resolve(HERE, "../.env.local"), "utf8"))
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const KEY = process.env.OPENAI_API_KEY || env.OPENAI_API_KEY;
const MODEL = process.env.IMAGE_MODEL || env.IMAGE_MODEL || "chatgpt-image-latest";
const QUALITY = process.env.IMAGE_QUALITY || "high";
if (!KEY) throw new Error("OPENAI_API_KEY missing");

// ---------------------------------------------------------------------------
// Locks (shared prompt fragments)
// ---------------------------------------------------------------------------
const CHARACTER =
  "A white Canadian man of Northern-European descent in his early twenties: pale fair skin, light-brown slightly wavy hair with a soft side part, blue-grey eyes, a light sandy stubble, friendly relaxed smile, athletic slim build, wearing the cream AUVOX oversized t-shirt exactly as in the reference image (same print) and dark jeans.";

const STUDIO =
  "A small, dark, warm recording studio. Deep red painted back wall with the cream AUVOX MUSIC logo from the reference image mounted on it as a flat painted sign, dark acoustic foam panels, a wooden desk with studio monitors, a keyboard and a small mixing console, a vintage warm desk lamp on the right, the red electric guitar from the reference hanging on the wall, a vinyl record on a shelf, faint haze in the air. No neon tubes anywhere — the red is coloured light, not neon.";

const STYLE =
  "Cinematic photograph, shot on ARRI Alexa with a 35mm lens, shallow depth of field, warm tungsten key light from the right, deep red rim light from behind-left, dark moody shadows, soft film grain, natural skin texture, ultra-detailed, photorealistic, editorial music-magazine quality. No text anywhere except the AUVOX logo, no watermarks, no extra logos.";

const ref = (name) => path.join(REF, name);
const fin = (name) => path.join(FINAL, name);

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------
const STEPS = {
  char: {
    final: "01-character-sheet.png",
    size: "1536x1024",
    refs: [ref("ref-tshirt-auvox.png"), ref("ref-guitar-brand-red.png")],
    prompt: `Character sheet of one person, three views side by side on a plain dark grey studio background: a front-facing portrait, a three-quarter view, and a full-body view seated on a black stool holding the red electric guitar from the second reference image across his lap. ${CHARACTER} Do not copy the face of any person in the reference images; the references are only for the t-shirt print and the guitar. The t-shirt must be exactly the cream AUVOX t-shirt from the first reference image, same print. Soft neutral studio lighting, the same face in all three views, photorealistic, highly detailed. No text, no labels.`,
  },
  plateB: {
    final: "02-B-clean-plate.png",
    size: "1536x1024",
    refs: [ref("ref-logo-pearl-on-ink.png"), ref("ref-guitar-brand-red.png"), ref("ref-client-mood-target.webp")],
    prompt: `Wide shot of an empty recording studio, nobody in the frame, an empty black stool in the centre foreground. ${STUDIO} The AUVOX MUSIC logo on the back wall must match the first reference image exactly (cream letters, "auvox" large with "MUSIC" beneath), centred above the stool, large and fully readable. The red guitar on the wall is the one in the second reference. The third reference is only for mood and colour. No people, no phone. Camera at chest height, straight on, 16:9. ${STYLE}`,
  },
  plateA: {
    final: "03-A-hero.png",
    size: "1536x1024",
    refs: [fin("02-B-clean-plate.png"), fin("01-character-sheet.png"), ref("ref-pose-guitar-phone.webp")],
    prompt: `Edit the first image. Keep the room, the camera angle, the lighting and the logo on the wall exactly the same. Add the man from the character sheet (second image) sitting on the stool, facing the camera, a red electric guitar across his lap, his right hand resting on the strings near the bridge exactly like the pose reference (third image), his left hand holding a smartphone up at chest height with the screen facing him, the screen is black and switched off, his eyes are on the phone screen (not on the camera) and he smiles at what he reads. Over-ear headphones around his neck. The lamp light hits his right side, a soft red rim light outlines his left shoulder, a faint cool glow from the phone on his face. Both hands anatomically correct with five fingers, all six guitar strings clearly visible and straight. ${CHARACTER} ${STYLE}`,
  },
  plateD: {
    final: "04-D-phone-closeup.png",
    size: "1536x1024",
    refs: [fin("03-A-hero.png")],
    prompt: `Edit this photo. Same scene, same person, same lighting and colours. The camera has moved much closer: the smartphone in his left hand now fills about two thirds of the frame, slightly angled, screen black and switched off, his smiling face soft and out of focus behind it, the red studio wall blurred in the background. Shallow depth of field, sharp focus on the phone. ${STYLE}`,
  },
  plateE: {
    final: "05-E-strings-macro.png",
    size: "1536x1024",
    refs: [fin("03-A-hero.png")],
    prompt: `Edit this photo. Same scene, same camera position and lens: a tight macro crop of the guitar body and strings under his right hand, all six strings sharp, straight and clearly visible from bridge to neck, his fingers resting lightly on them. Keep the lighting identical. ${STYLE}`,
  },
  mobile: {
    final: "08-A-hero-mobile.png",
    size: "1024x1536",
    refs: [fin("03-A-hero.png")],
    prompt: `Reframe this photo as a 4:5 portrait. Same scene, same person, same lighting: the man centred, the AUVOX logo on the wall still fully visible above his head, more wall above and more floor below. Nothing else changes. ${STYLE}`,
  },
};

// ---------------------------------------------------------------------------
async function generateOne(step, index) {
  const spec = STEPS[step];
  const t0 = Date.now();
  let res;
  if (spec.refs.length) {
    const form = new FormData();
    form.append("model", MODEL);
    form.append("prompt", spec.prompt);
    form.append("size", spec.size);
    form.append("quality", QUALITY);
    form.append("input_fidelity", "high");
    form.append("n", "1");
    for (const file of spec.refs) {
      const data = await fs.readFile(file);
      const type = file.endsWith(".webp") ? "image/webp" : file.endsWith(".jpg") ? "image/jpeg" : "image/png";
      form.append("image[]", new Blob([data], { type }), path.basename(file));
    }
    res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: form,
    });
  } else {
    res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt: spec.prompt, size: spec.size, quality: QUALITY, n: 1 }),
    });
  }
  const json = await res.json();
  if (!res.ok) throw new Error(`${step}#${index}: ${json.error?.message || res.statusText}`);
  const b64 = json.data[0].b64_json;
  const dir = path.join(OUT, step);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `cand-${index}.png`);
  await fs.writeFile(file, Buffer.from(b64, "base64"));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const usage = json.usage ? ` tokens in=${json.usage.input_tokens} out=${json.usage.output_tokens}` : "";
  console.log(`✓ ${path.relative(PACK, file)} (${secs}s)${usage}`);
}

async function generate(step, count) {
  const spec = STEPS[step];
  if (!spec) throw new Error(`unknown step ${step}; one of ${Object.keys(STEPS).join(", ")}`);
  for (const f of spec.refs) await fs.access(f).catch(() => { throw new Error(`missing reference ${f} — pick the previous step first`); });
  console.log(`model=${MODEL} quality=${QUALITY} size=${spec.size} refs=${spec.refs.map((f) => path.basename(f)).join(", ") || "none"}`);
  const results = await Promise.allSettled(Array.from({ length: count }, (_, i) => generateOne(step, i + 1)));
  results.filter((r) => r.status === "rejected").forEach((r) => console.error("✗", r.reason.message));
}

async function pick(step, n) {
  const spec = STEPS[step];
  await fs.mkdir(FINAL, { recursive: true });
  await fs.copyFile(path.join(OUT, step, `cand-${n}.png`), fin(spec.final));
  console.log(`✓ final/${spec.final} ← ${step}/cand-${n}.png`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "pick") await pick(a, Number(b));
else await generate(cmd, Number(a) || 4);
