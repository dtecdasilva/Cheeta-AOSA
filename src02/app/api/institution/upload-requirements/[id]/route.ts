import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { uploadRequirementResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(uploadRequirementResource, INSTITUTION_STAFF);
