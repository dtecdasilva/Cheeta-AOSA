import { itemRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { adminPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH, DELETE } = itemRoutes(adminPaymentMethodResource, ADMIN_ONLY);
