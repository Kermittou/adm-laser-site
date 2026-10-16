import { Container } from "./ui";

export function StatsBar({ items }: { items: { valeur: string; libelle: string }[] }) {
  return (
    <div className="bg-steel-deep text-blanc">
      <Container>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4 md:py-12">
          {items.map((s) => (
            <div key={s.libelle} className="flex flex-col-reverse border-l-2 border-accent pl-4">
              <dt className="mt-1 text-sm text-gris-clair-2">{s.libelle}</dt>
              <dd className="font-display text-[28px] leading-tight font-extrabold md:text-[34px]">{s.valeur}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </div>
  );
}
