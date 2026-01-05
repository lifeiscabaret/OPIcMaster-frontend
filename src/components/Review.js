// src/components/Review.js
import { useMemo, useState } from "react";

const levelLabelMap = {
    IM1: "IM1 (초중급)",
    IM2: "IM2 (중급)",
    IH: "IH (중고급)",
    AL: "AL (상급)",
};

function formatDate(ts) {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleString("ko-KR", {
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

/**
 * props:
 *  - savedHistory: Practice에서 넘겨준 전체 history 배열
 *  - setUi: 화면 전환용 ("practice" 등)
 */
function Review({ savedHistory = [], setUi }) {
    const [page, setPage] = useState(1);
    const [openId, setOpenId] = useState(null);

    const PAGE_SIZE = 10;

    // ✅ 최신순 정렬(혹시라도 정렬이 안 되어 넘어온 경우 대비)
    const sorted = useMemo(() => {
        const cloned = [...savedHistory];
        cloned.sort((a, b) => {
            const aTime = a.createdAt || 0;
            const bTime = b.createdAt || 0;
            return bTime - aTime; // 최신순
        });
        return cloned;
    }, [savedHistory]);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const currentPageItems = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        return sorted.slice(start, end);
    }, [sorted, page]);

    const handleToggle = (id) => {
        setOpenId((prev) => (prev === id ? null : id));
    };

    const handleGoPage = (p) => {
        if (p < 1 || p > totalPages) return;
        setPage(p);
        setOpenId(null); // 페이지 바뀔 때 펼친거 닫기
    };

    return (
        <div className="App started">
            <div className="review-header">
                <div className="review-header-left">
                    <i className="fa-solid fa-folder-open" aria-hidden="true" />
                    <h3>저장된 질문 / 답변 기록</h3>
                </div>

                {/* ✅ 우측 버튼 영역 */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                        className="btn ghost"
                        style={{ marginTop: 0, whiteSpace: "nowrap" }}
                        onClick={() => setUi("stats")}
                        title="통계 / 약점 분석"
                    >
                        📊 통계 / 약점 분석
                    </button>

                    <button
                        className="btn ghost"
                        style={{ marginTop: 0, whiteSpace: "nowrap" }}
                        onClick={() => setUi("practice")}
                    >
                        ← 연습 화면으로 돌아가기
                    </button>
                </div>
            </div>


            {total === 0 ? (
                <p style={{ marginTop: 24 }}>아직 저장된 기록이 없어요. 먼저 연습을 진행해 주세요.</p>
            ) : (
                <>
                    <p style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
                        총 {total}개 중{" "}
                        <strong>
                            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
                        </strong>{" "}
                        보기
                    </p>

                    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                        {currentPageItems.map((item, index) => {
                            const itemId = item.id ?? `${item.createdAt}-${index}`; // ✅ 여기!
                            const isOpen = openId === itemId;
                            const review = item.review || {};
                            const idxLabel = (page - 1) * PAGE_SIZE + (index + 1);

                            return (
                                <div
                                    key={itemId} // ✅ 수정
                                    className="question-block"
                                    style={{ cursor: "default" }}
                                >
                                    {/* 상단 요약 행 */}
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 12,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        display: "inline-flex",
                                                        width: 24,
                                                        height: 24,
                                                        borderRadius: "999px",
                                                        background: "#eef2ff",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {idxLabel}
                                                </span>
                                                <strong style={{ fontSize: 15 }}>
                                                    {item.question || "(질문 없음)"}
                                                </strong>
                                            </div>
                                            <div style={{ fontSize: 12, color: "#888" }}>
                                                {formatDate(item.createdAt)}
                                                {review.score != null && (
                                                    <>
                                                        {" · "}점수: {review.score}/5
                                                    </>
                                                )}
                                                {review.recommendedLevel && (
                                                    <>
                                                        {" · "}
                                                        레벨:{" "}
                                                        {levelLabelMap[review.recommendedLevel] ||
                                                            review.recommendedLevel}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            className="btn ghost"
                                            style={{ whiteSpace: "nowrap", marginTop: 0 }}
                                            onClick={() => handleToggle(itemId)} // ✅ 수정
                                        >
                                            {isOpen ? "접기 ▲" : "펼쳐보기 ▼"}
                                        </button>
                                    </div>

                                    {/* 펼쳐진 상세 영역 */}
                                    {isOpen && (
                                        <div
                                            style={{
                                                marginTop: 16,
                                                borderTop: "1px solid #eee",
                                                paddingTop: 16,
                                            }}
                                        >
                                            <div>
                                                <strong>📝 내가 쓴 답변</strong>
                                                <p
                                                    style={{
                                                        marginTop: 8,
                                                        whiteSpace: "pre-wrap",
                                                        lineHeight: 1.6,
                                                    }}
                                                >
                                                    {item.memo || "(메모 없음)"}
                                                </p>
                                            </div>

                                            {item.gptAnswer && (
                                                <div style={{ marginTop: 16 }}>
                                                    <strong>✨ AI 모범답안</strong>
                                                    <p
                                                        style={{
                                                            marginTop: 8,
                                                            whiteSpace: "pre-wrap",
                                                            lineHeight: 1.6,
                                                        }}
                                                    >
                                                        {item.gptAnswer}
                                                    </p>
                                                </div>
                                            )}

                                            {review && (review.overallFeedback || review.fluency) && (
                                                <div
                                                    style={{
                                                        marginTop: 24,
                                                        paddingTop: 16,
                                                        borderTop: "1px solid #f1f1f1",
                                                    }}
                                                >
                                                    <strong>📊 AI 리뷰</strong>

                                                    {review.fluency && (
                                                        <p style={{ marginTop: 8 }}>
                                                            <strong>유창성</strong>: {review.fluency}
                                                        </p>
                                                    )}
                                                    {review.grammar && (
                                                        <p>
                                                            <strong>문법</strong>: {review.grammar}
                                                        </p>
                                                    )}
                                                    {review.vocab && (
                                                        <p>
                                                            <strong>어휘</strong>: {review.vocab}
                                                        </p>
                                                    )}
                                                    {review.taskAchievement && (
                                                        <p>
                                                            <strong>내용 충실도</strong>: {review.taskAchievement}
                                                        </p>
                                                    )}
                                                    {review.overallFeedback && (
                                                        <p
                                                            style={{
                                                                marginTop: 8,
                                                                whiteSpace: "pre-wrap",
                                                                lineHeight: 1.6,
                                                            }}
                                                        >
                                                            {review.overallFeedback}
                                                        </p>
                                                    )}

                                                    {review.userAnswerOriginal && (
                                                        <div style={{ marginTop: 16 }}>
                                                            <strong>📌 내가 한 답변 (원문)</strong>
                                                            <p
                                                                style={{
                                                                    marginTop: 8,
                                                                    whiteSpace: "pre-wrap",
                                                                    lineHeight: 1.6,
                                                                }}
                                                            >
                                                                {review.userAnswerOriginal}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {review.correctedAnswerExample && (
                                                        <div style={{ marginTop: 16 }}>
                                                            <strong>✏️ 교정된 영어 답변 예시</strong>
                                                            <p
                                                                style={{
                                                                    marginTop: 8,
                                                                    whiteSpace: "pre-wrap",
                                                                    lineHeight: 1.6,
                                                                }}
                                                            >
                                                                {review.correctedAnswerExample}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {review.correctionTips && (
                                                        <div style={{ marginTop: 16 }}>
                                                            <strong>🛠️ 수정하면 좋은 포인트</strong>
                                                            <p
                                                                style={{
                                                                    marginTop: 8,
                                                                    whiteSpace: "pre-wrap",
                                                                    lineHeight: 1.6,
                                                                }}
                                                            >
                                                                {review.correctionTips}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 🔢 페이지네이션 */}
                    <div
                        style={{
                            marginTop: 24,
                            display: "flex",
                            justifyContent: "center",
                            gap: 8,
                            flexWrap: "wrap",
                        }}
                    >
                        <button
                            type="button"
                            className="btn ghost"
                            style={{ marginTop: 0 }}
                            onClick={() => handleGoPage(page - 1)}
                            disabled={page === 1}
                        >
                            이전
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                            <button
                                key={p}
                                type="button"
                                className="btn ghost"
                                style={{
                                    marginTop: 0,
                                    minWidth: 32,
                                    fontWeight: p === page ? 700 : 400,
                                    background: p === page ? "#e5e7ff" : "transparent",
                                }}
                                onClick={() => handleGoPage(p)}
                                disabled={p === page}
                            >
                                {p}
                            </button>
                        ))}

                        <button
                            type="button"
                            className="btn ghost"
                            style={{ marginTop: 0 }}
                            onClick={() => handleGoPage(page + 1)}
                            disabled={page === totalPages}
                        >
                            다음
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default Review;
