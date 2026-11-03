"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  GripVertical,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { buildDefaultVideoPrompt } from "@/src/lib/ai/generation-plan";
import { creditPacks } from "@/src/config/billing";
import { templates, type VideoTemplate } from "@/src/config/templates";
import { PaydunyaPurchaseButton } from "@/src/components/billing/PaydunyaPurchaseButton";
import { MAX_PHOTOS, SUPPORTED_IMAGE_TYPES } from "@/src/lib/storage/storage.types";
import { readTerrovaSettings } from "@/src/lib/settings";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/browser";
import { getSupabaseConfig } from "@/src/lib/env";
import type { GenerationStatus, VideoDuration, VideoRatio, VideoStyle } from "@/src/lib/video/video-provider";

type UploadedImage = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  key?: string;
  progress: number;
  status: "ready" | "uploading" | "uploaded" | "failed";
  error?: string;
};

type PropertyForm = {
  type: string;
  transaction: "Vente" | "Location" | "";
  district: string;
  comments: string;
};

const steps = ["Photos", "Parlons du bien", "Prompt final"];
const propertyTypes = ["Appartement", "Maison", "Villa", "Studio", "Commerce", "Autre"];
const transactions: Exclude<PropertyForm["transaction"], "">[] = ["Vente", "Location"];
const styleOptions = [
  { id: "elegant", label: "Élégant", text: "Présentation premium, propre et rassurante." },
  { id: "dynamic", label: "Dynamique", text: "Transitions rapides pour réseaux sociaux." },
  { id: "cinematic", label: "Cinématique", text: "Ambiance immersive et mise en scène haut de gamme." },
  { id: "minimal", label: "Minimaliste", text: "Rendu clair, sobre et contemporain." },
] as const;
const ratios = [
  { id: "9:16", label: "9:16", text: "TikTok / Reels / Shorts" },
  { id: "16:9", label: "16:9", text: "YouTube / site web" },
  { id: "1:1", label: "1:1", text: "Publications carrées" },
] as const;
const durations = [5, 10, 15] as const;
const propertyVisuals: Record<string, string> = {
  Appartement: "/images/template-appartement-moderne.png",
  Maison: "/images/terrova-demo-villa-almadies.png",
  Villa: "/images/template-villa-premium.png",
  Studio: "/images/template-location-airbnb.png",
  Commerce: "/images/template-visite-rapide.png",
  Autre: "/images/template-terrain-projet.png",
};
const transactionVisuals: Record<Exclude<PropertyForm["transaction"], "">, string> = {
  Vente: "/images/template-luxe.png",
  Location: "/images/template-location-airbnb.png",
};
const styleVisuals: Record<VideoStyle, string> = {
  elegant: "/images/template-appartement-moderne.png",
  dynamic: "/images/template-visite-rapide.png",
  cinematic: "/images/template-luxe.png",
  minimal: "/images/template-terrain-projet.png",
};
const generationDraftStorageKey = "terrova-generation-draft";

function isMissingAuthSession(error: unknown) {
  return error instanceof Error && (error.name === "AuthSessionMissingError" || error.message === "Auth session missing!");
}

type GenerationDraft = {
  guestSessionId?: string;
  images: Array<Omit<UploadedImage, "previewUrl">>;
  property: PropertyForm;
  prompt: string;
  promptCustomized: boolean;
  style: VideoStyle;
  ratio: VideoRatio;
  duration: VideoDuration;
  selectedTemplateId?: string;
};

