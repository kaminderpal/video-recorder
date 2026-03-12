"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "stopped";

export default function Home() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [savedPath, setSavedPath] = useState<string>("");
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  const previewUrl = useMemo(() => {
    if (!videoBlob) {
      return "";
    }

    return URL.createObjectURL(videoBlob);
  }, [videoBlob]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      stopTracks();
    };
  }, [previewUrl]);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    setError("");
    setSavedPath("");
    setVideoBlob(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm"
      });

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        setState("stopped");
        stopTracks();
      };

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to access camera and microphone.";
      setError(message);
    }
  };

  const stopRecording = () => {
    if (!recorderRef.current || state !== "recording") {
      return;
    }

    recorderRef.current.stop();
  };

  const uploadRecording = async () => {
    if (!videoBlob) {
      setError("Record a video before uploading.");
      return;
    }

    setError("");
    setSavedPath("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("video", videoBlob, `recording-${Date.now()}.webm`);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("Upload failed.");
      }

      const data = (await response.json()) as { path: string };
      setSavedPath(data.path);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <main className="scene min-h-screen px-4 py-10 md:px-10 md:py-14">
      <div className="grain" aria-hidden="true" />
      <section className="mx-auto grid w-full max-w-6xl animate-fade-in grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <header className="panel panel-primary stagger-1">
          <p className="eyebrow">Studio Capture</p>
          <h1 className="headline">Tape Room</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-300/90 md:text-base">
            Record directly from camera and microphone, review the take, then
            archive it into your project temp vault.
          </p>
        </header>

        <aside className="panel panel-secondary stagger-2">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">
            Session
          </p>
          <p className="mt-2 text-2xl font-semibold uppercase tracking-wider text-stone-100">
            {state}
          </p>
          {savedPath ? (
            <p className="mt-4 text-xs text-emerald-300">
              Saved: <code>{savedPath}</code>
            </p>
          ) : null}
          {error ? <p className="mt-4 text-xs text-rose-300">{error}</p> : null}
        </aside>

        <section className="panel panel-primary stagger-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Live Feed</h2>
            <span className="chip">Camera + Mic</span>
          </div>
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="video-frame"
          />
        </section>

        <section className="panel panel-secondary stagger-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Playback</h2>
            <span className="chip">Latest Take</span>
          </div>
          {previewUrl ? (
            <video src={previewUrl} controls className="video-frame" />
          ) : (
            <div className="video-frame flex items-center justify-center text-sm uppercase tracking-[0.35em] text-stone-500">
              Waiting For Recording
            </div>
          )}
        </section>

        <section className="panel panel-primary stagger-4 md:col-span-2">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={startRecording}
              disabled={state === "recording"}
              className="control control-start"
            >
              Start Recording
            </button>
            <button
              onClick={stopRecording}
              disabled={state !== "recording"}
              className="control control-stop"
            >
              Stop Recording
            </button>
            <button
              onClick={uploadRecording}
              disabled={!videoBlob || isUploading}
              className="control control-save"
            >
              {isUploading ? "Saving..." : "Save to temp"}
            </button>
          </div>
        </section>
      </section>
    </main>
  );
}
