"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────
type PhotoLabel = "frente" | "espalda" | "detalle";
type GenImage   = { url: string; label: string };
type JobStatus  = "idle" | "generating" | "done" | "error";

type Job = {
  id: string;
  artName: string;
  garmentType: string;
  garmentNotes: string;
  files: File[];
  previews: string[];
  photoLabels: PhotoLabel[];
  status: JobStatus;
  images: GenImage[];
  error?: string;
};

// ── Constants ──────────────────────────────────────────────
const GARMENT_OPTIONS = [
  { id: "remera",   label: "Remera",   emoji: "👕" },
  { id: "camisa",   label: "Camisa",   emoji: "👔" },
  { id: "buzo",     label: "Buzo",     emoji: "🦺" },
  { id: "campera",  label: "Campera",  emoji: "🧥" },
  { id: "vestido",  label: "Vestido",  emoji: "👗" },
  { id: "jeans",    label: "Jeans",    emoji: "👖" },
  { id: "pantalon", label: "Pantalón", emoji: "🩳" },
  { id: "shorts",   label: "Shorts",   emoji: "🩱" },
];

const LABEL_CYCLE: PhotoLabel[] = ["frente", "espalda", "detalle"];
const LABEL_COLORS: Record<PhotoLabel, string> = {
  frente:  "bg-blue-500 text-white",
  espalda: "bg-violet-500 text-white",
  detalle: "bg-slate-600 text-white",
};
const LABEL_ORDER: Record<PhotoLabel, number> = { frente: 0, espalda: 1, detalle: 2 };

// ── Utils ──────────────────────────────────────────────────
let _id = 0;
const makeId = () => `j${++_id}`;

function newJob(): Job {
  return { id: makeId(), artName: "", garmentType: "remera", garmentNotes: "", files: [], previews: [], photoLabels: [], status: "idle", images: [] };
}

async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }) : file);
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ── Icons ──────────────────────────────────────────────────
function IcoUpload() { return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>; }
function IcoDownload() { return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>; }
function IcoX() { return <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>; }
function IcoBolt() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>; }
function IcoPlus() { return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>; }

