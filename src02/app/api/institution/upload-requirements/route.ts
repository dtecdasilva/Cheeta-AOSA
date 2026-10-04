import { collectionRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { uploadRequirementResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(uploadRequirementResource, INSTITUTION_STAFF);
