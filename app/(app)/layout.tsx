import PrivyWrapper from "@/components/providers/privy-provider";

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <PrivyWrapper>{children}</PrivyWrapper>
    );
}
