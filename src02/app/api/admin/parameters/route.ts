import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { parameterResource } from "@/server/modules/reference/reference.resources";

export const { GET, POST } = collectionRoutes(parameterResource, ADMIN_ONLY);
