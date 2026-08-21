CREATE TYPE "public"."person_sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."relationship_type" AS ENUM('PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF');--> statement-breakpoint
CREATE TYPE "public"."sibling_seniority" AS ENUM('A_OLDER', 'B_OLDER', 'UNKNOWN');--> statement-breakpoint
CREATE TABLE "family_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"surname" text NOT NULL,
	"sex" "person_sex" NOT NULL,
	"date_of_birth" date,
	"date_of_death" date,
	"deceased" boolean DEFAULT false NOT NULL,
	"bio" text,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "relationship_type" NOT NULL,
	"person_a_id" text NOT NULL,
	"person_b_id" text NOT NULL,
	"biological" boolean DEFAULT false NOT NULL,
	"biological_union_id" text,
	"married" boolean DEFAULT false NOT NULL,
	"seniority" "sibling_seniority" DEFAULT 'UNKNOWN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_distinct_people_check" CHECK ("relationships"."person_a_id" <> "relationships"."person_b_id"),
	CONSTRAINT "relationships_type_fields_check" CHECK (
        ("relationships"."type" = 'PARENT_OF' AND "relationships"."seniority" = 'UNKNOWN' AND "relationships"."married" = false)
        OR ("relationships"."type" = 'SPOUSE_OF' AND "relationships"."seniority" = 'UNKNOWN' AND "relationships"."biological" = false AND "relationships"."biological_union_id" IS NULL)
        OR ("relationships"."type" = 'SIBLING_OF' AND "relationships"."married" = false AND "relationships"."biological" = false AND "relationships"."biological_union_id" IS NULL)
      )
);
--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_a_id_people_id_fk" FOREIGN KEY ("person_a_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_person_b_id_people_id_fk" FOREIGN KEY ("person_b_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "relationships_person_a_idx" ON "relationships" USING btree ("person_a_id");--> statement-breakpoint
CREATE INDEX "relationships_person_b_idx" ON "relationships" USING btree ("person_b_id");--> statement-breakpoint
INSERT INTO "family_state" ("id", "revision") VALUES (1, 0);
