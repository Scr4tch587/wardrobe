import { useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";

type Picture = {
  name: string;
  photoKey: string | null;
  photoExt: string | null;
  photoW?: number | null;
  photoH?: number | null;
};

export function Photo({
  item,
  sizes,
  lazy = true,
  className = "",
}: {
  item: Picture;
  sizes: string;
  lazy?: boolean;
  className?: string;
}) {
  const root = useRouteLoaderData<typeof rootLoader>("root");
  const origin = root?.mediaOrigin ?? "";
  if (!item.photoKey || !item.photoExt) {
    return (
      <div
        className={`grid aspect-[4/5] place-items-center bg-[#e7e0d4] px-3 text-center text-sm text-muted ${className}`}
      >
        {item.name}
      </div>
    );
  }
  const small = `${origin}/media/${item.photoKey}-480.${item.photoExt}`;
  const large = `${origin}/media/${item.photoKey}-1600.${item.photoExt}`;
  return (
    <img
      src={small}
      srcSet={`${small} 480w, ${large} 1600w`}
      sizes={sizes}
      width={item.photoW ?? undefined}
      height={item.photoH ?? undefined}
      alt={item.name}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      className={`aspect-[4/5] w-full object-cover ${className}`}
    />
  );
}
