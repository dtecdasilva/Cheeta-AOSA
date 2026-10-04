import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { facultyResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(facultyResource, ADMIN_ONLY);
