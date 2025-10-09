import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <title>Guestlist Pro</title>
      {/*Meta data */}
      <meta name="description" content="Guestlist Pro - Manage your event guests efficiently made by Nate (natemes.com)" />
      <Head />
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
