import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { institutionResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(institutionResource, ADMIN_ONLY);
