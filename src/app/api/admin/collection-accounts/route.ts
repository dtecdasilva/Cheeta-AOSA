import { collectionRoutes, ADMIN_ONLY } from "@/server/modules/resource";
import { collectionAccountResource } from "@/server/modules/institutions/institutions.resources";

/** Cheeta's own collection accounts: where applicants pay application fees, the web fee and tuition. */
export const { GET, POST } = collectionRoutes(collectionAccountResource, ADMIN_ONLY);
