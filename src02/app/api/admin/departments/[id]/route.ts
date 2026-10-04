import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { departmentResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(departmentResource, ADMIN_ONLY);
