import { getHeurekaHaffId } from "@/lib/heureka/affiliate";
import SearchPageClient from "./SearchPageClient";

export default function SearchPage() {
  return <SearchPageClient heurekaHaffId={getHeurekaHaffId()} />;
}
