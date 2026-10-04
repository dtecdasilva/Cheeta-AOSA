import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { currencyResource } from "@/server/modules/reference/reference.resources";

export const { GET, POST } = collectionRoutes(currencyResource, ADMIN_ONLY);
