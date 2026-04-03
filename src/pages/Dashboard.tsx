import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, TrendingDown, Award, UserPlus, ArrowRight, Sparkles, Target } from "lucide-react";
import { getStudents, getClassAverage, getTopStudents, getWeakStudents, getOverallScore, getPrediction, type Student } from "@/lib/studentStore";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import InteractiveDashboardHero from "@/components/InteractiveDashboardHero";

const statStyles = [
  { bg: "bg-primary/10", icon: "text-primary", border: "border-primary/20" },
  { bg: "bg-success/10", icon: "text-success", border: "border-success/20" },
  { bg: "bg-info/10", icon: "text-info", border: "border-info/20" },
  { bg: "bg-destructive/10", icon: "text-destructive", border: "border-destructive/20" },
];

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  const avg = getClassAverage(students);
  const top = getTopStudents(students, 3);
  const weak = getWeakStudents(students);
  const improving = students.filter(s => getPrediction(s) === "improving");

  const chartData = students
    .sort((a, b) => getOverallScore(b) - getOverallScore(a))
    .slice(0, 10)
    .map(s => ({
      name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name,
      score: getOverallScore(s),
    }));

  if (students.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        {/* Background blobs */}
        <div className="fixed inset-0 -z-10 gradient-mesh opacity-60" />
        <div className="fixed top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-blob" />
        <div className="fixed top-40 right-1/4 w-72 h-72 bg-info/10 rounded-full blur-3xl animate-blob animation-delay-2000" />

        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-3xl gradient-primary flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary/30">
            <img src="/logo.png" alt="DataVista Logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-4xl font-extrabold mb-3 gradient-text">Welcome to DataVista</h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Class Performance Analyzer — add students to unlock analytics, predictions & insights.
          </p>
          <Link to="/add">
            <Button size="lg" className="gap-2 gradient-primary border-0 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow text-primary-foreground px-8">
              <UserPlus className="w-5 h-5" /> Add First Student
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const stats = [
    { icon: Users, label: "Total Students", value: students.length },
    { icon: Award, label: "Avg Score", value: `${avg.overall}%` },
    { icon: TrendingUp, label: "Improving", value: improving.length },
    { icon: TrendingDown, label: "Need Help", value: weak.length },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Background */}
      <div className="fixed inset-0 -z-10 gradient-mesh opacity-40" />

      <InteractiveDashboardHero
        studentsCount={students.length}
        averageScore={avg.overall}
        improvingCount={improving.length}
        weakCount={weak.length}
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const style = statStyles[i];
          return (
            <Card key={stat.label} className={`p-5 card-hover border ${style.border}`}>
              <div className={`w-11 h-11 rounded-xl ${style.bg} flex items-center justify-center mb-3`}>
                <stat.icon className={`w-5 h-5 ${style.icon}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="p-6 card-hover">
          <h2 className="text-lg font-semibold mb-4">Top Students by Overall Score</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                    <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis domain={[0, 100]} fontSize={12} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    color: "hsl(var(--foreground))",
                    boxShadow: "0 8px 30px -8px hsl(var(--primary) / 0.15)",
                  }}
                />
                <Bar dataKey="score" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Class Strength Analysis */}
      <Card className="p-6 card-hover border-primary/10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          Class Strength Analysis
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[
            { label: "Avg Marks", value: avg.marks, color: "primary" },
            { label: "Avg Attendance", value: avg.attendance, color: "info" },
            { label: "Avg Assignment", value: avg.assignment, color: "success" },
          ].map(item => (
            <div key={item.label} className={`text-center p-4 rounded-xl bg-${item.color}/5 border border-${item.color}/10`}>
              <p className={`text-2xl font-bold text-${item.color}`}>{item.value}%</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 rounded-xl gradient-primary text-primary-foreground text-center font-semibold">
          🏆 Class is strongest in{" "}
          {avg.marks >= avg.attendance && avg.marks >= avg.assignment
            ? "Marks"
            : avg.attendance >= avg.assignment
              ? "Attendance"
              : "Assignments"}
        </div>
      </Card>


      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 card-hover border-success/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                <Award className="w-4 h-4 text-warning" />
              </div>
              Top Students
            </h2>
            <Link to="/analysis" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {top.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-success/5 border border-success/10">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg gradient-primary text-primary-foreground text-xs flex items-center justify-center font-bold shadow-sm">
                    {i + 1}
                  </span>
                  <span className="font-medium">{s.name}</span>
                </div>
                <span className="font-bold text-success">{getOverallScore(s)}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 card-hover border-destructive/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-destructive" />
              </div>
              Need Attention
            </h2>
          </div>
          {weak.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">All students are performing well! 🎉</p>
          ) : (
            <div className="space-y-2">
              {weak.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-destructive/5 border border-destructive/10">
                  <span className="font-medium">{s.name}</span>
                  <span className="font-bold text-destructive">{getOverallScore(s)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
