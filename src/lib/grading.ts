// SSHS DepEd grading engine

export type SubjectType =
  | "CORE"
  | "ACADEMIC_ELECTIVE"
  | "ACADEMIC_ELECTIVE_FAS"
  | "TECHPRO_ELECTIVE"
  | "TECHPRO_WORK_IMMERSION"
  | "OLD_CORE"
  | "OLD_ACADEMIC"
  | "OLD_WORK_IMMERSION"
  | "OLD_TVL_SPORTS_ARTS";

export const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: "CORE", label: "New: Core Subject (20/50/30)" },
  { value: "ACADEMIC_ELECTIVE", label: "New: Academic Elective (20/50/30)" },
  {
    value: "ACADEMIC_ELECTIVE_FAS",
    label: "New: Academic Elective – Field Exp./Sports/Arts (15/70/15)",
  },
  { value: "TECHPRO_ELECTIVE", label: "New: TechPro Elective (15/65/20)" },
  { value: "TECHPRO_WORK_IMMERSION", label: "New: TechPro Work Immersion (20/80/0)" },
  { value: "OLD_CORE", label: "Old: Core Subjects – All Tracks (25/50/25)" },
  { value: "OLD_ACADEMIC", label: "Old: Academic Track except Immersion (25/45/30)" },
  {
    value: "OLD_WORK_IMMERSION",
    label: "Old: Work Immersion / Culminating Activity – Academic (35/40/25)",
  },
  {
    value: "OLD_TVL_SPORTS_ARTS",
    label: "Old: TVL / Sports / Arts and Design Track (20/60/20)",
  },
];

export interface Weights {
  ww: number; // written/oral
  pt: number; // performance/product
  st: number; // summative + term exam
}

export function getWeights(t: SubjectType): Weights {
  switch (t) {
    case "CORE":
    case "ACADEMIC_ELECTIVE":
      return { ww: 0.2, pt: 0.5, st: 0.3 };
    case "ACADEMIC_ELECTIVE_FAS":
      return { ww: 0.15, pt: 0.7, st: 0.15 };
    case "TECHPRO_ELECTIVE":
      return { ww: 0.15, pt: 0.65, st: 0.2 };
    case "TECHPRO_WORK_IMMERSION":
      return { ww: 0.2, pt: 0.8, st: 0 };
    case "OLD_CORE":
      return { ww: 0.25, pt: 0.5, st: 0.25 };
    case "OLD_ACADEMIC":
      return { ww: 0.25, pt: 0.45, st: 0.3 };
    case "OLD_WORK_IMMERSION":
      return { ww: 0.35, pt: 0.4, st: 0.25 };
    case "OLD_TVL_SPORTS_ARTS":
      return { ww: 0.2, pt: 0.6, st: 0.2 };
  }
}

export type Category = "WW" | "PT" | "ST";

export interface Assessment {
  id: string;
  name: string;
  highest_score: number;
  category: Category;
  position: number;
}

export interface ScoreMap {
  // student_id -> assessment_id -> score
  [studentId: string]: { [assessmentId: string]: number | null };
}

export interface CategoryResult {
  total: number;
  hps: number;
  ps: number; // percentage score
  ws: number; // weighted score
}

export function computeCategory(
  scores: { [aid: string]: number | null },
  assessments: Assessment[],
  weight: number,
): CategoryResult {
  let total = 0;
  let hps = 0;
  let any = false;
  for (const a of assessments) {
    const s = scores[a.id];
    if (s !== undefined && s !== null && !Number.isNaN(s)) {
      total += Number(s);
      hps += Number(a.highest_score);
      any = true;
    }
  }
  if (!any || hps === 0) return { total: 0, hps: 0, ps: 0, ws: 0 };
  const ps = (total / hps) * 100;
  return { total, hps, ps, ws: ps * weight };
}

export interface TransmutationRow {
  min_initial: number;
  max_initial: number;
  transmuted: number;
}

export function transmute(initial: number, table: TransmutationRow[]): number {
  if (initial <= 0) return 60;
  for (const r of table) {
    if (initial >= r.min_initial && initial <= r.max_initial)
      return r.transmuted;
  }
  return Math.round(initial);
}

export function letterGrade(g: number): string {
  if (g >= 90) return "Outstanding";
  if (g >= 85) return "Very Satisfactory";
  if (g >= 80) return "Satisfactory";
  if (g >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

/** Single-letter grade shown on the printed DepEd class record (e.g. 84 → B). */
export function shortLetterGrade(g: number): string {
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 75) return "C";
  return "D";
}

export const TERM_LABELS = ["FIRST TERM", "SECOND TERM", "THIRD TERM"] as const;

export function assessmentColumnLabel(
  category: Category,
  index: number,
  count: number,
): string {
  if (category === "ST") {
    if (count === 3) return (["SA1", "SA2", "TE"] as const)[index] ?? String(index + 1);
    if (count === 2) return (["SA1", "TE"] as const)[index] ?? String(index + 1);
    if (count === 1) return "TE";
    return `SA${index + 1}`;
  }
  return String(index + 1);
}

export function remarks(g: number): "Passed" | "Failed" {
  return g >= 75 ? "Passed" : "Failed";
}

export interface TermComputation {
  ww: CategoryResult;
  pt: CategoryResult;
  st: CategoryResult;
  initial: number;
  transmuted: number;
  letter: string;
  remarks: "Passed" | "Failed";
}

export function computeTerm(
  studentScores: { [aid: string]: number | null },
  assessmentsByCat: { WW: Assessment[]; PT: Assessment[]; ST: Assessment[] },
  weights: Weights,
  table: TransmutationRow[],
): TermComputation {
  const ww = computeCategory(studentScores, assessmentsByCat.WW, weights.ww);
  const pt = computeCategory(studentScores, assessmentsByCat.PT, weights.pt);
  const st = computeCategory(studentScores, assessmentsByCat.ST, weights.st);
  const initial = ww.ws + pt.ws + st.ws;
  const transmuted = transmute(initial, table);
  return {
    ww,
    pt,
    st,
    initial,
    transmuted,
    letter: letterGrade(transmuted),
    remarks: remarks(transmuted),
  };
}
