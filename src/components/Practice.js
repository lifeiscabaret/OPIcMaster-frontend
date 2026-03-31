import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { API_BASE, LS } from "../App";

import questionItems from "../data/questionBank.json";

const FALLBACK_QUESTIONS = [
    "Tell me about a recent weekend activity you really enjoyed and why it was meaningful.",
    "Describe your favorite place at home and how you usually spend time there.",
    "Talk about a hobby you picked up recently and how you got into it.",
];

const getRandomFallback = () =>
    FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const looksLikeAutoSwitchMic = (label) =>
    /iphone|continuity|hands-?free|airpods|hfp|car audio/i.test(label || "");

const guessExtFromMime = (mt) => {
    if (!mt) return "webm";
    if (mt.includes("webm")) return "webm";
    if (mt.includes("mp4")) return "mp4";
    if (mt.includes("ogg")) return "ogg";
    if (mt.includes("mpeg")) return "mp3";
    return "webm";
};

const matchesProfile = (q, { level, role, residence }) => {
    const levelOk = !q.levels || q.levels.length === 0 || !level || q.levels.includes(level);
    const roleOk = !q.roles || q.roles.length === 0 || !role || q.roles.includes(role) || q.roles.includes("ANY");
    const residenceOk = !q.residences || q.residences.length === 0 || !residence || q.residences.includes(residence) || q.residences.includes("ANY");
    return levelOk && roleOk && residenceOk;
};

