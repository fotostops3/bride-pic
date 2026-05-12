import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Garment types ──────────────────────────────────────────
const GARMENT_LABELS: Record<string, string> = {
  jeans:    "jeans / denim pants",
  pantalon: "dress trousers / chino pants",
  remera:   "t-shirt / basic top",
  camisa:   "shirt / button-down",
  campera:  "jacket / outerwear",
  buzo:     "sweatshirt / hoodie",
  vestido:  "dress",
  shorts:   "shorts",
};

// ── Shots ──────────────────────────────────────────────────
function buildShots(gender: string, garmentType: string, refMap: string, garmentNotes: string) {
  const garmentLabel = GARMENT_LABELS[garmentType] ?? garmentType;
  const isMale  = gender === "male";
  const isTop   = ["remera", "camisa", "campera", "buzo", "vestido"].includes(garmentType);

  const notesLine = garmentNotes
    ? `SPECIFIC GARMENT DETAILS — reproduce exactly: ${garmentNotes}`
    : "";

  const garmentFidelity = `GARMENT FIDELITY — 100% REQUIRED:
Reproduce the ${garmentLabel} from the reference photos with absolute precision:
- Exact color and shade — do NOT shift or "improve" the color
- Exact cut and silhouette
- Every construction detail: collar, seams, pockets, buttons, zippers, prints, patches, hems
${notesLine}
- Do NOT invent or alter any detail not visible in the references`;

  const refSection = `REFERENCE PHOTOS:
${refMap}`;

  const modelDesc = isMale
    ? "24-year-old male. Athletic lean build, 1.82m. Short dark brown hair, light stubble, strong jaw, brown eyes. Tanned Mediterranean skin."
    : "23-year-old female. Slim toned build, 1.72m. Long dark brown hair, almond eyes, soft features. Light tan skin.";

  const framingNoFace = isTop
    ? `FRAMING: Shot from just below the chin/jaw to just below the waist. The top of the frame cuts right below the chin — neck fully visible, NO face, NO head. The bottom of the frame shows only the very top of the pants/waistband (barely visible). The garment fills 90% of the frame vertically — shirt must be complete and centered. Portrait orientation (vertical).`
    : `FRAMING: From waist DOWN to mid-thigh. Head outside frame above. The garment fills 80% of the frame. Portrait orientation (vertical).`;

  return [
    {
      label: "Producto solo",
      prompt: `You are an expert ecommerce product photographer shooting for a brand like Zara or H&M.

${refSection}

${garmentFidelity}

SHOT: CLEAN PRODUCT ONLY — NO MODEL, NO PERSON, NO BODY PARTS.
Presentation: soft ghost mannequin effect — the garment hangs naturally with relaxed, realistic fabric drape. Sleeves fall naturally, fabric has gentle movement and folds. NOT stiff or over-structured. Think Zara.com product photo — casual, real, breathing fabric.
BACKGROUND: Pure white seamless backdrop (#FFFFFF). Soft diffused lighting, subtle natural shadows to give depth.
The garment is the ONLY element. No props, no hands.
LABEL/TAG: Do NOT show any internal label, care tag or neck tag. The interior of the collar must be clean.
PRINT FIDELITY — CRITICAL: If the garment has a graphic, text, illustration or print — reproduce it with 100% exactness. Same words, same font style, same layout, same colors, same illustrations. Do NOT simplify, alter or invent any part of the print.
Show the FRONT of the garment. Centered, fills 80% of frame. Portrait orientation (vertical).
OUTPUT: Photorealistic, natural ecommerce quality. Relaxed and authentic feel.`,
    },
    {
      label: "Modelo sin cara",
      prompt: `You are a professional ecommerce fashion photographer shooting for a brand like Zara or ASOS.

MODEL:
${modelDesc}
Photorealistic — real photograph quality. Clearly feminine silhouette.

${refSection}

${garmentFidelity}

SHOT: MODEL WEARING GARMENT — NECK VISIBLE, FACE OUT OF FRAME.
BACKGROUND: Pure white or very light grey seamless backdrop. Soft natural studio light — like a window in a bright room, not harsh flash.

HYPER-REALISTIC HUMAN MODEL — THIS IS CRITICAL:
The model must look like a real person photographed with a real camera. NOT AI-generated. NOT a mannequin. NOT perfect.
- Real skin texture: visible pores, natural skin tone variation, subtle imperfections
- Real hair: natural volume, slight flyaways, not perfectly combed
- Real hands: natural veins, real nail polish if any, relaxed fingers
- Real body: natural posture, weight distributed naturally, slight asymmetry
- The image must be indistinguishable from a real photograph taken by a human photographer

POSE — NATURAL AND VARIED (pick one randomly):
- One hand lightly tucked in pocket, other arm relaxed down, slight weight shift to one leg
- One hand touching the hem of the shirt casually from the side, the other hanging naturally
- Standing with slight body rotation, one shoulder forward, arms relaxed at sides
- Arms slightly away from body, fingers loosely open, caught mid-breath
- Weight shifted to one leg, one hand resting lightly on hip, other arm hanging
Poses must feel candid and unstaged — like a real person waiting for a photo, not posing for one.

SLEEVE LENGTH: Reproduce EXACTLY the sleeve length from the reference — do NOT lengthen or shorten. If sleeves end at mid-upper arm, reproduce that exactly.
${framingNoFace}
STYLING: Plain black pants/trousers — barely visible, only the very top of the waistband shows at the bottom edge of the frame. No shoes needed.
PRINT FIDELITY — CRITICAL: If the garment has a graphic, text, illustration or print — reproduce it with 100% exactness. Same words, same font style, same layout, same colors, same illustrations. Do NOT simplify, alter or invent any part of the print.
OUTPUT: Photorealistic, natural ecommerce quality. Garment is the hero.`,
    },
  ];
}

