import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { parameterResource } from "@/server/modules/reference/reference.resources";

export const { GET, PATCH } = itemRoutes(parameterResource, ADMIN_ONLY);
