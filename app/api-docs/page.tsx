import type { Metadata } from "next";
import ApiDocs from "../../shared/ApiDocs";

export const metadata: Metadata = {
  title: "Luma Health | API Documentation",
  description: "Interactive OpenAPI documentation for Luma Health QA automation.",
};

export default function ApiDocsPage() {
  return <ApiDocs />;
}
