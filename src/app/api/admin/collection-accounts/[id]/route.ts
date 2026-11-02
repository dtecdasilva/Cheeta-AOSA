import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { collectionAccountResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH, DELETE } = itemRoutes(collectionAccountResource, ADMIN_ONLY);
