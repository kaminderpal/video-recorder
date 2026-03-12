"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "stopped";

export default function Home() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  const deleteRecording = async () => {
    setError("");

    try {
      if (savedPath) {
        setIsDeleting(true);
        const response = await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ path: savedPath })
        });

        if (!response.ok) {
          throw new Error("Delete failed.");
        }
      }

      setVideoBlob(null);
      setSavedPath("");
      setState("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed.";
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <main className="scene min-h-screen px-4 py-10 md:px-10 md:py-14">
      <div className="grain" aria-hidden="true" />
      <section className="mx-auto grid w-full max-w-6xl animate-fade-in grid-cols-1 gap-4">
        <header className="panel panel-primary stagger-1">
          <p className="eyebrow">Studio Capture</p>
          <h1 className="headline">Tape Room</h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-300/90 md:text-base">
            Record directly from camera and microphone, review the take, then
            archive it into your project temp vault.
          </p>
        </header>

        <section className="panel panel-primary stagger-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">Live Feed</h2>
            <span className="chip">Camera + Mic</span>
          </div>
          <div className="relative">
            <div className="video-overlay">
              <span className="status-badge">Session: {state}</span>
              <div className="overlay-controls">
                <button
                  onClick={startRecording}
                  disabled={state === "recording"}
                  className="control control-start"
                >
                  Start
                </button>
                <button
                  onClick={stopRecording}
                  disabled={state !== "recording"}
                  className="control control-stop"
                >
                  Stop
                </button>
                <button
                  onClick={uploadRecording}
                  disabled={!videoBlob || isUploading}
                  className="control control-save"
                >
                  {isUploading ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={deleteRecording}
                  disabled={
                    (!videoBlob && !savedPath) || state === "recording" || isDeleting
                  }
                  className="control control-delete"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
              className="video-frame"
            />
          </div>
        </section>

        {state === "stopped" ? (
          <section className="panel panel-secondary stagger-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title">Playback</h2>
              <span className="chip">Latest Take</span>
            </div>
            {previewUrl ? (
              <video src={previewUrl} controls autoPlay className="video-frame" />
            ) : (
              <div className="video-frame flex items-center justify-center text-sm uppercase tracking-[0.35em] text-stone-500">
                Waiting For Recording
              </div>
            )}
          </section>
        ) : null}

        {savedPath || error ? (
          <section className="stagger-4 px-1">
            {savedPath ? (
              <p className="break-all text-xs text-emerald-300">
                Saved: <code>{savedPath}</code>
              </p>
            ) : null}
            {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
