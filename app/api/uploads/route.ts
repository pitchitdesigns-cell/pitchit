import { env } from "cloudflare:workers";
import { anonymousAccessResponse, requestOwner } from "../request-owner";

type PitchItEnv = { MEDIA?: R2Bucket };
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4"]);

export async function POST(request: Request) {
  const owner = requestOwner(request);
  if (!owner) return anonymousAccessResponse();
  try {
    const bucket = (env as unknown as PitchItEnv).MEDIA;
    if (!bucket) return Response.json({ error: "Media storage is not connected" }, { status: 503 });
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) return Response.json({ error: "A file is required" }, { status: 400 });
    if (!allowedTypes.has(file.type)) return Response.json({ error: "Use JPG, PNG, WebP, GIF or MP4" }, { status: 415 });
    if (file.size > 50 * 1024 * 1024) return Response.json({ error: "Files must be under 50 MB" }, { status: 413 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    const key = `${owner}/${crypto.randomUUID()}-${safeName}`;
    await bucket.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
    return Response.json({ key, name: file.name, type: file.type, bytes: file.size }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 });
  }
}
