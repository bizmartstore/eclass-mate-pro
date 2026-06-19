import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  Printer,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ClassRecordSheet } from "@/components/ClassRecordSheet";
import {
  computeTerm,
  getWeights,
  SUBJECT_TYPES,
  type Assessment,
  type Category,
  type SubjectType,
  type TransmutationRow,
} from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/sections/$id")({
  component: SectionDetail,
});

function SectionDetail() {
  const { id } = Route.useParams();

  const { data: section } = useQuery({
    queryKey: ["section", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!section) return <div className="p-6">Loading…</div>;

  return (
    <div className="space-y-4 max-w-none mx-auto">
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sections">
            <ArrowLeft className="h-4 w-4 mr-1" /> All Sections
          </Link>
        </Button>
      </div>
      <div className="print:hidden">
        <h1 className="text-2xl md:text-3xl font-bold">
          Grade {section.grade_level} - {section.section_name}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {section.subject_name || "(no subject)"} • {section.strand} • {section.school_year} • {section.semester}
        </p>
      </div>

      <Tabs defaultValue="students">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full print:hidden">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="input">Input Data</TabsTrigger>
          <TabsTrigger value="t1">Term 1</TabsTrigger>
          <TabsTrigger value="t2">Term 2</TabsTrigger>
          <TabsTrigger value="t3">Term 3</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>
        <TabsContent value="students"><StudentsTab sectionId={id} /></TabsContent>
        <TabsContent value="input"><InputDataTab section={section} /></TabsContent>
        <TabsContent value="t1"><TermGrid section={section} term={1} subjectType={section.subject_type as SubjectType} /></TabsContent>
        <TabsContent value="t2"><TermGrid section={section} term={2} subjectType={section.subject_type as SubjectType} /></TabsContent>
        <TabsContent value="t3"><TermGrid section={section} term={3} subjectType={section.subject_type as SubjectType} /></TabsContent>
        <TabsContent value="summary"><SummaryTab sectionId={id} subjectType={section.subject_type as SubjectType} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Students -------------------- */

function StudentsTab({ sectionId }: { sectionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [bulk, setBulk] = useState("");
  const [form, setForm] = useState({
    id: "",
    lrn: "",
    last_name: "",
    first_name: "",
    middle_name: "",
    sex: "M",
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("section_id", sectionId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    return (
      !q ||
      s.last_name.toLowerCase().includes(q) ||
      s.first_name.toLowerCase().includes(q) ||
      (s.lrn ?? "").toLowerCase().includes(q)
    );
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        teacher_id: u.user.id,
        section_id: sectionId,
        lrn: form.lrn || null,
        last_name: form.last_name,
        first_name: form.first_name,
        middle_name: form.middle_name || null,
        sex: form.sex,
      };
      if (form.id) {
        const { error } = await supabase
          .from("students")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", sectionId] });
      setOpen(false);
      setForm({ id: "", lrn: "", last_name: "", first_name: "", middle_name: "", sex: "M" });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkAdd = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const rows = bulk
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          // Format: LastName, FirstName MiddleName  OR  LastName, FirstName, MiddleName
          const [last, rest] = line.split(",");
          const r = (rest ?? "").trim().split(/\s+/);
          return {
            teacher_id: u.user!.id,
            section_id: sectionId,
            last_name: (last ?? "").trim() || line,
            first_name: r[0] ?? "",
            middle_name: r.slice(1).join(" ") || null,
            sex: "M",
          };
        });
      if (!rows.length) return;
      const { error } = await supabase.from("students").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students", sectionId] });
      setBulkOpen(false);
      setBulk("");
      toast.success("Students added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (sid: string) => {
      const { error } = await supabase.from("students").delete().eq("id", sid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["students", sectionId] }),
  });

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search by name or LRN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Plus className="h-4 w-4 mr-1" />Bulk Add</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Bulk Add Students</DialogTitle></DialogHeader>
            <p className="text-xs text-muted-foreground">
              One per line. Format: <code>LastName, FirstName MiddleName</code>
            </p>
            <textarea
              className="w-full h-48 border rounded p-2 text-sm font-mono"
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
              placeholder="Dela Cruz, Juan Santos&#10;Reyes, Maria Lopez"
            />
            <DialogFooter>
              <Button onClick={() => bulkAdd.mutate()} disabled={bulkAdd.isPending}>
                Add Students
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm({ id: "", lrn: "", last_name: "", first_name: "", middle_name: "", sex: "M" }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />Add Student</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit Student" : "Add Student"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="LRN" className="col-span-2"><Input value={form.lrn} onChange={(e) => setForm({ ...form, lrn: e.target.value })} /></Field>
              <Field label="Last Name"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field>
              <Field label="First Name"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field>
              <Field label="Middle Name"><Input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></Field>
              <Field label="Sex">
                <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.last_name || !form.first_name}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-3 py-2 w-10">#</th>
                <th className="px-3 py-2">LRN</th>
                <th className="px-3 py-2">Last Name</th>
                <th className="px-3 py-2">First Name</th>
                <th className="px-3 py-2">Middle Name</th>
                <th className="px-3 py-2">Sex</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.lrn ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{s.last_name}</td>
                  <td className="px-3 py-2">{s.first_name}</td>
                  <td className="px-3 py-2">{s.middle_name ?? ""}</td>
                  <td className="px-3 py-2">{s.sex}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete student?")) del.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">No students.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------------------- Input Data -------------------- */

function InputDataTab({ section }: { section: Record<string, any> }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    region: section.region ?? "",
    division: section.division ?? "",
    school_name: section.school_name ?? "",
    school_id: section.school_id ?? "",
    teacher_name: section.teacher_name ?? "",
    subject_name: section.subject_name ?? "",
    subject_type: section.subject_type,
    grade_level: section.grade_level,
    track: section.track ?? "",
    strand: section.strand ?? "",
    section_name: section.section_name,
    school_year: section.school_year,
    semester: section.semester,
    adviser: section.adviser ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sections").update(form).eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["section", section.id] });
      qc.invalidateQueries({ queryKey: ["sections"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const w = getWeights(form.subject_type as SubjectType);

  return (
    <div className="space-y-4 mt-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Region"><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></Field>
          <Field label="Division"><Input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></Field>
          <Field label="School Name"><Input value={form.school_name} onChange={(e) => setForm({ ...form, school_name: e.target.value })} /></Field>
          <Field label="School ID"><Input value={form.school_id} onChange={(e) => setForm({ ...form, school_id: e.target.value })} /></Field>
          <Field label="Teacher Name"><Input value={form.teacher_name} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })} /></Field>
          <Field label="Adviser"><Input value={form.adviser} onChange={(e) => setForm({ ...form, adviser: e.target.value })} /></Field>
          <Field label="Subject Name"><Input value={form.subject_name} onChange={(e) => setForm({ ...form, subject_name: e.target.value })} /></Field>
          <Field label="Subject Type" className="md:col-span-2">
            <Select value={form.subject_type} onValueChange={(v) => setForm({ ...form, subject_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Grade Level">
            <Select value={form.grade_level} onValueChange={(v) => setForm({ ...form, grade_level: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="11">Grade 11</SelectItem>
                <SelectItem value="12">Grade 12</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Track"><Input value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} /></Field>
          <Field label="Strand"><Input value={form.strand} onChange={(e) => setForm({ ...form, strand: e.target.value })} /></Field>
          <Field label="Section"><Input value={form.section_name} onChange={(e) => setForm({ ...form, section_name: e.target.value })} /></Field>
          <Field label="School Year"><Input value={form.school_year} onChange={(e) => setForm({ ...form, school_year: e.target.value })} /></Field>
          <Field label="Term">
            <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Term 1">Term 1</SelectItem>
                <SelectItem value="Term 2">Term 2</SelectItem>
                <SelectItem value="Term 3">Term 3</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 mr-2" /> Save Input Data
          </Button>
        </div>
      </Card>

      <Card className="p-4 bg-primary/5">
        <div className="text-sm font-medium mb-2">Grading Weights for this subject type</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <WeightBox label="Written / Oral Works" value={`${w.ww * 100}%`} />
          <WeightBox label="Performance / Product Tasks" value={`${w.pt * 100}%`} />
          <WeightBox label="Summative + Term Exam" value={w.st === 0 ? "N/A" : `${w.st * 100}%`} />
        </div>
      </Card>
    </div>
  );
}

function WeightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold text-primary mt-1">{value}</div>
    </div>
  );
}

/* -------------------- Term Grid -------------------- */

const CAT_LABEL: Record<Category, string> = {
  WW: "Written / Oral",
  PT: "Performance Task",
  ST: "Summative / Term Exam",
};

function TermGrid({
  section,
  term,
  subjectType,
}: {
  section: Record<string, any>;
  term: number;
  subjectType: SubjectType;
}) {
  const sectionId = section.id as string;
  const qc = useQueryClient();
  const weights = getWeights(subjectType);

  const { data: students = [] } = useQuery({
    queryKey: ["students", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("section_id", sectionId)
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments", sectionId, term],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assessments")
        .select("*")
        .eq("section_id", sectionId)
        .eq("term", term)
        .order("category")
        .order("position");
      if (error) throw error;
      return data as Assessment[] & Record<string, any>[];
    },
  });

  const { data: scoresRaw = [] } = useQuery({
    queryKey: ["scores", sectionId, term],
    queryFn: async () => {
      const aids = (assessments as any[]).map((a) => a.id);
      if (!aids.length) return [];
      const { data, error } = await supabase
        .from("student_scores")
        .select("*")
        .in("assessment_id", aids);
      if (error) throw error;
      return data;
    },
    enabled: assessments.length > 0,
  });

  const { data: trans = [] } = useQuery({
    queryKey: ["transmutation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transmutation_table")
        .select("min_initial, max_initial, transmuted")
        .order("max_initial", { ascending: false });
      if (error) throw error;
      return data as TransmutationRow[];
    },
  });

  const scoreMap = useMemo(() => {
    const m: Record<string, Record<string, number | null>> = {};
    for (const r of scoresRaw as any[]) {
      if (!m[r.student_id]) m[r.student_id] = {};
      m[r.student_id][r.assessment_id] = r.score;
    }
    return m;
  }, [scoresRaw]);

  const byCat = useMemo(() => {
    const a = assessments as Assessment[];
    return {
      WW: a.filter((x) => x.category === "WW"),
      PT: a.filter((x) => x.category === "PT"),
      ST: a.filter((x) => x.category === "ST"),
    };
  }, [assessments]);

  const addAssessment = useMutation({
    mutationFn: async ({ category, name, hps }: { category: Category; name: string; hps: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const pos = (assessments as Assessment[]).filter((a) => a.category === category).length;
      const { error } = await supabase.from("assessments").insert({
        teacher_id: u.user.id,
        section_id: sectionId,
        term,
        category,
        name,
        highest_score: hps,
        position: pos,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments", sectionId, term] }),
  });

  const delAssessment = useMutation({
    mutationFn: async (aid: string) => {
      const { error } = await supabase.from("assessments").delete().eq("id", aid);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assessments", sectionId, term] });
      qc.invalidateQueries({ queryKey: ["scores", sectionId, term] });
    },
  });

  const saveScore = useCallback(
    async (studentId: string, assessmentId: string, score: number | null) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { error } = await supabase
        .from("student_scores")
        .upsert(
          {
            teacher_id: u.user.id,
            student_id: studentId,
            assessment_id: assessmentId,
            score,
          },
          { onConflict: "student_id,assessment_id" },
        );
      if (error) toast.error(error.message);
      else {
        toast.success("Saved", { duration: 1000 });
        qc.invalidateQueries({ queryKey: ["scores", sectionId, term] });
      }
    },
    [qc, sectionId, term],
  );

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap print:hidden">
        <AddAssessmentButton category="WW" onAdd={(name, hps) => addAssessment.mutate({ category: "WW", name, hps })} />
        <AddAssessmentButton category="PT" onAdd={(name, hps) => addAssessment.mutate({ category: "PT", name, hps })} />
        {weights.st > 0 && (
          <AddAssessmentButton category="ST" onAdd={(name, hps) => addAssessment.mutate({ category: "ST", name, hps })} />
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Weights: WW {weights.ww * 100}% • PT {weights.pt * 100}% • ST {weights.st === 0 ? "N/A" : `${weights.st * 100}%`}
          </span>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Print Class Record
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-3 md:p-4 print:border-0 print:shadow-none print:p-0">
        <ClassRecordSheet
          section={section}
          term={term}
          subjectType={subjectType}
          students={students as any[]}
          byCat={byCat}
          scoreMap={scoreMap}
          weights={weights}
          trans={trans}
          onSaveScore={saveScore}
          onDeleteAssessment={(aid) => delAssessment.mutate(aid)}
        />
      </Card>
    </div>
  );
}

function AddAssessmentButton({ category, onAdd }: { category: Category; onAdd: (name: string, hps: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hps, setHps] = useState("100");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3 w-3 mr-1" /> Add {CAT_LABEL[category]}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New {CAT_LABEL[category]} column</DialogTitle></DialogHeader>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Quiz 1" /></Field>
        <Field label="Highest Possible Score"><Input type="number" value={hps} onChange={(e) => setHps(e.target.value)} /></Field>
        <DialogFooter>
          <Button
            onClick={() => {
              const h = Number(hps);
              if (!name || !h || h <= 0) { toast.error("Invalid"); return; }
              onAdd(name, h);
              setName(""); setHps("100"); setOpen(false);
            }}
          >Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Summary -------------------- */

function SummaryTab({ sectionId, subjectType }: { sectionId: string; subjectType: SubjectType }) {
  const weights = getWeights(subjectType);
  const { data: students = [] } = useQuery({
    queryKey: ["students", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("section_id", sectionId).order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assessments = [] } = useQuery({
    queryKey: ["assessments-all", sectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("assessments").select("*").eq("section_id", sectionId);
      if (error) throw error;
      return data as Assessment[] & Record<string, any>[];
    },
  });

  const { data: scoresRaw = [] } = useQuery({
    queryKey: ["scores-all", sectionId],
    queryFn: async () => {
      const aids = (assessments as any[]).map((a) => a.id);
      if (!aids.length) return [];
      const { data, error } = await supabase.from("student_scores").select("*").in("assessment_id", aids);
      if (error) throw error;
      return data;
    },
    enabled: assessments.length > 0,
  });

  const { data: trans = [] } = useQuery({
    queryKey: ["transmutation"],
    queryFn: async () => {
      const { data } = await supabase.from("transmutation_table").select("min_initial,max_initial,transmuted").order("max_initial", { ascending: false });
      return (data ?? []) as TransmutationRow[];
    },
  });

  const scoreMap = useMemo(() => {
    const m: Record<string, Record<string, number | null>> = {};
    for (const r of scoresRaw as any[]) {
      if (!m[r.student_id]) m[r.student_id] = {};
      m[r.student_id][r.assessment_id] = r.score;
    }
    return m;
  }, [scoresRaw]);

  const termAssess = (term: number) => {
    const a = (assessments as Assessment[] & any[]).filter((x: any) => x.term === term);
    return { WW: a.filter((x: any) => x.category === "WW"), PT: a.filter((x: any) => x.category === "PT"), ST: a.filter((x: any) => x.category === "ST") };
  };

  return (
    <div className="mt-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-center">Term 1</th>
                <th className="px-3 py-2 text-center">Term 2</th>
                <th className="px-3 py-2 text-center">Term 3</th>
                <th className="px-3 py-2 text-center bg-primary/10">Final Avg</th>
                <th className="px-3 py-2 text-center bg-primary/10">Letter</th>
                <th className="px-3 py-2 text-center bg-primary/10">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s: any, i) => {
                const sScores = scoreMap[s.id] ?? {};
                const t1 = computeTerm(sScores, termAssess(1), weights, trans).transmuted;
                const t2 = computeTerm(sScores, termAssess(2), weights, trans).transmuted;
                const t3 = computeTerm(sScores, termAssess(3), weights, trans).transmuted;
                const final = Math.round((t1 + t2 + t3) / 3);
                const passed = final >= 75;
                const letter =
                  final >= 90 ? "Outstanding" :
                  final >= 85 ? "Very Satisfactory" :
                  final >= 80 ? "Satisfactory" :
                  final >= 75 ? "Fairly Satisfactory" : "Did Not Meet Expectations";
                return (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{s.last_name}, {s.first_name}</td>
                    <td className="px-3 py-2 text-center font-mono">{t1}</td>
                    <td className="px-3 py-2 text-center font-mono">{t2}</td>
                    <td className="px-3 py-2 text-center font-mono">{t3}</td>
                    <td className="px-3 py-2 text-center font-bold bg-primary/5">{final}</td>
                    <td className="px-3 py-2 text-center text-xs bg-primary/5">{letter}</td>
                    <td className={`px-3 py-2 text-center bg-primary/5 font-medium ${passed ? "text-emerald-700" : "text-destructive"}`}>
                      {passed ? "Passed" : "Failed"}
                    </td>
                  </tr>
                );
              })}
              {!students.length && (
                <tr><td colSpan={8} className="text-center text-muted-foreground py-8">No students.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className ?? ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
