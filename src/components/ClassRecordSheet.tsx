import { Fragment, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  assessmentColumnLabel,
  computeTerm,
  shortLetterGrade,
  SUBJECT_TYPES,
  TERM_LABELS,
  type Assessment,
  type Category,
  type SubjectType,
  type TransmutationRow,
  type Weights,
} from "@/lib/grading";

const cell = "border border-black px-1 py-0.5";
const thCell = `${cell} bg-[#d9d9d9] font-semibold text-center align-middle`;
const numCell = `${cell} text-center font-mono tabular-nums`;

function formatStudentName(stu: {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
}) {
  const middle = stu.middle_name ? ` ${stu.middle_name}` : "";
  return `${stu.last_name}, ${stu.first_name}${middle}`.toUpperCase();
}

function ScoreCell({
  initial,
  max,
  onSave,
}: {
  initial: number | null;
  max: number;
  onSave: (v: number | null) => void;
}) {
  const [val, setVal] = useState(initial?.toString() ?? "");
  const ref = useRef(initial);
  useEffect(() => {
    setVal(initial?.toString() ?? "");
    ref.current = initial;
  }, [initial]);

  return (
    <input
      type="number"
      value={val}
      min={0}
      max={max}
      step="0.01"
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const num = val === "" ? null : Number(val);
        if (num === ref.current) return;
        if (num !== null && (Number.isNaN(num) || num < 0 || num > max)) {
          toast.error(`Score must be 0–${max}`);
          setVal(ref.current?.toString() ?? "");
          return;
        }
        onSave(num);
      }}
      className="w-full min-w-[36px] px-0.5 py-0.5 text-center bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary text-[10px] font-mono print:bg-transparent print:ring-0"
    />
  );
}

export interface ClassRecordSheetProps {
  section: Record<string, unknown>;
  term: number;
  subjectType: SubjectType;
  students: Array<{
    id: string;
    last_name: string;
    first_name: string;
    middle_name?: string | null;
    sex?: string | null;
  }>;
  byCat: { WW: Assessment[]; PT: Assessment[]; ST: Assessment[] };
  scoreMap: Record<string, Record<string, number | null>>;
  weights: Weights;
  trans: TransmutationRow[];
  onSaveScore: (studentId: string, assessmentId: string, score: number | null) => void;
  onDeleteAssessment?: (aid: string) => void;
}

