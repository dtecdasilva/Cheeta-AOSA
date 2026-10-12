import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { feeResource } from "@/server/modules/institutions/institutions.resources";

/** One of the institution's own fees: read it, change it, or activate/deactivate it ({ status }). */
export const { GET, PATCH } = itemRoutes(feeResource, INSTITUTION_STAFF);
