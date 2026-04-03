import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Pencil, Trash2, UserPlus, Search, WandSparkles } from "lucide-react";
import { getStudents, deleteStudent, getOverallScore, getPrediction, updateStudent, type Student } from "@/lib/studentStore";
import CameraGesturePanel from "@/components/CameraGesturePanel";
import { useCameraHandGestures } from "@/hooks/useCameraHandGestures";

const predictionLabel: Record<string, { text: string; class: string }> = {
  improving: { text: "📈 Improving", class: "text-info" },
  stable: { text: "✅ Stable", class: "text-success" },
  declining: { text: "📉 Declining", class: "text-destructive" },
};

export default function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({ name: "", attendance: "", marks: "", assignmentScore: "" });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    setStudents(getStudents());
  }, []);

  const filtered = useMemo(
    () => students.filter(s => s.name.toLowerCase().includes(search.toLowerCase())),
    [search, students],
  );

  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedStudentId(null);
      return;
    }

    if (!selectedStudentId || !filtered.some(student => student.id === selectedStudentId)) {
      setSelectedStudentId(filtered[0].id);
    }
  }, [filtered, selectedStudentId]);

  function handleDelete(id: string) {
    deleteStudent(id);
    setStudents(getStudents());
  }

  function openRectification(student: Student) {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      attendance: String(student.attendance),
      marks: String(student.marks),
      assignmentScore: String(student.assignmentScore),
    });
    setEditErrors({});
  }

  function closeRectification() {
    setEditingStudent(null);
    setEditErrors({});
  }

  function validateEditForm() {
    const nextErrors: Record<string, string> = {};
    const name = editForm.name.trim();
    if (!name) nextErrors.name = "Name is required";
    else if (name.length > 100) nextErrors.name = "Name too long";

    const attendance = Number(editForm.attendance);
    if (editForm.attendance === "" || Number.isNaN(attendance)) nextErrors.attendance = "Required";
    else if (attendance < 0 || attendance > 100) nextErrors.attendance = "0-100";

    const marks = Number(editForm.marks);
    if (editForm.marks === "" || Number.isNaN(marks)) nextErrors.marks = "Required";
    else if (marks < 0 || marks > 100) nextErrors.marks = "0-100";

    const assignmentScore = Number(editForm.assignmentScore);
    if (editForm.assignmentScore === "" || Number.isNaN(assignmentScore)) nextErrors.assignmentScore = "Required";
    else if (assignmentScore < 0 || assignmentScore > 100) nextErrors.assignmentScore = "0-100";

    setEditErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleRectificationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingStudent || !validateEditForm()) return;

    updateStudent(editingStudent.id, {
      name: editForm.name.trim(),
      attendance: Number(editForm.attendance),
      marks: Number(editForm.marks),
      assignmentScore: Number(editForm.assignmentScore),
    });

    setStudents(getStudents());
    closeRectification();
  }

  const selectedIndex = filtered.findIndex(student => student.id === selectedStudentId);
  const selectedStudent = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  const handleGesture = useCallback((gesture: { categoryName: string }) => {
    if (filtered.length === 0) {
      return;
    }

    if (gesture.categoryName === "Open_Palm") {
      const nextIndex = selectedIndex >= 0 ? (selectedIndex + 1) % filtered.length : 0;
      setSelectedStudentId(filtered[nextIndex].id);
      return;
    }

    if (gesture.categoryName === "Closed_Fist") {
      const nextIndex = selectedIndex >= 0 ? (selectedIndex - 1 + filtered.length) % filtered.length : 0;
      setSelectedStudentId(filtered[nextIndex].id);
      return;
    }

    if (!selectedStudent) {
      return;
    }

    if (gesture.categoryName === "Thumb_Up") {
      const nextMarks = Math.min(100, selectedStudent.marks + 5);
      updateStudent(selectedStudent.id, { marks: nextMarks });
      setStudents(getStudents());
      return;
    }

    if (gesture.categoryName === "Thumb_Down") {
      const nextMarks = Math.max(0, selectedStudent.marks - 5);
      updateStudent(selectedStudent.id, { marks: nextMarks });
      setStudents(getStudents());
    }
  }, [filtered, selectedIndex, selectedStudent]);

  const { videoRef, isActive, isLoading, error, lastGesture, stop } = useCameraHandGestures({
    enabled: true,
    onGesture: handleGesture,
  });

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <CameraGesturePanel
          title="Control student records with your hand"
          description="Use the camera to move across the student list and adjust marks on the selected record. Open palm selects the next student, closed fist goes back, thumbs up adds 5 marks, and thumbs down removes 5 marks."
          videoRef={videoRef}
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          lastGestureLabel={lastGesture?.categoryName ?? null}
          onStop={stop}
          gestures={[
            { name: "Open Palm", action: "Select the next student" },
            { name: "Closed Fist", action: "Select the previous student" },
            { name: "Thumb Up", action: "Increase selected student's marks by 5" },
            { name: "Thumb Down", action: "Decrease selected student's marks by 5" },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Students</h1>
            <p className="text-muted-foreground mt-1">
              {students.length} total
              {selectedStudent ? ` • Gesture target: ${selectedStudent.name}` : ""}
            </p>
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
                <Card
                  key={s.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-all ${
                    selectedStudentId === s.id ? "border-primary shadow-lg shadow-primary/15 ring-1 ring-primary/40" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold truncate">{s.name}</span>
                      <span className={`text-xs font-medium ${pred.class}`}>{pred.text}</span>
                      {selectedStudentId === s.id ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          <WandSparkles className="h-3 w-3" />
                          Camera selected
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Marks: {s.marks}</span>
                      <span>Attendance: {s.attendance}%</span>
                      <span>Assignment: {s.assignmentScore}</span>
                      <span className="font-medium text-foreground">Overall: {getOverallScore(s)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openRectification(s)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Rectify ${s.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(editingStudent)} onOpenChange={open => !open && closeRectification()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rectify Student Details</DialogTitle>
            <DialogDescription>
              Update the student record to correct any mistakes in the saved data.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRectificationSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Student Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(form => ({ ...form, name: e.target.value }))}
                className="mt-1.5"
              />
              {editErrors.name ? <p className="mt-1 text-sm text-destructive">{editErrors.name}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="edit-attendance">Attendance %</Label>
                <Input
                  id="edit-attendance"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.attendance}
                  onChange={e => setEditForm(form => ({ ...form, attendance: e.target.value }))}
                  className="mt-1.5"
                />
                {editErrors.attendance ? <p className="mt-1 text-sm text-destructive">{editErrors.attendance}</p> : null}
              </div>

              <div>
                <Label htmlFor="edit-marks">Marks</Label>
                <Input
                  id="edit-marks"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.marks}
                  onChange={e => setEditForm(form => ({ ...form, marks: e.target.value }))}
                  className="mt-1.5"
                />
                {editErrors.marks ? <p className="mt-1 text-sm text-destructive">{editErrors.marks}</p> : null}
              </div>

              <div>
                <Label htmlFor="edit-assignment">Assignment</Label>
                <Input
                  id="edit-assignment"
                  type="number"
                  min={0}
                  max={100}
                  value={editForm.assignmentScore}
                  onChange={e => setEditForm(form => ({ ...form, assignmentScore: e.target.value }))}
                  className="mt-1.5"
                />
                {editErrors.assignmentScore ? <p className="mt-1 text-sm text-destructive">{editErrors.assignmentScore}</p> : null}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRectification}>Cancel</Button>
              <Button type="submit" className="gap-2">
                <Pencil className="w-4 h-4" />
                Save Rectification
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
