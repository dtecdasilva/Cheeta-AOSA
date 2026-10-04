import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { programResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(programResource, INSTITUTION_STAFF);
