import "./globals.css";
export const metadata = {
title: "Subscription System",
description: "Subscription management platform"
};
export default function RootLayout({
children
}: {
children: React.ReactNode;
}) {
return (
<html lang="en">
<body>{children}</body>
</html>
);
}