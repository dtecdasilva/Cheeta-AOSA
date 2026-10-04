import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { departmentResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(departmentResource, INSTITUTION_STAFF);
