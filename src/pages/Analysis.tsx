import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { getStudents, getClassAverage, getTopStudents, getWeakStudents, getOverallScore, getPrediction, type Student } from "@/lib/studentStore";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { Award, AlertTriangle, TrendingUp, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import CameraGesturePanel from "@/components/CameraGesturePanel";
import { useCameraHandGestures } from "@/hooks/useCameraHandGestures";

const COLORS = {
  improving: "hsl(199, 89%, 48%)",
  stable: "hsl(142, 71%, 45%)",
  declining: "hsl(0, 84%, 60%)",
};

export default function Analysis() {
  const [students, setStudents] = useState<Student[]>([]);
  const focusSections = useMemo(
    () => ["overview", "predictions", "top", "support"] as const,
    [],
  );
  const [focusIndex, setFocusIndex] = useState(0);

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  if (students.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">No Data Yet</h1>
        <p className="text-muted-foreground mb-6">Add students to see analysis and predictions</p>
        <Link to="/add"><Button>Add Students</Button></Link>
      </div>
    );
  }

  const avg = getClassAverage(students);
  const top = getTopStudents(students);
  const weak = getWeakStudents(students);

  const radarData = [
    { subject: "Marks", value: avg.marks },
    { subject: "Attendance", value: avg.attendance },
    { subject: "Assignment", value: avg.assignment },
  ];

  const predCounts = { improving: 0, stable: 0, declining: 0 };
  students.forEach(s => { predCounts[getPrediction(s)]++; });
  const pieData = [
    { name: "Improving", value: predCounts.improving },
    { name: "Stable", value: predCounts.stable },
    { name: "Declining", value: predCounts.declining },
  ].filter(d => d.value > 0);

  const activeSection = focusSections[focusIndex];

  const handleGesture = useCallback((gesture: { categoryName: string }) => {
    if (gesture.categoryName === "Open_Palm") {
      setFocusIndex(index => (index + 1) % focusSections.length);
      return;
    }

    if (gesture.categoryName === "Closed_Fist") {
      setFocusIndex(index => (index - 1 + focusSections.length) % focusSections.length);
      return;
    }

    if (gesture.categoryName === "Pointing_Up") {
      setFocusIndex(1);
      return;
    }

    if (gesture.categoryName === "Victory") {
      setFocusIndex(2);
    }
  }, [focusSections]);

  const { videoRef, isActive, isLoading, error, lastGesture, stop } = useCameraHandGestures({
    enabled: students.length > 0,
    onGesture: handleGesture,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <CameraGesturePanel
        title="Analyze class trends with camera gestures"
        description="Use open palm and closed fist to move through insight sections. Pointing up jumps to student predictions, and the victory sign jumps to top performers."
        videoRef={videoRef}
        isActive={isActive}
        isLoading={isLoading}
        error={error}
        lastGestureLabel={lastGesture?.categoryName ?? null}
        onStop={stop}
        gestures={[
          { name: "Open Palm", action: "Move to the next analysis section" },
          { name: "Closed Fist", action: "Move to the previous analysis section" },
          { name: "Pointing Up", action: "Jump to student predictions" },
          { name: "Victory", action: "Jump to top students" },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analysis & Predictions</h1>
        <p className="text-muted-foreground mt-1">
          Detailed class performance insights • Active focus: {activeSection}
        </p>
      </div>

      {/* Class Averages Radar */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className={`p-6 transition-all ${activeSection === "overview" ? "border-primary shadow-lg shadow-primary/15 ring-1 ring-primary/40" : ""}`}>
          <h2 className="text-lg font-semibold mb-4">Class Average (Radar)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className={`p-6 transition-all ${activeSection === "overview" ? "border-primary shadow-lg shadow-primary/15 ring-1 ring-primary/40" : ""}`}>
          <h2 className="text-lg font-semibold mb-4">Prediction Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Prediction List */}
      <Card className={`p-6 transition-all ${activeSection === "predictions" ? "border-info shadow-lg shadow-info/15 ring-1 ring-info/40" : ""}`}>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-info" /> Student Predictions
        </h2>
        <p className="text-sm text-muted-foreground mb-4">Who is likely to improve based on attendance & assignment trends</p>
        <div className="space-y-2">
          {students
            .filter(s => getPrediction(s) === "improving")
            .map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-info/5 border border-info/20">
                <span className="font-medium">{s.name}</span>
                <span className="text-sm text-info font-medium">Likely to improve — good attendance ({s.attendance}%) & assignments ({s.assignmentScore})</span>
              </div>
            ))}
          {students.filter(s => getPrediction(s) === "improving").length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-3">No students currently predicted to improve</p>
          )}
        </div>
      </Card>

      {/* Top & Weak */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className={`p-6 transition-all ${activeSection === "top" ? "border-warning shadow-lg shadow-warning/15 ring-1 ring-warning/40" : ""}`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-warning" /> Top 5 Students
          </h2>
          <div className="space-y-2">
            {top.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <span className="font-semibold text-success">{getOverallScore(s)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className={`p-6 transition-all ${activeSection === "support" ? "border-destructive shadow-lg shadow-destructive/15 ring-1 ring-destructive/40" : ""}`}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" /> Weak Students (Below 50%)
          </h2>
          {weak.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">No weak students — great job! 🎉</p>
          ) : (
            <div className="space-y-2">
              {weak.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-destructive/5">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-semibold text-destructive">{getOverallScore(s)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
