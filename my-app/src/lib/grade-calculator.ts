// src/lib/grade-calculator.ts
import type { finalRankValues } from "@/src/db/schema";

type Weight = {
  attendanceRateWeight: number;
  attitudeClassWeight: number;
  homeworkEvaluationWeight: number;
};

type RawScores = {
  attendanceRate: number | null; // 0-100
  attitudeClass: number | null; // 1-10
  homeworkEvaluation: number | null; // 1-10
};

export type FinalRank = (typeof finalRankValues)[number];

export function calculateFinalScore(
  scores: RawScores,
  weight: Weight,
): number | null {
  const { attendanceRate, attitudeClass, homeworkEvaluation } = scores;
  if (
    attendanceRate === null ||
    attitudeClass === null ||
    homeworkEvaluation === null
  ) {
    return null; // 未入力があれば計算しない
  }

  const totalWeight =
    weight.attendanceRateWeight +
    weight.attitudeClassWeight +
    weight.homeworkEvaluationWeight;

  const weighted =
    attendanceRate * (weight.attendanceRateWeight / totalWeight) +
    attitudeClass * 10 * (weight.attitudeClassWeight / totalWeight) +
    homeworkEvaluation * 10 * (weight.homeworkEvaluationWeight / totalWeight);

  return Math.round(weighted);
}

export function calculateFinalRank(score: number | null): FinalRank | null {
  if (score === null) return null;
  if (score >= 90) return "excellent";
  if (score >= 80) return "very_good";
  if (score >= 70) return "good";
  if (score >= 60) return "pass";
  return "fail";
}
