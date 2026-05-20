import MenuRestaurantLayoutClient from "./MenuRestaurantLayoutClient";

export default function MenuRestaurantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MenuRestaurantLayoutClient>{children}</MenuRestaurantLayoutClient>;
}