export function ClassRecordSheet({
  section,
  term,
  subjectType,
  students,
  byCat,
  scoreMap,
  weights,
  trans,
  onSaveScore,
  onDeleteAssessment,
}: ClassRecordSheetProps) {
  const activeCats = (["WW", "PT", "ST"] as Category[]).filter(
    (c) => c !== "ST" || weights.st > 0,
  );
  const catWeight: Record<Category, number> = {
    WW: weights.ww,
    PT: weights.pt,
    ST: weights.st,
  };

  const males = students.filter((s) => (s.sex ?? "M").toUpperCase() === "M");
  const females = students.filter((s) => (s.sex ?? "").toUpperCase() === "F");

  const subjectTypeLabel =
    SUBJECT_TYPES.find((t) => t.value === subjectType)?.label ?? subjectType;

  const totalCols =
    2 +
    activeCats.reduce((acc, c) => acc + byCat[c].length + 3, 0) +
    3;

  const renderStudentRow = (stu: (typeof students)[0], idx: number) => {
    const sScores = scoreMap[stu.id] ?? {};
    const r = computeTerm(sScores, byCat, weights, trans);
    return (
      <tr key={stu.id}>
        <td className={`${cell} text-center w-8`}>{idx + 1}</td>
        <td className={`${cell} text-left font-medium whitespace-nowrap min-w-[160px]`}>
          {formatStudentName(stu)}
        </td>
        {activeCats.map((cat) => {
          const catKey = cat.toLowerCase() as "ww" | "pt" | "st";
          const result = r[catKey];
          return (
            <Fragment key={cat}>
              {byCat[cat].map((a) => (
                <td key={a.id} className={numCell}>
                  <ScoreCell
                    initial={sScores[a.id] ?? null}
                    max={a.highest_score}
                    onSave={(v) => onSaveScore(stu.id, a.id, v)}
                  />
                </td>
              ))}
              <td className={`${numCell} font-semibold`}>
                {result.total > 0 ? result.total : ""}
              </td>
              <td className={numCell}>
                {result.ps > 0 ? result.ps.toFixed(2) : ""}
              </td>
              <td className={numCell}>
                {result.ws > 0 ? result.ws.toFixed(2) : ""}
              </td>
            </Fragment>
          );
        })}
        <td className={`${numCell} font-semibold`}>
          {r.initial > 0 ? r.initial.toFixed(2) : ""}
        </td>
        <td className={`${numCell} font-bold`}>
          {r.transmuted > 0 ? r.transmuted : ""}
        </td>
        <td className={`${numCell} font-bold`}>
          {r.transmuted > 0 ? shortLetterGrade(r.transmuted) : ""}
        </td>
      </tr>
    );
  };

  return (
    <div
      id="class-record-sheet"
      className="bg-white text-black text-[10px] leading-tight print:text-[9px]"
    >
      {/* DepEd header */}
      <div className="border-2 border-black">
        <div className="flex items-start justify-between px-3 py-2 border-b border-black">
          <img
            src="/images/deped-seal.png"
            alt="DepEd Seal"
            className="h-16 w-16 shrink-0 object-contain"
          />
          <div className="flex-1 text-center px-4">
            <div className="text-sm font-bold uppercase tracking-wide">
              Strengthened Senior High School Class Record
            </div>
            <div className="text-[10px] italic mt-0.5">
              (Pursuant to DepEd Order 15 series of 2026)
            </div>
          </div>
          <img
            src="/images/deped-logo.png"
            alt="DepEd"
            className="h-16 w-auto shrink-0 object-contain"
          />
        </div>

        <table className="w-full border-collapse border-b border-black text-[10px]">
          <tbody>
            <tr>
              <td className={`${cell} font-bold whitespace-nowrap w-[1%]`}>REGION</td>
              <td className={`${cell} uppercase min-w-[100px]`}>
                {String(section.region ?? "")}
              </td>
              <td className={`${cell} font-bold whitespace-nowrap w-[1%]`}>DIVISION</td>
              <td className={`${cell} uppercase min-w-[100px]`}>
                {String(section.division ?? "")}
              </td>
              <td
                rowSpan={2}
                className={`${cell} font-bold whitespace-nowrap align-middle w-[1%]`}
              >
                SCHOOL YEAR
              </td>
              <td rowSpan={2} className={`${cell} uppercase align-middle min-w-[80px]`}>
                {String(section.school_year ?? "")}
              </td>
            </tr>
            <tr>
              <td className={`${cell} font-bold whitespace-nowrap`}>SCHOOL NAME</td>
              <td className={`${cell} uppercase`}>{String(section.school_name ?? "")}</td>
              <td className={`${cell} font-bold whitespace-nowrap`}>SCHOOL ID</td>
              <td className={`${cell} uppercase`}>{String(section.school_id ?? "")}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 md:grid-cols-6 text-[10px]">
          {[
            ["TERM", TERM_LABELS[term - 1] ?? `TERM ${term}`],
            [
              "GRADE LEVEL AND SECTION",
              `${section.grade_level ?? ""} - ${section.section_name ?? ""}`,
            ],
            ["TEACHER", section.teacher_name],
            ["TRACK", section.track || section.strand],
            ["SUBJECT", section.subject_name],
            ["SUBJECT TYPE", subjectTypeLabel],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="border-r border-black last:border-r-0 px-2 py-1.5 min-h-[36px]"
            >
              <div className="font-bold text-[9px]">{String(label)}</div>
              <div className="uppercase mt-0.5">{String(value ?? "")}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grading table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse border-2 border-black">
          <thead>
            <tr>
              <th rowSpan={2} className={`${thCell} w-8`}>
                #
              </th>
              <th rowSpan={2} className={`${thCell} text-left min-w-[160px]`}>
                LEARNERS&apos; NAMES
              </th>
              {activeCats.map((cat) => (
                <th
                  key={cat}
                  colSpan={byCat[cat].length + 3}
                  className={thCell}
                >
                  {cat === "WW" &&
                    `WRITTEN / ORAL WORKS (${Math.round(weights.ww * 100)}%)`}
                  {cat === "PT" &&
                    `PRODUCT / PERFORMANCE TASKS (${Math.round(weights.pt * 100)}%)`}
                  {cat === "ST" &&
                    `SUMMATIVE TESTS & TERM EXAMINATION (${Math.round(weights.st * 100)}%)`}
                </th>
              ))}
              <th rowSpan={2} className={`${thCell} min-w-[52px]`}>
                Initial
                <br />
                Grade
              </th>
              <th rowSpan={2} className={`${thCell} min-w-[52px]`}>
                Transmuted
                <br />
                Grade
              </th>
              <th rowSpan={2} className={`${thCell} min-w-[44px]`}>
                Letter
                <br />
                Grade
              </th>
            </tr>
            <tr>
              {activeCats.map((cat) => (
                <Fragment key={cat}>
                  {byCat[cat].map((a, i) => (
                    <th key={a.id} className={`${thCell} min-w-[36px]`} title={a.name}>
                      <div>{assessmentColumnLabel(cat, i, byCat[cat].length)}</div>
                      {onDeleteAssessment && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete ${a.name}?`)) onDeleteAssessment(a.id);
                          }}
                          className="text-destructive text-[9px] hover:underline print:hidden"
                        >
                          ×
                        </button>
                      )}
                    </th>
                  ))}
                  <th className={`${thCell} min-w-[40px]`}>Total</th>
                  <th className={`${thCell} min-w-[40px]`}>PS</th>
                  <th className={`${thCell} min-w-[40px]`}>WS</th>
                </Fragment>
              ))}
            </tr>
            <tr className="font-semibold">
              <td colSpan={2} className={`${cell} bg-[#d9d9d9] uppercase`}>
                Highest Possible Score
              </td>
              {activeCats.map((cat) => {
                const totalHPS = byCat[cat].reduce(
                  (s, a) => s + Number(a.highest_score || 0),
                  0,
                );
                return (
                  <Fragment key={cat}>
                    {byCat[cat].map((a) => (
                      <td key={a.id} className={`${numCell} bg-[#f5f5f5]`}>
                        {a.highest_score}
                      </td>
                    ))}
                    <td className={`${numCell} bg-[#f5f5f5]`}>{totalHPS || ""}</td>
                    <td className={`${numCell} bg-[#f5f5f5]`}>
                      {totalHPS > 0 ? "100.00" : ""}
                    </td>
                    <td className={`${numCell} bg-[#f5f5f5]`}>
                      {totalHPS > 0 ? `${Math.round(catWeight[cat] * 100)}%` : ""}
                    </td>
                  </Fragment>
                );
              })}
              <td colSpan={3} className={`${cell} bg-[#f5f5f5]`} />
            </tr>
          </thead>
          <tbody>
            {!!males.length && (
              <tr>
                <td
                  colSpan={totalCols}
                  className={`${cell} bg-[#d9d9d9] font-bold uppercase tracking-wide py-1`}
                >
                  Male
                </td>
              </tr>
            )}
            {males.map((stu, i) => renderStudentRow(stu, i))}
            {!!females.length && (
              <tr>
                <td
                  colSpan={totalCols}
                  className={`${cell} bg-[#d9d9d9] font-bold uppercase tracking-wide py-1`}
                >
                  Female
                </td>
              </tr>
            )}
            {females.map((stu, i) => renderStudentRow(stu, i))}
            {!students.length && (
              <tr>
                <td
                  colSpan={totalCols}
                  className={`${cell} text-center text-muted-foreground py-6`}
                >
                  Add students first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
