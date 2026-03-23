import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addStudent } from "@/lib/studentStore";
import { UserPlus, Check, Sparkles } from "lucide-react";

export default function AddStudent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", attendance: "", marks: "", assignmentScore: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) e.name = "Name is required";
    else if (name.length > 100) e.name = "Name too long";

    const att = Number(form.attendance);
    if (form.attendance === "" || isNaN(att)) e.attendance = "Required";
    else if (att < 0 || att > 100) e.attendance = "0-100";

    const marks = Number(form.marks);
    if (form.marks === "" || isNaN(marks)) e.marks = "Required";
    else if (marks < 0 || marks > 100) e.marks = "0-100";

    const asg = Number(form.assignmentScore);
    if (form.assignmentScore === "" || isNaN(asg)) e.assignmentScore = "Required";
    else if (asg < 0 || asg > 100) e.assignmentScore = "0-100";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    addStudent({
      name: form.name.trim(),
      attendance: Number(form.attendance),
      marks: Number(form.marks),
      assignmentScore: Number(form.assignmentScore),
    });

    setSuccess(true);
    setForm({ name: "", attendance: "", marks: "", assignmentScore: "" });
    setTimeout(() => setSuccess(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="fixed inset-0 -z-10 gradient-mesh opacity-40" />

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight gradient-text inline-block">Add Student</h1>
        <p className="text-muted-foreground mt-1">Enter student performance data</p>
      </div>

      {success ? (
        <Card className="p-8 text-center space-y-4 card-hover">
          <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center mx-auto border border-success/20">
            <Check className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-xl font-bold">Student Added! 🎉</h2>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setSuccess(false)} className="gradient-primary border-0 text-primary-foreground">Add Another</Button>
            <Button variant="outline" onClick={() => navigate("/students")}>View All</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 card-hover">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name" className="text-sm font-semibold">Student Name</Label>
              <Input
                id="name"
                placeholder="e.g. Rahul Sharma"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
                className="mt-1.5"
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="attendance" className="text-sm font-semibold">Attendance %</Label>
                <Input
                  id="attendance"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="85"
                  value={form.attendance}
                  onChange={e => setForm(f => ({ ...f, attendance: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.attendance && <p className="text-sm text-destructive mt-1">{errors.attendance}</p>}
              </div>
              <div>
                <Label htmlFor="marks" className="text-sm font-semibold">Marks</Label>
                <Input
                  id="marks"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="72"
                  value={form.marks}
                  onChange={e => setForm(f => ({ ...f, marks: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.marks && <p className="text-sm text-destructive mt-1">{errors.marks}</p>}
              </div>
              <div>
                <Label htmlFor="assignment" className="text-sm font-semibold">Assignment</Label>
                <Input
                  id="assignment"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="90"
                  value={form.assignmentScore}
                  onChange={e => setForm(f => ({ ...f, assignmentScore: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.assignmentScore && <p className="text-sm text-destructive mt-1">{errors.assignmentScore}</p>}
              </div>
            </div>

            <Button type="submit" className="w-full gap-2 gradient-primary border-0 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow">
              <Sparkles className="w-4 h-4" /> Add Student
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
