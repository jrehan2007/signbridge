import { HAND_CONNECTIONS } from './handTracker.js';

const HAND_COLORS = { Left: '#F59E0B', Right: '#2DD4BF' };

/** Draws hand skeletons on an overlay canvas sized to the video's intrinsic resolution. */
export function drawHands(ctx, result) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!result?.landmarks?.length) return;
  const w = canvas.width;
  const h = canvas.height;

  result.landmarks.forEach((pts, i) => {
    const color = HAND_COLORS[result.handedness?.[i]?.[0]?.categoryName] || '#2DD4BF';
    ctx.lineWidth = Math.max(2, w / 320);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (const { start, end } of HAND_CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo(pts[start].x * w, pts[start].y * h);
      ctx.lineTo(pts[end].x * w, pts[end].y * h);
      ctx.stroke();
    }
    for (let j = 0; j < pts.length; j += 1) {
      const r = j === 0 ? w / 130 : w / 220;
      ctx.beginPath();
      ctx.arc(pts[j].x * w, pts[j].y * h, r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, w / 480);
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  });
}
