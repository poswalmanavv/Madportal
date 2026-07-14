CREATE TABLE `departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `departments_name_unique` ON `departments` (`name`);--> statement-breakpoint
CREATE TABLE `design_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`design_title` text NOT NULL,
	`requirement` text,
	`description` text,
	`assigned_designer` text NOT NULL,
	`requested_by` text NOT NULL,
	`deadline` text,
	`status` text DEFAULT 'Pending' NOT NULL,
	`final_submission_link` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assigned_designer`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_requests_designer_idx` ON `design_requests` (`assigned_designer`);--> statement-breakpoint
CREATE TABLE `ep_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`ep_name` text NOT NULL,
	`organization` text NOT NULL,
	`contact_number` text,
	`email` text,
	`person_contacted` text,
	`date` text,
	`discussion_summary` text,
	`current_status` text NOT NULL,
	`detailed_update` text,
	`attach_notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ep_entries_created_by_idx` ON `ep_entries` (`created_by`);--> statement-breakpoint
CREATE TABLE `ep_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor` text NOT NULL,
	`update` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `ep_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ep_history_entry_idx` ON `ep_history` (`entry_id`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `performance_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`action` text NOT NULL,
	`reference_id` text,
	`points` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `performance_logs_user_idx` ON `performance_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `sponsorship_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`industry` text,
	`company_website` text,
	`contact_person_name` text,
	`designation` text,
	`contact_number` text,
	`email` text,
	`date_contacted` text,
	`sponsorship_requirement` text,
	`current_status` text NOT NULL,
	`follow_up_date` text,
	`detailed_update` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sponsorship_entries_created_by_idx` ON `sponsorship_entries` (`created_by`);--> statement-breakpoint
CREATE TABLE `sponsorship_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor` text NOT NULL,
	`update` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `sponsorship_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sponsorship_history_entry_idx` ON `sponsorship_history` (`entry_id`);--> statement-breakpoint
CREATE TABLE `task_assignees` (
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_assignees_user_idx` ON `task_assignees` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_timeline` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`actor` text NOT NULL,
	`status` text NOT NULL,
	`progress` integer NOT NULL,
	`comment` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_timeline_task_idx` ON `task_timeline` (`task_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`created_by` text NOT NULL,
	`priority` text NOT NULL,
	`deadline` text NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`attachments` text DEFAULT '[]' NOT NULL,
	`remarks` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tasks_status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `tasks_created_by_idx` ON `tasks` (`created_by`);--> statement-breakpoint
CREATE TABLE `user_departments` (
	`user_id` text NOT NULL,
	`department` text NOT NULL,
	PRIMARY KEY(`user_id`, `department`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_departments_department_idx` ON `user_departments` (`department`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`year` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`team_head_role` text DEFAULT 'None' NOT NULL,
	`can_manage_team` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`password_changed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_active_idx` ON `users` (`active`);