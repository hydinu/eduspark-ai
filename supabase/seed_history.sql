-- ============================================================
-- EduSpark AI — Seed Test History Data
-- Run in Supabase SQL Editor after signing up once.
-- Replace 'YOUR-USER-UUID-HERE' with your actual user ID
-- (find it in Supabase Dashboard > Authentication > Users)
-- ============================================================

-- Step 1: Get your user ID
-- SELECT id, email FROM auth.users LIMIT 5;

-- ============================================================
-- SAMPLE: Replace this UUID with YOUR user ID from auth.users
-- ============================================================
DO $$
DECLARE
  uid UUID;
  quiz_id1 UUID := gen_random_uuid();
  quiz_id2 UUID := gen_random_uuid();
  quiz_id3 UUID := gen_random_uuid();
BEGIN
  -- Get the first user in the system
  SELECT id INTO uid FROM auth.users LIMIT 1;

  IF uid IS NULL THEN
    RAISE NOTICE 'No users found. Sign up first, then run this script.';
    RETURN;
  END IF;

  RAISE NOTICE 'Seeding data for user: %', uid;

  -- ── Ensure profile exists ──────────────────────────────────
  INSERT INTO public.profiles (id, display_name, interests)
  VALUES (uid, 'Test Student', ARRAY['Python', 'React', 'Machine Learning'])
  ON CONFLICT (id) DO NOTHING;

  -- ── Quizzes ────────────────────────────────────────────────
  INSERT INTO public.quizzes (id, user_id, topic, difficulty, questions) VALUES
  (quiz_id1, uid, 'Python Basics', 'easy', '[
    {"question":"What is a list in Python?","options":["A mutable ordered collection","An immutable tuple","A dictionary","A set"],"correct_index":0,"explanation":"A list is a mutable, ordered collection of items."},
    {"question":"Which keyword defines a function?","options":["func","def","function","lambda"],"correct_index":1,"explanation":"In Python, def is used to define a function."},
    {"question":"How do you print in Python 3?","options":["print x","echo x","print(x)","console.log(x)"],"correct_index":2,"explanation":"print() is the built-in function for output in Python 3."}
  ]'::jsonb),
  (quiz_id2, uid, 'React Hooks', 'medium', '[
    {"question":"Which hook manages local state?","options":["useEffect","useState","useRef","useContext"],"correct_index":1,"explanation":"useState is the hook for local component state."},
    {"question":"When does useEffect run by default?","options":["Only once","After every render","Only on unmount","Before render"],"correct_index":1,"explanation":"useEffect runs after every render unless dependencies are specified."},
    {"question":"What does useRef return?","options":["A state variable","A mutable ref object","A callback","A context"],"correct_index":1,"explanation":"useRef returns a mutable object with a .current property."},
    {"question":"Which hook subscribes to context?","options":["useContext","useReducer","useCallback","useMemo"],"correct_index":0,"explanation":"useContext reads a context value."}
  ]'::jsonb),
  (quiz_id3, uid, 'Machine Learning', 'hard', '[
    {"question":"What is overfitting?","options":["Model too simple","Model memorizes training data","Model has no bias","Model uses too few features"],"correct_index":1,"explanation":"Overfitting occurs when a model learns training data noise instead of generalizing."},
    {"question":"Which algorithm builds decision trees?","options":["KNN","Linear Regression","Random Forest","PCA"],"correct_index":2,"explanation":"Random Forest builds multiple decision trees and aggregates their predictions."},
    {"question":"What does gradient descent minimize?","options":["Accuracy","Loss function","Feature count","Epochs"],"correct_index":1,"explanation":"Gradient descent iteratively minimizes the loss function."}
  ]'::jsonb)
  ON CONFLICT DO NOTHING;

  -- ── Quiz Attempts ──────────────────────────────────────────
  INSERT INTO public.quiz_attempts (quiz_id, user_id, score, total, answers, created_at) VALUES
  (quiz_id1, uid, 3, 3, '{"0":0,"1":1,"2":2}'::jsonb,        NOW() - INTERVAL '5 days'),
  (quiz_id1, uid, 2, 3, '{"0":0,"1":1,"2":1}'::jsonb,        NOW() - INTERVAL '4 days'),
  (quiz_id2, uid, 3, 4, '{"0":1,"1":1,"2":1,"3":1}'::jsonb,  NOW() - INTERVAL '3 days'),
  (quiz_id2, uid, 4, 4, '{"0":1,"1":1,"2":1,"3":0}'::jsonb,  NOW() - INTERVAL '2 days'),
  (quiz_id3, uid, 2, 3, '{"0":1,"1":1,"2":1}'::jsonb,        NOW() - INTERVAL '1 day'),
  (quiz_id3, uid, 3, 3, '{"0":1,"1":1,"2":1}'::jsonb,        NOW() - INTERVAL '6 hours');

  -- ── Interview Sessions ─────────────────────────────────────
  INSERT INTO public.interview_sessions (user_id, role_topic, transcript, feedback, score, created_at) VALUES
  (
    uid,
    'Frontend Developer (React)',
    '[
      {"role":"interviewer","content":"Tell me about yourself and your React experience."},
      {"role":"candidate","content":"I have 2 years of React experience, built several SPAs with hooks and TypeScript."},
      {"role":"interviewer","content":"How do you handle state management in large React apps?"},
      {"role":"candidate","content":"I use Zustand for global state and React Query for server state. Context for theme/auth."},
      {"role":"interviewer","content":"Describe a challenging problem you solved recently."},
      {"role":"candidate","content":"I optimized a slow data table by virtualizing rows with react-window, reducing render time by 80%."}
    ]'::jsonb,
    E'**Strengths:**\n- Clear communication\n- Solid understanding of state management\n- Good performance optimization example\n\n**Areas to improve:**\n- Mention testing practices\n- Discuss CI/CD experience\n- Provide more specific metrics',
    82,
    NOW() - INTERVAL '3 days'
  ),
  (
    uid,
    'Python Backend Engineer',
    '[
      {"role":"interviewer","content":"What Python frameworks have you used?"},
      {"role":"candidate","content":"FastAPI and Flask primarily. FastAPI for async APIs, Flask for simpler apps."},
      {"role":"interviewer","content":"Explain async vs sync in Python."},
      {"role":"candidate","content":"Async uses asyncio for I/O-bound tasks without blocking the event loop. Sync is straightforward but blocks."},
      {"role":"interviewer","content":"How do you design a REST API?"},
      {"role":"candidate","content":"RESTful endpoints, proper HTTP methods, versioning, authentication with JWT, OpenAPI docs."}
    ]'::jsonb,
    E'**Strengths:**\n- Good framework knowledge\n- Understands async programming\n- REST API design principles solid\n\n**Areas to improve:**\n- Discuss database optimization\n- Mention error handling strategies\n- Talk about testing with pytest',
    74,
    NOW() - INTERVAL '1 day'
  ),
  (
    uid,
    'Data Scientist (Python)',
    '[
      {"role":"interviewer","content":"Walk me through your ML workflow."},
      {"role":"candidate","content":"EDA, feature engineering, model selection, training, evaluation, deployment."},
      {"role":"interviewer","content":"How do you handle imbalanced datasets?"},
      {"role":"candidate","content":"SMOTE, class weights, undersampling majority, or using precision-recall curves over accuracy."}
    ]'::jsonb,
    E'**Strengths:**\n- Structured ML workflow\n- Good knowledge of imbalanced data techniques\n\n**Areas to improve:**\n- Mention cross-validation details\n- Discuss model monitoring in production\n- More depth on feature engineering',
    65,
    NOW() - INTERVAL '12 hours'
  );

  -- ── Course Progress ────────────────────────────────────────
  INSERT INTO public.course_progress (user_id, course_title, course_url, source, status, created_at, updated_at) VALUES
  (uid, 'Complete Python Bootcamp - 2024', 'https://youtube.com/watch?v=python-bootcamp', 'freeCodeCamp', 'completed',   NOW() - INTERVAL '10 days', NOW() - INTERVAL '3 days'),
  (uid, 'React - The Complete Guide (Hooks)', 'https://youtube.com/watch?v=react-guide', 'Academind', 'in_progress', NOW() - INTERVAL '7 days',  NOW() - INTERVAL '1 day'),
  (uid, 'Machine Learning A-Z', 'https://youtube.com/watch?v=ml-az', 'SuperDataScience', 'in_progress', NOW() - INTERVAL '5 days',  NOW() - INTERVAL '2 days'),
  (uid, 'FastAPI Full Course', 'https://youtube.com/watch?v=fastapi-course', 'Tech With Tim', 'bookmarked',  NOW() - INTERVAL '4 days',  NOW() - INTERVAL '4 days'),
  (uid, 'TypeScript for Beginners', 'https://youtube.com/watch?v=ts-beginners', 'Traversy Media', 'bookmarked',  NOW() - INTERVAL '2 days',  NOW() - INTERVAL '2 days'),
  (uid, 'System Design Interview Course', 'https://youtube.com/watch?v=system-design', 'ByteByteGo', 'bookmarked',  NOW() - INTERVAL '1 day',   NOW() - INTERVAL '1 day');

  RAISE NOTICE 'Seed data inserted successfully for user: %', uid;
END $$;
