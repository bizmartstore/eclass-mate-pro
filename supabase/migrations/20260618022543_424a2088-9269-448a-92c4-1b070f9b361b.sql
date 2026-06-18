
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  school_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, school_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'school_name', ''),
    NEW.email
  );
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Sections
CREATE TABLE public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade_level TEXT NOT NULL,
  track TEXT,
  strand TEXT,
  section_name TEXT NOT NULL,
  school_year TEXT NOT NULL,
  semester TEXT NOT NULL,
  adviser TEXT,
  subject_name TEXT,
  subject_type TEXT NOT NULL DEFAULT 'CORE',
  region TEXT, division TEXT, school_name TEXT, school_id TEXT, teacher_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sections TO authenticated;
GRANT ALL ON public.sections TO service_role;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sections" ON public.sections FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE TRIGGER trg_sections_updated BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Students
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  lrn TEXT,
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  sex TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own students" ON public.students FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE INDEX ON public.students(section_id);
CREATE TRIGGER trg_students_updated BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Assessments (per section / term / category)
-- category: WW (Written), PT (Performance), ST (Summative/Term Exam)
-- term: 1, 2, 3
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  term SMALLINT NOT NULL CHECK (term IN (1,2,3)),
  category TEXT NOT NULL CHECK (category IN ('WW','PT','ST')),
  name TEXT NOT NULL,
  highest_score NUMERIC NOT NULL DEFAULT 100,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own assessments" ON public.assessments FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE INDEX ON public.assessments(section_id, term, category);
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Student scores
CREATE TABLE public.student_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, assessment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_scores TO authenticated;
GRANT ALL ON public.student_scores TO service_role;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scores" ON public.student_scores FOR ALL USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE INDEX ON public.student_scores(assessment_id);
CREATE INDEX ON public.student_scores(student_id);
CREATE TRIGGER trg_scores_updated BEFORE UPDATE ON public.student_scores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Transmutation table (per teacher; default seeded via separate global table)
CREATE TABLE public.transmutation_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  min_initial NUMERIC NOT NULL,
  max_initial NUMERIC NOT NULL,
  transmuted NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transmutation_table TO authenticated;
GRANT ALL ON public.transmutation_table TO service_role;
ALTER TABLE public.transmutation_table ENABLE ROW LEVEL SECURITY;
-- Teachers see their own rows OR the global defaults (teacher_id IS NULL)
CREATE POLICY "view transmutation" ON public.transmutation_table FOR SELECT USING (teacher_id IS NULL OR auth.uid() = teacher_id);
CREATE POLICY "manage own transmutation" ON public.transmutation_table FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "update own transmutation" ON public.transmutation_table FOR UPDATE USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "delete own transmutation" ON public.transmutation_table FOR DELETE USING (auth.uid() = teacher_id);

-- Seed standard DepEd SHS transmutation table (Initial -> Transmuted)
INSERT INTO public.transmutation_table (teacher_id, min_initial, max_initial, transmuted) VALUES
(NULL, 100, 100, 100),
(NULL, 98.40, 99.99, 99),
(NULL, 96.80, 98.39, 98),
(NULL, 95.20, 96.79, 97),
(NULL, 93.60, 95.19, 96),
(NULL, 92.00, 93.59, 95),
(NULL, 90.40, 91.99, 94),
(NULL, 88.80, 90.39, 93),
(NULL, 87.20, 88.79, 92),
(NULL, 85.60, 87.19, 91),
(NULL, 84.00, 85.59, 90),
(NULL, 82.40, 83.99, 89),
(NULL, 80.80, 82.39, 88),
(NULL, 79.20, 80.79, 87),
(NULL, 77.60, 79.19, 86),
(NULL, 76.00, 77.59, 85),
(NULL, 74.40, 75.99, 84),
(NULL, 72.80, 74.39, 83),
(NULL, 71.20, 72.79, 82),
(NULL, 69.60, 71.19, 81),
(NULL, 68.00, 69.59, 80),
(NULL, 66.40, 67.99, 79),
(NULL, 64.80, 66.39, 78),
(NULL, 63.20, 64.79, 77),
(NULL, 61.60, 63.19, 76),
(NULL, 60.00, 61.59, 75),
(NULL, 56.00, 59.99, 74),
(NULL, 52.00, 55.99, 73),
(NULL, 48.00, 51.99, 72),
(NULL, 44.00, 47.99, 71),
(NULL, 40.00, 43.99, 70),
(NULL, 36.00, 39.99, 69),
(NULL, 32.00, 35.99, 68),
(NULL, 28.00, 31.99, 67),
(NULL, 24.00, 27.99, 66),
(NULL, 20.00, 23.99, 65),
(NULL, 16.00, 19.99, 64),
(NULL, 12.00, 15.99, 63),
(NULL, 8.00, 11.99, 62),
(NULL, 4.00, 7.99, 61),
(NULL, 0.00, 3.99, 60);
