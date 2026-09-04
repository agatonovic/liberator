import { isShopifyCatalogId, isShopifyWorkspaceId } from "./domain";

export function isShopifyLibraryDocument(doc: { organizationId?: string | null; catalogId?: string | null }) {
  return isShopifyWorkspaceId(doc.organizationId) || isShopifyCatalogId(doc.catalogId);
}

/** Drop Shopify edition records so Industrial `library.json` cannot absorb them. */
export function omitShopifyFromLibrarySnapshot<
  T extends {
    documents: { organizationId?: string | null; catalogId?: string | null }[];
    folders: { organizationId?: string | null }[];
    activity?: { organizationId?: string | null }[];
  },
>(snapshot: T): T {
  return {
    ...snapshot,
    documents: snapshot.documents.filter((doc) => !isShopifyLibraryDocument(doc)),
    folders: snapshot.folders.filter((folder) => !isShopifyWorkspaceId(folder.organizationId)),
    activity: snapshot.activity?.filter((event) => !isShopifyWorkspaceId(event.organizationId)),
  };
}
