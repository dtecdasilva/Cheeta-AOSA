import { collectionRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { departmentResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(departmentResource, INSTITUTION_STAFF);
