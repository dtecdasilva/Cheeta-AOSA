import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { institutionResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(institutionResource, ADMIN_ONLY);
