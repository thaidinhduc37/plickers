import { PCardDetector } from "../context/pcard_detector.js";

const detector = new PCardDetector();

self.onmessage = (event) => {
  const msg = event.data || {};

  if (msg.type === "clear-buffer") {
    detector.clearBuffer();
    return;
  }

  if (msg.type !== "detect" || !msg.imageData) return;

  const ignoreSet = new Set(msg.ignoreCardIds || []);
  const minVotes = msg.minVotes ?? 1;

  const frameResults = detector.detect(msg.imageData);
  const allRects = detector.getLastBlobRects();

  const rects = [];
  for (const r of allRects) {
    if (!ignoreSet.has(r.cardId)) rects.push(r);
  }

  let best = null;
  if (frameResults.length > 0) {
    for (let i = 0; i < frameResults.length; i++) {
      const r = frameResults[i];
      if (ignoreSet.has(r.cardId)) continue;
      if (!best || r.confidence > best.confidence) best = r;
    }
  }

  const stableMap = detector.computeStableResults(minVotes);
  const stable = [];
  for (const [cardId, data] of stableMap.entries()) {
    if (ignoreSet.has(cardId)) {
      detector.clearCard(cardId);
      continue;
    }
    stable.push({
      cardId,
      answer: data.answer,
      confidence: data.confidence,
      votes: data.votes,
    });
  }

  self.postMessage({
    type: "result",
    blobRects: rects,
    stable,
    best,
    detectedCount: rects.length,
  });
};
