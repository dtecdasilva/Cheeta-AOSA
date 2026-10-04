import { collectionRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { facultyResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(facultyResource, INSTITUTION_STAFF);
