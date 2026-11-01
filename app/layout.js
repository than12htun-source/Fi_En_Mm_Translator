import "./globals.css";

export const metadata = {
  title: "Finnish → English / မြန်မာ + MP3",
  description: "Translate Finnish to English and Myanmar, listen and download MP3 audio.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="my">
      <body>{children}</body>
    </html>
  );
}
