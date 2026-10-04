import { itemRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { institutionPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, PATCH } = itemRoutes(institutionPaymentMethodResource, INSTITUTION_STAFF);
