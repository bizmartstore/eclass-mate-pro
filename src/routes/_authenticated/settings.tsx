import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Trash2, AlertTriangle, Download, Upload, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PinKeypad } from "@/components/PinKeypad";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);

  const handleExport = async () => {
    setBackupBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const [sections, students, assessments, scores, transmutation, profileRow] = await Promise.all([
        supabase.from("sections").select("*"),
        supabase.from("students").select("*"),
        supabase.from("assessments").select("*"),
        supabase.from("student_scores").select("*"),
        supabase.from("transmutation_table").select("*").eq("teacher_id", u.user.id),
        supabase.from("profiles").select("*").eq("id", u.user.id).single(),
      ]);
      const backup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        userId: u.user.id,
        profile: profileRow.data,
        sections: sections.data ?? [],
        students: students.data ?? [],
        assessments: assessments.data ?? [],
        student_scores: scores.data ?? [],
        transmutation_table: transmutation.data ?? [],
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `eclassmate-backup-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setBackupBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !Array.isArray(data.sections)) throw new Error("Invalid backup file");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const uid = u.user.id;

      // Remap IDs to avoid conflicts with existing data
      const sectionMap = new Map<string, string>();
      const studentMap = new Map<string, string>();
      const assessmentMap = new Map<string, string>();
      const uuid = () => crypto.randomUUID();

      const sectionsIn = (data.sections as any[]).map((s) => {
        const newId = uuid();
        sectionMap.set(s.id, newId);
        const { id: _i, teacher_id: _t, created_at: _c, updated_at: _u, ...rest } = s;
        return { ...rest, id: newId, teacher_id: uid };
      });
      const studentsIn = (data.students as any[]).map((s) => {
        const newId = uuid();
        studentMap.set(s.id, newId);
        const { id: _i, teacher_id: _t, section_id, created_at: _c, updated_at: _u, ...rest } = s;
        return { ...rest, id: newId, teacher_id: uid, section_id: sectionMap.get(section_id) ?? section_id };
      });
      const assessmentsIn = (data.assessments as any[]).map((a) => {
        const newId = uuid();
        assessmentMap.set(a.id, newId);
        const { id: _i, teacher_id: _t, section_id, created_at: _c, updated_at: _u, ...rest } = a;
        return { ...rest, id: newId, teacher_id: uid, section_id: sectionMap.get(section_id) ?? section_id };
      });
      const scoresIn = (data.student_scores as any[] ?? []).map((sc) => {
        const { id: _i, teacher_id: _t, student_id, assessment_id, created_at: _c, updated_at: _u, ...rest } = sc;
        return {
          ...rest,
          id: uuid(),
          teacher_id: uid,
          student_id: studentMap.get(student_id) ?? student_id,
          assessment_id: assessmentMap.get(assessment_id) ?? assessment_id,
        };
      });

      const chunk = <T,>(arr: T[], n = 500) => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
        return out;
      };

      if (sectionsIn.length) {
        for (const part of chunk(sectionsIn)) {
          const { error } = await supabase.from("sections").insert(part);
          if (error) throw error;
        }
      }
      if (studentsIn.length) {
        for (const part of chunk(studentsIn)) {
          const { error } = await supabase.from("students").insert(part);
          if (error) throw error;
        }
      }
      if (assessmentsIn.length) {
        for (const part of chunk(assessmentsIn)) {
          const { error } = await supabase.from("assessments").insert(part);
          if (error) throw error;
        }
      }
      if (scoresIn.length) {
        for (const part of chunk(scoresIn)) {
          const { error } = await supabase.from("student_scores").insert(part);
          if (error) throw error;
        }
      }

      await queryClient.invalidateQueries();
      toast.success(`Imported ${sectionsIn.length} sections, ${studentsIn.length} students, ${assessmentsIn.length} assessments, ${scoresIn.length} scores`);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBackupBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").single();
      return data;
    },
  });

  const { data: trans = [] } = useQuery({
    queryKey: ["transmutation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transmutation_table")
        .select("min_initial,max_initial,transmuted")
        .order("max_initial", { ascending: false });
      return data ?? [];
    },
  });

  const handleDelete = async () => {
    if (pin.length !== 6) {
      toast.error("Enter your 6-digit PIN");
      return;
    }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user?.email) {
      setBusy(false);
      return;
    }
    // Verify PIN by re-authenticating
    const { error } = await supabase.auth.signInWithPassword({
      email: u.user.email,
      password: pin,
    });
    if (error) {
      setBusy(false);
      toast.error("Incorrect PIN");
      setPin("");
      return;
    }
    // Delete profile -> cascade. Auth user is not deleted from client side; data is gone.
    const { error: dErr } = await supabase.from("profiles").delete().eq("id", u.user.id);
    if (dErr) {
      setBusy(false);
      toast.error(dErr.message);
      return;
    }
    await supabase.auth.signOut();
    setBusy(false);
    toast.success("Account data deleted");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Name: </span>{profile?.full_name}</div>
          <div><span className="text-muted-foreground">School: </span>{profile?.school_name}</div>
          <div><span className="text-muted-foreground">Email: </span>{profile?.email}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>DepEd Transmutation Table</CardTitle>
          <CardDescription>Initial Grade → Transmuted Grade (used by the grading engine).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Initial Range</th>
                  <th className="px-3 py-2 text-right">Transmuted</th>
                </tr>
              </thead>
              <tbody>
                {trans.map((t, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1 font-mono text-xs">{t.min_initial.toFixed(2)} – {t.max_initial.toFixed(2)}</td>
                    <td className="px-3 py-1 text-right font-bold">{t.transmuted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all sections, students, assessments, and scores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPin(""); }}>
            <DialogTrigger asChild>
              <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Account</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all your data. Enter your 6-digit PIN to confirm.
              </p>
              <PinKeypad value={pin} onChange={setPin} />
              <DialogFooter>
                <Button variant="destructive" onClick={handleDelete} disabled={busy || pin.length !== 6}>
                  {busy ? "Deleting..." : "Permanently Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
