# Legacy migrations excluded from the active 0.5.0 chain

Checked against the production migration ledger and read-only PostgreSQL catalog on 2026-10-09. These files are preserved for audit; Supabase CLI does not treat this directory as an active migration folder.

The active folder now contains the 60 production ledger migrations plus six verified local-only changes reconciled as already present in production. The one exact production-only migration was restored from supabase_migrations.schema_migrations; its SQL was not executed. Local and production migration version/name pairs now match 66/66.

## Archived local-only migrations

| Migration | Disposition | Evidence / reason |
|---|---|---|
| 20260428200614_0de79832-224f-4ad9-929f-bc8eecb75a0e.sql | DUPLICATE | The set_updated_at function is represented by the later pinned-search-path version 20260428200624; current production function is present. |
| 20260429155049_d1adc143-aa04-489f-ac07-a545db7d820e.sql | OBSOLETE | Temporarily grants authenticated execution of public.has_role; production explicitly denies it. |
| 20260429155141_5f1ece29-5b1d-418e-b807-2f072009dccb.sql | DUPLICATE | Revoke is already represented by the applied role-hardening migration and current function ACL. |
| 20260429201840_68bcf15d-f17f-4510-8c3d-56b5614e264d.sql | OBSOLETE | Student homework mutations are server-side; production exposes only the read policy for submissions. |
| 20260504082618_grant_has_role.sql | OBSOLETE | Re-grants public.has_role to anon/authenticated; current production ACL denies both roles. |
| 20260920090000_day1_video_and_check_quiz.sql | DUPLICATE | Day 1 video/check content is superseded by the exact production-only Day 1 sequence migration. |
| 20260920100000_course_assessment_format.sql | OBSOLETE | Its blanket clearing of homework conflicts with current production data (lesson 2 has active homework); do not replay. |
| 20260920110000_seed_interactive_lessons_2_to_13.sql | OBSOLETE | Current interactive lessons exist, but their content/title data has since been edited and no longer equals this seed. Replaying could overwrite current course content. |
| 20260920120000_expand_interactive_lessons_2_and_3.sql | OBSOLETE | Current lessons 2–3 have evolved beyond this expansion; retain only as historical content. |
| 20260920130000_reorder_day3_question_after_material.sql | OBSOLETE | The migration targets the old question text; that exact question is absent from current lesson 3. |
| 20260921090000_rebuild_day_one_ctfl_foundations.sql | DUPLICATE | Destructive Day 1 rebuild is contained in 20260922132011_restore_day_one_base_sequence; never replay it against production. |
| 20260921100000_simplify_day_one_language.sql | OBSOLETE | Current Day 1 was subsequently rebuilt/refined; this intermediate text revision is not the production content. |
| 20260921110000_day1_intro_and_precise_definitions.sql | DUPLICATE | The production-only Day 1 sequence contains the introduction and definitions. |
| 20260921152148_expand_day_one_course_and_theory.sql | DUPLICATE | Its Day 1 expansion is represented in the production-only Day 1 sequence. |
| 20260922150000_refine_day_one_quality_and_interactions.sql | OBSOLETE | Current Day 1 has no reflection block and its visual-choice prompt differs; this revision is not current production behavior. |
| 20260922190000_restore_day_one_guides_and_visuals.sql | OBSOLETE | Its SQL exits once guides exist; production already has guide blocks, and current lesson content is maintained as production data. |

## Reconciled local-only migrations retained as active

These exact version/name pairs were inserted into the production migration ledger as already applied. This was a ledger-only change: no migration SQL was executed and no application data/schema was modified.

| Migration | Why reconciliation is safe |
|---|---|
| 20260428132618_2ce95cb3-0f21-4cca-89ed-d997c96ffe02.sql | The baseline tables, profiles, roles, lessons and related schema/data are present in production. |
| 20260428132649_3a2f0b20-a8a2-49b3-9acb-295bd23b4bb0.sql | Production function security and role ACLs match the hardening intent. |
| 20260428200624_8cb1a81c-ed5e-493e-a0e7-c3803510d199.sql | The production timestamp trigger function exists with a pinned public search path. |
| 20260429165014_4255cfd4-6119-41ab-8fbc-5f8d29c48ce0.sql | homework_status.awaiting_mentor exists in production and is used by current code. |
| 20260816150000_rename_final_test.sql | Production lesson 14 is already titled Итоговый тест. |
| 20260919000000_interactive_lesson_blocks.sql | Production has the lesson_blocks and progress structures required by the current lesson renderer; catalog checks confirm the live structures and policies. |

The reconciled rows are migration-history markers, not evidence that this CLI executed the original SQL. Their statements arrays are empty by design.

## Production-only migration

20260922132011_restore_day_one_base_sequence was retrieved from the production ledger and restored at supabase/migrations/20260922132011_restore_day_one_base_sequence.sql. The production row contained one SQL statement (36,672 database characters; MD5 e0df1948ef53adbafcfc475fd7c6351b). The restored file's SQL lines match the production source; the only difference is trailing newline formatting introduced by patch normalization. This migration deletes/rebuilds Day 1 blocks and clears historical progress/submissions/attempts, so its SQL must not be run against production again. The production ledger already marks it applied.

## Verification limit

Production catalog inventory: 23 public tables / 196 columns / 63 indexes / 99 constraints / 2 enums / 39 policies / 14 public/private functions / 17 non-internal triggers. RLS is enabled for all 23 public tables. Table and column names matched the generated application type contract (23/23 tables). Direct local db diff and clean database reset were unavailable without linked CLI credentials and Docker; catalog observations are read-only and do not constitute a shadow-database DDL diff.
