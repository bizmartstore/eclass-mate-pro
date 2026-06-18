import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [sections, students, scores, assessments] = await Promise.all([
        supabase.from("sections").select("id", { count: "exact", head: true }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("student_scores").select("score, assessment_id, student_id"),
        supabase.from("assessments").select("id, term, section_id"),
      ]);
      const completion = [1, 2, 3].map((term) => {
        const termAssess = (assessments.data ?? []).filter((a) => a.term === term);
        const aids = new Set(termAssess.map((a) => a.id));
        const filled = (scores.data ?? []).filter(
          (s) => aids.has(s.assessment_id) && s.score !== null,
        ).length;
        const totalNeeded = termAssess.length * (students.count ?? 0);
        return totalNeeded > 0 ? Math.round((filled / totalNeeded) * 100) : 0;
      });
      return {
        sections: sections.count ?? 0,
        students: students.count ?? 0,
        completion,
      };
    },
  });

  const cards = [
    { label: "Total Sections", value: stats?.sections ?? 0, icon: BookOpen },
    { label: "Total Students", value: stats?.students ?? 0, icon: Users },
    {
      label: "Term 1 Completion",
      value: `${stats?.completion[0] ?? 0}%`,
      icon: CheckCircle2,
    },
    {
      label: "Term 2 Completion",
      value: `${stats?.completion[1] ?? 0}%`,
      icon: CheckCircle2,
    },
    {
      label: "Term 3 Completion",
      value: `${stats?.completion[2] ?? 0}%`,
      icon: CheckCircle2,
    },
    {
      label: "Overall Records",
      value: (stats?.sections ?? 0) + (stats?.students ?? 0),
      icon: GraduationCap,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back. Here's an overview of your e-class records.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl md:text-3xl font-bold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. Go to <strong>Sections</strong> and create a new section for your class.
          </p>
          <p>
            2. Add your students to the section roster.
          </p>
          <p>
            3. Fill in the <strong>Input Data</strong> tab (subject type controls the
            grading weights).
          </p>
          <p>
            4. Create assessments under Term 1 / 2 / 3, then enter raw scores. The
            system auto-saves and computes grades using the DepEd transmutation table.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
