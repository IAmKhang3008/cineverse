import { ListResponse, SearchResponse, DetailResponse } from "./types";

const BASE_URL = "https://phimapi.com/v1/api";

export interface FilterParams {
  page?: number;
  category?: string;
  country?: string;
  year?: string;
  sort_field?: string;
  sort_type?: string;
  limit?: number;
}

export async function fetchMovies(
  type: "danh-sach" | "the-loai" | "quoc-gia" = "danh-sach",
  slug: string = "phim-le",
  filters: FilterParams = {}
): Promise<ListResponse> {
  const url = new URL(`${BASE_URL}/${type}/${slug}`);
  
  if (filters.page) url.searchParams.append("page", filters.page.toString());
  if (filters.category) url.searchParams.append("category", filters.category);
  if (filters.country) url.searchParams.append("country", filters.country);
  if (filters.year) url.searchParams.append("year", filters.year);
  if (filters.sort_field) url.searchParams.append("sort_field", filters.sort_field);
  if (filters.sort_type) url.searchParams.append("sort_type", filters.sort_type);
  if (filters.limit) url.searchParams.append("limit", filters.limit.toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Network response was not ok");
  return res.json();
}

export async function searchMovies(keyword: string, filters: FilterParams = {}): Promise<SearchResponse> {
  const url = new URL(`${BASE_URL}/tim-kiem`);
  url.searchParams.append("keyword", keyword);
  
  if (filters.page) url.searchParams.append("page", filters.page.toString());
  if (filters.category) url.searchParams.append("category", filters.category);
  if (filters.country) url.searchParams.append("country", filters.country);
  if (filters.year) url.searchParams.append("year", filters.year);
  if (filters.limit) url.searchParams.append("limit", (filters.limit || 24).toString());

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Network response was not ok");
  return res.json();
}

export async function fetchMovieDetails(slug: string): Promise<DetailResponse> {
  const url = `https://phimapi.com/phim/${slug}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network response was not ok");
  return res.json();
}