export function CreateWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateAppliedRef = useRef(false);
  const [step, setStep] = useState(0);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [property, setProperty] = useState<PropertyForm>({
    type: "",
    transaction: "",
    district: "",
    comments: "",
  });
  const [prompt, setPrompt] = useState("");
  const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
  const [promptCustomized, setPromptCustomized] = useState(false);
  const promptCustomizedRef = useRef(false);
  const [promptPreparing, setPromptPreparing] = useState(false);
  const promptPreparationIdRef = useRef(0);
  const generationStartRef = useRef<(() => Promise<void>) | null>(null);
  const resumeHandledRef = useRef(false);
  const styleRef = useRef<(typeof styleOptions)[number]["id"]>("elegant");
  const ratioRef = useRef<(typeof ratios)[number]["id"]>("9:16");
  const durationRef = useRef<(typeof durations)[number]>(10);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsDialogStep, setDetailsDialogStep] = useState<0 | 1 | 2 | 3>(0);
  const [detailsReturnStep, setDetailsReturnStep] = useState<1 | 2>(1);
  const [style, setStyle] = useState<(typeof styleOptions)[number]["id"]>("elegant");
  const [ratio, setRatio] = useState<(typeof ratios)[number]["id"]>("9:16");
  const [duration, setDuration] = useState<(typeof durations)[number]>(10);
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [openRouterCostUsd, setOpenRouterCostUsd] = useState<number | null>(null);
  const [terrovaEstimate, setTerrovaEstimate] = useState<number | null>(null);
  const [estimateProvider, setEstimateProvider] = useState<"openrouter" | "demo" | null>(null);
  const [estimatingCost, setEstimatingCost] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateRefreshKey, setEstimateRefreshKey] = useState(0);
  const [draftRestored, setDraftRestored] = useState(() => searchParams.get("resume") !== "generation");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [checkingCredits, setCheckingCredits] = useState(false);
  const [generation, setGeneration] = useState<{
    jobId?: string;
    status: GenerationStatus | "idle";
    videoUrl?: string;
    message?: string;
  }>({ status: "idle" });

  const canContinue = useMemo(() => {
    return images.some((image) => image.status === "uploaded");
  }, [images]);
  const hasUploadingImage = images.some((image) => image.status === "uploading");

  useEffect(() => {
    if (templateAppliedRef.current) return;
    const templateId = searchParams.get("template");
    if (!templateId) {
      templateAppliedRef.current = true;
      return;
    }
    const template = templates.find((item) => item.id === templateId);
    templateAppliedRef.current = true;
    if (!template) return;
    // Le preset est une synchronisation explicite avec le paramètre de navigation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedTemplate(template);
    setStyle(template.style);
    styleRef.current = template.style;
    setRatio(template.ratio);
    ratioRef.current = template.ratio;
    setDuration(template.duration);
    durationRef.current = template.duration;
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("resume") !== "generation") return;

    try {
      const saved = window.localStorage.getItem(generationDraftStorageKey) ?? window.sessionStorage.getItem(generationDraftStorageKey);
      if (!saved) return;
      const draft = JSON.parse(saved) as GenerationDraft;
      if (!Array.isArray(draft.images) || !draft.property) return;
      // La restauration synchronise le brouillon externe avec l’état du wizard.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasSavedDraft(true);
      setGuestSessionId(draft.guestSessionId ?? null);
      setImages(draft.images.map((image) => ({ ...image, previewUrl: "" })));
      setProperty(draft.property);
      setPrompt(draft.prompt ?? "");
      setPromptCustomized(Boolean(draft.promptCustomized));
      promptCustomizedRef.current = Boolean(draft.promptCustomized);
      setStyle(draft.style);
      styleRef.current = draft.style;
      setRatio(draft.ratio);
      ratioRef.current = draft.ratio;
      setDuration(draft.duration);
      durationRef.current = draft.duration;
      setSelectedTemplate(draft.selectedTemplateId ? templates.find((template) => template.id === draft.selectedTemplateId) ?? null : null);
      setStep(2);
    } catch {
      window.localStorage.removeItem(generationDraftStorageKey);
      window.sessionStorage.removeItem(generationDraftStorageKey);
    } finally {
      setDraftRestored(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!getSupabaseConfig()) {
      void fetchCreditBalance(getSessionId()).then(setCreditBalance);
      return;
    }
    void createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (data.user) void fetchCreditBalance(getSessionId()).then(setCreditBalance);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const templateId = searchParams.get("template");
    if (templateId && templates.some((item) => item.id === templateId)) return;
    const savedSettings = readTerrovaSettings();
    // Les préférences sont une synchronisation explicite avec le stockage local du navigateur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStyle(savedSettings.defaultStyle);
    styleRef.current = savedSettings.defaultStyle;
    setRatio(savedSettings.defaultRatio);
    ratioRef.current = savedSettings.defaultRatio;
    setDuration(savedSettings.defaultDuration);
    durationRef.current = savedSettings.defaultDuration;
  }, [searchParams]);

  useEffect(() => {
    if (step !== 2 || prompt.trim().length < 20 || !images.some((image) => image.key)) return;
    const timeout = window.setTimeout(async () => {
      setEstimatingCost(true);
      setEstimateError(null);
      try {
        const response = await fetch("/api/generations/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: guestSessionId ?? getSessionId(),
            ...(guestSessionId ? { guestSessionId } : {}),
            images: images.filter((image) => image.key).map((image) => ({ key: image.key })),
            property: {
              type: property.type.toLowerCase(),
              transaction: property.transaction,
              district: property.district || undefined,
              comments: property.comments || undefined,
            },
            video: {
              style,
              ratio,
              duration,
              prompt: prompt.trim(),
              templateInstructions: selectedTemplate?.instructions,
              platform: ratio === "16:9" ? "youtube" : "instagram",
            },
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          providerCostUsd?: number;
          terrovaCredits?: number;
          provider?: "openrouter" | "demo";
          error?: string;
          reason?: string;
        } | null;
        if (!response.ok) throw new Error(payload?.reason ?? payload?.error ?? "Estimation indisponible.");
        setEstimateProvider(payload?.provider ?? null);
        setOpenRouterCostUsd(typeof payload?.providerCostUsd === "number" ? payload.providerCostUsd : null);
        setTerrovaEstimate(typeof payload?.terrovaCredits === "number" ? payload.terrovaCredits : null);
      } catch (error) {
        setOpenRouterCostUsd(null);
        setTerrovaEstimate(null);
        setEstimateProvider(null);
        setEstimateError(error instanceof Error ? error.message : "Estimation indisponible.");
      } finally {
        setEstimatingCost(false);
      }
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [duration, estimateRefreshKey, guestSessionId, images, property, prompt, ratio, searchParams, selectedTemplate, step, style]);

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    setError(null);
    const selected = Array.from(fileList);
    const accepted: UploadedImage[] = [];

    for (const file of selected) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
        setError("Format non supporté. Utilisez JPG, PNG ou WebP.");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("Une photo dépasse 8 Mo. Ajoutez une image plus légère.");
        continue;
      }
      if (images.length + accepted.length >= MAX_PHOTOS) {
        setError(`Vous pouvez ajouter jusqu'à ${MAX_PHOTOS} photos.`);
        break;
      }
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: "uploading",
      });
    }

    let uploadSessionId = guestSessionId ?? getSessionId();
    let isAuthenticated = false;
    if (getSupabaseConfig()) {
      const { data } = await createSupabaseBrowserClient().auth.getUser();
      isAuthenticated = Boolean(data.user);
    }
    if (getSupabaseConfig() && !isAuthenticated && !guestSessionId) {
      const response = await fetch("/api/guest-session", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { sessionId?: string; error?: string } | null;
      if (!response.ok || typeof payload?.sessionId !== "string") {
        setError(payload?.error ?? "Impossible d'initialiser la session invitée. Réessayez.");
        return;
      }
      uploadSessionId = payload.sessionId;
      setGuestSessionId(uploadSessionId);
    }

    setImages((current) => [...current, ...accepted]);
    await Promise.all(accepted.map((image, index) => uploadImage(image, selected[index], uploadSessionId)));
  }

  async function uploadImage(image: UploadedImage, file: File, uploadSessionId: string) {
    try {
      const response = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
          sessionId: uploadSessionId,
        }),
      });

      if (!response.ok) throw new Error("signature");
      const payload = (await response.json()) as { uploadUrl: string; key: string; demo?: boolean };

      setImages((current) =>
        current.map((item) =>
          item.id === image.id ? { ...item, key: payload.key, progress: 35 } : item,
        ),
      );

      if (!payload.demo) {
        const upload = await fetch(payload.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!upload.ok) throw new Error("upload");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 450));
      }

      setImages((current) =>
        current.map((item) =>
          item.id === image.id
            ? { ...item, key: payload.key, progress: 100, status: "uploaded" }
            : item,
        ),
      );
    } catch {
      setImages((current) =>
        current.map((item) =>
          item.id === image.id
            ? { ...item, status: "failed", error: "Upload impossible. Réessayez." }
            : item,
        ),
      );
      setError(
        "L'upload vers R2 a échoué. Vérifiez la configuration CORS du bucket, ou continuez en démo locale pour tester le parcours.",
      );
    }
  }

  function continueWithLocalDemo() {
    setImages((current) =>
      current.map((image) => {
        if (image.status !== "failed") return image;
        const extension =
          image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        return {
          ...image,
          key: `temp/${guestSessionId ?? getSessionId()}/input/${crypto.randomUUID()}.${extension}`,
          progress: 100,
          status: "uploaded",
          error: undefined,
        };
      }),
    );
    setError("Mode démo locale activé pour cette photo. Vous pouvez continuer le parcours.");
  }

  function saveGenerationDraft(draft: GenerationDraft) {
    try {
      window.localStorage.setItem(generationDraftStorageKey, JSON.stringify(draft));
    } catch {
      setError("Impossible de conserver votre projet pendant la connexion. Réessayez depuis le même navigateur.");
    }
  }

  function saveCurrentGenerationDraft(includeGuestSession = false) {
    saveGenerationDraft({
      ...(includeGuestSession ? { guestSessionId: guestSessionId ?? getSessionId() } : guestSessionId ? { guestSessionId } : {}),
      images,
      property,
      prompt,
      promptCustomized,
      style,
      ratio,
      duration,
      selectedTemplateId: selectedTemplate?.id,
    });
  }

  async function startGeneration() {
    if (generation.status !== "idle" || terrovaEstimate === null || checkingCredits) return;
    setCheckingCredits(true);
    try {
      if (!getSupabaseConfig()) {
        await launchGeneration();
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError && !isMissingAuthSession(authError)) throw authError;
      if (data.user) {
        await launchGeneration();
        return;
      }
      setCreditDialogOpen(true);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Impossible de vérifier votre compte.");
    } finally {
      setCheckingCredits(false);
    }
  }

  async function launchGeneration() {
    setError(null);

    if (getSupabaseConfig()) {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError && !isMissingAuthSession(authError)) throw authError;
        if (!data.user) {
          saveCurrentGenerationDraft(true);
          router.push(`/login?next=${encodeURIComponent("/create?resume=generation")}`);
          return;
        }
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Connexion requise pour lancer la vidéo.");
        return;
      }
    }

    if (terrovaEstimate !== null && creditBalance !== null && creditBalance < terrovaEstimate) {
      saveCurrentGenerationDraft();
      setCreditDialogOpen(true);
      return;
    }

    setCreditDialogOpen(false);
    setGeneration({ status: "pending", message: "Photos reçues" });
    setStep(2);
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          ...(guestSessionId ? { guestSessionId } : {}),
          images: images.filter((image) => image.key).map((image) => ({ key: image.key })),
          property: {
            type: property.type.toLowerCase(),
            transaction: property.transaction,
            district: property.district || undefined,
            comments: property.comments || undefined,
          },
          video: {
            style,
            ratio,
            duration,
            // Le prompt de secours est utilisé uniquement si la proposition est vide.
            prompt: prompt.trim() || buildPrompt(),
            templateInstructions: selectedTemplate?.instructions,
            platform: ratio === "16:9" ? "youtube" : "instagram",
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; jobId?: string; status?: GenerationStatus } | null;
      if (response.status === 401) {
        saveCurrentGenerationDraft(true);
        router.push(`/login?next=${encodeURIComponent("/create?resume=generation")}`);
        return;
      }
      if (response.status === 402) {
        saveCurrentGenerationDraft();
        setGeneration({ status: "idle" });
        setCreditDialogOpen(true);
        return;
      }
      if (!response.ok || typeof payload?.jobId !== "string" || !payload.status) {
        throw new Error(payload?.error ?? "La génération n'a pas pu démarrer.");
      }
      window.localStorage.removeItem(generationDraftStorageKey);
      window.sessionStorage.removeItem(generationDraftStorageKey);
      const created: { jobId: string; status: GenerationStatus } = {
        jobId: payload.jobId,
        status: payload.status,
      };
      setGeneration({ jobId: created.jobId, status: created.status });
      void fetchCreditBalance(getSessionId()).then(setCreditBalance);
      // Le polling conserve le comportement asynchrone existant du wizard.
      pollGeneration(created.jobId);
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "La génération a échoué.";
      setError(message);
      setGeneration({ status: "failed", message });
    }
  }

  useEffect(() => {
    generationStartRef.current = launchGeneration;
  });

  useEffect(() => {
    if (searchParams.get("resume") !== "generation" || !draftRestored || !hasSavedDraft || resumeHandledRef.current) return;
    const paymentStatus = searchParams.get("payment");
    if (paymentStatus && paymentStatus !== "completed") return;
    resumeHandledRef.current = true;
    void generationStartRef.current?.();
  }, [draftRestored, hasSavedDraft, searchParams]);

  function buildPrompt() {
    return buildDefaultVideoPrompt({
      sessionId: guestSessionId ?? getSessionId(),
      images: images.filter((image) => image.key).map((image) => ({ key: image.key! })),
      property: {
        type: property.type.toLowerCase(),
        transaction: property.transaction,
        district: property.district || undefined,
        comments: property.comments || undefined,
      },
      video: { style, ratio, duration, templateInstructions: selectedTemplate?.instructions },
    });
  }

  async function prepareIntelligentPrompt(
    nextProperty: PropertyForm,
    nextStyle: "elegant" | "dynamic" | string,
    nextRatio: "9:16" | "16:9" | string,
    nextDuration: VideoDuration,
  ) {
    if (promptCustomizedRef.current) return;
    const preparationId = promptPreparationIdRef.current + 1;
    promptPreparationIdRef.current = preparationId;
    setPrompt("");
    setPromptPreparing(true);

    try {
      const response = await fetch("/api/generation-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: guestSessionId ?? getSessionId(),
          ...(guestSessionId ? { guestSessionId } : {}),
          images: images.filter((image) => image.key).map((image) => ({ key: image.key })),
          property: {
            type: nextProperty.type.toLowerCase(),
            transaction: nextProperty.transaction,
            district: nextProperty.district || undefined,
            comments: nextProperty.comments || undefined,
          },
          video: {
            style: nextStyle,
            ratio: nextRatio,
            duration: nextDuration,
            templateInstructions: selectedTemplate?.instructions,
            platform: nextRatio === "16:9" ? "youtube" : "instagram",
          },
        }),
      });
      const payload = (await response.json().catch(() => null)) as { prompt?: string; error?: string; reason?: string } | null;
      if (!response.ok || !payload?.prompt) {
        throw new Error(payload?.reason ?? payload?.error ?? "Le prompt intelligent n'a pas pu être préparé.");
      }
      if (preparationId === promptPreparationIdRef.current && !promptCustomizedRef.current) {
        setPrompt(payload.prompt);
      }
    } catch (error) {
      if (preparationId === promptPreparationIdRef.current && !promptCustomizedRef.current) {
        setPrompt(buildPromptForReview(nextProperty, nextStyle, nextRatio, nextDuration, selectedTemplate?.instructions));
        setError(error instanceof Error ? error.message : "Le prompt intelligent n'a pas pu être préparé.");
      }
    } finally {
      if (preparationId === promptPreparationIdRef.current) setPromptPreparing(false);
    }
  }

  function finishDetails() {
    setDetailsDialogOpen(false);
    setStep(2);
    setPromptCustomized(false);
    promptCustomizedRef.current = false;
    setPrompt("");
    void prepareIntelligentPrompt(property, style, ratio, duration);
  }

  function handleNext() {
    if (step === 0) {
      setDetailsDialogStep(0);
      setDetailsReturnStep(1);
      setDetailsDialogOpen(true);
      setStep(1);
    }
  }

  function handleBack() {
    if (step === 2) {
      setDetailsDialogStep(0);
      setDetailsReturnStep(2);
      setDetailsDialogOpen(true);
      setStep(1);
      return;
    }
    setStep(0);
  }

  async function pollGeneration(jobId: string) {
    let delay = 750;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const response = await fetch(`/api/generations/${jobId}`);
        const payload = (await response.json()) as {
          status: GenerationStatus;
          videoUrl?: string;
          message?: string;
        };
        const displayStatus = payload.status === "pending"
          ? attempt === 0 ? "pending" : attempt === 1 ? "analyzing" : "processing"
          : payload.status;
        setGeneration({
          jobId,
          status: displayStatus,
          videoUrl: payload.videoUrl,
          message: payload.message,
        });
        if (payload.status === "completed" || payload.status === "failed") {
          void fetchCreditBalance(getSessionId()).then(setCreditBalance);
          return;
        }
      } catch {
        setGeneration({ jobId, status: "processing", message: "Connexion instable, nouvel essai en cours." });
      }
      delay = Math.min(10000, Math.round(delay * 1.35));
    }
    setGeneration({ jobId, status: "processing", message: "La génération continue en arrière-plan. Actualisez cette page dans un instant." });
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((label, index) => (
          <button
            className="step-button"
            disabled={index > step || (index === 1 && images.length === 0)}
            key={label}
            onClick={() => {
              if (index === 1) {
                setDetailsDialogStep(0);
                setDetailsReturnStep(step === 2 ? 2 : 1);
                setDetailsDialogOpen(true);
              }
              setStep(index);
            }}
            type="button"
          >
            <span className={index <= step ? "step-index step-index-active" : "step-index"}>
              {index + 1}
            </span>
            <span className="text-left">
              <strong>{label}</strong>
            <small>{index === 0 ? "Ajoutez vos photos" : index === 1 ? "Quelques informations" : "Proposition modifiable"}</small>
            </span>
          </button>
        ))}
      </div>

      {error ? <p className="mt-5 rounded-xl bg-[#fff3ee] p-4 text-sm text-[#9d311f]">{error}</p> : null}

      <section className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-soft sm:p-6">
        {step === 0 ? (
          <PhotoStep
            images={images}
            onAdd={addFiles}
            onContinueDemo={continueWithLocalDemo}
            onRemove={(id) => setImages((items) => items.filter((item) => item.id !== id))}
          />
        ) : null}
        {step === 2 ? (
          <PromptStep
            generation={generation}
            creditBalance={creditBalance}
            estimateError={estimateError}
            estimateProvider={estimateProvider}
            estimatingCost={estimatingCost}
            openRouterCostUsd={openRouterCostUsd}
            terrovaEstimate={terrovaEstimate}
            creditDialogOpen={creditDialogOpen}
            checkingCredits={checkingCredits}
            onCloseCreditDialog={() => setCreditDialogOpen(false)}
            onContinueWithCredits={() => void launchGeneration()}
            onRefreshEstimate={() => {
              setOpenRouterCostUsd(null);
              setTerrovaEstimate(null);
              setEstimateError(null);
              setEstimateRefreshKey((value) => value + 1);
            }}
            property={property}
            prompt={prompt}
            promptCustomized={promptCustomized}
            promptPreparing={promptPreparing}
            ratio={ratio}
            selectedTemplate={selectedTemplate}
            restart={() => {
              setImages([]);
              setProperty({ type: "", transaction: "", district: "", comments: "" });
              setPrompt("");
              setPromptCustomized(false);
              promptCustomizedRef.current = false;
              promptPreparationIdRef.current += 1;
              setPromptPreparing(false);
              setStyle("elegant");
              styleRef.current = "elegant";
              setRatio("9:16");
              ratioRef.current = "9:16";
              setDuration(10);
              durationRef.current = 10;
              setGeneration({ status: "idle" });
              setSelectedTemplate(null);
              templateAppliedRef.current = true;
              setStep(0);
            }}
            startGeneration={startGeneration}
            preparePrompt={(nextStyle, nextRatio, nextDuration) => prepareIntelligentPrompt(property, nextStyle, nextRatio, nextDuration)}
            style={style}
            duration={duration}
            setDuration={(value) => {
              setDuration(value);
              durationRef.current = value;
            }}
            setPrompt={setPrompt}
            setPromptCustomized={(value) => {
              setPromptCustomized(value);
              promptCustomizedRef.current = value;
            }}
            setRatio={(value) => {
              setRatio(value);
              ratioRef.current = value;
            }}
            setStyle={(value) => {
              setStyle(value);
              styleRef.current = value;
            }}
          />
        ) : null}
      </section>

      <PropertyDetailsDialog
        onCancel={() => {
          setDetailsDialogOpen(false);
          setStep(detailsReturnStep === 1 ? 0 : 2);
        }}
        onComplete={finishDetails}
        open={detailsDialogOpen}
        property={property}
        setProperty={setProperty}
        step={detailsDialogStep}
        setStep={setDetailsDialogStep}
      />

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button className="btn-secondary justify-center" disabled={step === 0} onClick={handleBack} type="button">
          <ArrowLeft size={17} /> Retour
        </button>
        {step === 0 ? (
          <button className="btn-primary justify-center disabled:opacity-45" disabled={!canContinue || hasUploadingImage} onClick={handleNext} type="button">
            {step === 0 && hasUploadingImage ? "Upload en cours..." : "Suivant"}
            <ArrowRight size={17} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function PhotoStep({
  images,
  onAdd,
  onContinueDemo,
  onRemove,
}: {
  images: UploadedImage[];
  onAdd: (files: FileList | null) => void;
  onContinueDemo: () => void;
  onRemove: (id: string) => void;
}) {
  const hasFailedUpload = images.some((image) => image.status === "failed");

  return (
    <div>
      <h2 className="text-xl font-black">Ajoutez vos photos</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Glissez-déposez ou sélectionnez jusqu'à {MAX_PHOTOS} photos.
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
        <label
          className="grid min-h-56 cursor-pointer place-items-center rounded-2xl border border-dashed border-[#cfcbbf] bg-[var(--surface-secondary)]/55 p-5 text-center transition hover:bg-[var(--primary-soft)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            onAdd(event.dataTransfer.files);
          }}
        >
          <input className="sr-only" type="file" accept={SUPPORTED_IMAGE_TYPES.join(",")} multiple onChange={(event) => onAdd(event.target.files)} />
          <span>
            <ImagePlus className="mx-auto text-[var(--primary)]" size={36} />
            <strong className="mt-4 block">Glissez vos photos ici</strong>
            <span className="mt-2 block text-sm text-[var(--text-secondary)]">JPG, PNG ou WebP · 8 Mo max</span>
            <span className="btn-primary mt-4 inline-flex"><Upload size={16} /> Sélectionner des photos</span>
          </span>
        </label>
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {images.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] p-5 text-sm text-[var(--text-secondary)]">
              Les aperçus de vos photos apparaîtront ici.
            </div>
          ) : null}
          {images.map((image) => (
            <article className="relative rounded-2xl border border-[var(--border)] bg-white p-2 shadow-soft" key={image.id}>
              {image.previewUrl ? (
                <img alt="" className="h-32 w-full rounded-xl object-cover" src={image.previewUrl} />
              ) : (
                <div className="grid h-32 place-items-center rounded-xl bg-[var(--surface-secondary)] text-center text-xs font-semibold text-[var(--text-secondary)]">Photo conservée pour la génération</div>
              )}
              <button className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white shadow-soft" onClick={() => onRemove(image.id)} type="button" aria-label="Supprimer la photo">
                <Trash2 size={15} />
              </button>
              <div className="mt-3 flex items-center gap-2 px-1 text-xs text-[var(--text-secondary)]">
                <GripVertical size={14} />
                <span className="min-w-0 flex-1 truncate">{image.name}</span>
                {image.status === "uploaded" ? <Check className="text-[var(--success)]" size={15} /> : null}
                {image.status === "failed" ? <XCircle className="text-[#b33a2b]" size={15} /> : null}
                {image.status === "uploading" ? <Loader2 className="animate-spin" size={15} /> : null}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                <span className="block h-full bg-[var(--primary)] transition-all" style={{ width: `${image.progress}%` }} />
              </div>
              <p className="mt-2 px-1 text-xs text-[var(--text-secondary)]">
                {image.status === "uploading" ? "Upload en cours..." : null}
                {image.status === "uploaded" ? "Photo envoyée. Vous pouvez continuer." : null}
                {image.status === "failed" ? image.error ?? "Upload échoué." : null}
              </p>
            </article>
          ))}
        </div>
      </div>
      {hasFailedUpload ? (
        <button className="btn-secondary mt-5" onClick={onContinueDemo} type="button">
          Continuer en démo locale
        </button>
      ) : null}
      <p className="mt-5 text-sm text-[var(--text-secondary)]">
        Conseil : des photos lumineuses et nettes donnent de meilleurs résultats.
      </p>
    </div>
  );
}

