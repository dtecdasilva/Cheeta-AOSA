import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(adminPaymentMethodResource, ADMIN_ONLY);
