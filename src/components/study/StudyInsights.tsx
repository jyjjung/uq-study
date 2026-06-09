"use client";

import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import type { StudyRecommendation } from "@/lib/exam/types";

interface StudyInsightsProps {
  recommendations: StudyRecommendation[];
}

export function StudyInsights({ recommendations }: StudyInsightsProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        Complete some practice questions to get personalised study recommendations.
      </div>
    );
  }

  const icon = (priority: StudyRecommendation["priority"]) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "medium":
        return <Clock className="h-5 w-5 text-amber-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">What to study next</h3>
      {recommendations.map((rec) => (
        <div
          key={rec.topic}
          className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
        >
          {icon(rec.priority)}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="font-medium text-gray-900">{rec.topic}</p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  rec.priority === "high"
                    ? "bg-red-100 text-red-700"
                    : rec.priority === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                }`}
              >
                {rec.priority}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{rec.reason}</p>
            <p className="mt-1 text-xs text-gray-400">
              {rec.questionCount} questions · {rec.accuracy}% accuracy
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