// ── Image helpers ──────────────────────────────────────────
async function prepareImage(file: File, tmpDir: string, name: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const png = await sharp(buffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const p = path.join(tmpDir, `${name}.png`);
  fs.writeFileSync(p, png);
  return p;
}

async function optimizeOutput(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const optimized = await sharp(buffer)
    .resize(1024, 1536, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .jpeg({ quality: 95, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${optimized.toString("base64")}`;
}

// ── Main POST ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "styleshoot-"));

  try {
    const formData = await req.formData();
    const gender      = (formData.get("gender")      as string) || "female";
    const garmentType = (formData.get("garmentType") as string) || "remera";
    const garmentNotes = (formData.get("garmentNotes") as string) || "";
    const fileCount   = parseInt((formData.get("fileCount") as string) || "0");
    const rawLabels: string[] = JSON.parse((formData.get("labels") as string) || "[]");

    if (fileCount === 0) {
      return NextResponse.json({ error: "Subí al menos una foto de la prenda" }, { status: 400 });
    }

    // Prepare tagged image buffers
    const tagged: { buffer: Buffer; label: string }[] = [];
    for (let i = 0; i < Math.min(fileCount, 4); i++) {
      const file = formData.get(`file_${i}`) as File | null;
      if (file) {
        const p = await prepareImage(file, tmpDir, `img_${i}`);
        tagged.push({ buffer: fs.readFileSync(p), label: rawLabels[i] || "detalle" });
      }
    }

    // Sort: frente first, espalda second, detalle last
    const labelOrder = ["frente", "espalda", "detalle"];
    tagged.sort((a, b) => labelOrder.indexOf(a.label) - labelOrder.indexOf(b.label));

    // Build reference map description for prompts
    const refMap = tagged.map((t, i) =>
      `- Reference image ${i + 1}: ${t.label.toUpperCase()} view of the garment`
    ).join("\n");

    const buffers: Buffer[] = tagged.map(t => t.buffer);

    // Logo / brand label (optional)
    const logoFile = formData.get("logo") as File | null;
    if (logoFile) {
      const logoPath = await prepareImage(logoFile, tmpDir, "logo");
      buffers.push(fs.readFileSync(logoPath));
    }

    const shots = buildShots(gender, garmentType, refMap, garmentNotes);

    // Generate all 4 shots in parallel (4 images = within rate limit)
    const results = await Promise.all(
      shots.map(async (shot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageFiles = await Promise.all(buffers.map((buf, i) => (OpenAI as any).toFile(buf, `img_${i}.png`, { type: "image/png" })));

        const response = await openai.images.edit({
          model: "gpt-image-2",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          image: imageFiles as any,
          prompt: shot.prompt,
          n: 1,
          size: "1024x1536",
          quality: "high",
        });

        const base64 = (response.data ?? [])[0]?.b64_json ?? "";
        const url = await optimizeOutput(base64);
        return { url, label: shot.label };
      })
    );

    return NextResponse.json({ images: results });
  } catch (err: unknown) {
    console.error("Error generando imágenes:", err);
    const message = err instanceof Error ? err.message : "Error al generar";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
}

export const maxDuration = 300;
export const dynamic = "force-dynamic";
