import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const personSex = pgEnum("person_sex", ["male", "female"]);
export const relationshipType = pgEnum("relationship_type", [
  "PARENT_OF",
  "SPOUSE_OF",
  "SIBLING_OF",
]);
export const siblingSeniority = pgEnum("sibling_seniority", [
  "A_OLDER",
  "B_OLDER",
  "UNKNOWN",
]);

export const people = pgTable("people", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  surname: text("surname").notNull(),
  sex: personSex("sex").notNull(),
  dateOfBirth: date("date_of_birth"),
  dateOfDeath: date("date_of_death"),
  deceased: boolean("deceased").notNull().default(false),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const relationships = pgTable(
  "relationships",
  {
    id: text("id").primaryKey(),
    type: relationshipType("type").notNull(),
    personAId: text("person_a_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    personBId: text("person_b_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    biological: boolean("biological").notNull().default(false),
    biologicalUnionId: text("biological_union_id"),
    married: boolean("married").notNull().default(false),
    seniority: siblingSeniority("seniority").notNull().default("UNKNOWN"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("relationships_person_a_idx").on(table.personAId),
    index("relationships_person_b_idx").on(table.personBId),
    check(
      "relationships_distinct_people_check",
      sql`${table.personAId} <> ${table.personBId}`,
    ),
    check(
      "relationships_type_fields_check",
      sql`
        (${table.type} = 'PARENT_OF' AND ${table.seniority} = 'UNKNOWN' AND ${table.married} = false)
        OR (${table.type} = 'SPOUSE_OF' AND ${table.seniority} = 'UNKNOWN' AND ${table.biological} = false AND ${table.biologicalUnionId} IS NULL)
        OR (${table.type} = 'SIBLING_OF' AND ${table.married} = false AND ${table.biological} = false AND ${table.biologicalUnionId} IS NULL)
      `,
    ),
  ],
);

/** One row serializes writes and supplies the snapshot revision expected by the UI. */
export const familyState = pgTable("family_state", {
  id: integer("id").primaryKey(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
