CREATE TABLE "leaderboard_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"snapshot_date_asia_kolkata" text NOT NULL,
	"slot" text NOT NULL,
	"profile_id" text NOT NULL,
	"today_focus_seconds" integer DEFAULT 0 NOT NULL,
	"today_completions_count" integer DEFAULT 0 NOT NULL,
	"seven_day_focus_seconds" integer DEFAULT 0 NOT NULL,
	"seven_day_completions_count" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"is_delayed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"pin_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"work_session_id" text NOT NULL,
	"task_id" text,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_date_asia_kolkata" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completions_work_session_id_unique" UNIQUE("work_session_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"planned_duration_seconds" integer,
	"category" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"work_session_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"task_id" text,
	"snapshot_title" text NOT NULL,
	"snapshot_category" text,
	"snapshot_planned_duration_seconds" integer,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"target_duration_seconds" integer,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leaderboard_snapshots" ADD CONSTRAINT "leaderboard_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_work_session_id_work_sessions_id_fk" FOREIGN KEY ("work_session_id") REFERENCES "public"."work_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_segments" ADD CONSTRAINT "work_segments_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_sessions" ADD CONSTRAINT "work_sessions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_leaderboard_unique_slot" ON "leaderboard_snapshots" USING btree ("snapshot_date_asia_kolkata","slot","profile_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_date_slot" ON "leaderboard_snapshots" USING btree ("snapshot_date_asia_kolkata","slot");--> statement-breakpoint
CREATE INDEX "idx_sessions_profile_id" ON "sessions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token_hash" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_task_completions_profile_date" ON "task_completions" USING btree ("profile_id","completed_date_asia_kolkata");--> statement-breakpoint
CREATE INDEX "idx_tasks_profile_id" ON "tasks" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_category" ON "tasks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_work_segments_session" ON "work_segments" USING btree ("work_session_id");--> statement-breakpoint
CREATE INDEX "idx_work_segments_profile" ON "work_segments" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_work_segments_active" ON "work_segments" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "idx_work_sessions_profile_id" ON "work_sessions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_work_sessions_status" ON "work_sessions" USING btree ("status");