CREATE TABLE `comment_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`url` text NOT NULL,
	`label` text,
	FOREIGN KEY (`comment_id`) REFERENCES `task_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_attachments_comment_idx` ON `comment_attachments` (`comment_id`);--> statement-breakpoint
CREATE TABLE `comment_mentions` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `task_comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_mentions_user_idx` ON `comment_mentions` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_idx` ON `task_comments` (`task_id`);