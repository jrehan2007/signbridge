import { useCallback, useEffect, useRef, useState } from 'react';
import { getHandLandmarker, getDelegate } from '../ml/handTracker.js';
import { extractFeatures } from '../ml/features.js';
import { drawHands } from '../ml/drawing.js';

/**
 * Owns the webcam + MediaPipe loop.
 * onFrame(features|null, result, now) is called for every processed video frame.
 * Raw frames never leave this hook — only landmark-derived numbers are passed on.
 */
export function useHandTracking({ onFrame } = {}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  const fpsRef = useRef({ frames: 0, last: performance.now() });
  const lastTsRef = useRef(-1);

  const [status, setStatus] = useState('idle'); // idle | loading | running | error
  const [error, setError] = useState('');
  const [fps, setFps] = useState(0);
  const [handsVisible, setHandsVisible] = useState(0);

  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    setHandsVisible(0);
    setFps(0);
    setStatus('idle');
  }, []);

  const loop = useCallback(async (landmarker) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !streamRef.current) return;

    if (video.readyState >= 2 && video.currentTime !== lastTsRef.current) {
      lastTsRef.current = video.currentTime;
      if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      drawHands(canvas.getContext('2d'), result);
      const features = extractFeatures(result.landmarks, result.handedness);
      setHandsVisible((prev) => (prev === result.landmarks.length ? prev : result.landmarks.length));
      onFrameRef.current?.(features, result, now);

      const f = fpsRef.current;
      f.frames += 1;
      if (now - f.last >= 1000) { setFps(Math.round((f.frames * 1000) / (now - f.last))); f.frames = 0; f.last = now; }
    }
    rafRef.current = requestAnimationFrame(() => loop(landmarker));
  }, []);

  const start = useCallback(async () => {
    if (streamRef.current) return;
    setError('');
    setStatus('loading');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access is not supported in this browser');
      const [landmarker, stream] = await Promise.all([
        getHandLandmarker(),
        navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false }),
      ]);
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setStatus('running');
      loop(landmarker);
    } catch (err) {
      stop();
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
        : err?.name === 'NotFoundError'
          ? 'No camera was found. Connect a webcam and try again.'
          : err?.message || 'Could not start the camera';
      setError(msg);
      setStatus('error');
    }
  }, [loop, stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, canvasRef, start, stop, status, error, fps, handsVisible, delegate: getDelegate() };
}
