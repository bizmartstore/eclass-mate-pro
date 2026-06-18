import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUBJECT_TYPES } from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/sections")({
  component: SectionsPage,
});

interface SectionInput {
  id?: string;
  grade_level: string;
  track: string;
  strand: string;
  section_name: string;
  school_year: string;
  semester: string;
  adviser: string;
  subject_name: string;
  subject_type: string;
}

const empty: SectionInput = {
  grade_level: "11",
  track: "Academic",
  strand: "STEM",
  section_name: "",
  school_year: "2025-2026",
  semester: "1st Semester",
  adviser: "",
  subject_name: "",
  subject_type: "CORE",
};

function SectionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SectionInput>(empty);

  const { data: sections = [] } = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (v: SectionInput) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      if (v.id) {
        const { error } = await supabase
          .from("sections")
          .update({
            grade_level: v.grade_level,
            track: v.track,
            strand: v.strand,
            section_name: v.section_name,
            school_year: v.school_year,
            semester: v.semester,
            adviser: v.adviser,
            subject_name: v.subject_name,
            subject_type: v.subject_type,
          })
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sections").insert({
          teacher_id: u.user.id,
          grade_level: v.grade_level,
          track: v.track,
          strand: v.strand,
          section_name: v.section_name,
          school_year: v.school_year,
          semester: v.semester,
          adviser: v.adviser,
          subject_name: v.subject_name,
          subject_type: v.subject_type,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      setOpen(false);
      setForm(empty);
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Deleted");
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sections</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage your class sections.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> New Section
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{form.id ? "Edit Section" : "New Section"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grade Level">
                <Select value={form.grade_level} onValueChange={(v) => setForm({ ...form, grade_level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="11">Grade 11</SelectItem>
                    <SelectItem value="12">Grade 12</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Section Name">
                <Input value={form.section_name} onChange={(e) => setForm({ ...form, section_name: e.target.value })} />
              </Field>
              <Field label="Track">
                <Input value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} />
              </Field>
              <Field label="Strand">
                <Input value={form.strand} onChange={(e) => setForm({ ...form, strand: e.target.value })} />
              </Field>
              <Field label="School Year">
                <Input value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} />
              </Field>
              <Field label="Semester">
                <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1st Semester">1st Semester</SelectItem>
                    <SelectItem value="2nd Semester">2nd Semester</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Subject Name" className="col-span-2">
                <Input value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} />
              </Field>
              <Field label="Subject Type" className="col-span-2">
                <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUBJECT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Adviser" className="col-span-2">
                <Input value={form.adviser} onChange={(e) => setForm({ ...form, adviser: e.target.value })} />
              </Field>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.section_name}>
                {save.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3">
        {sections.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            No sections yet. Create your first section to get started.
          </Card>
        ) : (
          sections.map((s) => (
            <Card key={s.id} className="p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  Grade {s.grade_level} - {s.section_name}
                  <span className="text-muted-foreground font-normal ml-2 text-sm">
                    ({s.strand})
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.subject_name || "—"} • {s.school_year} • {s.semester}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setForm({
                    id: s.id,
                    grade_level: s.grade_level,
                    track: s.track ?? "",
                    strand: s.strand ?? "",
                    section_name: s.section_name,
                    school_year: s.school_year,
                    semester: s.semester,
                    adviser: s.adviser ?? "",
                    subject_name: s.subject_name ?? "",
                    subject_type: s.subject_type,
                  });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Delete this section and all its data?")) del.mutate(s.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="sm" asChild>
                <Link to="/sections/$id" params={{ id: s.id }}>
                  Open <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
