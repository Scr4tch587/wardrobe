import type { ItemCard, OutfitSummary } from "./queries.server";

export type Picture = {
  id?: string;
  name: string;
  photoKey: string | null;
  photoExt: "webp" | "jpg" | null;
  photoW: number | null;
  photoH: number | null;
};

export type HomeData = {
  today: string;
  outfits: OutfitSummary[];
  streak: { current: number; longest: number };
  outfitCount: number;
  avgRating: number | null;
  entries: (Picture & { id: string; score: number; temp: number | null; explanation: string })[];
};

export type ItemsData = {
  items: ItemCard[];
  slot: string | null;
  sort: string;
};

export type ItemData = {
  item: ItemCard;
  dates: string[];
  cutoff: string;
  withItems: {
    other_id: string;
    name: string;
    photo_key: string | null;
    photo_ext: string | null;
    photo_w: number | null;
    photo_h: number | null;
    together: number;
    avg_rating: number | null;
  }[];
  outfits: { date: string }[];
};

export type OutfitsData = {
  outfits: OutfitSummary[];
  next: string | null | undefined;
};

export type OutfitData = {
  outfit: OutfitSummary;
  weather: { apparent_max_c: number; apparent_min_c: number; weather_code: number | null } | null;
  suggestion: { name: string | null; message: string | null; status: string; text_hidden: number } | null;
};

export type LeaderboardData = {
  today: string;
  entries: (Picture & { id: string; rank: number; score: number; movement: string; explanation: string })[];
};

export type StatsData = {
  cutoff: string;
  total: number;
  avgRating: number | null;
  rated: number;
  streak: { current: number; longest: number };
  concentration: number | null;
  dormant: { id: string; name: string; lastWorn: string | null }[];
  slots: { label: string; value: number }[];
  temps: { label: string; value: number; note: string }[];
  visitor: { label: string; outfits: number; rating: number | null }[];
};

export type SuggestData = {
  items: ItemCard[];
  ranked: string[];
  feels: number | null;
  siteKey: string;
  sent: boolean;
};

export type SuggestionCard = {
  id: string;
  name: string | null;
  message: string | null;
  people: number | null;
  wornOn: string | null;
  pieces: Picture[];
};

export type SuggestionsData = {
  sort: string;
  page: number;
  cards: SuggestionCard[];
  more: boolean;
};

export type AdminHomeData = {
  today: string;
  logged: boolean;
  pending: number;
  run: { date: string; status: string; effective_temp: number | null; computed_at: number } | null;
  ran: boolean;
};

export type AdminItemsData = {
  items: { id: string; name: string; slot: string; archived_at: number | null }[];
};

export type AdminItemData = {
  item: ItemCard;
};

export type AdminNewItemData = {
  id: string;
};

export type AdminOutfitData = {
  date: string;
  today: string;
  outfit: {
    date: string;
    rating: number | null;
    note: string | null;
    fit_pic_key: string | null;
    fit_pic_ext: string | null;
    fit_pic_w: number | null;
    fit_pic_h: number | null;
    source_suggestion_id: string | null;
  } | null;
  selected: string[];
  source: string | null;
  items: { id: string; name: string; slot: string; archived_at: number | null }[];
};

export type AdminSuggestionsData = {
  status: string;
  today: string;
  suggestions: {
    id: string;
    name: string | null;
    message: string | null;
    combo_key: string;
    created_at: number;
    same: number;
    pieces: {
      suggestion_id: string;
      id: string;
      name: string;
      photo_key: string | null;
      photo_ext: string | null;
      photo_w: number | null;
      photo_h: number | null;
    }[];
  }[];
};

export type SetupData = {
  allowed: boolean;
  token: string | undefined;
};
