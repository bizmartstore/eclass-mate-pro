
# SSHS E-Class Record System — Build Plan

This is a large, multi-module app. I'll build it on Lovable Cloud (auth + Postgres + RLS) and ship it in phases so you can validate each stage. Phase 1 lands a working, end‑to‑end grading flow that exactly matches the DepEd SSHS computation pipeline from your Excel template. Phases 2–3 add reports, exports, backups, and polish.

## Stack
- TanStack Start + React + TypeScript + Tailwind + shadcn/ui
- Lovable Cloud (Supabase): Auth, Postgres, RLS
- Email + 6‑digit PIN auth (ATM-style numeric keypad). PIN stored as a salted hash (bcrypt via pgcrypto); never plaintext.

## Phase 1 — Core system (this build)
1. **Auth & accounts**
   - Register: Full Name, Email, School, 6‑digit PIN (hashed server-side via a `createServerFn` calling `supabase.auth.admin` + profile insert).
   - Login: Email + numeric keypad PIN. Server fn verifies hash → issues session.
   - Account deletion: re-enter PIN → cascade delete all user data.
2. **Schema (RLS, owner = teacher)**
   - `profiles`, `sections`, `students`, `subjects/input_data`, `assessment_categories` (WW/PT/ST per term), `assessments` (with HPS), `student_scores`, `transmutation_table` (default DepEd 60→100 table seeded), `audit_logs`.
   - All tables: `teacher_id uuid` + RLS `auth.uid() = teacher_id`. Grants for `authenticated`.
3. **Dashboard**: counts + per‑term completion % cards.
4. **Sections module**: CRUD with Grade, Strand/Track, Section, SY, Semester, Adviser.
5. **Students module**: per-section roster (LRN, Last/First/Middle, Sex, Status), bulk add, search/sort.
6. **Input Data module**: Region, Division, School, School ID, Subject, Subject Type (drives weights), Grade, Strand/Track, Section, SY, Teacher, Term info.
7. **Subject Type → weights** (exactly as specified):
   - Core / Academic Electives: 20 / 50 / 30
   - Academic Electives (Field Exp/Sports/Arts): 15 / 70 / 15
   - TechPro Electives: 15 / 65 / 20
   - TechPro Work Immersion: 20 / 80 / 0 (ST N/A)
8. **Term 1/2/3 grading pages** (identical layout per term)
   - Dynamic assessment columns under WW, PT, ST with custom names and HPS.
   - Score grid: rows = students, cells = raw scores. **Autosave on blur** with toast.
   - Live-computed columns: WW PS/WS, PT PS/WS, ST PS/WS, Initial Grade, Transmuted, Letter, Remarks.
9. **Computation engine** (pure TS, used by UI and reports)
   - PS = total/HPS×100; WS = PS×weight; Initial = sum(WS); Transmuted via table; Letter (Outstanding/Very Satisfactory/Satisfactory/Fairly Satisfactory/Did Not Meet Expectations); Remarks (Passed/Failed at 75).
10. **Summary page**: T1, T2, T3, Final Average, Letter, Remarks — auto-updates.
11. **Transmutation Table admin**: editable values, latest used by engine.

## Phase 2 — Reporting & exports
- PDF reports (student, section, term, summary) with DepEd-style layout (pdf-lib server fn).
- Excel export matching the SSHS template (uses your uploaded workbook structure as the basis), plus CSV.

## Phase 3 — Backup, polish, audit
- JSON backup/restore per teacher.
- Audit log viewer.
- Mobile polish, keyboard shortcuts on score grid.

## Notes / decisions I'll make as defaults (tell me if any should change)
- Default transmutation: standard DepEd table (Initial 0–100 → Transmuted 60–100, the widely used SHS table). Editable in‑app.
- Letter grades: 90+ Outstanding, 85–89 Very Satisfactory, 80–84 Satisfactory, 75–79 Fairly Satisfactory, <75 Did Not Meet Expectations.
- Term Examination is modeled as an assessment under the "Summative Tests" category (matches the Excel: ST = unit/summative tests + term exam combined into one weighted bucket).
- PIN: 6 digits, hashed with `crypt(pin, gen_salt('bf'))` via pgcrypto inside a SECURITY DEFINER function; never returned to client.

After you approve, I'll enable Lovable Cloud, create the schema, and ship Phase 1.
