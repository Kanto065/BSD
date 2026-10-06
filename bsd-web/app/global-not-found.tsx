import RootLayout, { metadata as bsdMetadata } from "./(bsd)/layout";
import NotFound from "./(bsd)/not-found";

// Unmatched URLs have no route group, so render the BSD layout and 404 page directly.
export const metadata = bsdMetadata;

export default function GlobalNotFound() {
  return (
    <RootLayout>
      <NotFound />
    </RootLayout>
  );
}
