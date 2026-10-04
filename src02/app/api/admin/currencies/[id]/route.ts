import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { currencyResource } from "@/server/modules/reference/reference.resources";

export const { GET, PATCH } = itemRoutes(currencyResource, ADMIN_ONLY);
