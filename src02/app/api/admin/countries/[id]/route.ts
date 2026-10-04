import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { countryResource } from "@/server/modules/reference/reference.resources";

export const { GET, PATCH } = itemRoutes(countryResource, ADMIN_ONLY);
