/**
 * The whole database schema. Migrations in db/migrations are generated
 * from these files with `npm run db:generate`; never edit a generated
 * migration by hand once it has been applied anywhere.
 */
export * from "./identity";
export * from "./reference";
export * from "./institutions";
export * from "./applications";
export * from "./payments";
export * from "./enrolment";
export * from "./notifications";
export * from "./files";
export * from "./audit";
