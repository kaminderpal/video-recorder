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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Video Recorder</h1>
      <p className="text-slate-300">
        Record from your camera and save the file to the project temp folder.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-lg font-semibold">Live Camera</h2>
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="aspect-video w-full rounded-md bg-black"
          />
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="mb-3 text-lg font-semibold">Recorded Preview</h2>
          {previewUrl ? (
            <video
              src={previewUrl}
              controls
              className="aspect-video w-full rounded-md bg-black"
            />
          ) : (
            <div className="flex aspect-video items-center justify-center rounded-md bg-slate-800 text-slate-400">
              No recording yet
            </div>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={startRecording}
          disabled={state === "recording"}
          className="rounded-md bg-emerald-500 px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start Recording
        </button>
        <button
          onClick={stopRecording}
          disabled={state !== "recording"}
          className="rounded-md bg-rose-500 px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Stop Recording
        </button>
        <button
          onClick={uploadRecording}
          disabled={!videoBlob || isUploading}
          className="rounded-md bg-sky-500 px-4 py-2 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? "Uploading..." : "Save to temp"}
        </button>
      </div>

      <p className="text-sm text-slate-300">Status: {state}</p>

      {savedPath ? (
        <p className="rounded-md border border-emerald-700 bg-emerald-900/20 p-3 text-emerald-300">
          Saved to: <code>{savedPath}</code>
        </p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-rose-700 bg-rose-900/20 p-3 text-rose-300">
          {error}
        </p>
      ) : null}
    </main>
  );
}
