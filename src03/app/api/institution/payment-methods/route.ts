import { collectionRoutes, INSTITUTION_STAFF } from "@/server/modules/resource";
import { institutionPaymentMethodResource } from "@/server/modules/institutions/institutions.resources";

export const { GET, POST } = collectionRoutes(institutionPaymentMethodResource, INSTITUTION_STAFF);
