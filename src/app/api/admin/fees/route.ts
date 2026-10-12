import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { feeResource } from "@/server/modules/institutions/institutions.resources";

/** Every institution's fee schedule (?institutionId= to narrow), and adding a fee for one. */
export const { GET, POST } = collectionRoutes(feeResource, ADMIN_ONLY);