// ── ProductCard ────────────────────────────────────────────
function ProductCard({
  job, canRemove, onUpdate, onRemove, onLightbox, onDownload,
}: {
  job: Job;
  canRemove: boolean;
  onUpdate: (u: Partial<Job>) => void;
  onRemove: () => void;
  onLightbox: (img: GenImage) => void;
  onDownload: (url: string, label: string, art: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const newFiles = Array.from(fl);
    const readers = newFiles.map(f =>
      new Promise<{ file: File; preview: string }>(resolve => {
        const r = new FileReader();
        r.onload = e => resolve({ file: f, preview: e.target?.result as string });
        r.readAsDataURL(f);
      })
    );
    Promise.all(readers).then(results => {
      const base = job.photoLabels.length;
      const newLabels: PhotoLabel[] = results.map((_, i) => {
        const idx = base + i;
        return idx === 0 ? "frente" : idx === 1 ? "espalda" : "detalle";
      });
      onUpdate({
        files:       [...job.files,       ...results.map(r => r.file)],
        previews:    [...job.previews,    ...results.map(r => r.preview)],
        photoLabels: [...job.photoLabels, ...newLabels],
      });
    });
  };

  const removeFile = (i: number) => {
    onUpdate({
      files:       job.files.filter((_, j) => j !== i),
      previews:    job.previews.filter((_, j) => j !== i),
      photoLabels: job.photoLabels.filter((_, j) => j !== i),
    });
  };

  const cycleLabel = (i: number) => {
    const labels = [...job.photoLabels];
    labels[i] = LABEL_CYCLE[(LABEL_CYCLE.indexOf(labels[i]) + 1) % LABEL_CYCLE.length];
    onUpdate({ photoLabels: labels });
  };

  const borderColor =
    job.status === "generating" ? "border-blue-500/30" :
    job.status === "done"       ? "border-emerald-500/20" :
    job.status === "error"      ? "border-red-500/20" :
    "border-white/[0.06]";

  return (
    <div className={`bg-[#0d0d1e] rounded-2xl border ${borderColor} p-4 transition-all`}>

      {/* Art name + remove */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 flex items-center gap-2 bg-black/20 rounded-xl px-3 py-2 border border-transparent focus-within:border-blue-500/30 transition-all">
          <span className="text-[10px] text-slate-600 font-mono shrink-0">ART</span>
          <input
            type="text"
            value={job.artName}
            onChange={e => onUpdate({ artName: e.target.value })}
            placeholder="Nombre del artículo..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-700"
          />
        </div>
        {canRemove && (
          <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-slate-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10 shrink-0">
            <IcoX />
          </button>
        )}
      </div>

      {/* Garment type */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {GARMENT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => onUpdate({ garmentType: opt.id })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
              job.garmentType === opt.id
                ? "border-blue-500/50 bg-blue-500/10 text-blue-300"
                : "border-white/[0.06] text-slate-500 hover:border-white/20 hover:text-slate-300"
            }`}
          >
            <span className="text-sm">{opt.emoji}</span> {opt.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <textarea
        value={job.garmentNotes}
        onChange={e => onUpdate({ garmentNotes: e.target.value })}
        placeholder="Detalles: cropped, puño elástico, corte raglan, tipo de cuello, largo, etc..."
        rows={2}
        className="w-full bg-black/20 text-xs text-white outline-none placeholder:text-slate-700 resize-none border border-white/[0.04] focus:border-blue-500/30 rounded-xl p-3 mb-3 transition-all"
      />

      {/* Photos + Results */}
      <div className="grid grid-cols-[130px_1fr] gap-4">

        {/* Photo upload */}
        <div>
          <div
            className="border-2 border-dashed border-white/[0.07] rounded-xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all"
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            {job.previews.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 px-2">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-600">
                  <IcoUpload />
                </div>
                <p className="text-[10px] text-slate-600 text-center leading-snug">Fotos frente y espalda</p>
              </div>
            ) : (
              <div className="p-1.5 grid grid-cols-2 gap-1">
                {job.previews.map((src, i) => (
                  <div key={i} className="relative group/img aspect-square">
                    <img src={src} alt="" className="w-full h-full object-cover rounded-md" />
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover/img:opacity-100 rounded-md transition-opacity flex items-center justify-center">
                      <button onClick={e => { e.stopPropagation(); removeFile(i); }} className="text-white"><IcoX /></button>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); cycleLabel(i); }}
                      className={`absolute bottom-0 left-0 right-0 text-[7px] py-0.5 rounded-b-md font-bold uppercase text-center transition-colors ${LABEL_COLORS[job.photoLabels[i]] ?? "bg-slate-600 text-white"}`}
                    >
                      {job.photoLabels[i]}
                    </button>
                  </div>
                ))}
                {job.previews.length < 4 && (
                  <div
                    className="aspect-square border border-dashed border-white/[0.08] rounded-md flex items-center justify-center text-slate-700 hover:text-blue-400 transition-colors"
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  >
                    <IcoPlus />
                  </div>
                )}
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
          <p className="text-[9px] text-slate-700 text-center mt-1.5">Clic en badge para cambiar etiqueta</p>
        </div>

        {/* Results panel */}
        <div>
          {/* Idle empty state */}
          {job.status === "idle" && job.images.length === 0 && (
            <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-3">
              <div className="grid grid-cols-2 gap-2 w-full opacity-[0.1]">
                {[0, 1].map(i => <div key={i} className="aspect-[2/3] shimmer rounded-xl" />)}
              </div>
              <div className="text-center -mt-2">
                <p className="text-[10px] text-slate-700">Producto solo · Modelo sin cara</p>
              </div>
            </div>
          )}

          {/* Generating */}
          {job.status === "generating" && (
            <div className="grid grid-cols-2 gap-2 fade-up">
              {["Producto solo", "Modelo sin cara"].map((label, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-white/[0.05]">
                  <div className="aspect-[2/3] shimmer" />
                  <div className="p-2">
                    <span className="text-[9px] text-slate-700">{label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {job.status === "error" && (
            <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-xl p-3 h-full">
              <span className="text-red-400 text-sm shrink-0">⚠</span>
              <div>
                <p className="text-xs text-red-300">{job.error}</p>
                <button onClick={() => onUpdate({ status: "idle" })} className="text-[10px] text-red-400/60 hover:text-red-400 mt-1.5 transition-colors">Reintentar</button>
              </div>
            </div>
          )}

          {/* Done */}
          {job.status === "done" && job.images.length > 0 && (
            <div className="fade-up">
              <div className="grid grid-cols-2 gap-2">
                {job.images.map((img, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden cursor-pointer group border border-white/[0.05] hover:border-blue-500/30 transition-all"
                    onClick={() => onLightbox(img)}
                  >
                    <img src={img.url} alt={img.label} className="w-full object-cover aspect-[2/3]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 right-2 translate-y-1 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-between">
                      <span className="text-[9px] text-slate-300">{img.label}</span>
                      <button
                        onClick={e => { e.stopPropagation(); onDownload(img.url, img.label, job.artName); }}
                        className="text-white bg-black/50 hover:bg-black/80 rounded-md p-1 transition-colors"
                      >
                        <IcoDownload />
                      </button>
                    </div>
                    <div className="absolute top-1.5 left-1.5">
                      <span className="text-[8px] bg-black/60 text-slate-300 px-1.5 py-0.5 rounded-md backdrop-blur-sm">{img.label}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">✓ Listo</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => job.images.forEach(img => onDownload(img.url, img.label, job.artName))}
                    className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                  >
                    <IcoDownload /> Todo
                  </button>
                  <button
                    onClick={() => onUpdate({ status: "idle", images: [], error: undefined })}
                    className="text-[10px] text-slate-700 hover:text-slate-400 transition-colors"
                  >
                    ↺ Regenerar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Home ───────────────────────────────────────────────────
export default function Home() {
  const [gender, setGender]               = useState<"female" | "male">("female");
  const [jobs, setJobs]                   = useState<Job[]>([newJob()]);
  const [credits, setCredits]             = useState<number | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [isGenerating, setIsGenerating]   = useState(false);
  const [genProgress, setGenProgress]     = useState<{ current: number; total: number } | null>(null);
  const [lightbox, setLightbox]           = useState<GenImage | null>(null);

  useEffect(() => {
    fetch("/api/credits")
      .then(r => r.json())
      .then(d => { if (typeof d.credits === "number") setCredits(d.credits); })
      .catch(() => {})
      .finally(() => setCreditsLoading(false));
  }, []);

  const updateJob = useCallback((id: string, updates: Partial<Job>) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const addJob    = () => setJobs(prev => [...prev, newJob()]);
  const removeJob = (id: string) => setJobs(prev => prev.filter(j => j.id !== id));

  // Jobs ready to generate (have photos and not currently running)
  const readyJobs  = jobs.filter(j => j.files.length > 0 && j.status !== "generating");
  const pendingCount = readyJobs.length;

  const handleGenerateAll = async () => {
    if (!pendingCount || isGenerating) return;
    setIsGenerating(true);
    setGenProgress({ current: 0, total: readyJobs.length });

    for (let idx = 0; idx < readyJobs.length; idx++) {
      const job = readyJobs[idx];
      setGenProgress({ current: idx + 1, total: readyJobs.length });
      updateJob(job.id, { status: "generating", error: undefined, images: [] });
      try {
        // Sort images: frente → espalda → detalle
        const sorted = [...job.files.keys()].sort(
          (a, b) => (LABEL_ORDER[job.photoLabels[a]] ?? 2) - (LABEL_ORDER[job.photoLabels[b]] ?? 2)
        );
        const fd = new FormData();
        fd.append("gender",       gender);
        fd.append("garmentType",  job.garmentType);
        fd.append("garmentNotes", job.garmentNotes.trim());
        fd.append("fileCount",    String(sorted.length));
        fd.append("labels",       JSON.stringify(sorted.map(i => job.photoLabels[i])));
        for (let k = 0; k < sorted.length; k++) {
          fd.append(`file_${k}`, await compressImage(job.files[sorted[k]]));
        }
        const res  = await fetch("/api/generate", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al generar");
        updateJob(job.id, { status: "done", images: data.images });
        if (typeof data.creditsRemaining === "number") setCredits(data.creditsRemaining);
      } catch (e) {
        updateJob(job.id, { status: "error", error: e instanceof Error ? e.message : "Error desconocido" });
      }
    }
    setIsGenerating(false);
    setGenProgress(null);
  };

  const download = (url: string, label: string, art: string) => {
    const a = document.createElement("a");
    a.href = url;
    const base = art.trim() || "styleshoot";
    a.download = `${base}-${label}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase() + ".jpg";
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#07070f] flex flex-col pb-28">

      {/* ── HEADER ── */}
      <header className="border-b border-white/[0.05] bg-[#07070f]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
              <span className="text-white text-xs font-black">B</span>
            </div>
            <span className="font-bold text-white tracking-tight">BRIDE PIC</span>
            <span className="text-[10px] bg-pink-500/15 text-pink-300 border border-pink-500/25 px-1.5 py-0.5 rounded-full font-medium">BETA</span>
          </div>
          {!creditsLoading && credits !== null && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              credits === 0   ? "border-red-500/30 bg-red-500/10 text-red-400" :
              credits <= 5   ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
              "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400"
            }`}>
              <span className="text-base leading-none">⚡</span>
              <span className="text-xs">{credits} crédito{credits !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-4">

        {/* Gender — global */}
        <div className="bg-[#0d0d1e] rounded-2xl border border-white/[0.06] p-4">
          <p className="text-xs text-slate-500 mb-3 font-medium">Modelo <span className="text-slate-700">(aplica a todos los productos)</span></p>
          <div className="flex gap-2">
            {([["female", "👩", "Mujer"], ["male", "👨", "Hombre"]] as const).map(([id, emoji, label]) => (
              <button
                key={id}
                onClick={() => setGender(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                  gender === id ? "border-blue-500/50 bg-blue-500/10" : "border-white/[0.06] hover:border-white/20 bg-white/[0.02]"
                }`}
              >
                <span>{emoji}</span>
                <span className={`text-xs font-medium ${gender === id ? "text-blue-300" : "text-slate-400"}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Product cards */}
        {jobs.map(job => (
          <ProductCard
            key={job.id}
            job={job}
            canRemove={jobs.length > 1}
            onUpdate={u => updateJob(job.id, u)}
            onRemove={() => removeJob(job.id)}
            onLightbox={setLightbox}
            onDownload={download}
          />
        ))}

        {/* Add product */}
        <button
          onClick={addJob}
          className="w-full py-3.5 rounded-2xl border-2 border-dashed border-white/[0.07] hover:border-blue-500/30 hover:bg-blue-500/[0.02] text-slate-600 hover:text-blue-400 transition-all text-sm flex items-center justify-center gap-2"
        >
          <IcoPlus /> Agregar otro producto
        </button>
      </div>

      {/* ── STICKY GENERATE ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#07070f]/95 backdrop-blur-xl border-t border-white/[0.05] p-4 z-40">
        <div className="max-w-4xl mx-auto">
          {credits !== null && pendingCount > credits && (
            <p className="text-center text-xs text-amber-400 mb-2">
              ⚠ Créditos insuficientes — tenés {credits} y necesitás {pendingCount}
            </p>
          )}

          {/* Barra de progreso */}
          {isGenerating && genProgress && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">
                  Generando producto <span className="text-pink-400 font-semibold">{genProgress.current}</span> de {genProgress.total}...
                </span>
                <span className="text-xs text-slate-600">{Math.round((genProgress.current / genProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${(genProgress.current / genProgress.total) * 100}%`,
                    background: "linear-gradient(90deg, #ec4899, #f43f5e)",
                  }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateAll}
            disabled={isGenerating || !pendingCount || (credits !== null && credits === 0)}
            className="relative w-full py-4 rounded-2xl font-semibold text-sm transition-all overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group"
            style={{ background: isGenerating ? "#111128" : "linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)" }}
          >
            {!isGenerating && <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.06] transition-all" />}
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2 text-slate-400">
                <svg className="animate-spin h-4 w-4 text-pink-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Generando...
              </span>
            ) : pendingCount > 0 ? (
              <span className="flex items-center justify-center gap-2 text-white">
                <IcoBolt />
                Generar {pendingCount} producto{pendingCount !== 1 ? "s" : ""} · {pendingCount} crédito{pendingCount !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-slate-400">Agregá fotos a al menos un producto</span>
            )}
          </button>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-50 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <div className="relative max-w-sm w-full fade-up" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.label} className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setLightbox(null)} className="absolute top-3 right-3 bg-black/70 hover:bg-black/90 border border-white/10 text-white w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <IcoX />
            </button>
            <div className="mt-3 px-1">
              <p className="text-sm text-white font-semibold">{lightbox.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">1024×1536px · Alta calidad</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