function Practice({ setUi, setLoading, setLoadingText, setSavedHistory }) {
    const [question, setQuestion] = useState("Loading your first question...");
    const [timeLeft, setTimeLeft] = useState(60);
    const [timerRunning, setTimerRunning] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
    const [memo, setMemo] = useState("");

    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [recMime, setRecMime] = useState("audio/webm");
    const [isRecording, setIsRecording] = useState(false);
    const [audioURL, setAudioURL] = useState("");

    const [videoSrc, setVideoSrc] = useState(`${API_BASE}/video/intro_01`);
    const [needVideoGesture, setNeedVideoGesture] = useState(false);

    const [allowReplayOnce, setAllowReplayOnce] = useState(false);
    const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

    const [currentQuestionId, setCurrentQuestionId] = useState(null);
    const [review, setReview] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [bestAnswer, setBestAnswer] = useState("");
    const [bestAnswerLoading, setBestAnswerLoading] = useState(false);

    const [latestSavedEntry, setLatestSavedEntry] = useState(null);
    const [showLatestSavedModal, setShowLatestSavedModal] = useState(false);

    const videoRef = useRef(null);
    const isInitialLoad = useRef(true);

    const levelLabelMap = {
        IM1: "IM1 (초중급)",
        IM2: "IM2 (중급)",
        IH: "IH (중고급)",
        AL: "AL (상급)",
    };

    const pickQuestionFromBank = useCallback((isInitial = false) => {
        const selectedTopics = JSON.parse(localStorage.getItem(LS.topics) || "[]");
        const userLevel = localStorage.getItem(LS.level) || "";
        const userRole = localStorage.getItem(LS.role) || "";
        const userResidence = localStorage.getItem(LS.residence) || "";
        const profile = { level: userLevel, role: userRole, residence: userResidence };

        let baseCandidates = questionItems;

        if (isInitial) {
            const introOrSurvey = questionItems.filter(
                (q) => q.type === "survey" || q.topic === "intro"
            );
            if (introOrSurvey.length > 0) baseCandidates = introOrSurvey;
        } else {
            baseCandidates = questionItems.filter(
                (q) => q.type === "topic" || q.type === "advanced" || q.type === "intro"
            );
        }

        let candidates = baseCandidates;
        if (selectedTopics.length > 0) {
            const filteredByTopic = baseCandidates.filter((q) => selectedTopics.includes(q.topic));
            if (filteredByTopic.length > 0) candidates = filteredByTopic;
        }

        const filteredByProfile = candidates.filter((q) => matchesProfile(q, profile));
        if (filteredByProfile.length > 0) candidates = filteredByProfile;

        if (!candidates.length) return null;
        return candidates[Math.floor(Math.random() * candidates.length)];
    }, []);

    const startVideoPlay = useCallback(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;

        setNeedVideoGesture(false);
        videoEl.currentTime = 0;

        try {
            const playPromise = videoEl.play();
            if (playPromise && typeof playPromise.then === "function") {
                playPromise.catch((err) => {
                    if (err.name === "NotAllowedError") {
                        setNeedVideoGesture(true);
                    } else if (err.name !== "AbortError") {
                        console.warn("Video play error:", err);
                    }
                });
            }
        } catch (err) {
            if (err.name === "NotAllowedError") {
                setNeedVideoGesture(true);
            } else if (err.name !== "AbortError") {
                console.warn("Video play error (sync):", err);
            }
        }
    }, []);

    const runOne = useCallback(
        async (isInitial = false) => {
            setLoadingText("질문을 준비하는 중입니다...");
            if (!isInitial) setLoading(true);

            setTimeLeft(60);
            setTimerRunning(false);
            setIsFinished(false);
            setMemo("");
            setAudioURL("");
            setNeedVideoGesture(false);
            setAllowReplayOnce(false);
            setHasPlayedOnce(false);
            setReview(null);
            setShowReviewModal(false);
            setBestAnswer("");

            try {
                const next = pickQuestionFromBank(isInitial);
                let nextText;
                let nextVideoSrc = videoSrc;
                let nextId = null;

                if (!next) {
                    nextText = getRandomFallback();
                } else {
                    nextText = next.text;
                    nextId = next.id;
                    nextVideoSrc = `${API_BASE}/video/${next.id}`;
                }

                setQuestion(nextText);
                setCurrentQuestionId(nextId);
                setVideoSrc(nextVideoSrc);
            } catch (e) {
                console.error("runOne failed", e);
                toast.error("질문을 불러오는 데 실패했어요. 기본 질문으로 다시 시도할게요.");
                setQuestion(getRandomFallback());
            } finally {
                if (!isInitial) setLoading(false);
            }
        },
        [pickQuestionFromBank, setLoading, setLoadingText, videoSrc]
    );

    useEffect(() => {
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            runOne(true);
        }
    }, [runOne]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v || !videoSrc) return;
        startVideoPlay();
    }, [videoSrc, startVideoPlay]);

    const startRecording = useCallback(async () => {
        try {
            let deviceId = localStorage.getItem("OPIC_INPUT_DEVICE_ID") || "";
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter((d) => d.kind === "audioinput");
                const pick = inputs.find((d) => !looksLikeAutoSwitchMic(d.label)) || inputs[0];
                if (!deviceId && pick?.deviceId) {
                    deviceId = pick.deviceId;
                    localStorage.setItem("OPIC_INPUT_DEVICE_ID", deviceId);
                }
            } catch { /* ignore */ }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    channelCount: 1,
                    sampleRate: 48000,
                },
            });

            const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
            const mime = candidates.find((mt) => window.MediaRecorder?.isTypeSupported(mt)) || "audio/webm";

            setRecMime(mime);
            const recorder = new MediaRecorder(stream, { mimeType: mime });
            const chunks = [];
            recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
            recorder.start();
            await sleep(300);
            recorder.chunks = chunks;
            setMediaRecorder(recorder);
            setIsRecording(true);
        } catch (err) {
            console.error("Recording start error:", err);
            toast.error("마이크 권한/입력장치를 확인해 주세요.");
        }
    }, []);

    const handleReview = useCallback(
        async (baseText, forceFresh = false) => {
            if (review && !forceFresh && !baseText) {
                setShowReviewModal(true);
                return;
            }

            const answerText = (baseText || memo || "").trim();
            if (!answerText) {
                toast.error("먼저 답변을 말하거나 적어줘!");
                return;
            }

            const targetLevel = localStorage.getItem(LS.level) || "IM2–IH";

            try {
                setLoadingText("AI가 답변을 분석 중입니다...");
                setLoading(true);

                const res = await fetch(`${API_BASE}/review`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        questionId: currentQuestionId || "unknown",
                        questionText: question,
                        answerText,
                        targetLevel: targetLevel.startsWith("IL") ? "IM1" : "IM2",
                    }),
                });

                const data = await res.json();
                if (!res.ok) {
                    toast.error("리뷰 생성에 실패했어요.");
                    return;
                }

                setReview(data);
                setShowReviewModal(true);
            } catch (e) {
                console.error("Review fetch error", e);
                toast.error("리뷰 요청 중 오류가 발생했어요.");
            } finally {
                setLoading(false);
            }
        },
        [review, memo, question, currentQuestionId, setLoading, setLoadingText]
    );

    const stopRecording = useCallback(() => {
        if (!mediaRecorder) return;

        mediaRecorder.onstop = async () => {
            setLoadingText("음성을 텍스트로 변환 중입니다...");
            setLoading(true);

            const type = recMime || "audio/webm";
            const parts = mediaRecorder.chunks || [];
            if (!parts.length) {
                setLoading(false);
                toast.error("녹음이 너무 짧아서 인식하지 못했어요. 한 문장 이상 말해줘!");
                return;
            }

            const audioBlob = new Blob(parts, { type });
            if (audioBlob.size < 1024) {
                setLoading(false);
                toast.error("녹음 길이가 너무 짧아요. 다시 시도해주세요:)");
                return;
            }

            setAudioURL(URL.createObjectURL(audioBlob));
            try {
                const ext = guessExtFromMime(type);
                const formData = new FormData();
                formData.append("file", audioBlob, `recording.${ext}`);

                const res = await fetch(`${API_BASE}/stt`, { method: "POST", body: formData });
                if (!res.ok) throw new Error(`Transcription failed (${res.status})`);

                const data = await res.json();
                if (data?.text) {
                    setMemo(data.text);
                    await handleReview(data.text, true);
                } else {
                    toast.error("음성 인식 결과가 비어 있어요.");
                }
            } catch (e) {
                console.error("Transcription error", e);
                toast.error("음성 인식에 실패했어요. 네트워크/서버 상태를 확인해주세요!");
            } finally {
                setLoading(false);
            }
        };

        mediaRecorder.stop();
        setIsRecording(false);
        setIsFinished(true);
    }, [mediaRecorder, recMime, setLoading, setLoadingText, handleReview]);

    useEffect(() => {
        if (!timerRunning) return;

        if (timeLeft <= 0) {
            setTimerRunning(false);
            setIsFinished(true);
            setAllowReplayOnce(false);
            if (isRecording) stopRecording();
            return;
        }

        const id = setInterval(() => setTimeLeft((s) => s - 1), 1000);
        return () => clearInterval(id);
    }, [timerRunning, timeLeft, isRecording, stopRecording]);

    const fetchBestAnswerFromGPT = useCallback(async () => {
        if (!question.trim()) { toast.error("질문이 먼저 필요해요!"); return; }

        setLoadingText("AI 모범답안을 생성 중입니다...");
        setLoading(true);
        setBestAnswerLoading(true);

        try {
            const targetBand = localStorage.getItem(LS.level) || "IM2–IH";
            const res = await fetch(`${API_BASE}/ask`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: `You are an OPIC rater and coach. Write a model answer in English for the prompt at ${targetBand} level. Constraints: 130–170 words, first-person, friendly spoken style, clear structure with examples. Prompt: ${question}`,
                }),
            });
            const data = await res.json();
            const answer = (data?.answer || "").trim();
            if (answer) {
                setBestAnswer(answer);
                setMemo((prev) => prev.includes("➡️ AI 모범답안:") ? prev : `${prev}\n\n\n➡️ AI 모범답안:\n\n${answer}`);
            } else {
                toast.error("모범답안 생성 실패");
            }
        } catch (e) {
            toast.error("모범답안 생성 중 오류가 발생했어요.");
        } finally {
            setBestAnswerLoading(false);
            setLoading(false);
        }
    }, [question, setLoading, setLoadingText]);

    const handleSave = useCallback(() => {
        if (!memo.trim()) { toast.error("📝 답변을 먼저 입력해주세요!"); return; }

        const saved = JSON.parse(localStorage.getItem(LS.history) || "[]");
        const separator = "➡️ AI 모범답안:";
        const userMemoOnly = memo.split(separator)[0].trim();
        const gptAnswerPart = memo.includes(separator) ? memo.split(separator)[1].trim() : "";

        const reviewForSave = review ? {
            score: review.score ?? null,
            recommendedLevel: review.recommendedLevel ?? null,
            fluency: review.fluency || "",
            grammar: review.grammar || "",
            vocab: review.vocab || "",
            taskAchievement: review.taskAchievement || "",
            overallFeedback: review.overallFeedback || "",
            userAnswerOriginal: review.userAnswerOriginal || userMemoOnly,
            correctedAnswerExample: review.correctedAnswerExample || "",
            correctionTips: review.correctionTips || "",
        } : null;

        const newEntry = { id: Date.now(), createdAt: Date.now(), question, memo: userMemoOnly, gptAnswer: gptAnswerPart, review: reviewForSave };
        localStorage.setItem(LS.history, JSON.stringify([newEntry, ...saved]));
        setLatestSavedEntry(newEntry);
        setShowLatestSavedModal(true);
        toast.success("저장되었습니다!");
    }, [memo, question, review]);

    const handleGoToReviewList = useCallback(() => {
        const raw = JSON.parse(localStorage.getItem(LS.history) || "[]");
        const history = raw.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (history.length === 0) { toast.error("저장된 질문이 없습니다."); return; }
        setSavedHistory(history);
        setUi("review");
    }, [setSavedHistory, setUi]);

    const handleReplayOnce = useCallback(() => {
        if (!allowReplayOnce || isFinished) return;
        const v = videoRef.current;
        if (!v) return;
        try { v.currentTime = 0; v.play(); setAllowReplayOnce(false); }
        catch (e) { console.warn("Replay failed", e); }
    }, [allowReplayOnce, isFinished]);

    const btnClose = {
        marginTop: 0, background: "transparent", border: "1px solid #94a3b8",
        color: "#475569", borderRadius: 8, padding: "6px 14px", fontSize: 14, cursor: "pointer",
    };

    return (
        <div className="App started">
            <h2>{question}</h2>
            <h3>남은 시간: {timeLeft}초</h3>

            <div style={{ position: "relative", width: 360, height: 360, marginTop: 16 }}>
                <video
                    ref={videoRef}
                    src={videoSrc}
                    muted={false}
                    playsInline
                    preload="auto"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 16, objectFit: "cover", background: "#000" }}
                    onEnded={() => {
                        if (isFinished) return;
                        if (!hasPlayedOnce) {
                            setHasPlayedOnce(true);
                            setTimeLeft(60);
                            setTimerRunning(true);
                            setAllowReplayOnce(true);
                        }
                    }}
                />
                {needVideoGesture && (
                    <button
                        className="btn primary"
                        style={{ position: "absolute", inset: 0, margin: "auto", height: 56, width: 220, backdropFilter: "blur(2px)" }}
                        onClick={startVideoPlay}
                    >
                        ▶ 아바타 재생하기
                    </button>
                )}
            </div>

            <button className="btn primary" onClick={handleReplayOnce} style={{ marginTop: 12 }} disabled={!allowReplayOnce}>
                <i className="fa-solid fa-rotate-right" aria-hidden="true" /> 다시 듣기 (1회)
            </button>

            {!isRecording ? (
                <button onClick={startRecording} disabled={!timerRunning || isFinished} style={{ marginTop: 16 }}>
                    <i className="fa-solid fa-microphone" aria-hidden="true" />{" "}
                    {timerRunning ? "답변 녹음 시작" : "질문 듣고 답변하세요"}
                </button>
            ) : (
                <button onClick={stopRecording} style={{ marginTop: 16 }}>
                    <i className="fa-solid fa-circle-stop" aria-hidden="true" /> 녹음 정지
                </button>
            )}

            {audioURL && <div style={{ marginTop: 12 }}><audio controls src={audioURL} /></div>}

            <button onClick={() => runOne(false)} style={{ marginTop: 16 }}>
                <i className="fa-solid fa-shuffle" aria-hidden="true" /> 다른 질문 받기
            </button>

            <div style={{ marginTop: 40, width: "100%", maxWidth: "600px" }}>
                <h3>📝 내 답변 메모하기</h3>
                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={5} placeholder="여기에 영어로 말한 내용을 적어보세요!" />
            </div>

            {isFinished && (
                <>
                    <button onClick={() => handleReview()}><i className="fa-solid fa-comments" aria-hidden="true" /> AI 답변 리뷰 보기</button>
                    <button onClick={handleSave}><i className="fa-solid fa-floppy-disk" aria-hidden="true" /> 질문 + 메모 저장</button>
                    <button onClick={handleGoToReviewList}><i className="fa-solid fa-folder-open" aria-hidden="true" /> 저장된 질문/답변 보기</button>
                </>
            )}

            <div className="practice-actions">
                <button type="button" className="btn-reset" onClick={() => setUi("survey")} title="설문 다시하기">
                    <i className="fa-solid fa-arrow-left icon-nudge" aria-hidden="true" /> 설문 다시하기
                </button>
            </div>

            {/* 리뷰 모달 */}
            {showReviewModal && review && (
                <div className="review-overlay" onClick={() => setShowReviewModal(false)}>
                    <div className="question-block" style={{ maxWidth: 720, maxHeight: "80vh", cursor: "auto", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                        <div className="review-header">
                            <div className="review-header-left">
                                <i className="fa-solid fa-magnifying-glass-chart" />
                                <h3>AI 답변 Review</h3>
                            </div>
                            <span className="latest-badge">최신</span>
                            <button style={btnClose} onClick={() => setShowReviewModal(false)}>✕ 닫기</button>
                        </div>
                        <div className="review-content" style={{ marginTop: 16, overflowY: "auto", paddingRight: 8 }}>
                            <p><strong>점수</strong>: {review.score ?? "-"} / 5{" "}{review.recommendedLevel && `(${levelLabelMap[review.recommendedLevel] || review.recommendedLevel})`}</p>
                            {review.fluency && <p><strong>유창성</strong>: {review.fluency}</p>}
                            {review.grammar && <p><strong>문법</strong>: {review.grammar}</p>}
                            {review.vocab && <p><strong>어휘</strong>: {review.vocab}</p>}
                            {review.taskAchievement && <p><strong>내용 충실도</strong>: {review.taskAchievement}</p>}
                            {review.overallFeedback && <div style={{ marginTop: 16 }}><strong>종합 피드백</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{review.overallFeedback}</p></div>}
                            {review.originalAnswer && <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}><strong>📌 내가 한 답변 (원문)</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{review.originalAnswer}</p></div>}
                            {review.correctedAnswer && <div style={{ marginTop: 24 }}><strong>✏️ 교정된 영어 답변 예시</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{review.correctedAnswer}</p></div>}
                            {review.correctionTips && <div style={{ marginTop: 24 }}><strong>🛠️ 수정하면 좋은 포인트</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{review.correctionTips}</p></div>}
                            <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 16 }}>
                                {!bestAnswer && (
                                    <button className="btn primary" onClick={fetchBestAnswerFromGPT} style={{ marginTop: 0 }} disabled={bestAnswerLoading}>
                                        {bestAnswerLoading ? <><i className="fa-solid fa-spinner fa-spin" /> AI 모범답안 생성 중...</> : <><i className="fa-solid fa-wand-magic" /> AI 모범답안 보기</>}
                                    </button>
                                )}
                                {bestAnswer && <div style={{ marginTop: 12 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="fa-solid fa-lightbulb" /><strong>AI 모범답안</strong></div><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{bestAnswer}</p></div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 저장 모달 */}
            {showLatestSavedModal && latestSavedEntry && (
                <div className="review-overlay" onClick={() => setShowLatestSavedModal(false)}>
                    <div className="question-block" style={{ maxWidth: 720, maxHeight: "80vh", cursor: "auto", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
                        <div className="review-header">
                            <div className="review-header-left">
                                <i className="fa-solid fa-bookmark" />
                                <h3>이번에 저장된 질문 / 답변</h3>
                            </div>
                            <button style={btnClose} onClick={() => setShowLatestSavedModal(false)}>✕ 닫기</button>
                        </div>
                        <div className="review-content" style={{ marginTop: 16, overflowY: "auto", paddingRight: 8 }}>
                            <p><strong>질문</strong></p>
                            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{latestSavedEntry.question}</p>
                            <div style={{ marginTop: 16 }}><strong>📝 내가 쓴 답변</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{latestSavedEntry.memo || "(메모 없음)"}</p></div>
                            {latestSavedEntry.gptAnswer && <div style={{ marginTop: 24 }}><strong>✨ AI 모범답안</strong><p style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{latestSavedEntry.gptAnswer}</p></div>}
                            {latestSavedEntry.review && (
                                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
                                    <strong>📊 저장된 리뷰 요약</strong>
                                    <p style={{ marginTop: 8 }}>점수: {latestSavedEntry.review.score ?? "-"} / 5{" "}{latestSavedEntry.review.recommendedLevel && `(${levelLabelMap[latestSavedEntry.review.recommendedLevel] || latestSavedEntry.review.recommendedLevel})`}</p>
                                    {latestSavedEntry.review.overallFeedback && <p style={{ marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{latestSavedEntry.review.overallFeedback}</p>}
                                </div>
                            )}
                            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
                                <button className="btn primary" style={{ marginTop: 0 }} onClick={() => { setShowLatestSavedModal(false); handleGoToReviewList(); }}>
                                    <i className="fa-solid fa-list" /> 전체 저장본 보기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Practice;