function useDialogFocus(open: boolean, onCancel: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    dialog?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled]), input, textarea, a[href]"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return dialogRef;
}

function PropertyDetailsDialog({
  onCancel,
  onComplete,
  open,
  property,
  setProperty,
  step,
  setStep,
}: {
  onCancel: () => void;
  onComplete: () => void;
  open: boolean;
  property: PropertyForm;
  setProperty: Dispatch<SetStateAction<PropertyForm>>;
  step: 0 | 1 | 2 | 3;
  setStep: (value: 0 | 1 | 2 | 3) => void;
}) {
  const dialogRef = useDialogFocus(open, onCancel);
  const [advancing, setAdvancing] = useState(false);
  const [stepPhase, setStepPhase] = useState<"idle" | "enter" | "exit">("idle");
  const advancingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (advancingTimerRef.current !== null) window.clearTimeout(advancingTimerRef.current);
    };
  }, []);

  if (!open) return null;

  const titles = ["Quel est le type de bien ?", "Que souhaitez-vous faire ?", "Où se trouve le bien ?", "Avez-vous un commentaire ?"];
  const canAdvance = step === 0 ? Boolean(property.type) : step === 1 ? Boolean(property.transaction) : true;
  const animateToStep = (nextStep: 1 | 2) => {
    if (advancing) return;
    setAdvancing(true);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 0 : 260;
    advancingTimerRef.current = window.setTimeout(() => {
      setStepPhase(reducedMotion ? "enter" : "exit");
      advancingTimerRef.current = window.setTimeout(() => {
        setStep(nextStep);
        setStepPhase("enter");
        setAdvancing(false);
      }, reducedMotion ? 0 : 160);
    }, delay);
  };
  const chooseType = (type: string) => {
    if (advancing) return;
    setProperty((value) => ({ ...value, type }));
    animateToStep(1);
  };
  const chooseTransaction = (transaction: Exclude<PropertyForm["transaction"], "">) => {
    if (advancing) return;
    setProperty((value) => ({ ...value, transaction }));
    animateToStep(2);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111713]/45 p-4" role="presentation">
      <div
        aria-labelledby="property-dialog-title"
        aria-modal="true"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_28px_80px_rgba(17,23,19,0.24)] sm:p-8"
        role="dialog"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              <Sparkles size={15} /> Étape {step + 1} sur 4
            </div>
            <h2 className="mt-4 text-2xl font-black" id="property-dialog-title">{titles[step]}</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Quelques choix suffisent pour adapter la visite vidéo à votre bien.
            </p>
          </div>
          <button aria-label="Fermer" className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-secondary)]" onClick={onCancel} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="mt-7 flex gap-2" aria-label="Progression du formulaire">
          {[0, 1, 2, 3].map((index) => <span className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--primary)]" : "bg-[var(--surface-secondary)]"}`} key={index} />)}
        </div>
        <div aria-live="polite" className="wizard-dialog-status mt-5 text-sm font-semibold text-[var(--primary)]">{advancing ? "Choix confirmé" : null}</div>

        <div className={`wizard-dialog-step ${stepPhase === "exit" ? "wizard-dialog-step-exit" : ""} ${stepPhase === "enter" ? "wizard-dialog-step-enter" : ""}`} key={step}>
        {step === 0 ? (
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {propertyTypes.map((type) => (
              <button aria-pressed={property.type === type} className={`choice-card text-left ${property.type === type ? "choice-card-active" : ""} ${advancing && property.type === type ? "wizard-choice-confirming" : ""}`} disabled={advancing} key={type} onClick={() => chooseType(type)} type="button">
                <span className="choice-visual" style={{ backgroundImage: `url('${propertyVisuals[type]}')` }} />
                <strong>{type}</strong>
                <small>Créer une visite cohérente de ce bien</small>
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {transactions.map((transaction) => (
              <button aria-pressed={property.transaction === transaction} className={`choice-card text-left ${property.transaction === transaction ? "choice-card-active" : ""} ${advancing && property.transaction === transaction ? "wizard-choice-confirming" : ""}`} disabled={advancing} key={transaction} onClick={() => chooseTransaction(transaction)} type="button">
                <span className="choice-visual" style={{ backgroundImage: `url('${transactionVisuals[transaction]}')` }} />
                <strong>{transaction}</strong>
                <small>{transaction === "Vente" ? "Mettre le bien en valeur pour les acheteurs" : "Présenter le bien pour les locataires"}</small>
              </button>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <label className="field wizard-dialog-text-step">
            <span>Quartier <em className="font-normal not-italic text-[var(--text-secondary)]">(facultatif)</em></span>
            <input placeholder="Almadies, Mermoz, Ngor..." value={property.district} onChange={(event) => setProperty((value) => ({ ...value, district: event.target.value }))} />
            <small>La ville n’est pas nécessaire. Vous pouvez passer cette étape.</small>
          </label>
        ) : null}

        {step === 3 ? (
          <label className="field wizard-dialog-text-step">
            <span>Commentaires <em className="font-normal not-italic text-[var(--text-secondary)]">(facultatif)</em></span>
            <textarea placeholder="Une ambiance, un point fort, une consigne ou toute autre précision..." rows={6} value={property.comments} onChange={(event) => setProperty((value) => ({ ...value, comments: event.target.value }))} />
            <small>Ces indications pourront être utilisées pour personnaliser le prompt vidéo.</small>
          </label>
        ) : null}
        </div>

        <div className="mt-10 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button className="btn-secondary justify-center" disabled={step === 0 || advancing} onClick={() => setStep((step - 1) as 0 | 1 | 2 | 3)} type="button">
            <ArrowLeft size={16} /> Retour
          </button>
          {step === 2 && !property.district ? (
            <button className="btn-secondary justify-center" onClick={() => setStep(3)} type="button">Passer cette étape <ArrowRight size={16} /></button>
          ) : null}
          {step === 3 && !property.comments ? (
            <button className="btn-secondary justify-center" onClick={onComplete} type="button">Passer cette étape <ArrowRight size={16} /></button>
          ) : null}
          {step === 2 || step === 3 ? <button className="btn-primary justify-center" disabled={!canAdvance} onClick={() => step < 3 ? setStep((step + 1) as 0 | 1 | 2 | 3) : onComplete()} type="button">
            {step < 3 ? "Continuer" : "Terminer"} <ArrowRight size={16} />
          </button> : null}
        </div>
      </div>
    </div>
  );
}

function StyleStep({
  duration,
  ratio,
  setDuration,
  setRatio,
  setStyle,
  style,
}: {
  duration: VideoDuration;
  ratio: VideoRatio;
  setDuration: (value: VideoDuration) => void;
  setRatio: (value: VideoRatio) => void;
  setStyle: (value: VideoStyle) => void;
  style: VideoStyle;
}) {
  return (
    <div>
      <h2 className="text-xl font-black">Réglages vidéo</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {styleOptions.map((option) => (
          <button aria-pressed={style === option.id} className={`choice-card ${style === option.id ? "choice-card-active" : ""}`} key={option.id} onClick={() => setStyle(option.id)} type="button">
            <span className="choice-visual" style={{ backgroundImage: `url('${styleVisuals[option.id]}')` }} />
            <strong>{option.label}{option.id === "elegant" ? " · par défaut" : ""}</strong>
            <small>{option.text}</small>
          </button>
        ))}
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-black">Format vidéo</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ratios.map((option) => (
              <button aria-pressed={ratio === option.id} className={`option-pill ${ratio === option.id ? "option-pill-active" : ""}`} key={option.id} onClick={() => setRatio(option.id)} type="button">
                <strong>{option.label}{option.id === "9:16" ? " · par défaut" : ""}</strong>
                <small>{option.text}</small>
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-black">Durée</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {durations.map((option) => (
              <button aria-pressed={duration === option} className={`option-pill ${duration === option ? "option-pill-active" : ""}`} key={option} onClick={() => setDuration(option)} type="button">
                <strong>{option} secondes{option === 10 ? " · par défaut" : ""}</strong>
                <small>Rendu concis</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PromptStep({
  generation,
  creditBalance,
  estimateError,
  estimateProvider,
  estimatingCost,
  openRouterCostUsd,
  onRefreshEstimate,
  property,
  prompt,
  promptCustomized,
  promptPreparing,
  ratio,
  selectedTemplate,
  restart,
  preparePrompt,
  startGeneration,
  style,
  duration,
  setDuration,
  setPrompt,
  setPromptCustomized,
  setRatio,
  setStyle,
  terrovaEstimate,
  creditDialogOpen,
  checkingCredits,
  onCloseCreditDialog,
  onContinueWithCredits,
}: {
  generation: { status: GenerationStatus | "idle"; videoUrl?: string; message?: string };
  creditBalance: number | null;
  estimateError: string | null;
  estimateProvider: "openrouter" | "demo" | null;
  estimatingCost: boolean;
  openRouterCostUsd: number | null;
  terrovaEstimate: number | null;
  creditDialogOpen: boolean;
  checkingCredits: boolean;
  onCloseCreditDialog: () => void;
  onContinueWithCredits: () => void;
  onRefreshEstimate: () => void;
  property: PropertyForm;
  prompt: string;
  promptCustomized: boolean;
  promptPreparing: boolean;
  ratio: VideoRatio;
  selectedTemplate: VideoTemplate | null;
  restart: () => void;
  preparePrompt: (style: VideoStyle, ratio: VideoRatio, duration: VideoDuration) => void;
  startGeneration: () => void;
  style: VideoStyle;
  duration: VideoDuration;
  setDuration: (value: VideoDuration) => void;
  setPrompt: (value: string) => void;
  setPromptCustomized: (value: boolean) => void;
  setRatio: (value: VideoRatio) => void;
  setStyle: (value: VideoStyle) => void;
}) {
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [errorDialogDismissed, setErrorDialogDismissed] = useState(false);
  const preparationMessages = [
    "Analyse de vos photos…",
    "Repérage des pièces et des points forts…",
    "Préparation de votre visite vidéo…",
  ];
  const [preparationMessageIndex, setPreparationMessageIndex] = useState(0);
  const completed = generation.status === "completed";
  const failed = generation.status === "failed";
  const errorDialogOpen = failed && !errorDialogDismissed;
  const creditCost = terrovaEstimate;
  const updateStyle = (value: VideoStyle) => {
    setStyle(value);
    if (!promptCustomized) void preparePromptForSettings(value, ratio, duration);
  };
  const updateRatio = (value: VideoRatio) => {
    setRatio(value);
    if (!promptCustomized) void preparePromptForSettings(style, value, duration);
  };
  const updateDuration = (value: VideoDuration) => {
    setDuration(value);
    if (!promptCustomized) void preparePromptForSettings(style, ratio, value);
  };
  const preparePromptForSettings = async (
    nextStyle: VideoStyle,
    nextRatio: VideoRatio,
    nextDuration: VideoDuration,
  ) => {
    await preparePrompt(nextStyle, nextRatio, nextDuration);
  };
  useEffect(() => {
    if (!promptPreparing) return;
    const interval = window.setInterval(() => {
      setPreparationMessageIndex((value) => (value + 1) % preparationMessages.length);
    }, 2200);
    return () => window.clearInterval(interval);
  }, [promptPreparing, preparationMessages.length]);
  const stateRows = [
    { label: "Photos reçues", done: generation.status !== "idle" },
    { label: "Analyse du bien", done: ["analyzing", "generating", "processing", "completed"].includes(generation.status) },
    { label: "Création de la vidéo", done: ["generating", "processing", "completed"].includes(generation.status) },
    { label: "Finalisation", done: ["processing", "completed"].includes(generation.status) },
  ];

  if (completed) {
    return (
      <div>
        <h2 className="text-2xl font-black">Votre vidéo est prête.</h2>
        <p className="mt-2 text-[var(--text-secondary)]">La visite est assemblée à partir de vos photos et de vos réglages.</p>
        <button aria-label="Ouvrir l’aperçu vidéo" className="mt-6 grid min-h-[340px] w-full place-items-center rounded-3xl bg-[linear-gradient(135deg,#1d5c37,#101713)] text-left text-white transition hover:scale-[1.01]" onClick={() => setShowVideoPreview(true)} type="button">
          <span className="text-center">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-white/18"><Play fill="currentColor" size={34} /></span>
            <strong className="mt-5 block text-lg">Voir la vidéo</strong>
            <span className="mt-2 block text-sm text-white/72">Ouvrir l’aperçu dans une fenêtre</span>
          </span>
        </button>
        <div className="mt-5 grid gap-5 rounded-2xl border border-[var(--border)] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h3 className="font-black">{property.type}{property.district ? ` · ${property.district}` : ""}</h3>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{property.transaction} · {styleOptions.find((option) => option.id === style)?.label ?? style} · {ratio} · {duration} secondes</p>
          </div>
          <div className="flex flex-wrap gap-3 sm:justify-end">
            {generation.videoUrl ? <a className="btn-primary justify-center" href={generation.videoUrl} download><Download size={17} /> Télécharger</a> : null}
            <button className="btn-secondary justify-center" type="button" onClick={startGeneration}><RefreshCw size={17} /> Régénérer</button>
          </div>
        </div>
        <button className="mt-4 text-sm font-bold text-[var(--primary)]" type="button" onClick={restart}>Créer une nouvelle vidéo</button>
        {showVideoPreview ? <VideoPreviewDialog onClose={() => setShowVideoPreview(false)} videoUrl={generation.videoUrl} /> : null}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-black">Préparez votre vidéo</h2>
      <p className="mt-2 text-[var(--text-secondary)]">Ajustez le texte et les réglages avant de lancer la visite.</p>
      {selectedTemplate ? (
        <div className="mt-4 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-soft)] p-4 text-sm">
          <strong className="block">Modèle utilisé : {selectedTemplate.name}</strong>
          <span className="mt-1 block text-[var(--text-secondary)]">Ses consignes sont incluses dans le prompt et ses réglages ont été appliqués.</span>
        </div>
      ) : null}
      {promptPreparing ? <p className="mt-4 flex items-center gap-2 text-sm text-[var(--text-secondary)]" role="status"><Sparkles className="text-[var(--primary)]" size={16} /> {preparationMessages[preparationMessageIndex]}</p> : null}
      {generation.status === "idle" ? (
        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="block">Coût OpenRouter estimé</strong>
              <span className="mt-1 block text-[var(--text-secondary)]">
                {estimatingCost
                  ? "Calcul en cours…"
                  : openRouterCostUsd !== null
                    ? `${openRouterCostUsd.toFixed(2)} USD`
                    : estimateProvider === "demo"
                      ? "Non disponible en mode démo"
                      : "Estimation indisponible"}
              </span>
            </div>
            <button className="btn-secondary" onClick={onRefreshEstimate} type="button" disabled={estimatingCost}>Actualiser</button>
          </div>
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Consommation Terrova prévue : {creditCost === null ? "indisponible sans configuration OpenRouter" : `${creditCost} crédits`}.</p>
          {estimateError ? <p className="mt-2 text-xs text-[#9d311f]">{estimateError}</p> : null}
        </div>
      ) : null}
      {generation.status === "idle" ? <button className="btn-primary mt-5" disabled={promptPreparing || prompt.trim().length < 20 || creditCost === null || estimatingCost || checkingCredits} type="button" onClick={() => void startGeneration()}>{promptPreparing ? "Préparation du prompt…" : checkingCredits ? "Vérification du compte…" : "Générer la vidéo"} <ArrowRight size={17} /></button> : null}
      {generation.status === "idle" ? <p className="mt-3 text-sm text-[var(--text-secondary)]">{creditCost === null ? "La configuration OpenRouter est nécessaire avant de lancer la vidéo." : `Cette vidéo consommera ${creditCost} crédits${creditBalance !== null ? ` · solde disponible : ${creditBalance}` : ""}.`}</p> : null}
      {generation.status === "idle" || failed ? (
        <>
          <label className="field mt-6">
            <span>Prompt</span>
            <textarea aria-describedby="prompt-help" rows={11} value={prompt} onChange={(event) => { setPrompt(event.target.value); setPromptCustomized(true); }} />
            <small id="prompt-help">Vous pouvez le modifier avant l’envoi.</small>
          </label>
          <button className="btn-secondary mt-4" onClick={() => { setPrompt(""); setPromptCustomized(false); void preparePrompt(style, ratio, duration); }} type="button"><RefreshCw size={16} /> Régénérer la proposition IA</button>
          <div className="mt-8"><StyleStep duration={duration} ratio={ratio} setDuration={updateDuration} setRatio={updateRatio} setStyle={updateStyle} style={style} /></div>
        </>
      ) : null}
      {errorDialogOpen ? <GenerationErrorDialog onClose={() => setErrorDialogDismissed(true)} onRetry={() => { setErrorDialogDismissed(false); startGeneration(); }} /> : null}
      {generation.status !== "idle" && !failed ? <GenerationProgressDialog message={generation.message} rows={stateRows} /> : null}
      {generation.status === "idle" && creditDialogOpen && creditCost !== null ? (
        <CreditPurchaseDialog
          creditBalance={creditBalance}
          creditCost={creditCost}
          onClose={onCloseCreditDialog}
          onContinue={onContinueWithCredits}
        />
      ) : null}
    </div>
  );
}

function CreditPurchaseDialog({
  creditBalance,
  creditCost,
  onClose,
  onContinue,
}: {
  creditBalance: number | null;
  creditCost: number;
  onClose: () => void;
  onContinue: () => void;
}) {
  const dialogRef = useDialogFocus(true, onClose);
  const hasEnoughCredits = creditBalance !== null && creditBalance >= creditCost;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111713]/45 p-4" role="presentation">
      <div aria-labelledby="credit-purchase-dialog-title" aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_28px_80px_rgba(17,23,19,0.24)] sm:p-8" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Avant de générer</p>
            <h2 className="mt-3 text-2xl font-black" id="credit-purchase-dialog-title">Votre vidéo consommera {creditCost} crédits</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">Choisissez un pack de crédits pour lancer votre vidéo. La connexion sera demandée uniquement au moment de poursuivre l'achat.</p>
          </div>
          <button aria-label="Fermer" className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface-secondary)]" onClick={onClose} type="button"><X size={18} /></button>
        </div>

        {creditBalance !== null ? <p className="mt-5 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm font-semibold">Votre solde actuel : {creditBalance} crédits.</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {creditPacks.map((pack) => (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/45 p-5" key={pack.id}>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{pack.name}</p>
              <p className="mt-1 text-2xl font-black text-[var(--primary)]">{pack.priceLabel}</p>
              <p className="mt-2 text-sm font-semibold">{pack.credits} crédits Terrova</p>
              <PaydunyaPurchaseButton label={`Choisir ${pack.name}`} productId={pack.id} productType="pack" returnTo="/create?resume=generation" />
            </div>
          ))}
        </div>

        {hasEnoughCredits ? <button className="btn-secondary mt-5 w-full justify-center" onClick={onContinue} type="button">Générer avec mes crédits <ArrowRight size={17} /></button> : null}
        <p className="mt-4 text-center text-xs text-[var(--text-secondary)]">Après confirmation du paiement, vous reviendrez automatiquement ici pour lancer la génération.</p>
      </div>
    </div>
  );
}

function GenerationProgressDialog({ message, rows }: { message?: string; rows: Array<{ label: string; done: boolean }> }) {
  return (
    <div aria-labelledby="generation-dialog-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#111713]/45 p-4" role="dialog">
      <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-white p-6 shadow-[0_28px_80px_rgba(17,23,19,0.24)] sm:p-8">
        <div className="grid size-14 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Loader2 className="animate-spin" size={27} /></div>
        <h2 className="mt-5 text-2xl font-black" id="generation-dialog-title">Création de la vidéo</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{message ?? "Terrova assemble votre visite immobilière…"}</p>
        <div className="mt-6 space-y-3">{rows.map((row, index) => <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-secondary)] p-4" key={row.label}><span className={`grid size-8 place-items-center rounded-full ${row.done ? "bg-[var(--primary)] text-white" : "bg-[#dedbd2]"}`}>{row.done ? <Check size={16} /> : index + 1}</span><span className="font-semibold">{row.label}</span></div>)}</div>
        <p className="mt-5 text-xs leading-5 text-[var(--text-secondary)]">Cette fenêtre se fermera automatiquement lorsque la vidéo sera prête.</p>
      </div>
    </div>
  );
}

function GenerationErrorDialog({ onClose, onRetry }: { onClose: () => void; onRetry: () => void }) {
  const dialogRef = useDialogFocus(true, onClose);

  return (
    <div aria-labelledby="generation-error-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#111713]/45 p-4" role="dialog">
      <div className="w-full max-w-md rounded-3xl border border-[#f0c9bd] bg-white p-6 shadow-[0_28px_80px_rgba(17,23,19,0.24)] sm:p-8" ref={dialogRef} tabIndex={-1}>
        <div className="grid size-14 place-items-center rounded-2xl bg-[#fff3ee] text-[#9d311f]"><XCircle size={27} /></div>
        <h2 className="mt-5 text-2xl font-black" id="generation-error-title">La génération a échoué.</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Vos photos n'ont pas été perdues. Vous pouvez réessayer ou fermer cette fenêtre pour modifier le prompt.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary justify-center" onClick={onClose} type="button">Modifier le prompt</button>
          <button className="btn-primary justify-center" onClick={onRetry} type="button"><RefreshCw size={17} /> Réessayer</button>
        </div>
      </div>
    </div>
  );
}

function VideoPreviewDialog({ onClose, videoUrl }: { onClose: () => void; videoUrl?: string }) {
  const dialogRef = useDialogFocus(true, onClose);

  return (
    <div aria-labelledby="video-preview-title" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-[#111713]/60 p-4" role="dialog">
      <div className="relative w-full max-w-3xl rounded-3xl bg-[#101713] p-3 text-white shadow-[0_28px_80px_rgba(17,23,19,0.4)] sm:p-5" ref={dialogRef} tabIndex={-1}>
        <button aria-label="Fermer l’aperçu" className="absolute right-5 top-5 z-10 grid size-10 place-items-center rounded-full bg-white/15" onClick={onClose} type="button"><X size={18} /></button>
        <h2 className="sr-only" id="video-preview-title">Aperçu de la vidéo</h2>
        {videoUrl ? <video className="max-h-[75vh] w-full rounded-2xl bg-black object-contain" controls autoPlay src={videoUrl}><track kind="captions" label="Français" srcLang="fr" src="data:text/vtt,WEBVTT" /></video> : <div className="grid min-h-[420px] place-items-center rounded-2xl bg-[linear-gradient(135deg,#1d5c37,#101713)]"><div className="text-center"><Play className="mx-auto" fill="currentColor" size={42} /><p className="mt-4 font-semibold">Aperçu vidéo démo</p><p className="mt-2 text-sm text-white/70">Le lecteur réel s’affichera ici avec l’URL du provider.</p></div></div>}
      </div>
    </div>
  );
}

function buildPromptForReview(
  property: PropertyForm,
  style: VideoStyle | string,
  ratio: VideoRatio | string,
  duration: VideoDuration,
  templateInstructions?: string,
) {
  return buildDefaultVideoPrompt({
    sessionId: "00000000-0000-0000-0000-000000000000",
    images: [],
    property: {
      type: property.type.toLowerCase(),
      transaction: property.transaction,
      district: property.district || undefined,
      comments: property.comments || undefined,
    },
    video: {
      style: style as VideoStyle,
      ratio: ratio as VideoRatio,
      duration,
      templateInstructions,
    },
  });
}

function getSessionId() {
  const key = "terrova-session-id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(key, next);
  return next;
}

async function fetchCreditBalance(sessionId: string) {
  try {
    const response = await fetch(`/api/credits?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as { wallet?: { available?: number } };
    return typeof payload.wallet?.available === "number" ? payload.wallet.available : null;
  } catch {
    return null;
  }
}
