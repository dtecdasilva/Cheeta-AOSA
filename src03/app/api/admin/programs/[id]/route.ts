import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { programResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(programResource, ADMIN_ONLY);
