/* eslint-disable */
/**
 * Local stand-in for Convex's own `npx convex dev` codegen output, which is
 * gitignored (see ./README.md) and normally produced by pushing to a live
 * Convex deployment — unavailable in this sandbox. Built from Convex's own
 * `DataModelFromSchemaDefinition` utility against the real `schema.ts`, so
 * `Doc`/`Id` stay accurate to the actual schema instead of a loose `any`.
 * Regenerate for real with `npx convex dev` once a deployment is configured.
 */
import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  SystemTableNames,
  TableNamesInDataModel,
} from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
