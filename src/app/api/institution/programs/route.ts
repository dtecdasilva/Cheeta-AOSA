import { collectionRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { programResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(programResource, INSTITUTION_STAFF);
