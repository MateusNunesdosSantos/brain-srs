import { notFound } from "next/navigation";

const pages = new Set([
  "revisar",
  "biblioteca",
  "estatisticas",
  "vulnerabilidades",
  "simulado",
  "configuracoes",
]);

export default async function RoutedPage({
  params,
}: {
  params: Promise<{ page: string }>;
}) {
  const { page } = await params;
  if (!pages.has(page)) notFound();
  return null;
}
