import { useEffect, useMemo, useState } from "react";
import { LS } from "../App";

function safeNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function avg(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatAvg(n) {
    if (n == null) return "-";
    return n.toFixed(2);
}

export default function Stats({ setUi }) {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem(LS.history) || "[]");

        // 최신순 보장
        const sorted = [...saved].sort((a, b) => {
            const ta = safeNumber(a?.createdAt) ?? safeNumber(a?.id) ?? 0;
            const tb = safeNumber(b?.createdAt) ?? safeNumber(b?.id) ?? 0;
            return tb - ta;
        });

        setHistory(sorted);
    }, []);

    const stats = useMemo(() => {
        const total = history.length;
        const withReview = history.filter((h) => h?.review);

        const scores = withReview
            .map((h) => safeNumber(h.review?.score))
            .filter((n) => n != null);

        const scoreAvg = avg(scores);

        // 최근 10개 기반 키워드 약점 분석
        const recent10 = history.slice(0, 10);
        const weaknessCounts = { fluency: 0, grammar: 0, vocab: 0, taskAchievement: 0 };

        recent10.forEach((h) => {
            const r = h?.review || {};
            const text = [
                r.fluency,
                r.grammar,
                r.vocab,
                r.taskAchievement,
                r.overallFeedback,
                r.correctionTips,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (/fluency|pause|hesitat|smooth|flow/.test(text)) weaknessCounts.fluency += 1;
            if (/grammar|tense|article|preposition|subject-verb/.test(text)) weaknessCounts.grammar += 1;
            if (/vocab|word choice|variety|repetition/.test(text)) weaknessCounts.vocab += 1;
            if (/task|detail|example|develop|organize|structure/.test(text)) weaknessCounts.taskAchievement += 1;
        });

        const weakestKey =
            Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        const weakestLabelMap = {
            fluency: "유창성",
            grammar: "문법",
            vocab: "어휘",
            taskAchievement: "내용 충실도",
        };

        const weakest =
            weakestKey && weaknessCounts[weakestKey] > 0
                ? { key: weakestKey, label: weakestLabelMap[weakestKey], value: weaknessCounts[weakestKey] }
                : null;

        return {
            total,
            reviewedCount: withReview.length,
            scoreAvg,
            weakest,
        };
    }, [history]);

    return (
        <div className="App started" style={{ maxWidth: 820, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn-reset" onClick={() => setUi("review")}>
                    ← 저장된 답변으로
                </button>
                <h2 style={{ margin: 0 }}>📊 나의 OPIc 통계</h2>
            </div>

            <p style={{ marginTop: 10, color: "#666" }}>
                저장된 기록을 기반으로 연습량/평균점수/약점 포인트를 보여줘 🙂
            </p>

            {/* KPI 카드 */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                    marginTop: 16,
                }}
            >
                <div className="question-block" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, color: "#666" }}>총 연습 횟수</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.total}</div>
                </div>

                <div className="question-block" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, color: "#666" }}>리뷰 완료</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>{stats.reviewedCount}</div>
                </div>

                <div className="question-block" style={{ padding: 16 }}>
                    <div style={{ fontSize: 14, color: "#666" }}>평균 점수</div>
                    <div style={{ fontSize: 28, fontWeight: 800 }}>
                        {formatAvg(stats.scoreAvg)} <span style={{ fontSize: 14 }}>/ 5</span>
                    </div>
                </div>
            </div>

            {/* 약점 섹션 */}
            <div className="question-block" style={{ marginTop: 18, padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>🧠 약점 분석</h3>

                {!stats.total ? (
                    <p style={{ margin: 0, color: "#666" }}>
                        아직 저장된 기록이 없어요. 연습하고 저장하면 분석이 나타나요👩🏻‍🏫
                    </p>
                ) : !stats.reviewedCount ? (
                    <p style={{ margin: 0, color: "#666" }}>
                        저장된 기록은 있는데, 아직 리뷰 데이터가 없어요. 🎤 답변 리뷰를 한 번 받아봐요.✍🏻
                    </p>
                ) : stats.weakest ? (
                    <div style={{ margin: 0 }}>
                        <p style={{ margin: 0 }}>
                            🔥 최근 10개 기준 약점 추정: <b>{stats.weakest.label}</b>
                            <span style={{ color: "#666" }}> (언급 {stats.weakest.value}회)</span>
                        </p>
                        <p style={{ marginTop: 6, marginBottom: 0, color: "#666", fontSize: 13 }}>
                            👉 다음 연습은 <b>{stats.weakest.label}</b> 중심으로 “짧게 말하고 → 예시 1개 붙이기” 추천!
                        </p>
                    </div>
                ) : (
                    <p style={{ margin: 0, color: "#666" }}>
                        최근 10개 리뷰에서 약점 키워드를 아직 못 찾았어요. (데이터가 더 쌓이면 더 정확해져요 🙂)
                    </p>
                )}

            </div>

            {/* 최근 기록 미리보기 */}
            <div className="question-block" style={{ marginTop: 18, padding: 16 }}>
                <h3 style={{ marginTop: 0 }}>🕘 최근 저장 5개</h3>
                {!history.length ? (
                    <p style={{ margin: 0, color: "#666" }}>아직 기록이 없어요.</p>
                ) : (
                    <ol style={{ margin: 0, paddingLeft: 18 }}>
                        {history.slice(0, 5).map((h) => (
                            <li key={h.id || h.createdAt} style={{ marginBottom: 10 }}>
                                <div style={{ fontWeight: 700 }}>{h.question}</div>
                                <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
                                    점수: {h?.review?.score ?? "-"} / 5 · 레벨: {h?.review?.recommendedLevel ?? "-"}
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
            </div>

            {/* 하단 CTA */}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button className="btn primary" onClick={() => setUi("practice")}>
                    🎤 연습하러 가기
                </button>
                <button className="btn" onClick={() => setUi("review")}>
                    📁 저장된 답변 보기
                </button>
            </div>
        </div>
    );
}
