import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Brain, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { isMlApiConfigured, predictStudents, type StudentPrediction } from "@/lib/predictionApi";
import type { Student } from "@/lib/studentStore";

interface PredictionInsightsPanelProps {
  students: Student[];
}

const trendIcon = {
  Rising: TrendingUp,
  Falling: TrendingDown,
  Stable: Brain,
};

function formatFeatureName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export default function PredictionInsightsPanel({ students }: PredictionInsightsPanelProps) {
  const [predictions, setPredictions] = useState<StudentPrediction[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPredictions() {
      if (!students.length || !isMlApiConfigured) {
        setStatus("idle");
        return;
      }

      setStatus("loading");
      setError("");

      try {
        const result = await predictStudents(students);
        if (!active) return;
        setPredictions(result);
        setStatus("ready");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Prediction service is unavailable.");
        setStatus("error");
      }
    }

    loadPredictions();

    return () => {
      active = false;
    };
  }, [students]);

  const atRisk = predictions.filter(prediction => prediction.risk_label === "At Risk");
  const importanceData = useMemo(() => {
    const first = predictions[0]?.feature_importance ?? {};
    return Object.entries(first)
      .slice(0, 6)
      .map(([feature, importance]) => ({
        feature: formatFeatureName(feature),
        importance: Math.round(importance * 100),
      }));
  }, [predictions]);

  if (!isMlApiConfigured) {
    return (
      <Card className="p-6 border-info/20 bg-info/5">
        <div className="flex items-start gap-3">
          <Brain className="mt-0.5 h-5 w-5 text-info" />
          <div>
            <h2 className="font-semibold">AI predictions are ready to connect</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set <span className="font-mono">VITE_ML_API_URL</span> to your FastAPI service URL to replace rule-based insights with Random Forest predictions.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-primary/10">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Brain className="h-5 w-5 text-primary" />
            AI Performance Predictions
          </h2>
          <p className="text-sm text-muted-foreground">Random Forest grade, confidence, trend, and risk alerts</p>
        </div>
        <Badge variant={status === "ready" ? "default" : "secondary"}>
          {status === "loading" ? "Predicting" : status === "ready" ? `${predictions.length} scored` : "Live API"}
        </Badge>
      </div>

      {status === "error" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {atRisk.length > 0 ? (
        <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" />
            {atRisk.length} student{atRisk.length === 1 ? "" : "s"} need intervention
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioritize attendance recovery, assignment completion, and recent test correction plans.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {predictions.slice(0, 6).map(prediction => {
            const Icon = trendIcon[prediction.trend as keyof typeof trendIcon] ?? Brain;
            return (
              <div key={prediction.student_id ?? prediction.student_name} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{prediction.student_name}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <Badge>Grade {prediction.predicted_grade}</Badge>
                      <Badge variant={prediction.risk_label === "At Risk" ? "destructive" : "secondary"}>
                        {prediction.risk_label}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                        {prediction.trend}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{Math.round(prediction.confidence * 100)}%</p>
                    <p className="text-xs text-muted-foreground">confidence</p>
                  </div>
                </div>
              </div>
            );
          })}
          {status === "loading" ? <p className="text-sm text-muted-foreground">Contacting the prediction API...</p> : null}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">Feature Importance</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={importanceData} layout="vertical" margin={{ left: 18, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 40]} fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis dataKey="feature" type="category" width={118} fontSize={11} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "Importance"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="importance" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}
