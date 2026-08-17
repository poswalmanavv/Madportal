CREATE TABLE `content_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`content_title` text NOT NULL,
	`content_type` text,
	`platform` text,
	`deadline` text,
	`description` text,
	`current_status` text NOT NULL,
	`detailed_update` text,
	`link` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_entries_created_by_idx` ON `content_entries` (`created_by`);--> statement-breakpoint
CREATE TABLE `content_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor` text NOT NULL,
	`update` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `content_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `content_history_entry_idx` ON `content_history` (`entry_id`);--> statement-breakpoint
CREATE TABLE `hospitality_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_name` text NOT NULL,
	`organization` text,
	`contact_number` text,
	`email` text,
	`arrival_date` text,
	`departure_date` text,
	`requirement` text,
	`current_status` text NOT NULL,
	`detailed_update` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hospitality_entries_created_by_idx` ON `hospitality_entries` (`created_by`);--> statement-breakpoint
CREATE TABLE `hospitality_history` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`actor` text NOT NULL,
	`update` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `hospitality_entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hospitality_history_entry_idx` ON `hospitality_history` (`entry_id`);