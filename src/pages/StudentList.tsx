import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Trash2, UserPlus, Search } from "lucide-react";
import { getStudents, deleteStudent, getOverallScore, getPrediction, type Student } from "@/lib/studentStore";

const predictionLabel: Record<string, { text: string; class: string }> = {
  improving: { text: "📈 Improving", class: "text-info" },
  stable: { text: "✅ Stable", class: "text-success" },
  declining: { text: "📉 Declining", class: "text-destructive" },
};

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleDelete(id: string) {
    deleteStudent(id);
    setStudents(getStudents());
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">{students.length} total</p>
        </div>
        <Link to="/add">
          <Button className="gap-2"><UserPlus className="w-4 h-4" /> Add</Button>
        </Link>
      </div>

      {students.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {filtered.length === 0 && students.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No students added yet</p>
          <Link to="/add"><Button>Add Student</Button></Link>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No students match "{search}"</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const pred = predictionLabel[getPrediction(s)];
            return (
              <Card key={s.id} className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold truncate">{s.name}</span>
                    <span className={`text-xs font-medium ${pred.class}`}>{pred.text}</span>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Marks: {s.marks}</span>
                    <span>Attendance: {s.attendance}%</span>
                    <span>Assignment: {s.assignmentScore}</span>
                    <span className="font-medium text-foreground">Overall: {getOverallScore(s)}%</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(s.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
