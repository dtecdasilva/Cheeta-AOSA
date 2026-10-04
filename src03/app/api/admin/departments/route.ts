import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { departmentResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(departmentResource, ADMIN_ONLY);
