/**
 * hooks/useSessionPhase.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tách từ LiveView.jsx — toàn bộ phase state machine, timer, broadcastState,
 * và các handlers (handleNext, handleReveal, handleEnd, handleRescue...).
 *
 * LiveView.jsx chỉ cần:
 * const { phase, timerSel, timeLeft, ... } = useSessionPhase({ session, ... });
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAudio } from "./useAudio";

const ANSWER_KEYS = ["A", "B", "C", "D"];

export function useSessionPhase({
  // data từ AppContext
  session,
  activeEvent,
  activeSet,
  currentQ,
  activeConts,
  eliminatedConts,
  respondedCount,
  events,
  // actions from AppContext
  revealAnswer,
  nextQuestion,
  endSession,
  clearResponses,
  rescueContestants,
  useBackupQuestion,
  // BroadcastChannel
  broadcast,
  presenterConnected,
}) {
  const navigate = useNavigate();
  const { play: playAudio, stop: stopAudio, beep } = useAudio();

  // ── Phase state ────────────────────────────────────────────────────────────
  // Derive initial phase from session state to handle returning to LiveView mid-session
  const derivePhase = (s) => {
    if (!s) return "lobby";
    if (s.state === "revealed") return "revealed";
    if (s.state === "scanning") return "scanning";
    return "question";
  };
  const [phase, setPhase] = useState(() => derivePhase(session));
  const [timerSel, setTimerSel] = useState(15);
  const [timeLeft, setTimeLeft] = useState(15);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showRescue, setShowRescue] = useState(false);
  const [rescueLoading, setRescueLoading] = useState(false);
  const [showRevealConfirm, setShowRevealConfirm] = useState(false);
  const [showBackupPicker, setShowBackupPicker] = useState(false);
  const [questionHistory, setQuestionHistory] = useState({});

  const intervalRef = useRef(null);
  const prevQIdx = useRef(null);
  const sessionStartedRef = useRef(!!session);
  // mirror phase để timer callback không bị stale closure
  const phaseRef = useRef(derivePhase(session));
  const prevConnectedRef = useRef(false);
  const currentQIdRef = useRef(null);

  // ── Restore phase when session loads after mount (e.g. async fetch) ────────
  const initializedRef = useRef(!!session);
  useEffect(() => {
    if (session && !initializedRef.current) {
      initializedRef.current = true;
      sessionStartedRef.current = true;
      const p = derivePhase(session);
      setPhase(p);
      phaseRef.current = p;
      prevQIdx.current = session.questionIndex ?? 0;
    }
  }, [session]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalVotes = ANSWER_KEYS.reduce(
    (s, k) => s + (session?.votes?.[k] || 0),
    0,
  );
  const isRevealed = phase === "revealed";

  // ── Sync phaseRef (tránh stale closure trong timer) ───────────────────────
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ── Trả màn chiếu về idle khi unmount (rời LiveView) ─────────────────────
  useEffect(() => {
    return () => {
      broadcast({ phase: "idle" });
    };
  }, [broadcast]);

  // ── Broadcast lobby khi events data có sẵn (no session yet) ───────────────
  const lobbyBroadcastedRef = useRef(false);
  useEffect(() => {
    if (!sessionStartedRef.current && !lobbyBroadcastedRef.current) {
      const fallbackEvent = activeEvent ?? events?.[0];
      const count =
        activeConts.length || fallbackEvent?.contestants?.length || 0;
      if (count > 0) {
        lobbyBroadcastedRef.current = true;
        broadcast({
          phase: "lobby",
          eventName: fallbackEvent?.name ?? "",
          activeTotal: count,
          contestants: activeConts.length
            ? activeConts
            : (fallbackEvent?.contestants ?? []),
          totalQuestions:
            activeSet?.questions.length ?? fallbackEvent?.question_count ?? 0,
          questions: activeSet?.questions ?? [],
        });
      }
    }
  }, [events, activeConts, activeEvent, activeSet, broadcast]);

  // ── broadcastState: gửi toàn bộ state sang màn hình chiếu ────────────────
  const broadcastState = useCallback(
    (overrides = {}) => {
      const fallbackEvent = activeEvent ?? events?.[0];
      broadcast({
        phase: overrides.phase ?? phase,
        question: overrides.question ?? currentQ,
        votes: overrides.votes ?? session?.votes ?? {},
        timeLeft: overrides.timeLeft ?? timeLeft,
        timerTotal: overrides.timerTotal ?? timerSel,
        scannedCount: overrides.scannedCount ?? respondedCount,
        activeTotal:
          overrides.activeTotal ??
          (activeConts.length || fallbackEvent?.contestants?.length || 0),
        eventName: activeEvent?.name ?? fallbackEvent?.name ?? "",
        questionIndex: overrides.questionIndex ?? session?.questionIndex ?? 0,
        totalQuestions:
          activeSet?.questions.length ??
          session?.total_questions ??
          fallbackEvent?.question_count ??
          0,
        questions: activeSet?.questions ?? [],
        questionHistory: overrides.questionHistory ?? questionHistory,
        contestants: activeConts.length
          ? activeConts
          : (fallbackEvent?.contestants ?? []),
        responses: session?.responses ?? {},
      });
    },
    [
      broadcast,
      phase,
      currentQ,
      session,
      timeLeft,
      timerSel,
      respondedCount,
      activeConts,
      activeEvent,
      activeSet,
      events,
      questionHistory,
    ],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync máy chiếu khi câu hỏi thay đổi (đặc biệt khi vừa load) ─────────
  useEffect(() => {
    if (currentQ && currentQ.id !== currentQIdRef.current) {
      currentQIdRef.current = currentQ.id;
      if (!sessionStartedRef.current) {
        const fallbackEvent = activeEvent ?? events?.[0];
        broadcast({
          phase: "lobby",
          eventName: fallbackEvent?.name ?? "",
          activeTotal:
            activeConts.length || fallbackEvent?.contestants?.length || 0,
          contestants: activeConts.length
            ? activeConts
            : (fallbackEvent?.contestants ?? []),
          totalQuestions:
            activeSet?.questions.length ?? fallbackEvent?.question_count ?? 0,
          questions: activeSet?.questions ?? [],
        });
      } else {
        broadcast({
          phase: "question",
          question: currentQ,
          votes: {},
          timeLeft: timerSel,
          timerTotal: timerSel,
          scannedCount: 0,
          activeTotal: activeConts.length,
          eventName: activeEvent?.name ?? "",
          questionIndex: session?.questionIndex ?? 0,
          totalQuestions: activeSet?.questions.length ?? 0,
          questions: activeSet?.questions ?? [],
          contestants: activeConts,
          responses: {},
        });
      }
    }
  }, [currentQ, session?.questionIndex]); // eslint-disable-line

  // ── Sync toàn bộ state khi presenter reconnect ────────────────────────────
  useEffect(() => {
    if (presenterConnected && !prevConnectedRef.current) {
      if (!sessionStartedRef.current) {
        const fallbackEvent = activeEvent ?? events?.[0];
        broadcast({
          phase: "lobby",
          eventName: fallbackEvent?.name ?? "",
          activeTotal:
            activeConts.length || fallbackEvent?.contestants?.length || 0,
          contestants: activeConts.length
            ? activeConts
            : (fallbackEvent?.contestants ?? []),
          totalQuestions:
            activeSet?.questions.length ?? fallbackEvent?.question_count ?? 0,
          questions: activeSet?.questions ?? [],
        });
      } else {
        broadcast({
          phase: phase,
          question: currentQ,
          votes: session?.votes ?? {},
          timeLeft: timeLeft,
          timerTotal: timerSel,
          scannedCount: respondedCount,
          activeTotal: activeConts.length,
          eventName: activeEvent?.name ?? "",
          questionIndex: session?.questionIndex ?? 0,
          totalQuestions: activeSet?.questions.length ?? 0,
          questions: activeSet?.questions ?? [],
          questionHistory: questionHistory,
          contestants: activeConts,
          responses: session?.responses ?? {},
        });
      }
    }
    prevConnectedRef.current = presenterConnected;
  }, [
    presenterConnected,
    phase,
    currentQ,
    session,
    timeLeft,
    timerSel,
    respondedCount,
    activeConts,
    activeEvent,
    activeSet,
    questionHistory,
  ]); // eslint-disable-line

  // ── Reset phase khi câu mới ────────────────────────────────────────────────
  useEffect(() => {
    const idx = session?.questionIndex;
    if (idx === undefined) return;
    if (prevQIdx.current === null) {
      prevQIdx.current = idx;
    } else if (idx !== prevQIdx.current) {
      prevQIdx.current = idx;
      setPhase("question");
      setTimerRunning(false);
      setTimeLeft(timerSel);
      clearInterval(intervalRef.current);
      broadcastState({
        phase: "question",
        timeLeft: timerSel,
        timerTotal: timerSel,
      });
    }
  }, [session?.questionIndex, timerSel]); // eslint-disable-line

  // ── Timer tick ─────────────────────────────────────────────────────────────
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!timerRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setTimerRunning(false);
          setPhase("scanning");
          phaseRef.current = "scanning";
          stopAudio();
          beep(600, 400);

          // Gửi tín hiệu chuyển phase sang màn chiếu ngay lập tức
          broadcastState({ phase: "scanning", timeLeft: 0 });

          return 0;
        }
        if (t <= 4) beep(880, 120);
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [timerRunning, broadcastState]); // eslint-disable-line

  // ── Broadcast timeLeft realtime khi countdown ─────────────────────────────
  useEffect(() => {
    if (phaseRef.current === "countdown" && timeLeft > 0) {
      broadcastState({ phase: "countdown", timeLeft });
    }
  }, [timeLeft]); // eslint-disable-line

  // ── Broadcast votes realtime khi scanning / revealed ──────────────────────
  useEffect(() => {
    if (phase === "scanning" || phase === "revealed") {
      broadcastState({});
    }
  }, [phase, session?.votes, respondedCount]); // eslint-disable-line

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartFromLobby = useCallback(() => {
    sessionStartedRef.current = true;
    setPhase("question");
    broadcastState({ phase: "question" });
  }, [broadcastState]);

  const startTimer = useCallback(() => {
    setTimeLeft(timerSel);
    setTimerRunning(true);
    setPhase("countdown");
    broadcastState({ phase: "countdown", timeLeft: timerSel });
    playAudio(`/sounds/${timerSel}s.mp3`, { volume: 0.7 }).catch(() => {});
  }, [timerSel, broadcastState, playAudio]);

  const togglePause = useCallback(() => {
    setTimerRunning((r) => {
      if (r) stopAudio();
      return !r;
    });
  }, [stopAudio]);

  const skipToScan = useCallback(() => {
    clearInterval(intervalRef.current);
    setTimerRunning(false);
    setTimeLeft(0);
    setPhase("scanning");
    broadcastState({ phase: "scanning", timeLeft: 0 });
    stopAudio();
    document.querySelectorAll("audio").forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
  }, [broadcastState, stopAudio]);

  const handleReveal = useCallback(async () => {
    await revealAnswer();
    setPhase("revealed");
    broadcastState({ phase: "revealed" });
  }, [revealAnswer, broadcastState]);

  const confirmReveal = useCallback(() => {
    setShowRevealConfirm(false);
    handleReveal();
  }, [handleReveal]);

  const handleNext = useCallback(async () => {
    const curIdx = session?.questionIndex ?? 0;
    const newHistory = {
      ...questionHistory,
      [curIdx]: {
        votes: session?.votes ?? {},
        correct_answer: currentQ?.correct_answer,
      },
    };
    setQuestionHistory(newHistory);
    setPhase("question");
    setTimeLeft(timerSel);

    // Gửi trạng thái sạch ngay cho máy chiếu — currentQIdRef effect sẽ cập nhật câu mới
    broadcast({
      phase: "question",
      question: currentQ, // placeholder, overwritten khi câu mới arrive
      votes: {},
      timeLeft: timerSel,
      timerTotal: timerSel,
      scannedCount: 0,
      activeTotal: activeConts.length,
      eventName: activeEvent?.name ?? "",
      questionIndex: curIdx + 1,
      totalQuestions: activeSet?.questions.length ?? 0,
      questions: activeSet?.questions ?? [],
      questionHistory: newHistory,
      contestants: activeConts,
      responses: {},
    });

    await nextQuestion();
    clearResponses();
  }, [
    session,
    currentQ,
    questionHistory,
    timerSel,
    activeConts,
    activeEvent,
    activeSet,
    broadcast,
    nextQuestion,
    clearResponses,
  ]);

  const handleEnd = useCallback(async () => {
    sessionStartedRef.current = false;
    broadcast({ phase: "idle" });
    await endSession();
    navigate("/dashboard");
  }, [broadcast, endSession, navigate]);

  const handleRescue = useCallback(
    async (mode, count, ids) => {
      setRescueLoading(true);
      try {
        await rescueContestants(mode, count, ids);
        setShowRescue(false);
      } finally {
        setRescueLoading(false);
      }
    },
    [rescueContestants],
  );

  const retryQuestion = useCallback(() => {
    setPhase("scanning");
    broadcastState({ phase: "scanning" });
  }, [broadcastState]);

  const handleUseBackup = useCallback(
    async (questionId) => {
      const result = await useBackupQuestion(questionId);
      if (result) {
        setShowBackupPicker(false);
        setPhase("question");
        setTimeLeft(timerSel);
        clearInterval(intervalRef.current);
        setTimerRunning(false);
        // Broadcast câu mới cho màn chiếu
        const q = result.current_question;
        broadcast({
          phase: "question",
          question: q,
          votes: {},
          timeLeft: timerSel,
          timerTotal: timerSel,
          scannedCount: 0,
          activeTotal: activeConts.length,
          eventName: activeEvent?.name ?? "",
          questionIndex: result.current_question_index,
          totalQuestions: result.total_questions,
          questions: activeSet?.questions ?? [],
          contestants: activeConts,
          responses: {},
        });
        clearResponses();
      }
    },
    [
      useBackupQuestion,
      timerSel,
      activeConts,
      activeEvent,
      activeSet,
      broadcast,
      clearResponses,
    ],
  );

  const skipQuestion = useCallback(async () => {
    const curIdx = session?.questionIndex ?? 0;
    setQuestionHistory((prev) => ({
      ...prev,
      [curIdx]: {
        votes: session?.votes ?? {},
        correct_answer: currentQ?.correct_answer,
      },
    }));
    await handleNext();
  }, [session, currentQ, handleNext]);

  // ── Expose ─────────────────────────────────────────────────────────────────
  return {
    // state
    phase,
    setPhase,
    timerSel,
    setTimerSel,
    timeLeft,
    setTimeLeft,
    timerRunning,
    showConfirmEnd,
    setShowConfirmEnd,
    showRescue,
    setShowRescue,
    showRevealConfirm,
    setShowRevealConfirm,
    showBackupPicker,
    setShowBackupPicker,
    rescueLoading,
    questionHistory,
    // derived
    totalVotes,
    isRevealed,
    // handlers
    broadcastState,
    handleStartFromLobby,
    startTimer,
    togglePause,
    skipToScan,
    handleReveal,
    confirmReveal,
    handleNext,
    handleEnd,
    handleRescue,
    handleUseBackup,
    retryQuestion,
    skipQuestion,
  };
}
