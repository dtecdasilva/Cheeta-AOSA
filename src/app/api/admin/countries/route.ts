import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { countryResource } from "@/server/modules/reference/reference.resources";

export const { GET, POST } = collectionRoutes(countryResource, ADMIN_ONLY);
