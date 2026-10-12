import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { feeResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(feeResource, ADMIN_ONLY);
