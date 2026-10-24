CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"pin_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_normalized_name_unique" UNIQUE("normalized_name")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"planned_duration_seconds" integer,
	"category" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "planned_duration_positive_check" CHECK ("tasks"."planned_duration_seconds" IS NULL OR "tasks"."planned_duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "work_session_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_session_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"target_duration_seconds" integer,
	"tracked_seconds" integer DEFAULT 0 NOT NULL,
	"task_title_snapshot" text NOT NULL,
	"category_snapshot" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_seconds_nonnegative" CHECK ("work_sessions"."tracked_seconds" >= 0),
	CONSTRAINT "countdown_target_positive" CHECK ("work_sessions"."mode" != 'countdown' OR ("work_sessions"."target_duration_seconds" IS NOT NULL AND "work_sessions"."target_duration_seconds" > 0))
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"work_session_id" uuid NOT NULL,
	"task_title_snapshot" text NOT NULL,
	"category_snapshot" text,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completions_work_session_id_unique" UNIQUE("work_session_id")
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshot_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_run_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name_snapshot" text NOT NULL,
	"focus_seconds_today" integer DEFAULT 0 NOT NULL,
	"completed_tasks_today" integer DEFAULT 0 NOT NULL,
	"focus_seconds_last_7_days" integer DEFAULT 0 NOT NULL,
	"completed_tasks_last_7_days" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_focus_today_nonneg" CHECK ("leaderboard_snapshot_entries"."focus_seconds_today" >= 0),
	CONSTRAINT "entry_tasks_today_nonneg" CHECK ("leaderboard_snapshot_entries"."completed_tasks_today" >= 0),
	CONSTRAINT "entry_focus_7d_nonneg" CHECK ("leaderboard_snapshot_entries"."focus_seconds_last_7_days" >= 0),
	CONSTRAINT "entry_tasks_7d_nonneg" CHECK ("leaderboard_snapshot_entries"."completed_tasks_last_7_days" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leaderboard_snapshot_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"local_date" text NOT NULL,
	"slot" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_delayed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_session_segments" ADD CONSTRAINT "work_session_segments_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_snapshot_entries" ADD CONSTRAINT "leaderboard_snapshot_entries_snapshot_run_id_leaderboard_snapshot_runs_id_fk" FOREIGN KEY ("snapshot_run_id") REFERENCES "public"."leaderboard_snapshot_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_snapshot_entries" ADD CONSTRAINT "leaderboard_snapshot_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_expires_at" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_owner_status" ON "tasks" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_tasks_owner_updated_at" ON "tasks" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_segments_single_open" ON "work_session_segments" USING btree ("work_session_id") WHERE "work_session_segments"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_segments_session_started_at" ON "work_session_segments" USING btree ("work_session_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_sessions_single_running" ON "work_sessions" USING btree ("user_id") WHERE "work_sessions"."status" = 'running';--> statement-breakpoint
CREATE INDEX "idx_work_sessions_user_status" ON "work_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_work_sessions_task_id" ON "work_sessions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_completions_user_completed_at" ON "task_completions" USING btree ("user_id","completed_at");--> statement-breakpoint
CREATE INDEX "idx_task_completions_task_id" ON "task_completions" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leaderboard_entry_run_user" ON "leaderboard_snapshot_entries" USING btree ("snapshot_run_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leaderboard_runs_date_slot" ON "leaderboard_snapshot_runs" USING btree ("local_date","slot");