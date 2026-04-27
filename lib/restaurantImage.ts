/**
 * Match Flutter `getRestaurantImageUrl` / `getRestaurantBannerUrl` (lib/utils/restaurant_image.dart).
 */

export function getRestaurantImageUrl(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const logoUrl = data.logoUrl;
  if (typeof logoUrl === "string" && logoUrl.trim()) return logoUrl.trim();
  const imageUrl = data.imageUrl;
  if (typeof imageUrl === "string" && imageUrl.trim()) return imageUrl.trim();
  const profilePicture = data.profile_picture;
  if (typeof profilePicture === "string" && profilePicture.trim())
    return profilePicture.trim();
  const photoUrl = data.photoUrl;
  if (typeof photoUrl === "string" && photoUrl.trim()) return photoUrl.trim();
  return null;
}

export function getRestaurantBannerUrl(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null;
  const cover = data.coverImageUrl;
  if (typeof cover === "string" && cover.trim()) return cover.trim();
  const menuBanner = data.menuBannerUrl;
  if (typeof menuBanner === "string" && menuBanner.trim()) return menuBanner.trim();
  return null;
}
